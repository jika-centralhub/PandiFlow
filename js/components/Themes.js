// Thèmes de la boutique : la section des parents (lancer, programmer, arrêter) et le livre des thèmes
// (une photo des avatars à la fin de chaque thème, gardée en souvenir).
// Règles du panel : une vitrine, jamais une rareté. Rien ne disparaît, pas de compte à rebours,
// pas de collection à compléter ; un cadeau d'entrée pour chaque enfant, sans condition.
import { html, useState } from '../vendor/preact-htm.js';
import { useStore, getState, toast } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { activeChildren, activeThemeEntry, upcomingThemes, pastThemes, nextThemeStart, themeOverlaps, themeGiftOf, THEME_DAYS, THEME_GAP } from '../domain.js';
import { toISODate, addDays, formatLong } from '../lib/dates.js';
import { THEME_CATALOG, getTheme, GIFT_MAX, GIFT_CHOICES } from '../avatar/themes.js';
import { getItem } from '../avatar/items.js';
import { hasArt, artSrc } from '../avatar/art.js';
import { Avatar } from '../avatar/Avatar.js';
import { ItemThumb } from './ItemThumb.js';
import { sfx } from '../lib/sounds.js';

const period = (t) => (t.start === t.end ? `le ${formatLong(t.start)}` : `du ${formatLong(t.start)} au ${formatLong(t.end)}`);

// Une page du livre : les avatars des enfants tels qu'ils étaient à la fin du thème, dans son décor
export function ThemePhoto({ entry }) {
  const theme = getTheme(entry.theme);
  const bg = theme?.scene && hasArt(theme.scene) ? `url("${artSrc(theme.scene)}")` : null;
  return html`<figure class="tb-page" style=${{ '--c': theme?.color || '#7b6cff', backgroundImage: bg }}>
    <div class="tb-kids">${(entry.photo?.kids || []).map((k) => html`<div key=${k.childId} class="tb-kid" style=${{ '--kid': k.color }}>
      <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" mode="full" seed=${k.childId} />
      <span>${k.name}</span>
    </div>`)}</div>
    <figcaption>${theme?.emoji || '📖'} ${theme?.name || entry.theme} · ${period(entry)}</figcaption>
  </figure>`;
}

export function ThemeBook() {
  const s = useStore();
  const pages = pastThemes(s.settings, toISODate(new Date())).filter((t) => t.photo);
  if (!pages.length) return html`<p class="hint" style="padding:16px;text-align:center">Le livre est encore vide : la première photo arrive à la fin du premier thème.</p>`;
  return html`<div class="theme-book">${pages.map((t) => html`<${ThemePhoto} key=${t.id} entry=${t} />`)}</div>`;
}

function CatalogCard({ theme, on, onPick }) {
  const items = theme.items.map(getItem).filter(Boolean);
  return html`<button class=${`theme-card ${on ? 'on' : ''}`} style=${{ '--c': theme.color }} onClick=${onPick}>
    <span class="tc-emoji">${theme.emoji}</span>
    <span class="tc-name">${theme.name}</span>
    <span class="tc-thumbs">${items.slice(0, 5).map((it) => html`<span key=${it.id} class="tc-thumb"><${ItemThumb} item=${it} /></span>`)}</span>
    <span class="tc-meta">${items.length} objets en vitrine, de ${Math.min(...items.map((i) => i.price))} à ${Math.max(...items.map((i) => i.price))} pandi</span>
  </button>`;
}

