// Personnage PandiFlow en SVG : style "chibi", dégradés et reflets pour un rendu doux en volume.
// Repère : viewBox du personnage 0..200 x 0..240, tête centrée en (100, 100).
// Avec un visage 3D (photo magique), l'image remplace la tête dessinée et se pose sur le corps dessiné.
import { html, useMemo } from '../vendor/preact-htm.js';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, GLASSES_COLORS, normalizeLook } from './palette.js';
import { HAIR } from './hair.js';
import { getItem } from './items.js';
import { shade, mix, hashString } from '../lib/util.js';
import { usePortrait, portraitPath } from '../lib/portraits.js';

let instance = 0;

// Expression de l'avatar -> visage 3D correspondant
const PORTRAIT_FOR = { neutral: 'happy', happy: 'happy', joy: 'joy', encourage: 'encourage', focus: 'encourage' };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Place le visage 3D dans le repère du personnage : yeux centrés, menton juste au-dessus du col.
// Donne aussi le haut de la tête et la largeur (chapeaux), et la transformation qui amène les yeux
// du dessin (78 et 122, 106) sur ceux du visage, pour les masques et lunettes amusantes.
function placePortrait(m) {
  const eyeX = (m.eyeLeftX + m.eyeRightX) / 2;
  const eyeY = (m.eyeLeftY + m.eyeRightY) / 2;
  const gap = m.eyeRightX - m.eyeLeftX;
  const size = clamp((46 / gap + 56 / (m.chinY - eyeY)) / 2, 160, 300);
  const x = 100 - eyeX * size;
  const y = 162 - m.chinY * size;
  const k = (gap * size) / 44;
  return {
    x,
    y,
    size,
    crown: y + m.topY * size,
    hatScale: clamp(((m.headRightX - m.headLeftX) * size) / 124, 0.85, 1.45),
    face: `translate(100 ${y + eyeY * size}) scale(${k}) translate(-100 -106)`,
  };
}

const FACES = {
  rond: { d: 'M100 42 C134 42 160 66 160 100 C160 136 134 158 100 158 C66 158 40 136 40 100 C40 66 66 42 100 42 Z', ear: 40 },
  ovale: { d: 'M100 38 C132 38 155 64 155 100 C155 138 131 164 100 164 C69 164 45 138 45 100 C45 64 68 38 100 38 Z', ear: 45 },
  coeur: { d: 'M100 40 C136 40 162 62 161 96 C160 126 138 152 100 162 C62 152 40 126 39 96 C38 62 64 40 100 40 Z', ear: 40 },
  carre: { d: 'M100 42 C138 42 158 60 158 96 C158 130 150 152 124 158 C112 161 88 161 76 158 C50 152 42 130 42 96 C42 60 62 42 100 42 Z', ear: 42 },
};

const EYES = {
  rond: { rx: 12, ry: 13.5, iris: 9 },
  amande: { rx: 13, ry: 10.5, iris: 8.6 },
  grand: { rx: 14, ry: 16, iris: 11 },
  rieur: { rx: 12, ry: 11.5, iris: 8.8 },
};

const BROWS = {
  arc: (s) => `M${100 + s * 32} 90 Q${100 + s * 22} ${82} ${100 + s * 12} 87`,
  droit: (s) => `M${100 + s * 32} 88 L${100 + s * 12} 86`,
  haut: (s) => `M${100 + s * 32} 86 Q${100 + s * 22} ${77} ${100 + s * 12} 82`,
};
const BROW_WIDTH = { fin: 2.6, moyen: 3.8, epais: 5.4 };

