/**
 * B2 · 生物锁原生桥接 + 三重解锁 单元测试
 * 运行：node test_biometric.js
 * 说明：用内存假插件模拟 @bytetrade/capacitor-native-biometric（Capacitor.Plugins.NativeBiometric），
 *       验证「setup 登记生物锁 → 生物解锁取回 DEK → 主密码仍可用 → 改密重封装 → Web 降级」。
 */
const esbuild = require('esbuild');
const path = require('path');
const Module = require('module');

// ---- 内存版 localStorage ----
function freshLS() {
  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  return mem;
}

// ---- 内存假插件（模拟 NativeBiometric：Android Keystore 后端由真机提供，这里只验证调用契约） ----
function fakePlugin() {
  const store = {};
  return {
    store,
    isAvailable: async () => ({ isAvailable: true, biometryType: 'FINGERPRINT' }),
    verifyIdentity: async () => true,
    setCredentials: async ({ username, password, server }) => { store[server] = { username, password }; },
    getCredentials: async ({ server }) => {
      if (!store[server]) throw new Error('no credentials');
      return store[server];
    },
    deleteCredentials: async ({ server }) => { delete store[server]; },
    isCredentialsSaved: async ({ server }) => ({ isSaved: !!store[server] }),
  };
}

// ---- 编译 secure-store + biometric 为 CJS（每次重新编译，使模块顶层 detect 按当前全局状态求值） ----
async function loadBundle() {
  const res = esbuild.buildSync({
    stdin: {
      contents: "export * as SS from './secure-store'; export * as Bio from './biometric';",
      resolveDir: path.join(__dirname, 'src'),
      loader: 'ts',
    },
    bundle: true, format: 'cjs', platform: 'node', target: 'es2020', write: false,
  });
  const m = new Module('bio-bundle');
  m.filename = path.join(__dirname, 'src', 'bio-bundle.js');
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(res.outputFiles[0].text, m.filename);
  return m.exports;
}

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

(async () => {
  // ============ 阶段一：原生环境（plugin 存在） ============
  console.log('— 阶段一：原生壳（生物锁可用）—');
  const pl = fakePlugin();
  global.Capacitor = { Plugins: { NativeBiometric: pl } };
  const mem = freshLS();
  const { SS, Bio } = await loadBundle();

  ok('biometric 自检 supported=true', Bio.isSupported() === true);

  await SS.setup('master-pass');
  ok('setup 后 isReady=true', SS.isReady() === true);
  ok('setup 登记生物锁：bioWrap 已落盘', mem.has('shinian.vault.bio.v1'));
  ok('setup 登记生物锁：bioKEK 已存入系统密钥库（假插件）', !!pl.store['com.shinian.app.vault']);
  ok('setup 后 biometric.isEnrolled()=true', Bio.isEnrolled() === true);

  // 写入数据
  const items = [{ title: '生日', date: '2026-12-25' }];
  await SS.set('shinian.items.v1', items);

  // 生物解锁
  SS.lock();
  ok('lock 后 isReady=false', SS.isReady() === false);
  await SS.unlockWithBiometric();
  ok('生物解锁后 isReady=true', SS.isReady() === true);
  ok('生物解锁后数据可读', JSON.stringify(SS.get('shinian.items.v1')) === JSON.stringify(items));

  // 主密码仍是主路径
  SS.lock();
  await SS.unlock('master-pass');
  ok('主密码解锁仍可用', SS.isReady() === true);
  ok('主密码解锁后数据一致', JSON.stringify(SS.get('shinian.items.v1')) === JSON.stringify(items));

  // 未启用时不应出现的状态：有 vault 但无 bioWrap 时 unlockWithBiometric 抛错（这里已启用，跳过）
  // 改密：新 DEK 重新封装生物锁
  await SS.changePassword('master-pass', 'new-pass');
  let oldFailed = false;
  try { await SS.unlock('master-pass'); } catch { oldFailed = true; }
  ok('改密后旧密码失效', oldFailed === true);
  ok('改密后 bioWrap 仍在（重封装）', mem.has('shinian.vault.bio.v1'));

  SS.lock();
  await SS.unlockWithBiometric(); // 用新 DEK 的生物封装
  ok('改密后生物锁仍可用', SS.isReady() === true);
  ok('改密后生物解锁数据一致', JSON.stringify(SS.get('shinian.items.v1')) === JSON.stringify(items));

  // ============ 阶段二：Web / file:// 降级（无 Capacitor 插件） ============
  console.log('— 阶段二：Web 降级（无原生壳）—');
  delete global.Capacitor;
  const mem2 = freshLS();
  const b2 = await loadBundle();
  ok('Web 下 biometric.isSupported()=false', b2.Bio.isSupported() === false);
  ok('Web 下 biometric.isEnrolled()=false', b2.Bio.isEnrolled() === false);

  await b2.SS.setup('web-pass');
  ok('Web 下 setup 不创建 bioWrap（仅主密码）', !mem2.has('shinian.vault.bio.v1'));
  await b2.SS.set('shinian.items.v1', items);
  b2.SS.lock();
  await b2.SS.unlock('web-pass');
  ok('Web 下主密码解锁正常', b2.SS.isReady() === true);

  // 未启用生物锁 → unlockWithBiometric 必须抛错（引导改用主密码）
  let bioThrew = false;
  try { await b2.SS.unlockWithBiometric(); } catch { bioThrew = true; }
  ok('Web 下 unlockWithBiometric 抛错（无生物锁）', bioThrew === true);

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  if (fail > 0) process.exit(1);
})();
