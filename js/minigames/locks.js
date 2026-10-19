import * as THREE from 'three';
import { box, makeTree } from '../world.js';
import { rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';

const $ = (id) => document.getElementById(id);
const COLS = 10, ROWS = 6, GOAL = 8, PENALTY = 3;
const COLORS = [
  { id: 'red', name: '빨간', c: '#e8413a', d: '#a8322d' }, { id: 'yellow', name: '노란', c: '#ffd23f', d: '#c99a1e' },
  { id: 'pink', name: '분홍', c: '#ff8fbf', d: '#d0608f' }, { id: 'blue', name: '파란', c: '#3f8fe8', d: '#2a5fa8' },
  { id: 'green', name: '초록', c: '#5fc04a', d: '#3a8a30' }, { id: 'purple', name: '보라', c: '#9b5de5', d: '#6a3aa8' },
];
const SHAPES = [{ id: 'heart', name: '하트' }, { id: 'round', name: '동그라미' }, { id: 'square', name: '네모' }];
const RINGS = [{ id: 'silver', name: '은색 고리', c: '#c9ced6' }, { id: 'gold', name: '금색 고리', c: '#f2b632' }];
const key = (l) => `${l.color.id}/${l.shape.id}/${l.ring.id}`;
const randLock = () => ({ color: COLORS[(Math.random() * 6) | 0], shape: SHAPES[(Math.random() * 3) | 0], ring: RINGS[(Math.random() * 2) | 0] });

function makeLock(l) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: l.color.c, flatShading: true });
  const ring = new THREE.MeshLambertMaterial({ color: l.ring.c });
  if (l.shape.id === 'square') box(0.46, 0.42, 0.12, body, 0, 0, 0, g);
  else if (l.shape.id === 'round') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10), body); m.rotation.x = Math.PI / 2; g.add(m); }
  else {
    for (const x of [-0.12, 0.12]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 8), body); m.rotation.x = Math.PI / 2; m.position.set(x, 0.07, 0); g.add(m); }
    const tip = box(0.32, 0.32, 0.12, body, 0, -0.07, 0, g); tip.rotation.z = Math.PI / 4;
  }
  box(0.06, 0.2, 0.06, ring, -0.14, 0.3, 0, g); box(0.06, 0.2, 0.06, ring, 0.14, 0.3, 0, g); box(0.34, 0.06, 0.06, ring, 0, 0.42, 0, g);
  box(0.06, 0.1, 0.02, '#2a2420', 0, -0.04, 0.07, g);
  // 클릭 판정용 (보이지 않는 판)
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.64), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 0.08, 0.08); g.add(hit);
  g.userData.hit = hit; hit.userData.lock = g;
  return g;
}