// Expressions : ce que le visage fait selon la dernière note.
// neutral (doux sourire), happy (sourire ouvert), joy (ravi), encourage (orange), focus (rouge : déterminé, jamais triste)
function Mouth({ expr, look, skin }) {
  const lip = '#7A3440';
  const inside = '#8A2E3B';
  const tooth = look.missingTooth;
  const teeth = (y1, y2, w) =>
    html`<path d=${`M${100 - w} ${y1} Q100 ${y1 + 3} ${100 + w} ${y1} L${100 + w - 1} ${y2} Q100 ${y2 + 3} ${100 - w + 1} ${y2} Z`} fill="#fff" />
      ${tooth && html`<rect x="101" y=${y1} width="5" height=${y2 - y1 + 2} fill=${inside} />`}`;
  switch (expr) {
    case 'joy':
      return html`<g class="av-mouth">
        <path d="M82 130 Q100 160 118 130 Q100 136 82 130 Z" fill=${inside} stroke=${lip} stroke-width="1.5" stroke-linejoin="round" />
        <ellipse cx="100" cy="146" rx="9" ry="5" fill="#FF7D8A" />
        ${teeth(131.5, 135.5, 15)}
      </g>`;
    case 'happy':
      return html`<g class="av-mouth">
        <path d="M86 132 Q100 151 114 132 Q100 137 86 132 Z" fill=${inside} stroke=${lip} stroke-width="1.5" stroke-linejoin="round" />
        <ellipse cx="100" cy="143" rx="6.5" ry="3.6" fill="#FF7D8A" />
        ${teeth(133.2, 136.4, 11)}
      </g>`;
    case 'encourage':
      return html`<path class="av-mouth" d="M90 136 Q100 143 110 135" stroke=${lip} stroke-width="3.2" fill="none" stroke-linecap="round" />`;
    case 'focus':
      return html`<g class="av-mouth"><path d="M91 139 Q100 135.5 109 139" stroke=${lip} stroke-width="3.2" fill="none" stroke-linecap="round" />
        <ellipse cx="114" cy="134" rx="4" ry="3" fill=${shade(skin, -0.06)} opacity="0.8" /></g>`;
    default:
      return html`<path class="av-mouth" d="M88 134 Q100 145 112 134" stroke=${lip} stroke-width="3.2" fill="none" stroke-linecap="round" />`;
  }
}

