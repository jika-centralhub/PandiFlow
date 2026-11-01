// Le thème proposé par les parents : le jour venu, Pandi demande aux enfants, tous ensemble devant
// l'écran de la routine, s'ils sont d'accord. Il faut le oui de chacun ; un non annule le thème et
// l'interface reste normale. Et le « Le savais-tu ? » du thème, à la fin de chaque routine.
import { html, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Avatar } from '../avatar/Avatar.js';
import { getTheme } from '../avatar/themes.js';
import { sfx } from '../lib/sounds.js';

export function ThemeAsk({ entry, kids, onLater }) {
  const theme = getTheme(entry.theme);
  const [answers, setAnswers] = useState({}); // childId -> true (oui) / false (non)
  if (!theme) return null;
  const one = kids.length === 1;
  const all = kids.every((k) => answers[k.id] != null);
  const yes = all && kids.every((k) => answers[k.id]);
  const answer = (k, v) => {
    sfx.tap();
    setAnswers((a) => ({ ...a, [k.id]: v }));
  };
  function done() {
    if (yes) sfx.chest();
    else sfx.pop();
    actions.answerTheme(entry.id, yes);
  }
  return html`<div class="theme-ask" role="dialog" aria-label=${`Pandi propose le thème ${theme.name}`} style=${{ '--c': theme.color }}>
    <div class="ta-card">
      <div class="ta-top"><span class="ta-emoji">${theme.emoji}</span><h2>Pandi ${one ? 'te' : 'vous'} propose un thème : ${theme.name} !</h2></div>
      <ul class="ta-list">
        <li>🛍️ Une semaine où la boutique devient la vitrine ${theme.name}, avec un cadeau pour ${one ? 'toi' : 'chacun'}</li>
        <li>🖼️ ${one ? 'Ta scène prend' : 'Vos scènes prennent'} le décor du thème</li>
        <li>💡 Un « Le savais-tu ? » à la fin de chaque routine</li>
        <li>🔁 Après le thème, tout redevient comme avant</li>
      </ul>
      <h3 class="ta-q">${one ? 'Tu es d’accord ?' : 'Vous êtes d’accord ? Il faut le oui de chacun.'}</h3>
      <div class="ta-kids">${kids.map((k) => html`<div key=${k.id} class="ta-kid" style=${{ '--kid': k.color }}>
        <span class="ta-head"><${Avatar} look=${k.look} equipped=${k.equipped} expr=${answers[k.id] === false ? 'encourage' : 'happy'} mode="head" seed=${k.id} /></span>
        <span class="ta-name">${k.name}</span>
        <button class=${`ta-yes ${answers[k.id] === true ? 'on' : ''}`} onClick=${() => answer(k, true)}>👍 Oui !</button>
        <button class=${`ta-no ${answers[k.id] === false ? 'on' : ''}`} onClick=${() => answer(k, false)}>🙅 Non merci</button>
      </div>`)}</div>
      ${all && html`<p class="ta-result">${yes ? `${theme.emoji} C’est parti pour une semaine ${theme.name} !` : 'D’accord : pas de thème cette fois, la boutique reste comme d’habitude.'}</p>`}
      <div class="sheet-actions">
        <button class="btn btn-ghost" onClick=${() => { sfx.tap(); onLater(); }}>Plus tard</button>
        ${all && html`<button class=${`btn btn-big ${yes ? 'btn-gold' : 'btn-green'}`} onClick=${done}>${yes ? '🚀 C’est parti !' : 'D’accord'}</button>`}
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
