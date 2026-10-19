import * as THREE from 'three';
import { box, makeTree } from '../world.js';
import { Avatar } from '../character.js';
import { rng, signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

const $ = (id) => document.getElementById(id);
const LAPS = 3, W = 6;          // 바퀴 수, 도로 폭
const N = 480;                   // 중심선 샘플 수
// 기능시험장 코스 느낌: 긴 직선 + 큰 곡선 + S자 구간 (반시계 방향)
const CTRL = [[-26, -15], [0, -17], [24, -15], [31, -4], [27, 9], [14, 12], [7, 4], [-2, 11], [-11, 18], [-26, 15], [-33, 2]];
const KARTS = [
  { name: '나', body: '#e8413a' }, { name: '노원번개', body: '#3f7fe0' },
  { name: '상계드리프트', body: '#5fc04a' }, { name: '마들초보', body: '#ffd23f' },
];

function makeKart(color) {
  const g = new THREE.Group();
  box(1.1, 0.25, 1.9, color, 0, 0.28, 0, g);
  box(0.9, 0.12, 0.5, '#f4f4f4', 0, 0.42, 0.75, g);         // 앞 범퍼 줄
  box(1.3, 0.1, 0.35, '#222222', 0, 0.55, -0.95, g);         // 뒤 날개
  for (const x of [-0.45, 0.45]) box(0.08, 0.25, 0.08, '#222', x, 0.42, -0.95, g);
  box(0.5, 0.35, 0.12, '#333', 0, 0.55, 0.35, g);             // 핸들 기둥
  for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.6, 0.65], [0.6, 0.65]]) box(0.24, 0.36, 0.42, '#1a1a1a', x, 0.18, z, g);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// 운전면허시험장 카트 레이싱: 3바퀴, 4대
// 손 핸들 (라디안): 이보다 덜 기울이면 직진 / 이만큼 기울이면 끝까지 / 이보다 더 꺾으면 드리프트
const HAND_DEAD = 0.14, HAND_FULL = 0.85, HAND_DRIFT = 0.95;
export class KartGame extends MiniGame {
  static meta = {
    id: 'kart', title: '면허시험장 카트', duration: 150, resultTitle: '레이스 끝!', fov: 55, sky: '#a8dcf5',
    hint: 'W·↑ 가속 · S·↓ 브레이크 · A/D·←/→ 핸들 · Space 드리프트 — 잔디로 나가면 느려지고, 노란 화살표를 밟으면 부스터!',
  };