function Eye({ cx, cy, shape, irisId, clipId, expr, side, lid }) {
  const e = EYES[shape] || EYES.rond;
  if (expr === 'joy') {
    return html`<path d=${`M${cx - 11} ${cy + 3} Q${cx} ${cy - 10} ${cx + 11} ${cy + 3}`} stroke="#3A2A2A" stroke-width="3.6" fill="none" stroke-linecap="round" />`;
  }
  const lidY = shape === 'amande' ? cy - e.ry + 1 : cy - e.ry + 0.5;
  return html`<g>
    <clipPath id=${clipId}><ellipse cx=${cx} cy=${cy} rx=${e.rx} ry=${e.ry} /></clipPath>
    <ellipse cx=${cx} cy=${cy} rx=${e.rx} ry=${e.ry} fill="#fff" />
    <g clip-path=${`url(#${clipId})`}>
      <circle cx=${cx + side * 0.6} cy=${cy + 1} r=${e.iris} fill=${`url(#${irisId})`} />
      <circle cx=${cx + side * 0.6} cy=${cy + 1} r=${e.iris * 0.52} fill="#1C1416" />
      <circle cx=${cx + side * 0.6 + 3.4} cy=${cy - 3.2} r=${e.iris * 0.36} fill="#fff" />
      <circle cx=${cx + side * 0.6 - 3} cy=${cy + 4} r=${e.iris * 0.16} fill="#fff" opacity="0.9" />
      ${shape === 'rieur' && html`<ellipse cx=${cx} cy=${cy + e.ry + 3} rx=${e.rx + 3} ry="6" fill=${lid} />`}
    </g>
    <path d=${`M${cx - e.rx - 1} ${cy - 1} Q${cx - e.rx * 0.2} ${lidY - 4} ${cx + e.rx + 1} ${cy - 2}`} stroke="#2E2226" stroke-width="2.6" fill="none" stroke-linecap="round" />
    <path d=${`M${cx - side * (e.rx - 0.5)} ${cy - 3} l${-side * 4} -3.5`} stroke="#2E2226" stroke-width="2.2" stroke-linecap="round" />
  </g>`;
}

function Glasses({ shape, color }) {
  if (!shape || shape === 'aucune') return null;
  const c = color;
  const lens = 'rgba(200,230,255,0.18)';
  if (shape === 'rondes') {
    return html`<g class="av-glasses" fill=${lens} stroke=${c} stroke-width="3.2">
      <circle cx="78" cy="106" r="16" /><circle cx="122" cy="106" r="16" />
      <path d="M94 104 Q100 99 106 104" fill="none" /><path d="M62 104 L44 100 M138 104 L156 100" fill="none" />
    </g>`;
  }
  if (shape === 'rectangle') {
    return html`<g class="av-glasses" fill=${lens} stroke=${c} stroke-width="3.2" stroke-linejoin="round">
      <rect x="60" y="94" width="35" height="25" rx="7" /><rect x="105" y="94" width="35" height="25" rx="7" />
      <path d="M95 104 Q100 100 105 104" fill="none" /><path d="M60 102 L44 99 M140 102 L156 99" fill="none" />
    </g>`;
  }
  return html`<g class="av-glasses" fill=${lens} stroke=${c} stroke-width="3.2" stroke-linejoin="round">
    <path d="M60 96 Q62 92 80 94 Q96 96 95 108 Q92 120 78 120 Q62 119 60 104 Q58 98 60 96 Z" />
    <path d="M140 96 Q138 92 120 94 Q104 96 105 108 Q108 120 122 120 Q138 119 140 104 Q142 98 140 96 Z" />
    <path d="M95 104 Q100 100 105 104" fill="none" /><path d="M60 98 L44 96 M140 98 L156 96" fill="none" />
  </g>`;
}

const TORSO = 'M50 264 C50 206 64 182 100 180 C136 182 150 206 150 264 Z';

const SLOT_ORDER = ['bg', 'skin', 'back', 'outfit', 'neck', 'face', 'hat', 'pet', 'fx', 'magic'];
// Un costume complet recouvre ces emplacements (ils restent équipés, mais cachés)
export const COVERED_BY_SKIN = ['back', 'outfit', 'neck', 'face', 'hat'];

/**
 * <Avatar look equipped expr mode tryOn />
 *  - mode : 'full' (personnage entier avec fond), 'bust' (sans fond), 'head' (tête seule)
 *  - expr : neutral | happy | joy | encourage | focus
 *  - tryOn : { slot, itemId } pour essayer un objet en boutique
 *  - pose : idle | dance | cheer (bras levés)
 */
export function Avatar({ look: rawLook, equipped = {}, expr = 'happy', mode = 'full', tryOn = null, pose = 'idle', seed = '', still = false, class: cls = '', style }) {
  const id = useMemo(() => `av${++instance}`, []);
  const look = normalizeLook(rawLook);
  const portrait = look.portrait && !look.portrait.off ? look.portrait : null;
  const pExpr = portrait?.exprs[PORTRAIT_FOR[expr]] ? PORTRAIT_FOR[expr] : 'happy';
  const pUrl = usePortrait(portrait ? portraitPath(portrait.base, pExpr) : null);
  // Tant que le visage 3D n'est pas chargé, la tête dessinée s'affiche
  const pic = pUrl ? placePortrait(portrait.exprs[pExpr]) : null;
  const skin = (pic && portrait.skin) || SKIN_TONES[look.skin].color;
  const hairColor = HAIR_COLORS[look.hairColor].color;
  const eyeColor = EYE_COLORS[look.eyeColor].color;
  const outfit = OUTFIT_COLORS[look.outfit].color;
  const face = FACES[look.face] || FACES.rond;
  const hair = HAIR[look.hair] || HAIR.court;
  const deep = ['brun', 'cacao', 'ebene', 'cannelle'].includes(look.skin);

  const items = {};
  for (const slot of SLOT_ORDER) {
    const itemId = tryOn && tryOn.slot === slot ? tryOn.itemId : equipped?.[slot];
    const item = itemId ? getItem(itemId) : null;
    if (item && item.slot === slot) items[slot] = item;
  }
  // Costume complet : il prend la place du haut, du chapeau, du masque, du cou et du dos
  const costume = items.skin || null;
  if (costume) for (const slot of COVERED_BY_SKIN) delete items[slot];
  const head = mode === 'head';
  const shirt = costume?.shirt || items.outfit?.color || outfit;
  const sleeve = costume?.sleeve || shirt;
  const showHair = !costume?.hideHair;
  const ctx = {
    id,
    look,
    skin,
    hairColor,
    outfit,
    crown: pic ? pic.crown : hair.crown,
    hatScale: pic ? pic.hatScale : hair.hatScale || 1,
    child: seed,
    hairFill: `url(#${id}-hair)`,
    hairLine: shade(hairColor, -0.35),
  };
  const hatTransform = `translate(100 ${ctx.crown}) scale(${ctx.hatScale}) translate(-100 -26)`;
  const faceTransform = pic?.face;

  // Décalages pseudo-aléatoires mais stables : chaque enfant cligne à son rythme
  const h = hashString(seed || id);
  const delay = (n) => `-${((h >> n) % 4000) / 1000}s`;

  const hairC = {
    fill: `url(#${id}-hair)`,
    line: shade(hairColor, -0.35),
    tie: '#FF5DA2',
    buzz: mix(hairColor, skin, 0.35),
  };

  const headBox = () => {
    const top = pic.crown - 22;
    const h = Math.max(164, 172 - top);
    return `${100 - h / 2} ${top} ${h} ${h}`;
  };
  const viewBox = head ? (pic ? headBox() : '18 4 164 164') : '-20 -44 240 298';
  const showBody = !head;
  const browColor = shade(hairColor, ['blond', 'platine', 'blond_fonce'].includes(look.hairColor) ? -0.3 : -0.15);
  const bw = BROW_WIDTH[look.browThickness];
  const browL = expr === 'focus' ? 'M68 85 Q79 86 88 91' : expr === 'encourage' ? 'M68 85 Q78 77 88 83' : BROWS[look.brows](-1);
  const browR = expr === 'focus' ? 'M132 85 Q121 86 112 91' : BROWS[look.brows](1);
  const funFace = items.face;

  return html`<svg class=${`avatar ${still ? 'still' : ''} pose-${pose} ${cls}`} viewBox=${viewBox} xmlns="http://www.w3.org/2000/svg" style=${style} role="img" aria-label="Avatar">
    <defs>
      <radialGradient id=${`${id}-skin`} cx="42%" cy="34%" r="70%">
        <stop offset="0%" stop-color=${shade(skin, 0.2)} />
        <stop offset="58%" stop-color=${skin} />
        <stop offset="100%" stop-color=${shade(skin, -0.14)} />
      </radialGradient>
      <linearGradient id=${`${id}-hair`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color=${shade(hairColor, 0.22)} />
        <stop offset="45%" stop-color=${hairColor} />
        <stop offset="100%" stop-color=${shade(hairColor, -0.2)} />
      </linearGradient>
      <radialGradient id=${`${id}-iris`} cx="45%" cy="40%" r="60%">
        <stop offset="0%" stop-color=${shade(eyeColor, 0.45)} />
        <stop offset="55%" stop-color=${eyeColor} />
        <stop offset="100%" stop-color=${shade(eyeColor, -0.45)} />
      </radialGradient>
      <linearGradient id=${`${id}-shirt`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color=${shade(shirt, 0.18)} />
        <stop offset="100%" stop-color=${shade(shirt, -0.12)} />
      </linearGradient>
      <clipPath id=${`${id}-torso`}><path d=${TORSO} /></clipPath>
      <clipPath id=${`${id}-head`}><path d=${face.d} /></clipPath>
    </defs>

    ${!head && mode !== 'bust' && items.bg && html`<g class="av-bg">${items.bg.render(ctx)}</g>`}

    <g class="av-char" style=${{ animationDelay: delay(3) }}>
      ${showBody && items.back && html`<g class="av-back">${items.back.render(ctx)}</g>`}
      ${showBody && costume?.back && html`<g class="av-back">${costume.back(ctx)}</g>`}
      ${!pic && hair.back && showHair && html`<g class="av-hair-back">${hair.back(hairC)}</g>`}
      ${pic && html`<g class="av-head" style=${{ animationDelay: delay(7) }}>
        <image class="av-portrait" href=${pUrl} x=${pic.x} y=${pic.y} width=${pic.size} height=${pic.size} />
      </g>`}

      ${showBody && html`<g class="av-body">
        ${!pic && html`<rect x="88" y="148" width="24" height="36" rx="8" fill=${shade(skin, -0.1)} />`}
        <path d=${TORSO} fill=${`url(#${id}-shirt)`} />
        <g clip-path=${`url(#${id}-torso)`}>
          ${costume ? costume.torso?.(ctx) : items.outfit && items.outfit.render(ctx)}
          <path d="M60 196 C80 188 120 188 140 196" stroke="#fff" stroke-width="5" opacity="0.18" fill="none" stroke-linecap="round" />
        </g>
        ${costume?.collar ? costume.collar(ctx) : html`<path d="M86 181 Q100 196 114 181" fill=${shade(skin, -0.06)} stroke=${shade(shirt, -0.25)} stroke-width="3" />`}
        ${items.neck && html`<g class="av-neck">${items.neck.render(ctx)}</g>`}
        <g class="av-arm av-arm-l">
          <rect x="43" y="188" width="20" height="46" rx="10" fill=${shade(sleeve, -0.08)} stroke=${shade(sleeve, -0.28)} stroke-width="1.4" />
          ${costume?.sleeves?.(ctx, 43)}
          <circle cx="53" cy="235" r="9.5" fill=${costume?.gloves || `url(#${id}-skin)`} stroke=${shade(costume?.gloves || skin, -0.2)} stroke-width="1" />
        </g>
        <g class="av-arm av-arm-r">
          <rect x="137" y="188" width="20" height="46" rx="10" fill=${shade(sleeve, -0.08)} stroke=${shade(sleeve, -0.28)} stroke-width="1.4" />
          ${costume?.sleeves?.(ctx, 137)}
          <circle cx="147" cy="235" r="9.5" fill=${costume?.gloves || `url(#${id}-skin)`} stroke=${shade(costume?.gloves || skin, -0.2)} stroke-width="1" />
        </g>
        ${costume?.over && html`<g class="av-costume-over">${costume.over(ctx)}</g>`}
      </g>`}

      <g class="av-head" style=${{ animationDelay: delay(7) }}>
        ${!pic && html`
        ${!hair.coversEars && html`<g>
          <circle cx=${face.ear} cy="110" r="11" fill=${shade(skin, -0.05)} />
          <circle cx=${200 - face.ear} cy="110" r="11" fill=${shade(skin, -0.05)} />
          <circle cx=${face.ear + 1} cy="110" r="5" fill=${shade(skin, -0.18)} opacity="0.6" />
          <circle cx=${199 - face.ear} cy="110" r="5" fill=${shade(skin, -0.18)} opacity="0.6" />
        </g>`}
        <ellipse cx="100" cy="160" rx="26" ry="7" fill="#000" opacity="0.13" />
        <path d=${face.d} fill=${`url(#${id}-skin)`} />
        <g clip-path=${`url(#${id}-head)`} opacity="0.12">
          <g transform="translate(0 6)">${hair.front({ ...hairC, fill: '#3A1E10', line: 'none' })}</g>
        </g>
        <path d="M150 74 C158 90 160 112 152 132" stroke="#fff" stroke-width="3" fill="none" opacity="0.18" stroke-linecap="round" />

        <g class="av-face">
          <ellipse cx="70" cy="126" rx="9.5" ry="5.6" fill=${deep ? '#D9506E' : '#FF8FA3'} opacity=${deep ? 0.28 : 0.38} />
          <ellipse cx="130" cy="126" rx="9.5" ry="5.6" fill=${deep ? '#D9506E' : '#FF8FA3'} opacity=${deep ? 0.28 : 0.38} />
          ${look.freckles && html`<g fill=${shade(skin, -0.38)} opacity="0.7">
            ${[[84, 118], [89, 122], [80, 123], [116, 118], [111, 122], [120, 123], [94, 116], [106, 116]].map(([x, y], i) => html`<circle key=${i} cx=${x} cy=${y} r="1.3" />`)}
          </g>`}
          <ellipse cx="100" cy="120" rx="4.6" ry="3.4" fill=${shade(skin, -0.14)} />
          <circle cx="98.6" cy="118.8" r="1.4" fill="#fff" opacity="0.5" />
          <${Mouth} expr=${expr} look=${look} skin=${skin} />
          ${look.dimples && html`<g stroke=${shade(skin, -0.28)} stroke-width="1.8" fill="none" stroke-linecap="round">
            <path d="M83 132 q-2.4 3 0 6" /><path d="M117 132 q2.4 3 0 6" />
          </g>`}
          <g class="av-eyes" style=${{ animationDelay: delay(11) }}>
            <${Eye} cx=${78} cy=${106} shape=${look.eyes} irisId=${`${id}-iris`} clipId=${`${id}-el`} expr=${expr} side=${1} lid=${skin} />
            <${Eye} cx=${122} cy=${106} shape=${look.eyes} irisId=${`${id}-iris`} clipId=${`${id}-er`} expr=${expr} side=${-1} lid=${skin} />
          </g>
          <g class="av-brows" stroke=${browColor} stroke-width=${bw} fill="none" stroke-linecap="round">
            <path d=${browL} /><path d=${browR} />
          </g>
        </g>

        `}

        ${costume?.face && html`<g class="av-costume-face" transform=${faceTransform}>${costume.face(ctx)}</g>`}
        ${!pic && showHair && html`<g class="av-hair-front">${hair.front(hairC)}</g>`}
        ${costume?.faceTop && html`<g class="av-costume-face-top" transform=${faceTransform}>${costume.faceTop(ctx)}</g>`}
        ${!pic && !funFace && !costume?.hidesGlasses && html`<${Glasses} shape=${look.glasses} color=${GLASSES_COLORS[look.glassesColor].color} />`}
        ${funFace && html`<g class="av-face-item" transform=${faceTransform}>${funFace.render(ctx)}</g>`}
        ${items.hat && html`<g class="av-hat" transform=${items.hat.free ? faceTransform : hatTransform}>${items.hat.render(ctx)}</g>`}
        ${costume?.hat && html`<g class="av-hat" transform=${hatTransform}>${costume.hat(ctx)}</g>`}
        ${costume?.headFree && html`<g class="av-hat" transform=${faceTransform}>${costume.headFree(ctx)}</g>`}
      </g>

      ${showBody && items.pet && html`<g class="av-pet" style=${{ animationDelay: delay(5) }}>${items.pet.render(ctx)}</g>`}
      ${showBody && costume?.prop && html`<g class="av-prop" style=${{ animationDelay: delay(9) }}>${costume.prop(ctx)}</g>`}
    </g>
    ${showBody && items.fx && html`<g class="av-fx">${items.fx.render(ctx)}</g>`}
    ${showBody && items.magic && html`<g class="av-magic">${items.magic.render(ctx)}</g>`}
  </svg>`;
}
