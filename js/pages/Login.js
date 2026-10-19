// Connexion des parents : e-mail puis code à 6 chiffres reçu par e-mail (pas de mot de passe).
import { html, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Pandi } from '../components/Coin.js';
import { sfx } from '../lib/sounds.js';

export function Login() {
  const [email, setEmail] = useState(localStorage.getItem('pandiflow-email') || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function send(e) {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Cette adresse e-mail ne semble pas valide.');
    setBusy(true);
    setError(null);
    try {
      await actions.sendCode(email.trim());
      localStorage.setItem('pandiflow-email', email.trim());
      setStep('code');
      sfx.pop();
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await actions.verifyCode(email.trim(), code.trim());
      sfx.sparkle();
    } catch (err) {
      setError(err.message?.includes('expired') ? 'Ce code a expiré, demande-en un nouveau.' : 'Code incorrect, vérifie ton e-mail.');
      sfx.error();
    } finally {
      setBusy(false);
    }
  }

  return html`<div class="welcome page-enter">
    <${Pandi} />
    <div class="card sheet">
      <h1 style="color:var(--ink)">Pandi<b>Flow</b></h1>
      <p class="lead" style="color:var(--ink-soft)">La routine du soir qui donne envie. Connecte-toi pour retrouver ta famille sur tous tes appareils.</p>
      ${step === 'email'
        ? html`<form onSubmit=${send}>
            <div class="field"><label>Ton e-mail de parent</label>
              <input class="input" type="email" autocomplete="email" inputmode="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" /></div>
            ${error && html`<p style="color:#b42536;font-weight:600;margin-bottom:10px">${error}</p>`}
            <button class="btn btn-green btn-big" style="width:100%" disabled=${busy}>${busy ? 'Envoi…' : 'Recevoir mon code'}</button>
          </form>`
        : html`<form onSubmit=${verify}>
            <p style="color:var(--ink);margin-bottom:12px">Un code à 6 chiffres vient d'être envoyé à <strong>${email}</strong>.</p>
            <div class="field"><input class="input code" inputmode="numeric" autocomplete="one-time-code" maxLength="6" value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" /></div>
            ${error && html`<p style="color:#b42536;font-weight:600;margin-bottom:10px">${error}</p>`}
            <button class="btn btn-green btn-big" style="width:100%" disabled=${busy || code.length < 6}>${busy ? 'Vérification…' : "C'est parti !"}</button>
            <div class="sheet-actions">
              <button type="button" class="p-btn" onClick=${() => { setStep('email'); setCode(''); }}>Changer d'e-mail</button>
              <button type="button" class="p-btn" onClick=${send} disabled=${busy}>Renvoyer le code</button>
            </div>
          </form>`}
    </div>
  </div>`;
}
