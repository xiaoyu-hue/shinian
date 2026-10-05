/* ============================================================
   时念 · 天空引擎 v2（时刻层 + 天文驱动）
   ------------------------------------------------------------
   v2 升级：锚点从硬编码升级为真实日出日落驱动。
   无天气数据时回退 v1 硬编码锚点。

   调试：?t=HH:MM 模拟时刻，?lat=XX&lon=YY 指定坐标
   ============================================================ */

(function () {
  'use strict';

  // ---- 默认锚点（v1 硬编码，无天气时回退）----
  var DEFAULT_STOPS = [
    { h: 0.0,  name: '深夜', top: '#030d18', bottom: '#0a3050', glow: [109,161,212,.20], stars: 1 },
    { h: 4.8,  name: '深夜', top: '#0a1a2c', bottom: '#123a56', glow: [109,161,212,.22], stars: 1 },
    { h: 6.3,  name: '黎明', top: '#2a3c58', bottom: '#c98a5e', glow: [214,150,110,.30], stars: .1 },
    { h: 8.2,  name: '清晨', top: '#4c7fa8', bottom: '#c8dde9', glow: [255,244,214,.32], stars: 0 },
    { h: 12.5, name: '正午', top: '#4c86b8', bottom: '#bcd9ec', glow: [255,255,255,.28],  stars: 0 },
    { h: 16.0, name: '午后', top: '#4a7aa4', bottom: '#c4d7da', glow: [250,240,220,.26],  stars: 0 },
    { h: 18.4, name: '日落', top: '#35547a', bottom: '#e0855c', glow: [240,160,100,.32],  stars: 0 },
    { h: 19.8, name: '暮色', top: '#12253c', bottom: '#5c4266', glow: [140,110,190,.25],  stars: .45 },
    { h: 21.2, name: '夜',   top: '#04101c', bottom: '#0a3050', glow: [109,161,212,.20],  stars: 1 },
    { h: 24.0, name: '深夜', top: '#030d18', bottom: '#0a3050', glow: [109,161,212,.20],  stars: 1 }
  ];

  // 当前生效的锚点
  var STOPS = DEFAULT_STOPS;

  // ---- 动态锚点构建 ----
  // 以日出日落为中心，颜色模板不变，只调整 h 值
  function buildDynamicStops(sunriseH, sunsetH) {
    // 边界保护：日出不早于 3 点，日落不晚于 22 点
    var sr = Math.max(3.5, Math.min(sunriseH, 8.5));
    var ss = Math.max(15.5, Math.min(sunsetH, 22.0));
    var dawnH = Math.max(1.0, sr - 1.2);       // 黎明前 1.2 小时
    var mornH = sr + 0.8;                       // 日出后 0.8 小时
    var afterH = Math.min(ss - 2.5, 17.5);      // 日落前 2.5 小时
    var duskH = Math.min(ss + 1.2, 23.0);       // 日落后 1.2 小时
    var nightH = Math.min(ss + 2.5, 23.5);      // 日落后 2.5 小时

    return [
      { h: 0.0,   name: '深夜', top: '#030d18', bottom: '#0a3050', glow: [109,161,212,.20], stars: 1 },
      { h: dawnH, name: '深夜', top: '#0a1a2c', bottom: '#123a56', glow: [109,161,212,.22], stars: 1 },
      { h: sr,    name: '黎明', top: '#2a3c58', bottom: '#c98a5e', glow: [214,150,110,.30], stars: .1 },
      { h: mornH, name: '清晨', top: '#4c7fa8', bottom: '#c8dde9', glow: [255,244,214,.32], stars: 0 },
      { h: 12.5,  name: '正午', top: '#4c86b8', bottom: '#bcd9ec', glow: [255,255,255,.28],  stars: 0 },
      { h: afterH,name: '午后', top: '#4a7aa4', bottom: '#c4d7da', glow: [250,240,220,.26],  stars: 0 },
      { h: ss,    name: '日落', top: '#35547a', bottom: '#e0855c', glow: [240,160,100,.32],  stars: 0 },
      { h: duskH, name: '暮色', top: '#12253c', bottom: '#5c4266', glow: [140,110,190,.25],  stars: .45 },
      { h: nightH,name: '夜',   top: '#04101c', bottom: '#0a3050', glow: [109,161,212,.20],  stars: 1 },
      { h: 24.0,  name: '深夜', top: '#030d18', bottom: '#0a3050', glow: [109,161,212,.20],  stars: 1 }
    ];
  }

  // 从 ISO 时间字符串提取小时（含小数）
  function extractHour(isoStr) {
    if (!isoStr) return null;
    var m = isoStr.match(/T(\d{2}):(\d{2})/);
    if (!m) return null;
    return (+m[1]) + (+m[2]) / 60;
  }

  // 设置面板改了配方锁定：立刻重算
  window.addEventListener('recipeChange', function () { paint(); });

  // 监听城市/天气变更
  window.addEventListener('cityChange', function (e) {
    var w = e.detail && e.detail.weather;
    if (w && w.sunrise && w.sunset) {
      var sr = extractHour(w.sunrise);
      var ss = extractHour(w.sunset);
      if (sr !== null && ss !== null && sr < ss) {
        STOPS = buildDynamicStops(sr, ss);
        paint();
        return;
      }
    }
    // 无天气数据 → 回退默认
    STOPS = DEFAULT_STOPS;
    paint();
  });

  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    return [Math.round(lerp(c1[0], c2[0], t)),
            Math.round(lerp(c1[1], c2[1], t)),
            Math.round(lerp(c1[2], c2[2], t))];
  }
  function rgbStr(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  }
  function hexStr(c) {
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  // WCAG 标准相对亮度：sRGB → 线性光（伽马校正）后按人眼三色权重合成
  // 0 暗到 1 亮；阈值 0.19 按旧简化公式 0.42 等价换算校准（v0.3.1），
  // 各天空锚点在新旧公式下的亮/暗判定时机一致（误差 <2%）
  function lum(c) {
    function f(v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }

  function nowHours() {
    // 调试参数 ?t=HH:MM
    var q = new URLSearchParams(location.search).get('t');
    if (q && /^\d{1,2}:\d{2}$/.test(q)) {
      var p = q.split(':');
      return (+p[0]) + (+p[1]) / 60;
    }
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  function paint() {
    var h = nowHours();
    // 找到相邻锚点
    var a = STOPS[0], b = STOPS[STOPS.length - 1];
    for (var i = 0; i < STOPS.length - 1; i++) {
      if (h >= STOPS[i].h && h <= STOPS[i + 1].h) {
        a = STOPS[i]; b = STOPS[i + 1];
        break;
      }
    }
    var span = b.h - a.h;
    var t = span > 0 ? (h - a.h) / span : 0;

    var top = mix(hex2rgb(a.top), hex2rgb(b.top), t);
    var bottom = mix(hex2rgb(a.bottom), hex2rgb(b.bottom), t);
    var glow = [
      Math.round(lerp(a.glow[0], b.glow[0], t)),
      Math.round(lerp(a.glow[1], b.glow[1], t)),
      Math.round(lerp(a.glow[2], b.glow[2], t)),
      +(lerp(a.glow[3], b.glow[3], t)).toFixed(3)
    ];
    var stars = +(lerp(a.stars, b.stars, t)).toFixed(3);

    // 眉题：取权重更大的锚点名
    var name = t < 0.5 ? a.name : b.name;

    var root = document.documentElement.style;
    root.setProperty('--sky-top', rgbStr(top));
    root.setProperty('--sky-bottom', rgbStr(bottom));
    root.setProperty('--sky-glow', rgbStr(glow, glow[3]));
    root.setProperty('--stars-o', stars);
    root.setProperty('--phase-name', name);

    // 移动端状态栏颜色跟随天空（安卓 Chrome 顶部会变色，沉浸感更强）
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', hexStr(top));

    // 光晕随时刻缓慢位移：日出偏东、正午当头、日落偏西，夜里回到另一侧
    var orbA = document.querySelector('.orb-a');
    var orbB = document.querySelector('.orb-b');
    if (orbA) {
      var a1 = ((h - 6) / 24) * Math.PI * 2;
      orbA.style.setProperty('--orb-x', (Math.sin(a1) * 64).toFixed(1) + 'px');
      orbA.style.setProperty('--orb-y', (-Math.cos(a1) * 34).toFixed(1) + 'px');
    }
    if (orbB) {
      var a2 = ((h - 18) / 24) * Math.PI * 2;   // 与主光晕错开半天
      orbB.style.setProperty('--orb-x', (Math.sin(a2) * -52).toFixed(1) + 'px');
      orbB.style.setProperty('--orb-y', (-Math.cos(a2) * 28).toFixed(1) + 'px');
    }

    // 亮度联动玻璃配方（PRD 2.2/2.3：白天天空 → 亮配方深字）
    // 若用户在设置里手动锁定了配方，则锁定值优先
    var lock = document.documentElement.getAttribute('data-recipe-lock');
    var recipe = (lock === 'light' || lock === 'dark')
      ? lock
      : (lum(bottom) > 0.19 ? 'light' : 'dark');
    document.documentElement.setAttribute('data-recipe', recipe);
  }

  function initStars() {
    var box = document.getElementById('stars');
    if (!box) return;
    // 宽屏（平板 / 折叠展开）铺更多星星，避免夜空显得空旷
    var n = window.innerWidth >= 680 ? 90 : 44;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i');
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 62) + '%';
      s.style.animationDelay = (Math.random() * 3.2).toFixed(2) + 's';
      var size = Math.random() < .2 ? 2.5 : 1.5;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      box.appendChild(s);
    }
  }

  function boot() {
    initStars();
    paint();
    setInterval(paint, 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
