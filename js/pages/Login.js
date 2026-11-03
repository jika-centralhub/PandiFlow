// Connexion des parents : e-mail + mot de passe, ou compte Google quand il est activé dans Supabase.
// Les e-mails (confirmer son adresse à l'inscription, mot de passe oublié) portent un code à 6 chiffres
// à taper ici, pas un lien : sur iPhone, un lien s'ouvrirait dans Safari et pas dans l'icône de l'écran
// d'accueil, qui a sa propre mémoire.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import * as actions from '../lib/actions.js';
import { Pandi } from '../components/Coin.js';
import { InstallHelp } from '../components/Install.js';
import { isIOS } from '../lib/install.js';
import { isInstalled } from '../lib/device.js';
import { sfx } from '../lib/sounds.js';

// Message d'erreur éventuel renvoyé par Google dans l'adresse (?error_description=…)
const returnedError = new URLSearchParams(location.search).get('error_description');

// Sur iPhone et iPad, l'icône de l'écran d'accueil a sa propre mémoire : une connexion faite dans le
// navigateur ne la suit pas. On propose donc l'icône d'abord : une seule connexion, et l'assistant de
// démarrage puis la visite se font là où Pandi servira le soir.
const SANS_ICONE = 'pandiflow-sans-icone';
const iconFirst = () => !returnedError && isIOS() && !isInstalled() && localStorage.getItem(SANS_ICONE) !== '1';

const GOOGLE_G = html`<svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
</svg>`;

// Messages de Supabase traduits pour les parents
function frenchError(e) {
  const m = String(e?.message || '');
  const both = `${m} ${e?.code || ''}`;
  if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered|already been registered|user_already_exists/i.test(both)) return 'Un compte existe déjà avec cet e-mail : connecte-toi.';
  if (/password should be at least|weak.?password/i.test(both)) return 'Mot de passe trop court : 8 caractères minimum.';
  if (/different from the old password|same_password/i.test(both)) return "Choisis un mot de passe différent de l'ancien.";
  if (/otp_expired|token has expired|invalid.*(otp|token)/i.test(both)) return 'Code incorrect ou expiré. Vérifie-le, ou demande un nouveau code.';
  const wait = m.match(/after (\d+) seconds?/i);
  if (wait) return `Patiente ${wait[1]} secondes avant de demander un nouveau code.`;
  if (/rate limit|too many|over_email_send_rate_limit/i.test(both)) return 'Trop d’essais. Patiente quelques minutes.';
  if (/error sending/i.test(m)) return "L'e-mail n'a pas pu partir. Réessaie dans un moment.";
  if (/invalid.*email|unable to validate email/i.test(m)) return 'Cette adresse e-mail ne semble pas valide.';
  if (/failed to fetch|network/i.test(m)) return 'Pas de connexion internet.';
  return m || 'Une erreur est survenue.';
}

const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e.trim());
const notConfirmed = (e) => e?.code === 'email_not_confirmed' || /email not confirmed/i.test(String(e?.message));

export function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  // Un code attendu par e-mail : 'signup' (confirmer l'adresse) ou 'recovery' (mot de passe oublié)
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState(localStorage.getItem('pandiflow-email') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(returnedError ? 'La connexion Google a été annulée ou refusée. Réessaie.' : null);
  const [info, setInfo] = useState(null);
  const [google, setGoogle] = useState(false);
  const [icon, setIcon] = useState(iconFirst);

  useEffect(() => {
    actions.googleEnabled().then(setGoogle);
  }, []);

  if (icon) {
    const withoutIcon = () => {
      sfx.tap();
      localStorage.setItem(SANS_ICONE, '1');
      setIcon(false);
    };
    return html`<div class="welcome page-enter">
      <${Pandi} />
      <div class="card sheet">
        <h1 style="color:var(--ink)">Bienvenue dans Pandi !</h1>
        <p class="lead" style="color:var(--ink-soft)">Sur iPhone, commence par mettre Pandi sur l'écran d'accueil : il s'ouvrira en plein écran, et tu n'auras à te connecter qu'une fois.</p>
        <${InstallHelp} state="ios" then=${html`Ouvre Pandi depuis sa nouvelle icône : c'est là que tu <b>crées ton compte</b>, ou que tu te connectes.`} />
        <div class="sheet-actions">
          <button class="p-btn" onClick=${withoutIcon}>Continuer sans l'icône</button>
          <a class="p-btn" href="?demo=1#/soiree">Essayer en mode démo</a>
        </div>
      </div>
    </div>`;
  }

  function switchMode(m) {
    sfx.tap();
    setMode(m);
    setPending(null);
    setCode('');
    setError(null);
    setInfo(null);
  }

  // Un code part par e-mail : l'écran passe à sa saisie (et au nouveau mot de passe s'il est oublié)
  function waitCode(kind, message = null) {
    setPending(kind);
    setCode('');
    setPassword('');
    setConfirm('');
    setInfo(message);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (pending) {
      if (!/^\d{6}$/.test(code)) return setError('Le code reçu par e-mail a 6 chiffres.');
      if (pending === 'recovery' && password.length < 8) return setError('Mot de passe trop court : 8 caractères minimum.');
      if (pending === 'recovery' && password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.');
    } else {
      if (!validEmail(email)) return setError('Cette adresse e-mail ne semble pas valide.');
      if (mode !== 'forgot' && password.length < 8) return setError('Mot de passe trop court : 8 caractères minimum.');
      if (mode === 'signup' && password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.');
    }
    const address = email.trim();
    setBusy(true);
    try {
      localStorage.setItem('pandiflow-email', address);
      if (pending === 'signup') await actions.confirmSignup(address, code);
      else if (pending === 'recovery') await actions.resetPassword(address, code, password);
      else if (mode === 'signin') await actions.signIn(address, password);
      else if (mode === 'signup') {
        if (await actions.signUp(address, password)) waitCode('signup');
      } else {
        await actions.sendPasswordReset(address);
        waitCode('recovery');
      }
      sfx.sparkle();
    } catch (err) {
      if (!pending && mode === 'signin' && notConfirmed(err)) {
        // Compte créé mais adresse pas encore confirmée : un nouveau code part, et on le demande
        const sent = await actions.resendSignupCode(address).then(() => true, () => false);
        waitCode('signup', `Ton adresse n'est pas encore confirmée${sent ? ' : un nouveau code vient de partir' : ''}.`);
      } else {
        sfx.error();
        setError(frenchError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    sfx.tap();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (pending === 'signup') await actions.resendSignupCode(email.trim());
      else await actions.sendPasswordReset(email.trim());
      setCode('');
      setInfo('Un nouveau code vient de partir.');
    } catch (err) {
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

  const errorLine = error && html`<p style="color:#b42536;font-weight:600;margin-bottom:10px">${error}</p>`;
  const infoLine = info && html`<p style="color:#1a7a43;font-weight:600;margin-bottom:10px">${info}</p>`;

  if (pending) {
    const recovery = pending === 'recovery';
    const address = html`<b>${email.trim()}</b>`;
    return html`<div class="welcome page-enter">
      <${Pandi} />
      <form class="card sheet" onSubmit=${submit}>
        <h2>${recovery ? 'Nouveau mot de passe' : 'Confirme ton e-mail'}</h2>
        <p style="color:var(--ink);margin:8px 0 14px;line-height:1.4">${recovery
          ? html`Si un compte existe avec ${address}, un code à 6 chiffres vient d'y partir. Tape-le ici, puis choisis ton nouveau mot de passe.`
          : html`Un code à 6 chiffres a été envoyé à ${address}. Tape-le ici pour confirmer ton adresse.`}</p>
        <div class="field"><label>Code reçu par e-mail</label>
          <input class="input code" inputmode="numeric" autocomplete="one-time-code" maxLength="6" value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" /></div>
        ${recovery && html`<div class="field"><label>Nouveau mot de passe (8 caractères minimum)</label>
          <div style="display:flex;gap:8px">
            <input class="input" type=${show ? 'text' : 'password'} autocomplete="new-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
            <button type="button" class="p-btn" onClick=${() => setShow(!show)} aria-label="Afficher le mot de passe">${show ? '🙈' : '👁️'}</button>
          </div></div>
          <div class="field"><label>Confirme-le</label>
          <input class="input" type=${show ? 'text' : 'password'} autocomplete="new-password" value=${confirm} onInput=${(e) => setConfirm(e.target.value)} /></div>`}
        ${errorLine}${infoLine}
        <button class="btn btn-green btn-big" style="width:100%" disabled=${busy}>${busy ? 'Un instant…' : recovery ? 'Changer mon mot de passe' : 'Valider'}</button>
        <div class="sheet-actions">
          <button type="button" class="p-btn" onClick=${() => switchMode(mode)}>← Retour</button>
          <button type="button" class="p-btn" disabled=${busy} onClick=${resend}>Renvoyer le code</button>
        </div>
        <p class="hint" style="color:var(--ink-soft);margin-top:10px">Pas reçu ? Regarde dans les courriers indésirables. Le code est valable 1 heure ; seul le dernier envoyé marche.</p>
      </form>
    </div>`;
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
        ${mode === 'forgot' && html`<p style="color:var(--ink-soft);margin:-4px 0 12px;line-height:1.4">Pandi t'envoie un code à 6 chiffres par e-mail, à taper ici pour choisir un nouveau mot de passe.</p>`}
        ${errorLine}${infoLine}
        <button class="btn btn-green btn-big" style="width:100%" disabled=${busy}>
          ${busy ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir un code'}
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

