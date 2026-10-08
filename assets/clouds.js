/* 时念 · 云彩引擎 v3（v0.7.0 天穹重构）
   ------------------------------------------------------------
   v3 相对 v2 的根本改变：**换渲染内核**。
   v2 是「柔边圆堆叠」（本质是 metaball），数学上天生抱团，调参改不掉「聚成一坨」。
   v3 改为「fBm 噪声场 + 密度阈值 + 域翘曲」，业界标准做法：

   M1 噪声内核：hash → value noise → fBm（多倍频叠加）→ 双层侵蚀（粗层裂片 / 细层丝缕）
   M2 真实形态：
     - 网格放置 + 大部分格子留空  → 云与云之间保留开阔天空（根治聚团）
     - 积云平底：中心以上更高、以下更平 + 底部硬切
     - 自阴影：云内下暗上亮（白天）/ 下亮上暗（低太阳）
     - 远层雾化：向天空色混合，距离感 = 雾霭
   M3 流动演变：风场平流（云在噪声场中穿行）+ 湍流时间项（持续变形）+ 多层视差
   M4 太阳光照：迎光/背光、银边效应(silver lining)、火烧云高度渐变（底橙红→中粉→顶紫蓝）

   架构要点：
     - 云场在**低分辨率**（1/6~1/7）逐像素算密度写入像素数组，再放大贴图
       （浏览器双线性插值 → 天然柔边；既是性能优化也是画质技巧）
     - 像素数组是纯 JS 计算，**不依赖 canvas**，因此可在无 canvas 环境（jsdom）中测试
     - canvas 仅用于最后的放大贴图；不可用时优雅降级（不画，但像素仍可测）
   依赖：无外部运行时（噪声自研；太阳数据优先取 ShiNianSunMoon，缺失时近似兜底） */
