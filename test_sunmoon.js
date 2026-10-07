// v0.7.0 日月引擎测试：验证 sunmoon.js + vendored SunCalc
//   A) SunCalc 真实天文：日出方位在东、日落在西、正午最高
//   B) 月相值域（phase 0~1、fraction 0~1）
//   C) 可见性与黄金时刻 / 火烧云强度
//   D) 屏幕映射（东→画面左、西→画面右、天顶→顶部）
//   E) draw 不抛错（mock ctx，含 ellipse 月相路径）
//   F) 无 SunCalc 时兜底路径可用（real=false）
// 依赖 jsdom。
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓', label, extra !== undefined ? '=> ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra !== undefined ? '=> ' + extra : ''); }
}
function mockCtx() {
  return {
    globalAlpha: 1, fillStyle: '',
    save() {}, restore() {}, beginPath() {}, arc() {}, fill() {},
    ellipse() {}, closePath() {}, fillRect() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
}

const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.SunCalc = require('./assets/suncalc.js');   // 模拟浏览器全局（vendored UMD 在 Node 下走 module.exports）
w.eval(fs.readFileSync('assets/sunmoon.js', 'utf8'));
const SM = w.ShiNianSunMoon;
SM.setCity(39.9042, 116.4074);   // 北京

console.log('== A. 太阳轨迹（东升西落，SunCalc 真实值）==');
const now = new Date();
const times = w.SunCalc.getTimes(now, 39.9042, 116.4074);
const stRise = SM._compute(times.sunrise);
const stNoon = SM._compute(times.solarNoon);
const stSet = SM._compute(times.sunset);
ok(' Sunrise 数据为真实值', stRise.sun.real === true);
ok(' 正午高度角显著高于日出/日落',
   stNoon.sun.altitudeDeg > stRise.sun.altitudeDeg + 20 && stNoon.sun.altitudeDeg > stSet.sun.altitudeDeg + 20,
   stRise.sun.altitudeDeg.toFixed(1) + '° / ' + stNoon.sun.altitudeDeg.toFixed(1) + '° / ' + stSet.sun.altitudeDeg.toFixed(1) + '°');
// SunCalc 方位角约定：0=南、西为正 → 日出为负(东)、日落为正(西)
ok(' 日出在东（方位角为负）', stRise.sun.azimuthDeg < 0, stRise.sun.azimuthDeg.toFixed(1) + '°');
ok(' 日落在西（方位角为正）', stSet.sun.azimuthDeg > 0, stSet.sun.azimuthDeg.toFixed(1) + '°');
ok(' 正午高度角合理（北京 < 90°）', stNoon.sun.altitudeDeg > 10 && stNoon.sun.altitudeDeg < 90,
   stNoon.sun.altitudeDeg.toFixed(1) + '°');

console.log('== B. 月相值域 ==');
const st = SM._compute(now);
ok(' phase ∈ [0,1)', st.moon.phase >= 0 && st.moon.phase < 1, st.moon.phase.toFixed(3));
ok(' fraction ∈ [0,1]', st.moon.fraction >= 0 && st.moon.fraction <= 1, st.moon.fraction.toFixed(2));
ok(' waxing 为布尔', typeof st.moon.waxing === 'boolean', String(st.moon.waxing));

console.log('== C. 可见性 / 黄金时刻 / 火烧云 ==');
ok(' sunVisible 为布尔', typeof st.sunVisible === 'boolean');
ok(' moonVisible 为布尔', typeof st.moonVisible === 'boolean');
ok(' 深夜 fire=0', SM._compute(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 30)).fire === 0);
const fireSunset = stSet.fire;
ok(' 日落时 fire>0.3（火烧云窗口）', fireSunset > 0.3, fireSunset.toFixed(3));
ok(' 日落时 golden=true', stSet.golden === true);
ok(' 正午 golden=false', stNoon.golden === false);

console.log('== D. 屏幕映射（东→左、西→右、天顶→顶）==');
const scrE = SM.toScreen(0, -90, 1000, 600);   // 东地平线
const scrW = SM.toScreen(0, 90, 1000, 600);    // 西地平线
const scrT = SM.toScreen(90, 0, 1000, 600);    // 天顶
ok(' 东在画面左半', scrE.x < 500, 'x=' + scrE.x.toFixed(0));
ok(' 西在画面右半', scrW.x > 500, 'x=' + scrW.x.toFixed(0));
ok(' 天顶在画面上部', scrT.y < 100, 'y=' + scrT.y.toFixed(0));
ok(' 地平线在画面下部', scrE.y > 400, 'y=' + scrE.y.toFixed(0));

console.log('== E. draw 不抛错 ==');
let drew = true;
try { SM.draw(mockCtx(), 1000, 600); } catch (e) { drew = false; console.log('  [draw]', e.message); }
ok(' draw(ctx, w, h) 不抛错', drew);

console.log('== F. 兜底路径（无 SunCalc）==');
const saved = w.SunCalc;
w.SunCalc = undefined;
let fbOk = true, fb = null;
try { fb = SM._compute(new Date()); } catch (e) { fbOk = false; console.log('  [fallback]', e.message); }
ok(' 无 SunCalc 时 compute 不抛错', fbOk);
ok(' 兜底标记 real=false', fb && fb.sun.real === false);
ok(' 兜底月相仍在值域', fb && fb.moon.phase >= 0 && fb.moon.phase < 1, fb ? fb.moon.phase.toFixed(3) : '');
let drewFb = true;
try { SM.draw(mockCtx(), 1000, 600); } catch (e) { drewFb = false; console.log('  [fbdraw]', e.message); }
ok(' 兜底 draw 不抛错', drewFb);
w.SunCalc = saved;

console.log('\n结果:', pass, '通过 /', fail, '失败');
process.exit(fail ? 1 : 0);
