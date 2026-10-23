// Sentir la fleur, souffler la bougie : une petite fleur en pot avec un visage, qui ouvre ses pétales et
// envoie son parfum quand on inspire, et une bougie rigolote dont la flamme se couche quand on souffle
// (au dernier souffle, elle s'éteint dans un petit filet de fumée).
// Repère : le pot est à gauche (x = -0,3), la bougie à droite (x = 0,55) ; Pandi est à gauche du pot.
// ctx : { phase: 'ready' | 'in' | 'hold' | 'out', secs, cycle, cycles }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, damp, memo, occlusion, updateOcc, skin, lathe, taperTube, slab, face, glide, hero, particles, toLocal } from './kit.js';
import { MOUTH_Y } from '../pandi3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.1, 0.06, 0.2, 0);
  s.quadraticCurveTo(0.1, -0.06, 0, 0);
  return s;
}

// Flamme : une goutte à l'envers, blanche au cœur, orange au bout
function flameGeo() {
  const pts = [[0.0005, 0], [0.03, 0.012], [0.045, 0.04], [0.044, 0.075], [0.032, 0.115], [0.015, 0.155], [0.0005, 0.19]];
  const g = lathe(pts, 20);
  const p = g.attributes.position, col = [];
  const a = new THREE.Color('#FFFBE0'), b = new THREE.Color('#FFC23A'), c = new THREE.Color('#FF6A1A');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 0.19;
    const k = y < 0.45 ? a.clone().lerp(b, y / 0.45) : b.clone().lerp(c, (y - 0.45) / 0.55);
    col.push(k.r, k.g, k.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function createFleur() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(2, 1, 0.9);
    H.shadow.position.x = 0.12;

    // --- le pot, la terre, la tige, les feuilles ---
    const potMat = skin(occ, '#E27D52', { rough: 0.85, sheenK: 0.2, coat: 0 });
    const pot = mesh(memo('fPot', () => lathe([[0.18, 0], [0.205, 0.02], [0.25, 0.3], [0.295, 0.31], [0.3, 0.37], [0.29, 0.395], [0.255, 0.395], [0.25, 0.36], [0.0005, 0.355]], 40)), potMat, [-0.3, 0, 0]);
    root.add(pot);
    const soil = mesh(memo('fSoil', () => new THREE.CylinderGeometry(0.25, 0.25, 0.02, 32)), skin(occ, '#5A3A28', { rough: 1, sheenK: 0 }), [0, 0.36, 0]);
    pot.add(soil);
    const stemMat = skin(occ, '#4DB548', { rough: 0.6, sheen: '#D8FFC8' });
    const sway = joint('sway', pot, [0, 0.36, 0]);
    const stem = taperTube([[0, 0, 0], [0.02, 0.25, 0.01], [-0.02, 0.5, 0.02], [0.03, 0.74, 0.03]], 0.035, 0.026, 32, 10);
    sway.add(mesh(memo('fStem', () => stem.geo), stemMat));
    const leafMat = skin(occ, '#6FD45E', { rough: 0.55, sheen: '#E8FFD8' });
    const leafGeo = memo('fLeaf', () => slab(leafShape(), 0.01, 0.006));
    [[0.2, 1, 0.5], [0.42, -1, -0.4]].forEach(([u, sx, rz]) => {
      const p = stem.curve.getPointAt(u);
      const l = mesh(leafGeo, leafMat, p.toArray(), [0, sx > 0 ? 0 : Math.PI, rz]);
      sway.add(l);
    });

    // --- la fleur : cœur jaune avec un visage, neuf pétales roses qui s'ouvrent ---
    const head = joint('flower', sway, stem.curve.getPointAt(1).toArray());
    const discE = { c: [0, 0, 0], r: [0.15, 0.15, 0.075] };
    const discMat = skin(occ, '#FFD54A', { rough: 0.6, sheen: '#FFF6C8', patches: [
      { c: [0.085, -0.04, 0.06], r: [0.03, 0.022, 0.03], color: '#FF8FA8', alpha: 0.6, soft: 0.5 },
      { c: [-0.085, -0.04, 0.06], r: [0.03, 0.022, 0.03], color: '#FF8FA8', alpha: 0.6, soft: 0.5 },
    ] });
    const disc = mesh(memo('fDisc', () => blob(discE.r, [40, 28])), discMat);
    head.add(disc);
    const fFace = face(head, occ, { E: discE, eye: { x: 0.052, y: 0.03, z: 0.045, r: 0.04, iris: '#7A4A1E', turn: 0.15 }, lid: discMat, mouth: { y: -0.05, k: 0.72, line: '#6B3A12' } });
    const petalMat = skin(occ, '#FF8CC2', { rough: 0.5, sheen: '#FFE4F2', sheenK: 0.9 });
    const petalGeo = memo('fPetal', () => blob([0.075, 0.15, 0.026], [24, 18], (x, y, z) => [x * (1 - 0.35 * Math.max(0, -y)), y, z + 0.4 * y * y]).translate(0, 0.15, 0));
    const petals = Array.from({ length: 9 }, (_, i) => {
      const spin = joint('petal', head, [0, 0, -0.03]);
      spin.rotation.z = (i / 9) * TAU;
      const tilt = joint('tilt', spin, [0, 0.11, 0]);
      tilt.add(mesh(petalGeo, petalMat));
      return tilt;
    });

    // --- la bougie : soucoupe dorée, bougie crème avec un visage, mèche, flamme qui danse ---
    const candle = joint('candle', root, [0.62, 0, 0.12]);
    candle.scale.setScalar(1.25);
    const dish = mesh(memo('fDish', () => lathe([[0.0005, 0], [0.2, 0.0], [0.23, 0.035], [0.215, 0.05], [0.17, 0.03], [0.0005, 0.03]], 40)), skin(occ, '#F0B84C', { rough: 0.3, coat: 0.8, sheenK: 0 }));
    candle.add(dish);
    const waxE = { c: [0, 0.3, 0], r: [0.135, 0.3, 0.135] };
    const waxMat = skin(occ, '#FFF1D2', { rough: 0.45, sheen: '#FFFFFF', sheenK: 0.6, coat: 0.2, patches: [
      { c: [0.07, 0.24, 0.11], r: [0.028, 0.02, 0.03], color: '#FF9DB0', alpha: 0.55, soft: 0.5 },
      { c: [-0.07, 0.24, 0.11], r: [0.028, 0.02, 0.03], color: '#FF9DB0', alpha: 0.55, soft: 0.5 },
    ] });
    const wax = mesh(memo('fWax', () => lathe([[0.0005, 0.03], [0.135, 0.03], [0.135, 0.5], [0.125, 0.53], [0.06, 0.545], [0.0005, 0.54]], 40)), waxMat);
    candle.add(wax);
    // coulures de cire
    [[0.11, 0.47, 0.06, 0.03], [-0.07, 0.48, 0.11, 0.024], [0.02, 0.47, -0.13, 0.028]].forEach(([x, y, z, r]) => candle.add(mesh(memo(`fDrip${r}`, () => blob([r, r * 2.2, r], [12, 10])), waxMat, [x, y, z])));
    const cFace = face(candle, occ, { E: waxE, eye: { x: 0.055, y: 0.34, z: 0.1, r: 0.045, iris: '#4A7ACF', turn: 0.2 }, lid: waxMat, mouth: { y: 0.25, k: 0.75, line: '#5A3A30' } });
    candle.add(mesh(memo('fWick', () => new THREE.CylinderGeometry(0.008, 0.009, 0.06, 8)), skin(occ, '#3A2A24', { rough: 0.9, sheenK: 0 }), [0, 0.57, 0]));
    const flame = joint('flame', candle, [0, 0.585, 0]);
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const fl = mesh(memo('fFlame', flameGeo), flameMat);
    fl.renderOrder = 8;
    flame.add(fl);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: memo('fHaloTex', haloTex), color: '#FFB347', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.setScalar(0.42);
    halo.position.y = 0.08;
    halo.renderOrder = 8;
    flame.add(halo);

    // parfum de la fleur (étincelles), souffle de Pandi, fumée de la bougie éteinte
    const scent = particles(60, { additive: true, grow: [0.05, 0.02], drag: 0.6, lift: 0.05, ramp: [[0, 1, 0.75, 0.9, 0], [0.2, 1, 0.8, 0.95, 0.9], [1, 1, 0.9, 0.6, 0]] });
    const wind = particles(60, { grow: [0.08, 0.26], drag: 0.9, lift: 0, ramp: [[0, 1, 1, 1, 0], [0.15, 0.92, 0.96, 1, 0.75], [1, 0.85, 0.92, 1, 0]] });
    const smoke = particles(40, { grow: [0.04, 0.22], drag: 1, lift: 0.35, ramp: [[0, 0.8, 0.8, 0.85, 0], [0.15, 0.75, 0.75, 0.8, 0.6], [1, 0.7, 0.7, 0.75, 0]] });
    root.add(scent.points, wind.points, smoke.points);

    const S = { open: 0.3, glow: 0, bend: 0, out: 0, nod: 0 };
    const acc = { scent: 0, wind: 0, smoke: 0 };
    const _a = V(0, 0, 0), _b = V(0, 0, 0);
    const emit = (sys, key, dt, rate, make) => {
      acc[key] += dt * rate;
      while (acc[key] >= 1) {
        acc[key] -= 1;
        make(sys);
      }
    };
    return {
      parts: { scent, wind, smoke },
      update(H, dt, camera) {
        const { ctx, p, pt, time: T } = H;
        const ph = ctx.phase || 'ready';
        const last = ctx.cycle === (ctx.cycles || 5) - 1;
        let open = 0.1, glow = 0, bend = 0, out = 0, scentRate = 0, windRate = 0;
        const ff = { smile: 0.9, open: 0, lidUp: 0.08, lidLo: 0.55, lookX: -0.2, lookY: 0, round: 0, tongue: 0 };
        const cf = { smile: 0.8, open: 0, lidUp: 0.1, lidLo: 0.5, lookX: -0.3, lookY: 0, round: 0 };
        if (ph === 'ready') {
          open = 0.12 + Math.sin(T * 2) * 0.05;
          ff.open = 0.03;
          ff.tongue = 0.5;
          ff.lookX = 0.25;
        } else if (ph === 'in' || ph === 'hold') {
          // la fleur s'ouvre et envoie son parfum, elle ferme les yeux de plaisir
          const k = ph === 'in' ? ease(p) : 1;
          open = 0.1 + 0.9 * k;
          glow = k;
          scentRate = 14 * (0.3 + k);
          Object.assign(ff, { lidUp: 0.85 * k, lidLo: 0.9, smile: 1, open: 0.02, lookY: 0.2 });
          cf.lookX = -0.5;
        } else if (ph === 'out') {
          // Pandi souffle : la flamme se couche ; au dernier souffle, elle s'éteint
          const b = Math.sin(clamp(p / 0.9, 0, 1) * Math.PI);
          bend = b;
          open = 0.9 - 0.6 * p;
          windRate = 22 * b;
          if (last) out = ease(clamp((p - 0.45) / 0.2, 0, 1));
          Object.assign(ff, { lookX: 0.5, lookY: 0, smile: 0.9 });
          Object.assign(cf, b > 0.3 && out < 0.5 ? { lidUp: 0.75, lidLo: 0.8, open: 0.035, round: 0.8, smile: 0.4 } : { lidUp: 0.1, smile: 1, open: 0.03, round: 0, lookX: -0.2 });
        }
        glide(S, { open, glow, bend, out }, dt, 5, { bend: 7, out: 4 });
        // fleur : pétales, balancement, couleur qui s'illumine
        petals.forEach((pt_, i) => (pt_.rotation.x = lerp(1.25, -0.2, S.open) + Math.sin(T * 2 + i) * 0.03));
        head.rotation.set(-0.15 - S.glow * 0.15, 0.35, Math.sin(T * 1.3) * 0.05 + 0.1);
        head.scale.setScalar(1 + S.glow * 0.08);
        sway.rotation.z = Math.sin(T * 1.1) * 0.04 - S.bend * 0.05;
        discMat.emissive.set('#FFB040');
        discMat.emissiveIntensity = S.glow * 0.25;
        petalMat.emissive.set('#FF5FA8');
        petalMat.emissiveIntensity = S.glow * 0.18;
        fFace.update(dt, ff);
        // bougie : la flamme danse, se couche sous le souffle, s'éteint au dernier souffle
        const fk = 1 - S.out;
        flame.rotation.z = -S.bend * 1.25 + Math.sin(T * 9) * 0.05 * (1 - S.bend) + Math.sin(T * 21) * 0.12 * S.bend;
        flame.scale.set(fk * (1 - S.bend * 0.25 + Math.sin(T * 23) * 0.04), fk * (1 + Math.sin(T * 17) * 0.07 - S.bend * 0.25), fk);
        flame.visible = fk > 0.02;
        halo.material.opacity = 0.55 * fk * (0.85 + Math.sin(T * 31) * 0.15);
        cFace.update(dt, cf);
        candle.rotation.y = -0.25 + Math.sin(T * 0.9) * 0.05;
        // parfum : étincelles qui montent de la fleur vers l'enfant
        head.updateWorldMatrix(true, false);
        emit(scent, 'scent', dt, scentRate, (s) => {
          const at = root.worldToLocal(head.localToWorld(_a.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.1)));
          s.spawn(at, _b.set(-0.15 + Math.random() * 0.2, 0.15 + Math.random() * 0.2, 0.3), 1.4 + Math.random(), 0.6 + Math.random() * 0.8);
        });
        // souffle de Pandi : de petits traits d'air de sa bouche vers la bougie
        if (H.actor && windRate > 0) {
          const from = toLocal(root, H.actor.rig.head, [0, MOUTH_Y, 0.7], _a);
          const to = toLocal(root, flame, [0, 0.08, 0], V(0, 0, 0));
          const dir = to.sub(from).normalize().multiplyScalar(1.9);
          emit(wind, 'wind', dt, windRate, (s) => s.spawn(from, _b.copy(dir).add(V((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0)), 0.7, 0.8));
        }
        // fumée quand elle s'éteint
        const smoking = S.out > 0.3 && pt < 2.6 + (ctx.secs || 6) && ph === 'out';
        emit(smoke, 'smoke', dt, smoking ? 9 : 0, (s) => s.spawn(toLocal(root, flame, [0, 0.03, 0], _a), _b.set(Math.sin(T * 3) * 0.1, 0.3, 0.02), 1.6, 0.9));
        scent.update(dt, camera);
        wind.update(dt, camera);
        smoke.update(dt, camera);
        if (camera) updateOcc(occ, [[disc, [0, 0, 0], 0.12], [pot, [0, 0.25, 0], 0.25], [wax, [0, 0.3, 0], 0.13]], camera);
      },
      dispose() {
        scent.dispose();
        wind.dispose();
        smoke.dispose();
      },
    };
  }, { shadow: [2, 0.9] });
}

function haloTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,255,255,.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
