// v0.5.9 许愿池测试：渲染 / 许下 / 打勾沉底 / 删除 / 清空已完成 / 折叠记住 / 存储
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓', label, extra !== undefined ? '=> ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra !== undefined ? '=> ' + extra : ''); }
}

const html = fs.readFileSync('index.html', 'utf8');
const appSrc = fs.readFileSync('assets/app.js', 'utf8');

// 按 index.html 的真实顺序加载全部脚本（否则 initCityPicker 等会失败）
const SCRIPTS = ['assets/lunar.js', 'assets/season.js', 'assets/sky.js', 'assets/weather.js', 'assets/cities.js',
                 'assets/notifications.js', 'assets/decor.js', 'assets/app.js'];

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

let w = boot();
const doc = w.document;
const $ = id => doc.getElementById(id);

console.log('== 1. 模块渲染与默认折叠 ==');
ok('许愿池 section 存在', !!doc.querySelector('section.wishes'));
ok('有折叠摘要按钮', !!$('wishSummary'));
ok('默认折叠（body 隐藏）', $('wishBody').hidden === true);
ok('摘要显示计数', /已许下/.test($('wishSummary').textContent), $('wishSummary').textContent.trim().slice(0, 30));
ok('空态提示可见', $('wishEmpty').hidden === false);

console.log('== 2. 许下一个心愿 ==');
$('wishText').value = '明天想去吃蛋糕';
$('wishForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
let list = JSON.parse(w.localStorage.getItem('shinian.wishes.v1') || '[]');
ok('已写入 localStorage', list.length === 1, 'count=' + list.length);
ok('文本正确', list[0] && list[0].text === '明天想去吃蛋糕');
ok('默认未完成', list[0] && list[0].done === false);
ok('列表渲染出条目', $('wishList').children.length === 1);
ok('许愿后自动展开', $('wishBody').hidden === false);
ok('空态已隐藏', $('wishEmpty').hidden === true);
ok('输入框已清空', $('wishText').value === '');

console.log('== 3. 计数更新 ==');
ok('总数 = 1', $('wishTotal').textContent === '1', $('wishTotal').textContent);
ok('完成数 = 0', $('wishDone').textContent === '0');

console.log('== 4. 打勾 → 完成并沉底 ==');
// 再许两个，便于验证沉底
$('wishText').value = '想去海边';
$('wishForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
$('wishText').value = '读一本书';
$('wishForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
ok('共 3 条', $('wishList').children.length === 3);

// 勾选第一条（吃蛋糕）
const firstCheck = $('wishList').children[0].querySelector('.wish-check');
firstCheck.dispatchEvent(new w.Event('click', { bubbles: true }));
list = JSON.parse(w.localStorage.getItem('shinian.wishes.v1'));
const doneOne = list.filter(x => x.done);
ok('已完成 1 条', doneOne.length === 1, 'done=' + doneOne.length);
ok('已完成的会记录 doneAt', !!(doneOne[0] && doneOne[0].doneAt));
ok('完成计数更新', $('wishDone').textContent === '1');
// 沉底验证：列表第一项不应是已完成的
const firstText = $('wishList').children[0].querySelector('.wish-text').textContent;
ok('未完成排在最前（已沉底）', firstText !== '明天想去吃蛋糕', 'first=' + firstText);
const lastIsDone = $('wishList').children[2].className.indexOf('is-done') >= 0;
ok('已完成的排在最后', lastIsDone);

console.log('== 5. 清空已完成 ==');
ok('清空按钮已显示', $('wishClearDone').hidden === false);
$('wishClearDone').dispatchEvent(new w.Event('click', { bubbles: true }));
list = JSON.parse(w.localStorage.getItem('shinian.wishes.v1'));
ok('已完成被清除', list.filter(x => x.done).length === 0, 'remain=' + list.length);
ok('未完成保留', list.length === 2);
ok('清空按钮重新隐藏', $('wishClearDone').hidden === true);

console.log('== 6. 删除单条 ==');
const before = JSON.parse(w.localStorage.getItem('shinian.wishes.v1')).length;
$('wishList').children[0].querySelector('.wish-del').dispatchEvent(new w.Event('click', { bubbles: true }));
const after = JSON.parse(w.localStorage.getItem('shinian.wishes.v1')).length;
ok('删除后减少 1 条', after === before - 1, before + ' -> ' + after);

console.log('== 7. 折叠状态被记住 ==');
let st = JSON.parse(w.localStorage.getItem('shinian.settings.v1') || '{}');
ok('许愿后折叠状态记为展开', st.wishCollapsed === false, 'wishCollapsed=' + st.wishCollapsed);
$('wishSummary').dispatchEvent(new w.Event('click', { bubbles: true }));
ok('点击后收起', $('wishBody').hidden === true);
st = JSON.parse(w.localStorage.getItem('shinian.settings.v1') || '{}');
ok('收起状态已保存', st.wishCollapsed === true);

console.log('== 8. 数据层独立存储（与念想分开） ==');
ok('心愿 key 独立', w.localStorage.getItem('shinian.wishes.v1') !== null);
ok('不影响念想 key', w.localStorage.getItem('shinian.items.v1') !== undefined);

console.log('\n结果:', pass, '通过 /', fail, '失败');
process.exit(fail ? 1 : 0);
