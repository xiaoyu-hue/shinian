/* 时念 · 云彩引擎 v2.1（v0.6.6 深度优化：真实云物理 + 移动/桌面分级）
   ------------------------------------------------------------
   设计目标（对照真实云的逻辑）：
   1) 多层视差：高空卷云(快/薄/透) → 中层(中速/蓬松) → 低层(慢/宽/厚)，
      各层独立速度，形成真实的「深度感」与「风的差异」。
   2) 真实云型：
      - cumulus 积云：平底边 + 顶部圆滚隆起（经典花菜状）
      - stratus  层云：横向铺开的扁平薄片（阴天/多云）
      - stratus-low / fog 贴地层云：贴近地平线、极宽极扁（雾）
      - storm    风暴云：暗、厚、垂直发展（雨/雪/雷）
      - cirrus   卷云：高空纤细拉丝（仅高层）
   3) 太阳光照（关键真实感）：
      - 由时刻推算太阳方位（日出偏东、正午当头、日落偏西）与仰角
      - 迎光面更亮、背光面更暗（云体自阴影）
      - 顶部比底部更亮（积云平底下亮上暗）
      - 晨昏（低仰角）时迎光面染暖金色（golden hour 轮廓光）
   4) 天气联动：读 :root[data-weather] 选云型/亮度/浓度/覆盖（阴雨雪增多、晴空减少）
   5) 移动端 / 桌面端深度分级：
      - 桌面：3 层、DPR≤2、内部渲染分辨率 1.0、FPS 30、云更密更细
      - 移动：2 层(去掉卷云)、DPR≤1.5、内部渲染分辨率 0.62（柔边云放大无损）、FPS 24、云更简
      - 省电：切后台暂停、减弱动态静态、dt 钳制
   6) 降级守卫：无 2D 上下文时 draw 直接跳过；噪声内置（零依赖）
   依赖：无外部运行时（噪声内置，与 vendored lunar.js 同类） */
