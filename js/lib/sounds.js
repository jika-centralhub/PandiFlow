// Sons synthétisés en WebAudio : aucun fichier audio à charger.
import { getState } from './store.js';

let ctx = null;
let master = null;

function audio() {
  if (!getState().prefs.sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Les navigateurs exigent un geste de l'utilisateur avant de jouer du son
export function unlockAudio() {
  const once = () => {
    audio();
    window.removeEventListener('pointerdown', once);
  };
  window.addEventListener('pointerdown', once);
}

function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.4, slide = 0, attack = 0.005, dest = null } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest || master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ at = 0, dur = 0.3, vol = 0.2, freq = 1200, q = 1, dest = null } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest || master);
  src.start(t);
}

export const sfx = {
  tap: () => tone(660, { dur: 0.06, type: 'triangle', vol: 0.18 }),
  pop: () => tone(420, { dur: 0.12, slide: 500, type: 'sine', vol: 0.3 }),
  coin: (i = 0) => {
    tone(1320 + i * 40, { at: 0, dur: 0.08, type: 'square', vol: 0.08 });
    tone(1760 + i * 40, { at: 0.06, dur: 0.16, type: 'square', vol: 0.08 });
  },
  green: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.22, type: 'triangle', vol: 0.3 })),
  orange: () => [523, 659].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.22, type: 'triangle', vol: 0.26 })),
  red: () => [392, 349].forEach((f, i) => tone(f, { at: i * 0.16, dur: 0.26, type: 'sine', vol: 0.24 })),
  whoosh: () => noise({ dur: 0.45, vol: 0.25, freq: 900, q: 0.7 }),
  fanfare: () => {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
    const times = [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.15];
    notes.forEach((f, i) => tone(f, { at: times[i], dur: i === notes.length - 1 ? 0.7 : 0.18, type: 'square', vol: 0.12 }));
    notes.forEach((f, i) => tone(f / 2, { at: times[i], dur: 0.2, type: 'triangle', vol: 0.18 }));
  },
  drumroll: (dur = 1.6) => {
    for (let t = 0; t < dur; t += 0.05) noise({ at: t, dur: 0.06, vol: 0.12 + (t / dur) * 0.2, freq: 260, q: 0.8 });
  },
  sparkle: () => [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.3, type: 'sine', vol: 0.12 })),
  chest: () => {
    noise({ dur: 0.25, vol: 0.3, freq: 400 });
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: 0.15 + i * 0.08, dur: 0.5, type: 'triangle', vol: 0.2 }));
  },
  error: () => tone(220, { dur: 0.25, type: 'sawtooth', vol: 0.1, slide: -60 }),
  // Pandi content : petite montée joyeuse
  happy: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.26, type: 'triangle', vol: 0.26 }));
    [1568, 2093].forEach((f, i) => tone(f, { at: 0.45 + i * 0.07, dur: 0.3, type: 'sine', vol: 0.12 }));
  },
  // Pandi triste : « wah wah wah waaah » tout doux
  sad: () => {
    [392, 370, 349].forEach((f, i) => tone(f, { at: i * 0.32, dur: 0.28, type: 'triangle', vol: 0.22 }));
    tone(330, { at: 0.96, dur: 0.9, type: 'triangle', vol: 0.22, slide: -40 });
  },
  // Minuteur lancé : « fiiiou » qui monte, puis « ta-taaa »
  timerStart: () => {
    tone(330, { dur: 0.2, slide: 700, type: 'sine', vol: 0.25 });
    [784, 1047].forEach((f, i) => tone(f, { at: 0.2 + i * 0.1, dur: i ? 0.32 : 0.1, type: 'triangle', vol: 0.26 }));
  },
  pause: () => [660, 440].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.14, type: 'triangle', vol: 0.22 })),
  resume: () => [440, 660].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.14, type: 'triangle', vol: 0.22 })),
  // Dernières secondes : un bip par seconde, un demi-ton plus haut à chaque fois, doublé sur 3, 2, 1
  countdown: (n) => {
    const f = 880 * 2 ** ((10 - n) / 12);
    const loud = n <= 3;
    tone(f, { dur: loud ? 0.16 : 0.08, type: 'square', vol: loud ? 0.11 : 0.07 });
    if (loud) tone(f / 2, { dur: 0.18, type: 'triangle', vol: 0.2 });
  },
  // Temps écoulé : réveil mécanique (le marteau tape entre deux cloches), deux fois, puis « boing ! »
  alarm: () => {
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 18; i++) {
        const at = r * 1.05 + i * 0.045;
        tone(i % 2 ? 1760 : 2093, { at, dur: 0.05, type: 'square', vol: 0.07 });
        tone(i % 2 ? 880 : 1047, { at, dur: 0.06, type: 'triangle', vol: 0.13 });
      }
    }
    tone(220, { at: 2.15, dur: 0.18, type: 'sine', vol: 0.32, slide: 440 });
    tone(660, { at: 2.33, dur: 0.4, type: 'sine', vol: 0.28, slide: -380 });
  },
  // Rappel doux (départ à l'école dans 10 puis 5 minutes) : « ding-dong »
  chime: (times = 1) => {
    for (let i = 0; i < times; i++) {
      tone(1319, { at: i * 1.1, dur: 0.6, type: 'sine', vol: 0.22 });
      tone(1047, { at: i * 1.1 + 0.4, dur: 0.9, type: 'sine', vol: 0.22 });
    }
  },
  // Coin calme : sons très doux (inspiration qui monte, expiration en souffle, petite cloche)
  breathIn: (secs = 4) => {
    tone(196, { dur: secs, attack: secs * 0.6, slide: 98, type: 'sine', vol: 0.1 });
    tone(294, { dur: secs, attack: secs * 0.6, slide: 147, type: 'sine', vol: 0.05 });
  },
  breathOut: (secs = 6) => {
    noise({ dur: secs * 0.8, vol: 0.05, freq: 500, q: 0.5 });
    tone(294, { dur: secs, attack: 0.3, slide: -98, type: 'sine', vol: 0.07 });
  },
  // Souffle de feu du dragon : un « fwoosh » grave, plus fort quand la colère est grande (1 -> 0)
  fire: (power = 1) => {
    noise({ dur: 1.2 + power, vol: 0.06 + power * 0.12, freq: 380 + power * 300, q: 0.6 });
    tone(110 + power * 60, { dur: 0.9, type: 'sawtooth', vol: 0.025 + power * 0.04, slide: -50 });
  },
  softChime: () => [1568, 2349].forEach((f, i) => tone(f, { at: i * 0.12, dur: 1.4, type: 'sine', vol: 0.06 })),
  softTap: () => tone(523 + Math.random() * 40, { dur: 0.12, type: 'sine', vol: 0.09 }),
  // Fini avant la sonnerie : « ta-da ! » et paillettes
  timerWin: () => {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, type: 'square', vol: 0.09 }));
    [1047, 1319, 1568].forEach((f) => tone(f, { at: 0.32, dur: 0.75, type: 'triangle', vol: 0.15 }));
    [2093, 2637, 3136].forEach((f, i) => tone(f, { at: 0.5 + i * 0.07, dur: 0.3, type: 'sine', vol: 0.08 }));
  },
};

