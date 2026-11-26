// Labo : la veille de l'écran (écran calme, voir CALME dans js/config.js).
// Au bout de 2 minutes sans qu'on touche l'écran, tout ce qui bouge s'arrête, sauf le minuteur, et un voile
// sombre tombe (css/calme.css) : l'iPhone peut ralentir l'affichage et refroidir. Le premier toucher réveille
// l'écran sans rien déclencher d'autre.
const IDLE_MS = 2 * 60 * 1000;
let timer = 0;
let asleep = false;
let held = false;
let started = false;

function sleep() {
  // pas de veille pendant le minuteur en plein écran (les enfants sont en train de faire la tâche)
  if (held || document.querySelector('.timer-stage')) return arm();
  asleep = true;
  document.documentElement.classList.add('veille');
}

function wakeUp() {
  asleep = false;
  document.documentElement.classList.remove('veille');
}

// Le test de fluidité (js/labo/testFluidite.js) tourne sans qu'on touche l'écran : il tient la veille à
// distance, et peut la provoquer pour la mesurer
export function holdVeille(on) {
  held = Boolean(on);
  wakeUp();
  arm();
}
export function forceVeille(on) {
  if (on) {
    asleep = true;
    document.documentElement.classList.add('veille');
  } else wakeUp();
}

function arm() {
  clearTimeout(timer);
  if (!started) return;
  timer = setTimeout(sleep, IDLE_MS);
}

function onTouch(e) {
  if (asleep) {
    wakeUp();
    // ce toucher-là sert seulement à réveiller l'écran
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'pointerdown') {
      const eat = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 700);
    }
  }
  arm();
}

export function startVeille() {
  started = true;
  for (const t of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(t, onTouch, { capture: true, passive: false });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && arm());
  arm();
}

export const isAsleep = () => asleep;
