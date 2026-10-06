/* 时念 · 云彩引擎（v0.6.5）
   ------------------------------------------------------------
   - 共享模块：主天空与开场复用，保证「同一片天」
   - 云 = 多个柔边圆（径向渐变）堆叠；参数化基础半径 / 圆数(厚度) / 形态
   - 随机：每云基础半径随机、每次加载随机朵数、每云圆数随机（蓬松 / 细长各异）
   - 漂移：内置微型平滑噪声驱动轻微横/纵向摆动，到边缘回卷（非 Math.random 抖跳）
   - 时刻染色：读小时在 暗蓝灰(夜)→暖(黎明/日落)→近白(白天) 间插值
   - 天气联动：读 :root[data-weather] 调整云量与浓度（阴/雨/雪/雾增多，晴空减少）
   - 守卫：DPR 钳制由调用方处理；无 2D 上下文时 draw 直接跳过；减弱动态下静态
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

  // ---- 时刻 → 云染色与基础浓度（与 sky.js 同一套时间观感）----
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

  function densityFromWeather() {
    var w = (typeof document !== 'undefined')
      ? document.documentElement.getAttribute('data-weather') : null;
    switch (w) {
      case 'clear':        return { count: 0.55, alpha: 0.70 };
      case 'partly-cloudy':return { count: 1.00, alpha: 1.00 };
      case 'cloudy':
      case 'fog':          return { count: 1.70, alpha: 1.28 };
      case 'rain':
      case 'snow':
      case 'drizzle':
      case 'thunderstorm': return { count: 1.90, alpha: 1.32 };
      default:             return { count: 0.90, alpha: 0.95 }; // 未取得天气：温和偏少
    }
  }

  // ---- 云场（一束云，可被主天空与开场各自实例化）----
  function Field(opts) {
    opts = opts || {};
    this.w = opts.w || 360; this.h = opts.h || 640;
    this.noise = new Noise((Math.random() * 1e6) | 0);
    this.clouds = [];
    this._countMul = 1; this._alphaMul = 1;
    this._hour = nowHour();
    this.reseed();
  }
  Field.prototype.resize = function (w, h) { this.w = w; this.h = h; };
  Field.prototype.setWeather = function () {
    var d = densityFromWeather();
    this._countMul = d.count; this._alphaMul = d.alpha;
    this.reseed();
  };
  Field.prototype.reseed = function () {
    var base = this.w >= 680 ? 7 : 4;
    var n = Math.max(2, Math.round(base * this._countMul * (0.8 + Math.random() * 0.4)));
    this.clouds = [];
    for (var i = 0; i < n; i++) this.clouds.push(this._makeCloud());
  };
  Field.prototype._makeCloud = function () {
    var far = Math.random() < 0.4;
    var baseR = far ? (95 + Math.random() * 120) : (52 + Math.random() * 95);
    var nb = 5 + Math.floor(Math.random() * 8);   // 圆数 → 蓬松度/厚度
    var blobs = [];
    for (var k = 0; k < nb; k++) {
      blobs.push({
        dx: (Math.random() - 0.5) * baseR * 1.5,
        dy: (Math.random() - 0.5) * baseR * 0.55,
        r: baseR * (0.38 + Math.random() * 0.5)
      });
    }
    var stretch = Math.random() < 0.32 ? (1.3 + Math.random() * 0.7) : 1; // 偶尔细长
    return {
      x: Math.random() * (this.w + baseR * 2) - baseR,
      y: this.h * (0.06 + Math.random() * 0.52),
      baseR: baseR, blobs: blobs, stretch: stretch, far: far,
      speed: (far ? 3 : 8) + Math.random() * 6,
      seed: Math.random() * 1000
    };
  };
  Field.prototype.update = function (dt) {
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      c.x += c.speed * dt;
      var edge = c.baseR * c.stretch;
      if (c.x - edge > this.w + edge + 40) {           // 出右界 → 从左侧回卷
        c.x = -edge - 20;
        c.y = this.h * (0.06 + Math.random() * 0.52);
        c.seed = Math.random() * 1000;
      }
    }
  };
  Field.prototype.draw = function (ctx, nowMs, reduced) {
    if (!ctx) return;
    var tint = tintAt(this._hour);
    var tsec = nowMs * 0.001;
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      var nx = reduced ? 0 : (this.noise.v(tsec * 0.06 + c.seed) - 0.5) * 16;
      var ny = reduced ? 0 : (this.noise.v(tsec * 0.04 + c.seed + 50) - 0.5) * 7;
      ctx.save();
      ctx.translate(c.x + nx, c.y + ny);
      ctx.scale(c.stretch, 1);
      var baseA = (c.far ? 0.5 : 0.9) * tint.a * this._alphaMul * (c.far ? 0.65 : 1);
      for (var j = 0; j < c.blobs.length; j++) {
        var b = c.blobs[j];
        var a = baseA * (0.8 + 0.2 * (j % 2));
        var g = ctx.createRadialGradient(b.dx, b.dy, 0, b.dx, b.dy, b.r);
        g.addColorStop(0,    'rgba(' + tint.r + ',' + tint.g + ',' + tint.b + ',' + a.toFixed(3) + ')');
        g.addColorStop(0.55, 'rgba(' + tint.r + ',' + tint.g + ',' + tint.b + ',' + (a * 0.5).toFixed(3) + ')');
        g.addColorStop(1,    'rgba(' + tint.r + ',' + tint.g + ',' + tint.b + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.dx, b.dy, b.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  };

  window.ShiNianClouds = {
    create: function (opts) { return new Field(opts); },
    tintAt: tintAt,
    densityFromWeather: densityFromWeather,
    Noise: Noise
  };
})();
