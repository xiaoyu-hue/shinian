// v0.6.3 自动刷新测试：覆盖 v0.6.2 引入的「温度自动刷新」核心逻辑
//   A) P0 回归：自动刷新失败（返回 null）时不得清空上次有效温度
//   B) 成功路径：拿到新数据后温度正确更新
//   C) 间隔可配置：关闭(0)时不启动定时器；?wrf=秒数 调试钩子可覆盖间隔
// 依赖 jsdom（已在 devDependencies）。用 mock 的 ShiNianWeather 与最小 DOM 驱动 app.js 内部逻辑。
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓', label, extra !== undefined ? '=> ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra !== undefined ? '=> ' + extra : ''); }
}

// 加载完整 index.html + 全部脚本（顺序与真实页面一致），返回带测试钩子的 window
function boot(query) {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://example.com/' + (query || ''),
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.confirm = () => true;
  w.alert = () => {};
  if (!w.fetch) w.fetch = () => Promise.reject(new Error('offline'));
  // canvas 桩（decor.js / intro.js / clouds.js 共用，覆盖完整绘制 API）
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
      globalCompositeOperation: 'source-over', setTransform() {}, clearRect() {}, save() {},
      restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, moveTo() {},
      lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, fill() {}, stroke() {},
      fillRect() {}, clip() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
    };
  };
  const SCRIPTS = ['assets/lunar.js', 'assets/season.js', 'assets/sky.js', 'assets/weather.js', 'assets/cities.js',
                   'assets/notifications.js', 'assets/decor.js', 'assets/clouds.js', 'assets/intro.js', 'assets/app.js'];
  SCRIPTS.forEach(function (f) {
    try { w.eval(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.log('  [eval 异常 ' + f + ']', e.message); }
  });
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}

// app.js 已暴露 window.ShiNianApp 供单测访问内部函数
(async function () {
  console.log('== A. 失败不清空温度（P0 回归）==');
  const w = boot();
  const doc = w.document;
  const App = w.ShiNianApp;
  ok('ShiNianApp 测试钩子已暴露', !!App);

  // 先显示一次有效温度
  App.updateWeatherDisplay({ weatherCode: 0, temperature: 20, isDay: 1 });
  ok('初始温度显示 20°', doc.getElementById('weatherTemp').textContent === '20°',
     doc.getElementById('weatherTemp').textContent);

  // 模拟自动刷新失败（超时/网络错 → refresh 返回 null）
  let refreshCalls = 0;
  w.ShiNianWeather.refresh = function () { refreshCalls++; return Promise.resolve(null); };
  App.autoRefreshWeather();
  await new Promise(function (r) { setTimeout(r, 60); });   // 等 promise 结算
  ok('自动刷新被调用', refreshCalls === 1, 'calls=' + refreshCalls);
  ok('失败后仍保留 20°（未清空）', doc.getElementById('weatherTemp').textContent === '20°',
     doc.getElementById('weatherTemp').textContent);

  console.log('== B. 成功更新温度 ==');
  w.ShiNianWeather.refresh = function () {
    return Promise.resolve({ weatherCode: 0, temperature: 25, isDay: 1 });
  };
  App.autoRefreshWeather();
  await new Promise(function (r) { setTimeout(r, 60); });
  ok('成功刷新后温度更新为 25°', doc.getElementById('weatherTemp').textContent === '25°',
     doc.getElementById('weatherTemp').textContent);

  console.log('== C. 间隔可配置 + ?wrf 钩子 ==');
  // 带 ?wrf=2 的 DOM（调试钩子把间隔覆盖为 2000ms）
  const w2 = boot('?wrf=2');
  const App2 = w2.ShiNianApp;
  let intervals = [];
  const realSI = w2.setInterval.bind(w2);
  w2.setInterval = function (fn, ms) { intervals.push(ms); return realSI(fn, ms); };
  App2.stopWeatherAutoRefresh();          // 停掉 boot 已启动的默认定时器
  intervals = [];                          // 只统计本次主动启动
  App2.setWeatherRefreshMin(10);           // 10 分钟（无 wrf 时应为 600000ms）
  App2.startWeatherAutoRefresh();
  ok('?wrf=2 覆盖间隔为 2000ms', intervals.indexOf(2000) >= 0, 'ms=' + intervals.join(','));

  intervals = [];
  App2.stopWeatherAutoRefresh();
  App2.setWeatherRefreshMin(0);            // 关闭
  App2.startWeatherAutoRefresh();
  ok('关闭(0)时不启动定时器', intervals.length === 0, 'started=' + intervals.length);

  console.log('\n结果:', pass, '通过 /', fail, '失败');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error('测试异常：', e && e.message);
  process.exit(1);
});
