// L'anniversaire d'un enfant, le soir de la fête (règles dans domain.js, « Âge et anniversaire ») :
//   - le bandeau de l'écran de la routine : le parent lance la fête quand les enfants sont devant la
//     télé (il faut aussi un geste pour que le téléphone ait le droit de chanter et de parler) ;
//   - la fête : Pandi, déguisé, souhaite joyeux anniversaire et danse avec l'enfant (son frère ou sa
//     sœur danse à côté) sur la chanson, sous les feux d'artifice ; puis les pandi d'anniversaire volent
//     jusqu'à sa cagnotte et Pandi annonce le cadeau à choisir dans toute la boutique. Sur cet écran des
//     cadeaux, seul l'enfant fêté reste (choix des parents : que l'autre ne voie pas « +50 » chez lui).
// Rejouée (replay), la fête ne redonne rien : la chanson, la danse et le feu d'artifice seulement.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { getState } from '../lib/store.js';
import { Avatar } from '../avatar/Avatar.js';
import { Pandi3D, has3D } from './Pandi3D.js';
import { PandiFlat } from './Coin.js';
import { PandiCounter } from './ui.js';
import { activeChildren, accord, balance, birthdayNow } from '../domain.js';
import { sfx, say, canSay, stopSaying } from '../lib/sounds.js';
import { fireworks, flyCoins, confettiBurst } from '../anim/fx.js';
import { sleep } from '../lib/util.js';
import { navigate } from '../router.js';

const BEAT = 0.5; // la chanson à deux temps par seconde, comme la danse de Pandi
const joinNames = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');

// Le bandeau de la routine du soir. done : la fête a déjà eu lieu ce soir (on peut la rejouer)
export function BirthdayBar({ kids, done = false, onStart }) {
  const names = joinNames(kids);
  return html`<div class=${`greet-bar bd-bar ${done ? 'done' : ''}`} role="region" aria-label=${`Anniversaire de ${names}`}>
    <span class="gb-ico bd-ico" aria-hidden="true">🎂</span>
    <span class="gb-text">${done ? `C’est la fête de ${names} ce soir !` : `C’est l’anniversaire de ${names} ! Les enfants sont devant l’écran ? Pandi a préparé une fête.`}</span>
    <button class=${`btn ${done ? 'btn-ghost' : 'btn-gold'} btn-small`} onClick=${onStart}>${done ? '🎵 Rejouer la chanson' : '🎉 Lancer la fête'}</button>
  </div>`;
}

// Les mots de Pandi : le vœu d'abord (avant la chanson), puis les cadeaux. L'écran dit le prénom, l'âge
// et les pandi ; ce que Pandi prononce (…Say) reste fixe, sans prénom, âge ni montant : chaque phrase
// est enregistrée à l'avance (voix-elevenlabs/textes.md, section 1.3).
function words(stars, gifts) {
  const many = stars.length > 1;
  const wish = `Joyeux anniversaire ${joinNames(stars)} !`;
  const wishSay = 'Joyeux anniversaire !';
  if (!gifts) return { wish, wishSay, gifts: 'Encore une danse ? Joyeux anniversaire !', giftsSay: 'Encore une danse ? Joyeux anniversaire !' };
  const age = !many && gifts[stars[0].id]?.age;
  const amount = gifts[stars[0].id]?.amount || 0;
  const parts = [];
  if (age) parts.push(`Tu as ${age} ans aujourd’hui, tu es ${accord(stars[0], 'grand', 'grande')} !`);
  if (amount) parts.push(many ? `Je vous offre ${amount} pandi chacun.` : `Je t’offre ${amount} pandi.`);
  parts.push(many ? 'Et vous choisirez chacun un cadeau dans toute la boutique !' : 'Et tu choisis un cadeau dans toute la boutique, celui que tu veux !');
  const giftsSay = many
    ? `Vous avez un an de plus aujourd'hui ! ${amount ? 'Je vous offre des pandi, et vous choisirez' : 'Vous choisirez'} chacun un cadeau dans toute la boutique !`
    : `Tu as un an de plus aujourd'hui ! ${amount ? "Je t'offre des pandi, et tu choisis" : 'Tu choisis'} un cadeau dans toute la boutique, celui que tu veux !`;
  return { wish, wishSay, gifts: parts.join(' '), giftsSay };
}

