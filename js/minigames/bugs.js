import * as THREE from 'three';
import { box, mat } from '../world.js';
import { rng, canvasTexture } from '../textures.js';

function keyTexture(k) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#3f1d0b'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#fff3d0'; g.fillRect(3, 3, 26, 26);
  g.fillStyle = '#3f1d0b'; g.font = '700 22px Galmuri11'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, 16, 18);
  return canvasTexture(c);
}
import { sfx } from '../sfx.js';
import { MiniGame, addFence } from './base.js';

const KEYS = [['KeyQ', 'KeyW', 'KeyE'], ['KeyA', 'KeyS', 'KeyD'], ['KeyZ', 'KeyX', 'KeyC']];
const NUMPAD = [['Numpad7', 'Numpad8', 'Numpad9'], ['Numpad4', 'Numpad5', 'Numpad6'], ['Numpad1', 'Numpad2', 'Numpad3']];
const GAP = 2.3;
const BUGS = {
  worm: { pts: 1, w: 62, label: '+1' },
  beetle: { pts: 3, w: 12, label: '+3 황금!' },
  lady: { pts: -2, w: 26, label: '-2 익충이에요!' },
};

function makeBug(kind) {
  const g = new THREE.Group();
  if (kind === 'worm') { // 초록 애벌레
    for (let i = 0; i < 4; i++) box(0.26, 0.26, 0.26, i % 2 ? '#7fcf4a' : '#5fae3e', 0, 0.13 + i * 0.2, -i * 0.04, g);
    box(0.06, 0.08, 0.04, '#222', -0.07, 0.8, 0.12, g); box(0.06, 0.08, 0.04, '#222', 0.07, 0.8, 0.12, g);
    box(0.04, 0.16, 0.04, '#3f8a2a', -0.08, 0.98, 0, g); box(0.04, 0.16, 0.04, '#3f8a2a', 0.08, 0.98, 0, g);
  } else if (kind === 'beetle') { // 황금 딱정벌레
    const gold = new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#7a5a00' });
    box(0.5, 0.5, 0.36, gold, 0, 0.4, 0, g); box(0.34, 0.24, 0.3, '#5b3a10', 0, 0.76, 0, g);
    box(0.02, 0.5, 0.02, '#3b2416', 0, 0.4, 0.19, g);
    box(0.06, 0.06, 0.04, '#fff', -0.08, 0.78, 0.16, g); box(0.06, 0.06, 0.04, '#fff', 0.08, 0.78, 0.16, g);
    box(0.04, 0.2, 0.04, '#3b2416', -0.12, 0.98, 0, g).rotation.z = 0.4; box(0.04, 0.2, 0.04, '#3b2416', 0.12, 0.98, 0, g).rotation.z = -0.4;
  } else { // 무당벌레 (때리면 감점)
    box(0.5, 0.46, 0.36, '#e8413a', 0, 0.38, 0, g); box(0.3, 0.22, 0.3, '#222', 0, 0.72, 0, g);
    box(0.02, 0.46, 0.02, '#222', 0, 0.38, 0.19, g);
    for (const [x, y] of [[-0.14, 0.5], [0.14, 0.5], [-0.12, 0.28], [0.12, 0.28]]) box(0.1, 0.1, 0.02, '#222', x, y, 0.19, g);
    box(0.06, 0.06, 0.04, '#fff', -0.07, 0.74, 0.15, g); box(0.06, 0.06, 0.04, '#fff', 0.07, 0.74, 0.15, g);
  }
  g.traverse((o) => (o.castShadow = true));
  g.scale.setScalar(1.35);
  return g;
}

