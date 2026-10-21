// La tsedaka : l'enfant met des pandi dans sa boîte de tsedaka et choisit l'association parmi celles
// des parents ; les parents versent l'équivalent en euros (taux réglable) et le notent ici.
//   - TsedakaPanel : l'onglet de l'enfant (boîte, montant, association, badges de mitsva)
//   - TsedakaParent : la section de l'espace parent (à verser, taux, associations, historique)
import { html, useRef, useState } from '../vendor/preact-htm.js';
import { useStore, toast } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import {
  balance, accord, tsedakaGiven, tsedakaDue, tsedakaPaidTotals, tsedakaBadges, tsedakaEuros, tsedakaRate, formatEuros,
  mergeSettings, activeChildren, TSEDAKA_LATER,
} from '../domain.js';
import { Coin } from './Coin.js';
import { Modal, NumberInput } from './ui.js';
import { flyCoins, confettiBurst, burst, replay } from '../anim/fx.js';
import { sfx } from '../lib/sounds.js';

const AMOUNTS = [1, 5, 10, 20, 50];

// La boîte de tsedaka (pouchké) : bleue et blanche, avec sa fente ; elle saute quand on y met des pièces
export function TsedakaBox({ boxRef, size = 'md' }) {
  return html`<div class=${`tz-box ${size}`} ref=${boxRef}>
    <svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="tz-blue" x1="0" x2="1"><stop offset="0" stop-color="#3D6FE0" /><stop offset=".55" stop-color="#2452C0" /><stop offset="1" stop-color="#173A8F" /></linearGradient>
        <linearGradient id="tz-top" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6E95F0" /><stop offset="1" stop-color="#3D6FE0" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="124" rx="44" ry="5" fill="#000" opacity=".18" />
      <path d="M16 34 L104 34 L104 112 C104 120 96 124 60 124 C24 124 16 120 16 112 Z" fill="url(#tz-blue)" stroke="#12307A" stroke-width="2" />
      <ellipse cx="60" cy="34" rx="44" ry="12" fill="url(#tz-top)" stroke="#12307A" stroke-width="2" />
      <rect x="42" y="30" width="36" height="7" rx="3.5" fill="#0D2160" />
      <path d="M18 58 L102 58 M18 100 L102 100" stroke="#fff" stroke-width="5" opacity=".9" />
      <text x="60" y="88" text-anchor="middle" font-size="19" font-weight="700" fill="#fff" direction="rtl" font-family="'Frank Ruhl Libre', 'David', 'Arial Hebrew', 'Noto Sans Hebrew', serif">צדקה</text>
      <path d="M26 44 C24 60 24 90 26 110" stroke="#fff" stroke-width="4" opacity=".22" fill="none" stroke-linecap="round" />
    </svg>
  </div>`;
}

