// v0.7.3 流星自定义间隔测试：验证 decor.js 的 meteorCfg / gapFor / ambientAllowed
//   A) 默认（未设置）→ 真实节奏 40–90 秒
//   B) 自定义 30 秒 → 以 30s 为中心 ±30%（21–39 秒）
//   C) 自定义边界钳制（<5 取 5、>300 取 300）
//   D) 关闭流星 → ambientAllowed 为 false
//   E) 首颗提前（8–15 秒），保证「必遇一次」
//   F) 夜间才允许（白天 ambientAllowed 为 false）
// 依赖 jsdom。
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓', label, extra !== undefined ? '=> ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra !== undefined ? '=> ' + extra : ''); }
}

// 构建 decor 环境：指定时刻（?t=）+ 可选 data-meteor / data-meteor-gap
function build(hour, meteor, gap) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x.test/?t=' + hour, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  // decor.js 的 hours() 读系统真实时间（不读 ?t=），故注入固定时刻的 Date 以便断言昼夜
  const RealDate = w.Date;
  const h = parseFloat(hour);
  w.Date = function () {
    const base = new RealDate();
    return {
      getHours: function () { return Math.floor(h); },
      getMinutes: function () { return Math.round((h % 1) * 60); },
      getSeconds: function () { return 0; },
      getTime: function () { return base.getTime(); },
      getFullYear: function () { return base.getFullYear(); },
      getMonth: function () { return base.getMonth(); },
      getDate: function () { return base.getDate(); }
    };
  };
  // jsdom 无 canvas：getContext 返回 null，decor 会优雅降级；不影响纯函数断言
  w.eval(fs.readFileSync('decor.js', 'utf8'));
  if (meteor) w.document.documentElement.setAttribute('data-meteor', meteor);
  if (gap !== undefined) w.document.documentElement.setAttribute('data-meteor-gap', String(gap));
  return w.ShiNianDecor;
}

console.log('== A. 默认 → 真实节奏 ==');
let d = build('22:00');
let cfg = d._test.meteorCfg();
ok(' 默认开启', cfg.on === true);
ok(' 真实间隔 40–90 秒', cfg.gapMin === 40000 && cfg.gapMax === 90000,
   (cfg.gapMin / 1000) + '–' + (cfg.gapMax / 1000) + 's');

console.log('== B. 自定义间隔（以设定值 ±30% 抖动）==');
d = build('22:00', 'custom', 30);
cfg = d._test.meteorCfg();
ok(' 30 秒 → 21–39 秒区间', Math.round(cfg.gapMin) === 21000 && Math.round(cfg.gapMax) === 39000,
   (cfg.gapMin / 1000).toFixed(1) + '–' + (cfg.gapMax / 1000).toFixed(1) + 's');
ok(' 中心值约为设定值', Math.abs((cfg.gapMin + cfg.gapMax) / 2 - 30000) < 1, '中心 ' + ((cfg.gapMin + cfg.gapMax) / 2 / 1000) + 's');
d = build('22:00', 'custom', 12);
cfg = d._test.meteorCfg();
ok(' 12 秒 → 8.4–15.6 秒', Math.round(cfg.gapMin) === 8400 && Math.round(cfg.gapMax) === 15600,
   (cfg.gapMin / 1000).toFixed(1) + '–' + (cfg.gapMax / 1000).toFixed(1) + 's');

console.log('== C. 边界钳制 ==');
d = build('22:00', 'custom', 1);
ok(' 过小(<5) 钳制为 5 秒', d._test.meteorCfg().gapMin === 3500, (d._test.meteorCfg().gapMin / 1000) + 's');
d = build('22:00', 'custom', 9999);
ok(' 过大(>300) 钳制为 300 秒', d._test.meteorCfg().gapMax === 390000, (d._test.meteorCfg().gapMax / 1000) + 's');

console.log('== D. 关闭流星 ==');
d = build('22:00', 'off');
ok(' data-meteor=off → 关闭', d._test.meteorCfg().on === false);
ok(' 关闭后夜间也不允许常驻流星', d._test.ambientAllowed() === false);

console.log('== E. 首颗提前（进入夜间必遇一次）==');
d = build('22:00', 'real');
const g1 = d._test.gapFor(d._test.meteor);
ok(' 首颗间隔 8–15 秒', g1[0] === 8000 && g1[1] === 15000, (g1[0] / 1000) + '–' + (g1[1] / 1000) + 's');
ok(' 首颗未出时标记未完成', d._test.isMeteorFirstDone() === false);

console.log('== F. 仅夜间 ==');
d = build('13:00', 'real');
ok(' 白天（13:00）不允许流星', d._test.ambientAllowed() === false);
d = build('23:00', 'real');
ok(' 夜间（23:00）允许流星', d._test.ambientAllowed() === true);

console.log('\n结果:', pass, '通过 /', fail, '失败');
process.exit(fail ? 1 : 0);
