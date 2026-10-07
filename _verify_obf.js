/**
 * B3 验证：把混淆后的 www/ 产物丢进 jsdom 真实执行，
 * 确认「混淆不破坏运行」——全局接口齐全、无致命加载错误、核心 API 可调用。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = process.cwd();
const www = path.join(root, 'www');
const bundle = fs.readFileSync(path.join(www, 'assets', 'bundle.min.js'), 'utf8');
const core = fs.readFileSync(path.join(www, 'assets', 'shinian-core.min.js'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = `<!DOCTYPE html><html><head></head><body>
<script>${core}</script>
<script>${bundle}</script>
<script>
  window.__OK = {
    core: !!window.ShiNianCore,
    crypto: !!(window.ShiNianCore && window.ShiNianCore.crypto),
    antiTamper: !!(window.ShiNianCore && window.ShiNianCore.antiTamper),
    detect: !!(window.ShiNianCore && window.ShiNianCore.antiTamper && typeof window.ShiNianCore.antiTamper.detectThreats === 'function'),
    lunar: !!window.Lunar,
    cities: Array.isArray(window.SHINIAN_CITIES),
    suncalc: !!window.SunCalc,
  };
  try {
    var r = window.ShiNianCore.antiTamper.detectThreats();
    window.__REPORT = { score: r.score, threats: r.threats };
  } catch (e) { window.__REPORT_ERR = String(e); }
</script>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc });
const w = dom.window;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }

const ok0 = w.__OK || {};
ok('window.ShiNianCore 已挂载', ok0.core);
ok('ShiNianCore.crypto 存在', ok0.crypto);
ok('ShiNianCore.antiTamper 存在', ok0.antiTamper);
ok('antiTamper.detectThreats 可调用', ok0.detect);
ok('遗留全局 Lunar 保留', ok0.lunar);
ok('遗留全局 SHINIAN_CITIES 保留', ok0.cities);
ok('遗留全局 SunCalc 保留', ok0.suncalc);
ok('detectThreats 执行无异常', !w.__REPORT_ERR);
ok('混淆后无致命加载错误', errors.length === 0);

if (w.__REPORT) console.log('  antiTamper 报告:', JSON.stringify(w.__REPORT));
if (errors.length) { console.log('  捕获错误:'); errors.slice(0, 5).forEach((e) => console.log('   -', e)); }
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