export function TsedakaPanel({ child, counter, onGive }) {
  const s = useStore();
  const settings = mergeSettings(s.settings);
  const bal = balance(child.id, s);
  const given = tsedakaGiven(child.id, s);
  const badges = tsedakaBadges(child, s);
  const associations = settings.tsedaka.associations.filter(Boolean);
  const [amount, setAmount] = useState(Math.min(5, Math.max(1, bal)));
  const [assoc, setAssoc] = useState(associations[0] || TSEDAKA_LATER);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(null);
  const box = useRef(null);
  const value = Math.min(amount, bal);
  const choices = [...associations, TSEDAKA_LATER];

  async function give() {
    setConfirm(false);
    const before = badges.filter((b) => b.got).length;
    const res = actions.tsedakaGive(child.id, value, assoc === TSEDAKA_LATER ? null : assoc);
    if (!res.amount) {
      sfx.error();
      return;
    }
    await flyCoins(counter?.current, box.current, Math.min(10, res.amount), () => replay(box.current, 'tz-hop', 400));
    sfx.chest();
    onGive?.();
    confettiBurst(box.current, ['#3D6FE0', '#FFFFFF', '#FFD23F']);
    burst(box.current, { count: 14, chars: ['💙', '✨', '⭐', '🤍'] });
    const after = tsedakaBadges(child, { ...s, ledger: res.ledger }).filter((b) => b.got);
    setDone({ amount: res.amount, assoc: res.row.note, badge: after.length > before ? after[after.length - 1] : null });
  }

  return html`<div class="tsedaka">
    <div class="tz-hero">
      <${TsedakaBox} boxRef=${box} />
      <div class="tz-hero-text">
        <h3>Ma boîte de tsedaka</h3>
        <p>${given ? html`Tu as déjà donné <b>${given} pandi</b>. Quelle belle mitsva ! 💙` : 'Donne une partie de tes pandi : Papa et Maman les transforment en vrais euros pour une association.'}</p>
      </div>
    </div>

    ${done
      ? html`<div class="tz-done">
          <div class="tz-done-title">Mitsva ! 🎉</div>
          <p>Tu as donné <b>${done.amount} pandi</b>${done.assoc === TSEDAKA_LATER ? '' : html` à <b>${done.assoc}</b>`}.<br />Papa et Maman vont verser <b>${formatEuros(tsedakaEuros(done.amount, s.settings))}</b> pour toi.</p>
          ${done.badge && html`<div class="tz-new-badge"><span>${done.badge.icon}</span> Nouveau badge : <b>${done.badge.label}</b></div>`}
          <button class="btn btn-blue" onClick=${() => { sfx.tap(); setDone(null); }}>D'accord !</button>
        </div>`
      : bal <= 0
        ? html`<p class="hint tz-empty">Gagne des pandi ce soir pour pouvoir en donner ! 💪</p>`
        : html`<div class="tz-form">
            <h4>Combien de pandi ?</h4>
            <div class="chip-row">
              ${AMOUNTS.filter((a) => a <= bal).map((a) => html`<button key=${a} class=${`chip tz-chip ${value === a ? 'on' : ''}`} onClick=${() => { sfx.pop(); setAmount(a); }}><${Coin} class="coin coin-inline" /> ${a}</button>`)}
              <${NumberInput} value=${value} onChange=${setAmount} min=${1} max=${bal} />
            </div>
            <h4>Pour qui ?</h4>
            <div class="tz-assocs">
              ${choices.map((a) => html`<button key=${a} class=${`tz-assoc ${assoc === a ? 'on' : ''} ${a === TSEDAKA_LATER ? 'later' : ''}`} onClick=${() => { sfx.pop(); setAssoc(a); }}>
                <span>${a === TSEDAKA_LATER ? '🤔' : '💙'}</span>${a === TSEDAKA_LATER ? (associations.length ? 'Papa et Maman choisiront' : 'Papa et Maman choisiront l’association') : a}
              </button>`)}
            </div>
            <button class="btn btn-gold btn-big tz-give" onClick=${() => { sfx.tap(); setConfirm(true); }}>💙 Donner ${value} pandi</button>
            <p class="hint">= ${formatEuros(tsedakaEuros(value, s.settings))} versés par tes parents (${tsedakaRate(s.settings)} pandi = 1 €)</p>
          </div>`}

    <h4>Mes badges de mitsva</h4>
    <div class="tz-badges">${badges.map((b, i) => html`<div key=${b.min} class=${`tz-badge ${b.got ? 'got' : ''}`} style=${{ '--i': i }}>
      <span class="ico">${b.got ? b.icon : '🔒'}</span><b>${b.label}</b><em>${b.min} pandi</em>
    </div>`)}</div>

    ${confirm && html`<${Modal} onClose=${() => setConfirm(false)} style=${{ '--kid': child.color }}>
      <div class="tz-confirm">
        <${TsedakaBox} size="sm" />
        <h2>Tu donnes ${value} pandi ?</h2>
        <p>${assoc === TSEDAKA_LATER ? 'Papa et Maman choisiront l’association.' : html`Pour <b>${assoc}</b>.`} Ils ne reviennent pas dans ta cagnotte : c'est un vrai cadeau, et tu en es ${accord(child, 'le héros', 'l’héroïne')} !</p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => setConfirm(false)}>Pas maintenant</button>
          <button class="btn btn-gold btn-big" onClick=${give}>Oui, je donne !</button>
        </div>
      </div>
    <//>`}
  </div>`;
}

// --- Espace parent ---------------------------------------------------------------------------------
export function TsedakaParent() {
  const s = useStore();
  const settings = mergeSettings(s.settings);
  const kids = activeChildren(s.children);
  const due = tsedakaDue(s);
  const paidTotals = Object.entries(tsedakaPaidTotals(s)).sort((a, b) => b[1] - a[1]);
  const [newAssoc, setNewAssoc] = useState('');
  const [paying, setPaying] = useState(null);
  const [target, setTarget] = useState('');
  const associations = settings.tsedaka.associations.filter(Boolean);
  const kidName = (id) => s.children.find((c) => c.id === id)?.name || '?';
  const save = (patch) => actions.updateSettings({ tsedaka: { ...settings.tsedaka, ...patch } });
  const total = due.reduce((t, g) => t + g.euros, 0);

  function addAssoc() {
    const name = newAssoc.trim().slice(0, 60);
    if (!name || associations.includes(name)) return;
    save({ associations: [...associations, name] });
    setNewAssoc('');
    sfx.pop();
  }

  function markPaid() {
    const to = paying.association === TSEDAKA_LATER ? target.trim() : null;
    if (paying.association === TSEDAKA_LATER && !to) return;
    actions.tsedakaPaid(paying.association, to);
    sfx.green();
    toast(`Merci ! ${formatEuros(paying.euros)} notés comme versés.`);
    setPaying(null);
  }

  return html`<div class="tz-parent">
    <div class="list-item tz-due-head">
      <div class="grow"><div class="title">À verser</div><div class="meta">${due.length ? `${formatEuros(total)} au total` : 'Rien en attente pour l’instant.'}</div></div>
    </div>
    ${due.map((g) => html`<div key=${g.association} class="list-item tz-due">
      <div class="grow">
        <div class="title">${g.association === TSEDAKA_LATER ? '🤔 À choisir par vous' : `💙 ${g.association}`} : ${formatEuros(g.euros)}</div>
        <div class="meta">${g.pandi} pandi · ${Object.entries(g.kids).map(([id, p]) => `${kidName(id)} ${p}`).join(', ')}</div>
        <details class="tz-rows"><summary>Voir les dons</summary>
          ${g.rows.map((r) => html`<div key=${r.id} class="tz-row">${kidName(r.child_id)} · ${-r.amount} pandi · ${new Date(r.created_at).toLocaleDateString('fr-FR')}
            <button class="p-btn danger" onClick=${() => { if (confirm(`Annuler ce don de ${-r.amount} pandi ? Ils reviennent dans la cagnotte de ${kidName(r.child_id)}.`)) { actions.tsedakaCancel(r.id); sfx.pop(); } }}>Annuler</button></div>`)}
        </details>
      </div>
      <button class="p-btn primary" onClick=${() => { sfx.tap(); setTarget(associations[0] || ''); setPaying(g); }}>✓ C'est versé</button>
    </div>`)}

    <div class="list-item"><div class="grow"><div class="title">Taux</div><div class="meta">Combien de pandi font 1 € à verser</div></div>
      <${NumberInput} value=${tsedakaRate(s.settings)} onChange=${(v) => save({ rate: v })} min=${1} max=${100} /> <span class="tz-unit">pandi = 1 €</span>
    </div>

    <div class="list-item tz-assoc-edit"><div class="grow">
      <div class="title">Associations proposées aux enfants</div>
      <div class="chip-row" style="margin-top:8px">
        ${associations.map((a) => html`<span key=${a} class="tz-tag">💙 ${a}<button aria-label=${`Retirer ${a}`} onClick=${() => { save({ associations: associations.filter((x) => x !== a) }); sfx.pop(); }}>✕</button></span>`)}
        ${!associations.length && html`<span class="meta">Aucune pour l’instant : les enfants donnent, et vous choisissez ensuite.</span>`}
      </div>
      <div class="row" style="margin-top:10px">
        <input class="input grow" value=${newAssoc} maxLength="60" placeholder="Nom de l'association" onInput=${(e) => setNewAssoc(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addAssoc()} />
        <button class="p-btn primary" disabled=${!newAssoc.trim()} onClick=${addAssoc}>+ Ajouter</button>
      </div>
    </div></div>

    ${paidTotals.length > 0 && html`<div class="list-item"><div class="grow"><div class="title">Déjà versé</div>
      <div class="meta">${paidTotals.map(([a, p]) => `${a} : ${formatEuros(tsedakaEuros(p, s.settings))}`).join(' · ')}</div></div></div>`}
    ${kids.length > 0 && html`<div class="list-item"><div class="grow"><div class="title">Données par les enfants</div>
      <div class="meta">${kids.map((k) => `${k.name} : ${tsedakaGiven(k.id, s)} pandi`).join(' · ')}</div></div></div>`}

    ${paying && html`<${Modal} onClose=${() => setPaying(null)}>
      <h2>Versement de ${formatEuros(paying.euros)}</h2>
      ${paying.association === TSEDAKA_LATER
        ? html`<div class="field"><label>À quelle association avez-vous versé ?</label>
            <input class="input" list="tz-assoc-list" value=${target} maxLength="60" onInput=${(e) => setTarget(e.target.value)} placeholder="Nom de l'association" />
            <datalist id="tz-assoc-list">${associations.map((a) => html`<option key=${a} value=${a} />`)}</datalist></div>`
        : html`<p>Avez-vous versé <b>${formatEuros(paying.euros)}</b> à <b>${paying.association}</b> ?</p>`}
      <div class="sheet-actions">
        <button class="p-btn" onClick=${() => setPaying(null)}>Pas encore</button>
        <button class="btn btn-green" disabled=${paying.association === TSEDAKA_LATER && !target.trim()} onClick=${markPaid}>Oui, c'est versé</button>
      </div>
    <//>`}
  </div>`;
}
