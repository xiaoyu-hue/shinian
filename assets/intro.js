/* 时念 · 开场引擎（v0.6.4）
   - canvas 分层辉光星场：底层细星呼吸闪烁 + 少量亮星带柔光晕
   - 多颗流星：渐变拖尾 + 头部辉光，错峰划过，沿用现有冷蓝白基调（不改动配色体系）
   - DPR 钳制≤2、resize 重建、prefers-reduced-motion 直绘静态星无流星
   - 无 2D 上下文（旧浏览器 / jsdom）时降级为 no-op，仍回调 onDone，保证开场不卡死
   - 仅服务 #splash 开场动画，不触碰主界面 / 装饰层 / 配色变量 */
(function () {
  'use strict';
  var ShiNianIntro = {
    _raf: 0,
    _ctx: null,
    _canvas: null,
    _stars: [],
    _meteors: [],
    _t0: 0,
    _w: 0,
    _h: 0,
    _dpr: 1,
    _reduce: false,
    _stopped: false,
    _onDone: null,
    _onResize: null,

    start: function (canvas, opts) {
      opts = opts || {};
      this._canvas = canvas;
      this._reduce = !!opts.reduce;
      this._onDone = (typeof opts.onDone === 'function') ? opts.onDone : null;
      this._stopped = false;
      this._done = false;          // 允许重复 start（如测试复用单例）时正确重新收场
      if (!canvas || !canvas.getContext) { this._finish(); return; }
      this._ctx = canvas.getContext('2d');
      if (!this._ctx) { this._finish(); return; }   // 降级：无 canvas 支持也能正常结束开场

      this._resize();
      this._build();
      var self = this;
      this._onResize = function () { self._resize(); self._build(); };
      window.addEventListener('resize', this._onResize);

      this._t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      if (this._reduce) {
        this._draw();                 // 静态绘制一帧（无闪烁、无流星）
        setTimeout(function () { self._finish(); }, 260);
        return;
      }

      // 错峰划过 3 颗流星，最后一颗收尾后收场
      var delays = [360, 980, 1640];
      delays.forEach(function (d, i) { setTimeout(function () { self._spawnMeteor(i); }, d); });
      setTimeout(function () { self._finish(); }, 2700);

      this._loop();
    },

    _resize: function () {
      var c = this._canvas;
      if (!c) return;
      var dpr = Math.min((window.devicePixelRatio || 1), 2);
      var w = c.clientWidth || window.innerWidth || 360;
      var h = c.clientHeight || window.innerHeight || 640;
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._w = w; this._h = h; this._dpr = dpr;
    },

    _build: function () {
      var n = (this._w >= 680) ? 150 : 92;
      this._stars = [];
      for (var i = 0; i < n; i++) {
        var big = Math.random() < 0.12;
        this._stars.push({
          x: Math.random() * this._w,
          y: Math.random() * this._h * 0.94,
          r: big ? (1.7 + Math.random() * 1.1) : (0.5 + Math.random() * 1.2),
          glow: big,
          ph: Math.random() * Math.PI * 2,
          sp: 0.5 + Math.random() * 1.6
        });
      }
    },

    _spawnMeteor: function () {
      if (this._stopped) return;
      var w = this._w, h = this._h;
      var startX = w * (0.05 + Math.random() * 0.55);
      var startY = h * (0.0 + Math.random() * 0.22);
      var ang = (16 + Math.random() * 12) * Math.PI / 180;   // 向右下俯冲
      var vx = Math.cos(ang), vy = Math.sin(ang);
      this._meteors.push({
        sx: startX, sy: startY, vx: vx, vy: vy,
        travel: Math.hypot(w, h) * 0.55,
        len: 150 + Math.random() * 130,
        t0: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
        dur: 720 + Math.random() * 360
      });
    },

    _loop: function () {
      if (this._stopped) return;
      var self = this;
      this._raf = requestAnimationFrame(function () { self._frame(); });
    },

    _frame: function () {
      if (this._stopped) return;
      this._draw();
      this._loop();
    },

    _draw: function () {
      var ctx = this._ctx, w = this._w, h = this._h;
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var t = now - this._t0;
      ctx.clearRect(0, 0, w, h);

      // 星场
      for (var i = 0; i < this._stars.length; i++) {
        var s = this._stars[i];
        var tw = this._reduce ? 0.85 : (0.5 + 0.5 * Math.sin(t * 0.0022 * s.sp + s.ph));
        if (s.glow) {
          var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4.5);
          g.addColorStop(0, 'rgba(228,242,255,' + (0.9 * tw).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(228,242,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(228,242,255,' + tw.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }

      // 流星
      for (var j = this._meteors.length - 1; j >= 0; j--) {
        var m = this._meteors[j];
        var p = (now - m.t0) / m.dur;
        if (p >= 1) { this._meteors.splice(j, 1); continue; }
        var fade = (p < 0.15) ? (p / 0.15) : (p > 0.85 ? (1 - (p - 0.85) / 0.15) : 1);
        var dist = m.travel * Math.min(p, 1);
        var hx = m.sx + m.vx * dist, hy = m.sy + m.vy * dist;
        var tx = hx - m.vx * m.len, ty = hy - m.vy * m.len;
        var a = fade;
        var grad = ctx.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0, 'rgba(255,255,255,' + (0.95 * a).toFixed(3) + ')');
        grad.addColorStop(0.25, 'rgba(182,216,255,' + (0.8 * a).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(120,170,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
        var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7);
        hg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a).toFixed(3) + ')');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
      }
    },

    _finish: function () {
      if (this._done) return; this._done = true;
      if (this._onDone) this._onDone();
    },

    stop: function () {
      this._stopped = true;
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      this._ctx = null; this._canvas = null;
    }
  };

  // 兼容两种调用名
  window.ShiNianIntro = ShiNianIntro;
})();
