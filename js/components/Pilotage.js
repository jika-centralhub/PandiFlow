// Pilotage de l'adoption (Espace parent → 📊, visible seulement par l'auteur de l'app) : familles,
// parents, enfants, routines suivies, pandi gagnés et dépensés, fonctions utilisées, rétention.
// Les chiffres viennent de admin_stats (supabase/migrations/20261027120000_pilotage.sql), jamais de
// prénom d'enfant. L'écran est souvent dupliqué sur la télé : noms et e-mails restent cachés par défaut.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { getItem } from '../avatar/items.js';
import { ItemThumb } from './ItemThumb.js';
import { Toggle } from './ui.js';
import { sfx } from '../lib/sounds.js';

const PREFS_KEY = 'pandiflow-pilotage';
const readPrefs = () => {
  try {
    return { skipOwn: false, names: false, ...JSON.parse(localStorage.getItem(PREFS_KEY)) };
  } catch {
    return { skipOwn: false, names: false };
  }
};

// Couleurs des graphiques (palette validée daltonisme, sur le papier clair de l'espace parent)
const C = { blue: '#2a78d6', orange: '#eb6834' };
const BLUES = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'];

const FUNNEL = {
  famille: 'Famille créée',
  enfant: 'Au moins un enfant',
  routine: 'Première routine notée',
  habitude: '3 jours notés ou plus',
  semaine2: 'Revenue après sa 1re semaine',
  active: 'Active ces 7 derniers jours',
};

const EARN = {
  notes: '🌟 Notes des routines',
  team: '🧰 Paliers du coffre',
  challenge: '🏆 Défis réussis',
  help: '🙌 Coups de main',
  teamcard: "🤝 Cartes d'équipe",
  manual: '💰 Ajouts des parents',
  perfect: '✨ Soirées parfaites (ancien bonus)',
  behavior: '😊 Comportement (ancienne carte)',
};
const SPEND = {
  purchase: '🛍️ Boutique',
  potbuy: '🧺 Cagnotte commune',
  tsedaka: '💙 Tsedaka',
  retrait: '➖ Retraits des parents',
};

const FEATURES = {
  matin: '☀️ Routine du matin',
  coparent: '👥 Deux parents ou plus',
  photo: '📸 Photo magique',
  boutique: '🛍️ Boutique',
  bonus: '💰 Pandi ajoutés ou retirés',
  defi: '🏆 Défi réussi',
  palier: '🧰 Palier du coffre atteint',
  teamcard: "🤝 Carte d'équipe",
  cagnotte: '🧺 Cagnotte commune',
  aide: '🙌 Coup de main',
  cadeau: '🎁 Cadeau entre enfants',
  tsedaka: '💙 Tsedaka',
  surprise: '🎁 Surprise de Pandi',
};

const RATINGS = [
  { key: 'green', label: '🌟 Du premier coup', color: 'var(--green)' },
  { key: 'orange', label: '👍 Après un rappel', color: 'var(--orange)' },
  { key: 'red', label: '✋ Il a fallu répéter', color: 'var(--red)' },
  { key: 'pause', label: '⏸️ Pas ce soir', color: '#b9b4cf' },
];

const AGES = [['3-5', '3 à 5 ans'], ['6-8', '6 à 8 ans'], ['0-2', 'Moins de 3 ans'], ['9+', '9 ans et plus'], ['inconnu', 'Âge non renseigné']];

