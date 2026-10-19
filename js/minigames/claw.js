import * as THREE from 'three';
import { rbox } from '../toon.js';
import { box } from '../world.js';
import { signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';

const $ = (id) => document.getElementById(id);
const FLOOR = 0.5;                 // 인형이 놓인 바닥 높이
const HOME_Y = 3.15;               // 집게가 쉬는 높이
const RX = 1.35, RZ = 0.75;        // 집게가 움직일 수 있는 범위
const CHUTE = { x: -1.2, z: 0.55 }; // 배출구 (앞 왼쪽)
const TRIES = 6, MOVE_T = 10;      // 도전 횟수 / 한 판 움직일 수 있는 시간
const DOLLS = [
  { k: 'bear', name: '곰돌이', c: '#a0703a', v: 10, w: 4 },
  { k: 'rabbit', name: '토끼', c: '#f6f3ea', v: 10, w: 4 },
  { k: 'duck', name: '오리', c: '#ffd23f', v: 10, w: 3 },
  { k: 'cat', name: '고양이', c: '#9aa0a8', v: 15, w: 2 },
  { k: 'penguin', name: '펭귄', c: '#2f3a5a', v: 15, w: 2 },
];
const HAECHI = { k: 'haechi', name: '황금 해치', c: '#f2b33a', v: 40 };

// 도트 인형 (바닥 기준, 키 약 0.75)
function makeDoll(d, big) {
  const g = new THREE.Group(), s = big ? 1.2 : 1;
  const inner = new THREE.Group(); inner.scale.setScalar(s); g.add(inner);
  const c = d.c, dark = '#3a2410';
  box(0.42, 0.36, 0.32, c, 0, 0.18, 0, inner);                     // 몸
  box(0.38, 0.34, 0.34, c, 0, 0.53, 0, inner);                     // 머리
  for (const x of [-0.08, 0.08]) box(0.05, 0.05, 0.02, dark, x, 0.56, 0.175, inner); // 눈
  if (d.k === 'bear' || d.k === 'cat') for (const x of [-0.14, 0.14]) box(0.1, d.k === 'cat' ? 0.14 : 0.1, 0.08, c, x, 0.75, 0, inner);
  if (d.k === 'bear') box(0.14, 0.08, 0.04, '#d9b28a', 0, 0.48, 0.18, inner);
  if (d.k === 'rabbit') for (const x of [-0.09, 0.09]) { box(0.08, 0.26, 0.06, c, x, 0.83, 0, inner); box(0.04, 0.18, 0.02, '#ff9ec4', x, 0.83, 0.035, inner); }
  if (d.k === 'duck') box(0.16, 0.06, 0.1, '#f28c28', 0, 0.48, 0.2, inner);
  if (d.k === 'penguin') { box(0.3, 0.3, 0.02, '#f6f3ea', 0, 0.2, 0.165, inner); box(0.08, 0.05, 0.08, '#f2a93b', 0, 0.48, 0.2, inner); }
  if (d.k === 'haechi') { // 서울의 상징 해치: 갈기 + 뿔
    box(0.46, 0.14, 0.38, '#d9541f', 0, 0.72, -0.02, inner); box(0.06, 0.12, 0.06, '#5fc04a', 0, 0.82, 0.1, inner);
    box(0.12, 0.06, 0.04, '#ffffff', 0, 0.46, 0.18, inner);
  }
  g.traverse((o) => (o.castShadow = true));
  g.userData = { ...d, big, h: 0.72 * s, r: 0.24 * s, grip: big ? 0.72 : 0.92, value: big ? Math.round(d.v * 1.5) : d.v };
  return g;
}

// 홍대 인형뽑기: 10초 안에 집게를 옮기고 내려서 인형을 배출구까지!
export class ClawGame extends MiniGame {
  static meta = {
    id: 'claw', title: '홍대 인형뽑기', duration: 0, hearts: 0, resultTitle: '인형뽑기 끝!', fov: 40, sky: '#2a1f3a',
    hint: '←→↑↓ · WASD = 집게 움직이기 · Space · 클릭 = 내리기 — 한 판에 10초, 6번 도전! 인형 가운데를 노려요',
  };

  build() {
    this.camCtl = new CamControl(this, {
      hint: '✋ 손을 움직이면 집게가 따라가요 (손을 위로 올리면 안쪽으로) → ✊ 주먹을 쥐면 내려가서 집기!',
      onEvent: (type) => { if (type === 'fist') this.dropClaw(); },
    });
    const s = this.scene;
    this.lights({ pos: [-3, 9, 7], size: 6, intensity: 1.6 });
    // 오락실 바닥·벽
    box(14, 0.1, 10, '#3a2f4a', 0, -0.05, 0, s).receiveShadow = true;
    box(14, 6, 0.2, '#4a3a5e', 0, 3, -2.2, s);
    for (let i = 0; i < 7; i++) { const b = box(0.12, 0.12, 0.05, new THREE.MeshBasicMaterial({ color: ['#ff6ec7', '#7fd8ff', '#ffe14f'][i % 3] }), -4.5 + i * 1.5, 4.8, -2.08, s); b.castShadow = false; }
    // 기계: 아래 받침 + 네 기둥 + 지붕 간판
    box(3.9, 0.5, 2.3, '#ff6ec7', 0, 0.25, 0, s);
    box(3.6, 0.02, 2.0, '#ffd8ec', 0, 0.51, 0, s);
    for (const x of [-1.9, 1.9]) for (const z of [-1.1, 1.1]) box(0.12, 3.4, 0.12, '#ffffff', x, 2.2, z, s);
    box(3.95, 0.45, 2.35, '#ff6ec7', 0, 4.1, 0, s);
    const sign = new THREE.Mesh(rbox(2.6, 0.38, 0.05), new THREE.MeshBasicMaterial({ map: signTexture('인형뽑기', { w: 96, h: 16, size: 12, bg: '#2a1036', fg: '#ffe14f' }) }));
    sign.position.set(0, 4.1, 1.2); s.add(sign);
    // 유리 (살짝 비치게)
    const glass = new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.12, depthWrite: false });
    for (const [w, d, x, z] of [[3.8, 0.02, 0, 1.1], [3.8, 0.02, 0, -1.1], [0.02, 2.2, -1.9, 0], [0.02, 2.2, 1.9, 0]]) { const m = new THREE.Mesh(rbox(w, 3.35, d), glass); m.position.set(x, 2.2, z); s.add(m); }
    // 배출구 (투명 칸막이 + 어두운 구멍)
    box(0.8, 0.03, 0.8, '#1a1420', CHUTE.x, 0.53, CHUTE.z, s);
    const acr = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    for (const [w, d, x, z] of [[0.82, 0.03, 0, -0.4], [0.03, 0.82, 0.4, 0]]) { const m = new THREE.Mesh(rbox(w, 0.5, d), acr); m.position.set(CHUTE.x + x, 0.78, CHUTE.z + z); s.add(m); }
    box(0.7, 0.3, 0.06, '#1a1420', CHUTE.x, 0.25, 1.16, s); // 받는 곳 뚜껑
    // 레일 + 집게
    box(3.7, 0.08, 0.12, '#c9ced6', 0, 3.75, -0.95, s); box(3.7, 0.08, 0.12, '#c9ced6', 0, 3.75, 0.95, s);
    this.gantry = box(0.1, 0.08, 1.95, '#e3e6ea', 0, 3.72, 0, s);
    this.carriage = box(0.3, 0.16, 0.3, '#8a9096', 0, 3.62, 0, s);
    this.cable = box(0.03, 1, 0.03, '#555b66', 0, 3.4, 0, s);
    this.claw = new THREE.Group(); s.add(this.claw);
    box(0.26, 0.18, 0.26, '#c9ced6', 0, 0.09, 0, this.claw);
    this.prongs = [];
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Group(); w.rotation.y = (i / 3) * Math.PI * 2; this.claw.add(w);
      const pv = new THREE.Group(); pv.position.set(0.1, 0, 0); w.add(pv);
      box(0.05, 0.42, 0.05, '#e3e6ea', 0, -0.21, 0, pv); box(0.1, 0.05, 0.05, '#e3e6ea', -0.04, -0.42, 0, pv);
      this.prongs.push(pv);
    }
    this.dolls = []; this.falling = []; this.held = null;
    this.cx = 0; this.cz = 0; this.cy = HOME_Y; this.open = 0.55;
    this.fill(); this.placeClaw(); // 고르는 화면에서도 기계 안이 차 있게
    this.camera.position.set(0, 3.1, 6.4);
    this.camera.lookAt(0, 1.7, 0);
  }

  onAvatar() { this.player.position.set(2.75, 0, 1.6); this.player.rotation.y = -2.4; }

  // 인형 채우기: 배출구 자리는 비우고, 황금 해치는 한 마리
  fill() {
    for (const d of this.dolls) this.scene.remove(d);
    this.dolls = [];
    const spots = [];
    for (let x = -1.25; x <= 1.3; x += 0.5) for (let z = -0.7; z <= 0.75; z += 0.48) if (Math.hypot(x - CHUTE.x, z - CHUTE.z) > 0.65) spots.push([x, z]);
    spots.sort(() => Math.random() - 0.5);
    const tot = DOLLS.reduce((a, d) => a + d.w, 0);
    spots.slice(0, 14).forEach(([x, z], i) => {
      let d = HAECHI;
      if (i > 0) { let r = Math.random() * tot; d = DOLLS.find((q) => (r -= q.w) < 0); }
      const m = makeDoll(d, i > 0 && Math.random() < 0.25);
      m.position.set(x + (Math.random() - 0.5) * 0.12, FLOOR, z + (Math.random() - 0.5) * 0.12);
      m.rotation.y = (Math.random() - 0.5) * 1.4;
      this.scene.add(m); this.dolls.push(m);
    });
  }

  reset() {
    this.fill();
    this.tries = TRIES; this.got = []; this.held = null; this.falling = [];
    this.cx = 0; this.cz = 0; this.cy = HOME_Y; this.open = 0.55; this.want = null;
    this.phase = 'move'; this.moveT = MOVE_T;
    const o = $('miniOverlay');
    const tm = document.createElement('div'); tm.className = 'claw-timer'; o.appendChild(tm); this.timerEl = tm;
    this.placeClaw();
  }

  placeClaw() {
    this.claw.position.set(this.cx, this.cy, this.cz);
    this.gantry.position.x = this.cx;
    this.carriage.position.set(this.cx, 3.62, this.cz);
    const len = Math.max(0.05, 3.55 - (this.cy + 0.18));
    this.cable.scale.y = len; this.cable.position.set(this.cx, this.cy + 0.18 + len / 2, this.cz);
    for (const p of this.prongs) p.rotation.z = this.open;
    if (this.held) this.held.position.set(this.cx, this.cy - 0.42 - this.held.userData.h * 0.55, this.cz);
  }

  dropClaw() {
    if (this.state !== 'play' || this.phase !== 'move') return;
    sfx.click();
    // 집게 밑에 있는 인형 위에서 멈춤
    const under = this.nearest(0.45);
    this.dropTo = under ? FLOOR + under.userData.h + 0.3 : FLOOR + 0.45;
    this.phase = 'drop';
  }
  nearest(maxD) {
    let best = null, bd = maxD;
    for (const d of this.dolls) { const dd = Math.hypot(d.position.x - this.cx, d.position.z - this.cz); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  keyDown(code) { if (code === 'Space' || code === 'Enter') this.dropClaw(); }
  pointerDown() { this.dropClaw(); }

  idle(dt, t) {
    this.avatar.animate(dt, t, { yaw: -2.4 });
    this.updateFalling(dt);
    this.placeClaw();
  }

  updateFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.vy -= 12 * dt; f.m.position.y += f.vy * dt;
      if (f.m.position.y <= f.to) { f.m.position.y = f.to; this.falling.splice(i, 1); f.done?.(); }
    }
  }

  step(dt, t, keys) {
    this.avatar.animate(dt, t, { yaw: -2.4, wave: this.phase === 'win' });
    this.updateFalling(dt);
    const goTo = (x, z, sp) => { const dx = x - this.cx, dz = z - this.cz, d = Math.hypot(dx, dz); if (d < sp * dt) { this.cx = x; this.cz = z; return true; } this.cx += (dx / d) * sp * dt; this.cz += (dz / d) * sp * dt; return false; };
    if (this.phase === 'move') {
      this.moveT -= dt;
      let dx = 0, dz = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
      const hc = this.camCtl.on && this.camCtl.hands.center();
      if (dx || dz) { this.cx += dx * 1.5 * dt; this.cz += dz * 1.2 * dt; }
      else if (hc) { // 손 위치 → 집게 (손을 위로 = 기계 안쪽)
        goTo(THREE.MathUtils.clamp((hc.x - 0.5) / 0.3, -1, 1) * RX, THREE.MathUtils.clamp((hc.y - 0.5) / 0.22, -1, 1) * RZ, 2.2);
      }
      this.cx = THREE.MathUtils.clamp(this.cx, -RX, RX); this.cz = THREE.MathUtils.clamp(this.cz, -RZ, RZ);
      this.timerEl.textContent = `⏱ ${Math.max(0, Math.ceil(this.moveT))}`;
      this.timerEl.classList.toggle('hurry', this.moveT < 3.5);
      if (this.moveT <= 0) this.dropClaw();
    } else if (this.phase === 'drop') {
      this.cy -= 1.7 * dt;
      if (this.cy <= this.dropTo) { this.cy = this.dropTo; this.phase = 'close'; this.closeT = 0; }
    } else if (this.phase === 'close') {
      this.closeT += dt;
      this.open = THREE.MathUtils.lerp(0.55, 0.04, Math.min(1, this.closeT / 0.45));
      if (this.closeT >= 0.55) {
        // 집기: 인형 가운데에 가까울수록, 작을수록 잘 잡힘
        const d = this.nearest(0.42);
        if (d) {
          const off = Math.hypot(d.position.x - this.cx, d.position.z - this.cz);
          this.grip = THREE.MathUtils.clamp(1 - off / (d.userData.r + 0.22), 0, 1) * d.userData.grip;
          if (Math.random() < this.grip + 0.12) { this.held = d; this.dolls.splice(this.dolls.indexOf(d), 1); sfx.catch(2); }
        }
        this.phase = 'lift'; this.slipChecked = false;
      }
    } else if (this.phase === 'lift') {
      this.cy += 1.3 * dt;
      // 올라가는 도중에 미끄러질 수도 (덜 정확하게 잡을수록)
      if (this.held && !this.slipChecked && this.cy > FLOOR + 1.5) {
        this.slipChecked = true;
        if (Math.random() < 0.35 * (1 - this.grip)) this.slip('앗, 미끄러졌다!');
      }
      if (this.cy >= HOME_Y) { this.cy = HOME_Y; this.phase = this.held ? 'carry' : 'return'; if (!this.held) this.missed(); }
    } else if (this.phase === 'carry') {
      if (goTo(CHUTE.x, CHUTE.z, 1.6)) { this.phase = 'release'; this.relT = 0; }
    } else if (this.phase === 'release') {
      this.relT += dt;
      this.open = THREE.MathUtils.lerp(0.04, 0.55, Math.min(1, this.relT / 0.3));
      if (this.held) {
        const m = this.held; this.held = null;
        this.falling.push({ m, vy: 0, to: -0.4, done: () => { this.scene.remove(m); this.win(m.userData); } });
      }
      if (this.relT > 0.7) this.phase = 'return';
    } else if (this.phase === 'return') {
      this.open = 0.55;
      if (goTo(0, 0, 1.8)) this.nextTry();
    }
    this.placeClaw();
  }

  slip(msg) {
    const m = this.held; this.held = null;
    const x = THREE.MathUtils.clamp(m.position.x, -RX, RX), z = THREE.MathUtils.clamp(m.position.z, -RZ, RZ);
    m.position.x = x; m.position.z = z;
    this.falling.push({ m, vy: 0, to: FLOOR, done: () => this.dolls.push(m) });
    sfx.miss(); this.float(new THREE.Vector3(this.cx, this.cy, this.cz), msg, 'bad');
  }
  missed() { sfx.miss(); this.combo = 0; this.float(new THREE.Vector3(this.cx, this.cy - 0.6, this.cz), '아쉬워요…', 'bad'); }
  win(d) {
    this.got.push(d);
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += d.value;
    sfx.gold();
    this.float(new THREE.Vector3(CHUTE.x, 1.4, CHUTE.z + 0.6), `${d.big ? '큰 ' : ''}${d.name} 뽑았다! +${d.value}`, 'gold');
  }
  nextTry() {
    this.tries--;
    if (this.tries <= 0 || !this.dolls.length) { this.timerEl.textContent = ''; this.finish(); return; }
    this.phase = 'move'; this.moveT = MOVE_T;
  }

  extraText() { return `남은 기회 ${this.tries ?? TRIES} · 뽑은 인형 ${this.got?.length || 0}`; }
  resultRows() {
    const cnt = {};
    for (const d of this.got) { const n = `${d.big ? '큰 ' : ''}${d.name}`; cnt[n] = (cnt[n] || 0) + 1; }
    const list = Object.entries(cnt).map(([n, c]) => `${n}${c > 1 ? ` ×${c}` : ''}`).join(', ') || '없음';
    return [['뽑은 인형', `${this.got.length}개 / ${TRIES}번`], ['인형', list], ['최대 연속', `${this.maxCombo}번`]];
  }
}
