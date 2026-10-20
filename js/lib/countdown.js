// Calculs du minuteur des tâches : fonctions pures (testées dans tests/), sans son ni DOM.
// Un minuteur garde ses instants de départ et de pause : le temps restant se recalcule
// toujours à partir de l'horloge, il reste donc juste même si l'écran s'est endormi.

export const DURATIONS = [1, 2, 3, 5, 10, 15]; // minutes proposées au lancement
export const FINAL_MS = 10000; // compte à rebours des dernières secondes

export const timerKey = (childId, taskId) => `${childId}:${taskId}`;

export function createTimer({ childId, taskId, date, minutes, now = Date.now() }) {
  const ms = Math.round(minutes * 60000);
  return { key: timerKey(childId, taskId), childId, taskId, date, plannedMs: ms, durationMs: ms, startedAt: now, pausedAt: null, pausedMs: 0, alarmed: false, finished: false };
}

export function elapsedMs(t, now = Date.now()) {
  return Math.max(0, (t.pausedAt ?? now) - t.startedAt - t.pausedMs);
}

export const remainingMs = (t, now = Date.now()) => t.durationMs - elapsedMs(t, now);

export function progressOf(t, now = Date.now()) {
  return t.durationMs > 0 ? Math.min(1, elapsedMs(t, now) / t.durationMs) : 1;
}

// calme -> on avance -> on accélère -> dernières secondes -> temps écoulé
export function phaseOf(t, now = Date.now()) {
  const left = remainingMs(t, now);
  if (left <= 0) return 'over';
  if (left <= FINAL_MS) return 'final';
  const p = progressOf(t, now);
  return p < 0.5 ? 'calm' : p < 0.8 ? 'hurry' : 'rush';
}

export const isPaused = (t) => t.pausedAt != null;

export function pauseTimer(t, now = Date.now()) {
  return isPaused(t) ? t : { ...t, pausedAt: now };
}

export function resumeTimer(t, now = Date.now()) {
  return isPaused(t) ? { ...t, pausedAt: null, pausedMs: t.pausedMs + (now - t.pausedAt) } : t;
}

// Du temps en plus. Une fois la sonnerie passée, la minute offerte part de maintenant.
export function addTime(t, ms, now = Date.now()) {
  const left = remainingMs(t, now);
  const durationMs = left > 0 ? t.durationMs + ms : elapsedMs(t, now) + ms;
  return { ...t, durationMs, alarmed: false };
}

// « Fini ! » : l'horloge s'arrête, le temps mis reste lisible pour la notation.
export function finishTimer(t, now = Date.now()) {
  return { ...pauseTimer(t, now), finished: true };
}

export function timerResult(t, now = Date.now()) {
  const elapsed = elapsedMs(t, now);
  return { elapsedMs: elapsed, durationMs: t.durationMs, plannedMs: t.plannedMs, inTime: elapsed <= t.durationMs, extended: t.durationMs > t.plannedMs };
}

// Le minuteur a besoin d'être surveillé (bips, sonnerie) tant qu'il tourne et n'a pas sonné.
export const needsWatch = (t) => !t.finished && !isPaused(t) && !t.alarmed;

export function mmss(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Ce qu'affiche le minuteur : le temps restant, puis le dépassement (« +0:12 »).
export function clockText(t, now = Date.now()) {
  const left = remainingMs(t, now);
  return left > 0 ? mmss(Math.ceil(left / 1000) * 1000) : `+${mmss(-left)}`;
}

// Intensité de la musique : on suit le minuteur le plus proche de la fin.
// Renvoie null s'il n'y a rien à accompagner (tout est en pause, fini ou sonné).
export function musicMood(timers, now = Date.now()) {
  let best = null;
  for (const t of timers) {
    if (t.finished || isPaused(t)) continue;
    const left = remainingMs(t, now);
    if (left <= 0) continue;
    const p = progressOf(t, now);
    const level = left <= FINAL_MS ? 3 : p < 0.5 ? 0 : p < 0.8 ? 1 : 2;
    if (!best || level > best.level || (level === best.level && p > best.p)) best = { level, p };
  }
  if (!best) return null;
  return { level: best.level, bpm: best.level === 3 ? 176 : Math.round(96 + 64 * best.p ** 1.5) };
}
