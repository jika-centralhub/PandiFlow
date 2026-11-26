// « Chut, Pandi s'endort » : la règle du jeu, sans micro ni écran (Chambre.js la branche sur l'oreille
// de Pandi, js/lib/micro.js). Quand tout le monde a dit bonne nuit, Pandi se couche et ne s'endort que si
// la maison reste calme `seconds` secondes (comptées bout à bout). Le bruit le fait juste remuer : il
// ouvre un œil, pose une patte sur son oreille, et on ne perd jamais ce qui est gagné. Le jeu finit
// toujours par un Pandi endormi : si le bruit dure, le seuil s'assouplit, et au bout de `seconds` + 3 min
// il s'endort quand même (le micro se ferme alors).
// Avis du panel d'experts : rien de tout ça n'est compté, gardé ni relié aux pandi, et Pandi ne nomme
// personne (le micro ne sait pas qui fait du bruit).

export const CHUT_DEFAULT = { on: true, seconds: 60, sens: 'normal' };
export const chutSettings = (settings) => ({ ...CHUT_DEFAULT, ...(settings?.chut || {}) });
export const CHUT_SECONDS = [30, 60, 120, 180];
// marge au-dessus du calme de la pièce, en dB : au-delà, c'est du bruit
export const SENS = {
  sensible: { db: 10, label: 'Sensible' },
  normal: { db: 14, label: 'Normale' },
  tolerant: { db: 20, label: 'Tolérante' },
};

const SMOOTH = 0.5; // s : lissage du niveau
const WARM = 2; // s : au début, Pandi s'installe ; on apprend le calme de la pièce
const NOISE_IN = 2; // s au-dessus du seuil : Pandi remue (un cri bref ou une porte ne font rien)
const CALM_IN = 2; // s nettement sous le seuil : il se rendort
const HYST = 6; // dB : « nettement sous le seuil »
const RISE = 0.25; // dB/s : tant que le bruit dure, le seuil monte (le jeu finit toujours bien)
const PAW_GAP = 20; // s : la patte sur l'oreille, au plus une fois toutes les 20 s
const PAW_FOR = 4; // s
const EXTRA = 180; // s : au-delà de `seconds` + EXTRA, il s'endort quand même
const DEAD = -100; // dB : en dessous, le micro ne renvoie plus rien d'utile

// Le calme de la pièce mesuré les soirs précédents, sur cet appareil (un point de départ, pas plus)
const FLOOR_KEY = 'pandiflow-chut-calme';
export function savedFloor() {
  try {
    const v = Number(localStorage.getItem(FLOOR_KEY));
    return Number.isFinite(v) && v < 0 && v > DEAD ? v : null;
  } catch {
    return null;
  }
}
export function saveFloor(db) {
  try {
    if (Number.isFinite(db) && db > DEAD && db < 0) localStorage.setItem(FLOOR_KEY, db.toFixed(1));
  } catch {}
}

// L'appareil a refusé le micro : on ne le redemande plus (Réglages → rallumer le jeu le redemande)
const REFUS_KEY = 'pandiflow-chut-refus';
export function earRefused() {
  try {
    return Boolean(localStorage.getItem(REFUS_KEY));
  } catch {
    return false;
  }
}
export function setEarRefused(on) {
  try {
    if (on) localStorage.setItem(REFUS_KEY, new Date().toISOString());
    else localStorage.removeItem(REFUS_KEY);
  } catch {}
}

export function createChut({ seconds = CHUT_DEFAULT.seconds, sens = CHUT_DEFAULT.sens, floor = null } = {}) {
  const margin = (SENS[sens] || SENS.normal).db;
  const goal = Math.max(5, Number(seconds) || CHUT_DEFAULT.seconds);
  const s = {
    t: 0, level: null, floor: null, quietest: null, start: floor,
    progress: 0, noisy: false, paw: false, done: false, listening: false,
    above: 0, below: 0, pawAt: -Infinity,
  };
  // dt en secondes ; db : le niveau mesuré, ou null quand on n'écoute pas (compté comme du calme)
  function step(dt, db) {
    if (s.done) return s;
    dt = Math.min(Math.max(dt, 0), 1);
    s.t += dt;
    const heard = db != null && Number.isFinite(db) && db > DEAD;
    if (heard) {
      s.listening = true;
      s.level = s.level == null ? db : s.level + (db - s.level) * Math.min(1, dt / SMOOTH);
      // le calme de la pièce : le niveau le plus bas entendu (au départ, celui des soirs précédents)
      if (s.floor == null) s.floor = s.start != null ? Math.min(s.start, s.level) : s.level;
      else if (s.level < s.floor) s.floor = s.level;
      s.quietest = s.quietest == null ? s.level : Math.min(s.quietest, s.level);
    }
    const thr = s.floor == null ? Infinity : s.floor + margin;
    const lv = heard ? s.level : -Infinity;
    if (lv > thr) {
      s.above += dt;
      s.below = 0;
    } else if (lv < thr - HYST) {
      s.below += dt;
      s.above = 0;
    } else s.above = 0;
    if (!s.noisy && s.t > WARM && s.above >= NOISE_IN) {
      s.noisy = true;
      if (s.t - s.pawAt >= PAW_GAP) s.pawAt = s.t;
    }
    if (s.noisy && s.below >= CALM_IN) s.noisy = false;
    // le bruit dure : le seuil s'assouplit peu à peu
    if (s.noisy && s.floor != null) s.floor += RISE * dt;
    if (s.t > WARM && !s.noisy) s.progress = Math.min(1, s.progress + dt / goal);
    s.paw = s.t - s.pawAt < PAW_FOR;
    if (s.progress >= 1 || s.t >= goal + EXTRA) {
      s.progress = 1;
      s.noisy = false;
      s.paw = false;
      s.done = true;
    }
    return s;
  }
  return { state: s, step };
}
