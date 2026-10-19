import * as THREE from 'three';
import { box } from '../world.js';
import { signTexture, stripeTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';

const $ = (id) => document.getElementById(id);
const WORKER_YAW = Math.PI + 0.5; // 작업자(내 캐릭터)가 벨트 쪽을 보는 방향
const BELT_Z = -1, BELT_Y = 0.62, BELT_X0 = -7, BELT_X1 = 6.6; // 컨베이어 (왼쪽 → 오른쪽)
const HOLD_Y = 1.5;                                              // 집은 부품이 떠 있는 높이
const PARTS = [
  { k: 'gear', name: '톱니', c: '#e8413a' },
  { k: 'chip', name: '칩', c: '#2f7fd8' },
  { k: 'battery', name: '배터리', c: '#ffd23f' },
  { k: 'screw', name: '나사', c: '#5fc04a' },
];
const BIN_X = [-3.3, -1.1, 1.1, 3.3], BIN_Z = 2.3;
const PICK_NDC = 0.16; // 이만큼(화면 높이의 약 8%) 안에 있는 부품은 집힘 // 상자 (부품 순서대로)
const SCREW_AT = 15; // 이 초부터 초록 나사도 나옴

// 부품 모양 (가운데 기준)
function makePart(p) {
  const g = new THREE.Group();
  if (p.k === 'gear') {
    box(0.5, 0.16, 0.5, p.c, 0, 0, 0, g);
    for (let i = 0; i < 4; i++) { const t = box(0.68, 0.12, 0.14, p.c, 0, 0, 0, g); t.rotation.y = (i / 4) * Math.PI; }
    box(0.16, 0.18, 0.16, '#7a1f1a', 0, 0.01, 0, g);
  } else if (p.k === 'chip') {
    box(0.56, 0.1, 0.42, p.c, 0, 0, 0, g); box(0.3, 0.12, 0.22, '#1a2a4a', 0, 0.02, 0, g);
    for (let i = 0; i < 4; i++) for (const z of [-0.25, 0.25]) box(0.05, 0.05, 0.1, '#e3e6ea', -0.2 + i * 0.13, -0.02, z, g);
  } else if (p.k === 'battery') {
    box(0.3, 0.3, 0.56, p.c, 0, 0.05, 0, g); box(0.31, 0.31, 0.12, '#2a2a2e', 0, 0.05, -0.24, g); box(0.12, 0.1, 0.06, '#c9ced6', 0, 0.05, 0.31, g);
  } else {
    box(0.14, 0.14, 0.5, p.c, 0, 0, 0, g); box(0.32, 0.18, 0.12, p.c, 0, 0, -0.27, g);
    for (let i = 0; i < 3; i++) box(0.17, 0.17, 0.03, '#3f8a2a', 0, 0, -0.1 + i * 0.12, g);
  }
  g.scale.setScalar(1.45); // 화면에서 잘 보이게 크게
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// 완성된 작은 로봇 (선반 장식)
function makeRobot(i) {
  const g = new THREE.Group(), c = ['#c9ced6', '#f2b05a', '#7fc8f0', '#a5e07f'][i % 4];
  box(0.36, 0.34, 0.26, c, 0, 0.27, 0, g); box(0.28, 0.24, 0.24, c, 0, 0.58, 0, g);
  for (const x of [-0.07, 0.07]) box(0.06, 0.06, 0.02, '#2a2a2e', x, 0.6, 0.13, g);
  box(0.03, 0.12, 0.03, '#888', 0, 0.76, 0, g); box(0.07, 0.07, 0.07, '#e8413a', 0, 0.84, 0, g);
  for (const x of [-0.1, 0.1]) box(0.1, 0.1, 0.12, '#555b66', x, 0.05, 0, g);
  return g;
}

// 가산 로봇 공장: 컨베이어로 오는 부품을 같은 색 상자에 넣기
export class FactoryGame extends MiniGame {
  static meta = {
    id: 'factory', title: '가산 로봇 공장', duration: 60, hearts: 3, resultTitle: '오늘 작업 끝!', fov: 42, sky: '#cfd8e0',
    hint: '부품을 클릭해서 집고 → 같은 색 상자 위에서 클릭(또는 끌어다 놓기) · 숫자 1~4 = 맨 앞 부품을 그 상자로 — 끝까지 가면 하트가 줄어요',
  };

  build() {
    this.camCtl = new CamControl(this, { hint: '✋ 손을 움직여 부품 위로 → 엄지·검지를 붙여 집기(또는 주먹) → 같은 색 상자 위에서 손을 펴기' });
    const s = this.scene;
    this.lights({ pos: [-4, 12, 8], size: 10 });
    // 공장 바닥 + 뒷벽 + 경고 줄무늬
    box(18, 0.1, 10, '#9aa0a8', 0, -0.05, 0, s).receiveShadow = true;
    box(18, 5, 0.3, '#d6dce2', 0, 2.5, -4, s);
    for (let i = 0; i < 6; i++) box(1.8, 0.9, 0.05, '#8fb9d6', -6.5 + i * 2.6, 3.2, -3.83, s); // 창문
    const stripe = new THREE.MeshLambertMaterial({ map: stripeTexture('#ffd23f', '#2a2a2e') }); stripe.map.repeat.set(18, 1);
    const st = new THREE.Mesh(new THREE.BoxGeometry(16, 0.02, 0.3), stripe); st.position.set(0, 0.01, 1.2); s.add(st);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.06), new THREE.MeshLambertMaterial({ map: signTexture('G밸리 로봇 공장', { w: 128, h: 18, size: 12, bg: '#2f6fd8', fg: '#ffffff' }) }));
    sign.position.set(0, 4.3, -3.82); s.add(sign);
    // 컨베이어 벨트 (줄무늬가 흘러감)
    const beltMat = new THREE.MeshLambertMaterial({ map: stripeTexture('#3a3f4a', '#4a505c') }); beltMat.map.repeat.set(28, 1); this.beltTex = beltMat.map;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(BELT_X1 - BELT_X0 + 0.6, 0.12, 1.1), beltMat);
    belt.position.set((BELT_X0 + BELT_X1) / 2, BELT_Y - 0.06, BELT_Z); belt.receiveShadow = true; s.add(belt);
    box(BELT_X1 - BELT_X0 + 0.7, 0.5, 1.2, '#6b7280', (BELT_X0 + BELT_X1) / 2, 0.25, BELT_Z, s);
    for (const z of [BELT_Z - 0.6, BELT_Z + 0.6]) box(BELT_X1 - BELT_X0 + 0.7, 0.1, 0.06, '#ffd23f', (BELT_X0 + BELT_X1) / 2, BELT_Y + 0.02, z, s);
    // 부품이 나오는 기계 (왼쪽) + 끝의 폐기함 (오른쪽)
    box(1.2, 1.6, 1.6, '#5f92bd', BELT_X0 - 0.4, 0.8, BELT_Z, s); box(0.8, 0.5, 0.05, '#1a1420', BELT_X0 + 0.21, 0.95, BELT_Z, s).rotation.y = Math.PI / 2;
    box(1.0, 0.5, 1.4, '#8a3a2a', BELT_X1 + 0.9, 0.25, BELT_Z, s);
    // 로봇 팔 장식
    const arm = new THREE.Group(); arm.position.set(5.0, 0, -2.6); s.add(arm);
    box(0.6, 0.4, 0.6, '#f28c28', 0, 0.2, 0, arm); this.armJoint = new THREE.Group(); this.armJoint.position.y = 0.4; arm.add(this.armJoint);
    box(0.22, 1.5, 0.22, '#f28c28', 0, 0.75, 0, this.armJoint); box(1.1, 0.2, 0.2, '#f28c28', 0.45, 1.5, 0, this.armJoint); box(0.2, 0.3, 0.3, '#3a3f4a', 1.0, 1.35, 0, this.armJoint);
    // 상자 4개 (부품 색 + 이름표)
    this.bins = PARTS.map((p, i) => {
      const g = new THREE.Group(); g.position.set(BIN_X[i], 0, BIN_Z); s.add(g);
      box(1.5, 0.12, 1.2, p.c, 0, 0.06, 0, g);
      for (const [w, d, x, z] of [[1.5, 0.1, 0, 0.55], [1.5, 0.1, 0, -0.55], [0.1, 1.2, 0.7, 0], [0.1, 1.2, -0.7, 0]]) box(w, 0.6, d, p.c, x, 0.36, z, g);
      box(1.3, 0.04, 1.0, '#2a2a2e', 0, 0.13, 0, g);
      const lab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.04), new THREE.MeshBasicMaterial({ map: signTexture(`${i + 1} ${p.name}`, { w: 84, h: 22, size: 12, bg: '#fff8e6' }) }));
      lab.position.set(0, 0.55, 0.66); lab.rotation.x = -0.7; g.add(lab); // 카메라 쪽으로 기울임
      g.visible = i < 3; // 나사 상자는 나중에
      return g;
    });
    // 완성 로봇 진열대 (벨트 뒤)
    box(8.4, 0.5, 0.7, '#a0703a', -1.2, 0.25, -2.65, s);
    this.robots = [];
    // 손 커서 (손으로 할 때)
    this.cursor = new THREE.Group(); s.add(this.cursor);
    const cm = new THREE.MeshBasicMaterial({ color: '#ffe0b8' });
    box(0.36, 0.08, 0.32, cm, 0, 0, 0, this.cursor);
    this.fingers = [];
    for (let i = 0; i < 4; i++) this.fingers.push(box(0.07, 0.07, 0.24, cm, -0.13 + i * 0.087, 0, -0.26, this.cursor));
    this.thumb = box(0.08, 0.07, 0.2, cm, 0.22, 0, -0.08, this.cursor);
    this.cursor.visible = false;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y);
    this.parts = []; this.flying = [];
    this.camera.position.set(0, 7.6, 7.6);
    this.camera.lookAt(0, 0.4, -0.1);
  }

  onAvatar() { this.player.position.set(5.15, 0, 1.3); this.player.rotation.y = WORKER_YAW; } // 오른쪽 아래 빈 자리에서 벨트를 봄 (부품이 나오는 곳을 가리지 않게)

  reset() {
    for (const p of [...this.parts, ...this.flying]) this.scene.remove(p.m);
    for (const r of this.robots) this.scene.remove(r);
    this.parts = []; this.flying = []; this.robots = [];
    this.held = null; this.pinching = false; this.mouse = null;
    this.elapsed = 0; this.spawnT = 0.4; this.sorted = 0; this.wrong = 0; this.missed = 0; this.built = 0;
    this.bins.forEach((b, i) => (b.visible = i < 3));
  }

  spawn() {
    const kinds = this.elapsed > SCREW_AT ? 4 : 3;
    if (kinds === 4 && !this.bins[3].visible) { this.bins[3].visible = true; this.float(new THREE.Vector3(BIN_X[3], 1.4, BIN_Z), '나사 상자 추가!', 'gold'); }
    const p = PARTS[(Math.random() * kinds) | 0];
    const m = makePart(p);
    m.position.set(BELT_X0 + 0.3, BELT_Y + 0.1, BELT_Z + (Math.random() - 0.5) * 0.4);
    m.rotation.y = Math.random() * Math.PI;
    this.scene.add(m);
    this.parts.push({ p, m });
  }

  // ---------- 입력 (마우스·키보드) ----------
  // 화면에서 보이는 거리로 가장 가까운 부품 (높이 차이 때문에 바닥 좌표로 재면 어긋나서, 화면 좌표로 넉넉하게)
  pickScreen(pos, maxD = PICK_NDC) {
    const c = pos.clone().project(this.camera), asp = this.camera.aspect;
    let best = null, bd = maxD;
    for (const it of this.parts) {
      if (it.falling) continue;
      const q = it.m.position.clone().project(this.camera), d = Math.hypot((q.x - c.x) * asp, q.y - c.y);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  grab(it) {
    if (!it || this.held) return;
    this.held = it; this.parts.splice(this.parts.indexOf(it), 1);
    sfx.click();
  }
  // 화면에서 같은 자리로 보이는 상자 높이의 점 (위에서 비스듬히 보므로 떠 있는 높이와 바닥 위치가 어긋남)
  toLow(x, z) {
    const c = this.camera.position, k = (c.y - 0.45) / (c.y - HOLD_Y);
    return [c.x + (x - c.x) * k, c.z + (z - c.z) * k];
  }
  binAt(x, z) { return this.bins.findIndex((b, i) => b.visible && Math.abs(x - BIN_X[i]) < 0.9 && Math.abs(z - BIN_Z) < 0.8); }
  drop(x, z) {
    const it = this.held; if (!it) return;
    this.held = null;
    const bi = this.binAt(...this.toLow(x, z));
    if (bi >= 0) { this.fly(it, bi); return; }
    // 상자 밖이면 벨트 위로 되돌려 놓기
    it.m.position.set(THREE.MathUtils.clamp(x, BELT_X0 + 0.3, BELT_X1 - 0.3), BELT_Y + 0.1, BELT_Z);
    this.parts.push(it);
  }
  fly(it, bi) { this.flying.push({ ...it, from: it.m.position.clone(), bi, t: 0 }); }
  judge(it, bi) {
    this.scene.remove(it.m);
    const pos = new THREE.Vector3(BIN_X[bi], 1.4, BIN_Z);
    if (PARTS[bi].k === it.p.k) {
      this.sorted++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 10 + Math.min(this.combo, 10);
      this.score += pts; sfx.catch(this.combo); this.float(pos, `+${pts}`, 'gold');
      if (this.sorted % 5 === 0) this.buildRobot();
    } else { this.wrong++; this.hurt(pos, `${it.p.name}는 ${it.p.name} 상자에!`); }
  }
  buildRobot() {
    const r = makeRobot(this.built); this.built++;
    r.position.set(-5.0 + ((this.built - 1) % 11) * 0.75, 0.5, -2.65); r.scale.setScalar(1.3); this.scene.add(r); this.robots.push(r);
    this.score += 20; sfx.gold();
    this.float(new THREE.Vector3(r.position.x, 2.0, -2.6), '로봇 완성! +20', 'gold');
  }
  planePoint(e, w, h) {
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, p) ? p : null;
  }
  pointer(e, w, h) { if (this.state === 'play') this.mouse = this.planePoint(e, w, h); }
  pointerDown(e, w, h) {
    if (this.state !== 'play') return;
    const p = this.planePoint(e, w, h); if (!p) return;
    this.mouse = p;
    if (this.held) { this.drop(p.x, p.z); return; } // 클릭-클릭 방식
    // 부품 클릭: 화면에서 부품을 직접 맞히거나, 바닥 높이에서 가장 가까운 것
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const hit = this.ray.intersectObjects(this.parts.filter((q) => !q.falling).map((q) => q.m), true)[0];
    let it = null;
    if (hit) { let o = hit.object; while (o.parent && !this.parts.some((q) => q.m === o)) o = o.parent; it = this.parts.find((q) => q.m === o); }
    if (!it) { const g = new THREE.Vector3(); if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -BELT_Y), g)) it = this.pickScreen(g); }
    if (it) { this.grab(it); this.downAt = performance.now(); this.downPos = p.clone(); }
  }
  pointerUp(e, w, h) {
    // 끌어다 놓기: 집은 뒤 조금이라도 끌었으면 놓은 곳에 떨어뜨림
    if (!this.held || this.state !== 'play' || !this.downPos) return;
    const p = this.planePoint(e, w, h);
    if (p && (p.distanceTo(this.downPos) > 0.6 || performance.now() - this.downAt > 350)) this.drop(p.x, p.z);
    this.downPos = null;
  }
  keyDown(code) {
    const m = /^(Digit|Numpad)([1-4])$/.exec(code);
    if (!m || this.state !== 'play') return;
    const bi = +m[2] - 1;
    if (!this.bins[bi].visible) return;
    if (this.held) { const it = this.held; this.held = null; this.fly(it, bi); return; }
    // 맨 앞(오른쪽 끝에 가장 가까운) 부품을 그 상자로
    const front = this.parts.filter((q) => !q.falling).sort((a, b) => b.m.position.x - a.m.position.x)[0];
    if (front) { this.parts.splice(this.parts.indexOf(front), 1); this.fly(front, bi); }
  }

  // ---------- 손으로 하기 ----------
  handStep() {
    const cam = this.camCtl.on && this.camCtl.hands;
    this.cursor.visible = !!cam && cam.fresh.length > 0;
    if (!this.cursor.visible) return;
    const hc = cam.center(), h = cam.fresh[0];
    const x = THREE.MathUtils.clamp((hc.x - 0.5) / 0.32, -1, 1) * 5.8;
    // 손 높이: 카메라 화면 40% 높이 = 벨트, 70% = 상자 줄 (손을 너무 높이 들지 않아도 벨트에 닿게)
    const z = THREE.MathUtils.clamp(BELT_Z + ((hc.y - 0.4) / 0.3) * (BIN_Z - BELT_Z), -2.2, 3.2);
    this.cursor.position.set(x, HOLD_Y + 0.25, z);
    // 집기: 엄지 끝(4)과 검지 끝(8)이 가까우면 (손바닥 크기 기준, 붙을 때/뗄 때 기준을 달리 해서 깜빡임 방지) · 주먹도 OK
    const d = Math.hypot(h.lm[4].x - h.lm[8].x, h.lm[4].y - h.lm[8].y) / Math.max(h.size, 0.01);
    const was = this.pinching;
    this.pinching = h.shape === 'fist' || (was ? d < 0.5 : d < 0.35);
    for (const f of this.fingers) f.position.z = this.pinching ? -0.14 : -0.26;
    this.thumb.position.x = this.pinching ? 0.14 : 0.22;
    cam.label = this.held ? `✊ ${this.held.p.name} 들고 있음` : this.pinching ? '🤏 집는 중' : '✋ 부품 위에서 집어요';
    // 집은 채로 부품 위에 오면 바로 집힘 (집는 순간에만 확인하면, 먼저 집고 움직이는 사람은 못 집음)
    // 화면에 보이는 손 커서 자리, 또는 커서 바로 아래 벨트 자리 — 둘 중 하나에 부품이 있으면 집힘
    if (this.pinching && !this.held) this.grab(this.pickScreen(this.cursor.position) || this.pickScreen(new THREE.Vector3(x, BELT_Y + 0.1, z)));
    if (!this.pinching && was && this.held) this.drop(x, z);
    if (this.held) this.mouse = new THREE.Vector3(x, HOLD_Y, z);
  }

  idle(dt, t) {
    this.avatar.animate(dt, t, { yaw: WORKER_YAW, wave: this.state === 'done' });
    this.armJoint.rotation.y = Math.sin(t * 0.8) * 0.6;
  }

  step(dt, t) {
    this.elapsed += dt;
    const speed = 1.5 + this.elapsed * 0.035;
    this.beltTex.offset.x = (this.beltTex.offset.x - speed * dt * 1.0) % 1;
    this.armJoint.rotation.y = Math.sin(t * 1.6) * 0.8;
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = Math.max(0.75, 1.9 - this.elapsed * 0.022); }
    this.handStep();
    // 벨트 위 부품
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const it = this.parts[i], m = it.m;
      if (it.falling) { it.vy -= 14 * dt; m.position.y += it.vy * dt; m.position.x += 1.2 * dt; m.rotation.z += dt * 6; if (m.position.y < -0.6) { this.scene.remove(m); this.parts.splice(i, 1); } continue; }
      m.position.x += speed * dt;
      if (m.position.x > BELT_X1) { // 끝까지 감: 폐기함으로 떨어짐
        it.falling = true; it.vy = 1.5; this.missed++;
        this.hurt(new THREE.Vector3(BELT_X1, 1.6, BELT_Z), '놓쳤어요!');
      }
    }
    // 집은 부품은 마우스(손)를 따라감
    if (this.held && this.mouse) { const m = this.held.m; m.position.lerp(new THREE.Vector3(this.mouse.x, HOLD_Y, this.mouse.z), Math.min(1, dt * 20)); m.rotation.y += dt * 3; }
    // 상자로 날아가는 부품
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]; f.t += dt / 0.28;
      const k = Math.min(1, f.t), to = new THREE.Vector3(BIN_X[f.bi], 0.3, BIN_Z);
      f.m.position.lerpVectors(f.from, to, k); f.m.position.y += Math.sin(k * Math.PI) * 0.8;
      if (k >= 1) { this.flying.splice(i, 1); this.judge(f, f.bi); }
    }
    this.avatar.animate(dt, t, { yaw: WORKER_YAW });
  }

  resultTitle() { return this.hearts > 0 ? '오늘 작업 끝! 수고했어요' : '공장 라인이 멈췄어요…'; }
  extraText() { return `분류 ${this.sorted || 0} · 로봇 ${this.built || 0}대`; }
  resultRows() { return [['정확히 분류', `${this.sorted}개`], ['완성한 로봇', `${this.built}대 (×20)`], ['잘못 넣음 / 놓침', `${this.wrong} / ${this.missed}`], ['최대 콤보', `${this.maxCombo}`]]; }
}
