// Réglages → « Le coucher de Pandi » : le jeu « Chut, Pandi s'endort » (Chambre.js, js/lib/chut.js).
// Les choix sont ceux de la famille ; le refus du micro, lui, est propre à chaque appareil.
import { html } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { chutSettings, CHUT_SECONDS, SENS, setEarRefused } from '../lib/chut.js';
import { sfx } from '../lib/sounds.js';
import { Toggle } from './ui.js';

const duree = (s) => (s < 60 ? `${s} s` : `${s / 60} min`);

export function ChutSection() {
  const s = useStore();
  const c = chutSettings(s.settings);
  const set = (patch) => actions.updateSettings({ chut: { ...c, ...patch } });
  const toggle = (on) => {
    // rallumé : le micro sera redemandé sur cet appareil, même s'il avait été refusé
    if (on) setEarRefused(false);
    set({ on });
  };
  const pick = (patch) => () => {
    sfx.tap();
    set(patch);
  };
  return html`<h3 class="section-title" style="color:var(--ink);margin-top:20px">Le coucher de Pandi</h3>
    <div class="row-list">
      <div class="row"><span class="emoji">🤫</span><div class="grow"><div class="title">Jeu « Chut, Pandi s'endort »</div><div class="meta">Après la bonne nuit, Pandi ne s'endort que si la maison reste calme. Le micro mesure seulement le bruit, le temps du jeu : rien n'est enregistré ni envoyé.</div></div>
        <${Toggle} on=${c.on} onChange=${toggle} label="Jeu Chut, Pandi s'endort" /></div>
      ${c.on && html`<div class="row"><span class="emoji">⏱️</span><div class="grow"><div class="title">Temps de calme pour qu'il s'endorme</div></div>
        <div class="days">${CHUT_SECONDS.map((n) => html`<button key=${n} class=${`day ${c.seconds === n ? 'on' : ''}`} onClick=${pick({ seconds: n })}>${duree(n)}</button>`)}</div></div>`}
      ${c.on && html`<div class="row"><span class="emoji">👂</span><div class="grow"><div class="title">Oreille de Pandi</div><div class="meta">Tolérante si Pandi remue trop souvent ; sensible s'il s'endort malgré le bruit</div></div>
        <div class="days">${Object.entries(SENS).map(([id, x]) => html`<button key=${id} class=${`day ${c.sens === id ? 'on' : ''}`} onClick=${pick({ sens: id })}>${x.label}</button>`)}</div></div>`}
    </div>`;
}
