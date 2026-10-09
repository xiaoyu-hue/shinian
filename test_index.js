/**
 * P2 · src/index.ts 导出聚合一致性测试
 * 运行：node test_index.js（npm test 链包含）
 * 说明：用 esbuild 将 src/index.ts 及其各子模块打包为 CJS，断言
 *       window.ShiNianCore 暴露的子命名空间（crypto/secureStore/biometric/antiTamper）
 *       与对应源码模块的全部导出键集完全一致，杜绝“手工聚合漏函数导致功能静默失效”。
 */
const esbuild = require('esbuild');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

function loadBundle(entry) {
  const res = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
  });
  const code = res.outputFiles[0].text;
  const m = new Module(entry);
  m.filename = path.join(__dirname, entry.replace(/^src[\\/]/, '').replace(/\.ts$/, '.js'));
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(code, m.filename);
  return m.exports;
}

const SRC = path.join(__dirname, 'src');

// 1) 编译 index.ts 与各子模块
const Core = loadBundle(path.join(SRC, 'index.ts')).ShiNianCore;
const cryptoMod = loadBundle(path.join(SRC, 'crypto-vault.ts'));
const storeMod = loadBundle(path.join(SRC, 'secure-store.ts'));
const bioMod = loadBundle(path.join(SRC, 'biometric.ts'));
const atMod = loadBundle(path.join(SRC, 'anti-tamper.ts'));

ok('window.ShiNianCore 聚合对象存在', Core && typeof Core === 'object');

// 2) 各子命名空间与源码模块完整导出键集一致（排序后比较）
function keysEqual(actual, expected, label) {
  const a = Object.keys(actual).sort();
  const e = Object.keys(expected).sort();
  const same = a.length === e.length && a.every((k, i) => k === e[i]);
  ok(`${label} 键集 == 源码模块完整导出（${a.length} 项）`, same);
  if (!same) {
    const missing = e.filter((k) => !a.includes(k));
    const extra = a.filter((k) => !e.includes(k));
    if (missing.length) console.log('    聚合缺失:', missing.join(', '));
    if (extra.length) console.log('    聚合多余:', extra.join(', '));
  }
}

keysEqual(Core.crypto, cryptoMod, 'crypto');
keysEqual(Core.secureStore, storeMod, 'secureStore');
keysEqual(Core.biometric, bioMod, 'biometric');
keysEqual(Core.antiTamper, atMod, 'antiTamper');

// 3) app.js 的关键判据：加密备份函数必须存在（此前手工聚合仅挑 9 个、不含这两个）
ok('crypto.encryptWithPassword 存在（app.js 判据）', typeof Core.crypto.encryptWithPassword === 'function');
ok('crypto.decryptWithPassword 存在（app.js 判据）', typeof Core.crypto.decryptWithPassword === 'function');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
