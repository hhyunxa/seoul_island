import * as THREE from 'three';
import { box } from '../world.js';
import { signTexture, canvasTexture, rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';

const $ = (id) => document.getElementById(id);
const TOP = 63;                 // 63층에 닿으면 끝
const SX = 1.0, SY = 0.5;       // 계단 한 칸: 옆으로 / 위로
const ME = 0.5;                 // 캐릭터 크기 (두 칸 위 계단에 머리가 닿지 않게: 키 0.8 < 2×SY − 계단 두께)
const GOLD = '#e2b94e', GOLD2 = '#f6dc8a', GOLD3 = '#b98f2a', WALL = '#b98f2a', STEP = '#ffd86a';
const CLIMB_KEYS = ['ArrowRight', 'KeyD', 'KeyJ', 'Space'];
const TURN_KEYS = ['ArrowLeft', 'KeyA', 'KeyF'];
const HOP_T = 0.09;             // 한 칸 올라가는 데 걸리는 시간 (초)

// 멀리 보이는 서울 (한강 + 건물 불빛) — 올라갈수록 천천히 아래로 내려감
function skylineTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'), r = rng(63);
  const sky = g.createLinearGradient(0, 0, 0, 128); sky.addColorStop(0, '#7fc4ef'); sky.addColorStop(1, '#d6eefa');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#9bb6c8'; for (let x = 0; x < 256; x += 6) { const h = 8 + r() * 14; g.fillRect(x, 70 - h, 5, h); } // 먼 건물
  g.fillStyle = '#5fa8e0'; g.fillRect(0, 74, 256, 16);                                                       // 한강
  g.fillStyle = '#8fd0f5'; for (let x = 0; x < 256; x += 9) g.fillRect(x + (r() * 4 | 0), 78 + (r() * 9 | 0), 4, 1);
  g.fillStyle = '#c8b98a'; g.fillRect(0, 90, 256, 3);                                                        // 강변
  g.fillStyle = '#6f8a6a'; g.fillRect(0, 93, 256, 35);
  for (let x = 0; x < 256; x += 7) {                                                                          // 가까운 건물
    const h = 6 + r() * 20, w = 5 + (r() * 3 | 0);
    g.fillStyle = ['#c9d6e3', '#e3d9c6', '#b8c4cf', '#f2efe6'][(r() * 4) | 0]; g.fillRect(x, 128 - h, w, h);
    g.fillStyle = '#6fa8d6'; for (let y = 128 - h + 2; y < 126; y += 3) g.fillRect(x + 1, y, w - 2, 1);
  }
  return canvasTexture(c);
}

// 63빌딩 무한의 계단: 오르기 / 방향 바꾸기 두 버튼으로 지그재그 계단을 63층까지!
export class StairsGame extends MiniGame {
  static meta = {
    id: 'stairs', title: '63빌딩 무한의 계단', duration: 0, hearts: 3, fov: 40, sky: '#9fd8f5',
    hint: '→ · D · J · Space = 오르기 / ← · A · F = 방향 바꾸기 — 다음 계단이 반대쪽이면 방향을 바꿔요! 힘 막대가 비기 전에 63층까지',
  };

