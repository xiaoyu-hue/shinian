/**
 * A3 + B1 · 统一加密存储层 单元测试
 * 运行：node test_secure_store.js（npm test 链包含）
 * 说明：secure-store 为 TS 模块且依赖 crypto-vault，用 esbuild.buildSync bundle 为 CJS 再加载。
 */
const esbuild = require('esbuild');
const path = require('path');
const Module = require('module');

// Node 无 localStorage，mock 一个（Map 实现），供 secure-store 读写 envelope 与密文
const mem = new Map();
global.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

async function loadSS() {
  const res = esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'src', 'secure-store.ts')],
    bundle: true, format: 'cjs', platform: 'node', target: 'es2020', write: false,
  });
  const m = new Module('secure-store');
  m.filename = path.join(__dirname, 'src', 'secure-store.js');
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(res.outputFiles[0].text, m.filename);
  return m.exports;
}

(async () => {
  const SS = await loadSS();

  ok('模块导出齐全', SS && typeof SS.setup === 'function' && typeof SS.unlock === 'function'
    && typeof SS.get === 'function' && typeof SS.set === 'function'
    && typeof SS.lock === 'function' && typeof SS.SecureStore === 'object');
  ok('初始 needsSetup=true', SS.needsSetup() === true);
  ok('初始 isReady=false', SS.isReady() === false);

  // 首次设置主密码
  await SS.setup('master-pass');
  ok('setup 后 isReady=true', SS.isReady() === true);
  ok('setup 后 needsSetup=false', SS.needsSetup() === false);

  // 同步 set/get 闭环
  const items = [{ title: '生日', date: '2026-12-25' }, { title: '出发', date: '2027-01-01' }];
  await SS.set('shinian.items.v1', items);
  const got = SS.get('shinian.items.v1');
  ok('set/get 同步闭环一致', JSON.stringify(got) === JSON.stringify(items));
  ok('落盘非明文（__enc 键存在）', mem.has('shinian.items.v1__enc'));
  ok('落盘非明文（内容不是明文 JSON）', mem.get('shinian.items.v1__enc') !== JSON.stringify(items));

  // 上锁后拒绝读取
  SS.lock();
  ok('lock 后 isReady=false', SS.isReady() === false);
  ok('lock 后 get 返回 null（应用层需先解锁）', SS.get('shinian.items.v1') === null);

  // 重新解锁 → cache 预热
  await SS.unlock('master-pass');
  ok('unlock 后 isReady=true', SS.isReady() === true);
  ok('unlock 后 cache 重新预热、get 返回', JSON.stringify(SS.get('shinian.items.v1')) === JSON.stringify(items));

  // 错误密码解锁必须失败（防暴力 / 防误开）
  let threw = false;
  try { await SS.unlock('wrong-password'); } catch { threw = true; }
  ok('错误密码解锁失败', threw === true);

  // 改主密码：旧失效、新可用、数据仍在
  await SS.changePassword('master-pass', 'new-pass');
  let oldFailed = false;
  try { await SS.unlock('master-pass'); } catch { oldFailed = true; }
  ok('改密后旧密码失效', oldFailed === true);
  await SS.unlock('new-pass');
  ok('改密后新密码可用', SS.isReady() === true);
  ok('改密后数据仍在', JSON.stringify(SS.get('shinian.items.v1')) === JSON.stringify(items));

  // 多键并存
  await SS.set('shinian.settings.v1', { motion: true });
  await SS.set('shinian.wishes.v1', [{ id: 'w1', text: '吃蛋糕' }]);
  ok('多键互不影响（settings）', SS.get('shinian.settings.v1').motion === true);
  ok('多键互不影响（wishes）', SS.get('shinian.wishes.v1')[0].text === '吃蛋糕');

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  if (fail > 0) process.exit(1);
})();
