// Minuteurs des tâches : démarrage, pause, bips des dernières secondes, sonnerie et musique.
// Ils vivent sur cet appareil (le téléphone dont l'écran est dupliqué sur la télé) et
// survivent à un rechargement de la page ; ils ne passent pas par Supabase.
import { getState, setTimers } from './store.js';
import { sfx, music } from './sounds.js';
import * as cd from './countdown.js';

const MAX_AGE_MS = 12 * 3600 * 1000; // un minuteur oublié disparaît au bout de 12 h
const RING_GRACE_MS = 15000; // sonnerie manquée (app fermée) : on ne sonne plus après 15 s

let loop = null;
let quiet = false;
const lastBeep = {};

// Coin calme ouvert : la musique se tait (les minuteurs, eux, continuent de tourner)
export function hush(on) {
  quiet = on;
  if (on) music.stop();
}

function save(timers) {
  setTimers(timers);
  ensureLoop();
}

function update(key, fn) {
  save(getState().timers.map((t) => (t.key === key ? fn(t) : t)));
}

export function startTimer({ childId, taskId, date, minutes }) {
  const t = cd.createTimer({ childId, taskId, date, minutes });
  delete lastBeep[t.key];
  save([...getState().timers.filter((x) => x.key !== t.key), t]);
  sfx.timerStart();
  return t;
}

export function pauseTimer(key) {
  update(key, (t) => cd.pauseTimer(t));
  sfx.pause();
}

export function resumeTimer(key) {
  update(key, (t) => cd.resumeTimer(t));
  sfx.resume();
}

export function addMinute(key) {
  update(key, (t) => cd.addTime(t, 60000));
  sfx.pop();
}

// Arrête l'horloge et renvoie le résultat (temps mis, à temps ou non) pour la notation
export function finishTimer(key) {
  const now = Date.now();
  let result = null;
  update(key, (t) => {
    const done = cd.finishTimer(t, now);
    result = cd.timerResult(done, now);
    return done;
  });
  return result;
}

export function removeTimer(key) {
  delete lastBeep[key];
  save(getState().timers.filter((t) => t.key !== key));
}

function ensureLoop() {
  if (loop || !getState().timers.some(cd.needsWatch)) return;
  loop = setInterval(tick, 200);
  tick();
}

function tick() {
  const now = Date.now();
  const { timers, prefs } = getState();
  let changed = false;
  const next = timers.map((t) => {
    if (!cd.needsWatch(t)) return t;
    const left = cd.remainingMs(t, now);
    if (left <= 0) {
      changed = true;
      if (-left < RING_GRACE_MS) sfx.alarm();
      return { ...t, alarmed: true };
    }
    if (left <= cd.FINAL_MS) {
      const n = Math.ceil(left / 1000);
      if (lastBeep[t.key] !== n) {
        lastBeep[t.key] = n;
        sfx.countdown(n);
      }
    }
    return t;
  });
  if (changed) setTimers(next);

  // La musique se tait quand l'app passe en arrière-plan (le navigateur la ferait bégayer)
  const mood = !quiet && prefs.timerMusic !== false && document.visibilityState === 'visible' ? cd.musicMood(next, now) : null;
  if (mood) music.play(mood);
  else music.stop();

  if (!next.some(cd.needsWatch)) {
    clearInterval(loop);
    loop = null;
  }
}

// Au chargement : on oublie les vieux minuteurs et on reprend ceux qui tournent encore
{
  const now = Date.now();
  const all = getState().timers;
  const kept = all.filter((t) => t && t.key && now - t.startedAt < MAX_AGE_MS);
  if (kept.length !== all.length) setTimers(kept);
  ensureLoop();
}
