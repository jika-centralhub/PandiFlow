// 5, 4, 3, 2, 1 : un petit hibou détective avec sa casquette et sa loupe. Il regarde dans la loupe (son
// œil devient tout grand), touche ses plumes, tend l'oreille, renifle, goûte (miam), et saute de joie à
// chaque trouvaille de l'enfant (une étoile).
// ctx : { phase: 'voir' | 'toucher' | 'entendre' | 'sentir' | 'gouter', step, found, count }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, lathe, slab, scaleBump, face, glide, hero, particles } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
const WING = 0.4;

function wingShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.07, 0);
  s.quadraticCurveTo(-0.11, -0.22, -0.02, -WING);
  s.quadraticCurveTo(0.03, -0.33, 0.05, -0.3);
  s.quadraticCurveTo(0.08, -0.22, 0.07, -0.18);
  s.quadraticCurveTo(0.1, -0.08, 0.07, 0);
  s.quadraticCurveTo(0, 0.04, -0.07, 0);
  return s;
}

export function createHibou() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(0.9, 1, 0.75);
    const feather = skin(occ, '#A3713F', { rough: 0.75, sheen: '#FFE2C0', sheenK: 0.9, bump: scaleBump(10, 6), bumpScale: 0.45, patches: [
      { c: [0, -0.1, 0.24], r: [0.25, 0.3, 0.2], color: '#EBD2A4', soft: 0.06 },
    ] });
    const headMat = skin(occ, '#A3713F', { rough: 0.75, sheen: '#FFE2C0', sheenK: 0.9, bump: scaleBump(8, 4), bumpScale: 0.3 });
    const discMat = skin(occ, '#F4E5C8', { rough: 0.8, sheen: '#FFFFFF', sheenK: 0.8, patches: [
      { c: [0.05, -0.07, 0.04], r: [0.035, 0.025, 0.04], color: '#FF9DB0', alpha: 0.5, soft: 0.5 },
    ] });
    const beakMat = skin(occ, '#F49A2A', { rough: 0.35, coat: 0.6 });
    const base = joint('base', root);
    const body = mesh(memo('oBody', () => blob([0.36, 0.45, 0.33], [40, 30], (x, y, z) => [x * (1 + 0.06 * Math.max(0, -y)), y, z])), feather, [0, 0.5, 0]);
    base.add(body);
    // pattes orange
    [1, -1].forEach((sx) => {
      const f = mesh(memo('oFoot', () => blob([0.08, 0.035, 0.07], [16, 10])), beakMat, [0.12 * sx, 0.04, 0.2]);
      base.add(f);
      [-0.04, 0, 0.04].forEach((x) => base.add(mesh(memo('oToe', () => new THREE.SphereGeometry(0.022, 8, 6)), beakMat, [0.12 * sx + x, 0.03, 0.27])));
    });
    // la tête qui tourne, le grand disque du visage, les aigrettes, le bec, la casquette de détective
    const head = joint('head', base, [0, 0.98, 0]);
    head.add(mesh(memo('oHead', () => blob([0.33, 0.27, 0.29], [40, 30])), headMat));
    [1, -1].forEach((sx) => {
      const d = mesh(memo('oDisc', () => blob([0.15, 0.145, 0.06], [28, 18])), discMat, [0.12 * sx, 0.0, 0.22]);
      d.rotation.y = 0.25 * sx;
      if (sx < 0) d.scale.x = -1;
      head.add(d);
    });
    const E = { c: [0, -0.02, 0.05], r: [0.3, 0.25, 0.26] };
    const oFace = face(head, occ, { E, eye: { x: 0.12, y: 0.01, z: 0.24, r: 0.095, iris: '#F2A51C', turn: 0.22 }, lid: headMat, mouth: { y: -0.2, k: 0.01, line: '#F4E5C8' } });
    oFace.mouth.group.visible = false;
    const beakUp = mesh(memo('oBeak', () => new THREE.ConeGeometry(0.045, 0.11, 14).rotateX(Math.PI * 0.62)), beakMat, [0, -0.07, 0.3]);
    head.add(beakUp);
    const jaw = joint('jaw', head, [0, -0.1, 0.27]);
    jaw.add(mesh(memo('oJaw', () => new THREE.ConeGeometry(0.03, 0.05, 12).rotateX(Math.PI * 0.6)), beakMat, [0, -0.01, 0.02]));
    const tongue = mesh(memo('oTongue', () => blob([0.022, 0.01, 0.025], [10, 8])), skin(occ, '#FF7A90', { rough: 0.4 }), [0, 0.005, 0.03]);
    jaw.add(tongue);
    [1, -1].forEach((sx) => head.add(mesh(memo('oTuft', () => new THREE.ConeGeometry(0.06, 0.16, 12)), headMat, [0.21 * sx, 0.24, -0.02], [0, 0, -0.45 * sx])));
    const capMat = skin(occ, '#7C5233', { rough: 0.85, sheen: '#E8C8A0', sheenK: 0.7 });
    const cap = joint('cap', head, [0, 0.2, 0]);
    cap.rotation.x = -0.1;
    cap.add(mesh(memo('oCap', () => lathe([[0.0005, 0.14], [0.1, 0.13], [0.17, 0.08], [0.2, 0.0], [0.0005, 0.0]], 32)), capMat));
    cap.add(mesh(memo('oBrim', () => blob([0.12, 0.012, 0.1], [20, 8])), capMat, [0, 0.01, 0.2]));
    cap.add(mesh(memo('oBrim', () => blob([0.12, 0.012, 0.1], [20, 8])), capMat, [0, 0.01, -0.2]));
    cap.add(mesh(memo('oBand', () => new THREE.TorusGeometry(0.195, 0.012, 8, 32).rotateX(Math.PI / 2)), skin(occ, '#3A2A1E', { rough: 0.7 }), [0, 0.02, 0]));
    // les ailes (qui visent leur cible) et la loupe tenue par l'aile droite
    const wingGeo = memo('oWing', () => slab(wingShape(), 0.03, 0.015));
    const wings = [1, -1].map((sx) => {
      const p = joint('wing', base, [0.33 * sx, 0.72, 0.0]);
      p.scale.x = sx;
      p.add(mesh(wingGeo, feather));
      return { p, sx };
    });
    const glass = joint('loupe', base);
    const gold = skin(occ, '#F2B84A', { rough: 0.25, coat: 0.8 });
    gold.metalness = 0.6;
    glass.add(mesh(memo('oHandle', () => new THREE.CylinderGeometry(0.02, 0.024, 0.18, 10).translate(0, -0.18, 0)), skin(occ, '#6B3F22', { rough: 0.6 })));
    glass.add(mesh(memo('oRing', () => new THREE.TorusGeometry(0.1, 0.016, 10, 32)), gold));
    const lens = new THREE.Mesh(memo('oLens', () => new THREE.CircleGeometry(0.1, 32)), new THREE.MeshPhysicalMaterial({ color: '#DFF4FF', transparent: true, opacity: 0.22, roughness: 0.02, clearcoat: 1, depthWrite: false }));
    lens.renderOrder = 9;
    glass.add(lens);
    const scent = particles(40, { additive: true, grow: [0.04, 0.02], drag: 0.5, lift: 0.05, ramp: [[0, 1, 0.7, 0.9, 0], [0.2, 1, 0.75, 0.95, 0.9], [1, 1, 0.85, 0.7, 0]] });
    root.add(scent.points);

    const S = { headY: 0, headX: 0, headZ: 0, bigEye: 0, jaw: 0 };
    let hopT = -9, noteAcc = 0, scentAcc = 0, yum = false, starred = false;
    const _a = V(0, 0, 0), _b = V(0, 0, 0), _q = new THREE.Quaternion();
    // oriente une aile vers un point du corps (repère base) et renvoie le bout de l'aile
    const aim = (w, target) => {
      _a.copy(target).sub(w.p.position).normalize();
      w.p.quaternion.copy(_q.setFromUnitVectors(DOWN, _a));
      return w.p.position.clone().addScaledVector(_a, WING);
    };
    return {
      parts: { scent },
      set(H, c, prev) {
        if ((c.found || 0) > (prev.found || 0) && c.step === prev.step) hopT = H.time;
        if (c.step !== prev.step) yum = false;
      },
      update(H, dt, camera) {
        const { ctx, pt, time: T } = H;
        const ph = ctx.phase || 'voir';
        let hy = Math.sin(T * 0.6) * 0.15, hx = 0, hz = 0, big = 0, jawOpen = 0;
        let rT = V(0.42, 0.32, 0.1), lT = V(-0.42, 0.32, 0.1);
        let holdLens = false;
        const f = { smile: 1, open: 0, lidUp: 0.08, lidLo: 0.4, lookX: 0, lookY: 0 };
        if (ph === 'voir') {
          // il scrute dans sa loupe en tournant la tête
          hy = Math.sin(pt * 1.1) * 0.35;
          big = 1;
          holdLens = true;
          f.lookX = Math.sin(pt * 1.1) * 0.3;
        } else if (ph === 'toucher') {
          // l'aile gauche caresse son ventre tout doux
          lT = V(-0.05 + Math.sin(T * 4) * 0.06, 0.45 + Math.sin(T * 4 + 1) * 0.05, 0.42);
          Object.assign(f, { lidUp: 0.6, lidLo: 0.9, lookY: -0.4 });
          hx = 0.15;
        } else if (ph === 'entendre') {
          // l'aile derrière l'aigrette, la tête penchée, les yeux fermés
          rT = V(0.3, 1.12, 0.05);
          hz = -0.25;
          Object.assign(f, { lidUp: 0.95, lidLo: 0.8 });
          noteAcc += dt * 1.2;
          if (H.fx && noteAcc >= 1) {
            noteAcc -= 1;
            H.fx.emoji(root.localToWorld(V(0.55, 1.25, 0.1)), '🎵', { size: 0.18, v: V(-0.15, 0.25, 0) });
          }
        } else if (ph === 'sentir') {
          // le bec en l'air, il renifle une bonne odeur
          hx = -0.28 + Math.sin(T * 9) * 0.02;
          Object.assign(f, { lidUp: 0.9, lidLo: 0.9 });
          scentAcc += dt * 12;
          while (scentAcc >= 1) {
            scentAcc -= 1;
            scent.spawn(V(-0.7 + Math.random() * 0.2, 0.9 + Math.random() * 0.3, 0.4), V(0.55, 0.08, 0), 1.3, 0.8 + Math.random());
          }
        } else if (ph === 'gouter') {
          // il goûte : le bec qui mâche, miam !
          jawOpen = Math.max(0, Math.sin(T * 7)) * 0.6;
          Object.assign(f, { lidUp: 0.2, lidLo: 1 });
          if (!yum && H.fx && pt > 0.4) {
            yum = true;
            H.fx.emoji(root.localToWorld(V(0.3, 1.35, 0.3)), '😋', { size: 0.26, life: 2 });
          }
        }
        glide(S, { headY: hy, headX: hx, headZ: hz, bigEye: big, jaw: jawOpen }, dt, 6, { jaw: 16 });
        // saut de joie à chaque trouvaille, avec une étoile
        const hop = Math.sin(clamp((T - hopT) / 0.45, 0, 1) * Math.PI);
        if (hop > 0.95 && H.fx && !starred) {
          starred = true;
          H.fx.emoji(root.localToWorld(V(0, 1.6, 0.2)), '⭐', { size: 0.28 });
        }
        if (hop < 0.5) starred = false;
        base.position.y = hop * 0.18;
        body.scale.set(1 + hop * 0.04, 1 - hop * 0.05 + Math.sin(T * 2) * 0.01, 1);
        head.rotation.set(S.headX, S.headY, S.headZ);
        jaw.rotation.x = S.jaw;
        tongue.visible = S.jaw > 0.1;
        oFace.update(dt, f);
        // l'œil derrière la loupe paraît tout grand
        oFace.eyes[0].g.scale.setScalar(1 + 0.35 * S.bigEye);
        head.updateMatrixWorld(true);
        if (holdLens) {
          // la loupe devant l'œil droit ; l'aile droite tient le manche
          const lensAt = base.worldToLocal(head.localToWorld(_b.set(0.13, 0.01, 0.42)));
          glass.position.copy(lensAt);
          glass.quaternion.copy(head.quaternion);
          rT = lensAt.clone().add(V(0.04, -0.2, 0));
          aim(wings[0], rT);
        } else {
          const tip = aim(wings[0], rT);
          glass.position.copy(tip).add(V(0.02, 0.2, 0.05));
          glass.rotation.set(0, 0, -0.3);
        }
        aim(wings[1], lT);
        scent.update(dt, camera);
        if (camera) updateOcc(occ, [[body, [0, 0, 0], 0.33], [head, [0, 0, 0], 0.27]], camera);
      },
      dispose() {
        scent.dispose();
      },
    };
  }, { shadow: [0.9, 0.75] });
}
