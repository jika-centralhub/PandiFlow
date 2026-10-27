// Les accessoires de Pandi (un tirage par jour, le même sur tous les écrans) et les objets qu'il tient
// pendant les tâches (brosse à dents, mousse…). Tout est modélisé en code, éclairé comme Pandi.
import { THREE, shade, onMuzzle, FUR_WHITE } from './pandi3d.js';
import { hashString } from '../lib/util.js';
import { themeLookFor } from './themeLook.js';

const TAU = Math.PI * 2;

function mat(occ, color, o = {}) {
  return shade(new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, ...o }), occ);
}
const felt = (occ, color) => mat(occ, color, { roughness: 0.92, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') });
const plastic = (occ, color) => mat(occ, color, { roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
const gold = (occ) => mat(occ, '#FFC53D', { metalness: 1, roughness: 0.24 });
const gem = (occ, color) => mat(occ, color, { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0 });

function m(geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(...pos);
  o.rotation.set(...rot);
  if (scale) o.scale.set(...scale);
  return o;
}
function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// Rayures peintes (bonnet, chapeau de fête, écharpe)
const stripeCache = new Map();
function stripes(colors, n = 8, vertical = false, knit = true) {
  const key = `${colors}|${n}|${vertical}|${knit}`;
  if (stripeCache.has(key)) return stripeCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    if (vertical) g.fillRect((i * 256) / n, 0, 256 / n + 1, 256);
    else g.fillRect(0, (i * 256) / n, 256, 256 / n + 1);
  }
  if (knit) {
    // mailles du tricot
    g.globalAlpha = 0.18;
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) {
      g.fillStyle = (x + y) % 16 ? '#000' : '#fff';
      g.beginPath();
      g.ellipse(x + 4, y + 4, 2.6, 3.6, 0.5, 0, TAU);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  stripeCache.set(key, t);
  return t;
}

function heartShape(s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.1 * s);
  h.bezierCurveTo(-0.02 * s, -0.07 * s, -0.12 * s, -0.02 * s, -0.12 * s, 0.035 * s);
  h.bezierCurveTo(-0.12 * s, 0.09 * s, -0.06 * s, 0.11 * s, 0, 0.06 * s);
  h.bezierCurveTo(0.06 * s, 0.11 * s, 0.12 * s, 0.09 * s, 0.12 * s, 0.035 * s);
  h.bezierCurveTo(0.12 * s, -0.02 * s, 0.02 * s, -0.07 * s, 0, -0.1 * s);
  return h;
}

// Repères (tête) : sommet du crâne vers y = 0,57 ; yeux en (±0,228 ; 0,05 ; 0,47) ; oreilles en (±0,42 ; 0,4)
// Repère (buste) : base du cou vers y = 0,52, poitrine vers z = 0,36
export const ACCESSORIES = [
  {
    id: 'cowboy', slot: 'tete', name: 'Chapeau de cow-boy', bone: 'head', hideTuft: true,
    build(occ) {
      const brown = felt(occ, '#A8642E');
      brown.side = THREE.DoubleSide;
      const crown = lathe([[0.001, 0.215], [0.05, 0.2], [0.1, 0.24], [0.16, 0.25], [0.195, 0.16], [0.205, 0.04], [0.21, 0]]);
      bend(crown, (x, y, z) => {
        // pincé devant, creusé au milieu
        const k = smooth((y - 0.1) / 0.15) * Math.max(0, z / 0.2);
        return [x * (1 - 0.28 * k), y - 0.03 * k * (1 - Math.abs(x) / 0.2), z * (1 - 0.06 * k)];
      });
      const brim = lathe([[0.19, 0.012], [0.3, 0.008], [0.42, 0.02], [0.46, 0.045], [0.455, 0.06], [0.41, 0.036], [0.3, 0.026], [0.19, 0.03]], 64);
      bend(brim, (x, y, z) => [x, y + 0.13 * Math.abs(x / 0.46) ** 2.6 - 0.02 * (z / 0.46) ** 2, z]);
      const band = m(new THREE.TorusGeometry(0.207, 0.02, 10, 48), felt(occ, '#C8323B'), [0, 0.04, 0], [Math.PI / 2, 0, 0]);
      const star = m(new THREE.ExtrudeGeometry(starShape(0.04), { depth: 0.01, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }), gold(occ), [0, 0.045, 0.205]);
      return place(group(m(crown, brown), m(brim, brown), band, star), [0.03, 0.5, -0.03], [-0.16, 0, -0.14], 1.05);
    },
  },
  {
    id: 'couronne', slot: 'tete', name: 'Couronne de roi', bone: 'head', hideTuft: true,
    build(occ) {
      const g = new THREE.CylinderGeometry(0.2, 0.18, 0.12, 60, 4, true);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y > 0.059) {
          const a = Math.atan2(p.getZ(i), p.getX(i));
          p.setY(i, y + Math.abs(Math.cos((a * 6) / 2)) ** 3 * 0.11); // six pointes
        }
      }
      g.computeVertexNormals();
      const gm = gold(occ);
      gm.side = THREE.DoubleSide;
      const out = group(m(g, gm));
      const red = gem(occ, '#E8233D'), blue = gem(occ, '#2C7BE5');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        out.add(m(new THREE.SphereGeometry(0.024, 16, 12), gold(occ), [Math.cos(a) * 0.2, 0.18, Math.sin(a) * 0.2]));
        out.add(m(new THREE.SphereGeometry(0.026, 16, 12), i % 2 ? blue : red, [Math.cos(a + Math.PI / 6) * 0.193, 0.0, Math.sin(a + Math.PI / 6) * 0.193]));
      }
      out.add(m(new THREE.TorusGeometry(0.19, 0.016, 10, 48), gm, [0, -0.06, 0], [Math.PI / 2, 0, 0]));
      return place(out, [-0.02, 0.58, 0], [-0.08, 0, 0.12], 1);
    },
  },
  {
    id: 'bonnet', slot: 'tete', name: 'Bonnet à pompon', bone: 'head', hideTuft: true,
    build(occ) {
      const knit = mat(occ, '#ffffff', { map: stripes(['#E5383B', '#FFF3E0'], 6), roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') });
      const shell = new THREE.SphereGeometry(1, 56, 28, 0, TAU, 0, Math.PI * 0.36);
      shell.scale(0.69, 0.64, 0.62);
      const cuff = m(new THREE.TorusGeometry(1, 0.075, 14, 56), mat(occ, '#E5383B', { roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff') }), [0, 0.26, 0], [Math.PI / 2, 0, 0], [0.585, 0.53, 1]);
      const pom = m(new THREE.SphereGeometry(0.11, 24, 18), mat(occ, '#FFF3E0', { roughness: 1, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff') }), [0, 0.7, 0]);
      return place(group(m(shell, knit), cuff, pom), [0, 0.02, -0.01], [-0.1, 0, 0.06], 1);
    },
  },
  {
    id: 'helice', slot: 'tete', name: 'Casquette à hélice', bone: 'head', hideTuft: true,
    build(occ) {
      const cap = mat(occ, '#ffffff', { map: stripes(['#E5383B', '#FFC93C', '#2C7BE5', '#3BB273'], 8, true, false), roughness: 0.55 });
      const shell = new THREE.SphereGeometry(1, 56, 24, 0, TAU, 0, Math.PI * 0.3);
      shell.scale(0.66, 0.6, 0.6);
      const visor = m(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 40, 1, false, -Math.PI / 2, Math.PI), plastic(occ, '#2C7BE5'), [0, 0.35, 0.36], [0.28, 0, 0], [1, 1, 0.9]);
      const stem = m(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 10), plastic(occ, '#FFC93C'), [0, 0.64, 0]);
      const blade = new THREE.SphereGeometry(1, 20, 10).scale(0.16, 0.012, 0.045);
      const prop = group(m(blade, plastic(occ, '#E5383B'), [0.15, 0, 0], [0.25, 0, 0]), m(blade, plastic(occ, '#3BB273'), [-0.15, 0, 0], [-0.25, 0, 0]), m(new THREE.SphereGeometry(0.025, 12, 10), plastic(occ, '#FFC93C')));
      prop.position.set(0, 0.69, 0);
      const out = place(group(m(shell, cap), visor, stem, prop), [0, 0.02, 0], [-0.06, 0, 0], 1);
      out.userData.update = (dt, energy) => (prop.rotation.y += dt * (5 + energy * 18));
      return out;
    },
  },
  {
    id: 'fete', slot: 'tete', name: 'Chapeau de fête', bone: 'head', hideTuft: true,
    build(occ) {
      const tex = stripes(['#7B6CFF', '#FF7EB6', '#FFD23F'], 9, false, false).clone();
      tex.rotation = 0.6;
      const cone = m(new THREE.ConeGeometry(0.15, 0.38, 40, 1, true).translate(0, 0.19, 0), mat(occ, '#ffffff', { map: tex, roughness: 0.5, side: THREE.DoubleSide }));
      const pom = m(new THREE.SphereGeometry(0.055, 18, 14), mat(occ, '#FFD23F', { roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff') }), [0, 0.39, 0]);
      const rim = m(new THREE.TorusGeometry(0.15, 0.022, 10, 40), mat(occ, '#FFFFFF', { roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff') }), [0, 0, 0], [Math.PI / 2, 0, 0]);
      return place(group(cone, pom, rim), [0.16, 0.5, 0.02], [0, 0, -0.32], 1);
    },
  },
  {
    id: 'lunettes', slot: 'yeux', name: 'Lunettes rondes', bone: 'head',
    build(occ) {
      const frame = plastic(occ, '#E0463C');
      const glass = new THREE.MeshPhysicalMaterial({ color: '#E8F4FF', transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false });
      const out = new THREE.Group();
      for (const sx of [1, -1]) {
        out.add(m(new THREE.TorusGeometry(0.135, 0.017, 12, 48), frame, [0.23 * sx, 0.05, 0.635]));
        out.add(m(new THREE.CircleGeometry(0.13, 40), glass, [0.23 * sx, 0.05, 0.632]));
        out.add(m(new THREE.CylinderGeometry(0.011, 0.011, 0.5, 8), frame, [0.4 * sx, 0.07, 0.36], [Math.PI / 2, 0, -0.35 * sx]));
      }
      out.add(m(new THREE.TorusGeometry(0.06, 0.014, 10, 24, Math.PI), frame, [0, 0.05, 0.64]));
      return out;
    },
  },
  {
    id: 'coeur', slot: 'yeux', name: 'Lunettes cœur', bone: 'head',
    build(occ) {
      const frame = plastic(occ, '#FF4F9A');
      const lens = mat(occ, '#5A1F45', { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.88 });
      const out = new THREE.Group();
      for (const sx of [1, -1]) {
        const ring = new THREE.Shape();
        heartShape(1.55).getPoints(40).forEach((p, i) => (i ? ring.lineTo(p.x, p.y) : ring.moveTo(p.x, p.y)));
        const hole = new THREE.Path(heartShape(1.3).getPoints(40).reverse());
        ring.holes.push(hole);
        out.add(m(new THREE.ExtrudeGeometry(ring, { depth: 0.02, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 24 }), frame, [0.235 * sx, 0.06, 0.615]));
        out.add(m(new THREE.ShapeGeometry(heartShape(1.32), 24), lens, [0.235 * sx, 0.06, 0.628]));
        out.add(m(new THREE.CylinderGeometry(0.011, 0.011, 0.5, 8), frame, [0.42 * sx, 0.09, 0.36], [Math.PI / 2, 0, -0.35 * sx]));
      }
      out.add(m(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), frame, [0, 0.09, 0.64], [0, 0, Math.PI / 2]));
      return out;
    },
  },
  {
    id: 'papillon', slot: 'cou', name: 'Nœud papillon', bone: 'torso',
    build(occ) {
      const red = mat(occ, '#E4383F', { roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') });
      const s = new THREE.Shape();
      s.moveTo(0, 0.02);
      s.bezierCurveTo(0.05, 0.05, 0.11, 0.08, 0.13, 0.05);
      s.bezierCurveTo(0.145, 0.02, 0.145, -0.02, 0.13, -0.05);
      s.bezierCurveTo(0.11, -0.08, 0.05, -0.05, 0, -0.02);
      const wing = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelSize: 0.018, bevelThickness: 0.02, bevelSegments: 4, curveSegments: 16 });
      const out = group(m(wing, red), m(wing, red, [0, 0, 0.03], [0, Math.PI, 0]), m(new THREE.SphereGeometry(0.04, 18, 14), red, [0, 0, 0.03], [0, 0, 0], [1, 1.1, 0.8]));
      return place(out, [0, 0.49, 0.33], [-0.35, 0, 0.06], 1);
    },
  },
  {
    id: 'echarpe', slot: 'cou', name: 'Écharpe rayée', bone: 'torso',
    build(occ) {
      const knit = mat(occ, '#ffffff', { map: stripes(['#2EC4B6', '#FFD23F'], 10), roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') });
      const ring = m(new THREE.TorusGeometry(0.33, 0.085, 16, 48), knit, [0, 0.52, 0.0], [Math.PI / 2 - 0.15, 0, 0], [1, 1, 1.3]);
      const tail = m(new THREE.CapsuleGeometry(0.075, 0.28, 6, 16), knit, [0.17, 0.33, 0.37], [0.25, 0, 0.18], [1, 1, 0.45]);
      return group(ring, tail);
    },
  },
  {
    id: 'collier', slot: 'cou', name: 'Collier de fleurs', bone: 'torso',
    build(occ) {
      const out = new THREE.Group();
      const colors = ['#FF7EB6', '#FFD23F', '#FFFFFF', '#FF9F43', '#B388FF'];
      const petal = new THREE.SphereGeometry(0.052, 12, 10).scale(1, 0.45, 1);
      const heart = gold(occ);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const front = (Math.cos(a) + 1) / 2; // 1 devant, 0 derrière : le collier descend sur la poitrine
        const f = new THREE.Group();
        const pm = mat(occ, colors[i % colors.length], { roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') });
        for (let k = 0; k < 5; k++) {
          const b = (k / 5) * TAU;
          f.add(m(petal, pm, [Math.cos(b) * 0.05, 0, Math.sin(b) * 0.05]));
        }
        f.add(m(new THREE.SphereGeometry(0.026, 10, 8), heart, [0, 0.012, 0]));
        const R = 0.36 + front * 0.1; // posé sur le ventre, plus large devant où il descend
        f.position.set(Math.sin(a) * R, 0.54 - front * 0.12, Math.cos(a) * R);
        f.lookAt(f.position.x * 3, f.position.y + 0.4, f.position.z * 3);
        f.rotateX(Math.PI / 2);
        out.add(f);
      }
      return out;
    },
  },
  {
    id: 'cape', slot: 'dos', name: 'Cape de super-héros', bone: 'torso',
    build(occ) {
      const geo = new THREE.PlaneGeometry(0.95, 0.95, 16, 16).translate(0, -0.475, 0);
      const base = geo.attributes.position.array.slice();
      const red = mat(occ, '#D7263D', { roughness: 0.55, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#FF9AA8'), side: THREE.DoubleSide });
      const cape = m(geo, red);
      const collar = m(new THREE.TorusGeometry(0.3, 0.04, 10, 40, Math.PI * 1.2), mat(occ, '#FFC93C', { roughness: 0.4 }), [0, 0.56, -0.02], [Math.PI / 2 + 0.2, 0, Math.PI * 0.9 - Math.PI]);
      const out = group(cape, collar);
      cape.position.set(0, 0.6, -0.34);
      const p = geo.attributes.position;
      let t = 0;
      out.userData.update = (dt, energy) => {
        t += dt * (1.5 + energy * 3);
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1];
          const down = -y; // 0 en haut, 0,95 en bas
          const wrap = Math.cos((x / 0.95) * Math.PI * 0.9) * 0.18 * (1 - down * 0.6); // s'enroule autour des épaules
          const flutter = Math.sin(t * 2 + down * 5 + x * 3) * 0.04 * down * (0.5 + energy);
          p.setXYZ(i, x * (1 + down * 0.25), y, wrap - down * (0.18 + energy * 0.25) + flutter);
        }
        p.needsUpdate = true;
        geo.computeVertexNormals();
      };
      out.userData.update(0, 0);
      return out;
    },
  },
  // --- Tenue du thème Espace (pas dans le tirage du jour : seulement pendant le thème) ---
  {
    id: 'antennes', slot: 'tete', name: 'Antennes de l’espace', bone: 'head', hideTuft: true, theme: true,
    build(occ) {
      const band = plastic(occ, '#5B6CFF');
      const stem = plastic(occ, '#D9DEE8');
      // un serre-tête qui passe par-dessus la tête, d'une oreille à l'autre
      const arc = m(new THREE.TorusGeometry(1, 0.042, 12, 72, Math.PI), band, [0, 0, 0], [0, 0, 0], [0.69, 0.6, 0.65]);
      const out = group(arc);
      const stalks = [];
      for (const sx of [1, -1]) {
        const a = sx > 0 ? 1.13 : Math.PI - 1.13;
        const s = group(
          m(new THREE.CylinderGeometry(0.013, 0.016, 0.24, 10).translate(0, 0.12, 0), stem),
          m(new THREE.SphereGeometry(0.03, 16, 12), band, [0, 0.245, 0]),
          m(new THREE.ExtrudeGeometry(starShape(0.075), { depth: 0.022, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }).translate(0, 0, -0.011), gold(occ), [0, 0.31, 0]),
        );
        s.position.set(Math.cos(a) * 0.69, Math.sin(a) * 0.6, 0);
        s.userData.lean = -sx * 0.38;
        s.rotation.z = s.userData.lean;
        out.add(s);
        stalks.push(s);
      }
      let t = 0;
      const placed = place(out, [0, 0.02, -0.03], [-0.22, 0, 0], 1);
      placed.userData.update = (dt, energy) => {
        t += dt;
        stalks.forEach((s, i) => {
          s.rotation.z = s.userData.lean + Math.sin(t * 3.2 + i * 1.7) * (0.06 + energy * 0.14);
          s.children[2].rotation.y = Math.sin(t * 1.4 + i) * 0.5;
        });
      };
      return placed;
    },
  },
  {
    id: 'jetpack', slot: 'dos', name: 'Réacteur de fusée', bone: 'torso', theme: true,
    build(occ) {
      const metal = mat(occ, '#E6EBF2', { metalness: 0.65, roughness: 0.3 });
      const red = plastic(occ, '#E5383B');
      const blue = plastic(occ, '#5B6CFF');
      const nozzleMat = mat(occ, '#9AA3B5', { metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide });
      const fire = new THREE.MeshBasicMaterial({ color: '#FFB547', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.MeshBasicMaterial({ color: '#FFF3C4', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      const out = group(m(new THREE.BoxGeometry(0.3, 0.3, 0.06), blue, [0, 0, 0.04]));
      const flames = [];
      for (const sx of [-1, 1]) {
        const x = sx * 0.1;
        out.add(m(new THREE.CapsuleGeometry(0.075, 0.2, 8, 24), metal, [x, 0, -0.04]));
        out.add(m(new THREE.TorusGeometry(0.077, 0.014, 8, 32), red, [x, 0.07, -0.04], [Math.PI / 2, 0, 0]));
        out.add(m(new THREE.TorusGeometry(0.077, 0.014, 8, 32), red, [x, -0.07, -0.04], [Math.PI / 2, 0, 0]));
        out.add(m(new THREE.ConeGeometry(0.052, 0.07, 24, 1, true), nozzleMat, [x, -0.2, -0.04]));
        // la flamme pointe vers le bas et danse avec l'énergie de Pandi
        const flame = group(
          m(new THREE.ConeGeometry(0.042, 0.16, 20).rotateX(Math.PI).translate(0, -0.08, 0), fire),
          m(new THREE.ConeGeometry(0.022, 0.09, 16).rotateX(Math.PI).translate(0, -0.045, 0), core),
        );
        flame.position.set(x, -0.235, -0.04);
        out.add(flame);
        flames.push(flame);
      }
      let t = 0;
      const placed = place(out, [0, 0.36, -0.5], [0.25, 0, 0], 1.4);
      placed.userData.update = (dt, energy) => {
        t += dt;
        flames.forEach((f, i) => f.scale.set(1, 0.65 + 0.25 * Math.sin(t * 18 + i * 2.1) + energy * 0.6, 1));
      };
      return placed;
    },
  },
];

function starShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i) s.lineTo(x, y);
    else s.moveTo(x, y);
  }
  return s;
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function bend(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...fn(p.getX(i), p.getY(i), p.getZ(i)));
  geo.computeVertexNormals();
  return geo;
}

function place(obj, pos, rot, s = 1) {
  const g = new THREE.Group();
  g.add(obj);
  g.position.set(...pos);
  g.rotation.set(...rot);
  g.scale.setScalar(s);
  return g;
}

export const getAccessory = (id) => ACCESSORIES.find((a) => a.id === id);
// Le tirage du jour ignore les tenues des thèmes (elles ne sortent que pendant leur thème)
const bySlot = (slot) => ACCESSORIES.filter((a) => a.slot === slot && !a.theme);

// Le « Pandi du jour » : même tirage pour une même date, sur tous les écrans.
// Il porte toujours quelque chose sur la tête, souvent au cou, parfois des lunettes ou une cape.
// Pendant un thème de la boutique, Pandi porte la tenue du thème (js/mascot/themeLook.js).
export function dailyLook(dateISO) {
  const themed = themeLookFor(dateISO);
  if (themed) return { tete: null, yeux: null, cou: null, dos: null, ...themed };
  let s = hashString(`pandi:${dateISO}`) || 1;
  const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0), (s ^= s >>> 13), (s >>> 0) / 4294967296);
  const one = (slot) => {
    const list = bySlot(slot);
    return list[Math.floor(rnd() * list.length)].id;
  };
  const look = { tete: one('tete'), yeux: null, cou: null, dos: null };
  if (rnd() < 0.45) look.yeux = one('yeux');
  if (rnd() < 0.75) look.cou = one('cou');
  if (rnd() < 0.35) look.dos = one('dos');
  return look;
}

// Habille Pandi : renvoie ce qu'il faut animer et cacher selon les tâches (bonnet de douche, lunettes de lecture…)
export function dress(rig, look) {
  const worn = [];
  for (const slot of ['tete', 'yeux', 'cou', 'dos']) {
    const a = look[slot] && getAccessory(look[slot]);
    if (!a) continue;
    const obj = a.build(rig.occ);
    (a.bone === 'head' ? rig.head : rig.torso).add(obj);
    worn.push({ a, obj });
  }
  rig.tuft.visible = !worn.some((w) => w.a.hideTuft);
  return {
    worn,
    update(dt, energy) {
      for (const w of worn) w.obj.userData.update?.(dt, energy);
    },
    // une tâche peut prendre la place d'un emplacement (ex. bonnet de douche sur la tête)
    hideSlot(slot, hidden) {
      for (const w of worn) if (w.a.slot === slot) w.obj.visible = !hidden;
      if (slot === 'tete') rig.tuft.visible = hidden || !worn.some((w) => w.a.hideTuft && w.obj.visible);
    },
    dispose() {
      for (const w of worn) w.obj.removeFromParent();
    },
  };
}

// --- Objets des tâches -----------------------------------------------------------------------

// Brosse à dents : on la tient par le bout (origine), le manche suit +x, les poils pointent vers +z
export function toothbrush(occ, color = '#3FC1C9') {
  const body = plastic(occ, color);
  const g = new THREE.Group();
  g.add(m(new THREE.CapsuleGeometry(0.042, 0.2, 6, 16), body, [0.1, 0, 0], [0, 0, Math.PI / 2]));
  g.add(m(new THREE.CapsuleGeometry(0.022, 0.12, 6, 12), body, [0.29, 0, 0], [0, 0, Math.PI / 2]));
  g.add(m(new THREE.CapsuleGeometry(0.034, 0.075, 6, 14), body, [0.39, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.7]));
  g.add(m(new THREE.TorusGeometry(0.043, 0.008, 8, 24), plastic(occ, '#FFFFFF'), [0.17, 0, 0], [0, Math.PI / 2, 0]));
  const tuftGeo = new THREE.CylinderGeometry(0.011, 0.012, 0.05, 8).rotateX(Math.PI / 2);
  const bristle = mat(occ, '#FFFFFF', { roughness: 0.5 }), tip = mat(occ, '#8FD3FF', { roughness: 0.5 });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) g.add(m(tuftGeo, j ? tip : bristle, [0.36 + i * 0.019, (j - 0.5) * 0.026, 0.04]));
  return g;
}

// Mousse de dentifrice : des bulles qui naissent au coin de la bouche, gonflent, s'échappent sur le côté
// et éclatent ; et une petite barbe de mousse autour des lèvres, qui pousse pendant le brossage.
const BEARD = [[0.1, -0.235, 0.04], [0.118, -0.262, 0.032], [0.085, -0.285, 0.036], [-0.098, -0.24, 0.034], [-0.112, -0.265, 0.026], [0.02, -0.318, 0.03], [-0.03, -0.312, 0.024]];
export function foam(occ, n = 30) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const mtl = mat(occ, '#FFFFFF', { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: new THREE.Color('#DDF2FF') });
  const mesh = new THREE.InstancedMesh(geo, mtl, n + BEARD.length);
  mesh.frustumCulled = false;
  const parts = Array.from({ length: n }, () => ({ life: 1, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0 }));
  const beard = BEARD.map(([x, y, r]) => {
    const [px, py, pz] = onMuzzle(x, y, r * 0.5);
    return { p: new THREE.Vector3(px, py, pz), r, k: 0, ph: Math.random() * 6 };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  let next = 0, acc = 0, t = 0;
  return {
    mesh,
    // rate : bulles par seconde ; at : coin de la bouche (repère de la tête) ; side : côté où partent les bulles
    update(dt, rate, at, side = 1) {
      t += dt;
      acc += dt * rate;
      while (acc >= 1 && at) {
        acc -= 1;
        const q = parts[next];
        next = (next + 1) % n;
        q.life = 0;
        q.max = 0.6 + Math.random() * 0.9;
        q.r = 0.012 + Math.random() * 0.02;
        q.p.copy(at).add(S.set((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.03, 0.01));
        q.v.set(side * (0.12 + Math.random() * 0.25), -0.05 + Math.random() * 0.2, 0.12 + Math.random() * 0.2);
      }
      parts.forEach((q, i) => {
        if (q.life < q.max) {
          q.life += dt;
          q.v.y -= dt * 0.35;
          q.v.multiplyScalar(1 - dt * 1.2);
          q.p.addScaledVector(q.v, dt);
        }
        const k = q.life / q.max;
        const sc = q.life >= q.max ? 0 : q.r * Math.min(1, k * 5) * (k > 0.88 ? 1 + (k - 0.88) * 5 : 1);
        M.compose(q.p, Q, S.setScalar(Math.max(sc, 1e-5)));
        mesh.setMatrixAt(i, M);
      });
      beard.forEach((b, i) => {
        b.k = Math.min(1, Math.max(0, b.k + dt * (rate > 0 ? 0.35 : -1.5)));
        const g = Math.min(1, b.k * 3 - i * 0.12);
        const sc = g > 0 ? b.r * g * (1 + Math.sin(t * 7 + b.ph) * 0.08) : 1e-5;
        M.compose(b.p, Q, S.setScalar(Math.max(sc, 1e-5)));
        mesh.setMatrixAt(n + i, M);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export { FUR_WHITE, mat, felt, plastic, gold, m, group, lathe, stripes, bend, place, starShape, heartShape };
