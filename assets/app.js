/* ============================================================
   时念 · 应用层（时钟 + 倒数日）
   数据全部本地：localStorage['shinian.items.v1']
   ============================================================ */

(function () {
  'use strict';

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  // ---------- 时钟 ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  var currentDateStr = '';

  function tickClock() {
    var d = new Date();
    document.getElementById('hh').textContent = pad(d.getHours());
    document.getElementById('mm').textContent = pad(d.getMinutes());
    document.getElementById('ss').textContent = pad(d.getSeconds());
    document.getElementById('dateLine').textContent =
      d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WEEK[d.getDay()];
    var phase = document.documentElement.style.getPropertyValue('--phase-name');
    document.getElementById('phaseName').textContent = phase || '时念';

    // 跨天检测：日期变化时刷新倒数日天数
    var ds = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (currentDateStr && ds !== currentDateStr) { render(); }
    currentDateStr = ds;
  }

  // ---------- 倒数日 ----------
  var KEY = 'shinian.items.v1';
  var editingId = null;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  // 日差：按本地零点计算（纪念日惯例：当天 = 0）
  function dayDiff(dateStr) {
    var parts = dateStr.split('-');
    var target = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / 86400000);
  }

  function fmtDate(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return (+p[1]) + '月' + (+p[2]) + '日 · 星期' + WEEK[d.getDay()];
  }

  function render() {
    var items = load();
    var list = document.getElementById('cdList');
    var empty = document.getElementById('cdEmpty');
    list.innerHTML = '';

    empty.hidden = items.length > 0;

    // 排序：今天 → 将来（近→远）→ 过去（近→远）
    items.sort(function (a, b) {
      var da = Math.abs(dayDiff(a.date)) + (dayDiff(a.date) < 0 ? 0.5 : 0);
      var db = Math.abs(dayDiff(b.date)) + (dayDiff(b.date) < 0 ? 0.5 : 0);
      return da - db;
    });

    items.forEach(function (item) {
      var diff = dayDiff(item.date);
      var li = document.createElement('li');
      li.className = 'cd-item glass card' +
        (diff === 0 ? ' is-today' : '') +
        (diff < 0 ? ' is-past' : '');

      var daysHtml;
      if (diff === 0) {
        daysHtml = '<div class="n">今天</div>';
      } else if (diff > 0) {
        daysHtml = '<div class="u pre">还有</div><div class="n">' + diff + '</div><div class="u">天</div>';
      } else {
        daysHtml = '<div class="u pre">已过</div><div class="n">' + (-diff) + '</div><div class="u">天</div>';
      }

      li.innerHTML =
        '<div class="cd-info">' +
          '<div class="cd-name"></div>' +
          '<div class="cd-sub">' + fmtDate(item.date) + '</div>' +
        '</div>' +
        '<div class="cd-days">' + daysHtml + '</div>' +
        '<button type="button" class="cd-edit" aria-label="编辑 ' + item.name.replace(/"/g, '') + '"></button>' +
        '<button type="button" class="cd-del" aria-label="删除 ' + item.name.replace(/"/g, '') + '">✕</button>';

      li.querySelector('.cd-name').textContent = item.name;

      li.querySelector('.cd-edit').addEventListener('click', function () {
        document.getElementById('cdName').value = item.name;
        document.getElementById('cdDate').value = item.date;
        document.getElementById('cdSubmit').textContent = '更新这个日子';
        document.getElementById('cdCancel').hidden = false;
        editingId = item.id;
        document.getElementById('cdName').focus();
      });

      li.querySelector('.cd-del').addEventListener('click', function () {
        save(load().filter(function (x) { return x.id !== item.id; }));
        render();
      });

      list.appendChild(li);
    });
  }

  function initForm() {
    var form = document.getElementById('cdForm');
    var name = document.getElementById('cdName');
    var date = document.getElementById('cdDate');
    var submitBtn = document.getElementById('cdSubmit');
    var cancelBtn = document.getElementById('cdCancel');

    // 日期默认值：今天
    var d = new Date();
    date.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var items = load();
      if (editingId) {
        // 编辑模式：更新已有条目
        var idx = items.findIndex(function (x) { return x.id === editingId; });
        if (idx !== -1) {
          items[idx].name = name.value.trim();
          items[idx].date = date.value;
        }
        editingId = null;
        submitBtn.textContent = '记下这个日子';
        cancelBtn.hidden = true;
      } else {
        // 新增模式
        items.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: name.value.trim(),
          date: date.value
        });
      }
      save(items);
      name.value = '';
      render();
    });

    cancelBtn.addEventListener('click', function () {
      editingId = null;
      name.value = '';
      submitBtn.textContent = '记下这个日子';
      cancelBtn.hidden = true;
    });
  }

  // ---------- 城市选择 ----------
  var CITY_KEY = 'shinian.city.v1';
  var DEFAULT_CITY = {name:'北京',lat:39.9042,lon:116.4074};
  var currentCity = DEFAULT_CITY;
  var allCities = [];

  function loadCities() {
    return fetch('data/cities.json')
      .then(function(r){ return r.json(); })
      .then(function(cities){ allCities = cities; })
      .catch(function(){ allCities = [DEFAULT_CITY]; });
  }

  function getSavedCity() {
    try {
      var raw = localStorage.getItem(CITY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }

  function saveCity(city) {
    currentCity = city;
    localStorage.setItem(CITY_KEY, JSON.stringify(city));
    document.getElementById('cityLabel').textContent = city.name;
    // 拉取天气并通知 sky.js
    ShiNianWeather.fetch(city).then(function(data){
      updateWeatherDisplay(data);
      window.dispatchEvent(new CustomEvent('cityChange', {detail: {city: city, weather: data}}));
    });
  }

  function renderCityList(filter) {
    var list = document.getElementById('cityList');
    list.innerHTML = '';
    var q = (filter || '').toLowerCase();
    var filtered = allCities.filter(function(c){
      return !q || c.name.includes(q) || c.pinyin.includes(q);
    });
    filtered.forEach(function(c){
      var li = document.createElement('li');
      li.textContent = c.name;
      if (currentCity && c.name === currentCity.name) li.className = 'selected';
      li.addEventListener('click', function(){
        saveCity(c);
        document.getElementById('cityDrop').hidden = true;
        document.getElementById('cityBar').classList.remove('open');
        document.getElementById('citySearch').value = '';
      });
      list.appendChild(li);
    });
  }

  function initCityPicker() {
    var saved = getSavedCity();
    if (saved) currentCity = saved;
    document.getElementById('cityLabel').textContent = currentCity.name;

    var bar = document.getElementById('cityBar');
    var drop = document.getElementById('cityDrop');
    var search = document.getElementById('citySearch');
    var btn = document.getElementById('cityBtn');

    btn.addEventListener('click', function(){
      var open = !drop.hidden;
      drop.hidden = open;
      if (open) { bar.classList.remove('open'); }
      else { bar.classList.add('open'); renderCityList(); search.focus(); }
    });

    search.addEventListener('input', function(){
      renderCityList(search.value);
    });

    // 点击外部关闭
    document.addEventListener('click', function(e){
      if (!bar.contains(e.target)) {
        drop.hidden = true;
        bar.classList.remove('open');
        search.value = '';
      }
    });

    document.getElementById('refreshWeather').addEventListener('click', refreshWeather);
  }

  // ---- 天气图标映射 ----
  var WEATHER_ICONS = {
    0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫',
    51: '🌦', 53: '🌦', 55: '🌦', 61: '🌧', 63: '🌧', 65: '🌧',
    71: '🌨', 73: '🌨', 75: '🌨', 80: '🌦', 81: '🌧', 82: '🌧',
    95: '⛈', 96: '⛈', 99: '⛈'
  };

  function updateWeatherDisplay(weatherData) {
    var line = document.getElementById('weatherLine');
    var icon = document.getElementById('weatherIcon');
    var temp = document.getElementById('weatherTemp');
    var root = document.documentElement;

    // 刷新按钮始终可见：断网/请求失败时用户仍可手动重试
    var refreshBtn = document.getElementById('refreshWeather');
    if (refreshBtn) {
      refreshBtn.hidden = false;
      refreshBtn.textContent = '↻';
      refreshBtn.title = weatherData ? '刷新天气' : '天气获取失败，点击重试';
    }

    if (!weatherData) {
      line.hidden = true;
      root.removeAttribute('data-weather');
      return;
    }

    var code = weatherData.weatherCode;
    icon.textContent = WEATHER_ICONS[code] || '🌤';
    temp.textContent = Math.round(weatherData.temperature) + '°';

    // 天气代码 → data-weather 属性（驱动 CSS 装饰层）
    var weatherType = 'clear';
    if (code === 0 || code === 1) weatherType = 'clear';
    else if (code === 2) weatherType = 'partly-cloudy';
    else if (code === 3) weatherType = 'cloudy';
    else if (code === 45 || code === 48) weatherType = 'fog';
    else if (code >= 51 && code <= 55) weatherType = 'drizzle';
    else if (code >= 61 && code <= 65) weatherType = 'rain';
    else if (code >= 71 && code <= 75) weatherType = 'snow';
    else if (code >= 95) weatherType = 'thunderstorm';
    else if (code >= 80) weatherType = 'rain';

    root.setAttribute('data-weather', weatherType);
    line.hidden = false;
    document.getElementById('refreshWeather').hidden = false;
  }

  function refreshWeather() {
    var btn = document.getElementById('refreshWeather');
    btn.textContent = '⟳';
    ShiNianWeather.refresh(currentCity).then(function(data){
      btn.textContent = '↻';
      updateWeatherDisplay(data);
      window.dispatchEvent(new CustomEvent('cityChange', {detail: {city: currentCity, weather: data}}));
    });
  }

  // ---------- 天气装饰初始化 ----------
  function initWeatherEffects() {
    // 雨滴
    var rainBox = document.getElementById('rainCanvas');
    for (var i = 0; i < 50; i++) {
      var d = document.createElement('div');
      d.className = 'rain-drop';
      d.style.left = (Math.random() * 100) + '%';
      d.style.top = -(Math.random() * 80) + 'px';
      d.style.height = (6 + Math.random() * 10) + 'px';
      d.style.animationDuration = (.5 + Math.random() * .8).toFixed(2) + 's';
      d.style.animationDelay = (Math.random() * 2).toFixed(2) + 's';
      rainBox.appendChild(d);
    }
    // 雪花
    var snowBox = document.getElementById('snowCanvas');
    for (var j = 0; j < 30; j++) {
      var s = document.createElement('div');
      s.className = 'snow-flake';
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = -(Math.random() * 60) + 'px';
      var size = 2 + Math.random() * 5;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.animationDuration = (3 + Math.random() * 5).toFixed(2) + 's';
      s.style.animationDelay = (Math.random() * 6).toFixed(2) + 's';
      snowBox.appendChild(s);
    }
  }

  function initPerfMonitor() {
    var LOW_FPS = 30;                // 低于此帧率触发降级
    var WINDOW_MS = 2000;            // 采样窗口 2 秒
    var TRIGGER_COUNT = 3;           // 连续 3 次低于阈值才降级
    var lowCount = 0;
    var frames = 0;
    var lastSample = performance.now();

    function sample() {
      frames++;
      var now = performance.now();
      var elapsed = now - lastSample;
      if (elapsed >= WINDOW_MS) {
        var fps = Math.round(frames / (elapsed / 1000));
        frames = 0;
        lastSample = now;

        if (fps < LOW_FPS) {
          lowCount++;
          if (lowCount >= TRIGGER_COUNT) {
            document.documentElement.setAttribute('data-low-perf', '');
          }
        } else {
          lowCount = Math.max(0, lowCount - 1);
        }
      }
      requestAnimationFrame(sample);
    }

    requestAnimationFrame(sample);
  }

  // ---------- 启动 ----------
  function boot() {
    tickClock();
    setInterval(tickClock, 1000);
    initForm();
    initPerfMonitor();
    render();
    // 网络恢复后自动重试天气（PLAN v0.2 · Phase 4 断网降级链路）
    window.addEventListener('online', function () {
      if (currentCity) refreshWeather();
    });
    // 城市数据与天气异步启动，不阻塞主界面
    loadCities().then(function() {
      initCityPicker();
      initWeatherEffects();
      // 启动时拉取天气
      ShiNianWeather.fetch(currentCity).then(function(data){
        updateWeatherDisplay(data);
        window.dispatchEvent(new CustomEvent('cityChange', {detail: {city: currentCity, weather: data}}));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