// childIds : les enfants fêtés ; gifts : { [childId]: { amount, age } } (null quand la fête est rejouée)
export function BirthdayParty({ childIds = [], gifts = null, onClose }) {
  const s = getState();
  const kids = activeChildren(s.children);
  const stars = childIds.map((id) => kids.find((k) => k.id === id)).filter(Boolean);
  const others = kids.filter((k) => !childIds.includes(k.id));
  const text = words(stars, gifts);
  const [phase, setPhase] = useState('voeu'); // voeu, chanson, cadeaux
  const [shown, setShown] = useState(() => Object.fromEntries(stars.map((k) => [k.id, balance(k.id, s) - (gifts?.[k.id]?.amount || 0)])));
  const pandi = useRef(null);
  const counters = useRef(Object.fromEntries(stars.map((k) => [k.id, { current: null }])));
  const alive = useRef(true);

  async function sing() {
    setPhase('chanson');
    const dur = sfx.birthdaySong(BEAT) * 1000;
    fireworks(dur + 600, { every: 900, boom: () => sfx.boom(), alive: () => alive.current });
    await sleep(dur + 400);
  }

  async function party() {
    // le vœu de Pandi (si le téléphone sait parler), puis la chanson
    await new Promise((resolve) => {
      const done = () => resolve();
      if (!say(text.wishSay, { onEnd: done })) setTimeout(done, 1600);
      else setTimeout(done, 4000); // certains téléphones n'annoncent jamais la fin de la phrase
    });
    if (!alive.current) return;
    await sing();
    if (!alive.current) return;
    setPhase('cadeaux');
    say(text.giftsSay);
    if (gifts) {
      for (const k of stars) {
        const amount = gifts[k.id]?.amount || 0;
        if (!amount) continue;
        await flyCoins(pandi.current, counters.current[k.id]?.current, Math.min(12, amount));
        if (!alive.current) return;
        setShown((m) => ({ ...m, [k.id]: (m[k.id] || 0) + amount }));
        confettiBurst(counters.current[k.id]?.current);
      }
    }
  }

  useEffect(() => {
    alive.current = true;
    sfx.sparkle();
    const t = setTimeout(party, 700);
    return () => {
      alive.current = false;
      clearTimeout(t);
      stopSaying();
    };
  }, []);

  async function again() {
    sfx.tap();
    stopSaying();
    await sing();
    if (alive.current) setPhase('cadeaux');
  }

  function toShop(child) {
    sfx.tap();
    onClose();
    navigate(`enfant/${child.id}?onglet=boutique`);
  }

  if (!stars.length) return null;
  const single = stars.length === 1 ? stars[0] : null;
  const giftDue = single && birthdayNow(single, getState())?.giftDue;
  return html`<div class=${`bd-party ${phase}`} style=${{ '--kid': stars[0].color }} role="dialog" aria-label=${text.wish}>
    <div class="bd-lights" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => html`<i key=${i} style=${{ '--i': i }} />`)}</div>
    <h1 class="bd-title"><span aria-hidden="true">🎂</span> ${text.wish}</h1>
    <div class="bd-stage">
      ${(phase !== 'cadeaux' || !gifts) && others.slice(0, 2).map((k, i) => html`<div key=${k.id} class="bd-kid bd-other" style=${{ '--kid': k.color, '--i': i, order: i ? 4 : 0 }}>
        <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" pose="dance" mode="full" seed=${k.id} class="overflow" />
        <span>${k.name}</span>
      </div>`)}
      <div class="bd-pandi" ref=${pandi} style=${{ order: 1 }}>
        ${has3D() ? html`<${Pandi3D} act="danse" framing="full" sound=${true} class="pandi3d" />` : html`<${PandiFlat} mood="happy" />`}
      </div>
      ${stars.map((k, i) => html`<div key=${k.id} class="bd-kid bd-star" style=${{ '--kid': k.color, '--i': i, order: 2 + i }}>
        <span class="bd-crown" aria-hidden="true">👑</span>
        <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" pose="dance" mode="full" seed=${k.id} class="overflow" />
        <span>${k.name}</span>
        ${gifts && html`<${PandiCounter} value=${shown[k.id] ?? balance(k.id, s)} counterRef=${counters.current[k.id]} />`}
      </div>`)}
    </div>
    <p class="bj-bubble bd-bubble" key=${phase}>${phase === 'cadeaux' ? text.gifts : phase === 'chanson' ? '🎵 Joyeux anniversaire, joyeux anniversaire… 🎵' : text.wish}</p>
    <div class="sheet-actions">
      ${phase === 'cadeaux' && html`<button class="btn btn-ghost" onClick=${again}>🎵 Encore la chanson</button>`}
      ${phase === 'cadeaux' && canSay() && html`<button class="btn btn-ghost" onClick=${() => { sfx.tap(); say(text.giftsSay); }}>🔊 Réécouter</button>`}
      ${giftDue && phase === 'cadeaux' && html`<button class="btn btn-blue" onClick=${() => toShop(single)}>🎁 Choisir mon cadeau</button>`}
      <button class="btn btn-gold btn-big" onClick=${() => { sfx.tap(); onClose(); }}>On commence la soirée !</button>
    </div>
  </div>`;
}
