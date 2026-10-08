/* 时念 · 日月引擎（v0.7.0 M5）
   ------------------------------------------------------------
   职责：
     1) 按真实天文计算太阳/月亮的高度角(altitude)与方位角(azimuth) → 东升西落轨迹
     2) 月相盈亏（新月/上弦/满月/下弦）→ 画真实月形
     3) 日月交替（按各自高度角交叉淡入淡出）
     4) 黄金时刻判定 + 火烧云强度（供云引擎与天色联动）
   数据源：
     - 优先 vendored SunCalc（BSD-2，assets/suncalc.js，基于 Jean Meeus《Astronomical Algorithms》）
     - 缺失时近似兜底（太阳按日出日落弧线插值；月相按朔望月公式）
   图层：画在天空渐变之上、云层之下（云会遮住日月，真实且好看）
   依赖：无强制外部依赖；SunCalc 为可选增强 */
(function () {
  'use strict';

  var lat = 39.9042, lon = 116.4074;      // 默认北京；由 app.js 按所选城市更新
  var last = null, lastAt = 0;
  var CACHE_MS = 30000;                    // 日月位置缓存 30s（移动极慢，无需每帧重算）

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // 月相兜底：朔望月 29.530588853 天，参考新月 2000-01-06 18:14 UTC
  function moonPhaseFallback(date) {
    var synodic = 29.530588853;
    var ref = Date.UTC(2000, 0, 6, 18, 14, 0);
    var days = (date.getTime() - ref) / 86400000;
    var p = (days / synodic) % 1;
    if (p < 0) p += 1;
    return p;
  }

  // 近似兜底：太阳按日出日落弧线（与 clouds.js 同一套锚点）
  function approxSun(date) {
    var h = date.getHours() + date.getMinutes() / 60;
    var sr = 6.3, sh = 18.4;
    var day = (h - sr) / (sh - sr);
    var above = day >= 0 && day <= 1;
    var dc = clamp(day, 0, 1);
    return {
      altitudeDeg: above ? Math.sin(dc * Math.PI) * 62 : -10,
      azimuthDeg: 90 + dc * 180
    };
  }

  function compute(date) {
    var sun, moon;
    if (typeof window !== 'undefined' && window.SunCalc) {
      var sp = window.SunCalc.getPosition(date, lat, lon);
      var mp = window.SunCalc.getMoonPosition(date, lat, lon);
      var mi = window.SunCalc.getMoonIllumination(date);
      sun = { altitudeDeg: deg(sp.altitude), azimuthDeg: deg(sp.azimuth), real: true };
      moon = {
        altitudeDeg: deg(mp.altitude), azimuthDeg: deg(mp.azimuth),
        fraction: mi.fraction, phase: mi.phase, waxing: mi.angle < 0, real: true
      };
    } else {
      sun = approxSun(date);
      sun.real = false;
      var ph = moonPhaseFallback(date);
      moon = {
        altitudeDeg: 0, azimuthDeg: 0,
        fraction: Math.round((1 - Math.cos(ph * 2 * Math.PI)) / 2 * 100) / 100,
        phase: ph, waxing: ph < 0.5, real: false
      };
      // 月亮兜底位置：夜间给一条东升西落的近似弧
      // 方位角采用 SunCalc 约定（0=南，西为正）：升≈-90°（东/画面左），落≈+90°（西/画面右）
      var h = date.getHours() + date.getMinutes() / 60;
      var night = (h < 6.3) ? h + 24 - 18.4 : h - 18.4;   // 日落后的小时数
      var nightLen = Math.max(1, 24 - (18.4 - 6.3));
      if (h >= 18.4 || h < 6.3) {
        var k = clamp(night / nightLen, 0, 1);
        moon.altitudeDeg = Math.sin(k * Math.PI) * 55;
        moon.azimuthDeg = -90 + k * 180;
      } else {
        moon.altitudeDeg = -10;
      }
    }

    // 黄金时刻 + 火烧云强度（太阳高度角 -6°~+8° 之间，峰值约 +2°）
    var alt = sun.altitudeDeg;
    var golden = alt > -6 && alt < 8;
    var fire = Math.pow(Math.max(0, 1 - Math.abs(alt - 2) / 13), 1.25);

    last = {
      sun: sun, moon: moon,
      golden: golden, fire: fire,
      sunVisible: sun.altitudeDeg > -1,
      moonVisible: moon.altitudeDeg > 0.5,
      at: date.getTime()
    };
    lastAt = Date.now();
    return last;
  }

  // 屏幕坐标：方位角按 SunCalc 约定（0=南，西为正）→ 日出(≈-90°)在画面左、日落(≈+90°)在画面右
  //（相当于北半球面向南看天，东在左、西在右）；高度角 0=地平线 90=天顶
  function toScreen(altDeg, azDeg, w, h) {
    var x = (0.5 + 0.5 * Math.sin(rad(azDeg))) * w;
    var horizonY = h * 0.88, topY = h * 0.05;
    var y = horizonY - Math.sin(rad(clamp(altDeg, -10, 90))) * (horizonY - topY);
    return { x: x, y: y };
  }

  function get() {
    var now = Date.now();
    if (!last || now - lastAt > CACHE_MS) compute(new Date());
    return last;
  }

  function setCity(la, lo) {
    if (typeof la === 'number' && typeof lo === 'number') { lat = la; lon = lo; last = null; }
  }

  // ---------- 绘制 ----------
  function drawSun(ctx, x, y, altDeg, w, glowScale) {
    var low = clamp(1 - altDeg / 25, 0, 1);            // 越低越暖越红
    var coreC = 'rgba(' + Math.round(255) + ',' + Math.round(244 - 90 * low) + ',' +
                Math.round(214 - 150 * low) + ',1)';
    var glowR = (70 + 60 * low) * glowScale;           // 接近地平线光晕更大（霞光）
    var g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    g.addColorStop(0, 'rgba(255,240,214,0.55)');
    g.addColorStop(0.4, 'rgba(255,' + Math.round(214 - 70 * low) + ',' + Math.round(160 - 110 * low) + ',0.28)');
    g.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, 6.2832); ctx.fill();

    // v1.1.3：Mie 前向散射大光幕——真实太阳的光晕延伸至很大天区，
    // 低角度时散射更强、光幕更大（大气路径变长的物理结果）
    var mieR = (150 + 130 * low) * glowScale;
    var gm = ctx.createRadialGradient(x, y, 0, x, y, mieR);
    gm.addColorStop(0, 'rgba(255,' + Math.round(225 - 45 * low) + ',' + Math.round(185 - 85 * low) + ',' + (0.10 + 0.10 * low).toFixed(3) + ')');
    gm.addColorStop(0.55, 'rgba(255,' + Math.round(205 - 50 * low) + ',' + Math.round(150 - 80 * low) + ',' + (0.04 + 0.05 * low).toFixed(3) + ')');
    gm.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = gm;
    ctx.beginPath(); ctx.arc(x, y, mieR, 0, 6.2832); ctx.fill();

    var coreR = 15 + 5 * low;
    // v1.1.3：地平线附近大气折射使日面轻微扁化（alt<8° 渐显，压扁至 7%）
    var squash = 1 - 0.07 * clamp(1 - altDeg / 8, 0, 1);
    var g2 = ctx.createRadialGradient(x, y, 0, x, y, coreR * 2.4);
    g2.addColorStop(0, coreC);
    g2.addColorStop(0.5, coreC.replace(',1)', ',0.85)'));
    g2.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = g2;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, squash); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, coreR * 2.4, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  // v1.1.3：月面「月海」暗斑表（归一化坐标，对应真实月面雨海/静海/危海等大势布局，
  // 固定值保证每帧一致；绘制在亮面 clip 内，只在受光区可见）
  var MARIA = [
    [-0.28, -0.30, 0.34, 0.16], [0.18, -0.34, 0.26, 0.13], [0.42, 0.05, 0.20, 0.11],
    [-0.10, 0.28, 0.24, 0.10], [0.05, -0.02, 0.16, 0.09]
  ];
  function drawMoon(ctx, x, y, r, phase, waxing, alpha, altDeg) {
    var altK = clamp(1 - (altDeg || 30) / 18, 0, 1);  // 越近地平线越暖（大气消光）
    var brightC = 'rgb(' + Math.round(242 + 13 * altK) + ',' + Math.round(246 - 12 * altK) + ',' + Math.round(255 - 42 * altK) + ')';
    ctx.save();
    // 柔光晕
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, 'rgba(226,236,255,0.30)');
    g.addColorStop(1, 'rgba(226,236,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 6.2832); ctx.fill();
    // 暗面底盘（隐约可见）；v1.1.3：细月牙时「地照」增强——地球反光照亮月暗面
    var crescent = clamp((phase - 0.78) / 0.22, 0, 1) + clamp((0.22 - phase) / 0.22, 0, 1);
    ctx.globalAlpha = alpha * (0.30 + 0.16 * crescent);
    ctx.fillStyle = '#b9c6dd';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    // 亮面（真实盈亏：半圆 + 终结线椭圆）
    var e = Math.cos(phase * 2 * Math.PI);            // 1 新月 .. -1 满月
    ctx.globalAlpha = alpha;
    ctx.fillStyle = brightC;
    ctx.beginPath();
    if (waxing) {
      ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);                       // 右半圆
      ctx.ellipse(x, y, Math.abs(e) * r, r, 0, Math.PI / 2, -Math.PI / 2, e > 0);
    } else {
      ctx.arc(x, y, r, Math.PI / 2, -Math.PI / 2, false);                       // 左半圆
      ctx.ellipse(x, y, Math.abs(e) * r, r, 0, -Math.PI / 2, Math.PI / 2, e > 0);
    }
    ctx.closePath(); ctx.fill();
    // v1.1.3：月海暗斑——clip 到亮面路径内绘制，只在受光区可见、形状不越界
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(96,108,128,1)';
    for (var mi = 0; mi < MARIA.length; mi++) {
      var m = MARIA[mi];
      ctx.globalAlpha = alpha * m[3];
      ctx.beginPath(); ctx.arc(x + m[0] * r, y + m[1] * r, m[2] * r, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  function draw(ctx, w, h) {
    if (!ctx) return;
    var st = get();
    // 1) 太阳（含近地平线霞光）
    if (st.sunVisible) {
      var sp = toScreen(st.sun.altitudeDeg, st.sun.azimuthDeg, w, h);
      var low = clamp(1 - st.sun.altitudeDeg / 25, 0, 1);
      if (st.golden) {
        // 黄金时刻：地平线附近铺一层暖霞
        var hg = ctx.createLinearGradient(0, h * 0.45, 0, h);
        hg.addColorStop(0, 'rgba(255,' + Math.round(190 - 60 * low) + ',' +
                          Math.round(130 - 90 * low) + ',0)');
        hg.addColorStop(1, 'rgba(255,' + Math.round(160 - 40 * low) + ',' +
                          Math.round(100 - 70 * low) + ',' + (0.16 + 0.12 * low).toFixed(3) + ')');
        ctx.fillStyle = hg;
        ctx.fillRect(0, h * 0.45, w, h * 0.55);
      }
      drawSun(ctx, sp.x, sp.y, st.sun.altitudeDeg, w, 1);
    }
    // 2) 月亮（与太阳按高度角自然交替：太阳落下后月亮显形）
    if (st.moonVisible) {
      var mp = toScreen(st.moon.altitudeDeg, st.moon.azimuthDeg, w, h);
      // 日月交替：太阳在地平线上时月亮淡出
      var cross = clamp(1 - (st.sun.altitudeDeg + 4) / 10, 0, 1);
      drawMoon(ctx, mp.x, mp.y, 17, st.moon.phase, st.moon.waxing,
               cross * clamp(st.moon.altitudeDeg / 12, 0.3, 1), st.moon.altitudeDeg);
    }
  }

  window.ShiNianSunMoon = {
    get: get,
    setCity: setCity,
    draw: draw,
    toScreen: toScreen,
    _compute: compute
  };
})();
