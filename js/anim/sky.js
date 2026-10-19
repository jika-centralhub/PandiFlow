// Ciel du soir animé : étoiles qui scintillent (canvas), lune, nuages, collines et étoiles filantes.
import { prefersReducedMotion, rand } from '../lib/util.js';

export function initSky(root) {
  root.innerHTML = '';
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  const moon = document.createElement('div');
  moon.className = 'sky-moon';
  root.appendChild(moon);

  for (let i = 0; i < 4; i++) {
    const c = document.createElement('div');
    c.className = 'sky-cloud';
    c.style.top = `${12 + i * 17 + rand(-4, 4)}%`;
    c.style.width = `${rand(14, 26)}vw`;
    c.style.animationDuration = `${rand(70, 120)}s`;
    c.style.animationDelay = `${-rand(0, 100)}s`;
    c.style.opacity = String(rand(0.5, 1));
    root.appendChild(c);
  }

  root.insertAdjacentHTML(
    'beforeend',
    `<svg class="sky-hills" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 110 C120 60 240 70 360 100 C480 130 560 70 700 80 C820 90 900 120 1000 95 L1000 160 L0 160 Z" fill="#2a1f5c" opacity=".75"/>
      <path d="M0 135 C150 105 300 120 450 132 C600 144 760 104 1000 128 L1000 160 L0 160 Z" fill="#1c1645"/>
    </svg>`,
  );

  const g = canvas.getContext('2d');
  let stars = [];
  let shooting = null;
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = root.clientWidth;
    h = root.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 7000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.85,
      r: Math.random() < 0.12 ? rand(1.4, 2.2) : rand(0.5, 1.3),
      phase: Math.random() * Math.PI * 2,
      speed: rand(0.6, 2),
      hue: Math.random() < 0.2 ? 'rgba(255,236,170,' : 'rgba(255,255,255,',
    }));
    draw(performance.now());
  }

  function draw(t) {
    g.clearRect(0, 0, w, h);
    const still = prefersReducedMotion();
    for (const s of stars) {
      const a = still ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(s.phase + (t / 1000) * s.speed));
      g.fillStyle = `${s.hue}${a.toFixed(2)})`;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
      if (s.r > 1.4) {
        g.strokeStyle = `${s.hue}${(a * 0.5).toFixed(2)})`;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(s.x - s.r * 3, s.y);
        g.lineTo(s.x + s.r * 3, s.y);
        g.moveTo(s.x, s.y - s.r * 3);
        g.lineTo(s.x, s.y + s.r * 3);
        g.stroke();
      }
    }
    if (shooting) {
      const p = (t - shooting.start) / shooting.dur;
      if (p >= 1) shooting = null;
      else {
        const x = shooting.x + shooting.dx * p;
        const y = shooting.y + shooting.dy * p;
        const grad = g.createLinearGradient(x, y, x - shooting.dx * 0.18, y - shooting.dy * 0.18);
        grad.addColorStop(0, `rgba(255,255,255,${1 - p})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = grad;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - shooting.dx * 0.18, y - shooting.dy * 0.18);
        g.stroke();
      }
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (document.hidden || prefersReducedMotion()) return;
    if (t - last < 40) return; // ~25 images/s suffisent pour des étoiles
    last = t;
    if (!shooting && Math.random() < 0.004) {
      shooting = { x: rand(w * 0.1, w * 0.7), y: rand(0, h * 0.3), dx: rand(w * 0.25, w * 0.4), dy: rand(h * 0.12, h * 0.25), start: t, dur: 900 };
    }
    draw(t);
  }

  window.addEventListener('resize', resize);
  resize();
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
