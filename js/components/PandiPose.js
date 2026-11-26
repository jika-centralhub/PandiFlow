// Labo : Pandi en poses illustrées animées par calques (à la place de la 3D sur les cartes et le minuteur).
// Chaque pose (assets/pandi/<pose>/) a son corps, parfois une ou deux parties qui bougent (le bras qui
// frotte, les mains qui applaudissent…) et ses yeux fermés pour cligner ; tout bouge par des animations
// CSS (transform, opacity, voir css/pandi-pose.css) : la carte graphique les joue seule, aucun calcul
// à chaque image. Pendant une semaine à thème, Pandi porte la coiffe du thème sur la tête.
// Les calques sont fabriqués par tests/local/pose_layers.py (hors dépôt) ; leur liste : poses.json.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { eveningDate } from '../lib/dates.js';
import { themeLookFor } from '../mascot/themeLook.js';

const BASE = new URL('../../assets/pandi/', import.meta.url).href;
let catalog = null;
let loading = null;
export const poseCatalog = () => catalog;
export const POSES_BASE = BASE;
export const loadPoses = () => (loading ||= fetch(`${BASE}poses.json`).then((r) => r.json()).then((c) => (catalog = c)));

// La coiffe du thème (la tenue des thèmes de js/mascot/themeLook.js) ; le chapeau d'anniversaire n'a pas d'image
const HATS = { antennes: 'espace', chapeau_magicien: 'magicien', masque_plongee: 'plongeur', heaume: 'chevalier', cowboy: 'cowboy', toque: 'cuisinier', casquette_police: 'policier', casque_pompier: 'pompier' };
// Les numéros de la 3D sans pose à eux
// (danse : la pose de la fête d'anniversaire, en tenue de fête ; tant que son image manque, bravo)
const ALIAS = { coucou: 'idle', danse: 'bravo', reveil: 'lever', coucher: 'dodo', auLit: 'endormi', panique: 'idle', alarme: 'bravo' };

// Le test de fluidité (js/labo/testFluidite.js) peut imposer une pose à tous les Pandi
let forced = null;
const listeners = new Set();
export function forcePose(name) {
  forced = name || null;
  listeners.forEach((fn) => fn());
}

export function poseFor(act, ctx = {}) {
  if (forced && catalog?.poses[forced]) return forced;
  if (act === 'habiller') return ctx.variant === 'pyjama' ? 'pyjama' : 'habiller';
  if (act === 'manger' && ctx.variant === 'cereales' && catalog?.poses.cereales) return 'cereales';
  if (catalog?.poses[act]) return act;
  return ALIAS[act] || 'idle';
}

// Les petits effets autour de Pandi : [classe, texte, gauche %, haut %, retard s]
const FX = {
  dodo: [['zz', 'z', 70, 18, 0], ['zz', 'z', 76, 10, 1.1], ['zz', 'Z', 82, 2, 2.2]],
  endormi: [['zz', 'z', 70, 18, 0], ['zz', 'z', 76, 10, 1.1], ['zz', 'Z', 82, 2, 2.2]],
  sieste: [['zz', 'z', 68, 16, 0], ['zz', 'z', 74, 8, 1.1], ['zz', 'Z', 80, 0, 2.2]],
  calin: [['coeur', '💖', 22, 22, 0], ['coeur', '💗', 74, 16, 0.9], ['coeur', '💖', 50, 6, 1.8]],
  bravo: [['etoile', '⭐', 14, 14, 0], ['etoile', '✨', 82, 10, 0.3], ['etoile', '⭐', 50, 0, 0.6], ['etoile', '✨', 24, 40, 0.9], ['etoile', '⭐', 78, 38, 1.2]],
  ok: [['etoile', '✨', 18, 30, 0], ['etoile', '✨', 80, 26, 0.7]],
  douche: [['bulle', '', 18, 40, 0], ['bulle', '', 80, 44, 0.5], ['bulle', '', 28, 62, 1], ['bulle', '', 72, 66, 1.5], ['note', '🎵', 78, 12, 0.4]],
  mains: [['bulle', '', 36, 50, 0], ['bulle', '', 62, 52, 0.6], ['bulle', '', 48, 44, 1.2]],
  lever: [['etoile', '✨', 20, 8, 0], ['etoile', '✨', 80, 6, 0.8]],
  danse: [['coeur', '🎉', 14, 30, 0], ['coeur', '🎈', 82, 24, 0.7], ['coeur', '🎉', 76, 50, 1.4], ['coeur', '🎈', 20, 56, 2.1]],
};

export function PandiPose({ act = 'idle', ctx = {}, active = true, class: cls = '', label = 'Pandi le panda' }) {
  const [, setReady] = useState(Boolean(catalog));
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  useEffect(() => {
    if (!catalog) loadPoses().then(() => setReady(true)).catch((e) => console.warn('Pandi : poses indisponibles', e?.message));
  }, []);
  if (!catalog) return html`<div class=${`pp ${cls}`} role="img" aria-label=${label}></div>`;
  const name = poseFor(act, ctx);
  const p = catalog.poses[name];
  const [FW, FH] = catalog.frame;
  const look = themeLookFor(eveningDate());
  const hat = p.tete && (HATS[look?.tete] || HATS[look?.yeux]);
  const t = p.tete;
  const hatH = hat ? t.w * catalog.coiffes[hat].ratio * (FW / FH) : 0;
  return html`<div class=${`pp pp-${name} ${active ? '' : 'pp-pause'} ${cls}`} style=${{ aspectRatio: `${FW} / ${FH}` }} role="img" aria-label=${label}>
    <div class="pp-tout"><div class="pp-souffle">
      ${p.layers.map((l) => html`<div key=${l.name} class=${`pp-l pl-${l.name}`} style=${l.pivot ? { transformOrigin: `${l.pivot[0]}% ${l.pivot[1]}%` } : null}>
        <img src=${`${BASE}${name}/${l.name}.webp`} alt="" draggable="false" />
        ${name === 'pancarte' && l.name === 'bras' && p.panneau && html`<span class="pp-panneau" style=${{ left: `${p.panneau.x}%`, top: `${p.panneau.y}%`, fontSize: `${p.panneau.size}cqw` }}>${ctx.emoji || '⭐'}</span>`}
      </div>`)}
      ${hat && html`<img class="pp-coiffe" src=${`${BASE}coiffes/${hat}.webp`} alt="" draggable="false"
        style=${{ left: `${t.x - t.w / 2}%`, top: `${t.y - hatH * 0.78}%`, width: `${t.w}%`, transform: `rotate(${t.rot}deg)` }} />`}
    </div></div>
    ${(FX[name] || []).map(([k, txt, x, y, d], i) => html`<span key=${i} class=${`pp-fx pp-${k}`} style=${{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>${txt}</span>`)}
  </div>`;
}