export function ThemeParent() {
  const s = useStore();
  const today = toISODate(new Date());
  const kids = activeChildren(s.children);
  const current = activeThemeEntry(s.settings, today);
  const upcoming = upcomingThemes(s.settings, today);
  const suggested = nextThemeStart(s.settings, today);
  const [themeId, setThemeId] = useState(THEME_CATALOG[0].id);
  const [start, setStart] = useState(suggested);
  const end = addDays(start, THEME_DAYS - 1);
  const clash = start < today || themeOverlaps(s.settings, start, end);

  function launch() {
    const res = actions.launchTheme(themeId, start);
    if (res.error) {
      sfx.error();
      toast(res.error, 'error');
      return;
    }
    sfx.sparkle();
    toast(start === today ? `Le thème ${getTheme(themeId).name} commence aujourd’hui 🚀` : `Thème programmé ${period(res.entry)}`);
    setStart(nextThemeStart(getState().settings, today));
  }

  function stop(t) {
    const started = t.start <= today;
    if (!confirm(started ? 'Arrêter le thème aujourd’hui ? La vitrine disparaît ; ses objets restent dans la boutique.' : 'Annuler ce thème programmé ?')) return;
    sfx.pop();
    actions.stopTheme(t.id);
  }

  return html`<div class="themes-parent">
    <h2>Thèmes de la boutique</h2>
    <p class="hint">Une vitrine de Pandi pendant ${THEME_DAYS} jours, une semaine sur deux. Rien ne disparaît : les objets du thème restent dans leur rayon, avant comme après, sans compte à rebours ni collection à compléter. À l’ouverture, chaque enfant choisit un cadeau parmi ${GIFT_CHOICES} (${GIFT_MAX} pandi au plus), sans condition. Pandi porte la tenue du thème sur la télé, la scène de l’enfant prend son décor, et une photo rejoint le livre des thèmes à la fin.</p>

    ${current && (() => {
      const theme = getTheme(current.theme);
      return html`<div class="row theme-now" style=${{ '--c': theme?.color }}>
        <span class="emoji">${theme?.emoji}</span>
        <div class="grow">
          <div class="title">${theme?.name} : en ce moment, ${period(current)}</div>
          <div class="meta">${kids.map((k) => {
            const g = themeGiftOf(s.owned, k.id, current);
            return `${k.name} : ${g ? `a choisi ${getItem(g)?.name || 'son cadeau'}` : 'cadeau pas encore choisi'}`;
          }).join(' · ')}</div>
        </div>
        <button class="p-btn danger" onClick=${() => stop(current)}>Arrêter</button>
      </div>`;
    })()}

    ${upcoming.length > 0 && html`<h3 class="section-title" style="color:var(--ink);margin-top:16px">Programmés</h3>
      <div class="row-list">${upcoming.map((t) => {
        const theme = getTheme(t.theme);
        return html`<div key=${t.id} class="row"><span class="emoji">${theme?.emoji}</span>
          <div class="grow"><div class="title">${theme?.name}</div><div class="meta">${period(t)}</div></div>
          <button class="p-btn danger" onClick=${() => stop(t)}>Annuler</button></div>`;
      })}</div>`}

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Lancer un thème</h3>
    <div class="theme-catalog">${THEME_CATALOG.map((t) => html`<${CatalogCard} key=${t.id} theme=${t} on=${themeId === t.id} onPick=${() => { sfx.tap(); setThemeId(t.id); }} />`)}</div>
    <div class="row" style="margin-top:10px">
      <span class="emoji">📅</span>
      <div class="grow"><div class="title">À partir du</div><div class="meta">${THEME_DAYS} jours, jusqu’au ${formatLong(end)}. Une semaine sur deux : le prochain peut commencer le ${formatLong(suggested)}.</div></div>
      <input class="input time-input" type="date" value=${start} min=${today} onChange=${(e) => e.target.value && setStart(e.target.value)} />
      <button class="p-btn primary" disabled=${clash} onClick=${launch}>${start === today ? '🚀 Lancer' : '📅 Programmer'}</button>
    </div>
    ${clash && html`<p class="srp-warning">⚠️ ${start < today ? 'Choisis aujourd’hui ou une date à venir.' : 'Un autre thème est déjà prévu à ces dates.'}</p>`}
    ${!clash && start < suggested && html`<p class="hint" style="margin-top:6px">Le panel conseille une semaine sans thème entre deux (${THEME_GAP} jours).</p>`}

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Le livre des thèmes</h3>
    <${ThemeBook} />
  </div>`;
}

