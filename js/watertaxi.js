import * as THREE from 'three';
import { box } from './world.js';
import { geo, T, WK, ZN, NX, NZ, HX, HZ, GU } from './seoulMap.js';
import { plankTexture, signTexture } from './textures.js';
import { sfx } from './sfx.js';

// ============================================================
//  한강 수상택시: 선착장에서 타고 → WASD로 직접 운전 → 다른 선착장에서 E로 내리기
// ============================================================
export const PIERS = [
  { id: 'gangseo', name: '강서', gu: '강서구', lon: 126.817, lat: 37.586 },
  { id: 'ichon', name: '이촌', gu: '용산구', lon: 126.973, lat: 37.518 },
  { id: 'ttukseom', name: '뚝섬', gu: '광진구', lon: 127.067, lat: 37.529 },
  { id: 'gangdong', name: '강동', gu: '강동구', lon: 127.122, lat: 37.552 },
];
const DOCK_LEN = 3;          // 선착장이 물 쪽으로 나간 길이 (칸)
const BAND = 9;              // 서울 밖 물(강서 앞 한강 하류)은 강서구 물가에서 이만큼까지만 다닐 수 있음
const MAX_V = 8.5, BOOST_V = 12.5;
const CLEARANCE = 1.45;     // 배(와 앉은 캐릭터)가 지나가려면 다리 상판이 이만큼은 높아야 함

