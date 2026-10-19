// Premier lancement après connexion : créer sa famille ou rejoindre celle de l'autre parent.
import { html, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Pandi } from '../components/Coin.js';
import { CHILD_COLORS } from '../avatar/palette.js';
import { NumberInput } from '../components/ui.js';
import { sfx } from '../lib/sounds.js';

export function Setup() {
  const [mode, setMode] = useState('create');
  const [familyName, setFamilyName] = useState('');
  const [kids, setKids] = useState([{ name: '', age: 6 }]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const setKid = (i, patch) => setKids((list) => list.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const validKids = kids.filter((k) => k.name.trim());

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
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
      <h1 style="color:var(--ink)">Bienvenue !</h1>
      <div class="chip-row" style="margin:12px 0 18px">
        <button class=${`p-btn ${mode === 'create' ? 'primary' : ''}`} onClick=${() => setMode('create')}>Créer ma famille</button>
        <button class=${`p-btn ${mode === 'join' ? 'primary' : ''}`} onClick=${() => setMode('join')}>Rejoindre une famille</button>
      </div>
      ${mode === 'create'
        ? html`<div>
            <div class="field"><label>Nom de la famille</label><input class="input" value=${familyName} onInput=${(e) => setFamilyName(e.target.value)} placeholder="Ex. : Famille Martin" /></div>
            <div class="field"><label>Les enfants</label>
              ${kids.map((k, i) => html`<div key=${i} class="row" style="margin-bottom:8px;--kid:${CHILD_COLORS[i % CHILD_COLORS.length]}">
                <span class="kid-chip on"><i /></span>
                <input class="input grow" value=${k.name} maxLength="20" onInput=${(e) => setKid(i, { name: e.target.value })} placeholder=${`Prénom de l'enfant ${i + 1}`} />
                <${NumberInput} value=${k.age} onChange=${(v) => setKid(i, { age: v })} min=${2} max=${14} /> ans
                ${kids.length > 1 && html`<button class="p-btn icon" onClick=${() => setKids((l) => l.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>`}
              </div>`)}
              ${kids.length < 6 && html`<button class="p-btn" onClick=${() => setKids((l) => [...l, { name: '', age: 6 }])}>+ Un autre enfant</button>`}
            </div>
            <p class="hint" style="color:var(--ink-soft)">On prépare 8 tâches du soir et 4 défis pour commencer. Tu pourras tout changer ensuite.</p>
            ${error && html`<p style="color:#b42536;font-weight:600">${error}</p>`}
            <button class="btn btn-green btn-big" style="width:100%" disabled=${busy || !validKids.length}
              onClick=${() => run(() => actions.createFamily({ name: familyName.trim() || 'Ma famille', children: validKids.map((k) => ({ name: k.name.trim(), age: k.age })) }))}>
              ${busy ? 'Préparation…' : 'Créer ma famille'}
            </button>
          </div>`
        : html`<div>
            <p style="color:var(--ink);margin-bottom:12px">Demande une invitation à un parent de la famille : il la crée dans Espace parent → Réglages → Parents de la famille. Le code a 8 caractères, il est valable 48 h et ne sert qu'une fois.</p>
            <div class="field"><input class="input code" maxLength="9" autocomplete="off" value=${code} onInput=${(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="XXXXXXXX" /></div>
            ${error && html`<p style="color:#b42536;font-weight:600">${error}</p>`}
            <button class="btn btn-green btn-big" style="width:100%" disabled=${busy || code.length < 8} onClick=${() => run(() => actions.joinFamily(code))}>
              ${busy ? 'Connexion…' : 'Rejoindre'}
            </button>
          </div>`}
      <div class="sheet-actions"><button class="p-btn" onClick=${() => actions.signOut()}>Se déconnecter</button></div>
    </div>
  </div>`;
}