  build() {
    this.handSteer = 0;
    this.camCtl = new CamControl(this, { hint: '✊✊ 두 손으로 핸들을 잡듯이 → 돌리면 방향, 쥐고 있으면 가속, 두 손을 활짝 펴면 브레이크, 크게 꺾으면 드리프트!' });
    const s = this.scene;
    s.fog = new THREE.Fog('#a8dcf5', 50, 110);
    this.lights({ pos: [-10, 30, 14], size: 45, intensity: 1.9 });
    this.sun.shadow.mapSize.set(2048, 2048);
    // 잔디
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(140, 110), new THREE.MeshLambertMaterial({ color: '#6cbb48' }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; s.add(grass);
    // 중심선
    const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    // 출발선은 아래쪽 긴 직선 가운데 (곡선에서 출발하지 않게 샘플 순서를 돌려 0번을 거기로)
    const raw = curve.getSpacedPoints(N).slice(0, N);
    let k0 = 0; raw.forEach((p, i) => { if (Math.hypot(p.x + 4, p.z + 16.8) < Math.hypot(raw[k0].x + 4, raw[k0].z + 16.8)) k0 = i; });
    this.pts = raw.slice(k0).concat(raw.slice(0, k0));
    this.tan = this.pts.map((p, i) => this.pts[(i + 1) % N].clone().sub(this.pts[(i - 1 + N) % N]).normalize());
    this.len = curve.getLength();
    // 도로·흰 선·연석 (띠 메시)
    const ribbon = (off0, off1, y, color, every = 0) => {
      const pos = [], col = [], c1 = new THREE.Color(color), c2 = new THREE.Color('#ffffff');
      for (let i = 0; i <= N; i++) {
        const p = this.pts[i % N], t = this.tan[i % N], nx = -t.z, nz = t.x;
        pos.push(p.x + nx * off0, y, p.z + nz * off0, p.x + nx * off1, y, p.z + nz * off1);
        const c = every && Math.floor(i / every) % 2 ? c2 : c1;
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      const idx = [];
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      m.receiveShadow = true; s.add(m); return m;
    };
    ribbon(-W / 2 - 0.6, W / 2 + 0.6, 0.015, '#e8413a', 4);   // 연석 (빨강/흰색)
    ribbon(-W / 2, W / 2, 0.03, '#5d6066');                    // 아스팔트
    ribbon(-W / 2 + 0.25, -W / 2 + 0.4, 0.04, '#ffffff');       // 가장자리 흰 선
    ribbon(W / 2 - 0.4, W / 2 - 0.25, 0.04, '#ffffff');
    ribbon(-0.08, 0.08, 0.04, '#ffd23f', 6);                    // 가운데 노란 점선
    // 출발선 (체크무늬)
    const p0 = this.pts[0], t0 = this.tan[0], ang = Math.atan2(t0.x, t0.z);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {
      const c = box(W / 12, 0.02, 0.4, (i + j) % 2 ? '#222' : '#fff', 0, 0, 0, s);
      const off = -W / 2 + (i + 0.5) * (W / 12);
      c.position.set(p0.x - t0.z * off + t0.x * (j * 0.4), 0.05, p0.z + t0.x * off + t0.z * (j * 0.4)); c.rotation.y = ang; c.castShadow = false;
    }
    // 출발 게이트 + 신호등
    const gate = new THREE.Group(); gate.position.copy(p0); gate.rotation.y = ang;
    for (const x of [-W / 2 - 1, W / 2 + 1]) box(0.3, 4, 0.3, '#3a3f46', x, 2, 0, gate);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(W + 2.3, 0.8, 0.1), new THREE.MeshLambertMaterial({ map: signTexture('도봉운전면허시험장 카트대회', { w: 200, h: 24, size: 13, bg: '#1f4f9a', fg: '#ffffff' }) }));
    banner.position.set(0, 3.6, 0); gate.add(banner);
    this.lightsOn = [];
    for (let i = 0; i < 3; i++) { const l = box(0.45, 0.45, 0.12, '#330000', -0.6 + i * 0.6, 2.9, 0.08, gate); l.material = new THREE.MeshBasicMaterial({ color: '#330000' }); this.lightsOn.push(l); }
    s.add(gate);
    // 라바콘·타이어 벽 (바깥쪽 굽은 곳)
    const r = rng(9);
    for (let i = 0; i < N; i += 8) {
      const p = this.pts[i], t = this.tan[i], t2 = this.tan[(i + 10) % N];
      const turn = t.x * t2.z - t.z * t2.x; // 굽는 방향
      if (Math.abs(turn) < 0.05) continue;
      const side = turn > 0 ? -1 : 1, off = (W / 2 + 1.4) * side;
      const cone = new THREE.Group(); cone.position.set(p.x - t.z * off, 0, p.z + t.x * off);
      const cm = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), new THREE.MeshLambertMaterial({ color: '#f28c28' })); cm.position.y = 0.3; cm.castShadow = true; cone.add(cm);
      box(0.4, 0.04, 0.4, '#f28c28', 0, 0.02, 0, cone); box(0.3, 0.08, 0.3, '#ffffff', 0, 0.3, 0, cone);
      s.add(cone);
    }
    // 부스터 (노란 화살표)
    this.boosts = [70, 200, 330].map((i) => {
      const p = this.pts[i], t = this.tan[i], g = new THREE.Group();
      g.position.set(p.x, 0.05, p.z); g.rotation.y = Math.atan2(t.x, t.z);
      for (let k = 0; k < 3; k++) { const a = box(1.4, 0.03, 0.3, '#ffd23f', 0, 0, -0.6 + k * 0.6, g); a.material = new THREE.MeshBasicMaterial({ color: '#ffd23f' }); box(0.3, 0.031, 0.5, '#ffd23f', -0.5, 0, -0.75 + k * 0.6, g).rotation.y = 0.6; box(0.3, 0.031, 0.5, '#ffd23f', 0.5, 0, -0.75 + k * 0.6, g).rotation.y = -0.6; }
      s.add(g); return { i, g };
    });
    // 주변 나무·관중석·시험장 건물
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, x = Math.cos(a) * (44 + r() * 8), z = Math.sin(a) * (32 + r() * 6);
      const t = makeTree(r, r() < 0.5 ? 'pine' : 'round'); t.position.set(x, 0, z); t.scale.setScalar(1.4); s.add(t);
    }
    box(10, 4, 5, '#e8e4dc', -15, 2, 0, s); box(10.4, 0.3, 5.4, '#2f7fd8', -15, 4.1, 0, s); // 트랙 안쪽 시험장 건물
    const bs = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.1), new THREE.MeshLambertMaterial({ map: signTexture('운전면허시험장', { w: 128, h: 22, size: 14, bg: '#ffffff', fg: '#1f4f9a' }) }));
    bs.position.set(-15, 3, 2.55); s.add(bs);
    // 카트 4대
    this.karts = KARTS.map((k, i) => {
      const g = makeKart(k.body); s.add(g);
      const kt = { g, i, name: k.name, user: i === 0, pos: new THREE.Vector3(), heading: 0, v: 0, idx: 0, lap: 0, prog: 0, done: false, rank: 0, finishT: 0, boost: 0, skill: 0, lane: 0 };
      if (i > 0) {
        const av = new Avatar(npcSkin({ shirt: k.body, pants: '#3a3f4a', hair: HAIRS[(i * 2) % HAIRS.length], skin: TONES[i % TONES.length] }), { height: 1.2 });
        av.root.position.set(0, 0.25, -0.15); g.add(av.root); kt.av = av;
      }
      return kt;
    });
    this.me = this.karts[0];
    this.camera.position.set(0, 6, 10);
  }

  onAvatar() {
    for (const c of [...this.me.g.children]) if (c.userData.rider) this.me.g.remove(c);
    this.player.userData.rider = true;
    this.player.scale.setScalar(1.2 / 1.6);
    this.player.position.set(0, 0.25, -0.15); this.player.rotation.y = 0;
    this.me.g.add(this.player);
    this.me.av = this.avatar;
  }

  reset() {
    // 출발선 뒤 2×2 격자
    this.karts.forEach((k, i) => {
      const back = 3 + Math.floor(i / 2) * 3.2, side = (i % 2 ? 1 : -1) * 1.4;
      const j = (N - Math.round(back / (this.len / N))) % N, p = this.pts[j], t = this.tan[j];
      k.pos.set(p.x - t.z * side, 0, p.z + t.x * side);
      k.heading = Math.atan2(t.x, t.z); k.v = 0; k.idx = j; k.lap = -1; k.done = false; k.rank = 0; k.finishT = 0; k.boost = 0; k.half = true;
      k.skill = 13.0 + Math.random() * 1.2 - (i === 3 ? 1.0 : 0); k.lane = (Math.random() - 0.5) * 2.4; k.drift = false;
      k.g.position.copy(k.pos); k.g.rotation.set(0, k.heading, 0);
    });
    this.finished = 0; this.endT = 0;
    this.overlay();
    this.cam(1);
  }

  overlay() {
    const o = $('miniOverlay');
    const mm = document.createElement('canvas'); mm.className = 'kart-map'; mm.width = 170; mm.height = 120;
    o.appendChild(mm); this.mm = mm;
    const sp = document.createElement('div'); sp.className = 'kart-speed'; o.appendChild(sp); this.spEl = sp;
  }
  drawMap() {
    const g = this.mm.getContext('2d'), W2 = this.mm.width, H2 = this.mm.height, k = 2.2;
    const tx = (x) => W2 / 2 + x * k, tz = (z) => H2 / 2 + z * k;
    g.clearRect(0, 0, W2, H2); g.fillStyle = 'rgba(40,60,30,0.6)'; g.fillRect(0, 0, W2, H2);
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 6; g.beginPath();
    this.pts.forEach((p, i) => (i ? g.lineTo(tx(p.x), tz(p.z)) : g.moveTo(tx(p.x), tz(p.z)))); g.closePath(); g.stroke();
    for (const c of [...this.karts].reverse()) { g.fillStyle = KARTS[c.i].body; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(tx(c.pos.x), tz(c.pos.z), c.user ? 5 : 3.5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  }

  // 가장 가까운 중심선 샘플 (지난 위치 근처만 찾음)
  nearest(k) {
    let best = k.idx, bd = Infinity;
    for (let d = -25; d <= 40; d++) { const j = (k.idx + d + N) % N, p = this.pts[j]; const dd = (p.x - k.pos.x) ** 2 + (p.z - k.pos.z) ** 2; if (dd < bd) { bd = dd; best = j; } }
    return { j: best, dist: Math.sqrt(bd) };
  }

  drive(k, dt, throttle, steer, drift) {
    const near = this.nearest(k);
    // 바퀴 세기: 출발선(0번 샘플)을 앞으로 지나가면 +1 (반 바퀴 지점을 거쳐야 인정)
    if (near.j > N * 0.4 && near.j < N * 0.6) k.half = true;
    if (k.idx > N * 0.85 && near.j < N * 0.15 && k.half) { k.lap++; k.half = false; if (k.lap >= 1 && k.user && k.lap < LAPS) { sfx.gold(); this.float(k.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), `${k.lap + 1}바퀴째!${k.lap + 1 === LAPS ? ' 마지막!' : ''}`, 'gold'); } }
    k.idx = near.j;
    k.prog = k.lap * N + k.idx;
    const off = near.dist > W / 2 + 0.3;           // 도로 밖
    let maxV = (k.user ? 14 : k.skill) * (off ? 0.45 : 1);
    if (k.boost > 0) { k.boost -= dt; maxV += 7; }
    if (throttle > 0) k.v += (maxV - k.v) * Math.min(1, dt * (k.v < maxV ? 1.1 : 3));
    else if (throttle < 0) k.v = Math.max(-4, k.v - dt * (k.v > 0 ? 22 : 6));
    else k.v *= Math.exp(-dt * (off ? 1.8 : 0.7));
    if (off && k.v > maxV) k.v += (maxV - k.v) * Math.min(1, dt * 3);
    // 핸들: 속도가 있을 때만 돌고, 드리프트면 더 많이 돎
    const grip = Math.min(1, Math.abs(k.v) / 4) * Math.sign(k.v || 1);
    k.heading -= steer * dt * (drift ? 2.9 : 2.1) * grip;
    if (drift && Math.abs(k.v) > 6) k.v *= Math.exp(-dt * 0.25);
    k.pos.x += Math.sin(k.heading) * k.v * dt; k.pos.z += Math.cos(k.heading) * k.v * dt;
    // 바깥 경계 (타이어 벽): 도로에서 너무 멀어지면 밀어 넣음
    if (near.dist > W / 2 + 4) {
      const p = this.pts[near.j], dx = k.pos.x - p.x, dz = k.pos.z - p.z, d = Math.hypot(dx, dz);
      k.pos.x = p.x + (dx / d) * (W / 2 + 4); k.pos.z = p.z + (dz / d) * (W / 2 + 4); k.v *= 0.6;
      if (k.user) sfx.hurt();
    }
    // 부스터
    for (const b of this.boosts) { const p = this.pts[b.i]; if (Math.hypot(p.x - k.pos.x, p.z - k.pos.z) < 1.6 && k.boost <= 0) { k.boost = 1.0; if (k.user) { sfx.catch(10); this.float(k.pos.clone().add(new THREE.Vector3(0, 2, 0)), '부스터!', 'gold'); } } }
    // 결승
    if (!k.done && k.lap >= LAPS) {
      k.done = true; this.finished++; k.rank = this.finished; k.finishT = this.duration - this.time;
      if (k.user) { sfx.end(); this.float(k.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), `${k.rank}등 골인!`, 'gold'); this.endT = 1.8; }
    }
  }

  aiStep(k, dt) {
    if (k.done) { this.drive(k, dt, 0, 0, false); return; }
    const look = this.pts[(k.idx + 14) % N], t = this.tan[(k.idx + 14) % N];
    const target = new THREE.Vector3(look.x - t.z * k.lane, 0, look.z + t.x * k.lane);
    let want = Math.atan2(target.x - k.pos.x, target.z - k.pos.z), d = want - k.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    // 굽은 정도에 따라 감속 + 고무줄 (너무 앞서면 살살, 뒤처지면 힘냄)
    const t2 = this.tan[(k.idx + 30) % N], bend = 1 - (this.tan[k.idx].x * t2.x + this.tan[k.idx].z * t2.z);
    const gap = this.me.prog - k.prog;
    const save = k.skill;
    k.skill = save * (1 - Math.min(0.25, bend * 0.55)) * (gap > 60 ? 1.15 : gap < -80 ? 0.9 : 1);
    if (Math.random() < dt * 0.3) k.lane = (Math.random() - 0.5) * 2.4;
    this.drive(k, dt, 1, THREE.MathUtils.clamp(-d * 2.2, -1, 1), Math.abs(d) > 0.5);
    k.skill = save;
  }

  cam(snap = 0) {
    const k = this.me, back = new THREE.Vector3(-Math.sin(k.heading) * 7, 3.6, -Math.cos(k.heading) * 7);
    this.camera.position.lerp(k.pos.clone().add(back), snap || 0.1);
    this.camera.lookAt(k.pos.x + Math.sin(k.heading) * 4, 0.8, k.pos.z + Math.cos(k.heading) * 4);
    this.sun.position.set(k.pos.x - 10, 30, k.pos.z + 14); this.sun.target.position.copy(k.pos); this.sun.target.updateMatrixWorld();
  }

  syncKart(k, t, steer) {
    k.g.position.set(k.pos.x, Math.abs(Math.sin(t * 30 + k.i)) * 0.02 * Math.min(1, k.v / 5), k.pos.z);
    k.g.rotation.set(0, k.heading + (k.drift ? steer * 0.35 : 0), steer * 0.05 * Math.min(1, k.v / 8));
    k.av?.animate(0.016, t, { armsUp: k.done && k.rank === 1 });
  }

  idle(dt, t) {
    // 카운트다운 동안 신호등: 빨강 → 노랑 → 초록
    const lit = this.state === 'countdown' ? Math.max(0, 3 - Math.ceil(this.cdT)) : 3;
    this.lightsOn.forEach((l, i) => l.material.color.set(i < lit ? (lit === 3 ? '#5fc04a' : '#e8413a') : '#330000'));
    for (const k of this.karts) this.syncKart(k, t, 0);
    if (this.mm) this.drawMap();
    this.cam();
  }

  step(dt, t) {
    this.lightsOn.forEach((l) => l.material.color.set('#5fc04a'));
    const keys = this.keysRef;
    let thr = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    let steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const me = this.me;
    me.drift = keys.has('Space') && Math.abs(steer) > 0;
    // 손으로 하기: 두 손을 잇는 선의 기울기 = 핸들
    const cam = this.camCtl.on && this.camCtl.hands;
    if (cam && !thr && !steer) {
      const a = cam.wheel(), hs = cam.fresh;
      if (a !== null) {
        const u = THREE.MathUtils.clamp((Math.abs(a) - HAND_DEAD) / (HAND_FULL - HAND_DEAD), 0, 1);
        const want = Math.sign(a) * u ** 1.6;
        this.handSteer += (want - this.handSteer) * Math.min(1, dt * 5);
        steer = Math.abs(this.handSteer) < 0.03 ? 0 : this.handSteer;
        thr = hs.every((h) => h.shape === 'open') ? -1 : 1;
        me.drift = Math.abs(a) > HAND_DRIFT;
        cam.label = thr < 0 ? '✋✋ 브레이크' : me.drift ? '🔥 드리프트!' : steer ? (steer > 0 ? '➡️ 오른쪽' : '⬅️ 왼쪽') : '⬆️ 앞으로';
      } else cam.label = hs.length === 1 ? '두 손이 다 보이게 잡아요' : '';
    }
    if (!me.done) this.drive(me, dt, thr, steer, me.drift); else this.drive(me, dt, 0, 0, false);
    for (const k of this.karts) if (!k.user) this.aiStep(k, dt);
    // 카트끼리 부딪힘
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = this.karts[a], B = this.karts[b], dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 1.5) { const push = (1.5 - d) / 2; A.pos.x -= (dx / d) * push; A.pos.z -= (dz / d) * push; B.pos.x += (dx / d) * push; B.pos.z += (dz / d) * push; A.v *= 0.97; B.v *= 0.97; }
    }
    for (const k of this.karts) this.syncKart(k, t, k.user ? steer : 0);
    // 순위
    const order = [...this.karts].sort((a, b) => (a.done && b.done ? a.rank - b.rank : a.done ? -1 : b.done ? 1 : b.prog - a.prog));
    order.forEach((k, i) => (k.place = i + 1));
    this.spEl.textContent = `${Math.round(Math.abs(me.v) * 9)} km/h${me.boost > 0 ? ' 🔥' : ''}${me.drift ? ' 드리프트!' : ''}`;
    this.drawMap();
    this.cam();
    if (this.endT > 0) { this.endT -= dt; if (this.endT <= 0) this.finish(); }
  }
  update(dt, t, keys) { this.keysRef = keys; super.update(dt, t, keys); }

  extraText() { return this.state === 'play' || this.state === 'done' ? `${this.me.place || 4}위 · ${Math.min(LAPS, Math.max(1, this.me.lap + 1))}/${LAPS}바퀴` : ''; }
  finish() {
    if (this.state === 'done') return;
    const place = this.me.done ? this.me.rank : this.me.place || 4;
    this.placePts = [120, 80, 50, 30][place - 1] * (this.me.done ? 1 : 0.3) | 0;
    this.timeBonus = this.me.done ? Math.ceil(this.time) : 0;
    this.score = this.placePts + this.timeBonus;
    this.place = place;
    this.meta = { ...this.meta, resultTitle: !this.me.done ? '시간 초과!' : place === 1 ? '1등! 합격입니다!' : `${place}등으로 골인!` };
    super.finish();
  }
  resultRows() {
    const rows = [['순위', `${this.place}위 / 4대${this.me.done ? '' : ' (미완주)'}`], ['순위 점수', `+${this.placePts}`]];
    if (this.timeBonus) rows.push(['남은 시간 보너스', `+${this.timeBonus}`]);
    if (this.me.done) rows.push(['기록', `${this.me.finishT.toFixed(1)}초`]);
    return rows;
  }
  start() { this.meta = this.constructor.meta; super.start(); }
}
