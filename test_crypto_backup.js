// 加密备份：encryptWithPassword / decryptWithPassword 单元测试
// 用 esbuild 把 src/crypto-vault.ts 编译为 CJS 加载（与 test_crypto.js 同模式）。
const esbuild = require('esbuild');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = path.join(os.tmpdir(), 'shinian-crypto-backup-' + Date.now() + '.cjs');
esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, 'src/crypto-vault.ts')],
  bundle: true, format: 'cjs', platform: 'node', outfile: tmp,
});
const CV = require(tmp);

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

async function main() {
  const payload = JSON.stringify({ app: 'shinian', schema: 2, items: [{ id: '1', name: '测试念想', date: '2026-10-08' }], wishes: [] });
  const pwd = 'correct horse battery staple';

  const env = await CV.encryptWithPassword(payload, pwd);
  ok('返回 BackupEnvelope', env && env.kind === 'shinian-backup');
  ok('含 salt/iv/ct 字段', !!env.salt && !!env.iv && !!env.ct);
  ok('迭代数 = 210000（OWASP 量级）', env.iterations === 210000);

  const back = await CV.decryptWithPassword(env, pwd);
  ok('解密还原原文', back === payload);

  let wrong = false;
  try { await CV.decryptWithPassword(env, 'wrong-password'); } catch (e) { wrong = true; }
  ok('错误密码解密抛错', wrong);

  const env2 = await CV.encryptWithPassword(payload, pwd);
  ok('同明文两次密文不同（随机 salt/iv）', env.ct !== env2.ct);

  let badKind = false;
  try { await CV.decryptWithPassword({ kind: 'x' }, pwd); } catch (e) { badKind = true; }
  ok('非备份信封抛错', badKind);

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  try { fs.unlinkSync(tmp); } catch (e) {}
  process.exit(fail ? 1 : 0);
}
main().catch(function (e) { console.error(e); try { fs.unlinkSync(tmp); } catch (_) {} process.exit(1); });
