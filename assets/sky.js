/* ============================================================
   时念 · 天空引擎 v1（时刻层）
   ------------------------------------------------------------
   职责：根据当前时刻，把七个时段的色阶做分钟级插值，
   输出为一组 CSS 变量（:root 上），并按天空亮度切换玻璃配方。

   设计约定（与 PRD 2.1/2.3 对应）：
   1. 每个时段锚点 = 「天空顶色 / 天空底色 / 光晕 / 星星透明度」四件套；
   2. 插值只在相邻锚点间进行，任意时刻的颜色都在自然直觉内；
   3. 玻璃配方（dark/light）由插值后底色亮度决定，阈值 0.42；
   4. 更新频率 60 秒/次，重绘成本极低。

   调试：URL 加 ?t=HH:MM 可模拟任意时刻（仅本地调试用）。
   ============================================================ */

(function () {
  'use strict';

  // ---- 七时段锚点 ----
  // h: 锚点时刻(小时, 可带小数)；name: 眉题显示
  // top/bottom: 天空渐变上下色；glow: [r,g,b,a] 光晕；stars: 星星层透明度
  var STOPS = [
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
  // 相对亮度（WCAG 简化版）：0 暗到 1 亮
  function lum(c) {
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
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

    // 亮度联动玻璃配方（PRD 2.2/2.3：白天天空 → 亮配方深字）
    var recipe = lum(bottom) > 0.42 ? 'light' : 'dark';
    document.documentElement.setAttribute('data-recipe', recipe);
  }

  function initStars() {
    var box = document.getElementById('stars');
    if (!box) return;
    var n = 44;
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
