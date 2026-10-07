/**
 * B1 · 本地数据加密保险库 单元测试
 * 运行：node test_crypto.js（npm test 链包含）
 * 说明：crypto-vault 为 TS 模块，测试时用 esbuild 即时编译为 CJS 再加载（与 app 运行态无关）。
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

(async () => {
  // 1) 即时编译 TS -> CJS
  const tsSrc = fs.readFileSync(path.join(__dirname, 'src', 'crypto-vault.ts'), 'utf8');
  const js = esbuild.transformSync(tsSrc, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
  const m = new Module('crypto-vault');
  m.filename = path.join(__dirname, 'src', 'crypto-vault.js');
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(js, m.filename);
  const V = m.exports;

  ok('模块导出齐全', V && typeof V.createVault === 'function' && typeof V.unlockVault === 'function'
    && typeof V.aesEncrypt === 'function' && typeof V.aesDecrypt === 'function');
  ok('PBKDF2 迭代量达 OWASP 量级(>=210000)', V.PBKDF2_ITERATIONS >= 210000);

  // 2) 创建保险库 + 加解密闭环
  const payload = JSON.stringify({ items: [{ title: '生日', date: '2026-12-25' }], n: 42 });
  const { envelope, dek } = await V.createVault('correct-horse');
  ok('信封结构合法', envelope && envelope.v === 1 && envelope.kdf === 'PBKDF2'
    && typeof envelope.salt === 'string' && envelope.encDek && envelope.encDek.ct);

  const blob = await V.aesEncrypt(dek, payload);
  const back = await V.aesDecrypt(dek, blob);
  ok('AES-GCM 加解密闭环一致', back === payload);
  ok('密文与明文不同（非明文落盘）', JSON.stringify(blob) !== payload);

  // 3) 用密码解锁还原 DEK
  const dek2 = await V.unlockVault('correct-horse', envelope);
  const back2 = await V.aesDecrypt(dek2, blob);
  ok('密码解锁还原 DEK 后可解密', back2 === payload);

  // 4) 错误密码解锁必须失败（GCM 认证失败 / 派生不同密钥）
  let threw = false;
  try { await V.unlockVault('wrong-password', envelope); } catch { threw = true; }
  ok('错误密码解锁失败（防暴力/防误开）', threw === true);

  // 5) 无密码无法从信封直接得 DEK（信封不含明文密钥）
  ok('信封不含明文 DEK', !('dek' in envelope) && !('kek' in envelope) && !('password' in envelope));

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });
