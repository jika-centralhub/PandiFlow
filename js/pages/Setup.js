// Premier lancement après connexion : créer sa famille (l'assistant de démarrage) ou rejoindre
// celle de l'autre parent avec son code d'invitation.
import { html, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Pandi } from '../components/Coin.js';
import { AccueilDebut } from './Accueil.js';
import { sfx } from '../lib/sounds.js';

export function Setup() {
  const [mode, setMode] = useState('create');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Créer sa famille : l'assistant de démarrage (js/pages/Accueil.js)
  if (mode === 'create') return html`<${AccueilDebut} onJoin=${() => { sfx.tap(); setMode('join'); }} />`;

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await actions.joinFamily(code);
      sfx.fanfare();
    } catch (e) {
      setError(e.message || 'Une erreur est survenue.');
      sfx.error();
    } finally {
      setBusy(false);
    }
  }

  return html`<div class="welcome page-enter">
    <${Pandi} />
    <div class="card sheet">
      <h1 style="color:var(--ink)">Rejoindre une famille</h1>
      <p style="color:var(--ink);margin:12px 0">Demande une invitation à un parent de la famille : il la crée dans Espace parent → Réglages → Parents de la famille. Le code a 8 caractères, il est valable 48 h et ne sert qu'une fois.</p>
      <div class="field"><input class="input code" maxLength="9" autocomplete="off" value=${code} onInput=${(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="XXXXXXXX" /></div>
      ${error && html`<p style="color:#b42536;font-weight:600">${error}</p>`}
      <button class="btn btn-green btn-big" style="width:100%" disabled=${busy || code.length < 8} onClick=${join}>
        ${busy ? 'Connexion…' : 'Rejoindre'}
      </button>
      <div class="sheet-actions">
        <button class="p-btn" onClick=${() => { sfx.tap(); setMode('create'); }}>← Créer plutôt ma famille</button>
        <button class="p-btn" onClick=${() => actions.signOut()}>Se déconnecter</button>
      </div>
    </div>
  </div>`;
}
