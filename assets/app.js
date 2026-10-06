/* ============================================================
   时念 · 应用层（时钟 + 倒数日）
   数据全部本地：localStorage['shinian.items.v1']
   ============================================================ */

(function () {
  'use strict';

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  // ============================================================
  // 全局容错（v0.6.1）：任何运行时错误都只记录、不白屏
  // 单条初始化失败不影响其余功能，最差情况也能看到时钟与倒数日
  // ============================================================
  function safe(label, fn) {
    try { fn(); } catch (e) { if (window.console) console.warn('[时念] ' + label + ' 初始化失败（已跳过）:', e); }
  }
  window.addEventListener('error', function (e) {
    if (window.console) console.warn('[时念] 运行时错误（已兜底）:', e && e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    if (window.console) console.warn('[时念] 异步未处理拒绝（已兜底）:', e && e.reason);
  });
  // 启动兜底网：无论 boot 是否抛错，3.5s 后强制移除开场层，绝不卡在启动画面
  setTimeout(function () {
    var s = document.getElementById('splash');
    if (s && !s.classList.contains('removed')) {
      s.classList.add('gone');
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 520);
    }
  }, 3500);

  // ============================================================
  // 动效工具：全部基于原生 Web Animations API，零依赖
  // 统一尊重系统「减弱动态效果」设置，老浏览器静默跳过
  // ============================================================
  var EASE = 'cubic-bezier(.2,.8,.2,1)';

  function motionOK() {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return true; }
  }
  function play(el, frames, opts) {
    if (!el || !el.animate || !motionOK()) return null;
    try { return el.animate(frames, opts); } catch (e) { return null; }
  }
  // 位置补间（FLIP 的 Invert+Play 一步）
  function glide(el, dy) {
    return play(el, [{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }],
                { duration: 320, easing: EASE });
  }
  // 新条目入场
  function enter(el, delay) {
    return play(el,
      [{ opacity: 0, transform: 'translateY(12px) scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: delay || 0, easing: EASE, fill: 'backwards' });
  }
  // 天数变化：沿 X 轴翻转
  function flipNumber(el) {
    return play(el, [
      { transform: 'rotateX(0deg)', opacity: 1 },
      { transform: 'rotateX(-88deg)', opacity: .2, offset: .5 },
      { transform: 'rotateX(0deg)', opacity: 1 }
    ], { duration: 460, easing: EASE });
  }
  // 图标 / 温度等小元素弹出
  function popIn(el) {
    return play(el, [
      { opacity: 0, transform: 'scale(.86) rotate(-8deg)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 420, easing: EASE });
  }
  // 触觉反馈（安卓 Chrome 支持；iOS Safari 无此 API，静默跳过）
  function haptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {}
  }

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
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { if (window.console) console.warn('[时念] 保存念想失败（已跳过）:', e); }
  }

  // ---------- 许愿池（v0.5.9） ----------
  var WISH_KEY = 'shinian.wishes.v1';
  var WISH_MAX = 100;

  function loadWishes() {
    try {
      var raw = localStorage.getItem(WISH_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveWishes(list) {
    try { localStorage.setItem(WISH_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function newWishId() {
    return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // 日期合法性：格式 + 真实日历（防止 2026-02-30 这类不存在的日期混入）
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.getFullYear() === +p[0] && d.getMonth() === +p[1] - 1 && d.getDate() === +p[2];
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

  var hasRendered = false;   // 区分「首屏入场」与「后续新增」
  var lastDiffs = {};        // 上次渲染的天数，用于判断数字是否需要翻转

  // 许愿池渲染：未完成在前，已完成沉底
  var lastDoneWishId = null;
  function renderWishes() {
    var list = loadWishes();
    var ul = document.getElementById('wishList');
    if (!ul) return;

    var undone = list.filter(function (w) { return !w.done; });
    var done = list.filter(function (w) { return w.done; });
    undone.sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
    done.sort(function (a, b) { return String(b.doneAt || '').localeCompare(String(a.doneAt || '')); });
    var ordered = undone.concat(done);

    ul.innerHTML = '';
    ordered.forEach(function (w) {
      var li = document.createElement('li');
      li.className = 'wish-item' + (w.done ? ' is-done' : '');

      var chk = document.createElement('button');
      chk.type = 'button';
      chk.className = 'wish-check';
      chk.setAttribute('role', 'checkbox');
      chk.setAttribute('aria-checked', w.done ? 'true' : 'false');
      chk.setAttribute('aria-label', (w.done ? '取消完成：' : '标记完成：') + w.text);
      chk.textContent = w.done ? '\u2713' : '';
      if (w.done && w.id === lastDoneWishId) chk.classList.add('pop');   // 完成微反馈
      chk.addEventListener('click', function () {
        var l = loadWishes();
        for (var i = 0; i < l.length; i++) {
          if (l[i].id === w.id) {
            l[i].done = !l[i].done;
            l[i].doneAt = l[i].done ? new Date().toISOString() : null;
            break;
          }
        }
        lastDoneWishId = w.done ? w.id : null;
        saveWishes(l); renderWishes(); applyReminders(); haptic(10);
      });

      var txt = document.createElement('span');
      txt.className = 'wish-text';
      txt.textContent = w.text;

      var meta = document.createElement('span');
      meta.className = 'wish-meta';
      meta.textContent = w.date ? w.date : '';

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'wish-del';
      del.setAttribute('aria-label', '删除心愿：' + w.text);
      del.textContent = '\u2715';
      del.addEventListener('click', function () {
        if (!window.confirm('删除这个心愿？\n「' + w.text + '」')) return;
        saveWishes(loadWishes().filter(function (x) { return x.id !== w.id; }));
        renderWishes(); haptic(8);
      });

      li.appendChild(chk); li.appendChild(txt); li.appendChild(meta); li.appendChild(del);
      ul.appendChild(li);
    });

    var empty = document.getElementById('wishEmpty');
    var clearBtn = document.getElementById('wishClearDone');
    var total = document.getElementById('wishTotal');
    var dn = document.getElementById('wishDone');
    if (empty) empty.hidden = list.length > 0;
    if (clearBtn) clearBtn.hidden = done.length === 0;
    if (total) total.textContent = String(list.length);
    if (dn) dn.textContent = String(done.length);
  }

  // 许下心愿：化作一颗星升入夜空（尊重「减弱动态」）
  function wishStar(fromEl) {
    if (document.documentElement.hasAttribute('data-no-motion')) return;
    if (!fromEl || !fromEl.animate) return;
    var rect = fromEl.getBoundingClientRect();
    var el = document.createElement('i');
    el.className = 'wish-star';
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height / 2) + 'px';
    document.body.appendChild(el);
    var anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-60px) scale(1)', opacity: 1, offset: .22 },
      { transform: 'translate(-50%,-170px) scale(.75)', opacity: .9, offset: .62 },
      { transform: 'translate(-50%,-300px) scale(.25)', opacity: 0 }
    ], { duration: 680, easing: 'cubic-bezier(.2,.6,.3,1)' });
    anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
  }

  // 许愿池交互：折叠、许下、清空已完成
  function initWishes() {
    var form = document.getElementById('wishForm');
    var input = document.getElementById('wishText');
    var dateEl = document.getElementById('wishDate');
    var summary = document.getElementById('wishSummary');
    var body = document.getElementById('wishBody');

    var collapsed = settings.wishCollapsed !== false;
    function applyCollapsed() {
      if (body) body.hidden = collapsed;
      if (summary) summary.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    if (summary) {
      summary.addEventListener('click', function () {
        collapsed = !collapsed;
        settings.wishCollapsed = collapsed;
        saveSettings();
        applyCollapsed();
        haptic(6);
      });
    }
    applyCollapsed();

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = (input.value || '').trim();
        if (!text) { hint('先写点什么吧'); return; }
        var list = loadWishes();
        if (list.length >= WISH_MAX) { hint('心愿已达 ' + WISH_MAX + ' 条上限，先清理已完成的吧'); return; }
        list.push({
          id: newWishId(),
          text: text.slice(0, 40),
          createdAt: new Date().toISOString(),
          date: (dateEl && dateEl.value && isValidDate(dateEl.value)) ? dateEl.value : null,
          done: false, doneAt: null, targetId: null
        });
        saveWishes(list);
        wishStar(input);
        input.value = '';
        if (dateEl) dateEl.value = '';
        renderWishes();
        applyReminders();                       // 新心愿可能带来到期提醒，立即重排
        if (collapsed) {                       // 首次许愿后自动展开一次
          collapsed = false;
          settings.wishCollapsed = false;
          saveSettings();
          applyCollapsed();
        }
        haptic(12);
      });
    }

    // 流星联动：点击划过的流星 → 展开许愿池并聚焦输入框
    if (window.ShiNianDecor) {
      window.ShiNianDecor.onMeteorClick = function () {
        if (collapsed) {
          collapsed = false;
          settings.wishCollapsed = false;
          saveSettings();
          applyCollapsed();
        }
        var el = document.getElementById('wishText');
        if (el) el.focus();
        haptic(8);
      };
    }

    var clearDone = document.getElementById('wishClearDone');
    if (clearDone) {
      clearDone.addEventListener('click', function () {
        var list = loadWishes();
        var dn = list.filter(function (w) { return w.done; }).length;
        if (!dn) return;
        if (!window.confirm('清空已完成的 ' + dn + ' 个心愿？\n此操作不可恢复。')) return;
        saveWishes(list.filter(function (w) { return !w.done; }));
        renderWishes(); haptic(8);
      });
    }
  }

  function render() {
    var items = load();
    var list = document.getElementById('cdList');
    var empty = document.getElementById('cdEmpty');
    // v0.6.3 安全兜底：容器缺失时不渲染（tickClock 跨天等调用路径可能早于 DOM 就绪）
    if (!list) return;

    // FLIP · First：重建前先记下每条的位置
    var firstTop = {};
    Array.prototype.forEach.call(list.querySelectorAll('.cd-item'), function (el) {
      if (el.dataset.id) firstTop[el.dataset.id] = el.getBoundingClientRect().top;
    });

    list.innerHTML = '';

    empty.hidden = items.length > 0;

    // 排序：今天 → 将来（近→远）→ 过去（近→远）
    items.sort(function (a, b) {
      var da = Math.abs(dayDiff(a.date)) + (dayDiff(a.date) < 0 ? 0.5 : 0);
      var db = Math.abs(dayDiff(b.date)) + (dayDiff(b.date) < 0 ? 0.5 : 0);
      return da - db;
    });

    items.forEach(function (item, idx) {
      var diff = dayDiff(item.date);
      var li = document.createElement('li');
      li.className = 'cd-item' +
        (diff === 0 ? ' is-today' : '') +
        (diff < 0 ? ' is-past' : '');
      li.dataset.id = item.id;

      var daysHtml;
      if (diff === 0) {
        daysHtml = '<div class="n">今天</div>';
      } else if (diff > 0) {
        daysHtml = '<div class="u pre">还有</div><div class="n">' + diff + '</div><div class="u">天</div>';
      } else {
        daysHtml = '<div class="u pre">已过</div><div class="n">' + (-diff) + '</div><div class="u">天</div>';
      }

      li.innerHTML =
        '<div class="cd-swipe" aria-hidden="true">松开删除</div>' +
        '<div class="cd-body glass card">' +
          '<div class="cd-info">' +
            '<div class="cd-name"></div>' +
            '<div class="cd-sub">' + fmtDate(item.date) + '</div>' +
          '</div>' +
          '<div class="cd-days">' + daysHtml + '</div>' +
          '<button type="button" class="cd-edit"></button>' +
          '<button type="button" class="cd-del">✕</button>' +
        '</div>';

      li.querySelector('.cd-name').textContent = item.name;
      // 用 setAttribute 而非拼字符串，避免名字里的特殊字符破坏属性
      li.querySelector('.cd-edit').setAttribute('aria-label', '编辑 ' + item.name);
      li.querySelector('.cd-del').setAttribute('aria-label', '删除 ' + item.name);

      li.querySelector('.cd-edit').addEventListener('click', function () {
        document.getElementById('cdName').value = item.name;
        document.getElementById('cdDate').value = item.date;
        document.getElementById('cdSubmit').textContent = '更新这个日子';
        document.getElementById('cdCancel').hidden = false;
        editingId = item.id;
        document.getElementById('cdName').focus();
      });

      li.querySelector('.cd-del').addEventListener('click', function () {
        removeItem(item.id, li);
      });

      initSwipe(li, item.id);
      list.appendChild(li);

      // FLIP · Last：与旧位置比对，位移的补间、新增的入场
      var body = li.querySelector('.cd-body');
      var nowTop = li.getBoundingClientRect().top;
      if (firstTop.hasOwnProperty(item.id)) {
        var dy = firstTop[item.id] - nowTop;
        if (Math.abs(dy) > 1) glide(body, dy);
        // 天数变了才翻转数字，避免每次刷新都翻
        if (lastDiffs[item.id] !== undefined && lastDiffs[item.id] !== diff) {
          flipNumber(li.querySelector('.cd-days'));
        }
      } else if (hasRendered) {
        enter(body);
      } else {
        enter(body, Math.min(idx, 5) * 55);   // 首屏逐条错开
      }
      lastDiffs[item.id] = diff;
    });

    hasRendered = true;
    syncSettingsUI();       // 让设置面板里的条目数保持同步
    applyReminders();       // 倒数日变化时重排「今天」提醒
  }

  // 删除：高度收拢 + 淡出，结束后其余条目由 render 的 FLIP 平滑上移
  function removeItem(id, li) {
    if (li.dataset.removing) return;      // 防止动画期间重复触发
    li.dataset.removing = '1';
    haptic(10);
    // 数据立刻落库：连续快速删除、或动画途中刷新页面都不会出错
    save(load().filter(function (x) { return x.id !== id; }));
    var finish = function () { render(); };
    var anim = play(li, [
      { height: li.offsetHeight + 'px', opacity: 1, transform: 'none' },
      { height: '0px', opacity: 0, transform: 'translateX(20px)' }
    ], { duration: 250, easing: 'ease-in' });
    if (!anim) { finish(); return; }
    anim.onfinish = finish;
  }

  // 滑动删除（仅触摸设备；鼠标仍用 ✕ 按钮，避免误触）
  function initSwipe(li, id) {
    var MAX = 130, THRESHOLD = 72;
    var body = li.querySelector('.cd-body');
    var startX = 0, startY = 0, dx = 0, active = false, axis = null;

    li.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      startX = e.clientX; startY = e.clientY; dx = 0; active = true; axis = null;
      try { li.setPointerCapture(e.pointerId); } catch (err) {}
    });

    li.addEventListener('pointermove', function (e) {
      if (!active) return;
      var ddx = e.clientX - startX, ddy = e.clientY - startY;
      if (axis === null) {
        if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
        // 判定主轴：纵向则交还给页面滚动
        axis = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
        if (axis === 'y') { active = false; return; }
        li.classList.add('swiping');
      }
      dx = Math.max(-MAX, Math.min(0, ddx));   // 只允许左滑
      body.style.transition = 'none';
      body.style.transform = 'translateX(' + dx + 'px)';
    });

    function end() {
      if (!active) return;
      active = false;
      li.classList.remove('swiping');
      body.style.transition = '';              // 交回 CSS 弹簧过渡
      if (dx <= -THRESHOLD) {
        body.style.transform = 'translateX(-' + MAX + 'px)';
        removeItem(id, li);
      } else {
        body.style.transform = '';             // 未达阈值，弹回原位
      }
    }
    li.addEventListener('pointerup', end);
    li.addEventListener('pointercancel', end);
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
      haptic(14);          // 记下念想时轻微震动一下（安卓）
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
  var lastWeather = null;   // v0.6.5：缓存最近一次天气数据，供开场环境微行使用
  var allCities = [];

  function loadCities() {
    // 优先用内联数据（assets/cities.js）：file:// 双击打开时
    // 浏览器禁止 fetch 本地 JSON，内联是唯一全功能方案（v0.3.1）
    if (window.SHINIAN_CITIES && window.SHINIAN_CITIES.length) {
      allCities = window.SHINIAN_CITIES;
      return Promise.resolve();
    }
    // 兜底：内联缺失时（如旧缓存页面）仍尝试远程读取
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
        closeDrop(document.getElementById('cityDrop'),
                  document.getElementById('cityBar'),
                  document.getElementById('citySearch'));
      });
      list.appendChild(li);
    });
  }

  // 城市下拉：展开 / 收起带高度动画（不支持的浏览器直接切换，不会报错）
  function openDrop(drop, bar, search) {
    closeSettings();          // 与设置面板互斥，同时只开一个
    drop.hidden = false;
    bar.classList.add('open');
    renderCityList();
    search.focus();
    var anim = play(drop, [
      { height: '0px', opacity: 0 },
      { height: drop.scrollHeight + 'px', opacity: 1 }
    ], { duration: 280, easing: EASE });
    if (anim) anim.onfinish = function () { drop.style.height = ''; };
  }
  function closeDrop(drop, bar, search) {
    if (drop.hidden) return;
    bar.classList.remove('open');
    if (search) search.value = '';
    var anim = play(drop, [
      { height: drop.scrollHeight + 'px', opacity: 1 },
      { height: '0px', opacity: 0 }
    ], { duration: 200, easing: 'ease-in' });
    if (!anim) { drop.hidden = true; return; }
    anim.onfinish = function () { drop.hidden = true; drop.style.height = ''; };
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
      if (drop.hidden) { openDrop(drop, bar, search); }
      else { closeDrop(drop, bar, search); }
    });

    search.addEventListener('input', function(){
      renderCityList(search.value);
    });

    // 点击外部关闭
    document.addEventListener('click', function(e){
      if (!bar.contains(e.target)) { closeDrop(drop, bar, search); closeSettings(); }
    });

    document.getElementById('refreshWeather').addEventListener('click', refreshWeather);
  }

  // ---- 天气图标映射 ----
  var WEATHER_ICONS = {
    0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫',
    51: '🌦', 53: '🌦', 55: '🌦', 61: '🌧', 63: '🌧', 65: '🌧',
    71: '🌨', 73: '🌨', 75: '🌨', 80: '🌦', 81: '🌧', 82: '🌧', 85: '🌨', 86: '🌨',
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
    lastWeather = weatherData;   // v0.6.5：缓存，供开场环境微行（城市 · 天气 · 温度）

    var code = weatherData.weatherCode;
    var isDay = weatherData.isDay;   // 0=夜间 1=白天（weather.js 已回传）
    var prevIcon = icon.textContent, prevTemp = temp.textContent;
    var iconChar = WEATHER_ICONS[code] || '🌤';
    // 夜间把晴/少云的太阳图标换成月亮，避免“半夜显示太阳”
    if (isDay === 0 && (code === 0 || code === 1 || code === 2)) {
      iconChar = '🌙';
    }
    icon.textContent = iconChar;
    temp.textContent = Math.round(weatherData.temperature) + '°';
    // 只在真正变化时才播放，避免每分钟重绘都闪一下
    if (prevIcon && prevIcon !== icon.textContent) popIn(icon);
    if (prevTemp && prevTemp !== temp.textContent) popIn(temp);

    // 天气代码 → data-weather 属性（驱动 CSS 装饰层）
    var weatherType = 'clear';
    if (code === 0 || code === 1) weatherType = 'clear';
    else if (code === 2) weatherType = 'partly-cloudy';
    else if (code === 3) weatherType = 'cloudy';
    else if (code === 45 || code === 48) weatherType = 'fog';
    else if (code >= 51 && code <= 55) weatherType = 'drizzle';
    else if (code >= 61 && code <= 65) weatherType = 'rain';
    else if (code >= 71 && code <= 75) weatherType = 'snow';
    else if (code >= 80 && code <= 82) weatherType = 'rain';
    else if (code >= 85 && code <= 86) weatherType = 'snow';
    else if (code >= 95) weatherType = 'thunderstorm';

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

  // ---- 天气温度自动刷新（v0.6.2）----
  // 自动任务绕过 15 分钟缓存（refresh 已清缓存），只更新数据、不碰刷新按钮；
  // 手动刷新仍走 refreshWeather（带按钮转圈反馈）。失败静默降级，不影响时钟与倒数日。
  var weatherTimer = null;
  function autoRefreshWeather() {
    if (!currentCity) return;
    ShiNianWeather.refresh(currentCity).then(function (data) {
      // v0.6.3 · P0 修复：自动刷新失败时 data 为 null（超时/网络错），
      // 此时切勿调用 updateWeatherDisplay(null) —— 那会把上次有效的温度清空，
      // 移动端偶发慢网会周期性「温度闪没」。仅当拿到新数据才更新显示，
      // 失败则静默保留上一次温度（降级）。
      if (data) {
        updateWeatherDisplay(data);
        window.dispatchEvent(new CustomEvent('cityChange', {detail: {city: currentCity, weather: data}}));
      } else if (window.console) {
        console.warn('[时念] 自动刷新天气失败（保留上次温度，降级）');
      }
    }).catch(function () {
      if (window.console) console.warn('[时念] 自动刷新天气失败（保留上次温度，降级）');
    });
  }
  function stopWeatherAutoRefresh() {
    if (weatherTimer) { clearInterval(weatherTimer); weatherTimer = null; }
  }
  function startWeatherAutoRefresh() {
    stopWeatherAutoRefresh();
    var min = settings.weatherRefreshMin;
    if (!min) return;   // 0 = 关闭自动刷新
    var ms = min * 60000;
    // 调试钩子（不持久化，遵循项目 ?t=/?season= 约定）：?wrf=秒数 临时缩短间隔便于验收
    try {
      var q = new URLSearchParams(location.search).get('wrf');
      if (q && /^\d+$/.test(q) && +q > 0) ms = Math.min(600000, +q * 1000);
    } catch (e) {}
    weatherTimer = setInterval(function () {
      if (document.hidden) return;   // 后台期间双保险：即便漏过 visibility 事件也不刷
      autoRefreshWeather();
    }, ms);
  }

  // ============================================================
  // 设置与数据
  // 设置持久化在 localStorage['shinian.settings.v1']
  // ============================================================
  var SET_KEY = 'shinian.settings.v1';
  var settings = {
    recipe: 'auto', motion: true, decor: true,
    wishCollapsed: true,          // v0.5.9 许愿池默认折叠；用户可自定义并记住
    remindCollapsed: true,        // v0.6.1 提醒模块默认折叠；用户可自定义并记住
    weatherRefreshMin: 5,         // v0.6.2 温度自动刷新间隔（分钟）：0=关闭，可选 5/10/15/30
    remind: { water: false, waterIntervalH: 2, quietStart: 22, quietEnd: 8,
              cd: false, cdTime: '08:00', cdLeadTime: '20:00',
              wishRemind: true, wishTime: '09:00' }   // v0.5.9 许愿池到期提醒（默认开，用户可关）
  };

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SET_KEY) || 'null');
      if (s && typeof s === 'object') {
        if (s.recipe === 'auto' || s.recipe === 'light' || s.recipe === 'dark') settings.recipe = s.recipe;
        if (typeof s.motion === 'boolean') settings.motion = s.motion;
        if (typeof s.decor === 'boolean') settings.decor = s.decor;
        if (typeof s.wishCollapsed === 'boolean') settings.wishCollapsed = s.wishCollapsed;
        if (typeof s.remindCollapsed === 'boolean') settings.remindCollapsed = s.remindCollapsed;
        if (s.remind && typeof s.remind === 'object') {
          var r = s.remind;
          if (typeof r.water === 'boolean') settings.remind.water = r.water;
          if (isFinite(r.waterIntervalH)) settings.remind.waterIntervalH = Math.min(12, Math.max(0.5, +r.waterIntervalH));
          if (isFinite(r.quietStart)) settings.remind.quietStart = Math.min(23, Math.max(0, +r.quietStart));
          if (isFinite(r.quietEnd)) settings.remind.quietEnd = Math.min(23, Math.max(0, +r.quietEnd));
          if (typeof r.cd === 'boolean') settings.remind.cd = r.cd;
          if (typeof r.cdTime === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(r.cdTime)) settings.remind.cdTime = r.cdTime;
          if (typeof r.cdLeadTime === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(r.cdLeadTime)) settings.remind.cdLeadTime = r.cdLeadTime;
          if (typeof r.wishRemind === 'boolean') settings.remind.wishRemind = r.wishRemind;
          if (typeof r.wishTime === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(r.wishTime)) settings.remind.wishTime = r.wishTime;
        }
        // v0.6.2 天气自动刷新间隔：只允许 0/5/10/15/30，其余视为无效回退默认 5
        if (s.weatherRefreshMin !== undefined) {
          var wm = +s.weatherRefreshMin;
          if ([0, 5, 10, 15, 30].indexOf(wm) !== -1) settings.weatherRefreshMin = wm;
        }
      }
    } catch (e) {}
    applySettings();
  }
  function saveSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) {}
  }
  function applySettings() {
    var root = document.documentElement;
    if (settings.recipe === 'auto') root.removeAttribute('data-recipe-lock');
    else root.setAttribute('data-recipe-lock', settings.recipe);
    if (settings.motion) root.removeAttribute('data-no-motion');
    else root.setAttribute('data-no-motion', '');
    if (settings.decor) root.removeAttribute('data-no-decor');
    else root.setAttribute('data-no-decor', '');
    window.dispatchEvent(new CustomEvent('recipeChange'));   // 天空引擎立即重算
    // v0.6.3 · P2：装饰层开关改变时，让运行中的季节彩蛋/流星立即生效或停止。
    // 原仅设置 data-no-decor 属性，已触发的动画要等自身时长结束才停（最长 40s）；
    // 这里联动 setEnabled，关→立即停止所有装饰，开→恢复（maybeTrigger 会在重试时重触发）。
    if (window.ShiNianDecor && typeof window.ShiNianDecor.setEnabled === 'function') {
      window.ShiNianDecor.setEnabled(settings.decor);
    }
    syncSettingsUI();
    applyReminders();
  }
  // 本地提醒：按当前设置重排（网页端无 Capacitor 插件时静默跳过；开启时由开关处提示）
  function applyReminders() {
    if (!window.ShiNianRemind) return;
    var items = load().map(function (it) {
      return { id: it.id, name: it.name, date: it.date, diff: dayDiff(it.date) };
    }).filter(function (it) { return it.diff === 0 || it.diff === 1; });
    var wishes = loadWishes().map(function (w) {
      return { id: w.id, text: w.text, done: w.done, date: w.date,
               diff: w.date ? dayDiff(w.date) : null };
    });
    window.ShiNianRemind.apply(settings.remind, items, wishes);
  }

  function syncSettingsUI() {
    var seg = document.getElementById('recipeSeg');
    if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button[data-v]'), function (b) {
      b.classList.toggle('on', b.dataset.v === settings.recipe);
    });
    var mt = document.getElementById('motionToggle');
    if (mt) { mt.classList.toggle('on', settings.motion); mt.setAttribute('aria-checked', String(settings.motion)); }
    var dt = document.getElementById('decorToggle');
    if (dt) { dt.classList.toggle('on', settings.decor); dt.setAttribute('aria-checked', String(settings.decor)); }
    var c = document.getElementById('itemCount');
    if (c) c.textContent = load().length;

    var rt = document.getElementById('remindToggle');
    if (rt) { rt.classList.toggle('on', settings.remind.water); rt.setAttribute('aria-checked', String(settings.remind.water)); }
    var ci = document.getElementById('remindInterval');
    if (ci) ci.value = settings.remind.waterIntervalH;
    var qs = document.getElementById('remindQuietStart');
    if (qs) qs.value = settings.remind.quietStart;
    var qe = document.getElementById('remindQuietEnd');
    if (qe) qe.value = settings.remind.quietEnd;
    var crt = document.getElementById('cdRemindToggle');
    if (crt) { crt.classList.toggle('on', settings.remind.cd); crt.setAttribute('aria-checked', String(settings.remind.cd)); }
    var ct = document.getElementById('cdRemindTime');
    if (ct) ct.value = settings.remind.cdTime;
    var clt = document.getElementById('cdLeadTime');
    if (clt) clt.value = settings.remind.cdLeadTime;
    var wrt = document.getElementById('wishRemindToggle');
    if (wrt) { wrt.classList.toggle('on', settings.remind.wishRemind); wrt.setAttribute('aria-checked', String(settings.remind.wishRemind)); }
    var wtm = document.getElementById('wishTime');
    if (wtm) wtm.value = settings.remind.wishTime;

    // v0.6.2 天气自动刷新间隔下拉同步
    var wrm = document.getElementById('weatherRefreshMin');
    if (wrm) wrm.value = String(settings.weatherRefreshMin);

    // 网页端（无原生桥）显示提示；App 内可用则隐藏
    var rh = document.getElementById('remindHint');
    if (rh) rh.hidden = !!(window.ShiNianRemind && window.ShiNianRemind.isAvailable());
  }
  function hint(msg) {
    var el = document.getElementById('setHint');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
    if (msg) setTimeout(function () { if (el.textContent === msg) el.hidden = true; }, 5000);
  }

  function backupPayload() {
    return JSON.stringify({
      app: 'shinian', schema: 2,
      exportedAt: new Date().toISOString(),
      items: load(),
      wishes: loadWishes()
    });
  }
  function stamp() {
    var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }
  // 复制：优先用剪贴板 API，失败降级到隐藏 textarea
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject();
      } catch (e) { reject(e); }
    });
  }
  function closeSettings() {
    var drop = document.getElementById('settingsDrop');
    if (!drop || drop.hidden) return;
    var a = play(drop, [
      { height: drop.scrollHeight + 'px', opacity: 1 },
      { height: '0px', opacity: 0 }
    ], { duration: 200, easing: 'ease-in' });
    if (!a) { drop.hidden = true; return; }
    a.onfinish = function () { drop.hidden = true; drop.style.height = ''; };
  }

  function initSettings() {
    var btn = document.getElementById('settingsBtn');
    var drop = document.getElementById('settingsDrop');
    if (!btn || !drop) return;

    btn.addEventListener('click', function () {
      if (drop.hidden) {
        // 与城市下拉互斥
        var bar = document.getElementById('cityBar');
        var cd = document.getElementById('cityDrop');
        if (cd && !cd.hidden) closeDrop(cd, bar, document.getElementById('citySearch'));
        drop.hidden = false;
        syncSettingsUI();
        var a = play(drop, [
          { height: '0px', opacity: 0 },
          { height: drop.scrollHeight + 'px', opacity: 1 }
        ], { duration: 280, easing: EASE });
        if (a) a.onfinish = function () { drop.style.height = ''; };
      } else {
        closeSettings();
      }
    });

    // 玻璃配方
    document.getElementById('recipeSeg').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-v]');
      if (!b) return;
      settings.recipe = b.dataset.v;
      saveSettings(); applySettings(); haptic(8);
    });

    // 两个开关
    function bindToggle(id, key) {
      document.getElementById(id).addEventListener('click', function () {
        settings[key] = !settings[key];
        saveSettings(); applySettings(); haptic(8);
      });
    }
    bindToggle('motionToggle', 'motion');
    bindToggle('decorToggle', 'decor');

    // 本地提醒
    function bindRemindToggle(id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        settings.remind[key] = !settings.remind[key];
        saveSettings(); applySettings(); haptic(8);
        updateRemindSummary();
        if (settings.remind[key] && window.ShiNianRemind && !window.ShiNianRemind.isAvailable()) {
          hint('本地提醒需安装 App（安卓 APK）才会弹出系统通知；网页版已保存设置但不弹通知。');
        }
      });
    }
    bindRemindToggle('remindToggle', 'water');
    bindRemindToggle('cdRemindToggle', 'cd');
    bindRemindToggle('wishRemindToggle', 'wishRemind');

    function bindRemindInput(id, key, parse) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        var v = parse(el.value);
        if (v === null || v === undefined) { el.value = settings.remind[key]; return; }
        settings.remind[key] = v;
        saveSettings(); applySettings(); haptic(6);
      });
    }
    bindRemindInput('remindInterval', 'waterIntervalH', function (v) { var n = parseFloat(v); return (isFinite(n) && n >= 0.5 && n <= 12) ? n : null; });
    bindRemindInput('remindQuietStart', 'quietStart', function (v) { var n = parseInt(v, 10); return (isNaN(n) || n < 0 || n > 23) ? null : n; });
    bindRemindInput('remindQuietEnd', 'quietEnd', function (v) { var n = parseInt(v, 10); return (isNaN(n) || n < 0 || n > 23) ? null : n; });
    bindRemindInput('wishTime', 'wishTime', function (v) { return /^([01]?\d|2[0-3]):[0-5]\d$/.test(v) ? v : null; });
    bindRemindInput('cdRemindTime', 'cdTime', function (v) { return /^([01]?\d|2[0-3]):[0-5]\d$/.test(v) ? v : null; });
    bindRemindInput('cdLeadTime', 'cdLeadTime', function (v) { return /^([01]?\d|2[0-3]):[0-5]\d$/.test(v) ? v : null; });

    // v0.6.2 温度自动刷新间隔（下拉）：关闭 / 5 / 10 / 15 / 30 分钟，改完立即按新间隔重启
    var wrm = document.getElementById('weatherRefreshMin');
    if (wrm) wrm.addEventListener('change', function () {
      var v = parseInt(wrm.value, 10);
      if ([0, 5, 10, 15, 30].indexOf(v) === -1) { wrm.value = String(settings.weatherRefreshMin); return; }
      settings.weatherRefreshMin = v;
      saveSettings();
      startWeatherAutoRefresh();
      haptic(6);
    });

    // 导出 · 复制文本
    document.getElementById('exportCopy').addEventListener('click', function () {
      var items = load();
      if (!items.length) { hint('还没有念想可以备份'); return; }
      copyText(backupPayload()).then(function () {
        hint('已复制 ' + items.length + ' 条念想的备份文本，粘到备忘录或聊天里就能存下来');
        haptic(12);
      }).catch(function () {
        hint('复制失败，请改用「下载备份文件」');
      });
    });

    // 导出 · 下载文件
    document.getElementById('exportFile').addEventListener('click', function () {
      var items = load();
      if (!items.length) { hint('还没有念想可以备份'); return; }
      try {
        var blob = new Blob([backupPayload()], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'shinian-backup-' + stamp() + '.json';
        // 阻止冒泡：否则会被「点击外部关闭面板」的逻辑误判，导致面板被关掉
        a.addEventListener('click', function (e) { e.stopPropagation(); });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        hint('已下载 shinian-backup-' + stamp() + '.json');
        haptic(12);
      } catch (e) { hint('下载失败：' + (e && e.message)); }
    });

    // 导入恢复（默认合并，同 id 跳过）
    var fileInput = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result));
          var incoming = Array.isArray(data) ? data : (data && data.items);
          if (!Array.isArray(incoming)) { hint('文件格式不对，无法识别'); return; }
          var cur = load(), have = {};
          cur.forEach(function (x) { have[x.id] = 1; });
          var added = 0, dup = 0, bad = 0;
          incoming.forEach(function (x) {
            if (!x || !isValidDate(x.date)) { bad++; return; }   // 日期缺失/格式错/日历上不存在 → 跳过
            var id = x.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
            if (have[id]) { dup++; return; }
            have[id] = 1;
            cur.push({ id: id, name: String(x.name || '未命名').slice(0, 30), date: x.date });
            added++;
          });
          // 心愿（v0.5.9）：旧备份无 wishes 字段时跳过，不覆盖现有心愿
          var wAdded = 0;
          var wIn = data && data.wishes;
          if (Array.isArray(wIn) && wIn.length) {
            var wl = loadWishes(), wh = {};
            wl.forEach(function (x) { wh[x.id] = 1; });
            wIn.forEach(function (x) {
              if (!x || typeof x.text !== 'string' || !x.text) return;
              var wid = x.id || newWishId();
              if (wh[wid]) return;
              wh[wid] = 1;
              wl.push({
                id: wid,
                text: String(x.text).slice(0, 40),
                done: !!x.done,
                doneAt: x.doneAt || null,
                date: (typeof x.date === 'string' && isValidDate(x.date)) ? x.date : null,
                targetId: x.targetId || null,
                createdAt: x.createdAt || new Date().toISOString()
              });
              wAdded++;
            });
            saveWishes(wl);
          }
          save(cur); render(); renderWishes(); syncSettingsUI();
          hint('导入完成：新增 ' + added + ' 条念想' +
               (wAdded ? '、' + wAdded + ' 个心愿' : '') +
               (dup ? '，跳过 ' + dup + ' 条重复' : '') +
               (bad ? '，丢弃 ' + bad + ' 条日期无效' : ''));
          haptic(12);
        } catch (e) {
          hint('导入失败：不是有效的备份 JSON');
        }
        fileInput.value = '';
      };
      reader.readAsText(f);
    });

    // 清空（二次确认）
    document.getElementById('clearBtn').addEventListener('click', function () {
      var n = load().length, wn = loadWishes().length;
      if (!n && !wn) { hint('已经没有念想了'); return; }
      var msg = '确定清空全部 ' + n + ' 条念想' + (wn ? ' 和 ' + wn + ' 个心愿' : '') +
                '吗？\n此操作不可恢复，建议先备份。';
      if (!window.confirm(msg)) return;
      save([]); saveWishes([]); render(); renderWishes(); syncSettingsUI();
      hint('已清空全部念想' + (wn ? '与心愿' : ''));
      haptic(12);
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
      if (done) return;   // 降级已生效，停止采样省电（v0.3.1）
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
            done = true;   // 连续 3 个采样窗口都低于阈值才降级，误判风险足够低
            return;
          }
        } else {
          lowCount = Math.max(0, lowCount - 1);
        }
      }
      requestAnimationFrame(sample);
    }

    var done = false;
    requestAnimationFrame(sample);
  }

  // 开场环境微行：城市 · 天气 · 温度（无数据时返回 ''，由 intro.js 隐藏该行）
  function buildSplashEnv() {
    if (!lastWeather) return '';
    var w = document.documentElement.getAttribute('data-weather');
    var map = { clear: '晴', 'partly-cloudy': '多云', cloudy: '阴', fog: '雾',
                drizzle: '毛毛雨', rain: '雨', snow: '雪', thunderstorm: '雷阵雨' };
    var txt = map[w] || '';
    var city = lastWeather.city ? lastWeather.city + ' · ' : '';
    return city + (txt ? txt + ' ' : '') + Math.round(lastWeather.temperature) + '°';
  }

  // ---------- 启动 ----------
  /* 启动开场（v0.6.5）：Web 覆盖层接棒原生闪屏，呈现此刻真实天空
     - 背景由 intro.js 用 sky.js 实时天色绘制（白天蓝天 / 深夜星海）
     - 减弱动态时跳过流星与闪烁，静态呈现并快速淡出
     - 真机：先收起原生闪屏(native)，用双 rAF 等其淡出首帧后再播 Web 开场；
       网页版：直接播放 Web 开场。兜底计时器保证绝不卡在启动画面 */
  function initSplash() {
    var el = document.getElementById('splash');
    if (!el) return;
    var canvas = document.getElementById('splashCanvas');
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var MIN = reduce ? 320 : 2700;   // 开场总时长（非减弱：星场苏醒 + 多流星引路 + 停留）
    var MAX = 3400;                  // 安全上限，防卡死
    var ended = false;
    function end() {
      if (ended) return; ended = true;
      if (window.ShiNianIntro && window.ShiNianIntro.stop) window.ShiNianIntro.stop();
      el.classList.add('gone');
      setTimeout(function () {
        el.classList.add('removed');
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 520);
    }
    function startWeb() {
      el.classList.add('splash-run');
      var phase = '';
      try { phase = (getComputedStyle(document.documentElement).getPropertyValue('--phase-name') || '').trim(); } catch (e) {}
      var env = buildSplashEnv();
      if (window.ShiNianIntro && canvas) {
        window.ShiNianIntro.start(canvas, {
          reduce: reduce,
          phase: phase,
          env: env,
          onDone: function () { setTimeout(end, 320); }   // 流星收尾后稍作停留再淡出
        });
      }
      setTimeout(end, MIN);   // onDone 未触发时的兜底（如 canvas 不可用）
      setTimeout(end, MAX);
    }
    // 原生闪屏（Capacitor 插件）存在时：先收起它，等首帧绘制后再触发 Web 开场，
    // 避免 v0.6.0「原生与 Web 同时收起、Web 仅露脸 0.46s」的看不到问题
    var SP = window.SplashScreen ||
             (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen);
    try {
      if (SP && typeof SP.hide === 'function') {
        SP.hide();
        // 双 rAF 等原生层至少完成一帧淡出，再播 Web 开场（比固定 320ms 更顺滑）
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () { setTimeout(startWeb, 120); });
          });
        } else {
          setTimeout(startWeb, 320);
        }
      } else {
        startWeb();
      }
    } catch (e) { startWeb(); }
  }

  // v0.6.6：主天空云彩层（共享 ShiNianClouds 引擎，与开场同一片云）
  function initSkyClouds() {
    var cv = document.getElementById('cloudCanvas');
    if (!cv || !window.ShiNianClouds) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    // v0.6.6：消费云引擎设备分级（桌面 3 层 / DPR≤2 / 内部 1.0 / FPS30；移动 2 层 / DPR≤1.5 / 内部 0.62 / FPS24）
    var q = window.ShiNianClouds.config({});
    var dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
    var rs = q.resScale || 1;
    var field = window.ShiNianClouds.create({ w: window.innerWidth, h: window.innerHeight });
    field.setWeather();      // 按当前 data-weather 设定云型/浓度/亮度
    var FPS = q.fps || 30, step = 1000 / FPS, acc = 0, last = 0, raf = 0;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
      rs = q.resScale || 1;
      var w = window.innerWidth, h = window.innerHeight;
      cv.width = Math.max(1, Math.round(w * dpr * rs));
      cv.height = Math.max(1, Math.round(h * dpr * rs));
      ctx.setTransform(dpr * rs, 0, 0, dpr * rs, 0, 0);
      field.resize(w, h);
    }
    resize();
    window.addEventListener('resize', resize);
    // 城市/天气变化 → 云量随之增减（阴/雨/雪增多，晴空减少）
    window.addEventListener('cityChange', function () { field.setWeather(); });
    function frame(ts) {
      if (!last) last = ts;
      var dt = (ts - last) / 1000; last = ts; acc += dt * 1000;
      if (reduce) {
        field.draw(ctx, ts, true);
      } else {
        var guard = 0;
        while (acc >= step && guard < 3) { field.update(step / 1000); acc -= step; guard++; }
        field.draw(ctx, ts, false);
      }
      raf = requestAnimationFrame(frame);
    }
    // 切后台暂停、回前台恢复（省电省流量）
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
    });
    raf = requestAnimationFrame(frame);
  }

  // 提醒模块折叠（v0.6.1 · 参考许愿池）：summary 显示开关状态，点击展开/收起，状态记住
  function updateRemindSummary() {
    var text = document.getElementById('remindSummaryText');
    if (!text) return;
    var onCount = 0;
    if (settings.remind.water) onCount++;
    if (settings.remind.cd) onCount++;
    if (settings.remind.wishRemind) onCount++;
    var collapsed = settings.remindCollapsed !== false;
    text.textContent = '提醒 · 已开启 ' + onCount + ' 项 · ' + (collapsed ? '轻点展开' : '轻点收起');
  }
  function initRemind() {
    var summary = document.getElementById('remindSummary');
    var body = document.getElementById('remindBody');
    var collapsed = settings.remindCollapsed !== false;
    function applyCollapsed() {
      if (body) body.hidden = collapsed;
      if (summary) summary.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      updateRemindSummary();
    }
    if (summary) {
      summary.addEventListener('click', function () {
        collapsed = !collapsed;
        settings.remindCollapsed = collapsed;
        saveSettings();
        applyCollapsed();
        haptic(6);
      });
    }
    applyCollapsed();
  }

  function boot() {
    safe('loadSettings', loadSettings);   // 先恢复设置，再渲染，避免动效闪烁
    safe('tickClock', tickClock);
    setInterval(tickClock, 1000);
    safe('initForm', initForm);
    safe('initPerfMonitor', initPerfMonitor);
    safe('render', render);
    safe('initSplash', initSplash);       // 启动开场：Web 覆盖层接棒原生闪屏（无插件时仅淡出覆盖层）
    safe('initSkyClouds', initSkyClouds); // 主天空云彩层（共享云引擎，与开场同一片云）
    // 许愿池不依赖城市数据，同步初始化（避免城市加载失败时永远不出现）
    safe('initWishes', initWishes);
    safe('renderWishes', renderWishes);
    safe('initRemind', initRemind);
    // 网络恢复后自动重试天气（PLAN v0.2 · Phase 4 断网降级链路）
    window.addEventListener('online', function () {
      if (currentCity) refreshWeather();
    });
    // 天气温度自动刷新（v0.6.2）：按设置间隔自动拉取；切后台暂停、回前台立即刷、静默降级
    startWeatherAutoRefresh();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopWeatherAutoRefresh();        // 后台暂停：省电省流量
      } else {
        autoRefreshWeather();            // 回前台立即刷新一次（绕过 15 分钟缓存）
        startWeatherAutoRefresh();       // 按当前设置重启定时器
      }
    });
    // 城市数据与天气异步启动，不阻塞主界面（失败仅缺天气，不影响其余）
    loadCities().then(function() {
      safe('initCityPicker', initCityPicker);
      safe('initSettings', initSettings);
      safe('initWeatherEffects', initWeatherEffects);
      // 启动时拉取天气（失败静默降级，不弹错）
      ShiNianWeather.fetch(currentCity).then(function(data){
        updateWeatherDisplay(data);
        window.dispatchEvent(new CustomEvent('cityChange', {detail: {city: currentCity, weather: data}}));
      }).catch(function () { if (window.console) console.warn('[时念] 天气拉取失败（降级）'); });
    }).catch(function () {
      if (window.console) console.warn('[时念] 城市数据加载失败（使用默认城市）');
    });
  }

  // v0.6.3 · P1：暴露最小测试钩子（仅供单测使用，不影响运行时行为）。
  // 与 decor.js 的 _test 保持一致：把需要断言的内部函数挂到 window，便于自动化校验。
  window.ShiNianApp = {
    autoRefreshWeather: autoRefreshWeather,
    updateWeatherDisplay: updateWeatherDisplay,
    startWeatherAutoRefresh: startWeatherAutoRefresh,
    stopWeatherAutoRefresh: stopWeatherAutoRefresh,
    getSettings: function () { return settings; },
    setWeatherRefreshMin: function (v) { settings.weatherRefreshMin = v; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
