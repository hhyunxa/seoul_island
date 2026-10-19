import * as THREE from 'three';
import { rbox, toonMat } from '../toon.js';
import { box, makeTree } from '../world.js';
import { Avatar } from '../character.js';
import { waterTexture, signTexture, rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

const $ = (id) => document.getElementById(id);
const L = 220;               // 결승선까지 거리 (-z 방향)
const HW = 7;                // 물길 반폭
const MAX_V = 9.5;
const BOATS = [
  { name: '노랑', body: '#ffd23f', dark: '#e0a91e' }, { name: '하양', body: '#f6f3ea', dark: '#cfc8b8' },
  { name: '분홍', body: '#ff9ec4', dark: '#e0709a' }, { name: '하늘', body: '#7fc8f0', dark: '#4f98c8' },
  { name: '연두', body: '#a5e07f', dark: '#6fb04a' }, { name: '보라', body: '#c39bf0', dark: '#9367c8' },
];
const RIVALS = ['뚝섬오리', '성수번개', '응봉페달', '왕십리킥', '한강꽥꽥'];

function makeDuckBoat(c) {
  const g = new THREE.Group();
  box(1.3, 0.5, 2.0, c.body, 0, 0.1, 0, g);
  box(1.4, 0.18, 2.1, c.dark, 0, -0.1, 0, g);
  box(1.0, 0.12, 0.9, '#5b3a22', 0, 0.36, 0.25, g);            // 좌석
  box(0.5, 0.6, 0.5, c.body, 0, 0.6, -0.95, g);                 // 목
  box(0.62, 0.55, 0.62, c.body, 0, 1.1, -1.05, g);              // 머리
  box(0.4, 0.14, 0.3, '#f28c28', 0, 1.02, -1.45, g);            // 부리
  for (const x of [-0.32, 0.32]) box(0.06, 0.1, 0.1, '#222222', x, 1.2, -1.2, g);
  box(0.7, 0.35, 0.3, c.body, 0, 0.45, 1.05, g);                // 꼬리
  for (const x of [-0.7, 0.7]) { const w = box(0.12, 0.3, 1.0, c.dark, x, 0.3, 0.1, g); w.rotation.x = -0.15; }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// 오리배 레이스: Space/W 연타로 페달, A/D로 방향 — 최대 6척
export class DuckBoatGame extends MiniGame {
  static meta = {
    id: 'duckboat', title: '오리배 레이스', duration: 70, resultTitle: '레이스 끝!', fov: 50, sky: '#9fd8f5',
    hint: 'Space · W · ↑ 연타 = 페달 · A/D · ←/→ = 방향 — 부표에 부딪히면 느려지고, 초록 물살을 타면 빨라져요!',
  };

  build() {
    this.camCtl = new CamControl(this, {
      hint: '✋✋ 두 손을 앞으로 내밀고 오리처럼 첨벙첨벙! 손을 아래로 휙 내릴 때마다 앞으로 · 두 손을 왼쪽/오른쪽으로 옮기면 방향',
      onEvent: (type, h) => { if (type === 'stroke') this.paddle(h); },
    });
    this.splashes = [];
    const s = this.scene;
    s.fog = new THREE.Fog('#9fd8f5', 40, 95);
    this.lights({ pos: [-8, 20, 6], size: 20 });
    this.sunTarget = new THREE.Object3D(); s.add(this.sunTarget); this.sun.target = this.sunTarget;
    // 강물
    const wt = waterTexture(); wt.repeat.set(30, 120); this.waterTex = wt;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60, L + 80), toonMat({ map: wt }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.15, -L / 2); water.receiveShadow = true; s.add(water);
    // 양쪽 둔치 (잔디 + 모래 + 산책로)
    for (const sx of [-1, 1]) {
      box(14, 0.6, L + 80, '#6cbb48', sx * (HW + 9), 0.0, -L / 2, s).castShadow = false;
      box(2, 0.4, L + 80, '#ecd89c', sx * (HW + 1.2), -0.05, -L / 2, s).castShadow = false;
      box(1.6, 0.62, L + 80, '#c9a26b', sx * (HW + 4.5), 0.01, -L / 2, s).castShadow = false;
    }
    const r = rng(33);
    for (let z = 20; z > -L - 40; z -= 3.2) for (const sx of [-1, 1]) {
      if (r() < 0.25) continue;
      const t = makeTree(r, r() < 0.3 ? 'pine' : r() < 0.6 ? 'ginkgo' : 'round');
      t.position.set(sx * (HW + 7 + r() * 6), 0.3, z + r() * 2); s.add(t);
    }
    // 레인 줄 (작은 부표 줄)
    for (let z = 0; z > -L; z -= 2) for (const x of [-HW, HW]) box(0.22, 0.2, 0.22, (z / 2) % 2 ? '#ffffff' : '#e8413a', x, -0.05, z, s);
    // 다리 (성수대교 느낌의 트러스)
    const bz = -L * 0.55, br = new THREE.Group(); br.position.z = bz;
    box(60, 0.5, 3, '#9a9590', 0, 4.2, 0, br); box(60, 0.15, 3.1, '#5a5a5a', 0, 4.5, 0, br);
    for (let x = -26; x <= 26; x += 4) { const d = box(0.18, 3, 0.18, '#3f6fb8', x, 5.9, 1.4, br); d.rotation.z = (x / 4) % 2 ? 0.7 : -0.7; box(0.18, 3, 0.18, '#3f6fb8', x, 5.9, -1.4, br).rotation.z = d.rotation.z; }
    box(60, 0.2, 0.2, '#3f6fb8', 0, 7.2, 1.4, br); box(60, 0.2, 0.2, '#3f6fb8', 0, 7.2, -1.4, br);
    for (const x of [-10, 10]) box(1.4, 4.4, 2.4, '#bdb6aa', x, 2.0, 0, br);
    s.add(br);
    this.pillars = [-10, 10].map((x) => ({ x, z: bz, hw: 0.9, hd: 1.4 }));
    // 출발선 / 결승선
    const gate = (z, text, bg) => {
      const g = new THREE.Group(); g.position.z = z;
      for (const x of [-HW - 0.6, HW + 0.6]) { box(0.35, 4, 0.35, '#f4ead8', x, 1.8, 0, g); box(0.5, 0.4, 0.5, '#e8413a', x, 3.9, 0, g); }
      if (text) {
        const b = new THREE.Mesh(rbox(2 * HW + 1.2, 0.9, 0.1), toonMat({ map: signTexture(text, { w: 160, h: 22, size: 14, bg }) }));
        b.position.y = 3.4; g.add(b);
      }
      for (let i = 0; i < 14; i++) box(1, 0.04, 0.5, i % 2 ? '#222' : '#fff', -HW + 0.5 + i, -0.08, 0, g).castShadow = false;
      s.add(g);
    };
    gate(0.5, null); // 출발선 (현수막은 화면을 가려서 생략)
    gate(-L, '결승선', '#7fd14f');
    this.items = [];
    this.boats = [];
    this.makeBoats(6);
    this.camera.position.set(0, 6, 9);
  }

  // 참가 인원 고르기 (2~6척) → 그다음에 카운트다운
  start() {
    if (!this.chosen) { super.start(); return; } // 설명 화면 먼저 (base.showIntro → 고르면 다시 여기로)
    this.meta = this.constructor.meta;
    this.state = 'setup';
    $('miniOverlay').innerHTML = '';
    this.setupHud();
    $('timerBox').classList.add('hidden');
    $('miniScore').textContent = 0; $('miniCombo').textContent = '';
    this.layout(this.n || 6);
    const pick = document.createElement('div');
    pick.className = 'panel duck-pick';
    pick.innerHTML = `<h3>몇 척이서 겨룰까요?</h3><div class="btn-row">${[2, 3, 4, 5, 6].map((n) => `<button class="btn${n === (this.n || 6) ? ' green' : ''}" data-n="${n}">${n}척</button>`).join('')}</div><p>숫자키 2~6 으로도 고를 수 있어요 · 나 포함</p>`;
    pick.onclick = (e) => {
      const n = +e.target.dataset?.n; if (n) this.begin(n);
    };
    $('miniOverlay').appendChild(pick);
  }
  // 게임 중 조작을 바꾸면 인원 고르기는 건너뛰고 바로 다시 시작
  restart() { this.state = 'setup'; this.begin(this.n || 6); }
  begin(n) {
    if (this.state !== 'setup') return;
    sfx.click();
    this.n = n; this.chosen = true;
    super.start();
  }
  keyDown(code) {
    if (this.state === 'setup') { const m = /^Digit([2-6])$/.exec(code); if (m) this.begin(+m[1]); if (code === 'Enter' || code === 'Space') this.begin(this.n || 6); return; }
    if (this.state !== 'play' || this.me.done) return;
    if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
      // 연타할수록 빨라짐. 너무 같은 박자로만 눌러도 OK — 단, 누를 때마다 조금씩
      this.me.v = Math.min(MAX_V, this.me.v + 0.85);
      this.me.pedal = 0.25;
      if (Math.random() < 0.3) sfx.step();
    }
  }
  // 손으로 첨벙: 손 하나 내릴 때마다 키 한 번만큼 + 그쪽 뱃전에 물보라
  paddle(h) {
    if (this.state !== 'play' || this.me.done) return;
    this.keyDown('Space');
    sfx.drum('kick');
    const side = h.x < 0.5 ? -1 : 1; // 화면 왼쪽 손 → 배 왼쪽
    this.me.slap = { side, t: 0.3 };
    const p = this.me.g.position;
    for (let i = 0; i < 10; i++) {
      const m = box(0.18, 0.18, 0.18, '#e8f8ff', p.x + side * (0.7 + Math.random() * 0.3), 0.15, p.z - 0.2 + (Math.random() - 0.5) * 0.8, this.scene);
      m.castShadow = false;
      this.splashes.push({ m, vx: side * (0.5 + Math.random()), vy: 2.5 + Math.random() * 1.5, vz: (Math.random() - 0.5), t: 0 });
    }
  }
  pointerDown() { this.keyDown('Space'); }

  makeBoats(n) {
    for (let i = 0; i < n; i++) {
      const g = makeDuckBoat(BOATS[i]);
      this.scene.add(g);
      const b = { g, i, color: BOATS[i], x: 0, z: 0, v: 0, steer: 0, done: false, rank: 0, finishT: 0, bump: 0, boost: 0, pedal: 0, user: i === 0 };
      if (!b.user) {
        const av = new Avatar(npcSkin({ shirt: ['#3f7fe0', '#e04a3a', '#3fbf6a', '#f28c28', '#9b5de5'][i - 1], pants: '#3a3f4a', hair: HAIRS[i % HAIRS.length], skin: TONES[i % TONES.length] }), { height: 1.4 });
        av.root.position.set(0, -0.15, 0.3); av.root.rotation.y = Math.PI; g.add(av.root);
        b.av = av; b.name = RIVALS[i - 1];
      }
      this.boats.push(b);
    }
    this.me = this.boats[0];
  }
  onAvatar() {
    // 이전 판의 내 아바타는 배에 붙어 있으므로 직접 떼어냄
    for (const c of [...this.me.g.children]) if (c.userData.rider) this.me.g.remove(c);
    this.player.userData.rider = true;
    this.player.position.set(0, -0.15, 0.3);
    this.player.rotation.y = Math.PI;
    this.player.scale.setScalar(1.4 / 1.6);
    this.me.g.add(this.player);
    this.me.av = this.avatar;
  }
  layout(n) {
    // 플레이어는 가운데 쪽 레인
    const lanes = Array.from({ length: n }, (_, i) => -((n - 1) * 1.1) + i * 2.2);
    const order = [Math.floor((n - 1) / 2), ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== Math.floor((n - 1) / 2))];
    this.boats.forEach((b, i) => {
      b.g.visible = i < n;
      if (i >= n) return;
      b.x = lanes[order[i]]; b.z = 2; b.v = 0; b.steer = 0; b.done = false; b.rank = 0; b.finishT = 0; b.bump = 0; b.boost = 0; b.pedal = 0;
      b.g.position.set(b.x, 0, b.z); b.g.rotation.set(0, 0, 0);
      if (!b.user) { b.skill = 6.2 + Math.random() * 1.4 + (i === 1 ? 0.4 : 0); b.wob = Math.random() * 6; b.aim = b.x; }
    });
    this.racers = this.boats.slice(0, n);
    this.cam(1);
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.m);
    this.items = [];
    const r = rng((Math.random() * 1e6) | 0);
    // 부표·통나무(감속), 초록 물살(가속)
    for (let z = -14; z > -L + 6; z -= 5 + r() * 4) {
      const k = r();
      const x = (r() * 2 - 1) * (HW - 1.2);
      if (k < 0.62) {
        const m = new THREE.Group();
        if (r() < 0.6) { box(0.7, 0.7, 0.7, '#f28c28', 0, 0.15, 0, m); box(0.75, 0.15, 0.75, '#ffffff', 0, 0.3, 0, m); box(0.1, 0.6, 0.1, '#333', 0, 0.8, 0, m); }
        else { const lg = box(2.2, 0.4, 0.5, '#8a5428', 0, 0, 0, m); lg.rotation.y = r() - 0.5; box(0.42, 0.42, 0.06, '#c9a26b', 1.1, 0, 0, m); }
        m.position.set(x, 0, z); this.scene.add(m);
        this.items.push({ m, kind: 'buoy', x, z, r: 0.8 });
      } else {
        const m = new THREE.Group();
        for (let i = 0; i < 3; i++) { const a = box(0.9, 0.04, 0.3, '#7fd14f', 0, -0.06, -i * 0.7, m); a.castShadow = false; box(0.3, 0.04, 0.5, '#7fd14f', -0.35, -0.06, -i * 0.7 + 0.2, m).rotation.y = 0.8; box(0.3, 0.04, 0.5, '#7fd14f', 0.35, -0.06, -i * 0.7 + 0.2, m).rotation.y = -0.8; }
        m.position.set(x, 0, z); this.scene.add(m);
        this.items.push({ m, kind: 'boost', x, z, r: 1.0 });
      }
    }
    this.layout(this.n);
    this.finished = 0; this.endT = 0; this.myRank = 0;
  }

  cam(snap = 0) {
    const p = this.me.g.position;
    const want = new THREE.Vector3(p.x * 0.6, 5.5, p.z + 8.5);
    this.camera.position.lerp(want, snap || 0.12);
    this.camera.lookAt(p.x * 0.8, 0.5, p.z - 7);
    this.sun.position.set(p.x - 8, 20, p.z + 6); this.sunTarget.position.set(p.x, 0, p.z);
  }

  idle(dt, t) {
    this.waterTex.offset.y = (t * 0.05) % 1;
    for (const b of this.racers || []) {
      b.g.position.y = Math.sin(t * 2.4 + b.i) * 0.05;
      b.g.rotation.z = Math.sin(t * 1.7 + b.i) * 0.03;
      b.av?.animate(dt, t, { wave: this.state === 'done' && b.done && b.rank === 1 });
    }
    if (this.me) this.cam();
  }

  step(dt, t) {
    this.waterTex.offset.y = (t * 0.05) % 1;
    let dir = (this.keysRef.has('KeyA') || this.keysRef.has('ArrowLeft') ? -1 : 0) + (this.keysRef.has('KeyD') || this.keysRef.has('ArrowRight') ? 1 : 0);
    // 손으로 하기: 두 손(가운데)을 왼쪽/오른쪽으로 옮기면 방향
    const hc = this.camCtl.on && this.camCtl.hands.center();
    if (hc && !dir) dir = hc.x < 0.38 ? -1 : hc.x > 0.62 ? 1 : 0;
    this.me.steer = dir;
    // 물보라
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const sp = this.splashes[i]; sp.t += dt; sp.vy -= 12 * dt;
      sp.m.position.x += sp.vx * dt; sp.m.position.y += sp.vy * dt; sp.m.position.z += sp.vz * dt - this.me.v * dt * 0.3;
      if (sp.t > 0.6 || sp.m.position.y < -0.1) { this.scene.remove(sp.m); sp.m.geometry.dispose(); this.splashes.splice(i, 1); }
    }
    for (const b of this.racers) {
      if (!b.user) this.aiStep(b, dt, t);
      // 물의 저항
      const drag = b.done ? 1.6 : 0.75;
      b.v *= Math.exp(-drag * dt);
      if (b.boost > 0) { b.boost -= dt; b.v = Math.min(MAX_V + 2.5, b.v + 9 * dt); }
      if (b.bump > 0) b.bump -= dt;
      b.pedal = Math.max(0, b.pedal - dt);
      b.x += b.steer * (2.6 + b.v * 0.25) * dt;
      b.x = THREE.MathUtils.clamp(b.x, -HW + 0.75, HW - 0.75);
      b.z -= b.v * dt;
      // 다리 기둥
      for (const pl of this.pillars) if (Math.abs(b.x - pl.x) < pl.hw + 0.6 && Math.abs(b.z - pl.z) < pl.hd + 0.9) { b.x += Math.sign(b.x - pl.x || 1) * 0.15; b.v *= 0.9; }
      // 장애물 / 물살
      for (const it of this.items) {
        if (Math.abs(b.z - it.z) > 1.2 || Math.abs(b.x - it.x) > it.r + 0.5) continue;
        if (it.kind === 'buoy' && b.bump <= 0) {
          b.v *= 0.35; b.bump = 0.8; b.x += Math.sign(b.x - it.x || 1) * 0.6;
          if (b.user) { sfx.hurt(); this.float(b.g.position.clone().add(new THREE.Vector3(0, 2, 0)), '쿵!', 'bad'); const v = $('view'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake'); }
        } else if (it.kind === 'boost' && b.boost <= 0) {
          b.boost = 0.7;
          if (b.user) { sfx.catch(8); this.float(b.g.position.clone().add(new THREE.Vector3(0, 2, 0)), '물살 부스트!', 'gold'); }
        }
      }
      // 결승
      if (!b.done && b.z <= -L) {
        b.done = true; this.finished++; b.rank = this.finished; b.finishT = this.duration - this.time;
        if (b.user) { this.myRank = b.rank; sfx.gold(); this.float(b.g.position.clone().add(new THREE.Vector3(0, 2.4, 0)), `${b.rank}위 골인!`, 'gold'); this.endT = 1.6; }
      }
      b.g.position.set(b.x, Math.sin(t * 2.4 + b.i) * 0.05, b.z);
      b.g.rotation.y = -b.steer * 0.25;
      b.g.rotation.z = Math.sin(t * 1.7 + b.i) * 0.03 + b.steer * 0.05;
      b.g.rotation.x = Math.min(0.08, b.v * 0.008);
      b.av?.animate(dt, t, { moving: b.v > 1 && !b.done, run: b.v > 6, armsUp: b.done && b.rank <= 3 });
      // 손으로 할 때 내 캐릭터도 두 팔을 내밀고 첨벙첨벙 (뒤에서 보므로 화면 왼쪽 팔 = armR)
      if (b.user && b.av && this.camCtl.on && !b.done) {
        const J = b.av.joints, s = b.slap; if (s) { s.t -= dt; if (s.t <= 0) b.slap = null; }
        const arm = (j, side) => { j.rotation.x = -1.5 + (b.slap?.side === side ? 0.9 * (b.slap.t / 0.3) : -0.15); j.rotation.z = 0; };
        arm(J.armR, -1); arm(J.armL, 1);
      }
    }
    // 배끼리 부딪힘
    for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i], c = this.racers[j];
      const dx = c.x - a.x, dz = c.z - a.z;
      if (Math.abs(dx) < 1.35 && Math.abs(dz) < 1.9) {
        const push = (1.35 - Math.abs(dx)) / 2 * Math.sign(dx || 1);
        a.x -= push; c.x += push;
        if (Math.abs(dz) < 1.5) { const back = dz > 0 ? c : a; back.v *= 0.97; }
      }
    }
    this.cam();
    if (this.endT > 0) { this.endT -= dt; if (this.endT <= 0) this.finish(); }
  }
  update(dt, t, keys) { this.keysRef = keys; super.update(dt, t, keys); }

  aiStep(b, dt, t) {
    if (b.done) { b.steer = 0; return; }
    // 실력 + 흔들림 + 고무줄(너무 앞서면 살짝 늦추고, 뒤처지면 힘냄)
    const gap = b.z - this.me.z; // +면 AI가 뒤
    let target = b.skill + Math.sin(t * 0.7 + b.wob) * 0.6;
    if (gap < -12) target *= 0.9; else if (gap > 10) target *= 1.12;
    if (this.time < this.duration * 0.25) target *= 1.03; // 막판 스퍼트
    if (b.v < target) b.v = Math.min(target, b.v + 7 * dt);
    // 앞의 부표 피하기, 물살은 노리기
    let aim = b.aim;
    for (const it of this.items) {
      const ahead = b.z - it.z;
      if (ahead < 0.5 || ahead > 9) continue;
      if (it.kind === 'buoy' && Math.abs(it.x - b.x) < it.r + 0.9) { aim = it.x + (b.x >= it.x ? 1 : -1) * (it.r + 1.4); if (Math.abs(aim) > HW - 1) aim = it.x - Math.sign(aim) * (it.r + 1.4); break; }
      if (it.kind === 'boost' && Math.abs(it.x - b.x) < 3 && Math.random() < 0.5) { aim = it.x; break; }
    }
    if (Math.random() < dt * 0.3) b.aim = (Math.random() * 2 - 1) * (HW - 2);
    const d = aim - b.x;
    b.steer = Math.abs(d) < 0.25 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d));
  }

  liveRank() {
    if (this.me.done) return this.me.rank;
    return 1 + this.racers.filter((b) => !b.user && (b.done || b.z < this.me.z)).length;
  }
  extraText() { return this.state === 'setup' ? '' : `${this.liveRank()}위 / ${this.racers.length}척 · 남은 ${Math.max(0, Math.ceil((L + this.me.z) * 4))}m`; }

  finish() {
    if (this.state === 'done') return;
    const n = this.racers.length;
    this.place = this.me.done ? this.me.rank : this.liveRank();
    const PTS = [100, 70, 50, 35, 25, 15];
    const scale = 0.5 + 0.5 * ((n - 1) / 5);       // 상대가 많을수록 보상 큼
    this.placePts = Math.round(PTS[this.place - 1] * scale * (this.me.done ? 1 : 0.4));
    this.timeBonus = this.me.done ? Math.ceil(this.time) : 0;
    this.score = this.placePts + this.timeBonus;
    this.meta = { ...this.meta, resultTitle: !this.me.done ? '시간 초과!' : this.place === 1 ? '1등!' : `${this.place}등으로 골인!` };
    super.finish();
  }
  resultRows() {
    const rows = [['순위', `${this.place}위 / ${this.racers.length}척${this.me.done ? '' : ' (미완주)'}`], ['순위 점수', `+${this.placePts}`]];
    if (this.timeBonus) rows.push(['남은 시간 보너스', `+${this.timeBonus}`]);
    if (this.me.done) rows.push(['기록', `${this.me.finishT.toFixed(1)}초`]);
    return rows;
  }
}
