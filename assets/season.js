/*
 * 时念 · 季节层 (v0.5)
 * 职责：1) 按"四立"精确日期判定季节；2) 对天空插值色做低强度季节染色；
 *       3) 季节切换前后各 7 天做加权混合，实现平滑过渡。
 * 依赖：可选 lunar-javascript（浏览器全局 window.Solar / window.Lunar）。
 *       缺失时用公历月份近似（3–5春/6–8夏/9–10秋/其余冬），不做过渡。
 * 接入：sky.js 的 paint() 在写 CSS 变量前调用 ShiNianSeason.filter()。
 * 调试：?season=spring|summer|autumn|winter|off 强制季节或关闭染色。
 */
(function () {
  'use strict';
  var w = (typeof window !== 'undefined') ? window
        : (typeof global !== 'undefined') ? global
        : this;

  // 四立候选日期：每年节气落在固定几天内（已用 lunar-javascript 2024–2030 验证）
  // 用反查法而非农历年语义，避免跨年错配 bug
  var CANDIDATES = {
    '立春': [[2, 3], [2, 4], [2, 5]],
    '立夏': [[5, 5], [5, 6], [5, 7]],
    '立秋': [[8, 7], [8, 8], [8, 9]],
    '立冬': [[11, 7], [11, 8]]
  };

  // 季节染色目标色（PRD 设计表）：春樱 / 夏青 / 秋琥珀 / 冬青灰
  var TINTS = {
    spring: [255, 183, 197],
    summer: [126, 214, 199],
    autumn: [217, 162, 90],
    winter: [176, 186, 195]
  };
  var ALPHA = 0.14;        // 染色强度：可感知但不喧宾夺主
  var DESAT_WINTER = 0.12; // 冬季额外降饱和（偏冷灰）
  var FADE_DAYS = 7;       // 季节切换过渡窗口（天）
  var DAY = 86400000;

  // 返回该公历年某节气的 Date；库缺失或查不到返回 null
  function getJieQiDate(year, name) {
    if (!w.Solar) return null;
    var cands = CANDIDATES[name];
    for (var i = 0; i < cands.length; i++) {
      var mo = cands[i][0], da = cands[i][1];
      var s = w.Solar.fromYmd(year, mo, da);
      if (s && s.getLunar && s.getLunar().getJieQi() === name) {
        return new Date(year, mo - 1, da);
      }
    }
    return null;
  }

  // 返回 'spring' | 'summer' | 'autumn' | 'winter'
  // 边界规则：含起点（立春当天算春）；年初立春前属上一年的冬
  function current(date) {
    date = date || new Date();
    var year = date.getFullYear();

    if (w.Solar) {
      var lc = getJieQiDate(year, '立春');
      var lx = getJieQiDate(year, '立夏');
      var lq = getJieQiDate(year, '立秋');
      var ld = getJieQiDate(year, '立冬');
      if (lc && lx && lq && ld) {
        var t = date.getTime();
        if (t >= lc.getTime() && t < lx.getTime()) return 'spring';
        if (t >= lx.getTime() && t < lq.getTime()) return 'summer';
        if (t >= lq.getTime() && t < ld.getTime()) return 'autumn';
        // 立冬 ~ 次年立春 为冬（含年初立春前的尾部）
        return 'winter';
      }
    }

    // 降级：公历月份近似（3–5 春 / 6–8 夏 / 9–10 秋 / 其余冬）
    var mo = date.getMonth() + 1;
    if (mo >= 3 && mo <= 5) return 'spring';
    if (mo >= 6 && mo <= 8) return 'summer';
    if (mo >= 9 && mo <= 10) return 'autumn';
    return 'winter';
  }

  // 季节权重：常态为单一季节；落在四立前后 ±FADE_DAYS 内则相邻两季按线性权重混合
  function weights(date) {
    var res = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    res[current(date)] = 1;
    if (!w.Solar) return res; // 无节气库：不做过渡，直接切换

    var y = date.getFullYear();
    var B = [
      { start: getJieQiDate(y, '立春'), from: 'winter', to: 'spring' },
      { start: getJieQiDate(y, '立夏'), from: 'spring', to: 'summer' },
      { start: getJieQiDate(y, '立秋'), from: 'summer', to: 'autumn' },
      { start: getJieQiDate(y, '立冬'), from: 'autumn', to: 'winter' }
    ];
    var t = date.getTime(), FADE = FADE_DAYS * DAY;
    for (var i = 0; i < B.length; i++) {
      var s = B[i].start;
      if (!s) continue;
      var st = s.getTime();
      if (t >= st - FADE && t <= st + FADE) {
        var k = (t - (st - FADE)) / (2 * FADE); // 0 → 上季，1 → 下季
        var r = { spring: 0, summer: 0, autumn: 0, winter: 0 };
        r[B[i].from] = 1 - k;
        r[B[i].to] = k;
        return r;
      }
    }
    return res;
  }

  // 调试参数 ?season=
  function debugSeason() {
    try {
      if (typeof location === 'undefined' || !location.search) return null;
      var v = new URLSearchParams(location.search).get('season');
      if (!v) return null;
      v = v.toLowerCase();
      if (v === 'off') return 'off';
      if (TINTS[v]) return v;
    } catch (e) { /* 忽略 */ }
    return null;
  }

  function mixc(c, tint, a) {
    return [
      c[0] * (1 - a) + tint[0] * a,
      c[1] * (1 - a) + tint[1] * a,
      c[2] * (1 - a) + tint[2] * a
    ];
  }

  function desat(c, k) {
    var l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    return [
      c[0] + (l - c[0]) * k,
      c[1] + (l - c[1]) * k,
      c[2] + (l - c[2]) * k
    ];
  }

  // 按季节权重混合染色；冬季权重额外按比例降饱和
  function tintOf(c, ws) {
    var out = [0, 0, 0], s, i;
    for (s in ws) {
      if (!ws[s]) continue;
      var tt = mixc(c, TINTS[s], ALPHA);
      for (i = 0; i < 3; i++) out[i] += tt[i] * ws[s];
    }
    if (ws.winter > 0) {
      out = desat(out, DESAT_WINTER * ws.winter);
    }
    return [Math.round(out[0]), Math.round(out[1]), Math.round(out[2])];
  }

  // 季节滤镜：对天空插值色染色。glow 保留原 alpha。
  function filter(top, bottom, glow, date) {
    date = date || new Date();
    var season = current(date);
    var forced = debugSeason();
    if (forced === 'off') {
      return { top: top, bottom: bottom, glow: glow, season: season, weights: null };
    }
    var ws = weights(date);
    if (forced) {
      ws = { spring: 0, summer: 0, autumn: 0, winter: 0 };
      ws[forced] = 1;
      season = forced; // 调试强制时 season 同步，保证 data-season 与染色一致
    }
    var g = tintOf([glow[0], glow[1], glow[2]], ws);
    return {
      top: tintOf(top, ws),
      bottom: tintOf(bottom, ws),
      glow: [g[0], g[1], g[2], glow[3]],
      season: season,
      weights: ws
    };
  }

  w.ShiNianSeason = {
    current: current,
    filter: filter,
    weights: weights,
    TINTS: TINTS,
    _getJieQiDate: getJieQiDate // 暴露以便测试
  };
})();
