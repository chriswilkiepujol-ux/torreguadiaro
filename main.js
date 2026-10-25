(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var top = document.querySelector('.top');
  var firstScene = document.querySelector('.scene');

  /* ───────── Header: solid once past the first scene ───────── */
  var sceneEls = document.querySelectorAll('.scene');
  function headerState() {
    var inScene = false;
    for (var i = 0; i < sceneEls.length; i++) {
      var r = sceneEls[i].getBoundingClientRect();
      if (r.top <= 40 && r.bottom >= 40) { inScene = true; break; }
    }
    top.classList.toggle('is-solid', !inScene);
  }

  /* ───────── Mobile menu ───────── */
  var menuBtn = document.querySelector('.menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) top.classList.add('is-solid'); else headerState();
  }
  menuBtn.addEventListener('click', function () {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });
  mobileNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  /* ───────── Lightbox (watch with sound) ───────── */
  var lightbox = document.getElementById('lightbox');
  var lbVideo = lightbox.querySelector('.lightbox-video');
  var lbClose = lightbox.querySelector('.lightbox-close');
  var lastTrigger = null;
  function openLightbox(src, poster, trigger) {
    lastTrigger = trigger;
    lbVideo.src = src;
    lbVideo.poster = poster || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lbVideo.play().catch(function () {});
    lbClose.focus();
  }
  function closeLightbox() {
    lbVideo.pause();
    lbVideo.removeAttribute('src');
    lbVideo.load();
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (lastTrigger) lastTrigger.focus();
  }
  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!lightbox.hidden) closeLightbox();
      else if (menuBtn.getAttribute('aria-expanded') === 'true') setMenu(false);
    }
  });

  /* ───────── Scroll-scrubbed scenes ───────── */
  var scenes = [];
  document.querySelectorAll('[data-scene]').forEach(function (el) {
    var video = el.querySelector('.scene-video');
    var bar = el.querySelector('.scene-progress span');
    var copies = Array.prototype.map.call(el.querySelectorAll('.scene-copy'), function (c) {
      return { el: c, from: parseFloat(c.dataset.from), to: parseFloat(c.dataset.to), on: null };
    });
    var scene = {
      el: el, video: video, bar: bar, copies: copies,
      src: el.dataset.src, full: el.dataset.full, poster: el.dataset.poster,
      duration: 0, target: 0, current: 0, loaded: false, progress: 0, lastSeek: -1
    };
    var watch = el.querySelector('[data-watch]');
    if (watch) watch.addEventListener('click', function () { openLightbox(scene.full, scene.poster, watch); });

    if (reduceMotion) {
      /* Reduced motion: plain looping video, no scrubbing */
      el.classList.add('is-static');
      video.src = scene.full;
      video.loop = true;
      video.autoplay = true;
      video.load();
      copies.forEach(function (c) { c.el.style.opacity = 1; c.el.style.transform = 'none'; });
      return;
    }

    video.addEventListener('loadedmetadata', function () {
      scene.duration = video.duration || 0;
      scene.loaded = true;
    });
    video.src = scene.src;
    scenes.push(scene);
  });

  /* iOS/Safari need one play() before currentTime renders frames. Unlock on first gesture. */
  var unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    scenes.forEach(function (s) {
      var p = s.video.play();
      if (p && p.then) p.then(function () { s.video.pause(); }).catch(function () {});
      else s.video.pause();
    });
  }
  ['touchstart', 'pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: true, passive: true });
  });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function updateScene(s) {
    var rect = s.el.getBoundingClientRect();
    var vh = window.innerHeight;
    var total = rect.height - vh;
    var p = clamp(-rect.top / total, 0, 1);
    s.progress = p;

    /* Warm the next scene's video when it is within a viewport of entering */
    if (rect.top < vh * 1.5 && s.video.preload !== 'auto') {
      s.video.preload = 'auto';
      s.video.load();
    }

    /* Only scrub while the scene is on screen */
    var visible = rect.bottom > 0 && rect.top < vh;
    if (!visible) return;

    if (s.loaded && s.duration) s.target = p * s.duration;
    if (s.bar) s.bar.style.width = (p * 100).toFixed(2) + '%';

    s.copies.forEach(function (c) {
      var span = c.to - c.from;
      var fade = Math.min(0.08, span * 0.3);
      var o;
      if (p < c.from || p > c.to) o = 0;
      else if (c.from <= 0 && p < fade) o = 1; /* opening copy is on from the very top */
      else if (p < c.from + fade) o = ease((p - c.from) / fade);
      else if (p > c.to - fade) o = ease((c.to - p) / fade);
      else o = 1;
      if (c.to >= 1 && p >= c.to - fade) o = 1; /* last caption stays until the scene ends */
      c.el.style.opacity = o.toFixed(3);
      c.el.style.transform = 'translateY(' + ((1 - o) * 18).toFixed(1) + 'px)';
      var on = o > 0.05;
      if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); }
    });
  }

  var ticking = false;
  function frame() {
    ticking = false;
    scenes.forEach(function (s) {
      updateScene(s);
      if (!s.loaded) return;
      /* Smooth the seek so fast scrolling doesn't stutter */
      var diff = s.target - s.current;
      s.current += diff * 0.16;
      if (Math.abs(diff) < 0.01) s.current = s.target;
      if (Math.abs(s.current - s.lastSeek) > 0.02 && s.video.readyState >= 1) {
        try { s.video.currentTime = s.current; s.lastSeek = s.current; } catch (e) {}
      }
      if (Math.abs(diff) > 0.011) requestTick();
    });
  }
  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }
  window.addEventListener('scroll', function () { requestTick(); headerState(); }, { passive: true });
  window.addEventListener('resize', requestTick);
  window.addEventListener('load', function () { requestTick(); headerState(); });
  requestTick();
  headerState();

  /* ───────── Viewing form: build a mailto with the details filled in ───────── */
  var form = document.querySelector('[data-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var to = form.getAttribute('action').replace('mailto:', '');
      var subject = 'Viewing request — Seventh Floor, Torreguadiaro (Ref. TG-7)';
      var body =
        'Name: ' + data.get('name') + '\n' +
        'Email: ' + data.get('email') + '\n' +
        'Phone: ' + (data.get('phone') || '-') + '\n\n' +
        (data.get('message') || '');
      window.location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      var note = document.createElement('p');
      note.className = 'form-sent';
      note.textContent = 'Your email app should now open with the request ready to send. If it did not, write to ' + to + ' and we will come back to you within one working day.';
      form.replaceWith(note);
    });
  }
})();
