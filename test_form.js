// v0.7.6 倒计时表单校验测试：initForm 必须对 date 做 isValidDate 校验（修复 B，防止 NaN 入库）
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓', label, extra !== undefined ? '=> ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra !== undefined ? '=> ' + extra : ''); }
}

const html = fs.readFileSync('index.html', 'utf8');
const SCRIPTS = ['lunar.js', 'season.js', 'sky.js', 'weather.js', 'cities.js',
                 'notifications.js', 'decor.js', 'app.js'];

function boot() {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only', url: 'https://example.com/', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.confirm = () => true;              // 删除/清空的二次确认一律同意
  w.alert = () => {};
  if (!w.fetch) w.fetch = () => Promise.reject(new Error('offline'));
  // canvas 桩（decor.js 需要）
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
      globalCompositeOperation: 'source-over',
      setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {},
      rotate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {},
      quadraticCurveTo() {}, closePath() {}, arc() {}, fill() {}, stroke() {},
      createLinearGradient() { return { addColorStop() {} }; },
    };
  };
  SCRIPTS.forEach(function (f) {
    try { w.eval(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.log('  [eval 异常 ' + f + ']', e.message); }
  });
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}

const w = boot();
const doc = w.document;
const $ = id => doc.getElementById(id);
const KEY = 'shinian.items.v1';
function countItems() {
  try { return JSON.parse(w.localStorage.getItem(KEY) || '[]').length; }
  catch (e) { return -1; }
}

console.log('== A. 非法日期不应入库（防 dayDiff=NaN）==');
ok('初始无条目', countItems() === 0, 'count=' + countItems());

$('cdName').value = '测试念想';
$('cdDate').value = '';                 // 空日期 = 非法
$('cdForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
ok('空日期提交后无新增条目', countItems() === 0, 'count=' + countItems());

$('cdDate').value = '2026-13-40';       // 格式对但日历不存在（2 月没有 40 号）
$('cdForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
ok('非法日历日期提交后无新增条目', countItems() === 0, 'count=' + countItems());

console.log('== B. 合法日期正常入库 ==');
const good = new Date();
const ds = good.getFullYear() + '-' +
  String(good.getMonth() + 1).padStart(2, '0') + '-' +
  String(good.getDate()).padStart(2, '0');
$('cdName').value = '生日';
$('cdDate').value = ds;
$('cdForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
ok('合法日期提交后新增 1 条', countItems() === 1, 'count=' + countItems());
const saved = JSON.parse(w.localStorage.getItem(KEY) || '[]');
ok('入库日期与输入一致', saved[0] && saved[0].date === ds, saved[0] && saved[0].date);
ok('入库名称正确', saved[0] && saved[0].name === '生日', saved[0] && saved[0].name);

console.log('== C. 合法日期次日再次提交累加 ==');
$('cdName').value = '另一个日子';
$('cdDate').value = ds;
$('cdForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
ok('第二条合法日期提交后累计 2 条', countItems() === 2, 'count=' + countItems());

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
// decor.js 启动时会挂一个持久 setInterval（tickAmbient），导致 Node 事件循环不空、进程不会自然退出；
// 必须显式退出，否则 npm test 链路会在最后一个用例后挂起（CI 亦会卡死）。
process.exit(fail > 0 ? 1 : 0);
