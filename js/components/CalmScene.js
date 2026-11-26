// Labo : un exercice du coin calme en images façon Pixar, à la place de la scène 3D (CalmStage.js).
// Pandi et le héros de l'exercice sont dans la même image ; chaque état (fâché, il inspire, il souffle, c'est fini…)
// est une retouche de la scène de base, alignée sur elle : on passe de l'une à l'autre en fondu, et seuls transform
// et opacity bougent (la carte graphique les joue seule). Les images sont faites par tests/local/calme_art.py.
// Pour l'instant : le souffle du dragon.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { POSES } from '../config.js';

const BASE = new URL('../../assets/calme/', import.meta.url).href;
// les héros qui ont leur scène en images (assets/calme/<héros>/scene.json)
const SCENES = new Set(['dragon']);
const catalogs = {};
const loading = {};

export const hasCalmScene = (hero) => POSES && SCENES.has(hero);

export function loadCalmScene(hero) {
  if (!hasCalmScene(hero)) return Promise.resolve(null);
  return (loading[hero] ||= fetch(`${BASE}${hero}/scene.json`)
    .then((r) => r.json())
    .then((c) => {
      catalogs[hero] = c;
      // les calques en cache avant le premier fondu
      c.layers.forEach((l) => { const i = new Image(); i.src = `${BASE}${hero}/${l}.webp`; });
      return c;
    }));
}

// Le souffle du dragon : l'état de la scène à chaque étape de la respiration (CalmCorner.js, Breath)
//   ready : la scène de base, le dragon tout fâché ; in / hold : ils inspirent ; out : il crache son feu (de plus en
//   plus petit), puis on revoit la scène de base ; calm : ils se donnent la patte.
// Sur la scène de base, le visage apaisé remplace le visage fâché dès que la colère est retombée de moitié.
function dragonView(ctx, fired) {
  const anger = ctx.anger ?? 1;
  const out = ctx.phase === 'out';
  // le visage qu'on revoit après le feu est déjà celui du souffle suivant (un peu moins fâché)
  const shown = out && fired ? ctx.next ?? anger : anger;
  const state = ctx.phase === 'calm' ? 'calme' : ctx.phase === 'in' || ctx.phase === 'hold' ? 'inspire' : out && !fired ? 'souffle' : 'fache';
  // le feu rétrécit à chaque souffle : au dernier, un tout petit feu
  return { state, apaise: shown < 0.55, feuTaille: 0.32 + 0.68 * anger };
}

export function CalmScene({ hero, ctx = {}, label = 'Pandi et son ami font l’exercice' }) {
  const [, setReady] = useState(Boolean(catalogs[hero]));
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!catalogs[hero]) loadCalmScene(hero).then(() => setReady(true)).catch((e) => console.warn('Pandi : scène du coin calme indisponible', e?.message));
  }, [hero]);
  // pendant « out », le feu dure les deux tiers du souffle, puis le visage revient
  useEffect(() => {
    setFired(false);
    if (ctx.phase !== 'out') return undefined;
    const t = setTimeout(() => setFired(true), (ctx.secs || 5) * 680);
    return () => clearTimeout(t);
  }, [ctx.phase, ctx.cycle]);
  const c = catalogs[hero];
  if (!c) return html`<div class="cs" role="img" aria-label=${label}></div>`;
  const v = dragonView(ctx, fired);
  const rest = v.state === 'fache';
  const img = (name, cls = '') => html`<img class=${`cs-l cs-${name} ${cls}`} src=${`${BASE}${hero}/${name}.webp`} alt="" draggable="false" />`;
  // un seul état à l'écran : le nouveau apparaît en fondu par-dessus, l'ancien ne s'en va qu'une fois couvert
  const state = (name) => img(name, `cs-etat ${v.state === name ? 'on' : ''}`);
  const [fx, fy] = c.feu;
  return html`<div class=${`cs cs-${hero} cs-${ctx.phase || 'ready'}`} role="img" aria-label=${label}>
    <div class="cs-cadre" style=${{ aspectRatio: `${c.frame[0]} / ${c.frame[1]}`, '--secs': `${ctx.secs || 3}s` }}>
      <div class="cs-souffle">
        <div class=${`cs-repos ${rest ? 'on' : ''} ${v.apaise ? 'apaise' : ''}`}>
          ${img('fache')}
          ${img('apaise', v.apaise ? 'on' : '')}
          ${img('yeux', rest ? 'cs-cligne' : '')}
        </div>
        ${state('inspire')}
        ${state('souffle')}
        <div class=${`cs-feu-tout ${v.state === 'souffle' ? 'on' : ''}`} style=${{ transformOrigin: `${fx}% ${fy}%`, '--f': v.feuTaille.toFixed(2) }}>
          <div class="cs-feu-vif" style=${{ transformOrigin: `${fx}% ${fy}%` }}>${img('feu')}</div>
        </div>
        ${state('calme')}
      </div>
      ${v.state === 'calme' ? [['💖', 30, 8, 0], ['💗', 52, 2, 0.7], ['💖', 70, 10, 1.4]].map(([t, x, y, d], i) => html`<span key=${i} class="cs-coeur" style=${{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>${t}</span>`) : null}
    </div>
  </div>`;
}
