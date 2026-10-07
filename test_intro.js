// v0.6.4 开场动画测试：验证 intro.js 星场/流星引擎
//   段一（集成冒烟）：完整加载 index.html + 全部脚本，确认 boot 含 initSplash 接入 intro 不抛错
//   段二（隔离行为）：仅加载 intro.js 的最小 jsdom，验证
//     A) 绘制路径不抛错（亮星辉光 + 渐变拖尾流星）
//     B) 减弱动态：onDone 快速回调（静态呈现）
//     C) 非减弱：onDone 在 ~2.7s 触发（兜底计时内）
//     D) 降级守卫：canvas 无 2D 上下文时仍回调 onDone，绝不卡死
// 依赖 jsdom（已在 devDependencies）。
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓', label, extra !== undefined ? '=> ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra !== undefined ? '=> ' + extra : ''); }
}

function mockCtx() {
  return {
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
    globalCompositeOperation: 'source-over', setTransform() {}, clearRect() {}, save() {},
    restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, moveTo() {},
    lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, fill() {}, stroke() {},
    fillRect() {}, clip() {}, createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}

// 完整页面加载（集成冒烟）：验证 app.js 的 initSplash 接入 intro.js 不抛错
function bootFull() {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () { return mockCtx(); };
  const SCRIPTS = ['lunar.js', 'season.js', 'sky.js', 'weather.js', 'cities.js',
                   'notifications.js', 'decor.js', 'assets/clouds.js', 'intro.js', 'app.js'];
  let crashed = null;
  SCRIPTS.forEach(function (f) {
    try { w.eval(fs.readFileSync(f, 'utf8')); }
    catch (e) { crashed = f + ': ' + e.message; }
  });
  return { w: w, crashed: crashed };
}

// 仅加载 intro.js 的最小 jsdom（隔离行为测试，避开 app 自动启动与多 rAF 循环干扰）
function bootIntroOnly() {
  const dom = new JSDOM('<!DOCTYPE html><body><canvas id="splashCanvas"></canvas></body>',
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () { return mockCtx(); };
  try { w.eval(fs.readFileSync('intro.js', 'utf8')); } catch (e) { console.log('  [intro eval]', e.message); }
  return w;
}

(async function () {
  console.log('== 段一 · 集成冒烟（完整页面含 intro 接入不抛错）==');
  const full = bootFull();
  ok('全部脚本加载无异常', full.crashed === null, full.crashed || 'OK');
  ok('window.ShiNianIntro 已暴露', !!full.w.ShiNianIntro);

  console.log('== 段二 · 隔离行为 ==');
  console.log('== A. 绘制不抛错（星+流星）==');
  const w = bootIntroOnly();
  const I = w.ShiNianIntro;
  let drew = true;
  try {
    I._w = 360; I._h = 640; I._t0 = 0; I._ctx = mockCtx();
    I._stars = [{ x: 5, y: 5, r: 1.8, glow: true, ph: 0, sp: 1 }];
    I._meteors = [{ sx: 10, sy: 10, vx: 0.9, vy: 0.4, travel: 300, len: 160, t0: -100, dur: 1000 }];
    I._reduce = false;
    I._frame();
  } catch (e) { drew = false; console.log('  [绘制异常]', e.message); }
  ok('绘制一帧（星+流星）不抛错', drew);

  console.log('== B. 减弱动态：onDone 快速回调 ==');
  await new Promise(function (resolve) {
    const I2 = bootIntroOnly().ShiNianIntro;
    const canvas = I2._canvas || (function () { return { getContext: function () { return mockCtx(); }, clientWidth: 360, clientHeight: 640 }; })();
    let done = false;
    try { I2.start(canvas, { reduce: true, onDone: function () { done = true; } }); }
    catch (e) { console.log('  [start reduce]', e.message); }
    w.setTimeout(function () {
      ok('减弱动态 onDone 触发', done);
      I2.stop();
      resolve();
    }, 450);
  });

  console.log('== C. 非减弱：onDone 在兜底计时内触发 ==');
  await new Promise(function (resolve) {
    const I3 = bootIntroOnly().ShiNianIntro;
    const canvas = { getContext: function () { return mockCtx(); }, clientWidth: 360, clientHeight: 640 };
    let done = false;
    try { I3.start(canvas, { reduce: false, onDone: function () { done = true; } }); }
    catch (e) { console.log('  [start normal]', e.message); }
    w.setTimeout(function () {
      ok('非减弱 onDone 在 ~2.7s 触发', done);
      I3.stop();
      resolve();
    }, 3000);
  });

  console.log('== D. 降级守卫：无 2D 上下文仍回调 onDone ==');
  await new Promise(function (resolve) {
    const I4 = bootIntroOnly().ShiNianIntro;
    const fakeCanvas = { getContext: function () { return null; }, clientWidth: 360, clientHeight: 640 };
    let done = false;
    try { I4.start(fakeCanvas, { reduce: false, onDone: function () { done = true; } }); }
    catch (e) { console.log('  [start nullctx]', e.message); }
    w.setTimeout(function () {
      ok('无 2D 上下文仍回调 onDone（不卡死）', done);
      resolve();
    }, 350);
  });

  console.log('\n结果:', pass, '通过 /', fail, '失败');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error('测试异常：', e && e.message);
  process.exit(1);
});