// 2D 카드에 그릴 자물쇠 그림
function drawLock(cv, l) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#e8eef2'; g.fillRect(0, 0, 40, 40);
  g.fillStyle = l.ring.c;
  g.fillRect(13, 6, 3, 10); g.fillRect(24, 6, 3, 10); g.fillRect(13, 5, 14, 3);
  g.fillStyle = l.color.c;
  if (l.shape.id === 'square') g.fillRect(9, 15, 22, 18);
  else if (l.shape.id === 'round') { g.beginPath(); g.arc(20, 24, 11, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.arc(14.5, 20, 6.5, 0, Math.PI * 2); g.arc(25.5, 20, 6.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(8, 22); g.lineTo(32, 22); g.lineTo(20, 35); g.closePath(); g.fill(); }
  g.fillStyle = '#2a2420'; g.fillRect(19, 23, 2, 5);
}

// 남산 사랑의 자물쇠 찾기: 제한 시간 안에 카드와 똑같은 자물쇠 8개 찾기
export class LockGame extends MiniGame {
  static meta = {
    id: 'locks', title: '사랑의 자물쇠 찾기', duration: 60, resultTitle: '자물쇠 찾기 끝!', fov: 42, sky: '#a8dcf5',
    hint: `왼쪽 카드와 색·모양·고리가 모두 같은 자물쇠를 클릭! 틀리면 ${PENALTY}초 줄어요 — ${GOAL}개를 다 찾으면 남은 시간 보너스`,
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-5, 12, 12], size: 10 });
    this.tileGround(30, 18, () => 'path', 44).position.z = -2;
    // N서울타워 (뒤 배경)
    const T = new THREE.Group(); T.position.set(3.5, 0, -16);
    box(3, 1.4, 3, '#e8e2d6', 0, 0.7, 0, T);
    const cyl = (r0, r1, h, c, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 8), new THREE.MeshLambertMaterial({ color: c, flatShading: true })); m.position.y = y; T.add(m); };
    cyl(0.5, 0.7, 12, '#f4f4f2', 7.4); cyl(1.5, 1.2, 1.1, '#e9e6df', 14); cyl(1.55, 1.55, 0.25, '#6fa8d6', 14.1); cyl(1.1, 1.4, 0.7, '#dcd8cf', 14.9);
    for (let i = 0; i < 6; i++) cyl(0.14, 0.16, 0.9, i % 2 ? '#ffffff' : '#e8413a', 15.8 + i * 0.9);
    s.add(T);
    const r = rng(8);
    for (let i = 0; i < 18; i++) { const t = makeTree(r, i % 3 ? 'round' : 'maple'); t.position.set(-15 + i * 1.8 + r(), 0, -6 - r() * 6); t.scale.setScalar(1.3 + r() * 0.5); s.add(t); }
    // 울타리 (철망)
    const F = '#7a8088';
    box(12, 0.2, 0.2, F, 0, 1.4, -0.05, s); box(12, 0.2, 0.2, F, 0, 6.35, -0.05, s);
    for (let x = -6; x <= 6.01; x += 1.5) box(0.18, 6.0, 0.18, F, x, 3.4, -0.05, s);
    for (let x = -5.75; x < 6; x += 0.25) box(0.025, 4.8, 0.025, '#a0a6ae', x, 3.9, -0.1, s).castShadow = false;
    for (let y = 1.6; y < 6.3; y += 0.25) box(12, 0.025, 0.025, '#a0a6ae', 0, y, -0.1, s).castShadow = false;
    // 벤치 (소품)
    for (const x of [-8.5, 8.5]) { box(2, 0.12, 0.6, '#b5763b', x, 0.5, 1.5, s); box(0.12, 0.5, 0.5, '#5b3a22', x - 0.8, 0.25, 1.5, s); box(0.12, 0.5, 0.5, '#5b3a22', x + 0.8, 0.25, 1.5, s); }
    this.locks = [];
    // 카메라를 살짝 왼쪽에 둬서 왼쪽 '찾을 자물쇠' 카드와 울타리가 겹치지 않게
    this.camera.position.set(-1.5, 3.8, 11.5);
    this.camera.lookAt(-1.5, 3.7, 0);
  }

  onAvatar() { this.player.position.set(0, 0, 1.0); this.player.rotation.y = Math.PI; }

  reset() {
    this.found = 0; this.misses = 0; this.fast = 0; this.bonus = 0; this.next = 0; this.hover = null;
    this.walkX = 0; this.yaw = Math.PI;
    this.player.position.set(0, 0, 1.0);
    const card = document.createElement('div');
    card.className = 'panel small lock-card';
    card.innerHTML = '<h3>찾을 자물쇠</h3><canvas width="40" height="40"></canvas><div class="desc"></div><div class="prog"></div>';
    $('miniOverlay').appendChild(card);
    this.card = card;
    this.newRound();
  }

  // 판을 새로 깔기: 정답은 딱 1개, 라운드가 갈수록 비슷한(2가지가 같은) 가짜가 많아짐
  newRound() {
    for (const l of this.locks) this.scene.remove(l);
    this.locks = [];
    const target = randLock();
    this.target = target;
    const tk = key(target);
    const n = COLS * ROWS, ans = (Math.random() * n) | 0;
    const near = 0.2 + this.found * 0.09;
    for (let i = 0; i < n; i++) {
      let l;
      if (i === ans) l = target;
      else {
        do {
          if (Math.random() < near) {
            l = { ...target };
            const k = (Math.random() * 3) | 0;
            if (k === 0) l.color = COLORS[(Math.random() * 6) | 0]; else if (k === 1) l.shape = SHAPES[(Math.random() * 3) | 0]; else l.ring = RINGS[(Math.random() * 2) | 0];
          } else l = randLock();
        } while (key(l) === tk);
      }
      const m = makeLock(l);
      const c = i % COLS, rr = (i / COLS) | 0;
      m.position.set(-4.95 + c * 1.1 + (Math.random() - 0.5) * 0.18, 1.95 + rr * 0.74 + (Math.random() - 0.5) * 0.1, 0.12);
      m.rotation.z = (Math.random() - 0.5) * 0.35;
      m.userData.info = l; m.userData.answer = i === ans; m.userData.baseRot = m.rotation.z;
      this.scene.add(m); this.locks.push(m);
    }
    drawLock(this.card.querySelector('canvas'), target);
    this.card.querySelector('.desc').textContent = `${target.color.name} ${target.shape.name} · ${target.ring.name}`;
    this.card.querySelector('.prog').textContent = `${this.found} / ${GOAL}개 찾음`;
    this.roundT = 0;
  }

  pick(e, w, h) {
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const hit = this.ray.intersectObjects(this.locks.map((l) => l.userData.hit))[0];
    return hit?.object.userData.lock || null;
  }
  pointer(e, w, h) {
    if (this.state !== 'play' || this.next) return;
    const l = this.pick(e, w, h);
    if (l !== this.hover) { if (this.hover) this.hover.scale.setScalar(1); this.hover = l; if (l) l.scale.setScalar(1.25); }
    document.body.style.cursor = l ? 'pointer' : '';
  }
  pointerDown(e, w, h) {
    if (this.state !== 'play' || this.next) return;
    const l = this.pick(e, w, h);
    if (!l) return;
    this.walkX = THREE.MathUtils.clamp(l.position.x, -5, 5);
    const pos = l.position.clone().add(new THREE.Vector3(0, 0.6, 0.3));
    if (l.userData.answer) {
      this.found++;
      let pts = 15;
      if (this.roundT < 4) { pts += 5; this.fast++; }
      this.score += pts;
      sfx.gold();
      this.float(pos, this.roundT < 4 ? `찾았다! +${pts} 빨라요!` : `찾았다! +${pts}`, 'gold');
      l.scale.setScalar(1.6); l.userData.win = true;
      this.card.querySelector('.prog').textContent = `${this.found} / ${GOAL}개 찾음`;
      if (this.found >= GOAL) {
        this.bonus = Math.ceil(this.time) * 2;
        this.score += this.bonus;
        this.float(this.player.position.clone().add(new THREE.Vector3(0, 2.2, 0)), `전부 찾았어요! 남은 시간 +${this.bonus}`, 'gold');
        this.done = true;
        this.next = 0.9;
      } else this.next = 0.7;
    } else {
      this.misses++;
      this.time = Math.max(0, this.time - PENALTY);
      sfx.miss();
      this.float(pos, `이게 아니야! -${PENALTY}초`, 'bad');
      l.userData.shake = 0.4;
      const v = $('view'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake');
    }
  }

  idle(dt, t) {
    this.avatar.animate(dt, t, { yaw: this.yaw, wave: this.state === 'done' && this.found >= GOAL });
    for (const l of this.locks) l.rotation.z = l.userData.baseRot + Math.sin(t * 1.5 + l.position.x * 2 + l.position.y) * 0.04;
  }

  step(dt, t) {
    this.roundT += dt;
    // 캐릭터가 고른 자물쇠 앞으로 걸어감
    const p = this.player.position, dx = this.walkX - p.x;
    const moving = Math.abs(dx) > 0.05;
    if (moving) p.x += Math.sign(dx) * Math.min(Math.abs(dx), 5 * dt);
    this.yaw = moving ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI;
    this.avatar.animate(dt, t, { moving, yaw: this.yaw, wave: !!this.next });
    for (const l of this.locks) {
      const u = l.userData;
      let rz = u.baseRot + Math.sin(t * 1.5 + l.position.x * 2 + l.position.y) * 0.04;
      if (u.shake > 0) { u.shake -= dt; rz += Math.sin(u.shake * 60) * 0.3; }
      if (u.win) rz += Math.sin(t * 20) * 0.15;
      l.rotation.z = rz;
    }
    if (this.next) {
      this.next -= dt;
      if (this.next <= 0) { this.next = 0; this.hover = null; if (this.done) this.finish(); else this.newRound(); }
    }
  }

  finish() { document.body.style.cursor = ''; this.meta = { ...this.meta, resultTitle: this.found >= GOAL ? '자물쇠 전부 찾기 성공!' : '시간 끝!' }; super.finish(); }
  quit() { document.body.style.cursor = ''; super.quit(); }
  start() { this.meta = this.constructor.meta; this.done = false; super.start(); }

  extraText() { return `자물쇠 ${this.found}/${GOAL}`; }
  resultRows() {
    const rows = [['찾은 자물쇠', `${this.found}/${GOAL}개`], ['빨리 찾기 (4초 안)', `${this.fast}번`], ['틀린 클릭', `${this.misses}번`]];
    if (this.bonus) rows.push(['남은 시간 보너스', `+${this.bonus}`]);
    return rows;
  }
}
