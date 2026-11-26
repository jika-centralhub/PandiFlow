// Le thème programmé par les parents : le premier jour, l'écran de la routine l'annonce aux enfants, et
// c'est le parent qui décide pour eux, devant eux, de le lancer ou pas (un seul choix, pas de vote).
// Et le « Le savais-tu ? » du thème, à la fin de chaque routine.
import { html } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Avatar } from '../avatar/Avatar.js';
import { getTheme } from '../avatar/themes.js';
import { sfx } from '../lib/sounds.js';

const joinNames = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');

export function ThemeAsk({ entry, kids, onLater }) {
  const theme = getTheme(entry.theme);
  if (!theme) return null;
  const one = kids.length === 1;
  function launch() {
    sfx.chest();
    actions.answerTheme(entry.id, true);
  }
  function decline() {
    // Un enfant peut toucher l'écran : on demande confirmation avant d'annuler le thème
    if (!confirm(`Ne pas lancer le thème ${theme.name} ? Il est annulé et la boutique reste comme d’habitude.`)) return;
    sfx.pop();
    actions.answerTheme(entry.id, false);
  }
  return html`<div class="theme-ask" role="dialog" aria-label=${`Pandi annonce le thème ${theme.name}`} style=${{ '--c': theme.color }}>
    <div class="ta-card">
      <div class="ta-top"><span class="ta-emoji">${theme.emoji}</span><h2>Une semaine ${theme.name} pour ${one ? 'toi' : 'vous'}, ${joinNames(kids)} !</h2></div>
      <div class="ta-kids">${kids.map((k) => html`<span key=${k.id} class="ta-head" style=${{ '--kid': k.color }}>
        <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" mode="head" seed=${k.id} />
      </span>`)}</div>
      <ul class="ta-list">
        <li>🛍️ La boutique devient la vitrine ${theme.name}, avec un cadeau pour ${one ? 'toi' : 'chacun'}</li>
        <li>🖼️ ${one ? 'Ta scène prend' : 'Vos scènes prennent'} le décor du thème, et Pandi se déguise</li>
        <li>💡 Un « Le savais-tu ? » à la fin de chaque routine</li>
        <li>🔁 Après le thème, tout redevient comme avant</li>
      </ul>
      <p class="ta-parent">👪 C’est un parent qui décide de lancer le thème.</p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" onClick=${() => { sfx.tap(); onLater(); }}>Plus tard</button>
        <button class="btn btn-ghost" onClick=${decline}>Pas cette fois</button>
        <button class="btn btn-big btn-gold" onClick=${launch}>🚀 On lance le thème !</button>
      </div>
    </div>
  </div>`;
}

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