// 벌레 잡기: 3×3 구멍에서 튀어나오는 벌레를 망치로 콩!
export class BugGame extends MiniGame {
  static meta = {
    id: 'bug', title: '벌레 잡기', duration: 40, resultTitle: '밭 지키기 끝!', fov: 40,
    hint: '구멍 클릭 또는 Q W E / A S D / Z X C — 애벌레·황금벌레는 콩! 무당벌레(빨강)는 때리지 마세요',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-6, 16, 10], size: 10 });
    this.tileGround(26, 20, (x, y) => (x >= 8 && x < 18 && y >= 5 && y < 15 ? 'soil' : 'grass'), 31);
    // 울타리 + 채소
    addFence(s, box, -6, -5.5, 6, -5.5); addFence(s, box, -6, -5.5, -6, 5.5); addFence(s, box, 6, -5.5, 6, 5.5);
    const r = rng(8);
    for (let i = 0; i < 16; i++) {
      const x = (i % 2 ? 1 : -1) * (4.6 + r() * 0.6), z = -4.5 + (i >> 1) * 1.2;
      box(0.3, 0.35, 0.3, '#5fae3e', x, 0.18, z, s);
      box(0.18, 0.22, 0.18, i % 3 ? '#ff8a2e' : '#e8413a', x, 0.05, z + 0.25, s);
    }
    // 구멍 3×3
    this.holes = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const x = (col - 1) * GAP, z = (row - 1) * GAP - 0.4;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.14, 10), mat('#8a5a35')); rim.position.set(x, 0.07, z); rim.receiveShadow = true;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 10), mat('#2b1a10')); hole.position.set(x, 0.08, z);
      const key = KEYS[row][col].replace('Key', '');
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: keyTexture(key) }));
      tag.rotation.x = -Math.PI / 2; tag.position.set(x + 0.7, 0.03, z + 0.6);
      s.add(rim, hole, tag);
      // 구멍 아래로 숨기기 위한 마스크 (흙 원통 안쪽은 비워두고 벌레를 y<0으로 내림)
      this.holes.push({ x, z, bug: null, row, col });
    }
    // 망치
    this.hammer = new THREE.Group();
    box(0.08, 0.9, 0.08, '#8a5428', 0, -0.45, 0, this.hammer);
    box(0.5, 0.3, 0.3, '#8f8f9a', 0, -0.95, 0, this.hammer);
    box(0.52, 0.06, 0.32, '#a5a5b5', 0, -0.82, 0, this.hammer);
    this.camera.position.set(0, 10.5, 8.5);
    this.camera.lookAt(0, 0, 0.2);
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  onAvatar() {
    const s = this.avatar.s;
    this.hammer.position.set(0, -7 * s, 0);
    this.hammer.rotation.x = -Math.PI / 2; // 손에서 앞으로
    this.avatar.joints.armR.add(this.hammer);
  }

  reset() {
    for (const h of this.holes) { if (h.bug) this.scene.remove(h.bug.mesh); h.bug = null; }
    this.player.position.set(0, 0, 3.6);
    this.target = null; this.swingT = 0; this.spawnT = 0.5; this.elapsed = 0;
    this.hits = 0; this.golden = 0; this.ladyHits = 0; this.yaw = Math.PI;
  }

  spawn() {
    const free = this.holes.filter((h) => !h.bug);
    if (!free.length) return;
    const h = free[(Math.random() * free.length) | 0];
    let x = Math.random() * 100, kind = 'worm';
    for (const k in BUGS) { if ((x -= BUGS[k].w) < 0) { kind = k; break; } }
    const mesh = makeBug(kind);
    mesh.position.set(h.x, -1.1, h.z);
    this.scene.add(mesh);
    const prog = this.elapsed / this.duration;
    h.bug = { kind, mesh, t: 0, up: 1.25 - prog * 0.6 + Math.random() * 0.3, hit: false };
  }

  // 입력: 키 또는 클릭 → 해당 구멍으로 뛰어가 망치질
  keyDown(code) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (KEYS[r][c] === code || NUMPAD[r][c] === code) this.whack(this.holes[r * 3 + c]);
  }
  pointerDown(e, w, h) {
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.groundPlane, p)) return;
    let best = null, bd = 1.3;
    for (const hole of this.holes) { const d = Math.hypot(hole.x - p.x, hole.z - p.z); if (d < bd) { bd = d; best = hole; } }
    // 벌레 몸통을 눌러도 인정 (화면상 구멍보다 위에 보이므로)
    if (!best) { for (const hole of this.holes) { const d = Math.hypot(hole.x - p.x, hole.z + 0.6 - p.z); if (d < bd) { bd = d; best = hole; } } }
    if (best) this.whack(best);
  }
  whack(hole) {
    if (this.state !== 'play' || this.swingT > 0.05) return;
    this.target = hole;
    this.from = this.player.position.clone();
    this.dest = new THREE.Vector3(hole.x - 0.15, 0, hole.z + 0.95);
    this.swingT = 0.001;
  }

  idle(dt, t) { this.avatar.animate(dt, t, { yaw: this.yaw }); this.armPose(dt); this.updateBugs(dt, false); }

  step(dt, t) {
    this.elapsed += dt;
    // 이동 + 망치 휘두르기 (0~0.12: 점프 이동, 0.12~0.2: 내려치기, ~0.35: 복귀)
    if (this.swingT > 0) {
      this.swingT += dt;
      const k = Math.min(1, this.swingT / 0.12);
      this.player.position.lerpVectors(this.from, this.dest, k);
      this.player.position.y = Math.sin(k * Math.PI) * 0.45;
      if (this.swingT >= 0.17 && !this.struck) { this.struck = true; this.strike(this.target); }
      if (this.swingT > 0.34) { this.swingT = 0; this.struck = false; }
    }
    this.avatar.animate(dt, t, { yaw: Math.PI, air: this.swingT > 0 && this.swingT < 0.12 });
    this.armPose(dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const prog = this.elapsed / this.duration;
      this.spawn();
      if (prog > 0.45 && Math.random() < 0.35) this.spawn();
      this.spawnT = Math.max(0.35, 0.85 - prog * 0.5) * (0.7 + Math.random() * 0.6);
    }
    this.updateBugs(dt, true);
  }

  armPose(dt) {
    const J = this.avatar.joints.armR;
    let target;
    if (this.swingT > 0 && this.swingT < 0.12) target = -2.9;        // 치켜들기
    else if (this.swingT >= 0.12 && this.swingT < 0.3) target = -0.6; // 내려치기
    else target = -1.1;
    J.rotation.x += (target - J.rotation.x) * Math.min(1, dt * 30);
    J.rotation.z = 0;
  }

  strike(hole) {
    sfx.miss();
    const b = hole.bug;
    // 망치 충격 링
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 12), new THREE.MeshBasicMaterial({ color: '#fff3d0', transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(hole.x, 0.2, hole.z); this.scene.add(ring);
    let rt = 0; const anim = () => { rt += 0.05; ring.scale.setScalar(1 + rt * 3); ring.material.opacity = 0.9 - rt * 2; if (rt < 0.45) requestAnimationFrame(anim); else this.scene.remove(ring); }; anim();
    if (!b || b.hit || b.mesh.position.y < -0.5) { this.combo = 0; return; }
    b.hit = true; b.t = Math.max(b.t, 99);
    const info = BUGS[b.kind];
    const pos = b.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    if (b.kind === 'lady') {
      this.score = Math.max(0, this.score + info.pts); this.combo = 0; this.ladyHits++;
      sfx.hurt(); this.float(pos, info.label, 'bad');
    } else {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const bonus = this.combo >= 5 ? 1 : 0;
      this.score += info.pts + bonus; this.hits++;
      if (b.kind === 'beetle') { this.golden++; sfx.gold(); } else sfx.catch(this.combo);
      this.float(pos, bonus ? `${info.label} 콤보+1` : info.label, b.kind === 'beetle' ? 'gold' : '');
    }
    b.mesh.scale.set(1.3, 0.35, 1.3); // 납작!
  }

  updateBugs(dt, live) {
    for (const h of this.holes) {
      const b = h.bug; if (!b) continue;
      b.t += dt;
      const m = b.mesh;
      let y;
      if (b.hit) { y = m.position.y - dt * 3; m.rotation.y += dt * 8; }
      else if (b.t < 0.15) y = -1.1 + (b.t / 0.15) * 1.1;               // 올라옴
      else if (b.t < 0.15 + b.up) y = Math.sin(b.t * 9) * 0.04;           // 꿈틀
      else y = -((b.t - 0.15 - b.up) / 0.18) * 1.1;                        // 내려감
      m.position.y = y;
      if (!b.hit && b.kind !== 'lady' && b.t > 0.15 + b.up && b.t < 0.15 + b.up + dt * 1.5 && live) { this.combo = 0; }
      if (y <= -1.1 || (b.hit && y < -1)) { this.scene.remove(m); h.bug = null; }
    }
  }

  extraText() { return this.combo >= 3 ? `${this.combo}콤보` : ''; }
  resultRows() {
    return [['잡은 벌레', `${this.hits}마리`], ['황금 딱정벌레', `${this.golden}마리`], ['실수로 때린 무당벌레', `${this.ladyHits}마리`], ['최대 콤보', this.maxCombo]];
  }
}
