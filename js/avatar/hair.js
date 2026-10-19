// Coiffures du personnage. Repère : tête centrée en (100, 100), sommet du crâne vers y = 40.
// Chaque coiffure a une partie arrière (derrière la tête) et une partie avant (sur le front).
// crown = hauteur du haut des cheveux (pour poser les chapeaux), hatScale = largeur relative.
import { html } from '../vendor/preact-htm.js';

const mirror = (d) =>
  d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)} ${y}`);

const P = (d, c, extra = {}) => html`<path d=${d} fill=${c.fill} stroke=${c.line} stroke-width="1.6" stroke-linejoin="round" ...${extra} />`;

const sheen = (c, d = 'M58 50 C72 38 92 33 108 34 C92 40 76 46 66 58 Z') =>
  html`<path d=${d} fill="#fff" opacity="0.22" />`;

// Boucles : une rangée de cercles le long d'un arc
function curlArc(c, { cx, cy, R, from, to, n, r, key }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    const x = cx + R * Math.cos(a);
    const y = cy - R * Math.sin(a);
    out.push(html`<circle key=${key + i} cx=${x.toFixed(1)} cy=${y.toFixed(1)} r=${r} fill=${c.fill} stroke=${c.line} stroke-width="1.4" />`);
  }
  return out;
}
function curlHighlights(c, pts) {
  return pts.map(([x, y, r], i) => html`<path key=${'hl' + i} d=${`M${x - r * 0.5} ${y - r * 0.2} q${r * 0.4} ${-r * 0.5} ${r * 0.9} ${-r * 0.2}`} stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.28" />`);
}

const CAP_BACK = 'M36 106 C32 62 62 30 100 30 C138 30 168 62 164 106 Z';
const CENTER_PART_FRONT = 'M38 108 C32 60 62 28 100 28 C138 28 168 60 162 108 C156 88 144 72 126 66 C114 62 104 62 100 68 C96 62 86 62 74 66 C56 72 44 88 38 108 Z';
const SWEPT_BACK_FRONT = 'M38 106 C34 58 64 30 100 30 C136 30 166 58 162 106 C158 84 138 64 100 62 C62 64 42 84 38 106 Z';

function tie(c, cx, cy, r = 6.5) {
  return html`<g><circle cx=${cx} cy=${cy} r=${r} fill=${c.tie} stroke="rgba(0,0,0,.25)" stroke-width="1.2" /><circle cx=${cx - r * 0.35} cy=${cy - r * 0.35} r=${r * 0.3} fill="#fff" opacity="0.6" /></g>`;
}

function braid(c, side) {
  const x0 = 100 + side * 58;
  const links = [];
  for (let i = 0; i < 9; i++) {
    const y = 118 + i * 11;
    const x = x0 + (i % 2 ? side * 2 : -side * 2);
    links.push(html`<ellipse key=${i} cx=${x} cy=${y} rx="9.5" ry="7.6" transform=${`rotate(${i % 2 ? 22 : -22} ${x} ${y})`} fill=${c.fill} stroke=${c.line} stroke-width="1.4" />`);
  }
  return html`<g>${links}
    <path d=${`M${x0 - 6} 214 L${x0} 228 L${x0 + 6} 214 Z`} fill=${c.fill} stroke=${c.line} stroke-width="1.2" />
    <rect x=${x0 - 7} y="208" width="14" height="6" rx="3" fill=${c.tie} /></g>`;
}

