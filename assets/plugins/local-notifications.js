// 占位实现（stub）：Capacitor 原生通知接入前的临时桩。
// 触发条件：index.html 中仅当 window.Capacitor 存在时才注入本文件（APK 内）。
// 目的：保证 APK 内 assets/plugins/local-notifications.js 路径可解析，避免 404 噪声。
// 真实实现将在 P2（三重解锁 / 原生通知）阶段由 @capacitor/local-notifications 或
// Capacitor 原生 LocalNotifications API 替换，并提供与现有 notifications.js 的桥接。
(function () {
  if (typeof window === 'undefined') return;
  window.ShiNianLocalNotifyStub = {
    available: false,
    schedule: function () { return Promise.resolve(); },
    cancelAll: function () { return Promise.resolve(); },
    requestPermission: function () { return Promise.resolve(false); }
  };
})();
