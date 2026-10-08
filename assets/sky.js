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
  // v1.1.3：物理天空色混合用到 clamp——此前 sky.js 没有此函数（只在 clouds.js 私有
  // 作用域里），bundle 打包后运行时 ReferenceError 会中断整条 bundle 执行链
  // （sky.js 之后的 sunmoon/clouds/intro/app 全部不加载，页面只剩默认夜空），必须定义在本文件。
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
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
    // 调试参数 ?t=HH:MM（v0.7.4：校验有效性，拒绝 ?t=25:99 / ?t=12:99 等非法时刻）
    var q = new URLSearchParams(location.search).get('t');
    if (q && /^\d{1,2}:\d{2}$/.test(q)) {
      var p = q.split(':');
      var hh = +p[0], mm = +p[1];
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) return hh + mm / 60;
    }
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  // v1.1.3 物理天空色（B 方案）：紧凑单次散射（Rayleigh + Mie）。
  // 数学参考 wwwtyro/glsl-atmosphere（Unlicense 公共领域，GitHub API 实测确认），
  // 移植为 CPU 采样版：对「天顶方向」与「地平线方向」各积分一次（16 步视线 × 8 步光深），
  // paint() 每分钟调用 2 次毫无压力。输出与艺术锚点做 30% 混合——物理负责「准」，
  // 手调锚点负责「好看」，两者互补而非替代（纯物理色在风格化场景会发灰）。
  var ATMOS = (function () {
    var Re = 6360e3, Ra = 6420e3, Hr = 7994, Hm = 1200;
    var Br = [5.8e-6, 13.5e-6, 33.1e-6], Bm = 21e-6, SUN_I = 22;
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
    function raySphereFar(orig, dir, radius) {
      // |orig + t·dir| = radius 的较大根（视线从地表射向大气层顶部）
      var b = 2 * (orig[0] * dir[0] + orig[1] * dir[1] + orig[2] * dir[2]);
      var c = orig[0] * orig[0] + orig[1] * orig[1] + orig[2] * orig[2] - radius * radius;
      var disc = b * b - 4 * c;
      if (disc < 0) return -1;
      return (-b + Math.sqrt(disc)) / 2;
    }
    function opticalDepth(orig, dir, sunDir) {
      // 沿太阳方向到大气顶的密度积分（8 步），分 Rayleigh / Mie 两份
      var tEnd = raySphereFar(orig, sunDir, Ra);
      if (tEnd < 0) return null;                       // 太阳方向被地球遮挡
      var odR = 0, odM = 0, seg = tEnd / 8;
      for (var i = 0; i < 8; i++) {
        var p = [orig[0] + dir[0] * seg * (i + 0.5),
                 orig[1] + dir[1] * seg * (i + 0.5),
                 orig[2] + dir[2] * seg * (i + 0.5)];
        var hgt = Math.hypot(p[0], p[1], p[2]) - Re;
        if (hgt < 0) return null;
        odR += Math.exp(-hgt / Hr) * seg;
        odM += Math.exp(-hgt / Hm) * seg;
      }
      return [odR, odM];
    }
    function scatter(sunDir, viewDir) {
      var orig = [0, Re + 2, 0];                       // 观察者：地表
      var tMax = raySphereFar(orig, viewDir, Ra);
      if (tMax <= 0) return null;
      var step = tMax / 16, odR = 0, odM = 0;
      var sum = [0, 0, 0], mu = viewDir[0] * sunDir[0] + viewDir[1] * sunDir[1] + viewDir[2] * sunDir[2];
      var phR = 3 / (16 * Math.PI) * (1 + mu * mu);    // Rayleigh 相位
      var g = 0.76, phM = 3 / (8 * Math.PI) * ((1 - g * g) * (1 + mu * mu)) /
                        ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5)); // Mie HG 相位
      for (var i = 0; i < 16; i++) {
        var p = [orig[0] + viewDir[0] * step * (i + 0.5),
                 orig[1] + viewDir[1] * step * (i + 0.5),
                 orig[2] + viewDir[2] * step * (i + 0.5)];
        var hgt = Math.hypot(p[0], p[1], p[2]) - Re;
        var dR = Math.exp(-hgt / Hr) * step, dM = Math.exp(-hgt / Hm) * step;
        odR += dR; odM += dM;
        var odSun = opticalDepth(p, sunDir, sunDir);   // 该点到太阳的光深
        if (!odSun) continue;                          // 阴影区（地球遮挡）
        for (var ch = 0; ch < 3; ch++) {
          var att = Math.exp(-(Br[ch] * (odR + odSun[0]) + Bm * (odM + odSun[1])));
          sum[ch] += (Br[ch] * phR + Bm * phM) * att * dR;
        }
      }
      return sum;
    }
    function tonemap(c) {
      // 线性 HDR → sRGB：简单 Reinhard 式压暗 + 伽马，曝光系数按正午天顶校准
      var out = [];
      for (var i = 0; i < 3; i++) {
        var v = 1 - Math.exp(-c[i] * SUN_I);
        v = Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2);
        out.push(Math.round(v * 255));
      }
      return out;
    }
    return {
      sky: function (sunAltDeg) {
        var alt = Math.max(-6, Math.min(90, sunAltDeg)) * Math.PI / 180;
        var sunDir = norm([0, Math.sin(alt), Math.cos(alt)]);
        var top = scatter(sunDir, norm([0, 1, 0.001]));
        var bottom = scatter(sunDir, norm([0, 0.30, 0.954]));
        if (!top || !bottom) return null;
        return { top: tonemap(top), bottom: tonemap(bottom) };
      }
    };
  })();

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

    // v1.1.3 物理天空色混合（B 方案）：以真实太阳高度角驱动 Rayleigh/Mie 单次散射，
    // 与艺术锚点 30% 融合——正午更透、黄昏更暖的物理正确色相微调；
    // 太阳 -6°（民用晨昏影）以下渐隐至 0，夜间完全交给艺术锚点。
    var sm = window.ShiNianSunMoon && window.ShiNianSunMoon.get();
    var sunAlt = sm ? sm.sun.altitudeDeg : clamp((h - 6) / 12, 0, 1) * 60;
    if (sunAlt > -6) {
      var phys = ATMOS.sky(sunAlt);
      if (phys) {
        var pk = 0.30 * clamp((sunAlt + 6) / 8, 0, 1);
        top = mix(top, phys.top, pk);
        bottom = mix(bottom, phys.bottom, pk);
      }
    }

    var glow = [
      Math.round(lerp(a.glow[0], b.glow[0], t)),
      Math.round(lerp(a.glow[1], b.glow[1], t)),
      Math.round(lerp(a.glow[2], b.glow[2], t)),
      +(lerp(a.glow[3], b.glow[3], t)).toFixed(3)
    ];
    var stars = +(lerp(a.stars, b.stars, t)).toFixed(3);

    // 眉题：取权重更大的锚点名
    var name = t < 0.5 ? a.name : b.name;

    // v0.5 季节层：对插值色做低强度季节染色（可选模块；缺失或 ?season=off 时原样返回）
    if (window.ShiNianSeason) {
      var sf = window.ShiNianSeason.filter(top, bottom, glow, new Date());
      top = sf.top; bottom = sf.bottom; glow = sf.glow;
      document.documentElement.setAttribute('data-season', sf.season);
    }

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