(function () {
  'use strict';

  // ---------- 通用数学 ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ss(e0, e1, x) { var t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  function shade(c, amt) {
    if (amt >= 0) return [c[0] + (255 - c[0]) * amt, c[1] + (255 - c[1]) * amt, c[2] + (255 - c[2]) * amt];
    var a = -amt; return [c[0] * (1 - a), c[1] * (1 - a), c[2] * (1 - a)];
  }

  // ---------- 噪声内核（零依赖，自研）----------
  function hash2(ix, iy, seed) {
    var n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function vnoise(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    var t = a + (b - a) * ux, bo = c + (d - c) * ux;
    return t + (bo - t) * uy;
  }
  // fBm：多倍频叠加，得到「大团块 + 中结构 + 细边缘」的多尺度形态
  function fbm(x, y, oct, seed) {
    var v = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) {
      v += amp * vnoise(x * f, y * f, seed + i * 17);
      norm += amp; f *= 2; amp *= 0.5;
    }
    return norm > 0 ? v / norm : 0;
  }

  // ---------- 时刻 → 云基础染色 ----------
  var TINTS = [
    { h: 0,    c: [38, 52, 78],   a: 0.16 },
    { h: 5,    c: [70, 86, 120],  a: 0.20 },
    { h: 6.5,  c: [226, 178, 150],a: 0.30 },
    { h: 9,    c: [244, 248, 252],a: 0.42 },
    { h: 13,   c: [248, 250, 253],a: 0.46 },
    { h: 17,   c: [246, 240, 232],a: 0.42 },
    { h: 18.8, c: [240, 188, 142],a: 0.36 },
    { h: 20.5, c: [120, 132, 162],a: 0.24 },
    { h: 22,   c: [50, 64, 92],   a: 0.18 },
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

  // ---------- 火烧云配色：云底橙红 → 中部粉 → 顶部紫蓝 ----------
  var FIRE_BOT = [255, 104, 52], FIRE_MID = [255, 158, 128], FIRE_TOP = [140, 128, 186];
  function fireColor(hf) {
    return hf < 0.5 ? mix3(FIRE_BOT, FIRE_MID, hf / 0.5)
                    : mix3(FIRE_MID, FIRE_TOP, (hf - 0.5) / 0.5);
  }
  // 火烧云强度：太阳高度角越接近地平线越强（峰值约 +2°）
  // v1.1.3 修触发窗口 bug：原 Math.abs(sun.alt - 2) 使太阳下山后（alt 为负）火烧云仍在
  // 烧（alt=-8° 时强度仍 0.16）——暮色云被染成孤立橙团（用户可见的"贴纸感"根源）。
  // 物理上民用暮光（-6°）结束火烧云即熄灭；此处 -4° 熄灭、+9° 以上（白昼）不触发。
  function fireAmount(sun) {
    if (sun.alt < -4 || sun.alt > 9) return 0;
    var f = 1 - Math.abs(sun.alt - 2) / 7;
    return f > 0 ? Math.pow(f, 1.25) : 0;
  }

  // ---------- 太阳状态（优先用真实 SunCalc，缺失时近似兜底）----------
  function sunState(hour) {
    var ext = null;
    try {
      if (typeof window !== 'undefined' && window.ShiNianSunMoon &&
          typeof window.ShiNianSunMoon.get === 'function') {
        ext = window.ShiNianSunMoon.get();
      }
    } catch (e) { ext = null; }
    if (ext && ext.sun && typeof ext.sun.altitudeDeg === 'number') {
      var s = ext.sun;
      return { alt: s.altitudeDeg, az: s.azimuthDeg, above: s.altitudeDeg > -0.5, real: true };
    }
    // 近似兜底（未接 SunCalc 时）：日出 6.3 / 日落 18.4
    // 方位角采用 SunCalc 约定（0=南，西为正）：日出≈-90°（东/画面左），日落≈+90°（西/画面右）
    var sr = 6.3, sh = 18.4;
    var day = (hour - sr) / (sh - sr);
    var above = day >= 0 && day <= 1;
    var dc = clamp(day, 0, 1);
    var alt = above ? Math.sin(dc * Math.PI) * 62 : -10;
    var az = -90 + dc * 180;
    return { alt: alt, az: az, above: above, real: false };
  }

  // ---------- 天气 → 覆盖/云型/亮度 ----------
  var WEATHER = {
    clear:          { coverage: 0.30, alpha: 0.72, type: 'cumulus',     bright: 1.00 },
    'partly-cloudy':{ coverage: 0.52, alpha: 0.88, type: 'cumulus',     bright: 1.00 },
    cloudy:         { coverage: 0.90, alpha: 0.95, type: 'stratus',     bright: 0.94 },
    fog:            { coverage: 1.00, alpha: 0.88, type: 'stratus-low', bright: 1.02, hug: true },
    drizzle:        { coverage: 0.80, alpha: 1.00, type: 'storm',       bright: 0.80 },
    rain:           { coverage: 0.86, alpha: 1.02, type: 'storm',       bright: 0.76 },
    snow:           { coverage: 0.78, alpha: 0.95, type: 'storm',       bright: 0.90, cool: true },
    thunderstorm:   { coverage: 0.90, alpha: 1.05, type: 'storm',       bright: 0.70 }
  };
  function weatherProfile() {
    var w = (typeof document !== 'undefined')
      ? document.documentElement.getAttribute('data-weather') : null;
    return WEATHER[w] || { coverage: 0.48, alpha: 0.86, type: 'cumulus', bright: 0.98 };
  }
  function densityFromWeather() {           // 保留旧接口（兼容性 / 单测）
    var p = weatherProfile();
    return { count: Math.round(p.coverage * 10), alpha: p.alpha };
  }

  // v0.7.1：云彩自定义开关与云量档位（读 :root[data-cloud]，由设置面板写入）
  //   off=关闭（不画云，天空纯净）/ auto=跟随天气（默认）/ sparse=疏 / normal=适中 / dense=密
  var CLOUD_MODE = { off: { mul: 0 }, auto: { mul: 1.00 }, sparse: { mul: 0.45 },
                     normal: { mul: 0.80 }, dense: { mul: 1.60 } };
  function cloudMode() {
    var v = (typeof document !== 'undefined')
      ? document.documentElement.getAttribute('data-cloud') : null;
    var m = CLOUD_MODE[v];
    return m || CLOUD_MODE.auto;
  }

  // v0.7.1 空窗期：云飘过之后留一段澄澈天空，再让下一批云回来（真实天空的节奏）
  //   off=连续有云(无空窗) / short≈14s / mid≈28s / long≈50s
  var CLOUD_GAP = { off: 0, short: 14, mid: 28, long: 50 };
  function cloudGapSec() {
    var v = (typeof document !== 'undefined')
      ? document.documentElement.getAttribute('data-cloud-gap') : null;
    var g = CLOUD_GAP[v];
    return (typeof g === 'number') ? g : 0;
  }

  // ---------- 云层（远 → 近；远的慢、近的快，形成视差纵深）----------
  var LAYER_CFG = {
    high: { band: [0.02, 0.32], cols: 5, rows: 2, rx: [0.12, 0.24], ry: [0.028, 0.055],
            speed: 0.0062, alpha: 0.40, haze: 0.62, erode: 0.62, thr: 0.52 },
    mid:  { band: [0.08, 0.55], cols: 4, rows: 2, rx: [0.15, 0.28], ry: [0.060, 0.110],
            speed: 0.0135, alpha: 0.74, haze: 0.30, erode: 0.52, thr: 0.46 },
    low:  { band: [0.32, 0.88], cols: 3, rows: 2, rx: [0.20, 0.36], ry: [0.090, 0.160],
            speed: 0.0245, alpha: 0.96, haze: 0.10, erode: 0.46, thr: 0.44 }
  };
  var LAYER_ORDER = ['high', 'mid', 'low'];   // 由远及近绘制

  // ---------- 设备分级 ----------
  var DESKTOP = { dpr: 2, resScale: 1.0, fps: 30, div: 6, oct: 4, layers: ['high', 'mid', 'low'] };
  var MOBILE  = { dpr: 1.5, resScale: 1.0, fps: 24, div: 7, oct: 3, layers: ['mid', 'low'] };
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
  function pickKind(layerId, p) {
    if (layerId === 'high') return (p.type === 'storm') ? 'storm' : 'cirrus';
    if (p.type === 'storm') return 'storm';
    if (p.type === 'stratus' || p.type === 'stratus-low') return 'stratus';
    return 'cumulus';
  }

  // ---------- 云型轮廓（u: -1..1 横向；v: -1 顶 .. +1 底）----------
  function shapeAt(u, v, kind) {
    var vv, d, s;
    if (kind === 'stratus' || kind === 'stratus-low') {   // 扁平薄片
      vv = v * 2.4; d = Math.sqrt(u * u * 0.85 + vv * vv);
      s = 1 - ss(0.45, 1.0, d);
    } else if (kind === 'cirrus') {                        // 高空细丝
      vv = v * 3.6; d = Math.sqrt(u * u * 0.50 + vv * vv);
      s = 1 - ss(0.40, 1.0, d);
    } else if (kind === 'storm') {                         // 暗厚、垂直发展
      vv = v > 0 ? v * 1.30 : v * 0.72; d = Math.sqrt(u * u * 0.88 + vv * vv);
      s = 1 - ss(0.44, 1.0, d);
      s *= 1 - ss(0.72, 1.06, v);
    } else {                                               // cumulus：平底积云
      vv = v > 0 ? v * 1.95 : v * 0.88;                    // 下半部压缩 → 底更平
      d = Math.sqrt(u * u + vv * vv);
      s = 1 - ss(0.40, 1.0, d);
      s *= 1 - ss(0.50, 0.96, v);                          // 底部硬切 = 平底
    }
    return s < 0 ? 0 : s;
  }

  // ---------- 云场 ----------
  function Field(opts) {
    opts = opts || {};
    this.w = opts.w || 360; this.h = opts.h || 640;
    this._q = detectQuality(opts);
    this._p = weatherProfile();
    this._t = 0;
    this._hour = nowHour();
    this._seed = (Math.random() * 100000) | 0;
    this.clouds = [];
    // v0.7.1 空窗节律：有云 runSec 秒 → 空窗 gapSec 秒，循环；切换处 4 秒淡入淡出
    this._gapT = 0;
    this._runSec = 55 + Math.random() * 45;      // 每轮有云时长（55~100s，随机避免机械感）
    this._gapSec = 0;
    this._fade = 1;
    this._alloc();
    this.reseed();
  }
  Field.prototype._alloc = function () {
    var div = this._q.div;
    this.fw = Math.max(20, Math.round(this.w / div));
    this.fh = Math.max(20, Math.round(this.h / div));
    this.buf = new Uint8ClampedArray(this.fw * this.fh * 4);
    this._off = null; this._offCtx = null; this._img = null;
  };
  Field.prototype.resize = function (w, h) { this.w = w; this.h = h; this._alloc(); };
  Field.prototype.setWeather = function () { this._p = weatherProfile(); this.reseed(); };

  // 网格放置：大部分格子留空 → 云之间保留开阔天空（根治「聚成一坨」）
  Field.prototype.reseed = function () {
    var q = this._q, p = this._p, seed = this._seed;
    var layers = p.hug ? ['low'] : q.layers;
    this.clouds = [];
    for (var li = 0; li < layers.length; li++) {
      var id = layers[li], L = LAYER_CFG[id];
      var kind = pickKind(id, p);
      var cm = cloudMode();
      var cov = p.coverage * (id === 'low' ? 1.0 : 0.82) * cm.mul;
      var band = (p.hug && id === 'low') ? [0.60, 0.99] : L.band;
      var cols = (p.hug && id === 'low') ? 4 : L.cols;   // 雾：更密的贴地宽带
      for (var r = 0; r < L.rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (hash2(c, r, seed + li * 97) > cov) continue;      // 空格子 = 蓝天留白
          // v1.1.3 修 sparse 失效遗留 bug：格子少时 cov 乘率删不掉格子（实测 sparse 与
          // auto 条目数同为 6），档位形同虚设。改为乘率同时作用于云体尺寸与透明度——
          // sparse 云更小更透、dense 云更大更实，三档观感立现且逐帧确定。
          var sizeMul = 0.55 + 0.45 * Math.min(cm.mul, 1.6);
          var hx = hash2(c, r, seed + 311 + li * 17);
          var hy = hash2(c, r, seed + 727 + li * 23);
          var hz = hash2(c, r, seed + 991 + li * 29);
          var rrx = L.rx[0] + hz * (L.rx[1] - L.rx[0]);
          var rry = L.ry[0] + hz * (L.ry[1] - L.ry[0]);
          // 按云型修正体量：层云更宽更薄、卷云更长更细、风暴更高更厚
          if (kind === 'stratus') { rrx *= 1.50; rry *= 1.15; }   // 层云：宽而连绵
          else if (kind === 'cirrus') { rrx *= 1.30; rry *= 0.72; }
          else if (kind === 'storm') { rrx *= 1.12; rry *= 1.40; }
          if (p.hug) { rrx *= 1.45; rry *= 1.30; }                // 雾：贴地更宽更厚
          this.clouds.push({
            layer: id, kind: kind,
            x: (c + 0.15 + hx * 0.7) / cols,
            y: band[0] + hy * (band[1] - band[0]),
            rx: rrx * sizeMul, ry: rry * sizeMul,
            speed: L.speed,
            alpha: L.alpha * Math.min(1, 0.55 + 0.45 * cm.mul),
            haze: L.haze, erode: L.erode, thr: L.thr,
            band: band,
            seed: (hash2(c, r, seed + 555 + li * 41) * 1000) | 0
          });
        }
      }
    }
    // 兜底：至少 2 朵（兼容既有结构断言，也避免极端天气下天空全空）
    while (this.clouds.length < 2) {
      var L2 = LAYER_CFG.low;
      this.clouds.push({
        layer: 'low', kind: pickKind('low', p),
        x: 0.2 + Math.random() * 0.6, y: 0.4 + Math.random() * 0.3,
        rx: L2.rx[0], ry: L2.ry[0],
        speed: L2.speed, alpha: L2.alpha, haze: L2.haze, erode: L2.erode, thr: L2.thr,
        band: L2.band, seed: (Math.random() * 1000) | 0
      });
    }
  };

  Field.prototype.update = function (dt) {
    this._t += dt;                                  // 湍流时间项 → 云持续变形
    // v0.7.1 空窗节律推进
    this._gapSec = cloudGapSec();
    if (this._gapSec > 0) {
      this._gapT += dt;
      var cycle = this._runSec + this._gapSec;
      var p = this._gapT % cycle;
      if (p < this._runSec) {
        var fi = Math.min(1, p / 4);                       // 入场淡入
        var fo = Math.min(1, (this._runSec - p) / 4);      // 离场淡出
        this._fade = Math.max(0, Math.min(fi, fo));
      } else {
        this._fade = 0;                                    // 空窗期：完全无云
      }
    } else {
      this._fade = 1;                                      // 关闭空窗 → 连续有云
    }
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      c.x += c.speed * dt;                          // 风场平流
      // v0.7.1：出右界后紧贴左界外回卷（此前放到 -0.18 之外，慢层需 1~2 分钟才重新入场，
      // 造成「一段时期天空空着没云」）。现在仅离屏 0.02~0.10，配合提速，空窗降到几秒。
      if (c.x - c.rx > 1.02) {
        c.x = -c.rx - 0.02 - Math.random() * 0.08;
        c.y = c.band[0] + Math.random() * (c.band[1] - c.band[0]);
        c.seed = (Math.random() * 1000) | 0;
      }
    }
  };

  Field.prototype.render = function (reduced) {
    var buf = this.buf; buf.fill(0);
    // v0.6.8+：云彩关闭时直接清空（调用方仍需 draw 以把清空的画布贴上去）
    if (cloudMode().mul === 0) return;
    // v0.7.1：空窗期内无云 —— 直接返回，连光栅化都跳过（省电）；淡入淡出由 _fade 控制
    if (this._fade <= 0.001) return;
    this._hour = nowHour();
    var sun = sunState(this._hour);
    var tint = tintAt(this._hour);
    var bt = [tint.r, tint.g, tint.b];
    var p = this._p;
    var shadowC = shade(bt, -0.34);
    var litC = shade(bt, 0.14);
    var fire = fireAmount(sun);
    var sunX = 0.5 + 0.5 * Math.sin(sun.az * Math.PI / 180);  // SunCalc 约定：日出(-90°)→0 左，日落(+90°)→1 右
    var aspect = this.fh / this.fw;
    for (var oi = 0; oi < LAYER_ORDER.length; oi++) {
      var lid = LAYER_ORDER[oi];
      for (var i = 0; i < this.clouds.length; i++) {
        if (this.clouds[i].layer !== lid) continue;
        this._raster(this.clouds[i], sun, sunX, bt, shadowC, litC, fire, p, reduced, aspect);
      }
    }
  };

  Field.prototype._raster = function (cl, sun, sunX, bt, shadowC, litC, fire, p, reduced, aspect) {
    var fw = this.fw, fh = this.fh, buf = this.buf;
    var cx = cl.x, cy = cl.y, rx = cl.rx, ry = cl.ry;
    var x0 = Math.max(0, Math.floor((cx - rx * 1.5) * fw));
    var x1 = Math.min(fw - 1, Math.ceil((cx + rx * 1.5) * fw));
    var y0 = Math.max(0, Math.floor((cy - ry * 1.6) * fh));
    var y1 = Math.min(fh - 1, Math.ceil((cy + ry * 1.6) * fh));
    if (x1 < x0 || y1 < y0) return;

    var t = this._t;
    var windX = cl.x * 3.0;                       // 云在噪声场中穿行 → 形态随移动而变
    var turb = reduced ? 0 : t * 0.012;           // 湍流演变
    var nsC = 3.0, nsF = 8.0;
    if (cl.kind === 'cirrus') { nsC = 2.4; nsF = 9.5; }
    else if (cl.kind === 'stratus') { nsC = 2.0; nsF = 6.0; }
    var thr = cl.thr, baseA = cl.alpha * p.alpha, bright = p.bright;
    var sunDir = (sunX > cx) ? 1 : -1;            // 光从哪一侧来
    var fireOn = fire > 0.02;

    for (var y = y0; y <= y1; y++) {
      var vy = (y / fh - cy) / ry;
      if (vy < -1.7 || vy > 1.7) continue;
      for (var x = x0; x <= x1; x++) {
        var ux = (x / fw - cx) / rx;
        var s = shapeAt(ux, vy, cl.kind);
        if (s <= 0.002) continue;                 // 轮廓外：直接跳过（性能）

        // 双层 fBm 侵蚀：粗层啃出裂片、细层撕出丝缕
        var coarse = fbm((x / fw) * nsC + windX, (y / fh) * nsC * aspect + turb, 2, cl.seed);
        var fine = fbm((x / fw) * nsF + windX * 1.7, (y / fh) * nsF * aspect + turb * 1.3, 2, cl.seed + 57);
        var erode = coarse * 0.62 + fine * 0.38;
        var d = s + (erode - 0.5) * cl.erode;
        var a = ss(thr, thr + 0.30, d);
        if (a <= 0.004) continue;                 // 低于阈值 = 蓝天留白

        // 光照
        // v1.1.3 拟真光照（工艺来源：Horizon Zero Dawn GDC 体积云三件套的 2D 像素场近似，
        //   Beer-Lambert 透光 / HG 前向散射银边 / 云底阴影；调研记录见 CHANGELOG v1.1.3）：
        //   光学厚度 optical ≈ 密度 d × 云内路径（越靠云底路径越长、越背光路径越长），
        //   Beer 项 exp(-k·optical) 调制受光强度 → 厚处/底部/背光自然变暗，体积感由此而来。
        var hf = clamp((1 - vy) * 0.5, 0, 1);     // 云内高度：1=顶 0=底
        var face = 0.5 + 0.5 * (ux * sunDir);     // 迎光侧 1 / 背光侧 0
        var optical = d * (1.1 + 1.8 * (1 - hf)) * (1 + 0.6 * (1 - face));
        var beer = Math.exp(-0.9 * optical);      // Beer-Lambert 透光率
        var lit;
        if (!sun.above) lit = 0.42;                       // 夜间：无方向光（不加 Beer，保持已调校的夜云观感）
        else if (sun.alt > 10) lit = mix(0.30, 1.0, hf) * (0.40 + 0.60 * beer);  // 白天：顶亮底暗 + 透光衰减
        else lit = mix(0.95, 0.45, hf) * (0.50 + 0.50 * beer);                   // 低太阳：底亮顶暗 + 透光衰减
        lit *= 0.60 + 0.40 * face;
        lit = clamp(lit, 0, 1);
        var col = mix3(shadowC, litC, lit);

        // 火烧云：底橙红 → 中粉 → 顶紫蓝
        if (fireOn) {
          // v1.1.3 调参：fireColor 向天空底色回掺 30%——火烧云必须与暮色天空同色系渐变，
          // 否则整朵云染色成孤立橙团浮在粉紫天上（实测像贴纸），融合感优先于饱和度
          var fc = mix3(fireColor(hf), bt, 0.30);
          col = mix3(col, fc, fire * (0.15 + 0.32 * (1 - hf)) * (0.55 + 0.45 * face));
        }
        // 银边效应（HG 前向散射的 2D 近似）：薄云迎光边缘透光发亮；
        //   v1.1.3：低太阳时前向散射更强（真实逆光观感），叠加火光时的暖银边
        var edge = 1 - ss(thr, thr + 0.26, d);
        if (edge > 0.01 && face > 0.45) {
          var silverK = sun.above ? (0.38 + 0.15 * (1 - clamp(sun.alt / 25, 0, 1))) : 0.22;
          col = mix3(col, fireOn ? [255, 226, 190] : [255, 250, 240],
                     edge * face * silverK);
        }
        if (cl.haze > 0) col = mix3(col, bt, cl.haze * 0.55);   // 远层雾化
        col = [col[0] * bright, col[1] * bright, col[2] * bright];

        var alpha = a * baseA * this._fade;      // 乘空窗淡入淡出系数
        if (alpha <= 0.004) continue;
        // 源覆盖合成（由远及近）
        var idx = (y * fw + x) * 4;
        var da = buf[idx + 3] / 255;
        var oa = alpha + da * (1 - alpha);
        if (oa <= 0.004) continue;
        buf[idx]     = (col[0] * alpha + buf[idx]     * da * (1 - alpha)) / oa;
        buf[idx + 1] = (col[1] * alpha + buf[idx + 1] * da * (1 - alpha)) / oa;
        buf[idx + 2] = (col[2] * alpha + buf[idx + 2] * da * (1 - alpha)) / oa;
        buf[idx + 3] = oa * 255;
      }
    }
  };

  // canvas 仅用于最后的低分辨率放大贴图；环境不支持时优雅降级（像素仍可测）
  Field.prototype._ensureOff = function () {
    if (this._off && this._offCtx) return true;
    try {
      if (typeof document === 'undefined' || !document.createElement) return false;
      var c = document.createElement('canvas');
      c.width = this.fw; c.height = this.fh;
      var c2 = c.getContext('2d');
      if (!c2) return false;
      this._off = c; this._offCtx = c2;
      this._img = c2.createImageData(this.fw, this.fh);
      return true;
    } catch (e) { return false; }
  };
  Field.prototype.draw = function (ctx, nowMs, reduced) {
    this.render(!!reduced);                 // 像素始终计算（供测试读取），与能否贴图无关
    if (!ctx) return;
    // 环境若不支持离屏 canvas 或 createImageData（如 jsdom 测试桩）→ 优雅降级不贴图
    if (!this._ensureOff() || !this._img) return;
    try {
      this._img.data.set(this.buf);
      this._offCtx.putImageData(this._img, 0, 0);
      var prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this._off, 0, 0, this.w, this.h);
      ctx.imageSmoothingEnabled = prev;
    } catch (e) { /* 目标上下文不支持 drawImage/putImageData → 静默跳过 */ }
  };
  // 供测试读取真实像素（不依赖 canvas）
  Field.prototype.pixels = function () { return this.buf; };
  Field.prototype.fieldSize = function () { return { w: this.fw, h: this.fh }; };

  window.ShiNianClouds = {
    create: function (opts) { return new Field(opts); },
    tintAt: tintAt,
    densityFromWeather: densityFromWeather,
    weatherProfile: weatherProfile,
    cloudMode: cloudMode,
    config: function (opts) { return detectQuality(opts); },
    fireAmount: fireAmount,
    shapeAt: shapeAt,
    Noise: { fbm: fbm, vnoise: vnoise, hash2: hash2 }
  };
})();
