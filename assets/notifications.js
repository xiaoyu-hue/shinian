/* ============================================================
   时念 · 本地提醒封装（@capacitor/local-notifications）
   仅在原生 APK 中生效：纯网页无 Capacitor 原生桥（window.Capacitor 不存在），
   getPlugin() 返回 null，由 app.js 负责优雅降级提示。
   排程策略：原生 API 的 every 仅支持固定单位（hour/day…），不支持任意 N 小时间隔，
   故「喝水间隔」采用计算式——在活跃窗口内算出每次触发时刻逐条排程。
   ============================================================ */
(function () {
  'use strict';

  function getPlugin() {
    var C = window.Capacitor;
    if (C && typeof C.isNativePlatform === 'function' && C.isNativePlatform() &&
        C.Plugins && C.Plugins.LocalNotifications) {
      return C.Plugins.LocalNotifications;
    }
    return null;
  }
  function isAvailable() { return !!getPlugin(); }

  function ensurePermission() {
    var ln = getPlugin();
    if (!ln) return Promise.resolve(false);
    return Promise.resolve(ln.checkPermissions())
      .then(function (p) {
        if (p && (p.display === 'granted' || p.receive === 'granted')) return true;
        return Promise.resolve(ln.requestPermissions()).then(function (r) {
          return !!(r && (r.display === 'granted' || r.receive === 'granted'));
        });
      })
      .catch(function () { return false; });
  }

  // 未来 days 天内、活跃窗口 [quietEndH, quietStartH) 内、按 intervalMin 间隔的触发时刻
  function computeTimes(intervalMin, quietStartH, quietEndH, days) {
    var list = [];
    var now = new Date();
    var step = intervalMin * 60000;
    if (!(step > 0)) return list;
    for (var d = 0; d < days; d++) {
      var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, quietEndH, 0, 0, 0);
      var dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, quietStartH, 0, 0, 0);
      if (!(dayEnd > dayStart)) continue;
      var firstMs = dayStart.getTime() + Math.ceil((now.getTime() - dayStart.getTime()) / step) * step;
      if (firstMs < dayStart.getTime()) firstMs = dayStart.getTime();
      for (var t = firstMs; t < dayEnd.getTime(); t += step) {
        if (t > now.getTime()) list.push(new Date(t));
      }
    }
    return list;
  }

  function scheduleWater(cfg) {
    var ln = getPlugin();
    if (!ln) return Promise.resolve({ ok: false, reason: 'unavailable' });
    return ensurePermission().then(function (granted) {
      if (!granted) return { ok: false, reason: 'permission' };
      var times = computeTimes(cfg.waterIntervalH * 60, cfg.quietStart, cfg.quietEnd, 2);
      if (!times.length) return { ok: true, count: 0 };
      var notifications = times.map(function (t, i) {
        return {
          id: 100000 + i,
          title: '该喝水了 💧',
          body: '起来走动一下，喝口水吧～',
          schedule: { at: t, allowWhileIdle: true },
          extra: { kind: 'water' }
        };
      });
      return ln.schedule({ notifications: notifications }).then(function () {
        return { ok: true, count: notifications.length };
      }).catch(function (e) { return { ok: false, reason: 'schedule', error: String(e) }; });
    });
  }

  function scheduleCountdown(items, cfg) {
    var ln = getPlugin();
    if (!ln) return Promise.resolve({ ok: false, reason: 'unavailable' });
    var today = items.filter(function (it) { return it.diff === 0; });
    if (!today.length) return Promise.resolve({ ok: true, count: 0 });
    return ensurePermission().then(function (granted) {
      if (!granted) return { ok: false, reason: 'permission' };
      var parts = (cfg.cdTime || '20:00').split(':');
      var at = new Date(); at.setHours(+parts[0], +parts[1] || 0, 0, 0);
      if (at <= new Date()) at.setDate(at.getDate() + 1);
      var notifications = today.map(function (it, i) {
        return {
          id: 200000 + i,
          title: '今天是 ' + it.name + ' 🌟',
          body: '念想成真的一天，记得好好庆祝。',
          schedule: { at: at, allowWhileIdle: true },
          extra: { kind: 'countdown', itemId: it.id }
        };
      });
      return ln.schedule({ notifications: notifications }).then(function () {
        return { ok: true, count: notifications.length };
      }).catch(function (e) { return { ok: false, reason: 'schedule', error: String(e) }; });
    });
  }

  function cancelAll() {
    var ln = getPlugin();
    if (!ln) return Promise.resolve();
    var p = (ln.cancelAll ? ln.cancelAll() : ln.cancel({ notifications: [] }));
    return Promise.resolve(p).catch(function () {});
  }

  // 统一入口：先清空再按设置重排（网页端 getPlugin 为 null，直接返回 unavailable）
  function apply(cfg, countdownItems) {
    var ln = getPlugin();
    if (!ln) return Promise.resolve({ ok: false, reason: 'unavailable', available: false });
    return cancelAll().then(function () {
      var chain = Promise.resolve();
      var results = [];
      if (cfg.water) {
        chain = chain.then(function () {
          return scheduleWater(cfg).then(function (r) { results.push(['water', r]); });
        });
      }
      if (cfg.cd && countdownItems && countdownItems.length) {
        chain = chain.then(function () {
          return scheduleCountdown(countdownItems, cfg).then(function (r) { results.push(['cd', r]); });
        });
      }
      return chain.then(function () { return { ok: true, available: true, results: results }; });
    }).catch(function (e) { return { ok: false, reason: 'apply', error: String(e), available: true }; });
  }

  window.ShiNianRemind = {
    isAvailable: isAvailable,
    apply: apply,
    cancelAll: cancelAll,
    computeTimes: computeTimes
  };
})();
