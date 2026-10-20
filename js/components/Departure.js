// Routine du matin : compte à rebours jusqu'au départ à l'école.
// Un petit bonhomme court vers l'école ; la barre change de couleur en approchant de l'heure,
// un « ding-dong » prévient à 10 et 5 minutes, puis le réveil sonne à l'heure du départ.
import { html, useEffect, useRef } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import { atTime, weekday } from '../lib/dates.js';
import { sfx } from '../lib/sounds.js';
import { useClock } from './Timer.js';

const WINDOW_MS = 60 * 60000; // la barre représente la dernière heure avant le départ
const HIDE_AFTER_MS = 30 * 60000;

export function departureAt(settings, date) {
  if (!settings.departure || !settings.departureDays?.includes(weekday(date))) return null;
  return atTime(date, settings.departure);
}

function label(left) {
  if (left <= 0) return 'C’est l’heure de partir !';
  if (left < 60000) return `Départ dans ${Math.ceil(left / 1000)} s`;
  const min = Math.ceil(left / 60000);
  if (min < 60) return `Départ dans ${min} min`;
  return `Départ dans ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

// Chaque rappel ne sonne qu'une fois par matin, même si l'écran est rouvert
function once(id, fn) {
  const key = `pandiflow-depart-${id}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  fn();
}

export function DepartureBar({ date }) {
  const s = useStore();
  const at = departureAt(s.settings, date);
  const now = useClock(Boolean(at), 500);
  const lastBeep = useRef(null);
  const left = at ? at - now : null;

  useEffect(() => {
    if (left == null || left < -60000) return;
    if (left <= 10 * 60000 && left > 9.5 * 60000) once(`${date}-10`, () => sfx.chime(1));
    if (left <= 5 * 60000 && left > 4.5 * 60000) once(`${date}-5`, () => sfx.chime(2));
    if (left > 0 && left <= 10000) {
      const n = Math.ceil(left / 1000);
      if (lastBeep.current !== n) {
        lastBeep.current = n;
        sfx.countdown(n);
      }
    }
    if (left <= 0) once(`${date}-go`, () => sfx.alarm());
  }, [Math.ceil((left ?? 0) / 500)]);

  if (left == null || left < -HIDE_AFTER_MS) return null;
  const ratio = Math.max(0, Math.min(1, left / WINDOW_MS));
  const phase = left <= 0 ? 'over' : left <= 60000 ? 'final' : left <= 5 * 60000 ? 'rush' : left <= 15 * 60000 ? 'hurry' : 'calm';
  return html`<div class=${`departure d-${phase}`} style=${{ '--done': 1 - ratio }} role="timer" aria-label=${label(left)}>
    <span class="d-icon">🎒</span>
    <div class="d-track">
      <i />
      <span class="d-runner">${left <= 0 ? '🚸' : '🏃'}</span>
      <span class="d-school">🏫</span>
    </div>
    <span class="d-label">${label(left)}</span>
    <span class="d-time">${s.settings.departure.replace(':', ' h ')}</span>
  </div>`;
}
