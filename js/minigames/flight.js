import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { box } from '../world.js';
import { makePlane } from '../landmarks.js';
import { waterTexture, rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';

const $ = (id) => document.getElementById(id);
const PX = -5;            // 비행기 x 위치 (화면 왼쪽)
const GROUND = 0.6, CEIL = 8.4; // 비행기 몸통 높이 한계 (땅에 닿으면 쿵)
const PLANE_HW = 1.1, PLANE_HH = 0.35; // 비행기 충돌 상자 반폭/반높이 (조금 너그럽게)
const SEA_AT = 0.55;      // 이만큼 날아가면 바다 위
const FLIGHT = 'DS1017';
const UP_KEYS = ['ArrowUp', 'KeyW', 'Space'], DOWN_KEYS = ['ArrowDown', 'KeyS'];

// 장애물 (x,y = 중심 / tower만 y = 바닥)
function makeObstacle(kind) {
  const g = new THREE.Group();
  let w = 1, h = 1;
  if (kind === 'birds') { // 새 세 마리 V자
    g.userData.wings = [];
    for (const [dx, dy] of [[0, 0], [0.6, 0.35], [0.6, -0.35]]) {
      const b = new THREE.Group(); b.position.set(dx, dy, 0); g.add(b);
      box(0.4, 0.16, 0.18, '#3a3f4a', 0, 0, 0, b); box(0.14, 0.12, 0.12, '#3a3f4a', -0.24, 0.04, 0, b); box(0.1, 0.04, 0.06, '#f2a93b', -0.34, 0.03, 0, b);
      const wg = box(0.2, 0.03, 0.5, '#555b66', 0, 0.06, 0, b); g.userData.wings.push(wg);
    }
    w = 1.3; h = 1.0;
  } else if (kind === 'storm') { // 번개 치는 먹구름
    for (const [x, y, s] of [[0, 0, 1], [-0.8, -0.15, 0.75], [0.8, -0.1, 0.8], [0.2, 0.4, 0.7]]) box(1.3 * s, 0.9 * s, 0.9 * s, '#5d6270', x, y, 0, g);
    const bolt = new THREE.Group(); g.add(bolt);
    const yel = new THREE.MeshBasicMaterial({ color: '#ffe14f' });
    box(0.12, 0.4, 0.05, yel, 0, -0.65, 0.4, bolt); box(0.12, 0.4, 0.05, yel, 0.12, -0.95, 0.4, bolt).rotation.z = 0.5; box(0.12, 0.4, 0.05, yel, 0.05, -1.25, 0.4, bolt);
    g.userData.bolt = bolt;
    w = 2.4; h = 1.3;
  } else if (kind === 'balloon') { // 열기구
    const cols = ['#e8413a', '#ffd23f', '#2f7fd8', '#5fc04a'];
    for (let i = 0; i < 4; i++) box(0.3, 1.2, 1.2, cols[i], -0.45 + i * 0.3, 0.35, 0, g);
    box(1.0, 0.3, 1.0, '#e8413a', 0, 1.05, 0, g); box(0.8, 0.25, 0.8, '#ffd23f', 0, -0.35, 0, g);
    for (const s of [-1, 1]) box(0.03, 0.4, 0.03, '#6b4a2a', s * 0.25, -0.65, 0, g);
    box(0.5, 0.35, 0.5, '#a0703a', 0, -1.0, 0, g);
    w = 1.2; h = 2.4;
  } else if (kind === 'tower') { // 높은 빌딩 (땅에서 솟음)
    const hh = 2.4 + Math.random() * 2.2;
    const c = ['#c9d6e3', '#e3d9c6', '#b8c4cf', '#d9c2b0'][(Math.random() * 4) | 0];
    box(1.3, hh, 1.3, c, 0, hh / 2, 0, g);
    for (let y = 0.5; y < hh - 0.3; y += 0.55) box(1.32, 0.18, 1.32, '#6fa8d6', 0, y, 0, g);
    box(0.08, 0.6, 0.08, '#888', 0, hh + 0.3, 0, g); box(0.14, 0.14, 0.14, new THREE.MeshBasicMaterial({ color: '#ff4a3a' }), 0, hh + 0.62, 0, g);
    w = 1.3; h = hh;
  } else { // star
    const m = new THREE.MeshBasicMaterial({ color: '#ffd84a' });
    box(0.5, 0.18, 0.12, m, 0, 0, 0, g); box(0.18, 0.5, 0.12, m, 0, 0, 0, g); box(0.3, 0.3, 0.13, m, 0, 0, 0, g).rotation.z = Math.PI / 4;
    w = 0.6; h = 0.6;
  }
  g.traverse((o) => (o.castShadow = false));
  g.userData.box = { w, h };
  return g;
}

// 김포공항 비행기 조종: 옆에서 보며 위아래로 장애물 피해 제주까지
export class FlightGame extends MiniGame {
  static meta = {
    id: 'flight', title: `${FLIGHT} 김포 → 제주`, duration: 50, hearts: 3, fov: 42, sky: '#8fd3f5',
    hint: '↑ · W · Space (누르고 있기) · 마우스 누르기 = 위로, ↓ · S = 아래로 — 새·먹구름·열기구·빌딩을 피해 제주까지!',
  };

  build() {
    const s = this.scene;
    s.fog = new THREE.Fog('#8fd3f5', 26, 48);
    this.lights({ pos: [-4, 16, 10], size: 14, intensity: 1.8 });
    // 땅·바다 조각 (스크롤하며 재사용)
    this.landMat = toonMat({ color: '#7fbf5a' });
    const wt = waterTexture(); wt.repeat.set(4, 4); this.seaMat = toonMat({ map: wt }); this.waterTex = wt;
    this.chunks = [];
    // 먼 구름 (느린 시차)
    this.deco = [];
    const r = rng(31), cloudMat = new THREE.MeshBasicMaterial({ color: '#f7fbff', fog: true });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) box(1.6 + r() * 1.4, 0.7 + r() * 0.5, 1, cloudMat, k * 1.1 - 1.1, r() * 0.4, 0, c);
      c.position.set(-22 + i * 6, 4 + r() * 6, -14 - r() * 4);
      c.traverse((o) => (o.castShadow = false));
      s.add(c); this.deco.push({ m: c, k: 0.2 + r() * 0.15 });
    }
    // 내 비행기 (조종석에 내 캐릭터)
    this.craft = new THREE.Group(); s.add(this.craft);
    const plane = makePlane('#ffffff', '#2f6fd8');
    plane.rotation.y = Math.PI / 2; plane.position.y = -0.75 * 0.85; plane.scale.setScalar(0.85);
    this.craft.add(plane); this.planeMesh = plane;
    this.seat = new THREE.Group(); this.seat.position.set(0, 0.8, 1.15); plane.add(this.seat);
    this.flashTargets = [plane];
    this.items = [];
    this.camera.position.set(1.5, 4.4, 15);
    this.camera.lookAt(1.5, 3.9, 0);
  }

  onAvatar() {
    this.seat.clear(); this.seat.add(this.player);
    this.player.position.set(0, 0, 0); this.player.scale.setScalar(0.36); this.player.rotation.y = 0;
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.m);
    for (const c of this.chunks) this.scene.remove(c);
    this.items = []; this.chunks = [];
    for (let x = -24; x < 30; x += 10) this.addChunk(x, 'land');
    this.y = 3; this.vy = 0; this.hold = false; this.elapsed = 0; this.stars = 0; this.spawnX = 8; this.speed = 8; this.success = false;
    this.craft.position.set(PX, this.y, 0); this.craft.rotation.z = 0;
    this.overlay();
  }
  overlay() {
    const o = $('miniOverlay');
    const rt = document.createElement('div'); rt.className = 'flight-route';
    rt.innerHTML = `<b>김포</b><div class="bar"><i></i><span>✈</span></div><b>제주</b>`;
    o.appendChild(rt); this.routeFill = rt.querySelector('i'); this.routePlane = rt.querySelector('span');
  }

  // 땅(건물 몇 채) 또는 바다 한 조각 (폭 10)
  addChunk(x, kind) {
    const g = new THREE.Group(); g.position.x = x; g.userData.kind = kind;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10.05, 16), kind === 'land' ? this.landMat : this.seaMat);
    m.rotation.x = -Math.PI / 2; m.position.z = -4; m.receiveShadow = true; g.add(m);
    if (kind === 'land') {
      for (let i = 0; i < 4; i++) {
        const h = 0.6 + Math.random() * 1.6, c = ['#f2efe6', '#e3d9c6', '#c9d6e3', '#f4a6c0', '#ffd8a0'][(Math.random() * 5) | 0];
        box(1.2, h, 1.2, c, -4 + i * 2.5 + Math.random(), h / 2, -3.5 - Math.random() * 5, g);
      }
      if (Math.random() < 0.5) box(0.9, 0.9, 0.9, '#3f8a2a', -2 + Math.random() * 4, 0.6, -2.2, g);
    }
    this.scene.add(g); this.chunks.push(g);
  }

  keyDown(code) { if (UP_KEYS.includes(code) && this.state === 'play') sfx.jump(); }
  pointerDown() { this.hold = true; }
  pointerUp() { this.hold = false; }

  // 다음 장애물 묶음 (돌려주는 값 = 다음 묶음까지 거리)
  pattern(x) {
    const prog = this.elapsed / this.duration, sea = prog > SEA_AT;
    const add = (kind, dx, y) => { const m = makeObstacle(kind); m.position.set(x + dx, y, 0); this.scene.add(m); this.items.push({ kind, m, y0: y, ph: Math.random() * 6 }); return m; };
    const ry = () => 1.6 + Math.random() * (CEIL - 2.6);
    const roll = Math.random();
    if (!sea && roll < 0.3) { add('tower', 0, 0); add('star', 0, 5.2 + Math.random() * 1.5); }
    else if (roll < 0.5) add('birds', 0, ry());
    else if (roll < 0.68) add('balloon', 0, 2.2 + Math.random() * 4.5);
    else if (roll < 0.85 || prog < 0.25) { const y = ry(); add('storm', 0, y); add('star', 2.4, y > 4.5 ? y - 2 : y + 2); }
    else { // 먹구름 두 개 사이 틈으로 빠져나가기
      const gap = 3.0 - prog * 0.6, mid = 2.4 + Math.random() * (CEIL - 4.8);
      add('storm', 0, mid + gap / 2 + 0.65); add('storm', 0, mid - gap / 2 - 0.65); add('star', 0, mid);
    }
    if (Math.random() < 0.35) for (let i = 0; i < 3; i++) add('star', 5 + i * 1.1, ry());
    return 8 + Math.random() * 4 - prog * 3;
  }

  scroll(dx) {
    this.waterTex.offset.x = (this.waterTex.offset.x + dx * 0.02) % 1;
    for (const d of this.deco) { d.m.position.x -= dx * d.k; if (d.m.position.x < -28) d.m.position.x += 54; }
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i]; c.position.x -= dx;
      if (c.position.x < -26) {
        this.scene.remove(c); this.chunks.splice(i, 1);
        const last = Math.max(...this.chunks.map((k) => k.position.x));
        this.addChunk(last + 10, this.elapsed / this.duration > SEA_AT - 0.1 ? 'sea' : 'land');
      }
    }
  }

  idle(dt, t) {
    if (this.state === 'done') { // 성공: 하늘 위로 / 결항: 천천히 내려앉음
      this.y += (this.success ? 3 : -1.2) * dt; this.y = Math.max(GROUND, this.y);
      this.craft.position.x += (this.success ? 6 : 0) * dt;
      this.craft.rotation.z += ((this.success ? 0.25 : 0) - this.craft.rotation.z) * Math.min(1, dt * 4);
      this.scroll(dt * (this.success ? 4 : 0));
    } else this.scroll(dt * 2);
    this.craft.position.y = this.y + (this.state === 'countdown' ? Math.sin(t * 3) * 0.1 : 0);
    this.player.visible = true;
    this.avatar.animate(dt, t, {});
  }

  step(dt, t, keys) {
    this.elapsed += dt;
    const prog = Math.min(1, this.elapsed / this.duration);
    this.speed = 8 + prog * 5;
    const dx = this.speed * dt;
    this.scroll(dx);
    // 조종: 누르고 있으면 올라가고, 놓으면 천천히 내려감
    const up = this.hold || UP_KEYS.some((k) => keys.has(k)), down = DOWN_KEYS.some((k) => keys.has(k));
    const target = up ? 5.5 : down ? -6 : -1.6;
    this.vy += (target - this.vy) * Math.min(1, dt * 5);
    this.y += this.vy * dt;
    if (this.y > CEIL) { this.y = CEIL; this.vy = Math.min(0, this.vy); }
    if (this.y < GROUND) {
      this.y = GROUND; this.vy = 6;
      this.hurt(this.craft.position.clone().add(new THREE.Vector3(0, 1, 0)), '땅에 닿았어요!');
    }
    this.craft.position.y = this.y;
    this.craft.rotation.z = this.vy * 0.06;
    this.avatar.animate(dt, t, {});
    // 장애물
    this.spawnX -= dx;
    if (this.spawnX <= 0) this.spawnX = this.pattern(18);
    const p = { x0: PX - PLANE_HW, x1: PX + PLANE_HW, y0: this.y - PLANE_HH, y1: this.y + PLANE_HH };
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.m, b = m.userData.box;
      m.position.x -= dx * (it.kind === 'birds' ? 1.25 : 1);
      if (it.kind === 'birds') { m.position.y = it.y0 + Math.sin(t * 2 + it.ph) * 0.4; const f = Math.sin(t * 14) * 0.7; m.userData.wings.forEach((w) => (w.rotation.x = f)); }
      if (it.kind === 'balloon') m.position.y = it.y0 + Math.sin(t * 0.9 + it.ph) * 0.8;
      if (it.kind === 'storm') m.userData.bolt.visible = Math.sin(t * 9 + it.ph) > 0.3;
      if (it.kind === 'star') m.rotation.y += dt * 4;
      const by0 = it.kind === 'tower' ? 0 : m.position.y - b.h / 2;
      const hit = p.x1 > m.position.x - b.w / 2 && p.x0 < m.position.x + b.w / 2 && p.y1 > by0 && p.y0 < by0 + b.h;
      if (hit && !it.done) {
        if (it.kind === 'star') { it.done = true; this.stars++; sfx.coin(); this.float(m.position, '+5', 'gold'); this.scene.remove(m); this.items.splice(i, 1); continue; }
        const msg = { birds: '새 떼!', storm: '번쩍! 난기류!', balloon: '열기구 조심!', tower: '빌딩!' }[it.kind];
        if (this.hurt(this.craft.position.clone().add(new THREE.Vector3(0, 1.2, 0)), msg)) it.done = true;
      }
      if (m.position.x < -18) { this.scene.remove(m); this.items.splice(i, 1); }
    }
    this.score = Math.floor(prog * 100) + this.stars * 5;
    this.routeFill.style.width = `${prog * 100}%`;
    this.routePlane.style.left = `${prog * 100}%`;
  }

  finish() {
    if (this.state === 'done') return;
    this.success = this.hearts > 0;
    if (this.success) this.score += 50;
    const msg = document.createElement('div');
    msg.className = `flight-msg ${this.success ? 'ok' : 'bad'}`;
    msg.textContent = this.resultTitle();
    $('miniOverlay').appendChild(msg);
    super.finish();
  }
  resultTitle() { return this.success ? '즐거운 여행되세요!' : `${FLIGHT} 항공편이 결항되었습니다.`; }
  extraText() { return `별 ${this.stars || 0}`; }
  resultRows() {
    const km = this.success ? 450 : Math.round(Math.min(1, this.elapsed / this.duration) * 450);
    return [['결과', this.success ? '제주 도착 ✈' : '결항'], ['날아간 거리', `${km}km / 450km`], ['모은 별', `${this.stars}개 (×5)`], ['도착 보너스', this.success ? '+50' : '없음']];
  }
}