// --- Musique du minuteur -------------------------------------------------------------------
// Une ritournelle de 4 mesures jouée en boucle. Plus la fin approche, plus elle accélère,
// monte d'un cran (au début de chaque tour) et s'enrichit : charleston, puis grosse caisse
// et caisse claire, puis une petite voix aiguë pour les dernières secondes.
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
// Une case par croche (numéros MIDI, 0 = silence)
const MELODY = [72, 0, 76, 79, 81, 79, 76, 0, 77, 0, 81, 84, 83, 79, 74, 0, 76, 0, 79, 84, 86, 84, 81, 0, 79, 77, 76, 74, 72, 0, 67, 0];
// Une note par noire : basse « oum-pa »
const BASS = [60, 55, 60, 55, 53, 60, 55, 62, 60, 55, 57, 64, 55, 62, 60, 55];
const SHIFT = [0, 2, 5, 7]; // transposition en demi-tons selon l'intensité (0 à 3)

const tune = { timer: null, bus: null, step: 0, nextAt: 0, level: 0, bpm: 96, shift: 0 };

function musicStep(a) {
  const i = tune.step;
  const { level } = tune;
  if (i === 0) tune.shift = SHIFT[level];
  const at = Math.max(0, tune.nextAt - a.currentTime);
  const eighth = 30 / tune.bpm;
  const dest = tune.bus;
  const m = MELODY[i];
  if (m) {
    tone(mtof(m + tune.shift), { at, dur: eighth * 0.9, type: level >= 2 ? 'square' : 'triangle', vol: level >= 2 ? 0.06 : 0.14, dest });
    if (level >= 3) tone(mtof(m + tune.shift + 12), { at, dur: eighth * 0.6, type: 'sine', vol: 0.05, dest });
  }
  if (i % 2 === 0) tone(mtof(BASS[i / 2] + tune.shift), { at, dur: eighth * 1.7, type: 'triangle', vol: 0.2, dest });
  if (level >= 1) noise({ at, dur: 0.035, vol: i % 2 ? 0.07 : 0.035, freq: 7000, q: 1, dest });
  if (level >= 2) {
    if (i % (level >= 3 ? 2 : 4) === 0) tone(140, { at, dur: 0.14, type: 'sine', vol: 0.35, slide: -90, dest });
    if (i % 4 === 2) noise({ at, dur: 0.12, vol: 0.14, freq: 1600, q: 0.6, dest });
  }
}

// Planification en avance (≈ 120 ms) pour un rythme régulier malgré les à-coups du navigateur
function musicTick() {
  const a = audio();
  if (!a) return music.stop();
  if (tune.nextAt < a.currentTime - 0.1) tune.nextAt = a.currentTime + 0.03; // l'onglet a été gelé
  while (tune.nextAt < a.currentTime + 0.12) {
    musicStep(a);
    tune.nextAt += 30 / tune.bpm;
    tune.step = (tune.step + 1) % MELODY.length;
  }
}

export const music = {
  // level : 0 (calme) à 3 (dernières secondes) ; bpm : tempo de la noire
  play({ level, bpm }) {
    tune.level = level;
    tune.bpm = bpm;
    if (tune.timer) return;
    const a = audio();
    if (!a) return;
    if (!tune.bus) {
      tune.bus = a.createGain();
      tune.bus.connect(master);
    }
    const g = tune.bus.gain;
    g.cancelScheduledValues(a.currentTime);
    g.setValueAtTime(0.0001, a.currentTime);
    g.exponentialRampToValueAtTime(0.8, a.currentTime + 0.6);
    tune.step = 0;
    tune.nextAt = a.currentTime + 0.05;
    tune.timer = setInterval(musicTick, 25);
  },
  stop() {
    if (!tune.timer) return;
    clearInterval(tune.timer);
    tune.timer = null;
    if (!ctx || !tune.bus) return;
    const g = tune.bus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(Math.max(0.0001, g.value), ctx.currentTime);
    g.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
  },
};
