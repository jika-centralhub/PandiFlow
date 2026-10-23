// Pandi qui joue : il enchaîne des numéros (acts.js), passe de l'un à l'autre en douceur, cligne des yeux,
// respire, et ses oreilles et sa mèche ballottent après chaque geste. Il prend et repose les objets des
// tâches (props.js) et lance les petits effets (bulles, emojis).
import { THREE, createPandi, reach, applyFace, updateOcclusion, lerp, clamp } from './pandi3d.js';
import { dailyLook, dress, toothbrush, foam } from './gear.js';
import { ACTS, basePose, ease } from './acts.js';
import { makeProp, createFx } from './props.js';

export { ACTS };

const NUM = ['rootY', 'rootX', 'turn', 'lean', 'bend', 'side', 'twist', 'squash', 'headX', 'headY', 'headZ', 'legR', 'legL', 'toeR', 'toeL', 'brush', 'foam', 'energy', 'tuftFlat', 'tuftScale'];
const VEC = ['handR', 'handL', 'poleR', 'poleL', 'contact', 'handle'];
const SLOTS = ['tete', 'yeux', 'cou', 'dos'];

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class PandiActor {
  constructor({ date, look, iris, brushColor } = {}) {
    this.rig = createPandi({ iris });
    this.look = look || dailyLook(date || new Date().toISOString().slice(0, 10));
    this.wear = dress(this.rig, this.look);
    this.brush = toothbrush(this.rig.occ, brushColor);
    this.brush.visible = false;
    this.rig.torso.add(this.brush);
    this.foam = foam(this.rig.occ);
    this.rig.head.add(this.foam.mesh);
    // posés dans la scène (et non sur Pandi) : le sol (coffre, réveil, jouet qui vole) et les effets
    this.ground = new THREE.Group();
    this.fx = createFx();
    this.stageObjects = [this.ground, this.fx.group];
    this.props = new Map();
    this.cur = { act: ACTS.idle, t: 0, ctx: {} };
    this.prev = null;
    this.mix = 1;
    this.time = 0;
    this.blink = { next: 1.5, t: -1 };
    this.prevHead = [0, 0, 0];
    this.prevRootY = 0;
    this.rootV = 0;
    this.emitAcc = new Map();
    this.hidden = {};
    this.lastCue = null;
    this.onCue = null;
    this.paws = { R: new THREE.Vector3(), L: new THREE.Vector3() };
  }

  get frame() {
    return this.cur.act.frame || null;
  }

  play(name, ctx = {}) {
    const act = ACTS[name] || ACTS.idle;
    if (act === this.cur.act) {
      this.cur.ctx = { ...ctx };
      return;
    }
    this.prev = this.cur;
    this.cur = { act, t: 0, ctx: { ...ctx } };
    this.mix = 0;
  }

  setContext(ctx) {
    Object.assign(this.cur.ctx, ctx);
  }

  evaluate(slot) {
    const P = basePose();
    slot.act.pose(slot.t, P, slot.ctx);
    return P;
  }

  // Une cible de main accrochée à une partie du corps (cheville, tête) -> repère du buste
  anchorTarget(P, side) {
    const a = P[`anchor${side}`];
    if (!a) return;
    const rig = this.rig;
    const bone = a.bone === 'head' ? rig.head : a.bone.startsWith('ankle') ? rig.legs[a.bone.slice(-1)].ankle : rig.torso;
    rig.torso.worldToLocal(bone.localToWorld(_v.set(...a.off)));
    P[`hand${side}`].lerp(_v, a.w ?? 1);
  }

  update(dt, camera) {
    dt = clamp(dt, 0, 0.05);
    const { rig } = this;
    this.time += dt;
    this.cur.t += dt * (this.cur.ctx.tempo || 1);
    if (this.prev) this.prev.t += dt * (this.prev.ctx.tempo || 1);
    this.mix = Math.min(1, this.mix + dt / 0.45);
    const w = ease(this.mix);

    const Pb = this.evaluate(this.cur);
    let Pa = null;
    if (this.prev && w < 1) Pa = this.evaluate(this.prev);
    else this.prev = null;
    // les mains accrochées se résolvent avec la pose de l'image précédente (décalage invisible)
    for (const Q of [Pa, Pb]) if (Q) for (const s of ['R', 'L']) this.anchorTarget(Q, s);
    const P = Pa ? blend(Pa, Pb, w) : Pb;
    P.squash += Math.sin(this.time * 2.3) * 0.008; // il respire

    // corps
    rig.root.position.set(P.rootX, P.rootY, 0);
    rig.root.rotation.set(0, P.turn, P.lean);
    rig.torso.rotation.set(P.bend, P.twist, P.side);
    rig.torso.scale.set(1 - P.squash * 0.6, 1 + P.squash, 1 - P.squash * 0.6);
    rig.neck.rotation.set(P.headX * 0.4, P.headY * 0.3, P.headZ * 0.3);
    rig.head.rotation.set(P.headX * 0.6, P.headY * 0.7, P.headZ * 0.7);
    rig.legs.R.hip.rotation.x = P.legR;
    rig.legs.L.hip.rotation.x = P.legL;
    rig.legs.R.ankle.rotation.x = P.toeR - P.legR * 0.6;
    rig.legs.L.ankle.rotation.x = P.toeL - P.legL * 0.6;
    rig.root.updateMatrixWorld(true);

    // la brosse : la patte se place au bout du manche, les poils contre les dents
    if (P.brush > 0.01) {
      const contact = rig.torso.worldToLocal(rig.head.localToWorld(_v.copy(P.contact)));
      P.handR.lerp(contact.addScaledVector(P.handle, 0.43), P.brush);
    }
    reach(rig.arms.R, P.handR, P.poleR);
    reach(rig.arms.L, P.handL, P.poleL);
    rig.root.updateMatrixWorld(true);
    for (const s of ['R', 'L']) rig.torso.worldToLocal(rig.arms[s].hand.getWorldPosition(this.paws[s]));

    this.brush.visible = P.brush > 0.5;
    if (this.brush.visible) {
      const grip = this.paws.R;
      const tipT = rig.torso.worldToLocal(rig.head.localToWorld(_v.copy(P.contact)));
      _x.subVectors(tipT, grip).normalize(); // manche : de la patte vers les dents
      // les poils regardent la bouche : vers l'arrière de la tête, dans le repère du buste
      _z.set(0, 0, -1).transformDirection(rig.head.matrixWorld).transformDirection(_m.copy(rig.torso.matrixWorld).invert());
      _z.addScaledVector(_x, -_z.dot(_x)).normalize();
      _y.crossVectors(_z, _x);
      _m.makeBasis(_x, _y, _z);
      this.brush.quaternion.setFromRotationMatrix(_m);
      this.brush.position.copy(tipT).addScaledVector(_x, -0.4).addScaledVector(_z, -0.04);
    }
    // les bulles de dentifrice naissent au coin de la bouche, du côté de la brosse
    const fs = Math.sign(P.contact.x || 1);
    this.foam.update(dt, P.foam, P.foam > 0 ? _v.set(fs * 0.085, P.contact.y, 0.6) : null, fs);

    this.placeProps(P, dt);
    this.emitFx(Pb, w, dt);
    this.fx.update(dt);

    // accessoires du jour cachés par une tâche (bonnet de bain, lunettes de lecture…)
    for (const slot of SLOTS) {
      const h = P.hide[slot] > 0.5;
      if (h !== Boolean(this.hidden[slot])) {
        this.hidden[slot] = h;
        this.wear.hideSlot(slot, h);
      }
    }
    if (P.tuftScale > 1.01) rig.tuft.visible = true;
    else if (!this.hidden.tete) rig.tuft.visible = !this.wear.worn.some((x) => x.a.hideTuft);

    // visage : clignements au hasard (parfois deux de suite)
    const b = this.blink;
    b.next -= dt;
    if (b.next <= 0 && b.t < 0) {
      b.t = 0;
      b.next = 2 + Math.random() * 3.5;
      if (Math.random() < 0.2) b.next = 0.35;
    }
    let blink = 0;
    if (b.t >= 0) {
      b.t += dt;
      blink = Math.sin(clamp(b.t / 0.17, 0, 1) * Math.PI);
      if (b.t > 0.17) b.t = -1;
    }
    applyFace(rig, P.face, blink);

    // oreilles et mèche : ressorts entraînés par les mouvements de la tête et les sauts
    const inv = dt > 1e-5 ? 1 / dt : 0; // image figée : pas de ressort
    const hv = (P.headZ - this.prevHead[2]) * inv, hx = (P.headX - this.prevHead[0]) * inv;
    const yv = (P.rootY - this.prevRootY) * inv;
    const ya = (yv - this.rootV) * inv;
    if (inv) this.rootV = yv;
    this.prevHead = [P.headX, P.headY, P.headZ];
    this.prevRootY = P.rootY;
    for (const e of rig.ears) {
      const target = clamp(-hv * 0.05 * e.sx + ya * 0.004, -0.6, 0.6);
      e.v += (220 * (target - e.a) - 11 * e.v) * dt;
      e.a += e.v * dt;
      e.pivot.rotation.z = -0.55 * e.sx - e.a * e.sx * 0.6;
      e.pivot.rotation.x = -e.a * 0.3 - hx * 0.02;
    }
    const tf = rig.tuft, td = tf.userData;
    td.v += (260 * (clamp(-hv * 0.06 + ya * 0.006, -0.8, 0.8) - td.a) - 8 * td.v) * dt;
    td.a += td.v * dt;
    // un coup de peigne l'aplatit ; dès qu'on la lâche, elle se redresse (le ressort fait « boing »)
    if ((td.flat || 0) > P.tuftFlat + 0.3) td.v -= 30;
    td.flat = P.tuftFlat;
    tf.rotation.set(td.a * 0.5 - P.tuftFlat * 1.3, 0, td.a);
    tf.scale.setScalar(P.tuftScale);

    this.wear.update(dt, P.energy);
    if (Pb.cue && Pb.cue !== this.lastCue) this.onCue?.(Pb.cue);
    this.lastCue = Pb.cue;
    if (camera) updateOcclusion(rig, camera);
    this.pose = P;
  }

  // Les objets des numéros : créés à la première utilisation, puis posés à chaque image
  placeProps(P, dt) {
    const rig = this.rig;
    const used = new Set();
    for (const [name, spec] of Object.entries(P.props)) {
      const key = `${name}|${spec.variant || ''}|${spec.color || ''}|${spec.emoji || ''}`;
      let obj = this.props.get(key);
      if (!obj) {
        obj = makeProp(spec.model || name, rig.occ, spec);
        if (!obj) continue;
        this.props.set(key, obj);
      }
      used.add(key);
      const at = spec.at || 'torso';
      const hand = at === 'R' || at === 'L';
      const parent = at === 'head' ? rig.head : at === 'ground' ? this.ground : at.startsWith('ankle') ? rig.legs[at.slice(-1)].ankle : rig.torso;
      if (obj.parent !== parent) parent.add(obj);
      if (hand) obj.position.copy(this.paws[at]).add(_w.set(...(spec.pos || [0, 0, 0])));
      else obj.position.set(...(spec.pos || [0, 0, 0]));
      if (spec.aim) {
        // l'axe +x de l'objet pointe vers la cible, le haut reste en haut
        _x.subVectors(spec.aim, obj.position).normalize();
        _z.crossVectors(_x, UP).normalize();
        _y.crossVectors(_z, _x);
        obj.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
      } else obj.rotation.set(...(spec.rot || [0, 0, 0]));
      const s = clamp(spec.s ?? 1, 0, 1);
      const sc = spec.scale || [1, 1, 1];
      obj.scale.set(sc[0] * s, sc[1] * s, sc[2] * s);
      obj.visible = s > 0.02;
      obj.userData.update?.(dt, spec, this.time);
    }
    for (const [key, obj] of this.props) if (!used.has(key)) obj.visible = false;
  }

  // Effets demandés par le numéro en cours (débit par seconde)
  emitFx(P, w, dt) {
    const rig = this.rig;
    P.emit.forEach((e, i) => {
      const id = `${e.kind}${e.ch || ''}${i}`;
      let acc = (this.emitAcc.has(id) ? this.emitAcc.get(id) : Math.random()) + dt * e.rate * w;
      while (acc >= 1) {
        acc -= 1;
        const sp = e.spread || 0.25;
        _v.set(...(Array.isArray(e.at) ? e.at : e.at.toArray()));
        _v.x += (Math.random() - 0.5) * sp;
        _v.y += (Math.random() - 0.5) * sp * 0.4;
        if (e.space === 'ground') this.ground.localToWorld(_v);
        else rig.torso.localToWorld(_v);
        if (e.kind === 'bulle') this.fx.bubble(_v);
        else this.fx.emoji(_v, e.ch, { size: e.size, v: e.v ? _w.set(...e.v) : undefined });
      }
      this.emitAcc.set(id, acc);
    });
  }
}

function blend(a, b, w) {
  const P = basePose();
  for (const k of NUM) P[k] = lerp(a[k], b[k], w);
  for (const k of VEC) P[k].lerpVectors(a[k], b[k], w);
  for (const k in P.face) P.face[k] = lerp(a.face[k], b.face[k], w);
  for (const k of SLOTS) P.hide[k] = lerp(a.hide[k], b.hide[k], w);
  // les objets de l'ancien numéro rapetissent, ceux du nouveau grandissent
  for (const [n, s] of Object.entries(a.props)) P.props[n] = { ...s, s: (s.s ?? 1) * (1 - w) };
  for (const [n, s] of Object.entries(b.props)) P.props[n] = a.props[n] ? { ...s, s: Math.max((s.s ?? 1) * w, (a.props[n].s ?? 1) * (1 - w)) } : { ...s, s: (s.s ?? 1) * w };
  P.emit = b.emit;
  P.cue = b.cue;
  return P;
}
