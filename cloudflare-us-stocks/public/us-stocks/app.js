/* =====================================================================
   美股第一課 · 單章閱讀器與互動元件
   - 一次只顯示一章；讀到章末繼續往下捲（或按鈕／方向鍵）載入下一章
   - 切換時用全螢幕載入層做「往下滑」的轉場
   - 腳本失敗時頁面退回連續長文（見 index.html 的 inline script）
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(pointer: coarse)');
  var EASE_IO = 'cubic-bezier(.7, 0, .2, 1)';
  var EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';

  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var $ = function (id) { return document.getElementById(id); };

  var store = {
    read: function (k, d) {
      try { var v = localStorage.getItem('us-stocks:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    write: function (k, v) {
      try { localStorage.setItem('us-stocks:' + k, JSON.stringify(v)); } catch (e) { /* 私密模式等情況忽略 */ }
    }
  };

  /* 手機版表格：把表頭寫進每個儲存格的 data-label，配合 CSS 改為堆疊顯示 */
  document.querySelectorAll('table.tbl').forEach(function (table) {
    var heads = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      Array.prototype.forEach.call(tr.children, function (cell, i) { if (heads[i]) cell.setAttribute('data-label', heads[i]); });
    });
  });

  initWidgets();
  initTheme();

  if (!root.classList.contains('paged')) return;
  initReader();

  /* =====================================================================
     單章閱讀器
     ===================================================================== */
  function initReader() {
    var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
    var LAST = screens.length - 1;
    var meta = screens.map(function (el, i) {
      return {
        el: el,
        id: el.id,
        num: pad2(i),
        title: i === 0 ? '美股第一課' : el.querySelector('h1').textContent.trim(),
        short: el.getAttribute('data-short')
      };
    });
    var done = store.read('done', []);
    if (!Array.isArray(done)) done = [];
    var cur = -1;
    var busy = false;
    var queued = null; /* 轉場中收到的最後一次導覽（例如按上一頁），轉場結束後再執行 */

    var loader = $('loader'), loaderRoll = $('loaderRoll'), loaderBar = $('loaderBar');
    var loaderKicker = $('loaderKicker'), loaderTitle = $('loaderTitle');
    var whereNum = $('whereNum'), whereTitle = $('whereTitle');
    var topbar = document.querySelector('.topbar');
    var tocDialog = $('tocDialog'), tocList = $('tocList');
    var baseTitle = document.title;

    history.scrollRestoration = 'manual';

    /* ---------- 頂列分段進度 ---------- */
    var segBtns = [null];
    meta.slice(1).forEach(function (m, k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.setAttribute('aria-label', '第 ' + m.num + ' 章：' + m.title);
      var tip = document.createElement('span');
      tip.className = 'seg-tip';
      tip.textContent = m.num + ' ' + m.short;
      b.appendChild(tip);
      b.addEventListener('click', function () { go(k + 1); });
      $('segs').appendChild(b);
      segBtns.push(b);
    });

    /* ---------- 目錄面板 ---------- */
    var tocItems = [];
    meta.forEach(function (m, i) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + m.id;
      var n = document.createElement('span'); n.className = 'n'; n.textContent = i === 0 ? '00' : m.num;
      var t = document.createElement('span'); t.className = 't'; t.textContent = i === 0 ? '封面與目錄' : m.title;
      var s = document.createElement('span'); s.className = 's';
      a.appendChild(n); a.appendChild(t); a.appendChild(s);
      li.appendChild(a);
      tocList.appendChild(li);
      tocItems.push(li);
    });
    $('tocBtn').addEventListener('click', function () { tocDialog.showModal(); });
    $('tocClose').addEventListener('click', function () { tocDialog.close(); });
    tocDialog.addEventListener('click', function (e) { if (e.target === tocDialog) tocDialog.close(); });
    var coverTocItems = Array.prototype.slice.call(document.querySelectorAll('.cover-toc li'));
    coverTocItems.forEach(function (li, k) { li.style.setProperty('--i', k); });

    /* ---------- 章末卡片與拉動計量 ---------- */
    var pullText = coarse.matches ? '繼續往上滑，載入下一章' : '繼續往下捲動，載入下一章';
    var pullReady = coarse.matches ? '放開，載入下一章' : '載入下一章…';
    var meterHTML = function (text) {
      return '<svg class="pull-ring" viewBox="0 0 32 32"><circle class="trk" cx="16" cy="16" r="14"/><circle class="val" cx="16" cy="16" r="14"/></svg><span class="pull-text">' + text + '</span>';
    };

    meta.forEach(function (m, i) {
      if (i === 0) {
        var cm = document.createElement('div');
        cm.className = 'pull-meter cover-pull';
        cm.setAttribute('aria-hidden', 'true');
        cm.innerHTML = meterHTML(coarse.matches ? '往上滑，開始閱讀' : '往下捲動，開始閱讀');
        m.el.insertBefore(cm, m.el.querySelector('.tape'));
        return;
      }
      var end = document.createElement('footer');
      end.className = 'ch-end' + (i === LAST ? ' is-last' : '');
      var html = '<p class="ch-end-mark">' + (i === LAST ? '全文完' : '第 ' + m.num + ' 章 · 完') + '</p>';
      if (i < LAST) {
        var nx = meta[i + 1];
        html +=
          '<a class="ch-end-next" href="#' + nx.id + '">' +
            '<span class="lbl">下一章 · ' + nx.num + ' / ' + pad2(LAST) + '</span>' +
            '<span class="ttl"></span>' +
            '<span class="arrow" aria-hidden="true">↓</span>' +
          '</a>' +
          '<div class="pull-meter" aria-hidden="true">' + meterHTML(pullText) + '</div>' +
          '<div class="ch-end-alt">' +
            '<a class="btn btn-ghost" href="#' + meta[i - 1].id + '">← ' + (i === 1 ? '回到封面' : '上一章') + '</a>' +
            '<button class="btn btn-ghost" type="button" data-toc>目錄</button>' +
          '</div>';
      } else {
        html +=
          '<div class="ch-end-alt">' +
            '<a class="btn btn-primary" href="#top">回到封面</a>' +
            '<button class="btn btn-ghost" type="button" data-toc>目錄</button>' +
          '</div>';
      }
      end.innerHTML = html;
      if (i < LAST) end.querySelector('.ttl').textContent = meta[i + 1].title;
      m.el.appendChild(end);
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-toc]')) tocDialog.showModal();
    });

    /* ---------- 繼續閱讀 ---------- */
    var last = store.read('last', 0);
    var resumeBtn = $('resumeBtn');
    if (typeof last === 'number' && last > 0 && last <= LAST) {
      resumeBtn.href = '#' + meta[last].id;
      resumeBtn.textContent = '繼續閱讀 · ' + meta[last].num + ' ' + meta[last].short;
      resumeBtn.hidden = false;
    }

    /* ---------- 封面背景折線（固定種子的隨機漫步，往右上） ---------- */
    var coverPath = $('coverPath');
    if (coverPath) {
      var seed = 7, y = 300, pts = [];
      for (var x = 0; x <= 1200; x += 12) {
        seed = (seed * 16807) % 2147483647;
        y = clamp(y + (seed / 2147483647 - 0.5) * 34 - 1.6, 40, 370);
        pts.push(x + ' ' + y.toFixed(1));
      }
      coverPath.setAttribute('d', 'M' + pts.join(' L'));
      coverPath.setAttribute('pathLength', '1');
      coverPath.style.strokeDasharray = '1';
    }

    /* ---------- 狀態更新 ---------- */
    function markDone(i) {
      if (i <= 0 || done.indexOf(i) !== -1) return;
      done.push(i);
      store.write('done', done);
      paintState();
    }

    function paintState() {
      segBtns.forEach(function (b, i) {
        if (!b) return;
        b.classList.toggle('is-current', i === cur);
        b.classList.toggle('is-done', done.indexOf(i) !== -1 && i !== cur);
        if (i !== cur) b.style.removeProperty('--p');
        if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      tocItems.forEach(function (li, i) {
        li.classList.toggle('is-current', i === cur);
        li.classList.toggle('is-done', done.indexOf(i) !== -1 && i !== cur);
      });
      coverTocItems.forEach(function (li, k) { li.classList.toggle('is-done', done.indexOf(k + 1) !== -1); });
    }

    function activate(i) {
      screens.forEach(function (s, k) {
        s.classList.toggle('is-active', k === i);
        if (k !== i) s.classList.remove('is-entered', 'is-entering');
      });
      cur = i;
      window.scrollTo(0, 0);
      whereNum.textContent = meta[i].num;
      whereTitle.textContent = meta[i].short;
      document.title = i === 0 ? baseTitle : meta[i].num + ' ' + meta[i].title + '｜美股第一課';
      topbar.style.setProperty('--read', 0);
      resetPull();
      paintState();
    }

    function enter(i, anchor, focus) {
      var el = screens[i];
      if (!reduced.matches) {
        el.classList.add('is-entering');
        setTimeout(function () { el.classList.remove('is-entering'); }, 1600);
      }
      requestAnimationFrame(function () {
        el.classList.add('is-entered');
        countUp(el);
        if (i === 0 && coverPath && !reduced.matches) {
          coverPath.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 2400, easing: EASE_OUT, fill: 'both' });
        }
      });
      if (focus) {
        var h = el.querySelector('h1');
        if (h) h.focus({ preventScroll: true });
      }
      if (anchor) requestAnimationFrame(function () { anchor.scrollIntoView({ block: 'start' }); });
      store.write('last', i);
      pull.bottomSince = 0;
      onScroll();
    }

    function pushHash(i) {
      var url = i === 0 ? location.pathname + location.search : '#' + encodeURIComponent(meta[i].id);
      history.pushState({ i: i }, '', url);
    }

    /* ---------- 轉場 ---------- */
    function go(to, opt) {
      opt = opt || {};
      to = clamp(to, 0, LAST);
      if (busy) { queued = [to, opt]; return; }
      if (to === cur) {
        if (opt.anchor) opt.anchor.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (opt.push !== false) pushHash(to);
      if (tocDialog.open) tocDialog.close();

      var from = cur;
      if (from < 0 || reduced.matches || typeof loader.animate !== 'function') {
        activate(to);
        enter(to, opt.anchor, from >= 0);
        return;
      }

      busy = true;
      var dir = to > from ? 1 : -1;
      var fromEl = screens[from], toEl = screens[to];

      loaderKicker.textContent = to === 0 ? 'Back to cover' : (dir > 0 ? 'Loading chapter' : 'Back to chapter');
      loaderTitle.textContent = meta[to].title;
      var a = from === 0 ? '00' : meta[from].num, b = to === 0 ? '00' : meta[to].num;
      loaderRoll.innerHTML = '';
      (dir > 0 ? [a, b] : [b, a]).forEach(function (t) {
        var s = document.createElement('span'); s.textContent = t; loaderRoll.appendChild(s);
      });
      loader.hidden = false;

      var outA = fromEl.animate(
        [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0.15, transform: 'translateY(' + (-dir * 8) + 'vh)' }],
        { duration: 460, easing: EASE_IO, fill: 'forwards' });
      var inA = loader.animate(
        [{ transform: 'translateY(' + (dir * 100) + '%)' }, { transform: 'translateY(0)' }],
        { duration: 520, easing: EASE_IO, fill: 'both' });
      var barA = loaderBar.animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 680, delay: 260, easing: 'cubic-bezier(.6, 0, .3, 1)', fill: 'both' });
      var rollA = loaderRoll.animate(
        dir > 0 ? [{ transform: 'translateY(0)' }, { transform: 'translateY(-50%)' }]
                : [{ transform: 'translateY(-50%)' }, { transform: 'translateY(0)' }],
        { duration: 620, delay: 300, easing: EASE_OUT, fill: 'both' });

      Promise.all([inA.finished, barA.finished, rollA.finished]).then(function () {
        outA.cancel();
        activate(to);
        enter(to, opt.anchor, true);
        toEl.animate(
          [{ transform: 'translateY(' + (dir * 10) + 'vh)' }, { transform: 'translateY(0)' }],
          { duration: 820, easing: EASE_OUT });
        var exitA = loader.animate(
          [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (-dir * 100) + '%)' }],
          { duration: 620, easing: EASE_IO, fill: 'forwards' });
        return exitA.finished.then(function () {
          loader.hidden = true;
          [exitA, inA, barA, rollA].forEach(function (an) { an.cancel(); });
        });
      }).catch(function () {
        loader.hidden = true;
        activate(to);
        enter(to, opt.anchor, true);
      }).then(function () {
        busy = false;
        if (queued) { var q = queued; queued = null; go(q[0], q[1]); }
      });
    }

    /* ---------- 路由：hash ↔ 章節 ---------- */
    function resolve(hash) {
      var id = '';
      try { id = decodeURIComponent((hash || '').replace(/^#/, '')); } catch (e) { id = ''; }
      var el = id ? document.getElementById(id) : null;
      var s = el ? el.closest('.screen') : null;
      if (!s) return { i: 0, anchor: null };
      return { i: screens.indexOf(s), anchor: el === s ? null : el };
    }

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var r = resolve(a.getAttribute('href'));
      var id = a.getAttribute('href').slice(1);
      if (id && !document.getElementById(safeDecode(id))) return;
      if (id && !document.getElementById(safeDecode(id)).closest('.screen')) return; /* 例如跳到內容連結 */
      e.preventDefault();
      if (r.i === cur && r.anchor) {
        history.pushState({ i: r.i }, '', '#' + encodeURIComponent(r.anchor.id));
      }
      go(r.i, { anchor: r.anchor });
    });

    function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

    window.addEventListener('popstate', function () {
      var r = resolve(location.hash);
      go(r.i, { push: false, anchor: r.anchor });
    });
    window.addEventListener('hashchange', function () {
      var r = resolve(location.hash);
      if (r.i !== cur || r.anchor) go(r.i, { push: false, anchor: r.anchor });
    });

    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (tocDialog.open) return;
      var t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });

    /* ---------- 捲動進度與章末拉動 ---------- */
    var pull = { v: 0, gesture: false, lastWheel: 0, bottomSince: 0, decayT: 0, raf: 0, touch: null };
    var WHEEL_SPAN = 640, TOUCH_SPAN = 110;
    var scrollTick = false;

    function atBottom() {
      return Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
    }
    function bottomSettled() {
      return pull.bottomSince > 0 && performance.now() - pull.bottomSince > 260;
    }
    function canPull() { return !busy && cur >= 0 && cur < LAST && !tocDialog.open; }
    function meter() { return cur >= 0 ? screens[cur].querySelector('.pull-meter') : null; }

    function paintPull() {
      var m = meter();
      if (!m) return;
      m.style.setProperty('--p', pull.v.toFixed(3));
      m.classList.toggle('is-active', pull.v > 0);
      var label = m.querySelector('.pull-text');
      if (label && cur > 0) label.textContent = pull.v >= 1 ? pullReady : pullText;
    }
    function resetPull() {
      clearTimeout(pull.decayT);
      cancelAnimationFrame(pull.raf);
      pull.v = 0;
      pull.gesture = false;
      pull.touch = null;
      paintPull();
    }
    function decayLater() {
      clearTimeout(pull.decayT);
      cancelAnimationFrame(pull.raf);
      pull.decayT = setTimeout(function step() {
        if (pull.touch) return;
        pull.v = Math.max(0, pull.v - 0.045);
        paintPull();
        if (pull.v > 0) pull.raf = requestAnimationFrame(step);
      }, 280);
    }

    function onScroll() {
      if (cur < 0) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 1;
      topbar.style.setProperty('--read', p.toFixed(4));
      if (segBtns[cur]) segBtns[cur].style.setProperty('--p', p.toFixed(4));
      if (atBottom()) {
        if (!pull.bottomSince) pull.bottomSince = performance.now();
        if (cur > 0) markDone(cur);
      } else {
        pull.bottomSince = 0;
        if (pull.v && !pull.touch) resetPull();
      }
    }
    window.addEventListener('scroll', function () {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(function () { scrollTick = false; onScroll(); });
    }, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    /* 滑鼠／觸控板：只有「在章末停下後重新開始」的捲動才計入，避免慣性捲動直接衝進下一章 */
    window.addEventListener('wheel', function (e) {
      var now = performance.now();
      var fresh = now - pull.lastWheel > 200;
      pull.lastWheel = now;
      if (!canPull()) return;
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (fresh) pull.gesture = atBottom() && bottomSettled();
      if (dy <= 0) { if (pull.v) resetPull(); return; }
      if (!pull.gesture) return;
      pull.v = clamp(pull.v + dy / WHEEL_SPAN, 0, 1);
      paintPull();
      if (pull.v >= 1) { go(cur + 1); return; }
      decayLater();
    }, { passive: true });

    /* 觸控：在章末往上拉，滿格後放開才切換（類似下拉更新） */
    window.addEventListener('touchstart', function (e) {
      if (!canPull() || e.touches.length !== 1 || !atBottom() || !bottomSettled()) { pull.touch = null; return; }
      clearTimeout(pull.decayT);
      pull.touch = { y: e.touches[0].clientY };
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!pull.touch) return;
      pull.v = clamp((pull.touch.y - e.touches[0].clientY) / TOUCH_SPAN, 0, 1);
      paintPull();
    }, { passive: true });
    var touchEnd = function () {
      if (!pull.touch) return;
      pull.touch = null;
      if (pull.v >= 1 && canPull()) go(cur + 1);
      else decayLater();
    };
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('touchcancel', touchEnd, { passive: true });

    /* ---------- 啟動 ---------- */
    var start = resolve(location.hash);
    activate(start.i);
    root.classList.add('ready');
    enter(start.i, start.anchor, false);
  }

  /* =====================================================================
     數字跳動
     ===================================================================== */
  function countUp(scope) {
    if (reduced.matches) return;
    scope.querySelectorAll('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var dec = +(el.getAttribute('data-decimals') || 0);
      var sep = el.hasAttribute('data-sep');
      var fmt = function (v) { return sep ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec); };
      var t0 = performance.now(), D = 1200;
      (function frame(t) {
        var k = clamp((t - t0) / D, 0, 1);
        el.textContent = fmt(end * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(frame);
      })(t0);
    });
  }

  /* =====================================================================
     主題切換
     ===================================================================== */
  function initTheme() {
    var btn = $('themeBtn');
    if (!btn) return;
    var system = window.matchMedia('(prefers-color-scheme: light)');
    var current = function () { return root.getAttribute('data-theme') || (system.matches ? 'light' : 'dark'); };
    var label = function () {
      btn.setAttribute('aria-label', current() === 'dark' ? '切換為淺色主題' : '切換為深色主題');
    };
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('us-stocks:theme', next); } catch (e) { /* 忽略 */ }
      label();
    });
    label();
  }

  /* =====================================================================
     互動元件
     ===================================================================== */
  function initWidgets() {
    var fmtNT = function (n) { return 'NT$ ' + Math.round(n).toLocaleString('en-US'); };
    var syncRange = function (el) {
      el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
    };
    document.querySelectorAll('input[type="range"]').forEach(function (el) {
      syncRange(el);
      el.addEventListener('input', function () { syncRange(el); });
    });

    /* ---------- 複利試算 ---------- */
    var cmpAmt = $('cmpAmt'), cmpYr = $('cmpYr'), cmpRate = $('cmpRate');
    if (cmpAmt) {
      var growthSvg = $('growthSvg');
      var compound = function () {
        var m = +cmpAmt.value, y = +cmpYr.value, rate = +cmpRate.value;
        $('cmpAmtLab').textContent = 'NT$ ' + m.toLocaleString('en-US');
        $('cmpYrLab').textContent = y + ' 年';
        $('cmpRateLab').textContent = rate + '%';
        var n = y * 12, r = rate / 100 / 12;
        var fv = r > 0 ? m * ((Math.pow(1 + r, n) - 1) / r) : m * n;
        var prin = m * n;
        $('cmpPrin').textContent = fmtNT(prin);
        $('cmpGain').textContent = fmtNT(fv - prin);
        $('cmpFv').textContent = fmtNT(fv);
        // 對照組：同樣的總額若在第一天一次投入，放滿全期的複利結果
        $('cmpLump').textContent = fmtNT(prin * Math.pow(1 + rate / 100, y));
        $('r72rate').textContent = rate;
        $('r72').textContent = (72 / rate).toFixed(1);
        var W = 400, H = 130, p = 4, pts = [], pps = [];
        for (var i = 0; i <= y; i++) {
          var nn = i * 12;
          var v = r > 0 ? m * ((Math.pow(1 + r, nn) - 1) / r) : m * nn;
          var x = p + (W - 2 * p) * (y > 0 ? i / y : 0);
          pts.push([x, H - p - (H - 2 * p) * (fv > 0 ? v / fv : 0)]);
          pps.push([x, H - p - (H - 2 * p) * (fv > 0 ? m * nn / fv : 0)]);
        }
        var path = function (arr) {
          return arr.map(function (q, k) { return (k === 0 ? 'M' : 'L') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
        };
        var area = path(pts) + ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - p) + ' L ' + pts[0][0].toFixed(1) + ' ' + (H - p) + ' Z';
        growthSvg.innerHTML =
          '<defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="gg-a"/><stop offset="100%" class="gg-b"/></linearGradient></defs>' +
          '<path d="' + area + '" fill="url(#gg)"/>' +
          '<path d="' + path(pps) + '" class="g-prin" vector-effect="non-scaling-stroke"/>' +
          '<path d="' + path(pts) + '" class="g-line" vector-effect="non-scaling-stroke"/>';
      };
      [cmpAmt, cmpYr, cmpRate].forEach(function (el) { el.addEventListener('input', compound); });
      compound();
    }

    /* ---------- 漲跌顏色切換 ---------- */
    var demo = $('colorDemo'), cap = $('flipCap'), bUs = $('mUs'), bTw = $('mTw');
    if (demo) {
      var setMarket = function (mkt) {
        demo.setAttribute('data-market', mkt);
        var us = mkt === 'us';
        bUs.setAttribute('aria-pressed', String(us));
        bTw.setAttribute('aria-pressed', String(!us));
        cap.innerHTML = us
          ? '目前顯示 <strong>美股規則</strong>：<strong>綠色代表上漲</strong>、紅色代表下跌，和台股相反。'
          : '目前顯示 <strong>台股規則</strong>：<strong>紅色代表上漲</strong>、綠色代表下跌，這是你熟悉的習慣。';
      };
      bUs.addEventListener('click', function () { setMarket('us'); });
      bTw.addEventListener('click', function () { setMarket('tw'); });
    }

    /* ---------- 交割時間軸 ---------- */
    var tlNodes = Array.prototype.slice.call(document.querySelectorAll('.tl .node'));
    if (tlNodes.length) {
      var tlData = [
        ['T 日 · 交易日', '你在美股盤中賣出股票，成交。這天還拿不到可動用的現金。'],
        ['T+1 日 · 美國完成交割', '美股 2024/05/28 起為 T+1，款項在美國端完成交割，進入券商的國外帳戶。'],
        ['T+2 日 · 款項可動用', '款項轉入你的複委託交割帳戶（台幣或美元，視當初設定）。實際入帳與可提領時間，仍依各券商作業而定。']
      ];
      var setStep = function (i) {
        tlNodes.forEach(function (n, k) {
          n.classList.toggle('active', k <= i);
          n.setAttribute('aria-pressed', String(k === i));
        });
        $('tlFill').style.width = (i / (tlNodes.length - 1) * 100) + '%';
        $('tlKey').textContent = tlData[i][0];
        $('tlVal').textContent = tlData[i][1];
      };
      tlNodes.forEach(function (n) {
        n.addEventListener('click', function () { setStep(+n.getAttribute('data-step')); });
      });
      setStep(0);
    }

    /* ---------- 碎股試算 ---------- */
    var fracAmt = $('fracAmt'), fracPick = $('fracPick');
    if (fracAmt) {
      var RATE = 31.6, curTk = { tk: 'BRKB', price: 487 };
      var names = { BRKB: 'BRK.B', VOO: 'VOO', QQQM: 'QQQM' };
      var pickBtns = Array.prototype.slice.call(fracPick.querySelectorAll('button'));
      var frac = function () {
        var twd = +fracAmt.value, usd = twd / RATE, shares = usd / curTk.price;
        $('fracAmtLab').textContent = 'NT$ ' + twd.toLocaleString('en-US');
        $('fracTwd').textContent = 'NT$' + twd.toLocaleString('en-US');
        $('fracUsd').textContent = 'US$' + usd.toFixed(0);
        $('fracShares').textContent = '約 ' + shares.toFixed(shares < 1 ? 3 : 2) + ' 股';
        var months = Math.max(1, Math.round(curTk.price / usd));
        $('fracMonths').innerHTML = shares >= 1
          ? '每月就能買進 <strong>' + shares.toFixed(2) + '</strong> 股 ' + names[curTk.tk] + '。'
          : '大約 <strong>' + months + '</strong> 個月，可以湊滿 1 股 ' + names[curTk.tk] + '。';
      };
      fracAmt.addEventListener('input', frac);
      pickBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          pickBtns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          curTk = { tk: b.getAttribute('data-tk'), price: +b.getAttribute('data-price') };
          frac();
        });
      });
      frac();
    }

    /* ---------- 停損模擬 ---------- */
    var slPct = $('slPct');
    if (slPct) {
      var slSvg = $('slSvg');
      var series = [100, 103, 101, 105, 99, 96, 92, 88, 83, 78, 72, 68];
      var W = 360, H = 200, pd = 26, maxP = 110, minP = 60;
      var X = function (i) { return pd + (W - 2 * pd) * (i / (series.length - 1)); };
      var Y = function (v) { return pd + (H - 2 * pd) * (1 - (v - minP) / (maxP - minP)); };
      var drawSL = function () {
        var pct = +slPct.value, trig = 100 * (1 - pct / 100);
        $('slPctLab').textContent = pct + '%';
        $('slTrig').textContent = '$' + trig.toFixed(0);
        var ci = -1;
        for (var i = 0; i < series.length; i++) { if (series[i] <= trig) { ci = i; break; } }
        var line = series.map(function (v, k) { return (k === 0 ? 'M' : 'L') + X(k).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
        var trigY = Y(trig), marker = '', shade = '';
        if (ci >= 0) {
          var mx = X(ci), my = Y(series[ci]), labelX = Math.max(mx, 92);
          marker =
            '<circle class="sl-dot" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="5"/>' +
            '<rect class="sl-mark" x="' + (labelX - 30).toFixed(1) + '" y="' + (my - 27).toFixed(1) + '" width="60" height="17" rx="4"/>' +
            '<text class="sl-mark-t" x="' + labelX.toFixed(1) + '" y="' + (my - 15).toFixed(1) + '" text-anchor="middle">停損賣出</text>';
          shade = '<rect class="sl-shade" x="' + mx.toFixed(1) + '" y="' + pd + '" width="' + (W - pd - mx).toFixed(1) + '" height="' + (H - 2 * pd) + '"/>';
        }
        slSvg.innerHTML =
          '<rect class="sl-frame" x="' + pd + '" y="' + pd + '" width="' + (W - 2 * pd) + '" height="' + (H - 2 * pd) + '" rx="6"/>' +
          shade +
          '<line class="sl-buy" x1="' + pd + '" y1="' + Y(100).toFixed(1) + '" x2="' + (W - pd) + '" y2="' + Y(100).toFixed(1) + '"/>' +
          '<text class="sl-buy-t" x="' + pd + '" y="' + (Y(100) - 6).toFixed(1) + '">買進 $100</text>' +
          '<line class="sl-trig" x1="' + pd + '" y1="' + trigY.toFixed(1) + '" x2="' + (W - pd) + '" y2="' + trigY.toFixed(1) + '"/>' +
          '<text class="sl-trig-t" x="' + (W - pd) + '" y="' + (trigY - 6).toFixed(1) + '" text-anchor="end">停損 $' + trig.toFixed(0) + '</text>' +
          '<path class="sl-line" d="' + line + '"/>' +
          marker;
      };
      slPct.addEventListener('input', drawSL);
      drawSL();
    }
  }
})();
