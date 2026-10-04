/* ============================================================
   时念 · 应用层（时钟 + 倒数日）
   数据全部本地：localStorage['shinian.items.v1']
   ============================================================ */

(function () {
  'use strict';

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  // ---------- 时钟 ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tickClock() {
    var d = new Date();
    document.getElementById('hh').textContent = pad(d.getHours());
    document.getElementById('mm').textContent = pad(d.getMinutes());
    document.getElementById('ss').textContent = pad(d.getSeconds());
    document.getElementById('dateLine').textContent =
      d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WEEK[d.getDay()];
    var phase = document.documentElement.style.getPropertyValue('--phase-name');
    document.getElementById('phaseName').textContent = phase || '时念';
  }

  // ---------- 倒数日 ----------
  var KEY = 'shinian.items.v1';

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
        '<button type="button" class="cd-del" aria-label="删除 ' + item.name.replace(/"/g, '') + '">✕</button>';

      li.querySelector('.cd-name').textContent = item.name;

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

    // 日期默认值：今天
    var d = new Date();
    date.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var items = load();
      items.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.value.trim(),
        date: date.value
      });
      save(items);
      name.value = '';
      render();
    });
  }

  // ---------- 启动 ----------
  function boot() {
    tickClock();
    setInterval(tickClock, 1000);
    initForm();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
