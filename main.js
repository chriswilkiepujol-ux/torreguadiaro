// ============ Setup ============
const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches || (navigator.maxTouchPoints > 1 && screen.width < 900);

const sections = [
  { el: document.getElementById("scrub1"), video: document.getElementById("video1"), target: 0, current: 0 },
  { el: document.getElementById("scrub2"), video: document.getElementById("video2"), target: 0, current: 0 },
  { el: document.getElementById("scrub3"), video: document.getElementById("video3"), target: 0, current: 0 },
];

// Phones get the 720p versions: same clips, a third of the weight
if (IS_MOBILE) {
  sections[0].video.src = "scrub/living_720.mp4";
  sections[1].video.src = "scrub/kitchen_720.mp4";
  sections[2].video.src = "scrub/master_720.mp4";
}

// The third clip is far down the page: load it only when the layout
// section comes into view so it doesn't compete with the first two.
let video3Loaded = false;
function ensureVideo3() {
  if (video3Loaded) return;
  video3Loaded = true;
  sections[2].video.preload = "auto";
  sections[2].video.load();
}

const overlays = Array.from(document.querySelectorAll(".overlay")).map((el) => ({
  el,
  video: el.dataset.video,
  from: parseFloat(el.dataset.from),
  to: parseFloat(el.dataset.to),
}));

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// ============ Lenis: smooth scrolling with inertia ============
let lenis = null;
if (window.Lenis) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  window._lenis = lenis;
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (target) { e.preventDefault(); lenis.scrollTo(target, { duration: 1.4 }); }
    });
  });
}

// ============ Scrubbing ============
function sectionProgress(sec) {
  const rect = sec.el.getBoundingClientRect();
  const total = sec.el.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  return clamp01(-rect.top / total);
}

function updateOverlays(videoIndex, progress) {
  for (const ov of overlays) {
    if (ov.video !== String(videoIndex)) continue;
    const span = ov.to - ov.from;
    const fadeZone = Math.min(0.06, span * 0.25);
    let opacity = 0;
    if (progress >= ov.from && progress <= ov.to) {
      // An overlay that starts at 0 is born visible (the hero)
      const inFade = ov.from <= 0 ? 1 : clamp01((progress - ov.from) / fadeZone);
      const outFade = clamp01((ov.to - progress) / fadeZone);
      opacity = Math.min(inFade, outFade);
    }
    ov.el.style.opacity = opacity.toFixed(3);
    ov.el.style.setProperty("--dy", `${((1 - opacity) * 24).toFixed(1)}px`);
  }
}

// One loop: Lenis + progress + time smoothing + gated seek.
// A new seek is only requested once the previous one has finished
// (video.seeking === false), so seeks never queue up — queued seeks
// are what produce the jumps.
let lastT = performance.now();
function frame(now) {
  if (lenis) lenis.raf(now);

  const dt = Math.min(0.05, (now - lastT) / 1000) || 0.016;
  lastT = now;
  const alpha = 1 - Math.exp(-dt * 9); // framerate-independent smoothing

  sections.forEach((sec, i) => {
    const p = sectionProgress(sec);
    if (sec.video.duration) {
      sec.target = p * Math.max(0, sec.video.duration - 0.05);
    }
    updateOverlays(i + 1, p);

    if (sec.video.readyState >= 2) {
      sec.current += (sec.target - sec.current) * alpha;
      if (!sec.video.seeking && Math.abs(sec.video.currentTime - sec.current) > 0.02) {
        sec.video.currentTime = sec.current;
      }
    }
  });

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// iOS/Android: videos don't paint frames until a play(); force one on
// the first touch and pause straight away.
function unlockVideos() {
  sections.forEach((sec) => {
    sec.video.play().then(() => sec.video.pause()).catch(() => {});
  });
}
window.addEventListener("touchstart", unlockVideos, { once: true, passive: true });

// ============ Loader ============
// Reveal the page as soon as the FIRST video has its first frame
// (readyState >= 2). We don't wait for everything to download.
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
let revealed = false;

function reveal() {
  if (revealed) return;
  revealed = true;
  loaderFill.style.width = "100%";
  setTimeout(() => loader.classList.add("done"), 250);
  // Once the first is visible, let the second preload fully
  setTimeout(() => {
    sections[1].video.preload = "auto";
    sections[1].video.load();
  }, 1200);
}

const firstVideo = sections[0].video;
if (firstVideo.readyState >= 2) {
  reveal();
} else {
  firstVideo.addEventListener("loadeddata", reveal, { once: true });
  firstVideo.addEventListener("canplay", reveal, { once: true });
}

// Indicative progress bar while loading
firstVideo.addEventListener("progress", () => {
  if (revealed || !firstVideo.duration) return;
  try {
    if (firstVideo.buffered.length) {
      const pct = (firstVideo.buffered.end(0) / firstVideo.duration) * 100;
      loaderFill.style.width = `${Math.min(95, pct)}%`;
    }
  } catch (e) {}
});

// Safety net: whatever happens, show the page after 4s
setTimeout(reveal, 4000);

// Preload the third video when the layout section approaches
const planosEl = document.getElementById("planos");
if (planosEl && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { ensureVideo3(); io.disconnect(); }
  }, { rootMargin: "600px" });
  io.observe(planosEl);
} else {
  setTimeout(ensureVideo3, 4000);
}

// ============ Gallery carousel ============
const track = document.getElementById("carTrack");
const slides = track.children.length;
const dotsWrap = document.getElementById("carDots");
let index = 0;

for (let i = 0; i < slides; i++) {
  const dot = document.createElement("button");
  dot.className = "car-dot" + (i === 0 ? " active" : "");
  dot.setAttribute("aria-label", `Photo ${i + 1}`);
  dot.addEventListener("click", () => goTo(i));
  dotsWrap.appendChild(dot);
}

function goTo(i) {
  index = (i + slides) % slides;
  track.style.transform = `translateX(-${index * 100}%)`;
  dotsWrap.querySelectorAll(".car-dot").forEach((d, j) => {
    d.classList.toggle("active", j === index);
  });
}

document.getElementById("carPrev").addEventListener("click", () => goTo(index - 1));
document.getElementById("carNext").addEventListener("click", () => goTo(index + 1));

// Touch swipe on the carousel
const viewport = document.querySelector(".car-viewport");
let touchX = null;
viewport.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
viewport.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1));
  touchX = null;
}, { passive: true });
