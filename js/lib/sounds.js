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

function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.4, slide = 0, attack = 0.005 } = {}) {
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
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ at = 0, dur = 0.3, vol = 0.2, freq = 1200, q = 1 } = {}) {
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
  src.connect(f).connect(g).connect(master);
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
};
