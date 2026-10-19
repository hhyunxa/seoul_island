import * as THREE from 'three';
import { box } from '../world.js';
import { signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';

const $ = (id) => document.getElementById(id);
const SHELF_Y = 1.0;                 // 선반 윗면
const SOIL_Y = SHELF_Y + 0.55;       // 화분 흙 높이 (식물이 자라는 곳)
const CAN_Y = 3.3;                   // 물뿌리개 높이
const RX = 4.8;                      // 물뿌리개가 움직이는 범위
const N = 6, GAP = 1.8;              // 화분 수 / 간격
const GH = 1.2;                      // 물 게이지 높이
const POUR = 0.34;                   // 키보드로 부을 때 초당 차오르는 양
const DRY = 0.012;                   // 가만히 두면 초당 마르는 양
const SETTLE = 0.9;                  // 초록 칸 안에서 이만큼 기다리면 꽃이 핌 (초)
const OVER = 0.04;                   // 초록 칸보다 이만큼 넘치면 시듦
const TILT_ON = 0.44;                // 손을 이만큼(라디안, 약 25°) 기울이면 물이 나옴

// 식물 종류: 필요한 물(초록 칸 lo~hi)이 다 달라요
const PLANTS = [
  { k: 'cactus', name: '선인장', lo: 0.14, hi: 0.32, flower: '#ff7aa8' },
  { k: 'tulip', name: '튤립', lo: 0.36, hi: 0.54, flower: '#e8413a' },
  { k: 'sunflower', name: '해바라기', lo: 0.42, hi: 0.62, flower: '#ffd23f' },
  { k: 'hydrangea', name: '수국', lo: 0.64, hi: 0.84, flower: '#7f9cff' },
  { k: 'lotus', name: '연꽃', lo: 0.7, hi: 0.9, flower: '#ffc4dc' },
];
const pick = (a) => a[(Math.random() * a.length) | 0];

// 새싹 / 꽃 / 시든 모습 (흙 위 기준)
function makePlant(p) {
  const g = new THREE.Group();
  const sprout = new THREE.Group(), bloom = new THREE.Group(), wilt = new THREE.Group();
  g.add(sprout, bloom, wilt);
  if (p.k === 'cactus') {
    box(0.18, 0.36, 0.18, '#4f9a35', 0, 0.18, 0, sprout); box(0.08, 0.14, 0.08, '#4f9a35', 0.13, 0.22, 0, sprout);
    box(0.24, 0.62, 0.24, '#4f9a35', 0, 0.31, 0, bloom); box(0.1, 0.24, 0.1, '#4f9a35', 0.18, 0.36, 0, bloom); box(0.1, 0.2, 0.1, '#4f9a35', -0.18, 0.28, 0, bloom);
    box(0.2, 0.12, 0.2, p.flower, 0, 0.68, 0, bloom); box(0.08, 0.08, 0.08, '#ffe14f', 0, 0.76, 0, bloom);
  } else {
    box(0.06, 0.3, 0.06, '#5fae4a', 0, 0.15, 0, sprout);
    box(0.18, 0.05, 0.1, '#6fbf4a', -0.1, 0.24, 0, sprout); box(0.18, 0.05, 0.1, '#6fbf4a', 0.1, 0.3, 0, sprout);
    const tall = p.k === 'sunflower' ? 0.95 : p.k === 'lotus' ? 0.45 : 0.7;
    box(0.07, tall, 0.07, '#4f9a35', 0, tall / 2, 0, bloom);
    box(0.24, 0.06, 0.12, '#5fae4a', -0.14, tall * 0.4, 0, bloom); box(0.24, 0.06, 0.12, '#5fae4a', 0.14, tall * 0.6, 0, bloom);
    const fy = tall + 0.08;
    if (p.k === 'sunflower') { box(0.44, 0.44, 0.08, p.flower, 0, fy, 0.02, bloom); box(0.2, 0.2, 0.1, '#7a4a26', 0, fy, 0.04, bloom); }
    else if (p.k === 'hydrangea') { for (const [x, y] of [[-0.1, 0], [0.1, 0], [0, 0.1], [0, -0.08], [-0.06, 0.12], [0.08, 0.1]]) box(0.14, 0.14, 0.14, (x + y) > 0 ? p.flower : '#b07cff', x, fy + y, 0, bloom); }
    else if (p.k === 'lotus') { box(0.5, 0.06, 0.3, '#4f9a35', 0, 0.08, 0, bloom); for (const x of [-0.12, 0, 0.12]) box(0.12, 0.22, 0.12, x ? p.flower : '#ffffff', x, fy + (x ? 0 : 0.06), 0, bloom); }
    else { box(0.22, 0.24, 0.22, p.flower, 0, fy, 0, bloom); box(0.08, 0.1, 0.24, p.flower, 0, fy + 0.15, 0, bloom); }
  }
  // 시든 모습: 갈색으로 축 처짐
  const droop = new THREE.Group(); droop.rotation.z = 0.9; wilt.add(droop);
  box(0.06, 0.4, 0.06, '#8a6a3a', 0, 0.2, 0, droop); box(0.2, 0.05, 0.1, '#a08050', 0.1, 0.3, 0, droop); box(0.16, 0.14, 0.1, '#7a5a3a', 0, 0.42, 0, droop);
  bloom.visible = false; wilt.visible = false;
  g.traverse((o) => (o.castShadow = true));
  return { g, sprout, bloom, wilt };
}

// 서울식물원 온실: 화분마다 알맞은 만큼만 물을 줘서 꽃 피우기
export class GardenGame extends MiniGame {
  static meta = {
    id: 'garden', title: '서울식물원 물 주기', duration: 60, hearts: 3, fov: 42, sky: '#cfeef8',
    hint: '←/→ · A/D · 마우스 = 물뿌리개 옮기기 · Space / 마우스 꾹 = 물 주기 — 게이지를 초록 칸까지만! 넘치면 시들어요',
  };

  build() {
    this.camCtl = new CamControl(this, { hint: '✋ 손을 좌우로 움직여 물뿌리개 옮기기 → 손을 옆으로 기울이면 물이 나와요 (초록 칸까지만!)' });
    const s = this.scene;
    this.lights({ pos: [-4, 12, 9], size: 9 });
    // 온실 바닥 + 유리벽 (흰 창틀)
    this.tileGround(24, 12, (x, y) => (y >= 6 ? 'path' : 'grass'), 41).position.z = -1;
    const glass = new THREE.MeshBasicMaterial({ color: '#d8f2fb', transparent: true, opacity: 0.55, depthWrite: false });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 0.05), glass); wall.position.set(0, 3.5, -3.2); s.add(wall);
    for (let i = 0; i <= 8; i++) box(0.1, 7, 0.1, '#ffffff', -8 + i * 2, 3.5, -3.15, s);
    for (const y of [2.2, 4.4, 6.6]) box(16, 0.08, 0.1, '#ffffff', 0, y, -3.15, s);
    // 온실 안 큰 열대 식물들 (뒤쪽)
    // 잎이 게이지·물뿌리개보다 위에 오게 키를 크게
    for (const [x, h, c] of [[-6.8, 5.0, '#3f8a2a'], [-3.4, 5.6, '#4f9a35'], [0.2, 5.2, '#2f7a44'], [3.6, 5.8, '#4f9a35'], [6.8, 4.9, '#3f8a2a']]) {
      box(0.25, h, 0.25, '#7a5a3a', x, h / 2, -2.6, s);
      for (let a = 0; a < 5; a++) { const leaf = box(1.4, 0.08, 0.4, c, x, h, -2.6, s); leaf.rotation.y = (a / 5) * Math.PI * 2; leaf.rotation.z = -0.35; leaf.position.x += Math.cos(leaf.rotation.y) * 0.55; leaf.position.z -= Math.sin(leaf.rotation.y) * 0.55; }
    }
    // 나무 선반
    box(11.6, 0.14, 1.1, '#a0703a', 0, SHELF_Y - 0.07, 0, s);
    for (const x of [-5.6, 0, 5.6]) box(0.14, SHELF_Y - 0.14, 0.9, '#7a4a26', x, (SHELF_Y - 0.14) / 2, 0, s);
    // 화분 6개 (식물·게이지는 reset에서 채움)
    this.pots = [];
    for (let i = 0; i < N; i++) {
      const x = -((N - 1) * GAP) / 2 + i * GAP;
      const g = new THREE.Group(); g.position.set(x, 0, 0); s.add(g);
      box(0.7, 0.5, 0.6, '#c8643a', 0, SHELF_Y + 0.25, 0, g); box(0.78, 0.1, 0.66, '#d9764a', 0, SHELF_Y + 0.5, 0, g);
      box(0.62, 0.04, 0.52, '#5a3a22', 0, SOIL_Y - 0.03, 0, g);
      // 물 게이지: 틀 + 초록 칸 + 파란 물
      box(0.2, GH + 0.08, 0.08, '#3a2410', 0.6, SOIL_Y + GH / 2, 0.1, g);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.04), new THREE.MeshBasicMaterial({ color: '#6fdc4a', transparent: true, opacity: 0.75 }));
      band.position.set(0.6, 0, 0.16); g.add(band);
      const fillMat = new THREE.MeshBasicMaterial({ color: '#3fa8f0' });
      const fill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1, 0.05), fillMat); fill.position.set(0.6, 0, 0.18); g.add(fill);
      // 이름표 (선반 앞)
      const label = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.04), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      label.position.set(0, SHELF_Y - 0.18, 0.57); g.add(label);
      this.pots.push({ x, g, band, fill, fillMat, label, plant: null });
    }
    // 물뿌리개 (주둥이 끝이 canX에 오도록 몸통은 왼쪽)
    this.can = new THREE.Group(); s.add(this.can);
    const body = new THREE.Group(); body.position.x = -0.55; this.can.add(body);
    box(0.62, 0.5, 0.42, '#4fb0a0', 0, 0, 0, body); box(0.64, 0.08, 0.44, '#3a8a7d', 0, 0.2, 0, body);
    box(0.08, 0.36, 0.3, '#3a8a7d', -0.36, 0.08, 0, body); box(0.3, 0.08, 0.3, '#3a8a7d', -0.2, 0.3, 0, body); // 손잡이
    const spout = box(0.6, 0.09, 0.09, '#4fb0a0', 0.5, -0.04, 0, body); spout.rotation.z = 0.5;
    box(0.12, 0.14, 0.16, '#3a8a7d', 0.77, 0.1, 0, body);                                              // 꼭지
    this.can.traverse((o) => (o.castShadow = true));
    this.drops = [];
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.camera.position.set(0, 2.7, 8.6);
    this.camera.lookAt(0, 1.9, 0);
  }

  onAvatar() { this.player.position.set(-5.8, 0, 1.6); this.player.rotation.y = Math.PI / 2; }

  // 화분에 새 새싹 심기
  plantPot(p, level = Math.random() * 0.08) {
    if (p.plant) p.g.remove(p.plant.g);
    p.kind = pick(PLANTS);
    p.plant = makePlant(p.kind); p.plant.g.position.y = SOIL_Y; p.g.add(p.plant.g);
    p.level = level; p.state = 'grow'; p.waitT = 0; p.t = 0;
    p.band.scale.y = (p.kind.hi - p.kind.lo) * GH; p.band.position.y = SOIL_Y + ((p.kind.lo + p.kind.hi) / 2) * GH;
    p.label.material.map?.dispose();
    p.label.material.map = signTexture(p.kind.name, { w: 78, h: 18, size: 14, bg: '#fff8e6' }); p.label.material.needsUpdate = true;
    this.drawGauge(p);
  }
  drawGauge(p) {
    const lv = Math.max(0.001, Math.min(1, p.level));
    p.fill.scale.y = lv * GH; p.fill.position.y = SOIL_Y + (lv * GH) / 2;
    p.fillMat.color.set(p.level > p.kind.hi ? '#ff6b5a' : p.level >= p.kind.lo ? '#5fd0ff' : '#3fa8f0');
  }

  reset() {
    for (const d of this.drops) this.scene.remove(d.m);
    this.drops = [];
    for (const p of this.pots) this.plantPot(p, Math.random() * 0.1);
    this.canX = 0; this.mouseX = null; this.mouseHeld = false; this.tilt = 0; this.dropT = 0;
    this.blooms = 0; this.wilts = 0;
    this.can.position.set(0, CAN_Y, 0.2); this.can.rotation.z = 0;
  }

  pointer(e, w, h) {
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const v = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.plane, v)) this.mouseX = THREE.MathUtils.clamp(v.x, -RX, RX);
  }
  pointerDown() { this.mouseHeld = true; }
  pointerUp() { this.mouseHeld = false; }

  // 손 기울기: 손목(0) → 가운데 손가락 뿌리(9)가 세로에서 얼마나 기울었는지 (라디안, 0 = 똑바로)
  handTilt(h) {
    const lm = h.lm; if (!lm) return 0;
    const dx = (lm[9].x - lm[0].x) * (4 / 3), dy = lm[9].y - lm[0].y; // 영상 가로세로 비 보정
    return Math.abs(Math.atan2(dx, -dy));
  }

  idle(dt, t) {
    this.avatar.animate(dt, t, { yaw: Math.PI / 2, wave: this.state === 'done' && this.blooms > 0 });
    this.updateDrops(dt);
    for (const p of this.pots) this.animPlant(p, dt, t);
  }

  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.vy -= 14 * dt; d.m.position.y += d.vy * dt; d.m.position.x += d.vx * dt;
      if (d.m.position.y < SOIL_Y) { this.scene.remove(d.m); this.drops.splice(i, 1); }
    }
  }

  animPlant(p, dt, t) {
    const pl = p.plant; if (!pl) return;
    if (p.state === 'bloom') { const k = Math.min(1, p.t / 0.4); pl.g.scale.setScalar(1 + 0.25 * Math.sin(k * Math.PI)); pl.bloom.rotation.z = Math.sin(t * 3 + p.x) * 0.06; }
    else if (p.state === 'grow') { pl.g.scale.setScalar(1); pl.sprout.rotation.z = Math.sin(t * 2 + p.x) * 0.05; }
  }

  step(dt, t, keys) {
    // ---- 물뿌리개 옮기기 ----
    let dir = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dir -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dir += 1;
    let pourRate = (keys.has('Space') || this.mouseHeld) ? POUR : 0;
    let wantTilt = pourRate ? 0.7 : 0;
    const cam = this.camCtl.on && this.camCtl.hands;
    const hc = cam && cam.center();
    if (dir) { this.mouseX = null; this.canX += dir * 5 * dt; }
    else if (hc) this.canX += (THREE.MathUtils.clamp((hc.x - 0.5) / 0.32, -1, 1) * RX - this.canX) * Math.min(1, dt * 8);
    else if (this.mouseX !== null) this.canX += (this.mouseX - this.canX) * Math.min(1, dt * 10);
    this.canX = THREE.MathUtils.clamp(this.canX, -RX, RX);
    // ---- 손으로 하기: 손을 옆으로 기울이면 붓기 (많이 기울일수록 콸콸), 주먹도 OK ----
    if (cam && !pourRate) {
      const hs = cam.fresh;
      const tilt = hs.reduce((a, h) => Math.max(a, this.handTilt(h)), 0);
      if (tilt > TILT_ON) { const k = THREE.MathUtils.clamp((tilt - TILT_ON) / 0.6, 0, 1); pourRate = POUR * (0.6 + 0.8 * k); wantTilt = 0.5 + 0.5 * k; }
      else if (hs.some((h) => h.shape === 'fist')) { pourRate = POUR; wantTilt = 0.7; }
      cam.label = !hs.length ? '' : pourRate ? '💧 물 주는 중' : '손을 옆으로 기울이면 물이 나와요';
    }
    this.tilt += (wantTilt - this.tilt) * Math.min(1, dt * 10);
    this.can.position.set(this.canX, CAN_Y + Math.sin(t * 2) * 0.03, 0.2);
    this.can.rotation.z = -this.tilt;
    this.avatar.animate(dt, t, { yaw: Math.PI / 2 });

    // ---- 물방울 + 아래 화분에 물 채우기 ----
    const target = this.pots.find((p) => Math.abs(p.x - this.canX) < 0.55);
    if (pourRate > 0) {
      this.dropT -= dt;
      if (this.dropT <= 0) {
        this.dropT = 0.035;
        const m = box(0.07, 0.11, 0.07, '#5fc8ff', this.canX + (Math.random() - 0.5) * 0.12, CAN_Y - 0.1, 0.2 + (Math.random() - 0.5) * 0.1, this.scene);
        m.castShadow = false;
        this.drops.push({ m, vy: -1.5, vx: (Math.random() - 0.5) * 0.3 });
        if (Math.random() < 0.08) sfx.step();
      }
    }
    this.updateDrops(dt);

    // ---- 화분마다 ----
    for (const p of this.pots) {
      p.t += dt;
      if (p.state === 'grow') {
        const poured = pourRate > 0 && p === target;
        if (poured) p.level += pourRate * dt;
        else p.level = Math.max(0, p.level - DRY * dt);
        if (p.level > p.kind.hi + OVER) { this.wilt(p); continue; }
        // 초록 칸 안에서 물을 멈추고 잠깐 기다리면 꽃이 핌
        if (!poured && p.level >= p.kind.lo && p.level <= p.kind.hi) { p.waitT += dt; if (p.waitT >= SETTLE) this.bloom(p); }
        else p.waitT = 0;
        this.drawGauge(p);
      } else if (p.state === 'bloom' && p.t > 2.4) this.plantPot(p);
      else if (p.state === 'wilt' && p.t > 1.8) this.plantPot(p);
      this.animPlant(p, dt, t);
    }
  }

  bloom(p) {
    p.state = 'bloom'; p.t = 0;
    p.plant.sprout.visible = false; p.plant.bloom.visible = true;
    this.blooms++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = 10 + Math.min(this.combo, 5) * 2;
    this.score += pts;
    sfx.gold();
    this.float(new THREE.Vector3(p.x, SOIL_Y + 1.3, 0), `${p.kind.name} 활짝! +${pts}`, 'gold');
  }
  wilt(p) {
    p.state = 'wilt'; p.t = 0; p.level = Math.min(1, p.level); this.drawGauge(p);
    p.plant.sprout.visible = false; p.plant.wilt.visible = true;
    this.wilts++; this.score = Math.max(0, this.score - 5);
    this.hurt(new THREE.Vector3(p.x, SOIL_Y + 1.1, 0), `물이 넘쳐 ${p.kind.name}가 시들었어요`);
  }

  resultTitle() { return this.blooms >= 12 ? '초록 손가락!' : this.blooms >= 6 ? '꽃 피우기 성공!' : '식물원 물 주기 끝!'; }
  extraText() { return `꽃 ${this.blooms || 0}송이 · 콤보 ${this.combo || 0}`; }
  resultRows() { return [['꽃 피운 화분', `${this.blooms}개`], ['시든 화분', `${this.wilts}개`], ['최고 연속', `${this.maxCombo}번`]]; }
}
