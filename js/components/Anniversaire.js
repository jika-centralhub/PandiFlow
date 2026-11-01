// L'anniversaire d'un enfant, le soir de la fête (règles dans domain.js, « Âge et anniversaire ») :
//   - le bandeau de l'écran de la routine : le parent lance la fête quand les enfants sont devant la
//     télé (il faut aussi un geste pour que le téléphone ait le droit de chanter et de parler) ;
//   - la fête : Pandi, déguisé, souhaite joyeux anniversaire et danse avec l'enfant, qui porte sa couronne
//     d'anniversaire, sur la chanson, sous les feux d'artifice ; son frère ou sa sœur est invité : il danse
//     à côté avec un chapeau d'invité, tend la boîte-cadeau, et Pandi le remercie. Puis les pandi
//     d'anniversaire volent jusqu'à l'enfant et Pandi annonce les cadeaux à choisir dans son coin.
//     Aucun chiffre à la télé (avis du panel) : ni compteur, ni montant.
// Rejouée (gifts null), la fête ne redonne rien : la chanson, la danse et le feu d'artifice seulement.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { getState } from '../lib/store.js';
import { Avatar } from '../avatar/Avatar.js';
import { birthdayGifts } from '../avatar/items.js';
import { Pandi3D, has3D } from './Pandi3D.js';
import { PandiFlat } from './Coin.js';
import { activeChildren, accord, birthdayNow, GUEST_HAT } from '../domain.js';
import { sfx, say, canSay, stopSaying } from '../lib/sounds.js';
import { fireworks, flyCoins, confettiBurst } from '../anim/fx.js';
import { sleep } from '../lib/util.js';
import { navigate } from '../router.js';

const BEAT = 0.5; // la chanson à deux temps par seconde, comme la danse de Pandi
const joinNames = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');
const COUNT = ['', 'un', 'deux', 'trois'];

// Le bandeau de la routine du soir. done : la fête a déjà eu lieu ce soir (on peut la rejouer)
export function BirthdayBar({ kids, done = false, onStart }) {
  const names = joinNames(kids);
  return html`<div class=${`greet-bar bd-bar ${done ? 'done' : ''}`} role="region" aria-label=${`Anniversaire de ${names}`}>
    <span class="gb-ico bd-ico" aria-hidden="true">🎂</span>
    <span class="gb-text">${done ? `C’est la fête de ${names} ce soir !` : `C’est l’anniversaire de ${names} ! Les enfants sont devant l’écran ? Pandi a préparé une fête.`}</span>
    <button class=${`btn ${done ? 'btn-ghost' : 'btn-gold'} btn-small`} onClick=${onStart}>${done ? '🎵 Rejouer la chanson' : '🎉 Lancer la fête'}</button>
  </div>`;
}

// Les mots de Pandi : le vœu d'abord (avant la chanson), puis les cadeaux, puis le merci à l'invité.
// L'écran dit le prénom et l'âge (jamais de montant) ; ce que Pandi prononce (…Say) reste fixe, sans
// prénom ni âge : chaque phrase est enregistrée à l'avance (voix-elevenlabs/textes.md, section 1.3).
function words(stars, others, gifts, choices) {
  const many = stars.length > 1;
  const wish = `Joyeux anniversaire ${joinNames(stars)} !`;
  const wishSay = 'Joyeux anniversaire !';
  const whom = many ? 'eux' : others.length > 1 ? accord(stars[0], 'votre frère', 'votre sœur') : accord(stars[0], 'ton frère', 'ta sœur');
  const thanks = others.length ? `Merci ${joinNames(others)} d’avoir fait la fête avec ${whom} ! 💛` : '';
  const thanksSay = others.length ? "Merci d'avoir fait la fête avec nous !" : '';
  if (!gifts) return { wish, wishSay, gifts: 'Encore une danse ? Joyeux anniversaire !', giftsSay: 'Encore une danse ? Joyeux anniversaire !', thanks, thanksSay };
  const age = !many && gifts[stars[0].id]?.age;
  const coins = Boolean(gifts[stars[0].id]?.amount);
  const parts = [];
  if (age) parts.push(`Tu as ${age} ans aujourd’hui, tu es ${accord(stars[0], 'grand', 'grande')} !`);
  if (coins) parts.push(many ? 'Pandi a mis des pandi dans vos cagnottes.' : 'Pandi a mis des pandi dans ta cagnotte.');
  if (choices > 1) parts.push(many ? `Et des cadeaux d’anniversaire vous attendent dans votre coin : chacun choisit le sien !` : `Et ${COUNT[choices] || choices} cadeaux d’anniversaire t’attendent dans ton coin : tu en choisis un !`);
  else if (choices === 1) parts.push('Et un cadeau d’anniversaire t’attend dans ton coin !');
  const giftsSay = many
    ? `Vous avez un an de plus aujourd'hui ! ${coins ? 'Je vous offre des pandi, et vous choisirez' : 'Vous choisirez'} chacun un cadeau parmi les surprises de Pandi !`
    : `Tu as un an de plus aujourd'hui ! ${coins ? "Je t'offre des pandi, et tu choisis" : 'Tu choisis'} un cadeau parmi les surprises de Pandi !`;
  return { wish, wishSay, gifts: parts.join(' '), giftsSay, thanks, thanksSay };
}

