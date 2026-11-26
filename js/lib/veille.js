// Labo : la veille de l'écran (écran calme, voir CALME dans js/config.js).
// Au bout de 2 minutes sans qu'on touche l'écran, tout ce qui bouge s'arrête, sauf le minuteur, et un voile
// sombre tombe (css/calme.css) : l'iPhone peut ralentir l'affichage et refroidir. Le premier toucher réveille
// l'écran sans rien déclencher d'autre.
const IDLE_MS = 2 * 60 * 1000;
let timer = 0;
let asleep = false;
let held = false;
let started = false;
let sleptAt = 0;
// Pour le rapport de perf (js/lib/perf.js) : combien de fois l'écran s'est endormi tout seul, combien de
// temps au total et au plus long (la veille provoquée par le test de fluidité ne compte pas)
const stats = (globalThis.pandiVeille = { fois: 0, s: 0, plusLongueS: 0, dort: false, debut: 0 });

function sleep() {
  // pas de veille pendant le minuteur en plein écran (les enfants sont en train de faire la tâche)
  if (held || document.querySelector('.timer-stage')) return arm();
  asleep = true;
  sleptAt = performance.now();
  stats.fois++;
  stats.dort = true;
  stats.debut = sleptAt;
  document.documentElement.classList.add('veille');
}

function wakeUp() {
  if (sleptAt) {
    const sec = Math.round((performance.now() - sleptAt) / 1000);
    stats.s += sec;
    stats.plusLongueS = Math.max(stats.plusLongueS, sec);
    sleptAt = 0;
    stats.dort = false;
    stats.debut = 0;
  }
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
