// Effets spéciaux : pièces qui volent, étoiles qui éclatent, confettis, feux d'artifice.
import { COIN_SVG } from '../components/Coin.js';
import { prefersReducedMotion, rand, sleep } from '../lib/util.js';
import { sfx } from '../lib/sounds.js';

const layer = () => document.getElementById('fx-layer');
const gsap = () => window.gsap;

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Relance une animation CSS (retire puis remet la classe)
export function replay(el, cls, ms = 900) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// Pièces pandi qui volent en arc d'un élément vers le compteur
export async function flyCoins(fromEl, toEl, count, onEach) {
  if (!fromEl || !toEl || count <= 0) return;
  if (prefersReducedMotion() || !gsap()) {
    for (let i = 0; i < count; i++) onEach?.(i);
    return;
  }
  const from = centerOf(fromEl);
  const to = centerOf(toEl);
  const n = Math.min(count, 12);
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const coin = document.createElement('div');
    coin.className = 'fly-coin';
    coin.innerHTML = COIN_SVG;
    layer().appendChild(coin);
    const sx = from.x + rand(-30, 30);
    const sy = from.y + rand(-20, 20);
    const peak = Math.min(sy, to.y) - rand(60, 140);
    const delay = i * 0.09;
    const tl = gsap().timeline({ delay });
    tl.set(coin, { x: sx, y: sy, scale: 0, rotation: rand(-40, 40) })
      .to(coin, { scale: 1.25, duration: 0.18, ease: 'back.out(3)' })
      .to(coin, { x: (sx + to.x) / 2, duration: 0.32, ease: 'none' }, '>')
      .to(coin, { y: peak, duration: 0.32, ease: 'power2.out' }, '<')
      .to(coin, { x: to.x, duration: 0.34, ease: 'none' }, '>')
      .to(coin, { y: to.y, scale: 0.6, rotation: '+=360', duration: 0.34, ease: 'power2.in' }, '<');
    jobs.push(
      new Promise((resolve) =>
        tl.eventCallback('onComplete', () => {
          coin.remove();
          onEach?.(i);
          sfx.coin(i);
          resolve();
        }),
      ),
    );
  }
  await Promise.all(jobs);
}

// Explosion d'étoiles / d'émojis autour d'un élément
export function burst(el, { count = 12, chars = ['⭐', '✨', '🌟'], spread = 140, duration = 0.9 } = {}) {
  if (!el || prefersReducedMotion() || !gsap()) return;
  const c = centerOf(el);
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'burst-star';
    s.textContent = chars[i % chars.length];
    layer().appendChild(s);
    const a = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
    const d = rand(spread * 0.5, spread);
    gsap().fromTo(
      s,
      { x: c.x, y: c.y, scale: 0.2, opacity: 1, rotation: 0 },
      {
        x: c.x + Math.cos(a) * d,
        y: c.y + Math.sin(a) * d,
        scale: rand(0.8, 1.5),
        rotation: rand(-180, 180),
        opacity: 0,
        duration: duration + rand(-0.2, 0.3),
        ease: 'power3.out',
        onComplete: () => s.remove(),
      },
    );
  }
}

// Texte qui monte et disparaît ("+3")
export function floatText(el, text, color) {
  if (!el || !gsap()) return;
  const c = centerOf(el);
  const t = document.createElement('div');
  t.className = 'float-text';
  t.textContent = text;
  if (color) t.style.color = color;
  layer().appendChild(t);
  const w = t.offsetWidth;
  gsap().fromTo(
    t,
    { x: c.x - w / 2, y: c.y - 20, scale: 0.4, opacity: 0 },
    {
      keyframes: [
        { scale: 1.3, opacity: 1, y: c.y - 60, duration: 0.35, ease: 'back.out(3)' },
        { scale: 1, y: c.y - 110, opacity: 0, duration: 0.9, ease: 'power1.in', delay: 0.3 },
      ],
      onComplete: () => t.remove(),
    },
  );
}

const conf = () => window.confetti;

export function confettiBurst(el, colors) {
  if (prefersReducedMotion() || !conf()) return;
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  conf()({
    particleCount: 90,
    spread: 80,
    startVelocity: 38,
    origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight },
    colors: colors || ['#FFD23F', '#FF7EB6', '#5EC8FF', '#2FCF74', '#9B7BFF'],
    scalar: 1.1,
    zIndex: 65,
  });
}

export async function fireworks(duration = 2600) {
  if (prefersReducedMotion() || !conf()) return;
  const end = Date.now() + duration;
  while (Date.now() < end) {
    conf()({
      particleCount: 60,
      startVelocity: 30,
      spread: 360,
      ticks: 70,
      gravity: 0.9,
      origin: { x: rand(0.15, 0.85), y: rand(0.1, 0.45) },
      colors: ['#FFD23F', '#FF7EB6', '#5EC8FF', '#2FCF74', '#FFFFFF'],
      zIndex: 65,
    });
    sfx.pop();
    await sleep(380);
  }
}

// Pluie de pièces pour la soirée parfaite
export function coinRain(duration = 2200) {
  if (prefersReducedMotion() || !gsap()) return;
  const n = 26;
  for (let i = 0; i < n; i++) {
    const coin = document.createElement('div');
    coin.className = 'fly-coin';
    coin.innerHTML = COIN_SVG;
    layer().appendChild(coin);
    const x = rand(0, innerWidth);
    gsap().fromTo(
      coin,
      { x, y: -60, rotation: rand(-90, 90), scale: rand(0.8, 1.4) },
      {
        y: innerHeight + 80,
        x: x + rand(-80, 80),
        rotation: `+=${rand(360, 900)}`,
        duration: rand(1.4, 2.4),
        delay: (i / n) * (duration / 1000),
        ease: 'power1.in',
        onComplete: () => coin.remove(),
      },
    );
  }
}