export function makeTaxiBoat() {
  const g = new THREE.Group();
  const hull = '#f28c28', white = '#f6f3ea';
  box(1.15, 0.36, 2.3, hull, 0, 0, 0, g);
  box(1.2, 0.08, 2.35, white, 0, 0.2, 0, g);
  box(0.8, 0.3, 0.5, hull, 0, 0.02, 1.3, g).rotation.x = 0.35;       // 뱃머리
  box(0.95, 0.5, 1.0, white, 0, 0.47, -0.25, g);                       // 선실
  box(0.97, 0.18, 0.9, '#5fa8e0', 0, 0.55, -0.25, g);                  // 창문 띠
  box(1.05, 0.08, 1.15, '#e8413a', 0, 0.76, -0.25, g);                 // 지붕
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.08), new THREE.MeshLambertMaterial({ map: signTexture('TAXI', { w: 40, h: 14, size: 10, bg: '#ffd23f', fg: '#3a2410' }) }));
  sign.position.set(0, 0.92, -0.25); g.add(sign);
  box(0.3, 0.08, 0.3, '#3a3f46', 0, 0.1, -1.2, g);                     // 모터
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildPiers(world) {
  const m = world.map, s = world.scene;
  const GI = Object.fromEntries(GU.map((g, i) => [g.name, i]));
  // 배가 다닐 수 있는 물: 한강 + (강서구 앞 서울 밖 물 띠)
  const band = new Uint8Array(NX * NZ);
  {
    const q = [];
    const dist = new Int16Array(NX * NZ).fill(-1);
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      const k = m.i(tx, tz);
      if (m.wk[k] !== WK.OUT || tx - HX > -66) continue;
      const touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => m.inb(tx + dx, tz + dz) && (m.gu[m.i(tx + dx, tz + dz)] === GI['강서구'] || m.wk[m.i(tx + dx, tz + dz)] === WK.HAN));
      if (touch) { dist[k] = 0; q.push(k); }
    }
    for (let h = 0; h < q.length; h++) {
      const k = q[h]; band[k] = 1;
      if (dist[k] >= BAND) continue;
      const tx = k % NX, tz = (k / NX) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!m.inb(tx + dx, tz + dz)) continue;
        const j = m.i(tx + dx, tz + dz);
        if (dist[j] < 0 && m.wk[j] === WK.OUT && tx + dx - HX <= -66) { dist[j] = dist[k] + 1; q.push(j); }
      }
    }
  }
  // 한강 + 한강으로 흘러드는 하천 + 강서 앞 물 띠 (다리 밑도 지나감)
  const navK = (k) => (m.tile[k] === T.WATER || m.tile[k] === T.BRIDGE) && (m.wk[k] === WK.HAN || m.wk[k] === WK.STREAM || band[k] === 1);
  world.boatNav = (x, z) => { const [tx, tz] = m.t(x, z); return m.inb(tx, tz) && navK(m.i(tx, tz)); };
  // 작은 다리(하천·노들섬)는 물에 붙어 있어서 그 밑은 살짝 잠기듯 지나감. 한강 다리는 높아서 그냥 밑으로 지나감
  world.underLowBridge = (x, z) => { const [tx, tz] = m.t(x, z); return m.inb(tx, tz) && m.tile[m.i(tx, tz)] === T.BRIDGE && m.bkind[m.i(tx, tz)] === 2; };

  const plank = new THREE.MeshLambertMaterial({ map: plankTexture('#a86c3a', '#7a4a26', '#c98a50') });
  plank.map.repeat.set(1, 3);
  world.piers = [];
  for (const P of PIERS) {
    const [cx, cz] = geo(P.lon, P.lat);
    const gi = GI[P.gu];
    let best = null;
    // 가까운 물가(그 구의 땅 + 물 쪽으로 DOCK_LEN 칸이 다 배가 다니는 물)를 찾음
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      const x = tx + 0.5 - HX, z = tz + 0.5 - HZ, d = Math.hypot(x - cx, z - cz);
      if (d > 18 || (best && d >= best.d)) continue;
      const k = m.i(tx, tz);
      if (m.gu[k] !== gi || m.tile[k] === T.WATER || m.tile[k] === T.BRIDGE || m.zone[k] === ZN.LANDMARK) continue;
      if (!world.canWalk(x, z, 0.4)) continue;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let ok = true;
        // 데크·배 자리(앞으로 DOCK_LEN+2칸, 양옆 1칸)는 진짜 물이어야 하고, 다리에서 2칸 이상 떨어져야 함
        for (let i = 1; i <= DOCK_LEN + 2 && ok; i++) for (const side of [-1, 0, 1]) {
          const ax = tx + dx * i + (dz ? side : 0), az = tz + dz * i + (dx ? side : 0);
          if (!m.inb(ax, az) || !navK(m.i(ax, az)) || m.tile[m.i(ax, az)] !== T.WATER) { ok = false; break; }
          for (let bz = -2; bz <= 2 && ok; bz++) for (let bx = -2; bx <= 2; bx++) if (m.inb(ax + bx, az + bz) && m.tile[m.i(ax + bx, az + bz)] === T.BRIDGE) { ok = false; break; }
        }
        if (ok) { best = { d, x, z, dx, dz }; break; }
      }
    }
    if (!best) { console.warn('선착장 자리를 못 찾음', P.name); continue; }
    const { x, z, dx, dz } = best;
    // 선착장: 땅 끝에서 물 쪽으로 뻗은 나무 데크
    const ex = x + dx * (0.5 + DOCK_LEN), ez = z + dz * (0.5 + DOCK_LEN); // 데크 끝
    const mx = (x + dx * 0.5 + ex) / 2, mz = (z + dz * 0.5 + ez) / 2;
    const W = 1.4, Lw = dx ? DOCK_LEN : W, Ld = dz ? DOCK_LEN : W;
    box(Lw + (dx ? 0.3 : 0), 0.14, Ld + (dz ? 0.3 : 0), plank, mx, -0.02, mz, s);
    for (let i = 0; i <= DOCK_LEN; i += 1.5) for (const side of [-0.65, 0.65]) {
      const px = x + dx * (0.6 + i) + (dz ? side : 0), pz = z + dz * (0.6 + i) + (dx ? side : 0);
      box(0.16, 1.0, 0.16, '#6b3b1c', px, -0.3, pz, s);
    }
    // 안내판 + 정박해 있는 택시
    const sg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.08), new THREE.MeshLambertMaterial({ map: signTexture(`${P.name} 수상택시`, { w: 96, h: 24, size: 12, bg: '#2f7fd8', fg: '#ffffff' }) }));
    const sgx = x + dx * 0.7 + (dz ? 0.9 : 0), sgz = z + dz * 0.7 + (dx ? 0.9 : 0);
    sg.position.set(sgx, 1.5, sgz); sg.rotation.y = Math.atan2(-dx, -dz) + Math.PI; s.add(sg);
    box(0.1, 1.5, 0.1, '#8a9096', sgx, 0.75, sgz, s);
    world.addCollider({ type: 'c', x: sgx, z: sgz, r: 0.12 });
    world.signSpots.push({ x: sgx, z: sgz });
    const moored = makeTaxiBoat();
    const side = 1.35;
    moored.position.set(ex - dx * 1.1 + (dz ? side : 0), -0.12, ez - dz * 1.1 + (dx ? side : 0));
    moored.rotation.y = Math.atan2(dx, dz);
    s.add(moored);
    // 걸을 수 있는 칸: 데크 + 육지 칸 가운데까지 (물가 판정 때문에 끊기지 않게 땅 쪽으로 겹쳐 둠)
    const x0 = Math.min(x, ex) - (dz ? W / 2 : 0), x1 = Math.max(x, ex) + (dz ? W / 2 : 0);
    const z0 = Math.min(z, ez) - (dx ? W / 2 : 0), z1 = Math.max(z, ez) + (dx ? W / 2 : 0);
    world.walkRects.push({ x0, x1, z0, z1 });
    const pier = { ...P, x: ex - dx * 0.6, z: ez - dz * 0.6, dir: [dx, dz], rect: { x0, x1, z0, z1 }, moored,
      boatAt: [ex + dx * 1.4, ez + dz * 1.4], land: [x, z] };
    world.piers.push(pier);
    world.interactables.push({ x: pier.x, z: pier.z, r: 1.4, label: `수상택시 타기 (${P.name} 선착장)`, kind: 'watertaxi', pier: P.id });
  }
}