(function () {
  'use strict';

  // ---- 内置微型平滑噪声（1D 余弦插值，无依赖）----
  function Noise(seed) { this.seed = (seed | 0) || 1; }
  Noise.prototype._r = function (i) {
    var x = Math.sin((i * 127.1 + this.seed * 311.7)) * 43758.5453;
    return x - Math.floor(x);
  };
  Noise.prototype.v = function (t) {
    var i = Math.floor(t), f = t - i;
    var a = this._r(i), b = this._r(i + 1);
    var u = f * f * (3 - 2 * f);     // smoothstep
    return a + (b - a) * u;          // 0..1
  };

  // ---- 时刻 → 云基础染色（与 sky.js 同一套观感：暗蓝灰夜→暖金黎明/日落→近白白天）----
  var TINTS = [
    { h: 0,    c: [38, 52, 78],   a: 0.16 }, // 深夜
    { h: 5,    c: [70, 86, 120],  a: 0.20 }, // 凌晨
    { h: 6.5,  c: [226, 178, 150],a: 0.30 }, // 黎明暖
    { h: 9,    c: [244, 248, 252],a: 0.42 }, // 上午近白
    { h: 13,   c: [248, 250, 253],a: 0.44 }, // 正午
    { h: 17,   c: [246, 240, 232],a: 0.42 }, // 午后
    { h: 18.8, c: [240, 188, 142],a: 0.36 }, // 日落暖金
    { h: 20.5, c: [120, 132, 162],a: 0.24 }, // 暮色
    { h: 22,   c: [50, 64, 92],   a: 0.18 }, // 夜
    { h: 24,   c: [38, 52, 78],   a: 0.16 }
  ];
  function tintAt(hour) {
    var a = TINTS[0], b = TINTS[TINTS.length - 1];
    for (var i = 0; i < TINTS.length - 1; i++) {
      if (hour >= TINTS[i].h && hour <= TINTS[i + 1].h) { a = TINTS[i]; b = TINTS[i + 1]; break; }
    }
    var span = b.h - a.h; var t = span > 0 ? (hour - a.h) / span : 0;
    return {
      r: Math.round(a.c[0] + (b.c[0] - a.c[0]) * t),
      g: Math.round(a.c[1] + (b.c[1] - a.c[1]) * t),
      b: Math.round(a.c[2] + (b.c[2] - a.c[2]) * t),
      a: a.a + (b.a - a.a) * t
    };
  }

  function nowHour() {
    var q = (typeof location !== 'undefined' && location.search)
      ? new URLSearchParams(location.search).get('t') : null;
    if (q && /^\d{1,2}:\d{2}$/.test(q)) { var p = q.split(':'); return (+p[0]) + (+p[1]) / 60; }
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  // ---- 太阳方位（用于云体光照，自包含、零依赖）----
  // 默认锚点对齐 sky.js（日出 ~6.3、日落 ~18.4）；返回：
  //   x    : 太阳水平方位，-1(西/日落侧) .. +1(东/日出侧)
  //   elev : 仰角 0(地平) .. 1(正午当头)
  //   gold : 暖金色强度 0..1（低仰角晨昏最强，正午近 0）
  function sunInfo(hour) {
    var sr = 6.3, ss = 18.4;
    var day = (hour - sr) / (ss - sr);            // 0 日出 .. 1 日落
    day = Math.max(0, Math.min(1, day));
    var x = 1 - 2 * day;                          // 日出(+1,东) → 日落(-1,西)
    var elev = Math.sin(day * Math.PI);           // 0 两端, 1 正午
    var gold = Math.pow(1 - elev, 1.6);           // 低仰角(晨昏)更暖
    return { x: x, elev: elev, gold: gold };
  }

  // ---- 天气 → 云型/亮度/浓度/覆盖（沿用既有 data-weather 信号）----
  var WEATHER = {
    clear:         { count: 0.50, alpha: 0.78, type: 'cumulus',     bright: 1.00, coverage: 0.35 },
    'partly-cloudy':{ count: 1.00, alpha: 1.00, type: 'cumulus',     bright: 1.00, coverage: 0.60 },
    cloudy:        { count: 1.50, alpha: 1.12, type: 'stratus',      bright: 0.90, coverage: 0.85 },
    fog:           { count: 1.35, alpha: 0.95, type: 'stratus-low',  bright: 1.05, coverage: 0.90, hug: true },
    drizzle:       { count: 1.70, alpha: 1.25, type: 'storm',        bright: 0.66, coverage: 0.90 },
    rain:          { count: 1.75, alpha: 1.28, type: 'storm',        bright: 0.58, coverage: 0.92 },
    snow:          { count: 1.60, alpha: 1.18, type: 'storm',        bright: 0.82, coverage: 0.88, cool: true },
    thunderstorm:  { count: 1.95, alpha: 1.32, type: 'storm',        bright: 0.48, coverage: 0.95 }
  };
  function weatherProfile() {
    var w = (typeof document !== 'undefined')
      ? document.documentElement.getAttribute('data-weather') : null;
    return WEATHER[w] || { count: 0.90, alpha: 0.95, type: 'cumulus', bright: 0.98, coverage: 0.55 };
  }
  function densityFromWeather() {            // 保留旧接口（兼容性 / 单测）
    var p = weatherProfile();
    return { count: p.count, alpha: p.alpha };
  }

  // ---- 设备分级（移动 / 桌面）----
  var DESKTOP = { dpr: 2,   resScale: 1.00, fps: 30, baseCount: 7, blobsMin: 8, blobsMax: 14, layers: ['high', 'mid', 'low'] };
  var MOBILE  = { dpr: 1.5, resScale: 0.62, fps: 24, baseCount: 4, blobsMin: 5, blobsMax: 9,  layers: ['mid', 'low'] };
  function detectQuality(opts) {
    opts = opts || {};
    if (opts.quality === 'desktop') return DESKTOP;
    if (opts.quality === 'mobile') return MOBILE;
    var mobile = false;
    try {
      var mq = (typeof window !== 'undefined') ? window.matchMedia : null;
      var narrow = (typeof window !== 'undefined') && window.innerWidth <= 680;
      var coarse = mq && mq('(pointer: coarse)').matches;
      var save = (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData);
      mobile = !!(coarse && narrow) || (narrow && (window.innerWidth <= 560)) || !!save;
    } catch (e) { mobile = false; }
    return mobile ? MOBILE : DESKTOP;
  }

  // ---- 云层参数（视差：speed 越大越快；alpha 越大越靠前不透）----
  var LAYERS = {
    high: { yTop: 0.04, yBot: 0.22, scale: 0.7, speed: [14, 22], alpha: 0.50 },
    mid:  { yTop: 0.12, yBot: 0.52, scale: 1.0, speed: [6, 12],  alpha: 0.82 },
    low:  { yTop: 0.34, yBot: 0.80, scale: 1.3, speed: [2.5, 5.5], alpha: 1.0 }
  };

  // ---- 颜色工具 ----
  function shade(c, amt) { // amt>0 提亮, <0 压暗
    if (amt >= 0) return [c[0] + (255 - c[0]) * amt, c[1] + (255 - c[1]) * amt, c[2] + (255 - c[2]) * amt];
    var a = -amt; return [c[0] * (1 - a), c[1] * (1 - a), c[2] * (1 - a)];
  }
  function warm(c, amt) { // 加暖（红升蓝降）
    return [c[0] + (255 - c[0]) * amt * 0.9, c[1] + (255 - c[1]) * amt * 0.25, c[2] * (1 - amt * 0.4)];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function clamp255(v) { v = v < 0 ? 0 : (v > 255 ? 255 : v); return v | 0; }
  function rgba(c, a) {
    return 'rgba(' + clamp255(c[0]) + ',' + clamp255(c[1]) + ',' + clamp255(c[2]) + ',' + a.toFixed(3) + ')';
  }

  // ---- 选云型 ----
  function pickKind(layer, p) {
    if (layer === 'high') return (p.type === 'storm') ? (Math.random() < 0.5 ? 'cirrus' : 'storm') : 'cirrus';
    if (p.type === 'cumulus') return 'cumulus';
    if (p.type === 'storm') return 'storm';
    if (p.type === 'stratus' || p.type === 'stratus-low') return 'stratus';
    return 'cumulus';
  }

  // ---- 云场 ----
  function Field(opts) {
    opts = opts || {};
    this.w = opts.w || 360; this.h = opts.h || 640;
    this.noise = new Noise((Math.random() * 1e6) | 0);
    this._q = detectQuality(opts);
    this._profile = weatherProfile();
    this._clock = 0;
    this._alphaMul = 1; this._countMul = 1;
    this._hour = nowHour();
    this.clouds = [];
    this.reseed();
  }
  Field.prototype.resize = function (w, h) { this.w = w; this.h = h; };
  Field.prototype.setWeather = function () {
    this._profile = weatherProfile();
    this.reseed();
  };
  Field.prototype.reseed = function () {
    var q = this._q, p = this._profile;
    var layers = p.hug ? ['low'] : q.layers;
    var total = Math.max(2, Math.round(q.baseCount * p.count));
    var weights = { high: 0.22, mid: 0.40, low: 0.38 };
    if (layers.length === 1) weights = { low: 1 };
    else if (layers.length === 2) weights = { mid: 0.5, low: 0.5 };
    this.clouds = [];
    for (var li = 0; li < layers.length; li++) {
      var ly = layers[li];
      var cnt = Math.max(1, Math.round(total * (weights[ly] || 0.34)));
      for (var i = 0; i < cnt; i++) {
        this.clouds.push(this._makeCloud(ly, pickKind(ly, p), p, q));
      }
    }
  };

  Field.prototype._makeCloud = function (layer, kind, p, q) {
    var L = LAYERS[layer];
    var baseR = (layer === 'high' ? 60 : layer === 'low' ? 95 : 72) * L.scale * (0.8 + Math.random() * 0.5);
    if (p.hug && layer === 'low') baseR *= 1.3;        // 雾：贴地更宽
    var nb = q.blobsMin + Math.floor(Math.random() * (q.blobsMax - q.blobsMin + 1));
    if (kind === 'storm') nb += 3;                      // 风暴更密
    if (kind === 'cirrus') nb = Math.max(5, Math.round(nb * 0.5));
    var blobs = [];
    var rnd = Math.random;
    if (kind === 'stratus') {
      var sheetH = baseR * 0.5;
      for (var s = 0; s < nb; s++) {
        blobs.push({
          dx: (rnd() - 0.5) * baseR * 3.6,
          dy: (rnd() - 0.5) * sheetH,
          r: baseR * (0.28 + rnd() * 0.32),
          sx: 1.5 + rnd() * 0.9, sy: 0.62          // 横向铺开、压扁
        });
      }
    } else if (kind === 'cirrus') {
      for (var c2 = 0; c2 < nb; c2++) {
        blobs.push({
          dx: (rnd() - 0.5) * baseR * 4.2,
          dy: (rnd() - 0.5) * baseR * 0.5,
          r: baseR * (0.5 + rnd() * 0.7),
          sx: 2.6 + rnd() * 1.8, sy: 0.26 + rnd() * 0.18   // 极薄长丝
        });
      }
    } else { // cumulus / storm：平底边 + 顶部隆起
      var baseLine = baseR * 0.26;
      for (var k = 0; k < nb; k++) {
        var ang = rnd() * Math.PI * 2;
        var rad = rnd() * baseR * 0.9;
        var dx = Math.cos(ang) * rad;
        var dy = baseLine - rnd() * baseR * (kind === 'storm' ? 1.3 : 1.05);
        if (rnd() < 0.25) dy = baseLine + rnd() * baseR * 0.15;   // 少量落于底边 → 平基底
        blobs.push({ dx: dx, dy: dy, r: baseR * (0.40 + rnd() * 0.5) });
      }
    }
    var yTop = (p.hug && layer === 'low') ? 0.74 : L.yTop;
    var yBot = (p.hug && layer === 'low') ? 0.96 : L.yBot;
    return {
      layer: layer, kind: kind, blobs: blobs,
      x: rnd() * (this.w + baseR * 2) - baseR,
      yFrac: yTop + rnd() * (yBot - yTop),
      baseR: baseR,
      speed: L.speed[0] + rnd() * (L.speed[1] - L.speed[0]),
      layerAlpha: L.alpha,
      seed: rnd() * 1000
    };
  };

  Field.prototype.update = function (dt) {
    this._clock += dt;
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      var L = LAYERS[c.layer];
      var sp = c.speed * (0.85 + 0.3 * this.noise.v(this._clock * 0.02 + c.seed)); // 噪声微扰速度，非恒定
      c.x += sp * dt;
      var edge = c.baseR * (c.kind === 'stratus' ? 2.4 : 1.4);
      if (c.x - edge > this.w + edge + 30) {                 // 出右界 → 左界回卷（无缝）
        c.x = -edge - 20 - Math.random() * this.w * 0.2;
        c.yFrac = L.yTop + Math.random() * (L.yBot - L.yTop);
        c.seed = Math.random() * 1000;
      }
    }
  };

  Field.prototype.draw = function (ctx, nowMs, reduced) {
    if (!ctx) return;
    this._hour = nowHour();
    var sun = sunInfo(this._hour);
    var baseTint = tintAt(this._hour);
    var h = this.h, w = this.w;
    var p = this._profile;
    var sh = shade(baseTint, -0.30);                 // 背光暗部基准
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      var cy = c.yFrac * h;
      var nx = reduced ? 0 : (this.noise.v(this._clock * 0.05 + c.seed) - 0.5) * c.baseR * 0.12;
      var ny = reduced ? 0 : (this.noise.v(this._clock * 0.035 + c.seed + 50) - 0.5) * c.baseR * 0.05;
      var baseA = baseTint.a * c.layerAlpha * p.alpha * this._alphaMul;
      var baseSy = (c.layer === 'low') ? 0.9 : 1;    // 低层轻微透视压扁
      for (var j = 0; j < c.blobs.length; j++) {
        var b = c.blobs[j];
        // 光照：迎光面更亮、顶部更亮、晨昏暖染
        var sideNorm = Math.max(-1, Math.min(1, (b.dx) * sun.x / (c.baseR * 1.5)));
        var lit = 0.5 + 0.5 * sideNorm;                       // 0(背)..1(迎)
        var top = b.dy < 0 ? 1 : 0;
        var hi = shade(baseTint, 0.14 + 0.12 * top);
        hi = warm(hi, sun.gold * lit * 0.55);                 // golden hour 暖轮廓
        var col = mix(sh, hi, lit);
        col = [col[0] * p.bright, col[1] * p.bright, col[2] * p.bright];
        var a = baseA * (0.6 + 0.4 * lit);
        ctx.save();
        ctx.translate(c.x + nx + b.dx, cy + ny + b.dy);
        ctx.scale(b.sx || 1, (b.sy || 1) * baseSy);
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
        g.addColorStop(0,    rgba(col, a));
        g.addColorStop(0.45, rgba(col, a * 0.55));
        g.addColorStop(1,    rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  };

  window.ShiNianClouds = {
    create: function (opts) { return new Field(opts); },
    tintAt: tintAt,
    densityFromWeather: densityFromWeather,
    weatherProfile: weatherProfile,
    config: function (opts) { return detectQuality(opts); },
    Noise: Noise
  };
})();
