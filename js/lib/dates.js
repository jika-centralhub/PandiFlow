import { EVENING_CUTOFF_HOUR, MORNING_END_HOUR } from '../config.js';

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// La "soirée" en cours : avant 4 h du matin, on est encore sur la soirée de la veille.
export function eveningDate(now = new Date(), cutoffHour = EVENING_CUTOFF_HOUR) {
  const d = new Date(now);
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  return toISODate(d);
}

// Routine affichée par défaut selon l'heure : le matin entre 4 h et 13 h, le soir sinon.
export function currentRoutine(now = new Date()) {
  const h = new Date(now).getHours();
  return h >= EVENING_CUTOFF_HOUR && h < MORNING_END_HOUR ? 'matin' : 'soir';
}

// Le jour d'une routine : la date du jour le matin, la « soirée » (qui déborde après minuit) le soir.
export function routineDate(routine, now = new Date()) {
  return routine === 'matin' ? toISODate(new Date(now)) : eveningDate(now);
}

// Début de la routine qui suit (4 h pour le matin, 13 h pour le soir) : une surprise de Pandi préparée
// le soir arrive le lendemain matin, une surprise préparée le matin arrive pour la routine du soir.
export function nextRoutineStart(now = new Date()) {
  const d = new Date(now);
  const h = d.getHours();
  if (h >= EVENING_CUTOFF_HOUR && h < MORNING_END_HOUR) {
    d.setHours(MORNING_END_HOUR, 0, 0, 0);
  } else {
    if (h >= MORNING_END_HOUR) d.setDate(d.getDate() + 1);
    d.setHours(EVENING_CUTOFF_HOUR, 0, 0, 0);
  }
  return d;
}

// Instant précis d'un jour donné : atTime('2026-10-21', '08:15') -> horodatage en ms
export function atTime(iso, hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const d = fromISODate(iso);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function addDays(iso, days) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

// 0 = dimanche … 6 = samedi (comme Date.getDay)
export function weekday(iso) {
  return fromISODate(iso).getDay();
}

export const WEEKDAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function formatLong(iso) {
  const d = fromISODate(iso);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(iso) {
  const d = fromISODate(iso);
  return `${WEEKDAYS_LONG[d.getDay()].slice(0, 3)}. ${d.getDate()}/${pad(d.getMonth() + 1)}`;
}

export function relativeLabel(iso, today = eveningDate()) {
  if (iso === today) return 'Ce soir';
  if (iso === addDays(today, -1)) return 'Hier soir';
  return formatLong(iso);
}