// 운전 중인 수상택시
export class WaterTaxi {
  constructor(world) {
    this.world = world;
    this.boat = makeTaxiBoat(); this.boat.visible = false; world.scene.add(this.boat);
    this.riding = false; this.v = 0; this.heading = 0; this.sink = 0;
    this.pos = new THREE.Vector3();
    // 물보라 (작은 흰 상자들을 돌려 씀)
    this.wake = [];
    const wm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 });
    for (let i = 0; i < 18; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.22), wm.clone()); w.visible = false; world.scene.add(w); this.wake.push({ m: w, t: 0 }); }
    this.wakeI = 0; this.wakeT = 0;
  }
  board(pier) {
    const [bx, bz] = pier.boatAt;
    this.pos.set(bx, 0, bz);
    this.heading = Math.atan2(pier.dir[0], pier.dir[1]);
    this.v = 0; this.riding = true; this.boat.visible = true; this.from = pier;
    pier.moored.visible = false;
    this.update(0, 0, new Set(), 0);
  }
  // 가까운 선착장 (내릴 수 있는 곳)
  nearPier() {
    let best = null, bd = 3.2;
    for (const p of this.world.piers) {
      const d = Math.hypot(p.boatAt[0] - this.pos.x, p.boatAt[1] - this.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  leave(pier) {
    this.riding = false; this.boat.visible = false;
    this.from.moored.visible = true;
    for (const w of this.wake) w.m.visible = false;
    return [pier.x - pier.dir[0] * 0.3, pier.z - pier.dir[1] * 0.3];
  }
  canSail(x, z) {
    const w = this.world;
    for (const [ox, oz] of [[0, 0], [0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]]) {
      const px = x + ox, pz = z + oz;
      if (!w.boatNav(px, pz)) return false;
      if (w.groundY(px, pz) > 0 && w.groundY(px, pz) < CLEARANCE) return false; // 다리 끝 비탈 밑은 너무 낮아서 못 지나감
    }
    for (const r of w.bridgePiers) if (x > r.x0 - 0.45 && x < r.x1 + 0.45 && z > r.z0 - 0.45 && z < r.z1 + 0.45) return false; // 교각
    for (const p of w.piers) { const r = p.rect; if (x > r.x0 - 0.5 && x < r.x1 + 0.5 && z > r.z0 - 0.5 && z < r.z1 + 0.5) return false; }
    return true;
  }
  // 카메라 기준 WASD: 가고 싶은 방향으로 뱃머리를 돌리며 나아감
  update(dt, t, keys, camYaw) {
    let f = 0, r = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    const wx = -sy * f + cy * r, wz = -cy * f - sy * r;
    const want = Math.hypot(wx, wz) > 0;
    if (want) {
      const target = Math.atan2(wx, wz);
      let d = target - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += Math.sign(d) * Math.min(Math.abs(d), dt * (2.6 - Math.min(1.2, this.v * 0.08)));
      // 뱃머리가 원하는 방향을 어느 정도 보고 있을 때만 힘을 줌
      const align = Math.max(0, Math.cos(d));
      this.v += ((boost ? BOOST_V : MAX_V) * align - this.v) * Math.min(1, dt * 1.3);
    } else this.v *= Math.exp(-dt * 0.9);
    const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
    const nx = this.pos.x + hx * this.v * dt, nz = this.pos.z + hz * this.v * dt;
    if (this.canSail(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (this.canSail(nx, this.pos.z)) { this.pos.x = nx; this.v *= 0.85; }
    else if (this.canSail(this.pos.x, nz)) { this.pos.z = nz; this.v *= 0.85; }
    else { if (this.v > 3) sfx.hurt(); this.v *= -0.25; }
    // 작은 다리 밑을 지날 때는 살짝 잠기듯 낮춰서 아래로 지나가는 것처럼 보이게
    const under = this.world.underLowBridge(this.pos.x, this.pos.z) || this.world.underLowBridge(this.pos.x + hx * 0.8, this.pos.z + hz * 0.8);
    this.sink += ((under ? 1 : 0) - this.sink) * Math.min(1, dt * 8);
    const bob = Math.sin(t * 3) * 0.04;
    this.boat.position.set(this.pos.x, -0.12 + bob - this.sink * 1.3, this.pos.z);
    this.boat.rotation.set(Math.min(0.12, this.v * 0.012) * -1, this.heading, Math.sin(t * 2.2) * 0.03 + (want ? r * 0.04 : 0));
    // 물보라
    this.wakeT -= dt;
    if (this.v > 2 && this.wakeT <= 0 && this.sink < 0.5) {
      this.wakeT = 0.06;
      const w = this.wake[this.wakeI++ % this.wake.length];
      w.t = 0.9; w.m.visible = true;
      w.m.position.set(this.pos.x - hx * 1.3 + (Math.random() - 0.5) * 0.6, -0.17, this.pos.z - hz * 1.3 + (Math.random() - 0.5) * 0.6);
    }
    for (const w of this.wake) if (w.t > 0) { w.t -= dt; const k = Math.max(0, w.t / 0.9); w.m.scale.setScalar(1 + (1 - k) * 2.5); w.m.material.opacity = 0.8 * k; if (w.t <= 0) w.m.visible = false; }
    return { x: this.pos.x, z: this.pos.z, y: this.boat.position.y - 0.3, heading: this.heading, sink: this.sink }; // 캐릭터는 배 안에 앉은 높이
  }
}
