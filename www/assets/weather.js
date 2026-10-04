/* ============================================================
   时念 · 天气接口层（Open-Meteo）
   ------------------------------------------------------------
   职责：按城市坐标调用 Open-Meteo API，解析当前天气 / 日出日落，
   缓存 15 分钟以减少请求，网络失败时静默降级。

   依赖：无（纯 fetch + DOM）
   调用方：app.js 城市切换事件 → sky.js 锚点重算
   ============================================================ */

var ShiNianWeather = (function () {
  'use strict';

  var CACHE_MS = 15 * 60 * 1000;   // 缓存 15 分钟
  var TIMEOUT_MS = 8000;            // 请求超时 8 秒（GitHub Pages 网络较慢）

  var cache = null;                 // {cityKey, data, timestamp}

  // ---- 构建请求 URL ----
  // Open-Meteo 免密钥、免注册，客户端直连
  function buildUrl(lat, lon) {
    var params = [
      'latitude=' + lat,
      'longitude=' + lon,
      'daily=sunrise,sunset,weather_code',
      'current=temperature_2m,weather_code,is_day',
      'timezone=Asia/Shanghai',
      'forecast_days=1'
    ];
    return 'https://api.open-meteo.com/v1/forecast?' + params.join('&');
  }

  // ---- 查询天气 ----
  // city: {name, lat, lon}  返回: Promise<weatherData | null>
  function fetchWeather(city) {
    var cityKey = city.lat.toFixed(2) + ',' + city.lon.toFixed(2);

    // 命中缓存 → 直接返回
    if (cache && cache.cityKey === cityKey &&
        (Date.now() - cache.timestamp) < CACHE_MS) {
      return Promise.resolve(cache.data);
    }

    var url = buildUrl(city.lat, city.lon);

    // 带超时的 fetch
    return new Promise(function (resolve) {
      var timeout = setTimeout(function () {
        resolve(null); // 静默降级
      }, TIMEOUT_MS);

      fetch(url)
        .then(function (r) {
          clearTimeout(timeout);
          if (!r.ok) { resolve(null); return; }
          return r.json();
        })
        .then(function (json) {
          if (!json || !json.daily) { resolve(null); return; }
          var data = {
            city: city.name,
            lat: city.lat,
            lon: city.lon,
            sunrise:    json.daily.sunrise[0],      // "2026-10-05T06:15"
            sunset:     json.daily.sunset[0],        // "2026-10-05T18:12"
            weatherCode: json.daily.weather_code[0], // WMO 代码 0~99
            temperature: json.current.temperature_2m,
            isDay:       json.current.is_day,         // 0 或 1
            fetchedAt:   Date.now()
          };
          cache = { cityKey: cityKey, data: data, timestamp: Date.now() };
          resolve(data);
        })
        .catch(function () {
          clearTimeout(timeout);
          resolve(null);
        });
    });
  }

  // ---- 手动刷新（清除缓存）----
  function refresh(city) {
    cache = null;
    return fetchWeather(city);
  }

  // ---- 暴露接口 ----
  return {
    fetch: fetchWeather,
    refresh: refresh,
    CACHE_MS: CACHE_MS
  };
})();