// Connexion des parents : e-mail + mot de passe, ou compte Google quand il est activé dans Supabase.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Pandi } from '../components/Coin.js';
import { sfx } from '../lib/sounds.js';

// Message d'erreur éventuel renvoyé par Google dans l'adresse (?error_description=…)
const returnedError = new URLSearchParams(location.search).get('error_description');

const GOOGLE_G = html`<svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
</svg>`;

// Messages de Supabase traduits pour les parents
function frenchError(e) {
  const m = String(e?.message || '');
  if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered|already been registered|user_already_exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connecte-toi.';
  if (/password should be at least|weak.?password/i.test(m)) return 'Mot de passe trop court : 8 caractères minimum.';
  if (/rate limit|too many|over_email_send_rate_limit/i.test(m)) return 'Trop d’essais. Patiente quelques minutes.';
  if (/invalid.*email|unable to validate email/i.test(m)) return 'Cette adresse e-mail ne semble pas valide.';
  if (/failed to fetch|network/i.test(m)) return 'Pas de connexion internet.';
  return m || 'Une erreur est survenue.';
}

const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e.trim());

export function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [email, setEmail] = useState(localStorage.getItem('pandiflow-email') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(returnedError ? 'La connexion Google a été annulée ou refusée. Réessaie.' : null);
  const [info, setInfo] = useState(null);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    actions.googleEnabled().then(setGoogle);
  }, []);

  function switchMode(m) {
    sfx.tap();
    setMode(m);
    setError(null);
    setInfo(null);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!validEmail(email)) return setError('Cette adresse e-mail ne semble pas valide.');
    if (mode !== 'forgot' && password.length < 8) return setError('Mot de passe trop court : 8 caractères minimum.');
    if (mode === 'signup' && password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    try {
      localStorage.setItem('pandiflow-email', email.trim());
      if (mode === 'signin') await actions.signIn(email.trim(), password);
      else if (mode === 'signup') await actions.signUp(email.trim(), password);
      else {
        await actions.sendPasswordReset(email.trim());
        setInfo('Si un compte existe avec cette adresse, un e-mail avec un lien vient de partir. Ouvre-le sur cet appareil.');
      }
      sfx.sparkle();
    } catch (err) {
      sfx.error();
      setError(frenchError(err));
    } finally {
      setBusy(false);
    }
  }

  async function withGoogle() {
    sfx.tap();
    setBusy(true);
    setError(null);
    try {
      await actions.signInWithGoogle(); // la page part vers Google
    } catch (err) {
      setError(frenchError(err));
      setBusy(false);
    }
  }

  const titles = { signin: 'Se connecter', signup: 'Créer mon compte parent', forgot: 'Mot de passe oublié' };

  return html`<div class="welcome page-enter">
    <${Pandi} />
    <div class="card sheet">
      <h1 style="color:var(--ink)">Pandi</h1>
      <p class="lead" style="color:var(--ink-soft);margin-bottom:12px">La routine du soir qui donne envie. Chaque parent a son propre compte.</p>
      ${mode !== 'forgot' && html`<div class="bank-modes" style="margin:0 0 14px">
        <button class=${`bank-mode add ${mode === 'signin' ? 'on' : ''}`} onClick=${() => switchMode('signin')}>Se connecter</button>
        <button class=${`bank-mode add ${mode === 'signup' ? 'on' : ''}`} onClick=${() => switchMode('signup')}>Créer un compte</button>
      </div>`}
      ${mode === 'forgot' && html`<h2>${titles.forgot}</h2>`}
      <form onSubmit=${submit}>
        <div class="field"><label>E-mail</label>
          <input class="input" type="email" autocomplete="email" inputmode="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" /></div>
        ${mode !== 'forgot' && html`<div class="field"><label>Mot de passe ${mode === 'signup' ? '(8 caractères minimum)' : ''}</label>
          <div style="display:flex;gap:8px">
            <input class="input" type=${show ? 'text' : 'password'} autocomplete=${mode === 'signup' ? 'new-password' : 'current-password'} value=${password} onInput=${(e) => setPassword(e.target.value)} />
            <button type="button" class="p-btn" onClick=${() => setShow(!show)} aria-label="Afficher le mot de passe">${show ? '🙈' : '👁️'}</button>
          </div></div>`}
        ${mode === 'signup' && html`<div class="field"><label>Confirme le mot de passe</label>
          <input class="input" type=${show ? 'text' : 'password'} autocomplete="new-password" value=${confirm} onInput=${(e) => setConfirm(e.target.value)} /></div>`}
        ${error && html`<p style="color:#b42536;font-weight:600;margin-bottom:10px">${error}</p>`}
        ${info && html`<p style="color:#1a7a43;font-weight:600;margin-bottom:10px">${info}</p>`}
        <button class="btn btn-green btn-big" style="width:100%" disabled=${busy}>
          ${busy ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
        </button>
      </form>
      <div class="sheet-actions">
        ${mode === 'signin' && html`<button class="p-btn" onClick=${() => switchMode('forgot')}>Mot de passe oublié ?</button>`}
        ${mode === 'forgot' && html`<button class="p-btn" onClick=${() => switchMode('signin')}>← Retour</button>`}
      </div>
      ${google && mode !== 'forgot' && html`<div>
        <p class="hint" style="text-align:center;color:var(--ink-soft);margin:10px 0">ou</p>
        <button class="btn btn-big btn-google" style="width:100%" disabled=${busy} onClick=${withGoogle}>${GOOGLE_G} Continuer avec Google</button>
      </div>`}
      <div class="sheet-actions"><a class="p-btn" href="?demo=1#/soiree">Essayer en mode démo</a></div>
    </div>
  </div>`;
}

// Retour du lien « mot de passe oublié » : choisir un nouveau mot de passe
export function NewPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return setError('Mot de passe trop court : 8 caractères minimum.');
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    setError(null);
    try {
      await actions.updatePassword(password);
      sfx.sparkle();
    } catch (err) {
      setError(frenchError(err));
      sfx.error();
    } finally {
      setBusy(false);
    }
  }

  return html`<div class="welcome page-enter">
    <${Pandi} />
    <form class="card sheet" onSubmit=${submit}>
      <h2>Nouveau mot de passe</h2>
      <div class="field"><label>Nouveau mot de passe (8 caractères minimum)</label>
        <input class="input" type="password" autocomplete="new-password" value=${password} onInput=${(e) => setPassword(e.target.value)} /></div>
      <div class="field"><label>Confirme-le</label>
        <input class="input" type="password" autocomplete="new-password" value=${confirm} onInput=${(e) => setConfirm(e.target.value)} /></div>
      ${error && html`<p style="color:#b42536;font-weight:600;margin-bottom:10px">${error}</p>`}
      <button class="btn btn-green btn-big" style="width:100%" disabled=${busy}>${busy ? 'Un instant…' : 'Enregistrer'}</button>
    </form>
  </div>`;
}