// childIds : les enfants fêtés ; gifts : { [childId]: { amount, age } } (null quand la fête est rejouée)
export function BirthdayParty({ childIds = [], gifts = null, onClose }) {
  const s = getState();
  const kids = activeChildren(s.children);
  const stars = childIds.map((id) => kids.find((k) => k.id === id)).filter(Boolean);
  const others = kids.filter((k) => !childIds.includes(k.id)).slice(0, 2);
  const ownedOf = (k) => new Set(s.owned.filter((o) => o.child_id === k.id).map((o) => o.item_id));
  const single = stars.length === 1 ? stars[0] : null;
  const choices = single ? birthdayGifts(single, ownedOf(single)).length : 3;
  const text = words(stars, others, gifts, choices);
  const [phase, setPhase] = useState('voeu'); // voeu, chanson, cadeaux
  const pandi = useRef(null);
  const starEls = useRef({});
  const alive = useRef(true);

  async function sing() {
    setPhase('chanson');
    const dur = sfx.birthdaySong(BEAT) * 1000;
    fireworks(dur + 600, { every: 900, boom: () => sfx.boom(), alive: () => alive.current });
    await sleep(dur + 400);
  }

  // Les cadeaux, puis le merci à l'invité (une phrase après l'autre)
  const sayGifts = () => say(text.giftsSay, { onEnd: () => alive.current && text.thanksSay && say(text.thanksSay) });

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
    sayGifts();
    // les pandi volent jusqu'à l'enfant fêté, sans compteur ni chiffre
    if (gifts) {
      for (const k of stars) {
        if (!gifts[k.id]?.amount) continue;
        await flyCoins(pandi.current, starEls.current[k.id], 8);
        if (!alive.current) return;
        confettiBurst(starEls.current[k.id]);
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
  const giftDue = single && birthdayNow(single, getState())?.giftDue && choices > 0;
  const giving = phase === 'cadeaux';
  return html`<div class=${`bd-party ${phase}`} style=${{ '--kid': stars[0].color }} role="dialog" aria-label=${text.wish}>
    <div class="bd-lights" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => html`<i key=${i} style=${{ '--i': i }} />`)}</div>
    <h1 class="bd-title"><span aria-hidden="true">🎂</span> ${text.wish}</h1>
    <div class="bd-stage">
      ${others.map((k, i) => html`<div key=${k.id} class=${`bd-kid bd-other ${giving ? 'giving' : ''}`} style=${{ '--kid': k.color, '--i': i, order: i ? 4 : 0 }}>
        <${Avatar} look=${k.look} equipped=${k.equipped} tryOn=${{ slot: 'hat', itemId: GUEST_HAT }} expr="joy" pose=${giving ? 'idle' : 'dance'} mode="full" seed=${k.id} class="overflow" />
        ${giving && html`<span class="bd-box" aria-hidden="true">🎁</span>`}
        <span>${k.name}</span>
      </div>`)}
      <div class="bd-pandi" ref=${pandi} style=${{ order: 1 }}>
        ${has3D() ? html`<${Pandi3D} act="danse" framing="full" sound=${true} class="pandi3d" />` : html`<${PandiFlat} mood="happy" />`}
      </div>
      ${stars.map((k, i) => html`<div key=${k.id} class="bd-kid bd-star" ref=${(el) => (starEls.current[k.id] = el)} style=${{ '--kid': k.color, '--i': i, order: 2 + i }}>
        <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" pose="dance" mode="full" seed=${k.id} class="overflow" />
        <span>${k.name}</span>
      </div>`)}
    </div>
    <p class="bj-bubble bd-bubble" key=${phase}>${giving ? text.gifts : phase === 'chanson' ? '🎵 Joyeux anniversaire, joyeux anniversaire… 🎵' : text.wish}
      ${giving && text.thanks && html`<span class="bd-thanks">${text.thanks}</span>`}</p>
    <div class="sheet-actions">
      ${giving && html`<button class="btn btn-ghost" onClick=${again}>🎵 Encore la chanson</button>`}
      ${giving && canSay() && html`<button class="btn btn-ghost" onClick=${() => { sfx.tap(); sayGifts(); }}>🔊 Réécouter</button>`}
      ${giftDue && giving && html`<button class="btn btn-blue" onClick=${() => toShop(single)}>🎁 Choisir mon cadeau</button>`}
      <button class="btn btn-gold btn-big" onClick=${() => { sfx.tap(); onClose(); }}>On commence la soirée !</button>
    </div>
  </div>`;
}
