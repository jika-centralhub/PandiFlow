import { EVENING_CUTOFF_HOUR } from '../config.js';

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
