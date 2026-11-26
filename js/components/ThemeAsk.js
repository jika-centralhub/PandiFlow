// Le « Le savais-tu ? » du thème, à la fin de chaque routine. (Le fichier gardait aussi la question posée
// aux enfants le premier jour du thème ; depuis la v1.36, c'est le parent qui décide, sans vote.)
import { html } from '../vendor/preact-htm.js';
import { getTheme } from '../avatar/themes.js';
import { sfx } from '../lib/sounds.js';

// Le « Le savais-tu ? » du thème, le même pour tous les enfants (le parent le lit)
export function FunFact({ themeId, fact, onClose }) {
  const theme = getTheme(themeId);
  return html`<div class="ff-overlay" onClick=${onClose}>
    <div class="ff-card" role="dialog" aria-label="Le savais-tu ?" style=${{ '--c': theme?.color || '#7b6cff' }} onClick=${(e) => e.stopPropagation()}>
      <span class="ff-theme">${theme?.emoji} ${theme?.name}</span>
      <div class="ff-top"><span class="ff-emoji">${fact.emoji}</span><h2>Le savais-tu ?</h2></div>
      <p class="ff-text">${fact.text}</p>
      <div class="sheet-actions"><button class="btn btn-gold btn-big" onClick=${() => { sfx.tap(); onClose(); }}>Waouh !</button></div>
    </div>
  </div>`;
}

export function FunFactBar({ onOpen }) {
  return html`<button class="ff-bar" onClick=${onOpen}><span aria-hidden="true">💡</span> Le savais-tu ?</button>`;
}
