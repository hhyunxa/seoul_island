import * as THREE from 'three';
import { toonMat, basic, blobShadow } from './toon.js';

// ============================================================
//  서울섬 캐릭터: 동글동글한 사람·동물 주민
//  관절 자리는 미니게임이 소품(낚싯대·망치·지휘봉 등)을 붙이는 자리와 같게 맞춤
//  단위 "칸": 전체 키 22칸 (다리 0~5, 몸 5~12, 머리 12~22). 실제 크기 = 칸 × s (s = 키 / 22)
// ============================================================
export const MODEL_HEIGHT = 22;
export const PART_KEYS = ['head', 'body', 'armL', 'armR', 'legL', 'legR'];

// ---------- 생김새 (look) ----------
export const TYPES = [
  { id: 'human', label: '사람' }, { id: 'bunny', label: '토끼' }, { id: 'cat', label: '고양이' }, { id: 'bear', label: '곰' },
  { id: 'dog', label: '강아지' }, { id: 'squirrel', label: '다람쥐' }, { id: 'sheep', label: '양' }, { id: 'deer', label: '사슴' },
];
export const SKIN_TONES = ['#ffdcbf', '#f6cba6', '#e8b48a', '#d9a273'];
export const HAIR_COLORS = ['#6b4226', '#3b2416', '#c98a46', '#f2d38a', '#e8735a', '#8a6bc7'];
export const FUR_COLORS = ['#ffffff', '#f0d2a8', '#c98a4b', '#9b6b43', '#a7b0c2', '#f0a040'];
export const CLOTH_COLORS = ['#7bc8f6', '#ff8fa3', '#ffd166', '#7fcb98', '#c3a6ff', '#ffffff', '#ff9f43', '#4a6fa5'];

export function defaultLook() {
  return { type: 'human', skin: '#ffdcbf', hair: '#6b4226', fur: '#ffffff', shirt: '#7bc8f6', pants: '#4a6fa5', ribbon: '#ff8fa3', hat: true };
}
export function validLook(l) { return !!l && typeof l === 'object' && TYPES.some((t) => t.id === l.type) && typeof l.shirt === 'string'; }

// 미니게임 속 사람들 (팀원·상대·관중)
const ACC = { bunny: '#ffd6e0', cat: '#ffffff', bear: '#e6c8a0', dog: '#9a6a43', squirrel: '#f6e2c4', sheep: '#ffffff', deer: '#f6e6cf' };
export function npcLook({ shirt = '#f7f3ea', pants = '#3a3f4a', hair = '#3b2416', shoe = '#7a5a43', skin = '#f2c29b', number = null, type = 'human', fur, accent } = {}) {
  return { type, shirt, pants, hair, shoe, skin, number, fur: fur || skin, accent: accent || ACC[type] || '#ffffff', hat: false };
}

// ---------- 공용 지오메트리 ----------
const GC = {};
const sph = (w = 16, h = 12) => (GC[`s${w}`] ||= new THREE.SphereGeometry(1, w, h));
const cyl = (t, b, seg = 12) => (GC[`c${t}_${b}_${seg}`] ||= new THREE.CylinderGeometry(t, b, 1, seg));
const cone = (seg = 10) => (GC[`k${seg}`] ||= new THREE.ConeGeometry(1, 1, seg));
const capSph = () => (GC.cap ||= new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55));
const blushM = () => (GC.blush ||= basic({ color: '#ff8fa3', transparent: true, opacity: 0.55 }));

