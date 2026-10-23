// La tortue : une bébé tortue à la carapace en plaques bombées. « Stop ! » (elle lève la patte), elle
// rentre la tête et les pattes dans sa carapace, y respire tranquillement (la carapace luit doucement à
// chaque souffle), ressort la tête, puis a une idée 💡.
// ctx : { phase: 'stop' | 'carapace' | 'respire' | 'sort' | 'idee', step, secs }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, lathe, face, glide, hero } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// La carapace : un dôme, des plaques posées dessus (une au sommet, deux couronnes), un bord plus clair
function dome() {
  const g = lathe([[0.0005, 0.36], [0.16, 0.345], [0.3, 0.29], [0.41, 0.19], [0.48, 0.08], [0.5, 0.0], [0.47, -0.03], [0.0005, -0.03]], 48);
  g.scale(1, 1, 1.1);
  return g;
}
const domeY = (r) => 0.36 * Math.sqrt(Math.max(0, 1 - (r / 0.5) ** 2.2));

export function createTortue() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(1.5, 1, 1.4);
    const body = joint('body', root, [0, 0.13, 0]);
    const shellG = joint('shell', body);
    const shellMat = skin(occ, '#3E9A55', { rough: 0.5, coat: 0.35, sheen: '#C8F5C0', sheenK: 0.5 });
    const plateMats = ['#57B25B', '#4CA855', '#62BC60'].map((c) => skin(occ, c, { rough: 0.45, coat: 0.5, sheen: '#E0FFD0', sheenK: 0.5 }));
    const shell = mesh(memo('tDome', dome), shellMat);
    shellG.add(shell);
    const plateGeo = memo('tPlate', () => blob([0.16, 0.03, 0.15], [24, 14]));
    const plates = [];
    const addPlate = (r, a, s, mi) => {
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 1.1;
      const y = domeY(r) - 0.008;
      const n = V(x * 1.4, 0.36 + 0.001, z * 1.2).normalize();
      if (r === 0) n.set(0, 1, 0);
      const m = mesh(plateGeo, plateMats[mi], [x, y, z]);
      m.quaternion.setFromUnitVectors(UP, n);
      m.rotateY(a);
      m.scale.setScalar(s);
      shellG.add(m);
      plates.push(m);
    };
    addPlate(0, 0, 1.2, 2);
    for (let i = 0; i < 6; i++) addPlate(0.25, (i / 6) * TAU + 0.26, 1.02, i % 2);
    for (let i = 0; i < 10; i++) addPlate(0.42, (i / 10) * TAU, 0.8, (i + 1) % 2);
    const rim = mesh(memo('tRim', () => new THREE.TorusGeometry(0.49, 0.03, 12, 48).rotateX(Math.PI / 2).scale(1, 1, 1.1)), skin(occ, '#3A9050', { rough: 0.5, coat: 0.3 }), [0, 0.0, 0]);
    shellG.add(rim);
    const belly = mesh(memo('tBelly', () => blob([0.38, 0.06, 0.44], [32, 16])), skin(occ, '#E8D69A', { rough: 0.6, sheen: '#FFFFFF', sheenK: 0.4 }), [0, -0.035, 0]);
    shellG.add(belly);

    // peau, pattes, queue
    const skinMat = skin(occ, '#8ED68A', { rough: 0.55, sheen: '#E8FFE0', sheenK: 0.6, coat: 0.1 });
    const legGeo = memo('tLeg', () => blob([0.11, 0.13, 0.12], [20, 16]));
    const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => {
      const j = joint('leg', body, [0.34 * sx, -0.02, 0.3 * sz]);
      const m = mesh(legGeo, skinMat, [0, -0.04, 0]);
      j.add(m);
      return { j, sx, sz, rest: j.position.clone() };
    });
    const tail = mesh(memo('tTail', () => new THREE.ConeGeometry(0.045, 0.14, 12).rotateX(-Math.PI / 2)), skinMat, [0, 0.0, -0.58]);
    body.add(tail);

    // la tête au bout du cou, avec un grand sourire
    const neck = joint('neck', body, [0, 0.16, 0.45]);
    const neckM = mesh(memo('tNeck', () => new THREE.CapsuleGeometry(0.085, 0.14, 6, 14).rotateX(Math.PI / 2)), skinMat, [0, 0, -0.05]);
    neck.add(neckM);
    const head = joint('head', neck, [0, 0.19, 0.16]);
    head.scale.setScalar(1.12);
    const HE = { c: [0, 0, 0], r: [0.2, 0.18, 0.21] };
    const headMat = skin(occ, '#8ED68A', { rough: 0.55, sheen: '#E8FFE0', sheenK: 0.6, coat: 0.1, patches: [
      { c: [0.13, -0.06, 0.13], r: [0.05, 0.035, 0.06], color: '#FF8FA8', alpha: 0.55, soft: 0.5 },
      { c: [-0.13, -0.06, 0.13], r: [0.05, 0.035, 0.06], color: '#FF8FA8', alpha: 0.55, soft: 0.5 },
    ] });
    const skull = mesh(memo('tHead', () => blob(HE.r, [40, 30])), headMat);
    head.add(skull);
    const lid = skin(occ, '#8ED68A', { rough: 0.55, sheenK: 0.6 });
    const tFace = face(head, occ, { E: HE, eye: { x: 0.085, y: 0.05, z: 0.13, r: 0.07, iris: '#6B3E1F', turn: 0.22 }, lid, mouth: { y: -0.065, k: 1.05, line: '#245A2C' } });

    const S = { inside: 0, glow: 0, raise: 0, nod: 0, up: 0 };
    let bulb = 0;
    const _a = V(0, 0, 0);
    return {
      update(H, dt, camera) {
        const { ctx, pt, p, time: T } = H;
        const ph = ctx.phase || 'stop';
        let inside = 0, glow = 0, raise = 0, up = 0;
        const f = { smile: 0.95, open: 0.03, tongue: 0.6, lidUp: 0.08, lidLo: 0.6, lookX: 0, lookY: 0, lidTilt: 0, round: 0 };
        if (ph === 'stop') {
          // « Stop ! » : la patte levée, l'air sérieux
          raise = ease(clamp(pt / 0.5, 0, 1));
          up = 0.1;
          Object.assign(f, { smile: 0.2, open: 0.03, round: 0.4, tongue: 0, lidUp: 0, lidLo: 0.3, lookY: 0.1 });
        } else if (ph === 'carapace') {
          inside = ease(clamp((pt - 0.6) / 1.8, 0, 1));
          Object.assign(f, { smile: 0.6, open: 0, tongue: 0, lidUp: lerp(0.1, 1, inside), lidLo: 0.7 });
        } else if (ph === 'respire') {
          inside = 1;
          glow = 0.5 + 0.5 * Math.sin((pt / (ctx.secs || 5)) * TAU - Math.PI / 2);
          Object.assign(f, { smile: 0.8, open: 0, tongue: 0, lidUp: 1, lidLo: 0.8 });
        } else if (ph === 'sort') {
          inside = 1 - ease(clamp((pt - 0.4) / 2.2, 0, 1));
          Object.assign(f, { smile: 1, open: 0.02, tongue: 0.4, lidUp: inside > 0.5 ? 0.9 : 0.05, lidLo: 0.6, lookY: 0.05 });
        } else if (ph === 'idee') {
          up = 0.3;
          Object.assign(f, { smile: 1, open: 0.05, tongue: 1, lidUp: 0, lidLo: 0.75, lookY: 0.4 });
          bulb += dt;
          if (H.fx && bulb > 0.4 && pt < 0.6) {
            bulb = -99;
            H.fx.emoji(toWorld(head, [0, 0.4, 0]), '💡', { size: 0.34, v: V(0, 0.18, 0), life: 3.2 });
          }
        }
        if (ph !== 'idee') bulb = 0;
        glide(S, { inside, glow, raise, up }, dt, 5, { raise: 8 });
        // carapace qui respire et luit
        const br = ph === 'respire' ? glow : 0;
        shellG.scale.set(1 + br * 0.03, 1 + br * 0.05, 1 + br * 0.03);
        for (const m of [shellMat, ...plateMats]) {
          m.emissive.set('#FFE08A');
          m.emissiveIntensity = S.glow * 0.22;
        }
        body.position.y = 0.13 - S.inside * 0.07 + Math.abs(Math.sin(T * 2.2)) * 0.01 * (1 - S.inside);
        body.rotation.set(-0.06 * S.up, Math.sin(T * 0.6) * 0.06 * (1 - S.inside), 0);
        // tête et pattes rentrent dans la carapace
        neck.position.set(0, lerp(0.16, 0.0, S.inside), lerp(0.45, 0.14, S.inside));
        neck.scale.setScalar(lerp(1, 0.75, S.inside));
        const nod = ph === 'idee' ? Math.sin(T * 6) * 0.12 : 0;
        head.rotation.set(-0.15 * S.up + nod + Math.sin(T * 0.9) * 0.04 * (1 - S.inside), -0.15 + Math.sin(T * 0.7) * 0.12 * (1 - S.inside), Math.sin(T * 1.1) * 0.05);
        legs.forEach((l, i) => {
          l.j.position.set(l.rest.x * lerp(1, 0.55, S.inside), l.rest.y + S.inside * 0.05, l.rest.z * lerp(1, 0.6, S.inside));
          l.j.scale.setScalar(lerp(1, 0.5, S.inside));
          // la patte avant droite se lève pour dire stop
          const lift = i === 0 ? S.raise : 0;
          l.j.rotation.set(-1.6 * lift + (ph === 'idee' && i < 2 ? Math.sin(T * 8 + i * 3) * 0.2 : 0), 0, -0.5 * lift);
          if (i === 0) l.j.position.y += 0.18 * lift;
        });
        tail.scale.setScalar(lerp(1, 0.3, S.inside));
        tFace.update(dt, f, { noBlink: ph === 'respire' || ph === 'carapace' });
        if (camera) updateOcc(occ, [[shell, [0, 0.1, 0], 0.45], [skull, [0, 0, 0], 0.18]], camera);
      },
    };
  }, { shadow: [1.5, 1.4] });
}

const _w = new THREE.Vector3();
function toWorld(obj, off) {
  obj.updateWorldMatrix(true, false);
  return obj.localToWorld(_w.set(...off)).clone();
}
