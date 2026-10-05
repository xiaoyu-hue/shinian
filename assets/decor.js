/*
 * 时念 · 季节彩蛋层 (v0.5.5)
 * 职责：在正确季节，于天空随机浮现一次应景彩蛋（春樱/夏萤/秋叶/冬极光）。
 * 规则（PLAN-v0.5.5）：
 *   - 触发：每次进入按 30% 概率触发，持续 20–40s 后淡出，同会话冷却 2 分钟
 *   - 时段：樱花/黄叶限白天与黄昏(7:00–19:00)；萤火虫/极光限夜间
 *   - 天气：rain/drizzle/snow/thunderstorm 时抑制飘落类彩蛋
 *   - 降级：data-no-motion / data-low-perf / 设置开关 / 页面不可见 均不触发或立即停止
 * 调试：?decor=sakura|firefly|leaf|aurora|off 强制效果或关闭
 */
(function () {
  'use strict';
  var w = window;
  var doc = w.document;

  var CONF = {
    chance: 0.30,      // 触发概率
    minDur: 20000,     // 最短持续
    maxDur: 40000,     // 最长持续
    fadeIn: 1500,      // 淡入
    fadeOut: 2500,     // 淡出
    cooldown: 120000,  // 同会话冷却
    retry: 300000      // 未触发时的重试间隔
  };

  var WET = { rain: 1, drizzle: 1, snow: 1, thunderstorm: 1 };

  /* ---------- 春樱效果器 ---------- */
  var sakura = {
    name: 'sakura',
    when: 'day',       // 白天与黄昏
    falling: true,     // 飘落类（受天气抑制）
    count: 30,
    spawn: function (init) {
      return {
        x: Math.random() * W,
        y: init ? Math.random() * H : -20 - Math.random() * 60,
        vy: 18 + Math.random() * 26,
        vx: -8 + Math.random() * 16,
        size: 5 + Math.random() * 5,
        angle: Math.random() * Math.PI * 2,
        spin: -0.6 + Math.random() * 1.2,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.6 + Math.random() * 0.8,
        alpha: 0.55 + Math.random() * 0.35
      };
    },
    init: function () {
      var ps = [];
      for (var i = 0; i < this.count; i++) ps.push(this.spawn(true));
      return ps;
    },
    draw: function (ps, dt, t, ga) {
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(t * p.swaySpeed + p.sway) * 12) * dt;
        p.angle += p.spin * dt;
        if (p.y > H + 20) { ps[i] = this.spawn(false); continue; }
        if (p.x < -30) p.x = W + 20;
        else if (p.x > W + 30) p.x = -20;

        var a = p.alpha * ga;
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#ffd3e0';
        var s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.75, -s * 0.2, 0, s);
        ctx.quadraticCurveTo(-s * 0.75, -s * 0.2, 0, -s);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  /* ---------- 夏 · 萤火虫（夜间，随机游走 + 呼吸明灭） ---------- */
  var firefly = {
    name: 'firefly',
    when: 'night',
    falling: false,        // 非飘落类，不受雨雪天气抑制
    count: 20,
    spawn: function () {
      return {
        x: Math.random() * W,
        y: H * (0.25 + Math.random() * 0.7),
        vx: -10 + Math.random() * 20,
        vy: -8 + Math.random() * 16,
        size: 1.4 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        blink: 0.7 + Math.random() * 1.1,
        base: 0.35 + Math.random() * 0.45
      };
    },
    init: function () {
      var ps = [];
      for (var i = 0; i < this.count; i++) ps.push(this.spawn());
      return ps;
    },
    draw: function (ps, dt, t, ga) {
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        // 随机游走：持续小幅扰动 + 限速，避免机械直线
        p.vx += (Math.random() - 0.5) * 26 * dt;
        p.vy += (Math.random() - 0.5) * 26 * dt;
        if (p.vx > 20) p.vx = 20; else if (p.vx < -20) p.vx = -20;
        if (p.vy > 16) p.vy = 16; else if (p.vy < -16) p.vy = -16;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // 软反弹回场内
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        else if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
        if (p.y < H * 0.1) { p.y = H * 0.1; p.vy = Math.abs(p.vy); }
        else if (p.y > H * 0.95) { p.y = H * 0.95; p.vy = -Math.abs(p.vy); }

        var blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * p.blink + p.phase));
        var a = p.base * blink * ga;
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a * 0.30;                       // 外层柔光
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.4, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = a;                              // 内核亮点
        ctx.fillStyle = '#fffbd6';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
        ctx.restore();
      }
    }
  };

  /* ---------- 秋 · 黄叶（白天，翻转 + 琥珀色泽） ---------- */
  var leaf = {
    name: 'leaf',
    when: 'day',
    falling: true,
    count: 25,
    colors: ['#d9a25a', '#c8863c', '#b8712f', '#e0b070', '#cf9b4e'],
    spawn: function (init) {
      return {
        x: Math.random() * W,
        y: init ? Math.random() * H : -20 - Math.random() * 60,
        vy: 22 + Math.random() * 30,
        vx: -10 + Math.random() * 20,
        size: 6 + Math.random() * 6,
        angle: Math.random() * Math.PI * 2,
        spin: -0.5 + Math.random() * 1.0,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 1.0 + Math.random() * 1.6,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.5 + Math.random() * 0.7,
        alpha: 0.6 + Math.random() * 0.3,
        color: this.colors[(Math.random() * this.colors.length) | 0]
      };
    },
    init: function () {
      var ps = [];
      for (var i = 0; i < this.count; i++) ps.push(this.spawn(true));
      return ps;
    },
    draw: function (ps, dt, t, ga) {
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(t * p.swaySpeed + p.sway) * 16) * dt;
        p.angle += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        if (p.y > H + 24) { ps[i] = this.spawn(false); continue; }
        if (p.x < -32) p.x = W + 20;
        else if (p.x > W + 32) p.x = -20;

        var a = p.alpha * ga;
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.flip))));  // 翻转出正反面
        ctx.fillStyle = p.color;
        var s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.55, 0, 0, s);
        ctx.quadraticCurveTo(-s * 0.55, 0, 0, -s);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  /* ---------- 冬 · 极光（夜间，流动渐变光带） ---------- */
  var aurora = {
    name: 'aurora',
    when: 'night',
    falling: false,
    count: 5,
    init: function () {
      var bs = [];
      for (var i = 0; i < this.count; i++) {
        bs.push({
          y: H * (0.10 + Math.random() * 0.24),
          thick: 40 + Math.random() * 70,
          amp: 16 + Math.random() * 30,
          freq: 0.0035 + Math.random() * 0.005,
          speed: 0.10 + Math.random() * 0.20,
          phase: Math.random() * Math.PI * 2,
          hue: 135 + Math.random() * 75,      // 青绿 → 紫
          alpha: 0.10 + Math.random() * 0.14
        });
      }
      return bs;
    },
    draw: function (bs, dt, t, ga) {
      var step = 14, x, y;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';   // 叠加发光
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        var a = b.alpha * ga;
        if (a <= 0) continue;
        ctx.beginPath();
        for (x = 0; x <= W; x += step) {          // 上边界
          y = b.y + Math.sin(x * b.freq + t * b.speed + b.phase) * b.amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (x = W; x >= 0; x -= step) {          // 下边界回程
          y = b.y + Math.sin(x * b.freq + t * b.speed + b.phase) * b.amp + b.thick;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        var g = ctx.createLinearGradient(0, b.y - 20, 0, b.y + b.thick + 20);
        if (!g) continue;
        g.addColorStop(0, 'hsla(' + b.hue + ',85%,62%,0)');
        g.addColorStop(0.45, 'hsla(' + b.hue + ',85%,62%,' + a + ')');
        g.addColorStop(1, 'hsla(' + b.hue + ',85%,55%,0)');
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // 季节 → 效果器
  var EFFECTS = { spring: sakura, summer: firefly, autumn: leaf, winter: aurora };
  // 名字 → 效果器（供 ?decor= 调试）
  var BY_NAME = { sakura: sakura, firefly: firefly, leaf: leaf, aurora: aurora };

  var canvas = null, ctx = null, dpr = 1, W = 0, H = 0;
  var raf = null, running = false;
  var cur = null, state = null;
  var enabled = true, lastEnd = 0, lastT = 0;

  function root() { return doc.documentElement; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- 判定（纯函数，供单测） ---------- */
  function isDay(h) { return h >= 7 && h < 19; }

  function timeOK(eff, h) {
    if (!eff || !eff.when) return false;
    if (eff.when === 'day') return isDay(h);
    if (eff.when === 'night') return !isDay(h);
    return true;
  }

  function weatherOK(eff, wt) {
    if (eff && eff.falling && WET[wt]) return false;
    return true;
  }

  function guardsPass(s, h, wt, opts) {
    opts = opts || {};
    var eff = EFFECTS[s];
    if (!eff) return false;
    if (opts.noMotion) return false;
    if (opts.lowPerf) return false;
    if (opts.noDecor) return false;   // 复用已有「天空装饰层」开关
    if (opts.disabled) return false;
    if (!timeOK(eff, h)) return false;
    if (!weatherOK(eff, wt)) return false;
    return true;
  }

  /* ---------- 运行环境 ---------- */
  function season() {
    var s = root().getAttribute('data-season');
    if (s) return s;
    return (w.ShiNianSeason && w.ShiNianSeason.current) ? w.ShiNianSeason.current() : null;
  }

  function hours() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  function weather() { return root().getAttribute('data-weather') || ''; }

  function debug() {
    try {
      var v = new URLSearchParams(w.location.search).get('decor');
      if (!v) return null;
      v = v.toLowerCase();
      return (v === 'off' || BY_NAME[v] || EFFECTS[v]) ? v : null;
    } catch (e) { return null; }
  }

  function setup() {
    if (canvas) return canvas;
    canvas = doc.getElementById('decorCanvas');
    if (!canvas) {
      canvas = doc.createElement('canvas');
      canvas.className = 'decor-canvas';
      canvas.id = 'decorCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      var sky = doc.querySelector('.sky') || doc.body;
      sky.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    if (!ctx) { canvas = null; return null; }   // 环境不支持 2d 上下文，静默放弃
    resize();
    w.addEventListener('resize', resize);
    return canvas;
  }

  function resize() {
    if (!canvas || !ctx) return;
    dpr = Math.min(w.devicePixelRatio || 1, 2); // 上限 2，避免 3x 屏过度绘制
    W = w.innerWidth; H = w.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cancel() { if (raf) { w.cancelAnimationFrame(raf); raf = null; } }

  /* ---------- 生命周期 ---------- */
  function start(eff) {
    if (!eff) return;
    if (!setup()) return;
    cur = eff;
    state = { t0: (w.performance && w.performance.now) ? w.performance.now() : Date.now(),
              dur: rand(CONF.minDur, CONF.maxDur), ps: eff.init() };
    running = true;
    lastT = state.t0;
    cancel();
    raf = w.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancel();
    if (ctx) ctx.clearRect(0, 0, W, H);
    state = null; cur = null;
    lastEnd = Date.now();
  }

  function loop(now) {
    if (!running || !state || !cur) return;
    var dt = (now - lastT) / 1000;
    if (dt > 0.05) dt = 0.05;   // 卡顿/切后台时钳制，避免粒子瞬移
    lastT = now;
    var el = now - state.t0;
    var ga = 1;
    if (el < CONF.fadeIn) ga = el / CONF.fadeIn;
    else if (el > state.dur - CONF.fadeOut) ga = Math.max(0, (state.dur - el) / CONF.fadeOut);

    ctx.clearRect(0, 0, W, H);
    cur.draw(state.ps, dt, el / 1000, ga);

    if (el >= state.dur) { stop(); return; }
    raf = w.requestAnimationFrame(loop);
  }

  function maybeTrigger() {
    if (running) return;
    var forced = debug();
    if (forced === 'off') return;

    var opts = {
      noMotion: root().hasAttribute('data-no-motion'),
      lowPerf: root().hasAttribute('data-low-perf'),
      noDecor: root().hasAttribute('data-no-decor'),
      disabled: !enabled
    };

    if (forced) {
      // 强制调试：跳过概率，但仍遵守降级守卫
      if (opts.noMotion || opts.lowPerf || opts.noDecor || opts.disabled) return;
      start(BY_NAME[forced] || EFFECTS[forced]);
      return;
    }

    if (Date.now() - lastEnd < CONF.cooldown) return;
    var s = season(), h = hours(), wt = weather();
    if (!guardsPass(s, h, wt, opts)) return;
    if (Math.random() > CONF.chance) return;
    start(EFFECTS[s]);
  }

  function boot() {
    setup();
    maybeTrigger();
    setInterval(maybeTrigger, CONF.retry);   // 未命中概率时定期重试
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden && running) stop();     // 页面不可见立即停止，不空耗 GPU
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  w.ShiNianDecor = {
    maybeTrigger: maybeTrigger,
    start: start,
    stop: stop,
    setEnabled: function (v) { enabled = !!v; if (!v && running) stop(); },
    EFFECTS: EFFECTS,
    _test: { guardsPass: guardsPass, timeOK: timeOK, weatherOK: weatherOK, isDay: isDay, CONF: CONF }
  };
})();
