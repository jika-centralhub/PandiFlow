// Labo : Pandi en marionnette de papier découpé (dessin vectoriel, pas de 3D).
// Chaque pièce (tête, yeux, bouche, bras, jambes…) est un petit dessin SVG dans sa propre boîte, et
// bouge seulement par des animations CSS de transform et d'opacity : la carte graphique les joue seule,
// sans aucun calcul à chaque image. Les expressions changent en montrant une autre version de la pièce
// (yeux ouverts / plissés de joie, bouche qui sourit / qui brosse / grande ouverte).
// Toutes les pièces sont dessinées dans le même repère (200 × 240, le sol à y = 228) ; chaque boîte ne
// garde que sa partie (viewBox), et se place en % dans la boîte de sa pièce parente.
// Numéros : 'dents' et 'bravo' (classe sur la racine, voir css/labo-marionnette.css).

const W = 200, H = 240;
const INK = '#2B2733', FUR = '#FFF8EE', FUR2 = '#F1E6D6', BELLY = '#FFFDF8';
const OUT = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;

const svg = (box, inner) => `<svg viewBox="${box.join(' ')}" width="100%" height="100%" overflow="visible" aria-hidden="true">${inner}</svg>`;

// Les pièces : nom, boîte [x, y, w, h], parente, point de rotation [x, y], dessin
const PARTS = [
  ['ombre', [50, 220, 100, 18], 'scene', [100, 229], `<ellipse cx="100" cy="229" rx="44" ry="7" fill="#2A1E3A" opacity=".22"/>`],
  ['perso', [0, 0, W, H], 'scene', [100, 228], ''],
  ['saut', [0, 0, W, H], 'perso', [100, 228], ''],
  ['jambeD', [58, 198, 44, 32], 'saut', [82, 204], `<ellipse cx="80" cy="214" rx="18" ry="13" fill="${INK}"/><ellipse cx="80" cy="219" rx="8.5" ry="4.5" fill="#5A4E5E"/>`],
  ['jambeG', [98, 198, 44, 32], 'saut', [118, 204], `<ellipse cx="120" cy="214" rx="18" ry="13" fill="${INK}"/><ellipse cx="120" cy="219" rx="8.5" ry="4.5" fill="#5A4E5E"/>`],
  ['corps', [52, 118, 96, 108], 'saut', [100, 222], `
    <ellipse cx="100" cy="176" rx="45" ry="47" fill="${FUR}" ${OUT}/>
    <ellipse cx="100" cy="188" rx="27" ry="25" fill="${BELLY}"/>
    <path d="M57 162 Q100 116 143 162 Q100 146 57 162 Z" fill="${INK}"/>`],
  // bras qui pendent (le bras droit de Pandi est à gauche de l'écran)
  ['brasD', [38, 136, 40, 70], 'saut', [64, 148], `<path d="M64 147 Q52 168 57 188" stroke="${INK}" stroke-width="21" stroke-linecap="round" fill="none"/><circle cx="57" cy="190" r="12" fill="${INK}"/>`],
  ['brasG', [122, 136, 40, 70], 'saut', [136, 148], `<path d="M136 147 Q148 168 143 188" stroke="${INK}" stroke-width="21" stroke-linecap="round" fill="none"/><circle cx="143" cy="190" r="12" fill="${INK}"/>`],
  ['tete', [28, 14, 144, 134], 'saut', [100, 140], ''],
  ['oreilleD', [28, 24, 42, 42], 'tete', [58, 58], `<circle cx="50" cy="45" r="18" fill="${INK}"/><circle cx="51" cy="46" r="8.5" fill="#4C4454"/>`],
  ['oreilleG', [130, 24, 42, 42], 'tete', [142, 58], `<circle cx="150" cy="45" r="18" fill="${INK}"/><circle cx="149" cy="46" r="8.5" fill="#4C4454"/>`],
  ['crane', [36, 34, 128, 112], 'tete', [100, 140], `
    <ellipse cx="100" cy="90" rx="61" ry="53" fill="${FUR}" ${OUT}/>
    <path d="M48 104 Q60 136 100 140 Q140 136 152 104 Q140 128 100 131 Q60 128 48 104 Z" fill="${FUR2}" opacity=".7"/>
    <ellipse cx="73" cy="94" rx="16.5" ry="21" transform="rotate(-24 73 94)" fill="${INK}"/>
    <ellipse cx="127" cy="94" rx="16.5" ry="21" transform="rotate(24 127 94)" fill="${INK}"/>
    <ellipse cx="59" cy="116" rx="9.5" ry="5.5" fill="#FF9DB2" opacity=".6"/>
    <ellipse cx="141" cy="116" rx="9.5" ry="5.5" fill="#FF9DB2" opacity=".6"/>`],
  ['meche', [90, 18, 24, 26], 'tete', [100, 40], `<path d="M95 41 C89 29 98 20 107 24 C101 27 100 32 105 39 Z" fill="${INK}"/>`],
  // les yeux ouverts : le blanc, l'iris ambre, la pupille et les reflets (les pupilles regardent autour)
  ['yeux', [60, 80, 80, 28], 'tete', [100, 94], `
    <circle cx="75" cy="94" r="11" fill="#FFFFFF"/><circle cx="125" cy="94" r="11" fill="#FFFFFF"/>`],
  ['pupilles', [62, 82, 76, 24], 'yeux', [100, 94], `
    <circle cx="76" cy="95" r="8.4" fill="#E8A33C"/><circle cx="76" cy="95" r="8.4" fill="none" stroke="#B66A1C" stroke-width="1.6"/>
    <circle cx="76.6" cy="95.6" r="4.4" fill="#1E1A22"/>
    <circle cx="124" cy="95" r="8.4" fill="#E8A33C"/><circle cx="124" cy="95" r="8.4" fill="none" stroke="#B66A1C" stroke-width="1.6"/>
    <circle cx="123.4" cy="95.6" r="4.4" fill="#1E1A22"/>
    <circle cx="79.5" cy="91" r="2.8" fill="#FFFFFF"/><circle cx="73.5" cy="98.5" r="1.3" fill="#FFFFFF"/>
    <circle cx="127.5" cy="91" r="2.8" fill="#FFFFFF"/><circle cx="121.5" cy="98.5" r="1.3" fill="#FFFFFF"/>`],
  // yeux plissés de joie
  ['joie', [62, 84, 76, 18], 'tete', [100, 94], `
    <path d="M66 97 Q75 86 84 97" stroke="${FUR}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
    <path d="M116 97 Q125 86 134 97" stroke="${FUR}" stroke-width="3.6" stroke-linecap="round" fill="none"/>`],
  ['nez', [88, 102, 24, 18], 'tete', [100, 110], `
    <path d="M91 108 Q100 103 109 108 Q109 114 100 117 Q91 114 91 108 Z" fill="${INK}"/>
    <ellipse cx="97" cy="107.6" rx="3" ry="1.4" fill="#FFFFFF" opacity=".55"/>`],
  ['sourire', [84, 114, 32, 16], 'tete', [100, 120], `<path d="M100 116 L100 121 M100 121 Q94 127 88 122 M100 121 Q106 127 112 122" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`],
  ['brosse-bouche', [82, 114, 36, 22], 'tete', [100, 122], `
    <path d="M100 116 L100 120" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M84 120 Q100 136 116 120 Q100 125 84 120 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M92 122.6 L92 127 M100 123.6 L100 129 M108 122.6 L108 127" stroke="#D9D2C8" stroke-width="1.2"/>`],
  ['bouche-ouverte', [82, 112, 36, 32], 'tete', [100, 122], `
    <path d="M100 116 L100 120" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M85 120 Q100 145 115 120 Q100 125 85 120 Z" fill="#7A2F3F" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M92 133 Q100 126 108 133 Q100 140 92 133 Z" fill="#FF7A8C"/>`],
  // la mousse du dentifrice au coin de la bouche
  ['bulle1', [76, 120, 14, 14], 'tete', [83, 127], `<circle cx="83" cy="127" r="5" fill="#FFFFFF" stroke="#BFE0FF" stroke-width="1.4"/>`],
  ['bulle2', [70, 108, 12, 12], 'tete', [76, 114], `<circle cx="76" cy="114" r="3.8" fill="#FFFFFF" stroke="#BFE0FF" stroke-width="1.3"/>`],
  ['bulle3', [86, 128, 12, 12], 'tete', [92, 134], `<circle cx="92" cy="134" r="3.4" fill="#FFFFFF" stroke="#BFE0FF" stroke-width="1.3"/>`],
  // le bras plié qui tient la brosse à dents (devant la tête)
  ['brasBrosse', [30, 110, 74, 56], 'saut', [64, 150], `
    <path d="M64 150 Q38 143 68 131" stroke="${INK}" stroke-width="21" stroke-linecap="round" fill="none"/>
    <path d="M42 138 L94 125.5" stroke="#4FA8FF" stroke-width="7" stroke-linecap="round"/>
    <rect x="86" y="118" width="11" height="9" rx="2.5" fill="#FFFFFF" stroke="#9CCBFF" stroke-width="1.4" transform="rotate(-13 91.5 122.5)"/>
    <circle cx="70" cy="131" r="12.5" fill="${INK}"/>
    <circle cx="65" cy="127" r="3.2" fill="#5A4E5E"/>`],
];