// ============================================================
//  Avatar
// ============================================================
export class Avatar {
  constructor(look, { height = 1.7 } = {}) {
    look = validLook(look) ? look : defaultLook();
    this.look = look;
    const s = (this.s = height / MODEL_HEIGHT);
    this.root = new THREE.Group();
    this.torso = new THREE.Group();
    this.root.add(this.torso);
    this.joints = {}; this.meshes = [];
    const fur = look.type === 'human' ? look.skin : (look.fur || '#ffffff');
    const M = (c) => toonMat(c);
    const add = (parent, geo, mat, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x * s, y * s, z * s); m.scale.set(sx * s, (sy ?? sx) * s, (sz ?? sx) * s);
      parent.add(m); this.meshes.push(m);
      return m;
    };
    const joint = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x * s, y * s, z * s); parent.add(g); this.joints[name] = g; return g; };

    // 다리 (발은 갈색 구두)
    const shoe = look.shoe || '#7a5a43';
    for (const [name, sx] of [['legL', -1], ['legR', 1]]) {
      const j = joint(name, this.root, sx * 1.9, 5, 0);
      add(j, cyl(0.85, 0.75), M(look.pants || fur), 0, -2.4, 0, 1.8, 4.6, 1.8);
      add(j, sph(10, 8), M(shoe), 0, -4.7, 0.5, 1.9, 1.1, 2.5);
    }
    // 몸 (위가 살짝 좁은 원통)
    const body = joint('body', this.torso, 0, 5, 0);
    add(body, cyl(0.78, 1, 16), M(look.shirt), 0, 3.6, 0, 4.4, 7.6, 3.9);
    add(body, sph(14, 8), M(look.shirt), 0, 0.2, 0, 4.4, 1.6, 3.9);
    if (look.number) add(body, cyl(1, 1, 10), M(look.number), 0, 4.2, -3.55, 1.4, 0.2, 1.4).rotation.x = Math.PI / 2;
    // 팔 (어깨에서 아래로, 손은 피부색 동그라미)
    for (const [name, sx] of [['armL', -1], ['armR', 1]]) {
      const j = joint(name, this.torso, sx * 4.7, 11.6, 0);
      add(j, cyl(0.9, 1), M(look.shirt), 0, -2.6, 0, 1.25, 5.4, 1.25);
      add(j, sph(10, 8), M(fur), 0, -5.7, 0, 1.35);
    }
    // 머리
    const head = joint('head', this.torso, 0, 12, 0);
    const hc = 5.0; // 머리 중심 높이 (관절 기준)
    add(head, sph(22, 16), M(fur), 0, hc, 0, 5.2, 4.95, 4.95);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = add(head, sph(10, 8), M('#2b1d14'), sx * 1.7, hc + 0.35, 4.5, 0.72, 0.98, 0.42);
      this.eyes.push(e);
      add(head, sph(6, 6), basic({ color: '#ffffff' }), sx * 1.7 + 0.22, hc + 0.75, 4.86, 0.24);
      add(head, sph(10, 8), blushM(), sx * 2.95, hc - 1.1, 3.7, 0.8, 0.45, 0.35);
    }
    add(head, sph(8, 6), M('#8a3b2b'), 0, hc - 1.65, 4.55, 0.55, 0.24, 0.2);
    this.ears = [];
    this.buildType(head, hc, look, fur, add, M, s);
    blobShadow(this.root, 5.2 * s);

    this.height = MODEL_HEIGHT * s;
    this.phase = 0; this.idleT = 0; this.blinkT = 2 + Math.random() * 3;
  }

  // 종류별 머리 장식 (원래 서울섬 critter 모양을 칸 단위로 옮김: 1유닛 ≈ 11.3칸)
  buildType(head, hc, look, fur, add, M) {
    const acc = M(look.accent || ACC[look.type] || '#ffffff');
    const t = look.type, K = 11.3;
    const at = (x, y, z) => [x * K, hc + y * K, z * K];
    if (t === 'human') {
      add(head, capSph(), M(look.hair), ...at(0, 0.02, -0.02), 0.49 * K * 1.06, 0.49 * K, 0.49 * K);
      add(head, sph(18, 14), M(look.hair), ...at(0, -0.04, -0.08), 0.47 * K, 0.47 * K * 0.92, 0.47 * K * 0.85);
      if (look.hat) { // 밀짚모자 + 리본 (서울섬 주인공)
        const h = new THREE.Group(); h.position.set(0, (hc + 0.02 * K) * this.s, 0); h.rotation.x = -0.12; head.add(h);
        add(h, cyl(1, 1, 28), M('#f2d38a'), 0, 0.26 * K, 0, 0.78 * K, 0.04 * K, 0.78 * K);
        add(h, cyl(0.88, 1, 20), M('#f2d38a'), 0, 0.42 * K, 0, 0.41 * K, 0.3 * K, 0.41 * K);
        add(h, cyl(1, 1, 20), M(look.ribbon || '#ff8fa3'), 0, 0.32 * K, 0, 0.415 * K, 0.08 * K, 0.415 * K);
      }
    } else if (t === 'bunny') {
      add(head, sph(8, 6), M('#ff9eb5'), ...at(0, -0.06, 0.44), 0.05 * K);
      for (const sx of [-1, 1]) {
        const ear = new THREE.Group(); ear.position.set(sx * 0.16 * K * this.s, (hc + 0.36 * K) * this.s, -0.02 * K * this.s); ear.rotation.z = -sx * 0.14; head.add(ear);
        add(ear, sph(10, 8), M(fur), 0, 0.28 * K, 0, 0.11 * K, 0.33 * K, 0.066 * K);
        add(ear, sph(8, 6), acc, 0, 0.28 * K, 0.045 * K, 0.07 * K, 0.18 * K, 0.028 * K);
        this.ears.push(ear);
      }
    } else if (t === 'squirrel' || t === 'bear' || t === 'dog' || t === 'deer') {
      add(head, sph(10, 8), acc, ...at(0, -0.1, 0.33), 0.17 * K, 0.12 * K, 0.1 * K);
      add(head, sph(8, 6), M('#3b2a20'), ...at(0, -0.05, 0.46), 0.055 * K);
      if (t === 'squirrel') {
        for (const sx of [-1, 1]) add(head, cone(8), M(fur), ...at(sx * 0.25, 0.46, 0), 0.1 * K, 0.22 * K, 0.1 * K).rotation.z = -sx * 0.3;
        const tail = new THREE.Group(); tail.position.set(0, 9 * this.s, -3.4 * this.s); this.torso.add(tail);
        [[0, 0.1, -0.1, 0.22], [0, 0.45, -0.28, 0.27], [0, 0.82, -0.18, 0.25], [0, 1.02, 0.04, 0.18]].forEach((q) => add(tail, sph(12, 10), M(fur), q[0] * K, q[1] * K, q[2] * K, q[3] * K));
        this.ears.push(tail);
      } else if (t === 'bear') {
        for (const sx of [-1, 1]) add(head, sph(10, 8), M(fur), ...at(sx * 0.3, 0.36, 0), 0.14 * K);
      } else if (t === 'dog') {
        for (const sx of [-1, 1]) { const e = add(head, sph(10, 8), acc, ...at(sx * 0.42, 0.1, 0), 0.08 * K, 0.2 * K, 0.1 * K); e.rotation.z = sx * 0.4; this.ears.push(e); }
      } else {
        for (const sx of [-1, 1]) {
          add(head, sph(8, 6), M(fur), ...at(sx * 0.4, 0.18, 0), 0.15 * K, 0.06 * K, 0.06 * K);
          add(head, cyl(0.7, 1, 6), M('#e8d3a8'), ...at(sx * 0.15, 0.52, -0.02), 0.035 * K, 0.36 * K, 0.035 * K).rotation.z = -sx * 0.3;
          add(head, cyl(0.8, 1, 6), M('#e8d3a8'), ...at(sx * 0.26, 0.62, -0.02), 0.025 * K, 0.18 * K, 0.025 * K).rotation.z = -sx * 1.0;
        }
      }
    } else if (t === 'cat') {
      add(head, sph(8, 6), M('#ff9eb5'), ...at(0, -0.06, 0.45), 0.04 * K);
      for (const sx of [-1, 1]) { const e = add(head, cone(4), M(fur), ...at(sx * 0.24, 0.44, 0), 0.13 * K, 0.26 * K, 0.13 * K); e.rotation.z = -sx * 0.25; this.ears.push(e); }
      const tail = new THREE.Group(); tail.position.set(0, 6 * this.s, -3.6 * this.s); this.torso.add(tail);
      add(tail, cyl(0.7, 1, 8), M(fur), 0, 3, -1.2, 0.9, 7, 0.9).rotation.x = -0.5;
      this.tail = tail;
    } else if (t === 'sheep') {
      [[0, 0.36, 0], [0.22, 0.3, 0.05], [-0.22, 0.3, 0.05], [0.12, 0.4, -0.18], [-0.12, 0.4, -0.18], [0.34, 0.12, -0.08], [-0.34, 0.12, -0.08], [0, 0.25, -0.3]].forEach((w) => add(head, sph(10, 8), M('#ffffff'), ...at(w[0], w[1], w[2]), 0.17 * K));
      for (const sx of [-1, 1]) { const e = add(head, sph(8, 6), M('#6b5a4e'), ...at(sx * 0.44, 0.04, 0), 0.13 * K, 0.05 * K, 0.06 * K); e.rotation.z = sx * 0.3; }
    }
  }

  refreshAll() {}
  // 재질·지오메트리는 공용이라 여기서 지우지 않음
  dispose() { this.root.parent?.remove(this.root); }

  // state: { moving, run, air, wave, yaw, armsUp, clap }
  animate(dt, t, st = {}) {
    const k = 1 - Math.exp(-dt * 14);
    const J = this.joints;
    const lerp = (obj, prop, v) => { obj[prop] += (v - obj[prop]) * k; };
    if (st.yaw !== undefined) {
      let d = st.yaw - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * (1 - Math.exp(-dt * 12));
    }
    const s = this.s;
    let legA = 0, armA = 0, bob = 0, lean = 0, headY = 0, headX = 0, headZ = 0, armZ = 0.12, armRZ = null, armRX = null;
    if (st.air) {
      legA = 0.5; armRX = -2.5;
      J.armL.rotation.x += (-2.5 - J.armL.rotation.x) * k;
      lean = -0.08;
    } else if (st.moving) {
      this.phase += dt * (st.run ? 15 : 10);
      const amp = st.run ? 0.95 : 0.7;
      legA = Math.sin(this.phase) * amp;
      armA = -Math.sin(this.phase) * amp * 0.85;
      bob = Math.abs(Math.cos(this.phase)) * (st.run ? 1.2 : 0.8) * s;
      lean = st.run ? 0.14 : 0.05;
      headX = st.run ? -0.08 : 0;
    } else {
      this.idleT += dt;
      bob = Math.sin(t * 2.4) * 0.15 * s;
      armZ = 0.12 + Math.sin(t * 2.4) * 0.03;
      headY = Math.sin(t * 0.6) * 0.25 * (Math.sin(t * 0.23) > 0 ? 1 : 0.2);
      headZ = Math.sin(t * 1.4) * 0.05;
    }
    if (st.wave) { armRZ = 2.7 + Math.sin(t * 12) * 0.35; armRX = 0; }
    if (st.armsUp) { armA = 0; armRX = 0; armZ = -2.75; armRZ = 2.75; }
    if (st.clap !== undefined) { const a = 0.15 + st.clap * 0.45; armA = -1.35; armRX = -1.35; armZ = -a; armRZ = -a; }

    lerp(J.legL.rotation, 'x', st.air ? -legA : legA);
    lerp(J.legR.rotation, 'x', st.air ? legA * 0.3 : -legA);
    if (!st.air) lerp(J.armL.rotation, 'x', armA);
    lerp(J.armR.rotation, 'x', armRX !== null ? armRX : -armA);
    lerp(J.armL.rotation, 'z', -armZ);
    lerp(J.armR.rotation, 'z', armRZ !== null ? armRZ : armZ);
    if (st.armsUp) J.armL.rotation.x = 0;
    lerp(J.head.rotation, 'y', headY);
    lerp(J.head.rotation, 'x', headX);
    lerp(J.head.rotation, 'z', headZ);
    lerp(this.torso.rotation, 'x', lean);
    this.torso.position.y += (bob - this.torso.position.y) * k;
    // 눈 깜빡 · 귀 쫑긋 · 꼬리 살랑
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.15 : 1;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = 0.98 * s * blink;
    for (const e of this.ears) e.rotation.x = Math.sin(t * 2.6 + this.s * 40) * 0.12;
    if (this.tail) this.tail.rotation.y = Math.sin(t * 3) * 0.5;
  }
}

