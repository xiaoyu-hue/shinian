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
    retry: 300000,     // 未触发时的重试间隔
    ambientCheck: 60000 // 常驻效果：时段与守卫检查间隔（天亮即停）
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

  /* ---------- 常驻 · 流星（任何季节的夜间，间歇划过） ---------- */
  var meteor = {
    name: 'meteor',
    mode: 'persistent',    // 常驻：不按季节触发，夜间持续调度
    when: 'night',
    falling: false,
    gapMin: 40000,         // 间隔 40–90s（用户确认）
    gapMax: 90000,
    life: 1.2,             // 单颗寿命（秒）
    spawn: function () {
      var dir = Math.random() < 0.5 ? 1 : -1;
      var ang = 0.30 + Math.random() * 0.35;                 // 与水平夹角
      var speed = (0.55 + Math.random() * 0.45) * Math.min(W, H);
      return {
        x: W * (0.15 + Math.random() * 0.85),
        y: H * (0.02 + Math.random() * 0.30),
        vx: Math.cos(ang) * speed * dir,
        vy: Math.sin(ang) * speed,
        tail: 0.10 + Math.random() * 0.10,
        age: 0,
        life: this.life * (0.8 + Math.random() * 0.5),
        width: 1.2 + Math.random() * 1.1
      };
    },
    // 单颗更新与绘制；返回 false 表示已结束
    step: function (m, dt, c) {
      m.age += dt;
      if (m.age >= m.life) return false;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      var k = m.age / m.life;
      var a = k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85);  // 快淡入、慢淡出
      if (a <= 0) return true;
      var tx = m.x - m.vx * m.tail, ty = m.y - m.vy * m.tail;
      var g = c.createLinearGradient(m.x, m.y, tx, ty);
      if (g) {
        g.addColorStop(0, 'rgba(255,255,255,' + (a * 0.95) + ')');
        g.addColorStop(0.35, 'rgba(255,255,255,' + (a * 0.35) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = g;
        c.lineWidth = m.width;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(m.x, m.y);
        c.lineTo(tx, ty);
        c.stroke();
      }
      c.globalAlpha = a;                                      // 头部亮点
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(m.x, m.y, m.width * 1.1, 0, 6.2832);
      c.fill();
      c.globalAlpha = 1;
      return true;
    }
  };

  // 季节 → 效果器
  var EFFECTS = { spring: sakura, summer: firefly, autumn: leaf, winter: aurora };
  // 名字 → 效果器（供 ?decor= 调试）
  var BY_NAME = { sakura: sakura, firefly: firefly, leaf: leaf, aurora: aurora, meteor: meteor };
  // 常驻环境效果：不按季节，满足条件即长期运行
  var AMBIENT = [meteor];

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
    bindMeteorClick();
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

  // 点击划过的流星 → 触发回调（由 app.js 设置为「展开许愿池并聚焦」）
  // 修复（v0.7.6）：decorCanvas 位于 #sky 内（z-index:-1，处于前景内容之下），画布自身永远收不到点击，
  // 原 canvas 级监听形同虚设。改为在 window 级监听，流星活动态时按视口坐标就近判定，命中即触发彩蛋。
  // 仅当点击落在非交互控件（button/input/textarea/select/a）上才跳过，避免劫持表单/按钮等真实交互。
  function bindMeteorClick() {
    if (!w || !w.addEventListener) return;
    w.addEventListener('click', function (ev) {
      if (!ambient || !ambient.list || !ambient.list.length) return;
      if (ev.target && ev.target.closest &&
          ev.target.closest('button, input, textarea, select, a')) return;
      var x = ev.clientX, y = ev.clientY;          // 画布 inset:0 满视口，m.x/m.y 即视口坐标
      for (var i = 0; i < ambient.list.length; i++) {
        var m = ambient.list[i];
        var dx = m.x - x, dy = m.y - y;
        if (dx * dx + dy * dy <= 4900) {           // 70px 容差（v0.7.3 由 50px 放宽，便于手指点中「点流星许愿」彩蛋）
          if (w.ShiNianDecor && typeof w.ShiNianDecor.onMeteorClick === 'function') {
            w.ShiNianDecor.onMeteorClick();
          }
          return;
        }
      }
    });
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
      if (forced === 'meteor') { ambientOnce(); return; }
      start(BY_NAME[forced] || EFFECTS[forced]);
      return;
    }

    if (Date.now() - lastEnd < CONF.cooldown) return;
    var s = season(), h = hours(), wt = weather();
    if (!guardsPass(s, h, wt, opts)) return;
    if (Math.random() > CONF.chance) return;
    start(EFFECTS[s]);
  }

  /* ---------- 常驻效果调度（setTimeout 排期 + 按需唤醒 rAF） ---------- */
  var ambient = null;   // { eff, list, raf, timer, lastT }

  // 流星配置（v0.7.3）：读 :root[data-meteor] 与 :root[data-meteor-gap]
  //   data-meteor: off=关闭流星 / real=真实节奏 / custom=按自定义间隔
  //   data-meteor-gap: 自定义间隔秒数（5~300）
  // 真实档沿用 40–90 秒；自定义档以设定值为中心 ±30% 抖动——
  // 既不机械（保住「偶遇」的灵魂），又可预期（便于配合「点流星许愿」彩蛋）。
  var METEOR_REAL = [40000, 90000];
  function meteorCfg() {
    var v = root().getAttribute('data-meteor');
    if (v === 'off') return { on: false, gapMin: METEOR_REAL[0], gapMax: METEOR_REAL[1] };
    var raw = +root().getAttribute('data-meteor-gap');
    if (v === 'custom' && raw > 0) {
      var ms = Math.max(5, Math.min(300, raw)) * 1000;
      return { on: true, gapMin: ms * 0.7, gapMax: ms * 1.3 };
    }
    return { on: true, gapMin: METEOR_REAL[0], gapMax: METEOR_REAL[1] };
  }

  function ambientAllowed() {
    var r = root();
    if (r.hasAttribute('data-no-motion')) return false;
    if (r.hasAttribute('data-low-perf')) return false;
    if (r.hasAttribute('data-no-decor')) return false;
    if (!enabled) return false;
    if (!meteorCfg().on) return false;      // v0.7.3 流星独立开关
    return !isDay(hours());          // 仅夜间
  }

  function stopAmbient() {
    if (!ambient) return;
    if (ambient.raf) w.cancelAnimationFrame(ambient.raf);
    if (ambient.timer) clearTimeout(ambient.timer);
    ambient = null;
    if (ctx && !running) ctx.clearRect(0, 0, W, H);
  }

  // 调试 ?decor=meteor 时缩短间隔，便于验收
  function gapFor(e) {
    var f = debug();
    if (f === 'meteor') return [1500, 4000];
    var mc = meteorCfg();
    // v0.7.3 首颗提前：进夜间后 8~15 秒先来一颗，保证「必遇一次」，之后回到设定节奏
    if (!firstMeteorDone) return [8000, 15000];
    return [mc.gapMin, mc.gapMax];
  }
  var firstMeteorDone = false;

  function scheduleNext() {
    if (!ambient) return;
    var g = gapFor(ambient.eff);
    ambient.timer = setTimeout(function () {
      if (!ambient || !ambientAllowed()) return;
      firstMeteorDone = true;                              // 首颗已出，后续按设定节奏
      ambient.list = [ambient.eff.spawn()];
      if (canvas) canvas.style.pointerEvents = 'auto';   // 流星出现才接收点击
      ambient.raf = w.requestAnimationFrame(ambientLoop);
    }, rand(g[0], g[1]));
  }

  function ambientLoop(now) {
    if (!ambient) return;
    if (!ctx) { stopAmbient(); return; }
    var dt = ambient.lastT ? Math.min((now - ambient.lastT) / 1000, 0.05) : 0.016;
    ambient.lastT = now;

    ctx.clearRect(0, 0, W, H);
    var alive = [], i;
    for (i = 0; i < ambient.list.length; i++) {
      if (ambient.eff.step(ambient.list[i], dt, ctx)) alive.push(ambient.list[i]);
    }
    ambient.list = alive;

    if (!alive.length) {
      // 本轮结束：停掉 rAF，回到 setTimeout 等待（空闲期零绘制、零耗电）
      ambient.raf = null;
      ambient.lastT = 0;
      ctx.clearRect(0, 0, W, H);
      if (canvas) canvas.style.pointerEvents = 'none';   // 结束后立即收回
      scheduleNext();
      return;
    }
    ambient.raf = w.requestAnimationFrame(ambientLoop);
  }

  function tickAmbient() {
    if (!ambientAllowed()) { stopAmbient(); return; }
    if (!ambient) {
      if (!setup()) return;
      ambient = { eff: AMBIENT[0], list: [], raf: null, timer: null, lastT: 0 };
      scheduleNext();
    }
  }

  // 调试：立即来一颗
  function ambientOnce() {
    if (!setup()) return;
    stopAmbient();
    ambient = { eff: meteor, list: [meteor.spawn()], raf: null, timer: null, lastT: 0 };
    ambient.raf = w.requestAnimationFrame(ambientLoop);
  }

  function boot() {
    setup();
    maybeTrigger();
    // v0.7.3：设置面板改流星开关/间隔 → 立即按新节奏重排
    w.addEventListener('meteorModeChange', function () {
      firstMeteorDone = false;
      stopAmbient();
      tickAmbient();
    });
    setInterval(maybeTrigger, CONF.retry);   // 未命中概率时定期重试
    tickAmbient();                                  // 常驻：夜间启动流星
    setInterval(tickAmbient, CONF.ambientCheck);    // 每分钟复查时段与守卫，天亮即停
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { if (running) stop(); stopAmbient(); }   // 不可见立即停止
      else { maybeTrigger(); tickAmbient(); }                   // 回到前台再试
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
    setEnabled: function (v) {
      enabled = !!v;
      if (!v) { if (running) stop(); stopAmbient(); }
    },
    EFFECTS: EFFECTS,
    AMBIENT: AMBIENT,
    METEOR: meteor,
    tickAmbient: tickAmbient,
    stopAmbient: stopAmbient,
    ambientOnce: ambientOnce,
    _test: {
      guardsPass: guardsPass, timeOK: timeOK, weatherOK: weatherOK, isDay: isDay,
      CONF: CONF, meteor: meteor, ambientAllowed: ambientAllowed, gapFor: gapFor,
      meteorCfg: meteorCfg,
      isMeteorFirstDone: function () { return firstMeteorDone; }
    }
  };
})();