export const HAIR = {
  court: {
    crown: 26,
    front: (c) => html`<g>${P('M36 110 C30 60 60 26 100 26 C142 26 170 60 164 110 C160 96 156 86 150 78 C134 82 116 76 104 66 C96 76 78 84 56 82 C48 90 41 100 36 110 Z', c)}${sheen(c)}</g>`,
  },
  herisse: {
    crown: 22,
    front: (c) => html`<g>${P('M38 106 C34 84 38 64 48 52 L42 36 L62 42 L64 22 L82 34 L94 14 L106 32 L120 16 L124 36 L142 26 L140 44 L158 42 L152 58 C162 70 166 88 162 106 C156 92 148 82 138 78 C118 82 84 82 62 78 C52 82 44 92 38 106 Z', c)}${sheen(c, 'M60 52 C70 44 84 40 96 40 C84 46 72 52 66 60 Z')}</g>`,
  },
  frange: {
    crown: 26,
    back: (c) => P('M32 112 C28 62 60 28 100 28 C140 28 172 62 168 112 C170 124 168 134 162 140 L38 140 C32 134 30 124 32 112 Z', c),
    front: (c) => html`<g>${P('M36 114 C30 62 60 26 100 26 C140 26 170 62 164 114 L158 114 C157 100 155 90 152 82 C130 85 70 85 48 82 C45 90 43 100 42 114 Z', c)}${sheen(c)}</g>`,
  },
  raie: {
    crown: 26,
    front: (c) => html`<g>${P('M36 110 C30 58 62 26 100 26 C142 26 170 60 164 110 C160 94 152 80 140 72 C124 64 102 60 82 58 C72 66 56 80 46 94 C42 100 39 105 36 110 Z', c)}
      <path d="M82 58 C80 46 82 36 88 28" stroke=${c.line} stroke-width="2" fill="none" opacity="0.5" />${sheen(c, 'M96 34 C112 32 130 38 140 48 C126 44 112 42 100 42 Z')}</g>`,
  },
  boucle: {
    crown: 22,
    hatScale: 1.08,
    back: (c) => html`<g>
      <ellipse cx="100" cy="104" rx="62" ry="54" fill=${c.fill} />
      ${curlArc(c, { cx: 100, cy: 100, R: 58, from: 215, to: -35, n: 12, r: 16, key: 'b' })}
      <circle cx="40" cy="140" r="14" fill=${c.fill} stroke=${c.line} stroke-width="1.4" />
      <circle cx="160" cy="140" r="14" fill=${c.fill} stroke=${c.line} stroke-width="1.4" />
    </g>`,
    front: (c) => {
      const pts = [[52, 80, 12], [66, 69, 13], [83, 63, 13], [100, 61, 14], [117, 63, 13], [134, 69, 13], [148, 80, 12]];
      return html`<g>
        ${P('M40 100 C38 60 64 34 100 34 C136 34 162 60 160 100 C150 80 130 66 100 64 C70 66 50 80 40 100 Z', c)}
        ${pts.map(([x, y, r], i) => html`<circle key=${i} cx=${x} cy=${y} r=${r} fill=${c.fill} stroke=${c.line} stroke-width="1.4" />`)}
        ${curlHighlights(c, pts)}
        ${curlHighlights(c, [[70, 44, 12], [100, 36, 12], [128, 44, 12]])}
      </g>`;
    },
  },
  afro: {
    crown: 12,
    hatScale: 1.25,
    back: (c) => html`<g>
      <ellipse cx="100" cy="94" rx="76" ry="68" fill=${c.fill} />
      ${curlArc(c, { cx: 100, cy: 92, R: 66, from: 225, to: -45, n: 15, r: 21, key: 'a' })}
      ${curlHighlights(c, [[62, 40, 16], [100, 26, 16], [138, 40, 16], [42, 76, 14], [158, 76, 14]])}
    </g>`,
    front: (c) => html`<g>
      ${P('M38 102 C36 62 64 40 100 40 C136 40 164 62 162 102 C154 82 132 68 100 66 C68 68 46 82 38 102 Z', c)}
      ${[[50, 86], [62, 74], [78, 68], [100, 65], [122, 68], [138, 74], [150, 86]].map(([x, y], i) => html`<circle key=${i} cx=${x} cy=${y} r="8" fill=${c.fill} />`)}
    </g>`,
  },
  ondule: {
    crown: 24,
    coversEars: true,
    back: (c) => P('M30 100 C26 58 60 24 100 24 C140 24 174 58 170 100 C176 118 166 132 174 148 C182 164 168 176 174 190 C150 198 50 198 26 190 C32 176 18 164 26 148 C34 132 24 118 30 100 Z', c),
    front: (c) => {
      const left = 'M36 108 C30 128 40 140 34 158 C30 170 38 180 46 188 C46 172 42 162 47 150 C53 136 45 124 47 110 Z';
      return html`<g>
        ${P('M36 114 C30 60 62 26 100 26 C138 26 170 60 164 114 C158 92 146 72 124 62 C114 58 104 62 100 72 C96 62 86 58 76 62 C54 72 42 92 36 114 Z', c)}
        ${P(left, c)}${P(mirror(left), c)}${sheen(c)}
      </g>`;
    },
  },
  long: {
    crown: 24,
    coversEars: true,
    back: (c) => P('M30 100 C28 56 60 24 100 24 C140 24 172 56 170 100 L174 226 C150 232 50 232 26 226 Z', c),
    front: (c) => {
      const left = 'M36 110 C34 140 36 180 40 224 L54 224 C50 182 48 140 47 112 Z';
      return html`<g>
        ${P('M36 118 C30 60 62 26 100 26 C138 26 170 60 164 118 C160 92 150 70 128 60 C116 55 104 56 100 64 C96 56 84 55 72 60 C50 70 40 92 36 118 Z', c)}
        ${P(left, c)}${P(mirror(left), c)}${sheen(c)}
      </g>`;
    },
  },
  carre: {
    crown: 24,
    coversEars: true,
    back: (c) => P('M30 104 C28 58 60 26 100 26 C140 26 172 58 170 104 L170 148 C170 154 166 158 160 158 L40 158 C34 158 30 154 30 148 Z', c),
    front: (c) => html`<g>${P('M34 152 L34 104 C32 58 62 26 100 26 C138 26 168 58 166 104 L166 152 C162 156 156 156 152 152 L150 106 C150 92 147 84 142 78 C122 82 92 76 78 64 C70 74 58 80 50 82 C49 88 49 98 49 106 L47 152 C43 156 38 156 34 152 Z', c)}${sheen(c)}</g>`,
  },
  couettes: {
    crown: 26,
    back: (c) => {
      const left = 'M46 96 C18 92 4 122 10 152 C14 168 26 176 34 166 C28 146 36 120 54 106 Z';
      return html`<g>${P(CAP_BACK, c)}${P(left, c)}${P(mirror(left), c)}</g>`;
    },
    front: (c) => html`<g>${P(CENTER_PART_FRONT, c)}${sheen(c)}${tie(c, 44, 100)}${tie(c, 156, 100)}</g>`,
  },
  queue: {
    crown: 28,
    back: (c) => html`<g>${P(CAP_BACK, c)}${P('M134 46 C174 42 190 84 182 126 C178 146 166 160 158 152 C170 126 168 88 128 62 Z', c)}</g>`,
    front: (c) => html`<g>${P(SWEPT_BACK_FRONT, c)}${sheen(c)}${tie(c, 138, 52, 6)}</g>`,
  },
  chignon: {
    crown: 18,
    back: (c) => html`<g>
      <circle cx="100" cy="24" r="22" fill=${c.fill} stroke=${c.line} stroke-width="1.6" />
      <path d="M86 18 Q100 8 114 18" stroke="#fff" stroke-width="2.4" fill="none" opacity="0.28" stroke-linecap="round" />
      ${P(CAP_BACK, c)}
    </g>`,
    front: (c) => html`<g>${P(SWEPT_BACK_FRONT, c)}${sheen(c)}<rect x="88" y="40" width="24" height="6" rx="3" fill=${c.tie} /></g>`,
  },
  tresses: {
    crown: 26,
    back: (c) => P(CAP_BACK, c),
    front: (c) => html`<g>${braid(c, -1)}${braid(c, 1)}${P(CENTER_PART_FRONT, c)}${sheen(c)}</g>`,
  },
  rase: {
    crown: 36,
    front: (c) => html`<path d="M42 102 C40 62 66 38 100 38 C134 38 160 62 158 102 C152 84 134 72 100 70 C66 72 48 84 42 102 Z" fill=${c.buzz} opacity="0.92" />`,
  },
};