// HUD 동그란 얼굴 그림
export function drawPortrait(look, canvas) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const fur = look.type === 'human' ? look.skin : look.fur;
  const cx = W / 2, cy = H * 0.56, r = W * 0.36;
  ctx.fillStyle = fur;
  if (look.type === 'bunny') for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * r * 0.4, cy - r * 1.1, r * 0.22, r * 0.55, sx * -0.14, 0, 7); ctx.fill(); }
  if (look.type === 'cat') for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sx * r * 0.85, cy - r * 0.45); ctx.lineTo(cx + sx * r * 0.55, cy - r * 1.15); ctx.lineTo(cx + sx * r * 0.15, cy - r * 0.8); ctx.fill(); }
  if (look.type === 'bear') for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * r * 0.65, cy - r * 0.75, r * 0.3, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  if (look.type === 'human') {
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(cx, cy - r * 0.05, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (look.hat) { ctx.fillStyle = '#f2d38a'; ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.62, r * 1.45, r * 0.22, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.85, r * 0.78, r * 0.42, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = look.ribbon; ctx.fillRect(cx - r * 0.78, cy - r * 0.8, r * 1.56, r * 0.15); }
  }
  ctx.fillStyle = '#2b1d14';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * r * 0.34, cy + r * 0.08, r * 0.12, r * 0.17, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,143,163,0.55)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * r * 0.58, cy + r * 0.36, r * 0.15, r * 0.09, 0, 0, 7); ctx.fill(); }
}
