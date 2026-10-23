// Les objets que Pandi utilise pendant les tâches (cuillère, éponge, livre, sac, peigne…) et les petits
// effets qui vont avec (bulles de savon, emojis qui s'envolent : 💤 ✨ 💖 💦).
// Un objet tenu en main a son origine à la prise et son axe principal suivant +x.
import { THREE, smoothNormals } from './pandi3d.js';
import { mat, plastic, gold, m, group, lathe, stripes, bend, place, starShape } from './gear.js';
import { getAccessory } from './gear.js';

const TAU = Math.PI * 2;
const GEO = new Map();
const memo = (key, make) => {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
};

// Boîte aux bords bien ronds (superellipsoïde) : coussin, sac, savon, cube…
function roundBox(w, h, d, e = 0.32, seg = [28, 20]) {
  return memo(`rb${w},${h},${d},${e}`, () => {
    const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
    const p = g.attributes.position;
    const f = (v) => Math.sign(v) * Math.abs(v) ** e;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)) * w / 2, f(p.getY(i)) * h / 2, f(p.getZ(i)) * d / 2);
    return smoothNormals(g);
  });
}
const sphere = (r, s = [20, 14]) => memo(`s${r}`, () => new THREE.SphereGeometry(r, s[0], s[1]));
const capsule = (r, l) => memo(`c${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));

// Texture : pois, étoiles, lettre, emoji…
const texCache = new Map();
function canvasTex(key, draw, size = 256) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const dots = (bg, fg) => canvasTex(`dots${bg}${fg}`, (g, S) => {
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  g.fillStyle = fg;
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    g.beginPath();
    g.arc(((x + (y % 2) * 0.5) * S) / 6, ((y + 0.5) * S) / 6, S / 26, 0, TAU);
    g.fill();
  }
});
const stars = (bg, fg) => canvasTex(`stars${bg}${fg}`, (g, S) => {
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  g.fillStyle = fg;
  g.font = `${S / 7}px sans-serif`;
  g.textAlign = 'center';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillText('★', ((x + (y % 2) * 0.5) * S) / 4, ((y + 0.7) * S) / 4);
});
export function emojiTex(ch) {
  return canvasTex(`emoji${ch}`, (g, S) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${S * 0.78}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(ch, S / 2, S * 0.54);
  }, 128);
}

// --- Les objets ---------------------------------------------------------------------------------

const BUILD = {
  cuillere(occ) {
    const p = plastic(occ, '#FF9F43');
    const g = group(
      m(capsule(0.022, 0.2), p, [0.11, 0, 0], [0, 0, Math.PI / 2]),
      m(sphere(0.06), p, [0.27, 0.005, 0], [0, 0, 0], [1, 0.32, 0.78]),
    );
    const food = m(sphere(0.045), mat(occ, '#FFB347', { roughness: 0.4 }), [0.27, 0.018, 0], [0, 0, 0], [0.9, 0.45, 0.75]);
    g.add(food);
    g.userData.update = (dt, spec) => (food.visible = Boolean(spec.full));
    return g;
  },
  // bol de soupe (ou de céréales) : origine au fond du bol
  bol(occ, { variant } = {}) {
    const bowl = mat(occ, '#4FC3F7', { roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide });
    const shell = lathe([[0.001, 0], [0.09, 0.005], [0.15, 0.04], [0.175, 0.1], [0.165, 0.105], [0.14, 0.045], [0.085, 0.017], [0.001, 0.014]], 40);
    const g = group(m(shell, bowl));
    if (variant === 'cereales') {
      g.add(m(new THREE.CircleGeometry(0.15, 32), mat(occ, '#FFFDF5', { roughness: 0.3 }), [0, 0.078, 0], [-Math.PI / 2, 0, 0]));
      const cols = ['#FFB300', '#FF7043', '#8BC34A', '#FFD54F'];
      for (let i = 0; i < 12; i++) {
        const a = i * 2.4, r = 0.03 + (i % 4) * 0.028;
        g.add(m(memo('ring', () => new THREE.TorusGeometry(0.018, 0.009, 8, 16)), mat(occ, cols[i % 4], { roughness: 0.6 }), [Math.cos(a) * r, 0.085, Math.sin(a) * r], [Math.PI / 2 + (i % 3) * 0.3, 0, 0]));
      }
    } else {
      g.add(m(new THREE.CircleGeometry(0.152, 32), mat(occ, '#FFA726', { roughness: 0.25, clearcoat: 0.5 }), [0, 0.08, 0], [-Math.PI / 2, 0, 0]));
      for (let i = 0; i < 5; i++) g.add(m(roundBox(0.04, 0.03, 0.04), mat(occ, i % 2 ? '#66BB6A' : '#EF5350', { roughness: 0.5 }), [Math.cos(i * 1.3) * 0.08, 0.085, Math.sin(i * 1.3) * 0.08]));
    }
    return g;
  },
  eponge(occ) {
    return group(
      m(roundBox(0.26, 0.15, 0.11, 0.4), mat(occ, '#FFE15A', { roughness: 0.95, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') })),
      m(roundBox(0.26, 0.045, 0.11, 0.4), mat(occ, '#5CC46B', { roughness: 0.95 }), [0, -0.09, 0]),
    );
  },
  savon(occ) {
    return m(roundBox(0.13, 0.06, 0.09, 0.45), mat(occ, '#FF9EC7', { roughness: 0.2, clearcoat: 1 }));
  },
  // bonnet de bain à pois avec un canard en caoutchouc posé dessus (repère de la tête)
  bonnetBain(occ) {
    const shell = memo('bathcap', () => new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, Math.PI * 0.36).scale(0.69, 0.63, 0.63));
    const cap = mat(occ, '#ffffff', { map: dots('#FF8FB8', '#FFFFFF'), roughness: 0.3, clearcoat: 0.8 });
    const frill = m(memo('frill', () => bend(new THREE.TorusGeometry(1, 0.06, 10, 72), (x, y, z) => {
      const a = Math.atan2(y, x);
      return [x, y, z + Math.sin(a * 16) * 0.022];
    })), cap, [0, 0.27, 0], [Math.PI / 2, 0, 0], [0.6, 0.55, 0.8]);
    const yellow = plastic(occ, '#FFD23F');
    const duck = group(
      m(sphere(0.1), yellow, [0, 0, 0], [0, 0, 0], [1.15, 0.85, 1]),
      m(sphere(0.07), yellow, [0.07, 0.09, 0]),
      m(memo('beak', () => new THREE.ConeGeometry(0.03, 0.07, 12).rotateZ(-Math.PI / 2)), plastic(occ, '#FF8A3D'), [0.15, 0.08, 0], [0, 0, 0], [1, 0.6, 1]),
      m(sphere(0.014), plastic(occ, '#1B1B22'), [0.11, 0.115, 0.04]),
      m(sphere(0.014), plastic(occ, '#1B1B22'), [0.11, 0.115, -0.04]),
    );
    duck.position.set(0.04, 0.72, -0.02);
    duck.rotation.y = -0.6;
    duck.scale.setScalar(1.6);
    const g = place(group(m(shell, cap), frill, duck), [0, 0.02, -0.01], [-0.08, 0, 0], 1);
    g.userData.update = (dt, spec, t) => (duck.rotation.z = Math.sin(t * 5) * 0.12);
    return g;
  },
  // bonnet de nuit à étoiles, la pointe qui retombe (repère de la tête)
  bonnetNuit(occ) {
    const cone = memo('nightcap', () => {
      const g = new THREE.ConeGeometry(0.36, 0.7, 40, 24, true).translate(0, 0.35, 0);
      return bend(g, (x, y, z) => {
        const k = Math.max(0, y / 0.7) ** 2;
        return [x + k * 0.42, y - k * 0.3, z];
      });
    });
    const cloth = mat(occ, '#ffffff', { map: stars('#3F51B5', '#FFE36E'), roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#9FA8FF'), side: THREE.DoubleSide });
    const rim = m(memo('nightrim', () => new THREE.TorusGeometry(0.36, 0.06, 12, 48)), mat(occ, '#FFFFFF', { roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff') }), [0, 0, 0], [Math.PI / 2, 0, 0]);
    const pom = m(sphere(0.07), mat(occ, '#FFFFFF', { roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff') }), [0.42, 0.4, 0]);
    return place(group(m(cone, cloth), rim, pom), [0, 0.38, -0.03], [-0.15, 0, 0.05], 1);
  },
  // haut de pyjama (rayé) ou t-shirt (couleur de l'enfant) : une coque autour du buste (repère du buste)
  haut(occ, { variant, color } = {}) {
    const prof = [[0.2, 0.66], [0.33, 0.57], [0.44, 0.44], [0.51, 0.28], [0.545, 0.12], [0.535, -0.01], [0.5, -0.12]];
    const geo = memo('shirt', () => {
      const curve = new THREE.CatmullRomCurve3(prof.map(([r, y]) => new THREE.Vector3(r * 1.04, y, 0)));
      const g = new THREE.LatheGeometry(curve.getPoints(30).map((v) => new THREE.Vector2(v.x, v.y)), 48);
      g.rotateY(Math.PI);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), z = p.getZ(i);
        if (z > 0) p.setZ(i, z * (1 + 0.1 * Math.exp(-(((y - 0.05) / 0.22) ** 2))));
      }
      return smoothNormals(g);
    });
    const tex = variant === 'pyjama' ? stripes(['#7FA7FF', '#F4F7FF'], 10, false, false) : null;
    const cloth = mat(occ, variant === 'pyjama' ? '#ffffff' : color || '#FF6B6B', { map: tex, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide });
    const g = group(m(geo, cloth));
    if (variant !== 'pyjama') {
      const star = m(memo('shirtStar', () => new THREE.ExtrudeGeometry(starShape(0.11), { depth: 0.01, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 })), mat(occ, '#FFE36E', { roughness: 0.6 }), [0, 0.2, 0.56], [-0.15, 0, 0]);
      g.add(star);
    }
    return g;
  },
  // sac à dos : origine au centre, les bretelles côté -z
  sac(occ, { color } = {}) {
    const c = plastic(occ, color || '#E5383B');
    const dark = plastic(occ, '#26324D');
    return group(
      m(roundBox(0.4, 0.46, 0.22), c),
      m(roundBox(0.3, 0.2, 0.08), plastic(occ, '#FFD23F'), [0, -0.08, 0.12]),
      m(roundBox(0.42, 0.14, 0.24), c, [0, 0.18, 0.01]),
      m(memo('strap', () => new THREE.TorusGeometry(0.15, 0.022, 8, 24, Math.PI)), dark, [0.12, 0.02, -0.12], [0, Math.PI / 2, Math.PI / 2]),
      m(memo('strap', () => new THREE.TorusGeometry(0.15, 0.022, 8, 24, Math.PI)), dark, [-0.12, 0.02, -0.12], [0, Math.PI / 2, Math.PI / 2]),
    );
  },
  livre(occ, { color } = {}) {
    return group(
      m(roundBox(0.24, 0.3, 0.06, 0.18), plastic(occ, color || '#7B6CFF')),
      m(roundBox(0.22, 0.28, 0.05, 0.12), mat(occ, '#FFF8E6', { roughness: 0.9 }), [0.012, 0, 0]),
      m(memo('bookStar', () => new THREE.ExtrudeGeometry(starShape(0.06), { depth: 0.006, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 })), gold(occ), [0, 0.03, 0.03]),
    );
  },
  trousse(occ) {
    return m(capsule(0.05, 0.18), plastic(occ, '#3BB273'), [0, 0, 0], [0, 0, Math.PI / 2]);
  },
  // livre ouvert, pages vers +y, dos le long de z ; une page tourne autour du dos (spec.flip 0 -> 1)
  livreOuvert(occ) {
    const cover = plastic(occ, '#7B6CFF');
    const paper = mat(occ, '#FFF8E6', { roughness: 0.9, side: THREE.DoubleSide });
    const ink = canvasTex('page', (g, S) => {
      g.fillStyle = '#FFF8E6';
      g.fillRect(0, 0, S, S);
      g.fillStyle = '#C9BBA0';
      for (let y = 0; y < 9; y++) g.fillRect(S * 0.12, S * (0.12 + y * 0.085), S * (0.62 + ((y * 37) % 20) / 100), S * 0.025);
      g.fillStyle = '#FF7EB6';
      g.beginPath();
      g.arc(S * 0.7, S * 0.75, S * 0.1, 0, TAU);
      g.fill();
    });
    const printed = mat(occ, '#ffffff', { map: ink, roughness: 0.9, side: THREE.DoubleSide });
    const leaf = memo('leaf', () => {
      const g = new THREE.PlaneGeometry(0.2, 0.28, 8, 1).translate(0.1, 0, 0).rotateX(-Math.PI / 2);
      return bend(g, (x, y, z) => [x, y + Math.sin((x / 0.2) * Math.PI) * 0.025, z]);
    });
    const left = m(leaf, printed, [0, 0.01, 0], [0, 0, Math.PI - 0.12]);
    const right = m(leaf, printed, [0, 0.01, 0], [0, 0, 0.12]);
    const blockL = m(roundBox(0.2, 0.025, 0.27, 0.2), paper, [-0.1, -0.004, 0], [0, 0, -0.12]);
    const blockR = m(roundBox(0.2, 0.025, 0.27, 0.2), paper, [0.1, -0.004, 0], [0, 0, 0.12]);
    const back = m(roundBox(0.44, 0.02, 0.3, 0.2), cover, [0, -0.025, 0]);
    const badge = m(memo('coverStar', () => new THREE.ExtrudeGeometry(starShape(0.07), { depth: 0.006, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 })), gold(occ), [0.1, -0.04, 0], [Math.PI / 2, 0, 0]);
    const flip = new THREE.Group();
    flip.add(m(leaf, printed));
    flip.position.y = 0.014;
    const g = group(back, badge, blockL, blockR, left, right, flip);
    g.userData.update = (dt, spec) => (flip.rotation.z = 0.12 + (Math.PI - 0.24) * (spec.flip || 0));
    return g;
  },
  // coffre à jouets en bois peint (posé au sol, origine au fond)
  coffre(occ) {
    const wood = mat(occ, '#E8A15B', { roughness: 0.7 });
    const band = mat(occ, '#7B6CFF', { roughness: 0.6 });
    const g = new THREE.Group();
    const W = 0.56, H = 0.34, D = 0.42, T = 0.04;
    g.add(m(memo('cb', () => new THREE.BoxGeometry(W, T, D)), wood, [0, T / 2, 0]));
    g.add(m(memo('cf', () => new THREE.BoxGeometry(W, H, T)), wood, [0, H / 2, D / 2]));
    g.add(m(memo('cf', () => new THREE.BoxGeometry(W, H, T)), wood, [0, H / 2, -D / 2]));
    g.add(m(memo('cs', () => new THREE.BoxGeometry(T, H, D)), wood, [W / 2, H / 2, 0]));
    g.add(m(memo('cs', () => new THREE.BoxGeometry(T, H, D)), wood, [-W / 2, H / 2, 0]));
    g.add(m(memo('cband', () => new THREE.BoxGeometry(W + 0.01, 0.06, T + 0.01)), band, [0, H * 0.62, D / 2]));
    g.add(m(memo('cstar', () => new THREE.ExtrudeGeometry(starShape(0.07), { depth: 0.01, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 1 })), gold(occ), [0, H * 0.35, D / 2 + 0.02]));
    const lid = m(memo('clid', () => new THREE.BoxGeometry(W, T, D).translate(0, 0, D / 2)), wood, [0, H, -D / 2], [-2.1, 0, 0]);
    g.add(lid);
    g.userData.update = (dt, spec) => g.scale.set(1 + (spec.bump || 0) * 0.08, 1 - (spec.bump || 0) * 0.1, 1 + (spec.bump || 0) * 0.08);
    return g;
  },
  balle(occ) {
    return m(sphere(0.1, [28, 20]), mat(occ, '#ffffff', { map: stripes(['#E5383B', '#FFD23F', '#2C7BE5'], 6, true, false), roughness: 0.35, clearcoat: 0.6 }));
  },
  cube(occ) {
    const letter = canvasTex('cubeA', (g, S) => {
      g.fillStyle = '#4FC3F7';
      g.fillRect(0, 0, S, S);
      g.fillStyle = '#ffffff';
      g.font = `bold ${S * 0.7}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('A', S / 2, S * 0.55);
    });
    return m(memo('cubeG', () => new THREE.BoxGeometry(0.15, 0.15, 0.15)), mat(occ, '#ffffff', { map: letter, roughness: 0.5 }));
  },
  ours(occ) {
    const fur = mat(occ, '#B07A4A', { roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#F0C9A0') });
    const g = group(
      m(sphere(0.08), fur, [0, 0, 0], [0, 0, 0], [1, 1.1, 0.9]),
      m(sphere(0.065), fur, [0, 0.12, 0]),
      m(sphere(0.026), fur, [0.05, 0.17, 0]),
      m(sphere(0.026), fur, [-0.05, 0.17, 0]),
      m(sphere(0.028), mat(occ, '#E8C9A0', { roughness: 0.9 }), [0, 0.11, 0.055]),
    );
    return g;
  },
  oreiller(occ) {
    return group(
      m(roundBox(0.46, 0.3, 0.13, 0.45), mat(occ, '#D9CCFF', { roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff') })),
      m(memo('pillowStar', () => new THREE.ExtrudeGeometry(starShape(0.06), { depth: 0.005, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 })), mat(occ, '#FFE36E', { roughness: 0.6 }), [0.1, 0.05, 0.065]),
    );
  },
  // réveil à deux cloches (posé au sol), qui tremble quand il sonne
  reveil(occ) {
    const red = plastic(occ, '#E5383B');
    const g = new THREE.Group();
    const body = group(
      m(memo('clockBody', () => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 32).rotateX(Math.PI / 2)), red),
      m(new THREE.CircleGeometry(0.11, 32), mat(occ, '#FFFFFF', { roughness: 0.4 }), [0, 0, 0.041]),
      m(memo('hand1', () => new THREE.BoxGeometry(0.012, 0.08, 0.005).translate(0, 0.04, 0)), mat(occ, '#222'), [0, 0, 0.045]),
      m(memo('hand2', () => new THREE.BoxGeometry(0.012, 0.06, 0.005).translate(0, 0.03, 0)), mat(occ, '#222'), [0, 0, 0.046], [0, 0, -2]),
      m(sphere(0.05), gold(occ), [0.09, 0.12, 0], [0, 0, 0], [1, 0.6, 1]),
      m(sphere(0.05), gold(occ), [-0.09, 0.12, 0], [0, 0, 0], [1, 0.6, 1]),
      m(capsule(0.012, 0.06), red, [0.08, -0.13, 0], [0, 0, 0.5]),
      m(capsule(0.012, 0.06), red, [-0.08, -0.13, 0], [0, 0, -0.5]),
    );
    body.position.y = 0.17;
    g.add(body);
    let t = 0;
    g.userData.update = (dt, spec) => {
      t += dt;
      const ring = spec.ring ? 1 : 0;
      body.rotation.z = Math.sin(t * 70) * 0.12 * ring;
      body.position.x = Math.sin(t * 53) * 0.012 * ring;
    };
    return g;
  },
  peigne(occ) {
    const p = plastic(occ, '#FF7EB6');
    const g = group(m(roundBox(0.36, 0.07, 0.025, 0.3), p, [0.18, 0.025, 0]));
    for (let i = 0; i < 14; i++) g.add(m(memo('tooth', () => new THREE.BoxGeometry(0.01, 0.06, 0.016)), p, [0.04 + i * 0.023, -0.03, 0]));
    return g;
  },
  // basket (enfilée sur le pied : repère de la cheville)
  basket(occ, { color } = {}) {
    const g = group(
      m(roundBox(0.38, 0.2, 0.52, 0.55), mat(occ, color || '#2EC4B6', { roughness: 0.5 }), [0, 0.0, 0.07]),
      m(roundBox(0.4, 0.07, 0.55, 0.5), mat(occ, '#FFFFFF', { roughness: 0.6 }), [0, -0.08, 0.07]),
    );
    for (let i = 0; i < 3; i++) g.add(m(memo('lace', () => new THREE.TorusGeometry(0.04, 0.01, 6, 16, Math.PI)), mat(occ, '#FFFFFF'), [0, 0.09, 0.12 + i * 0.05], [-Math.PI / 2 + 0.6, 0, 0]));
    return g;
  },
  // pancarte ronde avec l'emoji de la tâche (pour les tâches inventées par les parents)
  pancarte(occ, { emoji = '⭐' } = {}) {
    const stick = m(capsule(0.018, 0.4), mat(occ, '#E8A15B', { roughness: 0.7 }), [0.2, 0, 0], [0, 0, Math.PI / 2]);
    const disc = m(memo('signDisc', () => new THREE.CylinderGeometry(0.2, 0.2, 0.035, 40).rotateX(Math.PI / 2)), plastic(occ, '#FFFFFF'), [0.55, 0, 0]);
    const face = new THREE.MeshBasicMaterial({ map: emojiTex(emoji), transparent: true, toneMapped: false });
    const front = m(memo('signFace', () => new THREE.CircleGeometry(0.17, 32)), face, [0.55, 0, 0.019]);
    const back = m(memo('signFace', () => new THREE.CircleGeometry(0.17, 32)), face, [0.55, 0, -0.019], [0, Math.PI, 0]);
    const ring = m(memo('signRing', () => new THREE.TorusGeometry(0.2, 0.02, 8, 40)), plastic(occ, '#FFD23F'), [0.55, 0, 0]);
    return group(stick, disc, front, back, ring);
  },
  lunettesLecture(occ) {
    return getAccessory('lunettes').build(occ);
  },
};

export function makeProp(name, occ, opts) {
  const build = BUILD[name];
  if (!build) return null;
  // une enveloppe : l'acteur la déplace sans écraser le réglage propre à l'objet
  const o = new THREE.Group();
  const inner = build(occ, opts);
  o.add(inner);
  o.name = name;
  if (inner.userData.update) o.userData.update = inner.userData.update;
  return o;
}

// --- Les effets ---------------------------------------------------------------------------------

// Bulles de savon irisées qui montent en ondulant, et emojis qui s'envolent puis s'effacent.
export function createFx() {
  const group = new THREE.Group();
  const N = 24;
  const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, roughness: 0.02, metalness: 0, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], clearcoat: 1, depthWrite: false });
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), bubbleMat, N);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 5;
  group.add(bubbles);
  const B = Array.from({ length: N }, () => ({ life: 1, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, ph: 0 }));
  let bi = 0;
  const sprites = Array.from({ length: 16 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, toneMapped: false, depthWrite: false }));
    s.visible = false;
    s.renderOrder = 6;
    group.add(s);
    return { s, life: 1, max: 1, v: new THREE.Vector3(), size: 0.2, spin: 0 };
  });
  let si = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  let t = 0;
  return {
    group,
    bubble(at, { r = 0.035 + Math.random() * 0.04, v } = {}) {
      const q = B[bi];
      bi = (bi + 1) % N;
      q.life = 0;
      q.max = 1.6 + Math.random() * 1.4;
      q.r = r;
      q.ph = Math.random() * 6;
      q.p.copy(at);
      q.v.copy(v || S.set((Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.25, 0.1 + Math.random() * 0.2));
    },
    emoji(at, ch, { size = 0.22, v, life = 1.6, spin = 0 } = {}) {
      const q = sprites[si];
      si = (si + 1) % sprites.length;
      q.s.material.map = emojiTex(ch);
      q.s.material.needsUpdate = true;
      q.s.position.copy(at);
      q.s.scale.setScalar(1e-4); // minuscule jusqu'à la prochaine mise à jour (sinon une image géante)
      q.s.visible = true;
      q.life = 0;
      q.max = life;
      q.size = size;
      q.spin = spin;
      q.v.copy(v || S.set((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.3, 0.1));
    },
    update(dt) {
      t += dt;
      B.forEach((q, i) => {
        if (q.life < q.max) {
          q.life += dt;
          q.p.addScaledVector(q.v, dt);
          q.p.x += Math.sin(t * 3 + q.ph) * dt * 0.08;
          q.v.multiplyScalar(1 - dt * 0.4);
        }
        const k = q.life / q.max;
        const sc = q.life >= q.max ? 1e-5 : q.r * Math.min(1, k * 6) * (k > 0.92 ? 1.25 : 1);
        M.compose(q.p, Q, S.setScalar(sc));
        bubbles.setMatrixAt(i, M);
      });
      bubbles.instanceMatrix.needsUpdate = true;
      for (const q of sprites) {
        if (!q.s.visible) continue;
        q.life += dt;
        if (q.life >= q.max) {
          q.s.visible = false;
          continue;
        }
        const k = q.life / q.max;
        q.s.position.addScaledVector(q.v, dt);
        q.v.multiplyScalar(1 - dt * 0.6);
        q.s.scale.setScalar(q.size * Math.min(1, k * 5) * (1 + k * 0.3));
        q.s.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        q.s.material.rotation = Math.sin(t * 2 + q.max) * 0.25 + q.spin * q.life;
      }
    },
  };
}