// --- Mise en forme -------------------------------------------------------------------
const num = (n) => (Number(n) || 0).toLocaleString('fr-FR');
const compact = (n) => (Math.abs(n) >= 10000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k` : num(n));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
const fromISO = (iso) => new Date(`${iso}T12:00:00`);
const day = (iso) => fromISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const longDay = (iso) => fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
const s = (n, one, many = `${one}s`) => (Number(n) === 1 || Number(n) === 0 ? one : many);

function ago(iso) {
  if (!iso) return '—';
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  const d = Math.round(min / 1440);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

// Une échelle ronde (…, 4, 5, 6, 8, 10, 15, 20…) juste au-dessus du maximum
function niceMax(m) {
  if (m <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(m));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((f) => f * p >= m) * p;
}

function familyStatus(f, today) {
  if (!f.last_routine) return { icon: '⚪', label: 'Pas encore commencé', rank: 3 };
  const since = daysBetween(f.last_routine, today);
  if (since < 7) return { icon: '🟢', label: 'Active', rank: 0 };
  if (since < 30) return { icon: '🟠', label: 'Ralentit', rank: 1 };
  return { icon: '🔴', label: 'Arrêtée', rank: 2 };
}

const familyLabel = (f, names) => (names ? f.name : `Famille n°${f.n}`);

// La feuille de style n'est chargée que pour cet onglet
function useStyle() {
  useEffect(() => {
    if (document.getElementById('pilotage-css')) return;
    const link = Object.assign(document.createElement('link'), { id: 'pilotage-css', rel: 'stylesheet', href: 'css/pilotage.css' });
    document.head.append(link);
  }, []);
}

// --- Petits graphiques en HTML ------------------------------------------------------------
// Colonnes empilées (stacked) ou côte à côte, une info-bulle au survol ou au toucher
function Columns({ data, series, stacked = true, xLabel, tip, every = 1, caption }) {
  const [hover, setHover] = useState(null);
  const height = (d) => (stacked ? series.reduce((n, x) => n + (Number(d[x.key]) || 0), 0) : Math.max(...series.map((x) => Number(d[x.key]) || 0)));
  const max = niceMax(Math.max(1, ...data.map(height)));
  const ticks = Number.isInteger(max / 2) ? [max, max / 2] : [max];
  const leave = (e) => e.pointerType === 'mouse' && setHover(null);
  return html`<figure class="pl-chart">
    ${series.length > 1 && html`<div class="pl-legend">${series.map((x) => html`<span key=${x.key}><i style=${{ background: x.color }} />${x.label}</span>`)}</div>`}
    <div class="pl-plot" onPointerLeave=${leave}>
      ${ticks.map((t) => html`<div key=${t} class="pl-tick" style=${{ bottom: `${(100 * t) / max}%` }}><span>${compact(t)}</span></div>`)}
      <div class="pl-cols">${data.map((d, i) => html`<button key=${i} class=${`pl-col ${hover === i ? 'on' : ''}`} aria-label=${tip(d).join(', ')}
          onPointerEnter=${(e) => e.pointerType === 'mouse' && setHover(i)} onClick=${() => setHover(hover === i ? null : i)}>
        <span class=${stacked ? 'pl-stack' : 'pl-group'}>${series
          .filter((x) => stacked ? Number(d[x.key]) > 0 : true)
          .map((x) => html`<i key=${x.key} style=${{ height: `${(100 * (Number(d[x.key]) || 0)) / max}%`, background: x.color }} />`)}</span>
      </button>`)}</div>
      ${hover !== null && data[hover] && html`<div class=${`pl-tip ${hover > data.length / 2 ? 'left' : ''}`} style=${{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
        ${tip(data[hover]).map((line, i) => html`<div key=${i} class=${i ? '' : 'pl-tip-head'}>${line}</div>`)}</div>`}
    </div>
    <div class="pl-x">${data.map((d, i) => html`<span key=${i}>${(data.length - 1 - i) % every === 0 ? xLabel(d, i) : ''}</span>`)}</div>
    ${caption && html`<figcaption class="hint">${caption}</figcaption>`}
  </figure>`;
}

// Barres horizontales : une ligne par élément, la valeur au bout
function Bars({ rows, color = C.blue, max }) {
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return html`<div class="pl-bars">${rows.map((r) => html`<div key=${r.label} class="pl-bar-row">
    <span class="pl-bar-label">${r.label}</span>
    <span class="pl-bar-track"><i style=${{ width: `${Math.max(r.value ? 1.5 : 0, (100 * r.value) / top)}%`, background: color }} /></span>
    <span class="pl-bar-value">${r.text ?? num(r.value)}</span>
  </div>`)}</div>`;
}

function Tile({ label, value, sub, delta, hero = false }) {
  return html`<div class=${`pl-tile ${hero ? 'hero' : ''}`}>
    <div class="pl-tile-label">${label}</div>
    <div class="pl-tile-value">${value}${delta != null && delta !== 0 && html`<span class=${`pl-delta ${delta > 0 ? 'up' : 'down'}`}>${delta > 0 ? '▲' : '▼'} ${num(Math.abs(delta))}</span>`}</div>
    ${sub && html`<div class="pl-tile-sub">${sub}</div>`}
  </div>`;
}

// --- Les blocs de l'écran ------------------------------------------------------------------
function Overview({ st }) {
  const t = st.totals;
  const src = st.pandi.sources;
  const earned30 = Object.keys(EARN).reduce((n, k) => n + (src[k]?.d30 || 0), 0);
  const spent30 = Object.keys(SPEND).reduce((n, k) => n + (src[k]?.d30 || 0), 0);
  const complete = pct(t.kid_routines_complete_30d, t.kid_routines_30d);
  return html`<div class="pl-tiles">
    <${Tile} hero label="Familles actives ces 7 jours" value=${num(t.families_active_7d)} delta=${t.families_active_7d - t.families_active_prev_7d}
      sub=${`sur ${num(t.families)} ${s(t.families, 'famille')} · ${num(t.families_active_30d)} en 30 jours`} />
    <${Tile} label="Familles" value=${num(t.families)} sub=${t.families_new_7d ? `+${num(t.families_new_7d)} cette semaine` : 'aucune nouvelle cette semaine'} />
    <${Tile} label="Parents" value=${num(t.parents)} sub=${`${num(t.parents_seen_7d)} ${s(t.parents_seen_7d, "a ouvert l'app", "ont ouvert l'app")} en 7 j${t.accounts_no_family ? ` · ${num(t.accounts_no_family)} ${s(t.accounts_no_family, 'compte')} sans famille` : ''}`} />
    <${Tile} label="Enfants" value=${num(t.children)} sub=${`${num(t.children_active_7d)} ${s(t.children_active_7d, 'noté')} en 7 j`} />
    <${Tile} label="Routines suivies (7 j)" value=${num(t.routines_7d)} delta=${t.routines_7d - t.routines_prev_7d} sub=${`${num(t.routines_total)} depuis le début`} />
    <${Tile} label="Routines notées jusqu'au bout" value=${complete == null ? '—' : `${complete} %`} sub=${`${num(t.kid_routines_complete_30d)} sur ${num(t.kid_routines_30d)} (par enfant, 30 j)`} />
    <${Tile} label="Pandi gagnés (30 j)" value=${compact(earned30)} sub=${`${num(Object.keys(EARN).reduce((n, k) => n + (src[k]?.total || 0), 0))} depuis le début`} />
    <${Tile} label="Pandi dépensés (30 j)" value=${compact(spent30)} sub=${earned30 ? `${pct(spent30, earned30)} % des pandi gagnés` : 'rien gagné sur 30 j'} />
  </div>`;
}

function Funnel({ st }) {
  const first = st.funnel[0]?.n || 0;
  return html`<section class="pl-section">
    <h3 class="section-title">Entonnoir d'activation</h3>
    <${Bars} max=${Math.max(1, first)} rows=${st.funnel.map((f, i) => {
      const prev = i ? st.funnel[i - 1].n : null;
      return { label: FUNNEL[f.key] || f.key, value: f.n, text: `${num(f.n)}${i && prev ? ` · ${pct(f.n, prev)} %` : ''}` };
    })} />
    <p class="hint">Chaque ligne compte les familles arrivées à cette étape (le % compare à l'étape d'avant).${st.totals.accounts_no_family ? ` ${num(st.totals.accounts_no_family)} ${s(st.totals.accounts_no_family, 'compte')} ${s(st.totals.accounts_no_family, "s'est inscrit", 'se sont inscrits')} sans créer ni rejoindre de famille.` : ''}</p>
  </section>`;
}

function Activity({ st }) {
  return html`<section class="pl-section">
    <h3 class="section-title">Routines suivies par jour (30 jours)</h3>
    <${Columns} data=${st.daily} every=${7}
      series=${[{ key: 'soir', label: '🌙 Soir', color: C.blue }, { key: 'matin', label: '☀️ Matin', color: C.orange }]}
      xLabel=${(d) => day(d.d)}
      tip=${(d) => [longDay(d.d), `🌙 ${num(d.soir)} soir · ☀️ ${num(d.matin)} matin`, `${num(d.families)} ${s(d.families, 'famille')} · ${num(d.notes)} ${s(d.notes, 'note')}`]}
      caption="Une routine suivie = une famille qui a noté au moins une tâche de cette routine ce jour-là." />
    <h3 class="section-title">Familles par semaine (12 semaines)</h3>
    <${Columns} data=${st.weekly} stacked=${false} every=${2}
      series=${[{ key: 'active', label: 'Actives', color: C.blue }, { key: 'new', label: 'Nouvelles', color: C.orange }]}
      xLabel=${(d, i) => (i === st.weekly.length - 1 ? 'cette sem.' : day(d.w))}
      tip=${(d) => [`Semaine du ${day(d.w)}`, `${num(d.active)} ${s(d.active, 'active')} · ${num(d.new)} ${s(d.new, 'nouvelle')}`, `${num(d.routines)} ${s(d.routines, 'routine suivie', 'routines suivies')}`]} />
  </section>`;
}

function Quality({ st }) {
  const counts = RATINGS.map((r) => ({ ...r, n: st.colors[r.key]?.d30 || 0 }));
  const total = counts.reduce((n, r) => n + r.n, 0);
  return html`<section class="pl-section">
    <h3 class="section-title">Comment se passent les routines (notes des 30 jours)</h3>
    ${total
      ? html`<div class="pl-split" role="img" aria-label=${counts.map((r) => `${r.label} ${pct(r.n, total)} %`).join(', ')}>
          ${counts.filter((r) => r.n).map((r) => html`<i key=${r.key} style=${{ flexGrow: r.n, background: r.color }} />`)}</div>
        <div class="pl-legend wrap">${counts.map((r) => html`<span key=${r.key}><i style=${{ background: r.color }} />${r.label} <b>${pct(r.n, total)} %</b> <em>(${num(r.n)})</em></span>`)}</div>`
      : html`<p class="hint">Aucune note ces 30 derniers jours.</p>`}
  </section>`;
}

function Economy({ st }) {
  const src = st.pandi.sources;
  const t = st.totals;
  const row = (labels) => Object.entries(labels).map(([k, label]) => ({ label, value: src[k]?.total || 0, text: `${num(src[k]?.total || 0)}${src[k]?.d30 ? ` (dont ${num(src[k].d30)} sur 30 j)` : ''}` })).filter((r) => r.value).sort((a, b) => b.value - a.value);
  const earn = row(EARN);
  const spend = row(SPEND);
  const circulating = st.pandi.kids_balance + st.pandi.pots_balance;
  return html`<section class="pl-section">
    <h3 class="section-title">Économie des pandi</h3>
    <div class="pl-tiles small">
      <${Tile} label="Pandi en circulation" value=${compact(circulating)} sub=${`dans les cagnottes des enfants${st.pandi.pots_balance ? ` (+${num(st.pandi.pots_balance)} en commun)` : ''}`} />
      <${Tile} label="Par enfant en moyenne" value=${t.children ? num(Math.round(st.pandi.kids_balance / t.children)) : '—'} sub="pas encore dépensés" />
    </div>
    <${Columns} data=${st.weekly} stacked=${false} every=${2}
      series=${[{ key: 'earned', label: 'Gagnés', color: C.blue }, { key: 'spent', label: 'Dépensés', color: C.orange }]}
      xLabel=${(d, i) => (i === st.weekly.length - 1 ? 'cette sem.' : day(d.w))}
      tip=${(d) => [`Semaine du ${day(d.w)}`, `${num(d.earned)} gagnés · ${num(d.spent)} dépensés`]} />
    <div class="pl-two">
      <div><h4>D'où viennent les pandi</h4>${earn.length ? html`<${Bars} rows=${earn} color=${C.blue} />` : html`<p class="hint">Rien pour l'instant.</p>`}</div>
      <div><h4>Où ils partent</h4>${spend.length ? html`<${Bars} rows=${spend} color=${C.orange} />` : html`<p class="hint">Rien pour l'instant.</p>`}</div>
    </div>
    <p class="hint">Les cadeaux entre enfants et les dépôts dans la cagnotte commune passent d'une cagnotte à l'autre : ils ne sont ni gagnés ni dépensés.</p>
  </section>`;
}

function Features({ st }) {
  const n = st.totals.families;
  const rows = Object.entries(FEATURES)
    .map(([k, label]) => ({ label, value: st.features[k] || 0 }))
    .sort((a, b) => b.value - a.value)
    .map((r) => ({ ...r, text: `${num(r.value)} · ${pct(r.value, n) ?? 0} %` }));
  return html`<section class="pl-section">
    <h3 class="section-title">Fonctions utilisées (familles, depuis le début)</h3>
    <${Bars} rows=${rows} max=${Math.max(1, n)} />
    <p class="hint">Le minuteur et le coin calme ne laissent aucune trace : ils ne sont pas comptés.</p>
  </section>`;
}

function Retention({ st }) {
  if (!st.cohorts.length) return null;
  const cell = (n, total) => {
    if (n == null) return html`<td class="pl-empty" />`;
    const p = pct(n, total);
    const bg = p ? BLUES[Math.min(BLUES.length - 1, Math.round((p / 100) * (BLUES.length - 1)))] : '#f1eff7';
    return html`<td style=${{ background: bg, color: p >= 60 ? '#fff' : 'var(--ink)' }} title=${`${num(n)} sur ${num(total)}`}>${p} %</td>`;
  };
  return html`<section class="pl-section">
    <h3 class="section-title">Rétention par semaine d'arrivée</h3>
    <div class="pl-table-wrap"><table class="pl-table pl-cohorts">
      <thead><tr><th>Semaine d'arrivée</th><th>Familles</th>${Array.from({ length: 8 }, (_, k) => html`<th key=${k}>S${k}</th>`)}</tr></thead>
      <tbody>${st.cohorts.map((c) => html`<tr key=${c.w}><th>${day(c.w)}</th><td>${num(c.families)}</td>${c.weeks.map((n) => cell(n, c.families))}</tr>`)}</tbody>
    </table></div>
    <p class="hint">S0 = la semaine de la création de la famille, S1 la suivante… Une case = la part de ces familles qui a noté au moins une routine cette semaine-là.</p>
  </section>`;
}

function KidsAndItems({ st }) {
  const ages = AGES.map(([k, label]) => ({ label, value: st.ages[k] || 0 })).filter((r) => r.value);
  return html`<section class="pl-section pl-two">
    <div>
      <h3 class="section-title">Enfants par âge</h3>
      ${ages.length ? html`<${Bars} rows=${ages} />` : html`<p class="hint">Aucun enfant.</p>`}
    </div>
    <div>
      <h3 class="section-title">Objets les plus achetés</h3>
      ${st.top_items.length
        ? html`<div class="pl-items">${st.top_items.map((x) => {
          const item = getItem(x.item);
          return html`<div key=${x.item} class="pl-item" title=${item?.name || x.item}>
            <div class="pl-item-thumb">${item ? html`<${ItemThumb} item=${item} />` : '❔'}</div>
            <div class="pl-item-name">${item?.name || x.item}</div><b>${num(x.n)}</b>
          </div>`;
        })}</div>`
        : html`<p class="hint">Rien d'acheté pour l'instant.</p>`}
    </div>
  </section>`;
}

function csvOf(families, names, today) {
  const cols = ['Famille', 'Statut', 'Créée le', 'Parents', 'E-mails', 'Enfants', 'Dernière routine', 'Routines 7 j', 'Routines', 'Jours notés', 'Pandi gagnés', 'Pandi dépensés', 'Dernière ouverture', 'Version'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = families.map((f) => [familyLabel(f, names), familyStatus(f, today).label, f.created, f.parents, names ? f.emails.join(' ') : '', f.children, f.last_routine, f.routines_7d, f.routines, f.days, f.earned, f.spent, f.last_seen ? new Date(f.last_seen).toLocaleString('fr-FR') : '', f.version].map(q).join(';'));
  return `﻿${[cols.map(q).join(';'), ...lines].join('\r\n')}`;
}

function Families({ st, names }) {
  const today = st.today;
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csvOf(st.families, names, today)], { type: 'text/csv;charset=utf-8' }));
    a.download = `pandi-familles-${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const counts = [0, 1, 2, 3].map((rank) => st.families.filter((f) => familyStatus(f, today).rank === rank).length);
  return html`<section class="pl-section">
    <h3 class="section-title">Familles <span class="spacer" /><button class="p-btn" onClick=${download}>⬇️ Tableur (CSV)</button></h3>
    <p class="hint">🟢 ${num(counts[0])} ${s(counts[0], 'active')} (routine notée ces 7 jours) · 🟠 ${num(counts[1])} ${s(counts[1], 'ralentit', 'ralentissent')} (8 à 30 jours) · 🔴 ${num(counts[2])} ${s(counts[2], 'arrêtée')} · ⚪ ${num(counts[3])} pas encore ${s(counts[3], 'commencé', 'commencées')}</p>
    <div class="pl-table-wrap"><table class="pl-table">
      <thead><tr><th>Famille</th><th class="pl-left">Statut</th><th>Créée le</th><th>Parents</th><th>Enfants</th><th>Dernière routine</th><th>Routines 7 j</th><th>Routines</th><th>Jours notés</th><th>Pandi gagnés</th><th>Dépensés</th><th>Dernière ouverture</th><th>Version</th></tr></thead>
      <tbody>${st.families.map((f) => {
        const status = familyStatus(f, today);
        return html`<tr key=${f.n}>
          <th><div>${familyLabel(f, names)}${f.own && html` <span class="pl-badge">vous</span>`}</div>${names && f.emails.length > 0 && html`<div class="pl-emails">${f.emails.join(', ')}</div>`}</th>
          <td class="pl-nowrap pl-left">${status.icon} ${status.label}</td>
          <td class="pl-nowrap">${day(f.created)}</td>
          <td>${num(f.parents)}</td><td>${num(f.children)}</td>
          <td class="pl-nowrap">${f.last_routine ? day(f.last_routine) : '—'}</td>
          <td>${num(f.routines_7d)}</td><td>${num(f.routines)}</td><td>${num(f.days)}</td>
          <td>${num(f.earned)}</td><td>${num(f.spent)}</td>
          <td class="pl-nowrap">${ago(f.last_seen)}</td><td>${f.version || '—'}</td>
        </tr>`;
      })}</tbody>
    </table></div>
  </section>`;
}

// --- L'onglet --------------------------------------------------------------------------
export function Pilotage() {
  useStyle();
  const [prefs, setPrefsState] = useState(readPrefs);
  const [st, setSt] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const setPref = (patch) => {
    const next = { ...prefs, ...patch };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    setPrefsState(next);
  };

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setSt(await actions.adminStats(prefs.skipOwn));
    } catch (e) {
      setError(/admin_stats|function/i.test(e.message) ? "La fonction admin_stats n'est pas encore installée dans Supabase (supabase/migrations/20261027120000_pilotage.sql)." : e.message || 'Chiffres indisponibles.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [prefs.skipOwn]);

  return html`<div class="pilotage">
    <h2>Pilotage de l'adoption</h2>
    <p class="hint">Toutes les familles de Pandi, sans prénom d'enfant ni photo. Visible seulement par toi.</p>
    <div class="pl-controls">
      <label class="pl-switch"><${Toggle} on=${!prefs.skipOwn} onChange=${(v) => setPref({ skipOwn: !v })} label="Compter ma famille" /><span>Compter ma famille</span></label>
      <label class="pl-switch"><${Toggle} on=${prefs.names} onChange=${(v) => setPref({ names: v })} label="Noms et e-mails" /><span>Noms et e-mails</span></label>
      <span class="spacer" />
      ${st && html`<span class="pl-when">à ${new Date(st.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>`}
      <button class="p-btn" disabled=${busy} onClick=${() => { sfx.tap(); load(); }}>${busy ? '…' : '↻ Actualiser'}</button>
    </div>
    ${error && html`<p class="pl-error">${error}</p>`}
    ${!st && !error && html`<p class="hint">Chargement des chiffres…</p>`}
    ${st && st.totals.families === 0 && html`<div class="pl-empty-state">
      <div class="emoji">🌱</div>
      <p>Aucune ${prefs.skipOwn ? 'autre ' : ''}famille pour l'instant. Les chiffres apparaîtront ici dès que de nouvelles familles s'inscriront sur www.pandiflow.com.</p>
    </div>`}
    ${st && st.totals.families > 0 && html`<div class=${busy ? 'pl-busy' : ''}>
      <${Overview} st=${st} />
      <${Funnel} st=${st} />
      <${Activity} st=${st} />
      <${Quality} st=${st} />
      <${Economy} st=${st} />
      <${Features} st=${st} />
      <${Retention} st=${st} />
      <${KidsAndItems} st=${st} />
      <${Families} st=${st} names=${prefs.names} />
    </div>`}
  </div>`;
}