// Les étoiles du bravo : départ au-dessus de la tête, envol vers [dx, dy] (en % de leur boîte)
const STARS = [[-380, -260, 0], [360, -300, 0.18], [-520, -60, 0.36], [520, -90, 0.54], [40, -420, 0.72]];
const STAR = (c) => `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1L1.8 9.2 9 8.4z" fill="${c}" stroke="#E0A100" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

export function makeMarionnette(host, act = 'dents') {
  const root = document.createElement('div');
  root.className = `mq mq-${act}`;
  const scene = document.createElement('div');
  scene.className = 'mq-scene';
  root.appendChild(scene);
  const boxes = { scene: [0, 0, W, H] };
  const els = { scene };
  for (const [name, box, parent, origin, draw] of PARTS) {
    const pb = boxes[parent];
    const el = document.createElement('div');
    el.className = `mq-p mq-${name}`;
    el.style.left = `${((box[0] - pb[0]) / pb[2]) * 100}%`;
    el.style.top = `${((box[1] - pb[1]) / pb[3]) * 100}%`;
    el.style.width = `${(box[2] / pb[2]) * 100}%`;
    el.style.height = `${(box[3] / pb[3]) * 100}%`;
    el.style.transformOrigin = `${((origin[0] - box[0]) / box[2]) * 100}% ${((origin[1] - box[1]) / box[3]) * 100}%`;
    if (draw) el.innerHTML = svg(box, draw);
    els[parent].appendChild(el);
    boxes[name] = box;
    els[name] = el;
  }
  // l'ordre d'affichage : le bras de la brosse passe devant la tête
  els.saut.appendChild(els.brasBrosse);
  STARS.forEach(([dx, dy, delay], i) => {
    const s = document.createElement('div');
    s.className = 'mq-p mq-etoile';
    s.style.cssText = `left:45%;top:8%;width:10%;height:8.3%;--dx:${dx}%;--dy:${dy}%;animation-delay:${delay}s`;
    s.innerHTML = STAR(i % 2 ? '#FFD84A' : '#FFE88A');
    scene.appendChild(s);
  });
  host.appendChild(root);
  return {
    el: root,
    play(name) {
      if (root.classList.contains(`mq-${name}`)) return;
      root.className = `mq mq-${name}`;
      // petit « pop » au changement de numéro
      els.perso.classList.remove('mq-pop');
      void els.perso.offsetWidth;
      els.perso.classList.add('mq-pop');
    },
    destroy: () => root.remove(),
  };
}
