// Éditeur du look de l'avatar (gratuit) : peau, coiffure, yeux, lunettes, détails…
import { html } from '../vendor/preact-htm.js';
import { Avatar } from '../avatar/Avatar.js';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, GLASSES_COLORS,
  FACE_SHAPES, HAIR_STYLES, EYE_SHAPES, BROW_SHAPES, BROW_THICKNESS, GLASSES_SHAPES, normalizeLook,
} from '../avatar/palette.js';
import { sfx } from '../lib/sounds.js';

function Swatches({ options, value, onPick }) {
  return html`<div class="swatches">
    ${Object.entries(options).map(([k, o]) => html`<button key=${k} class=${`swatch ${value === k ? 'on' : ''}`} style=${{ background: o.color }} title=${o.label} aria-label=${o.label} onClick=${() => onPick(k)} />`)}
  </div>`;
}

function Options({ options, value, onPick, previewKey, look }) {
  return html`<div class="option-grid">
    ${Object.entries(options).map(([k, label]) => html`<button key=${k} class=${`option ${value === k ? 'on' : ''}`} onClick=${() => onPick(k)}>
      <div class="mini"><${Avatar} look=${{ ...look, [previewKey]: k }} mode="head" still=${true} /></div>
      ${label}
    </button>`)}
  </div>`;
}

function Chips({ options, value, onPick }) {
  return html`<div class="chip-row">
    ${Object.entries(options).map(([k, label]) => html`<button key=${k} class=${`chip ${value === k ? 'on' : ''}`} onClick=${() => onPick(k)}>${label}</button>`)}
  </div>`;
}

export function LookEditor({ look: raw, onChange, onPhoto }) {
  const look = normalizeLook(raw);
  const set = (key) => (value) => {
    sfx.pop();
    onChange({ ...look, [key]: value });
  };
  const toggle = (key) => () => {
    sfx.pop();
    onChange({ ...look, [key]: !look[key] });
  };
  return html`<div>
    ${onPhoto && html`<button class="photo-cta" onClick=${onPhoto}>
      <span class="ico">📸</span>
      <span style="text-align:left"><strong>Créer mon avatar avec une photo</strong><span>La magie de Pandi transforme ta photo en personnage !</span></span>
    </button>`}
    <div class="look-group"><h3>Couleur de peau</h3><${Swatches} options=${SKIN_TONES} value=${look.skin} onPick=${set('skin')} /></div>
    <div class="look-group"><h3>Coiffure</h3><${Options} options=${HAIR_STYLES} value=${look.hair} onPick=${set('hair')} previewKey="hair" look=${look} /></div>
    <div class="look-group"><h3>Couleur des cheveux</h3><${Swatches} options=${HAIR_COLORS} value=${look.hairColor} onPick=${set('hairColor')} /></div>
    <div class="look-group"><h3>Forme du visage</h3><${Options} options=${FACE_SHAPES} value=${look.face} onPick=${set('face')} previewKey="face" look=${look} /></div>
    <div class="look-group"><h3>Yeux</h3><${Options} options=${EYE_SHAPES} value=${look.eyes} onPick=${set('eyes')} previewKey="eyes" look=${look} /></div>
    <div class="look-group"><h3>Couleur des yeux</h3><${Swatches} options=${EYE_COLORS} value=${look.eyeColor} onPick=${set('eyeColor')} /></div>
    <div class="look-group"><h3>Sourcils</h3><${Chips} options=${BROW_SHAPES} value=${look.brows} onPick=${set('brows')} />
      <div style="height:8px" /><${Chips} options=${BROW_THICKNESS} value=${look.browThickness} onPick=${set('browThickness')} /></div>
    <div class="look-group"><h3>Lunettes</h3><${Chips} options=${GLASSES_SHAPES} value=${look.glasses} onPick=${set('glasses')} />
      ${look.glasses !== 'aucune' && html`<div style="height:10px" /><${Swatches} options=${GLASSES_COLORS} value=${look.glassesColor} onPick=${set('glassesColor')} />`}</div>
    <div class="look-group"><h3>Petits détails</h3><div class="chip-row">
      <button class=${`chip ${look.freckles ? 'on' : ''}`} onClick=${toggle('freckles')}>Taches de rousseur</button>
      <button class=${`chip ${look.dimples ? 'on' : ''}`} onClick=${toggle('dimples')}>Fossettes</button>
      <button class=${`chip ${look.missingTooth ? 'on' : ''}`} onClick=${toggle('missingTooth')}>Dent de lait tombée</button>
    </div></div>
    <div class="look-group"><h3>Couleur du haut</h3><${Swatches} options=${OUTFIT_COLORS} value=${look.outfit} onPick=${set('outfit')} /></div>
  </div>`;
}
