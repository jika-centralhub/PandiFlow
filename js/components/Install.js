// Comment mettre Pandi sur l'écran d'accueil, selon l'appareil (assistant de démarrage et Réglages)
import { html, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import { promptInstall, useInstallState } from '../lib/install.js';
import { Modal } from './ui.js';
import { sfx } from '../lib/sounds.js';

const Steps = ({ items }) => html`<ol class="in-steps">${items.map((t, i) => html`<li key=${i}><b>${i + 1}</b><span>${t}</span></li>`)}</ol>`;

export function InstallHelp({ state }) {
  const s = useStore();
  if (state === 'app') return html`<div class="ac-done-box"><span>📲</span><p><b>Tu es déjà dans l'app Pandi.</b> Rien à faire : elle s'ouvre depuis son icône, en plein écran.</p></div>`;
  if (state === 'done') return html`<div class="ac-done-box"><span>🎉</span><p><b>Pandi est installé !</b> Son icône est sur ton écran d'accueil : c'est par là que tu l'ouvriras ce soir.</p></div>`;
  if (state === 'prompt') {
    return html`<div class="in-prompt">
      <button class="btn btn-blue btn-big" onClick=${async () => { sfx.tap(); if (await promptInstall()) sfx.sparkle(); }}>📲 Installer Pandi</button>
      <p class="hint">Le téléphone demande de confirmer : touche « Installer ». L'icône de Pandi apparaît sur l'écran d'accueil.</p>
    </div>`;
  }
  if (state === 'ios') {
    return html`<div>
      <${Steps} items=${[
        html`Touche <b>Partager</b> <span class="in-key">⬆️</span> : en bas de l'écran dans Safari, en haut dans Chrome.`,
        html`Choisis <b>« Sur l'écran d'accueil »</b> (fais défiler la liste si tu ne le vois pas).`,
        html`Touche <b>« Ajouter »</b>, en haut à droite.`,
      ]} />
      <p class="hint">Pas de bouton Partager ? Ouvre www.pandiflow.com dans Safari.${s.mode === 'cloud' ? " La première fois que tu ouvres Pandi depuis son icône, reconnecte-toi avec ton e-mail : sur iPhone, l'icône a sa propre mémoire." : ''}</p>
    </div>`;
  }
  if (state === 'android') {
    return html`<${Steps} items=${[
      html`Ouvre le menu du navigateur <span class="in-key">⋮</span> (en haut à droite dans Chrome, en bas dans Samsung Internet).`,
      html`Choisis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.`,
      html`Confirme : l'icône de Pandi apparaît sur l'écran d'accueil.`,
    ]} />`;
  }
  return html`<p class="ac-text">Sur un ordinateur, ce n'est pas utile. Fais-le sur le téléphone qui sert à noter : ouvre www.pandiflow.com, puis ⚙️ Espace parent → Réglages → « L'app sur l'écran d'accueil ».</p>`;
}

// La ligne des Réglages (Sur cet appareil) : installer, ou comment faire
export function InstallRow() {
  const state = useInstallState();
  const [help, setHelp] = useState(false);
  const done = state === 'app' || state === 'done';
  return html`<div class="row"><span class="emoji">📲</span>
    <div class="grow"><div class="title">L'app sur l'écran d'accueil</div><div class="meta">${done ? 'Pandi est installé sur cet appareil' : "Pandi s'ouvre d'un geste, en plein écran, sans les barres du navigateur"}</div></div>
    ${!done && (state === 'prompt'
      ? html`<button class="p-btn" onClick=${async () => { sfx.tap(); if (await promptInstall()) sfx.sparkle(); }}>Installer</button>`
      : html`<button class="p-btn" onClick=${() => { sfx.tap(); setHelp(true); }}>Comment faire</button>`)}
    ${help && html`<${Modal} onClose=${() => setHelp(false)} style=${{ width: 'min(100%, calc(var(--u) * 110))' }}>
      <h2>Pandi sur l'écran d'accueil</h2>
      <${InstallHelp} state=${state} />
      <div class="sheet-actions"><button class="btn btn-green" onClick=${() => setHelp(false)}>OK</button></div>
    <//>`}
  </div>`;
}
