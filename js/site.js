/* ==========================================================================
   Department of Operational Research, University of Delhi
   Shared behaviour for every page. Loaded from <head>, no dependencies.

   - Colour theme (purple | maroon) and light/dark mode, remembered per browser
   - Text size controls (A+ / A-), remembered per browser
   - Mobile menu with expandable sub-menus
   - Current page marker in the main menu and current section in the side menu
   - Anchor links that land below the sticky header (also for links such as
     about-us.html#history coming from another page)
   - Login dropdown that works on touch screens
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var THEMES = ['purple', 'maroon'];
  var KEY = { theme: 'ordu-theme', mode: 'ordu-mode', size: 'ordu-text-step' };
  var MIN_STEP = -3, MAX_STEP = 8;      // one step is 1px on a 16px base

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  /* ---- 1. Apply saved preferences before first paint ------------------- */
  var NAV_BREAKPOINT = 1120;
  root.classList.add('js');
  if (window.innerWidth <= NAV_BREAKPOINT) root.classList.add('nav-compact');

  var theme = null;
  try { theme = new URLSearchParams(location.search).get('theme'); } catch (e) { /* old browser */ }
  if (THEMES.indexOf(theme) > -1) write(KEY.theme, theme); else theme = read(KEY.theme);
  if (THEMES.indexOf(theme) < 0) theme = 'purple';
  root.setAttribute('data-theme', theme);

  var mode = read(KEY.mode) === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-mode', mode);

  var step = parseInt(read(KEY.size), 10);
  if (isNaN(step)) step = 0;
  step = Math.max(MIN_STEP, Math.min(MAX_STEP, step));
  applyStep();

  function applyStep() {
    root.style.fontSize = step === 0 ? '' : ((16 + step) / 16 * 100) + '%';
  }

  function setTheme(name) {
    if (THEMES.indexOf(name) < 0) return;
    theme = name;
    root.setAttribute('data-theme', name);
    write(KEY.theme, name);
    markSwatches();
  }

  function setMode(next) {
    mode = next;
    root.setAttribute('data-mode', mode);
    if (document.body) document.body.classList.toggle('dark-mode', mode === 'dark');
    write(KEY.mode, mode);
    var btn = document.querySelector('[data-role="mode-toggle"]');
    if (btn) btn.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
  }

  // The header buttons call these by name (inline onclick), on every page.
  window.toggleTheme = function () { setMode(mode === 'dark' ? 'light' : 'dark'); };
  window.adjustFontSize = function (change) {
    step = Math.max(MIN_STEP, Math.min(MAX_STEP, step + (change > 0 ? 1 : -1)));
    applyStep();
    write(KEY.size, String(step));
    fitNav();
  };

  /* ---- 2. Everything that needs the DOM -------------------------------- */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  var header;           // .top-full-header (sticky)
  var navToggle;        // menu button created in setupNavigation()
  var swatchGroups = [];

  function updateHeaderHeight() {
    if (!header) return;
    root.style.setProperty('--sticky-h', Math.round(header.getBoundingClientRect().height) + 'px');
  }

  ready(function () {
    header = document.querySelector('.top-full-header');

    // The page's own inline scripts define adjustFontSize/toggleTheme too;
    // re-assert ours now that they have all run.
    window.toggleTheme = function () { setMode(mode === 'dark' ? 'light' : 'dark'); };
    window.adjustFontSize = function (change) {
      step = Math.max(MIN_STEP, Math.min(MAX_STEP, step + (change > 0 ? 1 : -1)));
      applyStep();
      write(KEY.size, String(step));
      fitNav();
    };
    if (document.body) document.body.style.fontSize = '';
    document.body.classList.toggle('dark-mode', mode === 'dark');

    labelControls();
    setupThemeSwatches();
    setupSkipLink();
    setupNavigation();
    setupLoginDropdown();
    markCurrentPage();
    setupAnchors();
    setupScrollSpy();
    wrapTables();
    markTimeline();
    markUnlinked();
    setupMotion();

    fitNav();
    var pending = false;
    window.addEventListener('resize', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; fitNav(); });
    });
    window.addEventListener('load', fitNav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
    if (window.ResizeObserver && header) new ResizeObserver(updateHeaderHeight).observe(header);
  });

  /* ---- Header controls ------------------------------------------------- */
  function labelControls() {
    var buttons = document.querySelectorAll('.right-header button');
    Array.prototype.forEach.call(buttons, function (b) {
      var h = b.getAttribute('onclick') || '';
      if (h.indexOf('adjustFontSize(1)') > -1) { b.setAttribute('aria-label', 'Increase text size'); b.title = 'Increase text size'; }
      else if (h.indexOf('adjustFontSize(-1)') > -1) { b.setAttribute('aria-label', 'Decrease text size'); b.title = 'Decrease text size'; }
      else if (h.indexOf('toggleTheme') > -1) {
        b.setAttribute('data-role', 'mode-toggle');
        b.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
        b.title = 'Switch between light and dark mode';
      }
      else if (b.classList.contains('dropbtn')) { b.setAttribute('aria-haspopup', 'true'); }
    });
  }

  /* ---- Colour theme swatches ------------------------------------------- */
  function themeOfSwatch(group) {
    var first = group.querySelector('.color-swatch');
    if (!first) return null;
    var c = getComputedStyle(first).backgroundColor;          // rgb(r, g, b)
    var m = c.match(/\d+/g);
    if (!m) return null;
    var r = +m[0], g = +m[1];
    return (r > 120 && g < 40) || (r > 90 && g < 20) ? 'maroon' : 'purple';
  }

  function buildSwatchGroup(name, colors, label) {
    var g = document.createElement('div');
    g.className = 'theme-preview';
    colors.forEach(function (c) {
      var a = document.createElement('a');
      a.href = '?theme=' + name;
      var s = document.createElement('div');
      s.className = 'color-swatch';
      s.style.backgroundColor = c;
      a.appendChild(s);
      g.appendChild(a);
    });
    g.setAttribute('data-label', label);
    return g;
  }

  function setupThemeSwatches() {
    var bar = document.querySelector('.right-header');
    if (!bar) return;
    var groups = Array.prototype.slice.call(bar.querySelectorAll('.theme-preview'));

    // Pages without the swatches get the same two, so the theme can be
    // changed from anywhere.
    if (!groups.length) {
      var anchor = bar.firstElementChild;
      var p = buildSwatchGroup('purple', ['#652b7c', '#d15eff'], 'Purple theme');
      var m = buildSwatchGroup('maroon', ['#a00000', '#ffcc00'], 'Maroon and gold theme');
      bar.insertBefore(p, anchor);
      bar.insertBefore(m, anchor);
      groups = [p, m];
    }

    swatchGroups = groups.map(function (g) {
      var name = themeOfSwatch(g) || 'purple';
      var label = name === 'maroon' ? 'Maroon and gold theme' : 'Purple theme';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', label);
      Array.prototype.forEach.call(g.querySelectorAll('a'), function (a, i) {
        a.title = label;
        a.removeAttribute('target');
        a.addEventListener('click', function (e) { e.preventDefault(); setTheme(name); });
        if (i === 0) {
          a.setAttribute('role', 'button');
          a.setAttribute('aria-label', label);
        } else {                       // the second colour half is the same control
          a.setAttribute('aria-hidden', 'true');
          a.setAttribute('tabindex', '-1');
        }
      });
      return { el: g, name: name };
    });
    markSwatches();
  }

  function markSwatches() {
    swatchGroups.forEach(function (s) {
      var on = s.name === theme;
      s.el.classList.toggle('is-active', on);
      var first = s.el.querySelector('a');
      if (first) first.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---- Skip link ------------------------------------------------------- */
  function setupSkipLink() {
    var target = document.querySelector('.about-content') ||
                 document.querySelector('section.slider') ||
                 document.querySelector('.news-announcements');
    if (!target) return;
    if (!target.id) target.id = 'main-content';
    target.setAttribute('tabindex', '-1');
    var a = document.createElement('a');
    a.className = 'skip-link';
    a.href = '#' + target.id;
    a.textContent = 'Skip to main content';
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* ---- Collapse the menu when it does not fit on one row ---------------- */
  function fitNav() {
    var list = document.querySelector('.navbar .nav-menu');
    if (!list || !list.children.length) { updateHeaderHeight(); return; }
    root.classList.remove('nav-compact');                  // measure the full menu
    var compact = window.innerWidth <= NAV_BREAKPOINT;
    if (!compact) {
      var firstRow = list.children[0].offsetTop;
      for (var i = 1; i < list.children.length; i++) {
        if (list.children[i].offsetTop !== firstRow) { compact = true; break; }
      }
    }
    root.classList.toggle('nav-compact', compact);
    if (!compact && header && header.classList.contains('is-open')) {
      header.classList.remove('is-open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
    updateHeaderHeight();
  }

  /* ---- Mobile navigation ----------------------------------------------- */
  function setupNavigation() {
    var main = document.querySelector('.main-header');
    var nav = document.querySelector('.navbar');
    if (!header || !main || !nav) return;

    var list = nav.querySelector('.nav-menu');
    if (list && !list.id) list.id = 'primary-nav';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', list ? list.id : 'primary-nav');
    toggle.setAttribute('aria-label', 'Menu');
    toggle.innerHTML = '<span class="nav-toggle__bars" aria-hidden="true"></span>' +
                       '<span class="nav-toggle__label">Menu</span>';
    main.appendChild(toggle);
    navToggle = toggle;

    function setOpen(open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      updateHeaderHeight();
    }
    toggle.addEventListener('click', function () { setOpen(!header.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    header.addEventListener('menu-close', function () { setOpen(false); });

    // Expand/collapse buttons for items that have a sub-menu
    var items = nav.querySelectorAll('.nav-menu > .nav-item');
    Array.prototype.forEach.call(items, function (item) {
      var sub = item.querySelector(':scope > .dropdown-menu');
      var link = item.querySelector(':scope > a');
      if (!sub || !link) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'subnav-toggle';
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-label', 'Show ' + link.textContent.trim() + ' pages');
      b.addEventListener('click', function () {
        var open = !item.classList.contains('is-expanded');
        item.classList.toggle('is-expanded', open);
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        updateHeaderHeight();
      });
      link.insertAdjacentElement('afterend', b);
    });

    // Following a link inside the menu closes it (same-page anchors included)
    nav.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && header.classList.contains('is-open')) setOpen(false);
    });
  }

  /* ---- Login dropdown on touch screens --------------------------------- */
  function setupLoginDropdown() {
    var dd = document.querySelector('.login-dropdown');
    if (!dd) return;
    var btn = dd.querySelector('.dropbtn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains('is-open');
      dd.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) { dd.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { dd.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---- Current page in the main menu ----------------------------------- */
  function markCurrentPage() {
    var file = decodeURIComponent(location.pathname.split('/').pop() || '') || 'index.html';
    var links = document.querySelectorAll('.nav-menu > .nav-item > a');
    Array.prototype.forEach.call(links, function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0];
      if (href === file) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---- Anchor links ----------------------------------------------------- */
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function targetFor(hash) {
    if (!hash || hash.length < 2) return null;
    var id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (e) { id = hash.slice(1); }
    return document.getElementById(id);
  }

  function setupAnchors() {
    // The pages' inline scripts scroll to a fixed 190px offset. Handle same-page
    // anchors first (capture phase) so the offset matches the real header.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var href = a.getAttribute('href');
      if (href === '#') { e.preventDefault(); return; }       // placeholder link: do not jump to top
      var t = targetFor(href);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      t.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      try { history.pushState(null, '', href); } catch (err) { /* file:// */ }
      if (header) header.dispatchEvent(new Event('menu-close'));
    }, true);

    // Links such as about-us.html#history: take the hash out of the URL until
    // the page's own load handler has run, then scroll with the right offset.
    var initial = location.hash;
    if (initial.length > 1 && targetFor(initial)) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { return; }
      window.addEventListener('load', function () {
        try { history.replaceState(null, '', location.pathname + location.search + initial); } catch (err) { /* ignore */ }
        var t = targetFor(initial);
        if (t) setTimeout(function () { t.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 60);
      });
    }
  }

  /* ---- Small scroll animations ------------------------------------------- */
  function setupMotion() {
    if (reducedMotion() || !('IntersectionObserver' in window)) return;
    var selectors = [
      '.section-head', '.pathway', '.panel', '.theme', '.person', '.careers__intro',
      '.careers__stats > div', '.mosaic figure', '.about > h3', '.about > p', '.about > .about-photo',
      '.welcome-message > h3', '.welcome-message > p', '.highlights > h3', '.highlights li', '.stat-card',
      '.about-content > .about-title', '.faculty-card', '.staff-card', '.alumni-card', '.book-item', '.placement-card'
    ].join(',');
    var items = Array.prototype.slice.call(document.querySelectorAll(selectors));
    items = items.filter(function (el) { return !el.closest('.slider'); });
    if (!items.length) return;

    items.forEach(function (el) {
      var idx = 0, sib = el.previousElementSibling;
      while (sib) { if (sib.matches(selectors)) idx++; sib = sib.previousElementSibling; }
      el.classList.add('reveal');
      el.setAttribute('data-reveal-delay', String(Math.min(idx, 6) * 70));
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        el.style.transitionDelay = (el.getAttribute('data-reveal-delay') || '0') + 'ms';
        el.classList.add('is-visible');
        // hand the element back to its normal styles once the entrance has finished
        setTimeout(function () {
          el.classList.remove('reveal', 'is-visible');
          el.style.transitionDelay = '';
          el.removeAttribute('data-reveal-delay');
        }, 1300);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });

    // Stats count up once when they scroll into view
    var stats = document.querySelector('.stats-container');
    if (stats) {
      var counters = Array.prototype.slice.call(stats.querySelectorAll('.stat-card h2'));
      var cio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        cio.disconnect();
        counters.forEach(function (h) {
          var m = h.textContent.trim().match(/^(\d+)(.*)$/);
          if (!m) return;
          var target = parseInt(m[1], 10), suffix = m[2], start = null, dur = 1000, original = h.textContent;
          function frame(t) {
            if (start === null) start = t;
            var p = Math.min(1, (t - start) / dur);
            var eased = 1 - Math.pow(1 - p, 3);
            h.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(frame); else h.textContent = original;
          }
          requestAnimationFrame(frame);
        });
      }, { threshold: 0.4 });
      cio.observe(stats);
    }
  }

  /* ---- Links that do not have a destination yet ------------------------- */
  function markUnlinked() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href="#"]'), function (a) {
      if (a.classList.contains('skip-link')) return;
      a.classList.add('is-unlinked');
      a.setAttribute('aria-disabled', 'true');
      a.setAttribute('tabindex', '-1');
      if (!a.title) a.title = 'This link is not available yet';
    });
  }

  /* ---- Academic calendar: past / now / next ------------------------------ */
  function markTimeline() {
    var items = document.querySelectorAll('.timeline li[data-date]');
    if (!items.length) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var nextSet = false;
    Array.prototype.forEach.call(items, function (li) {
      var start = new Date(li.getAttribute('data-date') + 'T00:00:00');
      var end = new Date((li.getAttribute('data-end') || li.getAttribute('data-date')) + 'T00:00:00');
      if (end < today) li.classList.add('is-past');
      else if (start <= today) li.classList.add('is-now');
      else if (!nextSet) { li.classList.add('is-next'); nextSet = true; }
    });
  }

  /* ---- Wide tables scroll inside their own box -------------------------- */
  function wrapTables() {
    var wrappers = [];
    Array.prototype.forEach.call(document.querySelectorAll('table'), function (t) {
      if (t.parentElement && t.parentElement.classList.contains('table-scroll')) return;
      var w = document.createElement('div');
      w.className = 'table-scroll';
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
      wrappers.push(w);
    });
    function check() {
      wrappers.forEach(function (w) {
        var scrolls = w.scrollWidth > w.clientWidth + 1;
        if (scrolls) {
          w.setAttribute('tabindex', '0');
          w.setAttribute('role', 'region');
          w.setAttribute('aria-label', 'Table: scroll sideways to see all columns');
        } else {
          w.removeAttribute('tabindex'); w.removeAttribute('role'); w.removeAttribute('aria-label');
        }
      });
    }
    check();
    window.addEventListener('resize', check);
    window.addEventListener('load', check);
  }

  /* ---- Highlight the current section in the side menu ------------------- */
  function setupScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.about-menu a[href^="#"]'));
    if (!links.length) return;
    var pairs = [];
    links.forEach(function (a) {
      var t = targetFor(a.getAttribute('href'));
      if (t) pairs.push({ a: a, t: t });
    });
    if (!pairs.length) return;

    var ticking = false;
    function update() {
      ticking = false;
      var line = (header ? header.getBoundingClientRect().height : 0) + 40;
      var current = null, best = -Infinity;
      pairs.forEach(function (p) {
        var top = p.t.getBoundingClientRect().top;
        if (top <= line && top > best) { best = top; current = p.t; }
      });
      pairs.forEach(function (p) { p.a.classList.toggle('is-current', !!current && p.t === current); });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('load', update);
    update();
  }
})();