  build() {
    const s = this.scene;
    s.fog = new THREE.Fog('#bfe3f7', 30, 70);
    this.sunL = this.lights({ pos: [-4, 14, 10], size: 10, intensity: 1.9 });
    this.sunTarget = new THREE.Object3D(); s.add(this.sunTarget); this.sun.target = this.sunTarget;
    // 멀리 서울 풍경 (시차)
    this.back = new THREE.Mesh(new THREE.PlaneGeometry(110, 55), new THREE.MeshBasicMaterial({ map: skylineTexture(), fog: false }));
    this.back.position.set(0, 4, -30); s.add(this.back);
    // 구름 (높이 올라가면 옆을 지나감)
    this.clouds = [];
    const r = rng(7);
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) box(1.2 + r() * 1.2, 0.5 + r() * 0.4, 0.8, new THREE.MeshBasicMaterial({ color: '#ffffff' }), k * 0.9 - 0.9, r() * 0.3, 0, c);
      c.position.set(-9 + r() * 18, 6 + i * 2.4, -6 - r() * 4);
      c.traverse((o) => (o.castShadow = false));
      s.add(c); this.clouds.push(c);
    }
    // 63빌딩 금빛 외벽 (계단은 그 바깥을 지그재그로 오름)
    const H = TOP * SY + 3;
    box(18, H, 0.4, WALL, 0, H / 2 - 0.5, -1.6, s).receiveShadow = true;
    for (let y = 0.4; y < H; y += SY * 2) { const b = box(18.02, 0.06, 0.42, '#8a6a20', 0, y, -1.6, s); b.castShadow = false; }
    for (let x = -8; x <= 8; x += 1.6) { const b = box(0.08, H, 0.43, GOLD, x, H / 2 - 0.5, -1.6, s); b.castShadow = false; }
    this.stairGroup = new THREE.Group(); s.add(this.stairGroup);
    this.fx = [];
    this.camera.position.set(0, 2, 8);
  }

  onAvatar() { this.player.position.set(0, 0, 0); this.player.scale.setScalar(ME); }

  // 계단 만들기: 같은 방향으로 1~5칸씩 가다가 꺾임 (너무 멀리 가면 돌아옴)
  makeStairs() {
    this.stairGroup.clear();
    this.stairs = [{ x: 0, y: 0, dir: 0 }];
    let dir = Math.random() < 0.5 ? 1 : -1, run = 0, runLen = 1 + ((Math.random() * 3) | 0);
    for (let i = 1; i <= TOP; i++) {
      const prev = this.stairs[i - 1];
      if (run >= runLen || Math.abs(prev.x + dir * SX) > 5) { dir = -dir; run = 0; runLen = 1 + ((Math.random() * 5) | 0); }
      run++;
      this.stairs.push({ x: prev.x + dir * SX, y: i * SY, dir });
    }
    const glass = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#5a4210' });
    this.stairs.forEach((st, i) => {
      if (i === TOP) { // 63층 전망대 발판
        box(2.6, 0.3, 1.4, GOLD, st.x, st.y - 0.15, 0, this.stairGroup);
        for (const dx of [-1.25, 1.25]) box(0.08, 0.6, 0.08, '#ffffff', st.x + dx, st.y + 0.3, 0.6, this.stairGroup);
        box(2.6, 0.06, 0.06, '#ffffff', st.x, st.y + 0.6, 0.6, this.stairGroup);
        const sg = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.06), new THREE.MeshBasicMaterial({ map: signTexture('63 전망대', { w: 80, h: 20, size: 12, bg: '#fff8e6' }) }));
        sg.position.set(st.x, st.y + 2.0, -1.35); this.stairGroup.add(sg);
        return;
      }
      box(1.1, 0.16, 1.0, i === 0 ? '#c9c4b8' : STEP, st.x, st.y - 0.08, 0, this.stairGroup);
      if (i > 0) box(1.12, 0.04, 1.02, glass, st.x, st.y + 0.005, 0, this.stairGroup);
      if (i > 0 && i % 10 === 0) { // 10층마다 층 표시
        const sg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.05), new THREE.MeshBasicMaterial({ map: signTexture(`${i}F`, { w: 40, h: 18, size: 12, bg: '#2a2a2e', fg: '#ffe14f' }) }));
        sg.position.set(st.x, st.y + 1.0, -1.35); this.stairGroup.add(sg);
      }
    });
  }

  reset() {
    this.makeStairs();
    for (const f of this.fx) this.scene.remove(f.m);
    this.fx = [];
    this.idx = 0; this.facing = 1; this.energy = 1; this.elapsed = 0; this.slips = 0; this.cleared = false; this.reason = '';
    this.hop = null; this.stumble = 0;
    this.player.position.set(0, 0, 0); this.player.rotation.set(0, Math.PI / 2, 0);
    this.camPos = new THREE.Vector3(0, 2, 8); this.camLook = new THREE.Vector3(0, 1, 0);
    // 화면 위 층수 + 힘 막대 + 버튼 안내
    const o = $('miniOverlay');
    const fl = document.createElement('div'); fl.className = 'st-floor'; o.appendChild(fl); this.floorEl = fl;
    const en = document.createElement('div'); en.className = 'st-energy'; en.innerHTML = '<span>힘</span><div><i></i></div>'; o.appendChild(en); this.energyEl = en.querySelector('i');
    const keys = document.createElement('div'); keys.className = 'st-keys';
    keys.innerHTML = '<div class="turn"><b>←</b><b>A</b><b>F</b>↩️ 방향 바꾸기</div><div class="up"><b>→</b><b>D</b><b>J</b><b>Space</b>⬆️ 오르기</div>';
    o.appendChild(keys);
    this.renderHudExtra();
  }

  keyDown(code) {
    if (CLIMB_KEYS.includes(code)) this.climb(false);
    else if (TURN_KEYS.includes(code)) this.climb(true);
  }
  // 터치·클릭: 화면 왼쪽 = 방향 바꾸기, 오른쪽 = 오르기
  pointerDown(e, w) { this.climb(e.clientX < w / 2); }

  climb(turn) {
    if (this.state !== 'play' || this.cleared) return;
    if (this.hop) this.endHop(); // 빠르게 연타하면 이전 칸 움직임은 바로 끝냄
    const want = turn ? -this.facing : this.facing;
    const next = this.stairs[this.idx + 1];
    if (next.dir === want) {
      const from = this.player.position.clone();
      this.facing = want; this.idx++;
      this.hop = { from, to: new THREE.Vector3(next.x, next.y, 0), t: 0 };
      this.energy = Math.min(1, this.energy + 0.055);
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score = this.idx * 2;
      sfx.step(); if (this.idx % 10 === 0) { sfx.coin(); this.float(new THREE.Vector3(next.x, next.y + 2, 0), `${this.idx}층!`, 'gold'); }
      if (this.idx >= TOP) this.clear();
    } else {
      // 미끄러짐: 하트 하나, 제자리에서 휘청
      this.slips++; this.stumble = 0.45;
      this.hurt(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)), turn ? '앗, 그쪽이 아니에요!' : '미끄덩! 방향을 바꿔요');
    }
    this.renderHudExtra();
  }
  endHop() { this.player.position.copy(this.hop.to); this.hop = null; }

  clear() {
    this.cleared = true;
    const sec = this.elapsed;
    this.score = TOP * 2 + 50 + Math.max(0, Math.round(60 - sec));
    sfx.gold();
    this.float(new THREE.Vector3(this.stairs[TOP].x, TOP * SY + 2.4, 0), '63층 전망대 도착!', 'gold');
    this.fireworks();
    this.renderHud(); // 끝나는 순간의 층수·점수를 위에도 바로 반영
    this.finish();
  }

  // 불꽃놀이: 63층 위에서 색색 조각이 터짐
  fireworks() {
    const top = this.stairs[TOP], cols = ['#ff6ec7', '#ffe14f', '#7fd8ff', '#a5e07f', '#ff8a5c'];
    for (let b = 0; b < 5; b++) {
      const cx = top.x + (Math.random() - 0.5) * 6, cy = top.y + 3 + Math.random() * 3, c = cols[b % cols.length];
      for (let i = 0; i < 14; i++) {
        const m = box(0.12, 0.12, 0.12, new THREE.MeshBasicMaterial({ color: c }), cx, cy, -0.5, this.scene); m.castShadow = false;
        const a = (i / 14) * Math.PI * 2;
        this.fx.push({ m, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, t: -b * 0.25 });
      }
    }
  }

  renderHudExtra() {
    if (!this.floorEl) return;
    this.floorEl.innerHTML = `<b>${this.idx}</b>층 <small>/ ${TOP}</small>`;
  }

  // 공통: 카메라·배경·연출
  view(dt, t) {
    const p = this.player.position;
    const done = this.state === 'done' && this.cleared;
    // 평소엔 캐릭터 조금 위·앞(가는 방향)을 보고, 63층에 오르면 뒤로 쭉 빠져서 빌딩 꼭대기와 한강을 보여 줌
    const look = new THREE.Vector3(p.x + this.facing * 0.6, p.y + 0.7, 0);
    const pos = done ? new THREE.Vector3(p.x, p.y + 3, 18) : new THREE.Vector3(p.x * 0.6, p.y + 2.2, 7.6);
    const k = 1 - Math.exp(-dt * (done ? 1.5 : 6));
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.back.position.y = 4 + this.camPos.y * 0.82; // 멀리 있는 서울은 천천히 아래로
    this.back.position.x = this.camPos.x * 0.9;
    for (const c of this.clouds) c.position.x += Math.sin(t * 0.2 + c.position.y) * dt * 0.3;
    this.sun.position.set(p.x - 4, p.y + 14, 10); this.sunTarget.position.set(p.x, p.y, 0);
    // 불꽃
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t += dt;
      if (f.t < 0) { f.m.visible = false; continue; }
      f.m.visible = true; f.vy -= 2.5 * dt;
      f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt;
      if (f.t > 1.6) { this.scene.remove(f.m); f.m.geometry.dispose(); this.fx.splice(i, 1); }
    }
  }

  idle(dt, t) {
    const done = this.state === 'done';
    this.player.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.avatar.animate(dt, t, { armsUp: done && this.cleared, wave: done && !this.cleared });
    if (this.hop) this.endHop();
    if (this.camPos) this.view(dt, t);
  }

  step(dt, t) {
    this.elapsed += dt;
    // 힘: 계속 줄어들고, 올라갈수록 더 빨리 (처음 5층은 천천히)
    const drain = this.idx < 5 ? 0.04 : 0.08 + this.idx * 0.0025;
    this.energy -= drain * dt;
    this.energyEl.style.width = `${Math.max(0, this.energy) * 100}%`;
    this.energyEl.parentElement.parentElement.classList.toggle('low', this.energy < 0.3);
    if (this.energy <= 0 && !this.cleared) {
      this.energy = 0; this.reason = 'energy';
      this.float(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)), '힘이 다 빠졌어요…', 'bad');
      sfx.hurt();
      this.finish();
      return;
    }
    // 한 칸 오르기 움직임 (살짝 폴짝)
    if (this.hop) {
      this.hop.t += dt / HOP_T;
      const k = Math.min(1, this.hop.t);
      this.player.position.lerpVectors(this.hop.from, this.hop.to, k);
      this.player.position.y += Math.sin(k * Math.PI) * 0.18;
      if (k >= 1) this.hop = null;
    }
    // 휘청 (미끄러짐)
    if (this.stumble > 0) { this.stumble -= dt; this.player.rotation.z = Math.sin(this.stumble * 40) * 0.25 * (this.stumble / 0.45); }
    else this.player.rotation.z = 0;
    this.player.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.avatar.animate(dt, t, { moving: !!this.hop, run: true });
    this.view(dt, t);
  }

  resultTitle() { return this.cleared ? '63층 전망대 도착!' : `${this.idx}층에서 멈췄어요`; }
  extraText() { return this.state === 'countdown' || this.idx === undefined ? '' : `${this.idx}층 · 연속 ${this.combo}`; }
  resultRows() {
    return [
      ['오른 층', `${this.idx}층 / ${TOP}층${this.cleared ? ' 🎉' : ''}`],
      ['걸린 시간', `${this.elapsed.toFixed(1)}초`],
      ['미끄러짐', `${this.slips}번${this.reason === 'energy' ? ' · 힘이 다 빠짐' : ''}`],
      ['최고 연속 오르기', `${this.maxCombo}칸`],
    ];
  }
}
