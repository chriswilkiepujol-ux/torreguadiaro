(function () {
  'use strict';

  /* Header: turn solid once past the hero */
  var top = document.querySelector('.top');
  var hero = document.querySelector('.hero');
  function onScroll() {
    var solid = window.scrollY > (hero ? hero.offsetHeight - 80 : 200);
    top.classList.toggle('is-solid', solid);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  var menuBtn = document.querySelector('.menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) top.classList.add('is-solid'); else onScroll();
  }
  menuBtn.addEventListener('click', function () {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });
  mobileNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  /* Hero sound toggle */
  var heroVideo = document.querySelector('.hero-video');
  var soundBtn = document.querySelector('[data-sound]');
  if (heroVideo && soundBtn) {
    soundBtn.addEventListener('click', function () {
      var on = heroVideo.muted;
      heroVideo.muted = !on;
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.querySelector('span').textContent = on ? 'Mute' : 'Sound';
      if (on && heroVideo.paused) heroVideo.play().catch(function () {});
    });
    /* Save data: pause hero video when it leaves the viewport */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) heroVideo.play().catch(function () {});
          else heroVideo.pause();
        });
      }, { threshold: 0.1 }).observe(heroVideo);
    }
  }

  /* Tour videos: play in a full-screen lightbox with sound */
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

  document.querySelectorAll('.tour-media').forEach(function (fig) {
    var video = fig.querySelector('video');
    var btn = fig.querySelector('.play');
    var src = video.querySelector('source').getAttribute('src');
    function go() { openLightbox(src, video.getAttribute('poster'), btn); }
    btn.addEventListener('click', go);
    video.addEventListener('click', go);
  });

  /* Viewing form: build a mailto with the details filled in */
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
