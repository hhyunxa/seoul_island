import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, waterTexture, plankTexture, signTexture, GROUND } from './textures.js';
import { toonMat, rbox, soft, basic, blobShadow, stylize, U } from './toon.js';
import { Avatar, npcLook } from './character.js';
import { SeoulMap, T, WK, ZN, NX, NZ, HX, HZ, GU } from './seoulMap.js';
import { buildTrees, buildBridges } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildVillagers } from './npcs.js';

// ============================================================
//  서울섬 월드: 실제 서울 모양(25개 구)의 섬 + 한강 + 다리 + 명소 + 미니게임 입구
//  땅은 둥글둥글한 잔디·모래·흙길, 빈 땅은 동글 나무와 꽃 (쓸모없는 건물은 없음)
// ============================================================

// ---------- 공용 소품 (미니게임·랜드마크가 같이 씀) ----------
export function mat(color) { return toonMat(color); }
export function box(w, h, d, color, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(rbox(w, h, d), typeof color === 'string' || typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent?.add(m);
  return m;
}
const GS = {};
const sphG = () => (GS.s ||= new THREE.SphereGeometry(1, 14, 10));
const sph = (r, color, x, y, z, parent, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(sphG(), mat(color)); m.position.set(x, y, z); m.scale.set(r * sx, r * sy, r * sz);
  m.castShadow = true; parent?.add(m); return m;
};

// 원래 서울섬 동글 나무 (미니게임 무대용, 흔들림은 userData.crown)
export function makeTree(r, kind = 'round', fruitColor = '#ff6b6b') {
  const g = new THREE.Group();
  const s = 0.75 + r() * 0.3;
  const trunk = new THREE.Mesh(GS.trunk ||= new THREE.CylinderGeometry(0.2, 0.28, 1.4, 10), mat('#b58965'));
  trunk.position.y = 0.7; trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Group(); crown.position.y = 1.4; g.add(crown);
  if (kind === 'pine') {
    [[1.3, 1.5, 0.3, '#5fae7a'], [1.0, 1.3, 1.1, '#6fbf88'], [0.7, 1.1, 1.8, '#86cf9a']].forEach(([rad, h, y, c]) => {
      const m = new THREE.Mesh(GS.cone ||= new THREE.ConeGeometry(1, 1, 12), mat(c)); m.scale.set(rad, h, rad); m.position.y = y; m.castShadow = true; crown.add(m);
    });
  } else {
    const cols = kind === 'fruit' ? ['#38a852', '#2c9346', '#6acb80'] : r() < 0.35 ? ['#ff7ea2', '#ff638e', '#ffb6ca'] : ['#38a852', '#2c9346', '#6acb80'];
    sph(1.25, cols[0], 0, 0.85, 0, crown, 1, 0.95, 1);
    sph(0.9, cols[1], 0.75, 0.45, 0.35, crown);
    sph(0.85, cols[1], -0.7, 0.55, -0.3, crown);
    sph(0.55, cols[2], -0.3, 1.55, 0.5, crown);
    if (kind === 'fruit') for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2;
      sph(0.16, fruitColor, Math.cos(a) * 1.15, 0.4 + r() * 0.8, Math.sin(a) * 1.15, crown);
    }
  }
  blobShadow(g, 1.35);
  g.scale.setScalar(s);
  g.userData.crown = crown;
  g.userData.phase = r() * 10;
  return g;
}

export function makeChicken() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  sph(0.24, '#fffaf0', 0, 0.36, 0, body, 1, 0.85, 1.15);
  sph(0.16, '#fffaf0', 0, 0.62, 0.2, body);
  sph(0.06, '#ff6b6b', 0, 0.8, 0.2, body, 0.8, 1, 1.6);
  const beak = new THREE.Mesh(GS.cone ||= new THREE.ConeGeometry(1, 1, 12), mat('#ffb347')); beak.scale.set(0.05, 0.1, 0.05); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.6, 0.38); body.add(beak);
  for (const sx of [-1, 1]) sph(0.025, '#2b1d14', sx * 0.08, 0.66, 0.33, body);
  sph(0.1, '#f1e6d0', 0, 0.48, -0.28, body, 0.8, 1.2, 1);
  for (const sx of [-1, 1]) box(0.05, 0.2, 0.05, '#ffb347', sx * 0.1, 0.1, 0, g);
  blobShadow(g, 0.3);
  g.userData.body = body;
  return g;
}

export function makePigeon() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  sph(0.16, '#b9c1d0', 0, 0.22, 0, body, 0.85, 0.75, 1.25);
  sph(0.11, '#a3acbf', 0, 0.38, 0.16, body);
  sph(0.09, '#8fcfb5', 0, 0.3, 0.12, body, 1, 0.5, 0.9);
  for (const sx of [-1, 1]) sph(0.02, '#2b1d14', sx * 0.06, 0.41, 0.25, body);
  for (const sx of [-1, 1]) box(0.03, 0.12, 0.03, '#ff9a9a', sx * 0.06, 0.06, 0, g);
  blobShadow(g, 0.22);
  g.userData.body = body;
  return g;
}

// 원래 서울섬 표지판: 나무 기둥 두 개 + 크림색 판
export function makeSign(text) {
  const g = new THREE.Group();
  for (const sx of [-0.6, 0.6]) { const p = new THREE.Mesh(GS.post ||= new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), mat('#c99468')); p.position.set(sx, 0.55, 0); g.add(p); }
  const tex = signTexture(text, { w: 128, h: 64, size: 18 });
  const wood = mat('#e9b98f');
  const board = new THREE.Mesh(rbox(1.6, 0.8, 0.12), [wood, wood, wood, wood, toonMat({ map: tex }), wood]);
  board.position.set(0, 1.2, 0.04);
  g.add(board);
  blobShadow(g, 0.9);
  return g;
}

// 미니게임 입구 표시: 통통 튀는 노란 별
let starGeo = null;
function starGeometry() {
  if (starGeo) return starGeo;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.17 : 0.38; const x = Math.cos(a) * r, y = -Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath();
  starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
  starGeo.center();
  return starGeo;
}

const SIGN_CLEAR = 3.5;
const SPAWN_CLEAR = 10;

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bfe6f7');
    this.scene.fog = new THREE.Fog('#e2f4fb', 75, 165);
    this.r = rng(2026);
    this.colliders = [];
    this.cgrid = new Map();
    this.walkRects = [];
    this.interactables = [];
    this.trees = [];
    this.treeList = [];
    this.animals = [];
    this.pigeons = [];
    this.butterflies = [];
    this.markers = [];
    this.signSpots = [];
    this.villagers = [];
    this.glowSpots = []; // [x, y, z, 크기, 색] 노을에 켜지는 불빛
    this.map = new SeoulMap();
    this.occ = new Uint8Array(NX * NZ); // 건물 칸 (서울섬엔 없음)
    this.spawn = new THREE.Vector3(1.6, 0, -1.4); // 광화문광장

    this.buildLights();
    this.buildGround();
    this.buildWater();
    buildBridges(this, this.map);
    buildLandmarks(this, this.map);
    this.buildRiverSpots();
    this.scatter();
    this.buildLife();
    buildVillagers(this);
    this.buildMinimap();
  }

  tileAt(x, z) { return this.map.tileAt(x, z); }
  placeName(x, z) {
    const m = this.map, [tx, tz] = m.t(x, z);
    if (!m.inb(tx, tz)) return '바다';
    const k = m.i(tx, tz);
    if (m.wk[k] === WK.HAN) return '한강';
    if (m.wk[k] === WK.OUT) return '바다';
    const gi = m.gu[k];
    return gi >= 0 ? GU[gi].name : '서울섬';
  }
  // 강북 / 강남 / 한강 (HUD 작은 딱지)
  areaName(x, z) {
    const m = this.map, [tx, tz] = m.t(x, z);
    if (!m.inb(tx, tz)) return '바다';
    const k = m.i(tx, tz);
    if (m.wk[k] === WK.HAN || m.tile[k] === T.BRIDGE) return '한강';
    const gi = m.gu[k];
    return gi >= 0 ? (GU[gi].north ? '강북' : '강남') : '서울섬';
  }

  addCollider(c) {
    this.colliders.push(c);
    const [x0, x1, z0, z1] = c.type === 'c' ? [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r] : [c.x0, c.x1, c.z0, c.z1];
    for (let gz = Math.floor(z0 / 4); gz <= Math.floor(z1 / 4); gz++) for (let gx = Math.floor(x0 / 4); gx <= Math.floor(x1 / 4); gx++) {
      const key = gx * 1000 + gz;
      if (!this.cgrid.has(key)) this.cgrid.set(key, []);
      this.cgrid.get(key).push(c);
    }
  }

  // ---------- 빛 (그림자 맵 대신 동그란 그림자) ----------
  buildLights() {
    this.hemi = new THREE.HemisphereLight('#ffffff', '#6aa84a', 1.8);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
    sun.position.set(30, 50, 25);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.sunOffset = sun.position.clone();
    this.amb = new THREE.AmbientLight('#ffffff', 0.1);
    this.scene.add(this.amb);
  }
  followSun(p) {
    this.sun.position.copy(p).add(this.sunOffset);
    this.sun.target.position.copy(p);
  }

  // ---------- 땅: 타일맵을 둥글게 다듬어 한 장의 그림으로 ----------
  // 타일마다 0/1 값을 이웃과 평균 낸 뒤 픽셀마다 이어 붙여 0.5에서 자르면 모서리가 둥근 모양이 됨
  field(pred, rad = 1) {
    const m = this.map, raw = new Float32Array(NX * NZ), out = new Float32Array(NX * NZ);
    for (let k = 0; k < NX * NZ; k++) raw[k] = pred(k) ? 1 : 0;
    // 가로 → 세로 상자 평균
    const tmp = new Float32Array(NX * NZ), n = rad * 2 + 1;
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      let s = 0; for (let d = -rad; d <= rad; d++) { const x = Math.min(NX - 1, Math.max(0, tx + d)); s += raw[tz * NX + x]; }
      tmp[tz * NX + tx] = s / n;
    }
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      let s = 0; for (let d = -rad; d <= rad; d++) { const z = Math.min(NZ - 1, Math.max(0, tz + d)); s += tmp[z * NX + tx]; }
      out[tz * NX + tx] = s / n;
    }
    void m;
    return out;
  }
  softField(pred) {
    const raw = new Float32Array(NX * NZ), tmp = new Float32Array(NX * NZ), out = new Float32Array(NX * NZ);
    for (let k = 0; k < NX * NZ; k++) raw[k] = pred(k) ? 1 : 0;
    const at = (a, x, z) => a[Math.min(NZ - 1, Math.max(0, z)) * NX + Math.min(NX - 1, Math.max(0, x))];
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) tmp[tz * NX + tx] = (at(raw, tx - 1, tz) + 2 * raw[tz * NX + tx] + at(raw, tx + 1, tz)) / 4;
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) out[tz * NX + tx] = (at(tmp, tx, tz - 1) + 2 * tmp[tz * NX + tx] + at(tmp, tx, tz + 1)) / 4;
    return out;
  }
  // 픽셀 (px, pz) 자리의 값 (타일 중심 사이를 이어 붙임)
  static sample(f, fx, fz) {
    const x = Math.min(NX - 1.001, Math.max(0, fx - 0.5)), z = Math.min(NZ - 1.001, Math.max(0, fz - 0.5));
    const x0 = x | 0, z0 = z | 0, ax = x - x0, az = z - z0, k = z0 * NX + x0;
    return (f[k] * (1 - ax) + f[k + 1] * ax) * (1 - az) + (f[k + NX] * (1 - ax) + f[k + NX + 1] * ax) * az;
  }

  buildGround() {
    const m = this.map, P = 8, W = NX * P, H = NZ * P;
    const land = (k) => m.tile[k] !== T.WATER && m.tile[k] !== T.BRIDGE;
    // 지천(중랑천·안양천·청계천…)·석촌호수: 1~2칸이라 둥글게 다듬으면 땅에 묻혀 버려서, 다듬지 않은 값으로 따로 파냄
    // 가운데에 무게를 둔 이웃 평균(1:2:1)으로 계단 모양만 다듬음 → 물이 실제 물 칸과 딱 맞게
    const STREAM = this.softField((k) => m.wk[k] === WK.STREAM && (m.tile[k] === T.WATER || m.tile[k] === T.BRIDGE));
    this.streamField = STREAM;
    const F = {
      land: this.field(land),
      forest: this.field((k) => land(k) && m.zone[k] === ZN.FOREST && m.tile[k] === T.GRASS, 2),
      sand: this.field((k) => m.tile[k] === T.SAND),
      path: this.field((k) => m.tile[k] === T.PATH || m.tile[k] === T.ROAD),
      plaza: this.field((k) => m.tile[k] === T.PLAZA),
      soil: this.field((k) => m.tile[k] === T.SOIL),
    };
    this.landField = F.land;
    // 무늬 (64px 반복)
    const r = rng(42);
    const pattern = (base, draw) => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 64, 64); draw?.(g);
      return g.getImageData(0, 0, 64, 64).data;
    };
    const blobs = (col, a, n, rw, rh) => (g) => { g.globalAlpha = a; g.fillStyle = col; for (let i = 0; i < n; i++) for (const [ox, oy] of [[0, 0], [64, 0], [0, 64], [64, 64], [-64, 0], [0, -64]]) { const x = r() * 64 + ox, y = r() * 64 + oy; g.beginPath(); g.ellipse(x % 128 - (x > 64 ? 64 : 0), y, rw * (0.6 + r() * 0.6), rh * (0.6 + r() * 0.6), r() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; };
    const grassStroke = (g) => {
      blobs(GROUND.grassLt, 0.55, 5, 9, 5)(g);
      g.strokeStyle = GROUND.grassDk; g.lineWidth = 1.6; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const x = 4 + r() * 56, y = 4 + r() * 54; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x - 0.7, y + 3.5); g.moveTo(x + 2, y); g.lineTo(x + 0.7, y + 3.5); g.stroke(); }
    };
    const PT = {
      grass: pattern(GROUND.grass, grassStroke),
      forest: pattern(GROUND.forest, (g) => { blobs('#62bc48', 0.5, 5, 9, 5)(g); g.strokeStyle = '#358f25'; g.lineWidth = 1.6; for (let i = 0; i < 8; i++) { const x = 4 + r() * 56, y = 4 + r() * 54; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x - 0.7, y + 3.5); g.moveTo(x + 2, y); g.lineTo(x + 0.7, y + 3.5); g.stroke(); } }),
      sand: pattern(GROUND.sand, blobs(GROUND.sandDk, 0.5, 6, 5, 3)),
      path: pattern(GROUND.path, blobs(GROUND.pathDk, 0.6, 5, 6, 4)),
      plaza: pattern(GROUND.plaza, (g) => { g.fillStyle = GROUND.plazaLine; for (let i = 0; i < 4; i++) { g.fillRect(i * 16, 0, 8, 64); g.fillRect(0, i * 16, 64, 8); } }),
      soil: pattern(GROUND.soil, (g) => { g.strokeStyle = GROUND.soilDk; g.lineWidth = 3; g.lineCap = 'round'; for (let y = 8; y < 64; y += 16) { g.beginPath(); g.moveTo(2, y); g.lineTo(62, y); g.stroke(); } }),
    };
    const order = [['soil', 0.5], ['plaza', 0.5], ['path', 0.42], ['sand', 0.5], ['forest', 0.55]];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    for (let py = 0; py < H; py++) {
      const fz = (py + 0.5) / P;
      for (let px = 0; px < W; px++) {
        const fx = (px + 0.5) / P, o = (py * W + px) * 4;
        if (World.sample(F.land, fx, fz) < 0.5 || World.sample(STREAM, fx, fz) > 0.4) { d[o + 3] = 0; continue; }
        let pt = PT.grass;
        for (const [name, thr] of order) if (World.sample(F[name], fx, fz) > thr) { pt = PT[name]; break; }
        const q = ((py & 63) * 64 + (px & 63)) * 4;
        d[o] = pt[q]; d[o + 1] = pt[q + 1]; d[o + 2] = pt[q + 2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = canvasTexture(c);
    tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(NX, NZ, 132, 110), toonMat({ map: tex, alphaTest: 0.5 }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this.groundMesh = ground;

    // 섬 둘레: 모래 → 하얀 물거품 → 얕은 물 (원래 서울섬처럼 겹겹이)
    const ring = (rad, thr, color, y, cut, Q = 4) => {
      const f = this.field(land, rad), w = NX * Q, h = NZ * Q;
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      const g = cc.getContext('2d'), im = g.createImageData(w, h), dd = im.data;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const o = (py * w + px) * 4;
        dd[o] = dd[o + 1] = dd[o + 2] = 255;
        const fx = (px + 0.5) / Q, fz = (py + 0.5) / Q;
        dd[o + 3] = World.sample(f, fx, fz) > thr && World.sample(STREAM, fx, fz) <= cut ? 255 : 0;
      }
      g.putImageData(im, 0, 0);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(NX, NZ, 66, 55), toonMat({ color, map: canvasTexture(cc), alphaTest: 0.5 }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = y;
      this.scene.add(mesh);
      return mesh;
    };
    ring(1, 0.32, '#f8d585', -0.1, 0.47);
    ring(1, 0.14, '#ffffff', -0.22, 0.3); // 지천엔 물거품을 두르지 않음 (좁아서 양쪽 거품이 겹침)
    this.shallow = ring(2, 0.1, '#62cde8', -0.4, 0.3);
  }

  buildWater() {
    const tex = waterTexture();
    tex.repeat.set(160, 160);
    this.waterTex = tex;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 90, 90), toonMat({ map: tex }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.55;
    this.scene.add(water);
    this.water = water;
  }

  // 나무 마무리: 표지판·미니게임 입구·시작 지점 주변을 비우고 인스턴싱
  finishTrees() {
    const clear = [
      ...this.signSpots.map((p) => ({ x: p.x, z: p.z, r: p.r ?? SIGN_CLEAR })),
      ...this.markers.map((mk) => ({ x: mk.position.x, z: mk.position.z, r: SIGN_CLEAR })),
      ...this.villagers.map((v) => ({ x: v.x, z: v.z, r: 2.4 })),
      { x: this.spawn.x, z: this.spawn.z, r: SPAWN_CLEAR },
    ];
    const gone = new Set();
    this.treeList = this.treeList.filter((t) => {
      if (!clear.some((c) => Math.hypot(t.x - c.x, t.z - c.z) < c.r)) return true;
      gone.add(`${t.x},${t.z}`); return false;
    });
    const keep = (c) => !(c.type === 'c' && gone.has(`${c.x},${c.z}`));
    this.colliders = this.colliders.filter(keep);
    for (const [k, list] of this.cgrid) this.cgrid.set(k, list.filter(keep));
    // 가까운 곳만 그리도록 24칸 구역으로 나눠서 인스턴싱
    const cells = new Map();
    for (const t of this.treeList) {
      const key = `${Math.floor(t.x / 24)},${Math.floor(t.z / 24)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(t);
    }
    for (const list of cells.values()) buildTrees(this, this.map, list);
    this.buildFlowers();
    this.buildGlows();
  }

  addMarker(x, y, z) {
    const m = new THREE.Mesh(starGeometry(), toonMat({ color: '#ffd166', emissive: '#7a5a00' }));
    m.position.set(x, y, z); m.userData.y = y;
    this.scene.add(m); this.markers.push(m);
  }

  // 한강 위 놀거리: 낚시 부두, 한강 달리기 출발선, 오리배 선착장, 다리 이름표
  buildRiverSpots() {
    const m = this.map, s = this.scene;
    const plank = () => { const p = toonMat({ map: plankTexture() }); return p; };
    const firstWaterNorth = (x, zStart) => { for (let z = zStart; z > zStart - 20; z -= 0.5) if (m.wk[m.i(...m.t(x, z))] === WK.HAN && m.tile[m.i(...m.t(x, z))] === T.WATER) return Math.floor(z + HZ) + 1 - HZ; return null; };
    // 낚시 부두 (노량진수산시장 앞)
    const dx = -16.5, bank = firstWaterNorth(dx, 37);
    if (bank !== null) {
      const len = 5.5, z1 = bank, z0 = bank - len;
      const dp = plank(); dp.map.repeat.set(1, 4);
      box(1.8, 0.2, len + 0.6, dp, dx, 0.0, (z0 + z1) / 2, s);
      for (let z = z0 + 0.3; z <= z1; z += 1.8) for (const x of [dx - 0.8, dx + 0.8]) { const p = new THREE.Mesh(GS.pile ||= new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), mat('#c99468')); p.position.set(x, -0.4, z); s.add(p); }
      this.walkRects.push({ x0: dx - 0.9, x1: dx + 0.9, z0: z0 - 0.3, z1: z1 + 0.5 });
      box(0.6, 0.45, 0.5, '#7bc8f6', dx + 0.5, 0.33, z0 + 0.4, s);
      this.addMarker(dx, 2.3, z0 + 0.6);
      this.interactables.push({ x: dx, z: z0 + 0.8, r: 1.7, label: '한강 낚시', kind: 'minigame', game: 'fish', ret: [dx, z0 + 1.6] });
    }
    // 한강 달리기 출발선 (여의도 한강공원)
    const rx = -28.5;
    let gz = null;
    for (let z = 26; z > 6; z -= 0.5) { const k = m.i(...m.t(rx, z)); if (m.tile[k] === T.SAND) { gz = Math.floor(z + HZ) + 0.5 - HZ; break; } }
    if (gz !== null) {
      const gate = new THREE.Group(); gate.position.set(rx, 0, gz);
      for (const gx of [-1.9, 1.9]) { box(0.25, 2.8, 0.25, '#fff8ec', gx, 1.4, 0, gate); sph(0.22, '#ff8fa3', gx, 2.9, 0, gate); }
      const banner = new THREE.Mesh(rbox(3.6, 0.6, 0.08), toonMat({ map: signTexture('한강 달리기', { w: 128, h: 26, size: 14, bg: '#ffd166' }) }));
      banner.position.set(0, 2.45, 0); gate.add(banner);
      for (let i = 0; i < 6; i++) box(0.3, 0.02, 0.3, i % 2 ? '#6b4f2e' : '#ffffff', -1.5 + i * 0.6, 0.02, 0.4, gate);
      s.add(gate);
      this.addCollider({ type: 'c', x: rx - 1.9, z: gz, r: 0.3 }); this.addCollider({ type: 'c', x: rx + 1.9, z: gz, r: 0.3 });
      this.addMarker(rx, 3.6, gz);
      this.interactables.push({ x: rx, z: gz + 0.6, r: 1.9, label: '해변 달리기', kind: 'minigame', game: 'runner', ret: [rx, gz + 1.6] });
    }
    // 오리배 선착장 (성동구 한강공원)
    const ox = 31.5;
    let oz = null;
    for (let z = 12; z < 22; z += 0.5) { const k = m.i(...m.t(ox, z)); if (m.tile[k] === T.SAND) { oz = Math.floor(z + HZ) + 0.5 - HZ; break; } }
    if (oz !== null) {
      const dock = new THREE.Group(); dock.position.set(ox, 0, oz);
      const dp = plank(); dp.map.repeat.set(3, 1);
      box(4.2, 0.16, 1.2, dp, 0, 0.0, 1.1, dock);
      this.duckBoats = [];
      ['#ffd166', '#fff8ec', '#ffb7c8', '#9fd8f5'].forEach((c, i) => {
        const b = new THREE.Group(); b.position.set(-1.6 + i * 1.05, -0.12, 2.5); b.rotation.y = Math.PI;
        sph(0.42, c, 0, 0, 0, b, 0.85, 0.5, 1.2);
        sph(0.22, c, 0, 0.42, 0.42, b);
        const bk = new THREE.Mesh(GS.cone ||= new THREE.ConeGeometry(1, 1, 12), mat('#ff9f43')); bk.scale.set(0.08, 0.18, 0.08); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.4, 0.66); b.add(bk);
        for (const sx of [-1, 1]) sph(0.035, '#2b1d14', sx * 0.09, 0.5, 0.6, b);
        dock.add(b); this.duckBoats.push(b);
      });
      const banner = new THREE.Mesh(rbox(2.6, 0.5, 0.08), toonMat({ map: signTexture('오리배 레이스', { w: 112, h: 22, size: 13, bg: '#ffd166' }) }));
      for (const gx of [-1.4, 1.4]) box(0.18, 2.2, 0.18, '#fff8ec', gx, 1.1, 0.4, dock);
      banner.position.set(0, 2.0, 0.4); dock.add(banner);
      s.add(dock);
      this.walkRects.push({ x0: ox - 2.1, x1: ox + 2.1, z0: oz + 0.4, z1: oz + 1.7 });
      this.addCollider({ type: 'c', x: ox - 1.4, z: oz + 0.4, r: 0.25 }); this.addCollider({ type: 'c', x: ox + 1.4, z: oz + 0.4, r: 0.25 });
      this.addMarker(ox, 3.0, oz + 0.9);
      this.interactables.push({ x: ox, z: oz + 1.0, r: 1.9, label: '오리배 레이스', kind: 'minigame', game: 'duckboat', ret: [ox, oz] });
    }
    this.buildFountain();
    // 다리 이름표 (북단)
    for (const b of m.bridgeInfo) {
      const sg = makeSign(b.name);
      const x = b.x0 - 0.9, z = b.z0 - 1.2;
      if (m.tileAt(x, z) === T.WATER) continue;
      sg.position.set(x, 0, z); sg.scale.setScalar(0.8); s.add(sg);
      this.addCollider({ type: 'c', x, z, r: 0.5 });
      this.signSpots.push({ x, z });
    }
  }

  // ---------- 반포한강공원 달빛무지개분수 (원래 서울섬 반포 무지개다리) ----------
  // 다리 양옆에서 강으로 떨어지는 물줄기: 낮엔 하얀 물, 노을이 지면 무지개색으로 빛남
  buildFountain() {
    const b = this.map.bridgeInfo.find((x) => x.name === '반포대교');
    if (!b) return;
    const RAINBOW = ['#ff8fa3', '#ffc86b', '#ffe07a', '#9ee0a8', '#8fd3ff', '#b8a6ff'];
    const cx = (b.x0 + b.x1) / 2, half = (b.x1 - b.x0) / 2;
    const z0 = b.z0 + 3.5, z1 = b.z1 - 3.5, n = Math.max(4, Math.floor((z1 - z0) / 1.6));
    this.fountain = [];
    let ci = 0;
    for (const side of [-1, 1]) for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n, x0 = cx + side * (half + 0.05);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, 1.45, z), new THREE.Vector3(cx + side * (half + 2.2), 3.0, z + 0.5), new THREE.Vector3(cx + side * (half + 3.8), -0.4, z + 1.1));
      const col = RAINBOW[ci++ % RAINBOW.length];
      const m = basic({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false });
      m.defines = { NO_GRADE: '' };
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.08, 5, false), m);
      this.scene.add(tube);
      this.fountain.push({ m, col: new THREE.Color(col), ph: k * 0.7 + side });
      this.glowSpots.push([cx + side * (half + 2.2), 2.4, z + 0.5, 2.4, col]);
    }
    // 안내판 (남쪽 강변)
    const sx = b.x1 + 1.6, sz = b.z1 + 1.6;
    if (this.canWalk(sx, sz, 0.6)) {
      const sg = makeSign('달빛무지개분수'); sg.position.set(sx, 0, sz); sg.rotation.y = Math.PI; this.scene.add(sg);
      this.addCollider({ type: 'c', x: sx, z: sz, r: 0.5 });
      this.signSpots.push({ x: sx, z: sz });
      const name = '반포한강공원 달빛무지개분수 (서초구)';
      this.interactables.push({ x: sx, z: sz - 0.7, r: 1.5, label: '달빛무지개분수 안내판', kind: 'dialog', name, tag: '#9B7FD9', lines: ['반포대교 양옆으로 물줄기가 쏟아지는 달빛무지개분수예요.\n세계에서 가장 긴 교량 분수로 기네스북에도 올랐어요.', '낮엔 하얀 물줄기지만, 노을이 지면 무지개색으로 반짝여요.\n해 질 녘에 꼭 다시 와 보세요!'] });
      this.landmarkPins?.push({ x: sx, z: sz, name: '달빛무지개분수' });
    }
  }

  // ---------- 가로등: 길가에 띄엄띄엄, 밤에 불이 켜짐 (서울섬 나무 기둥 + 동그란 등) ----------
  buildLamps(wideAt) {
    const m = this.map, spots = [];
    const taken = new Set();
    for (let tz = 1; tz < NZ - 1; tz++) for (let tx = 1; tx < NX - 1; tx++) {
      const k = m.i(tx, tz), t = m.tile[k];
      if ((t !== T.GRASS && t !== T.PLAZA) || m.zone[k] === ZN.LANDMARK || m.zone[k] === ZN.FOREST) continue;
      let dir = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wideAt(tx + dx, tz + dz)) { dir = [dx, dz]; break; }
      if (!dir) continue;
      const ck = `${Math.floor(tx / 7)},${Math.floor(tz / 7)}`;
      if (taken.has(ck) || (tx * 7 + tz * 13) % 5) continue;
      taken.add(ck);
      const x = tx + 0.5 - HX - dir[0] * 0.3, z = tz + 0.5 - HZ - dir[1] * 0.3;
      spots.push({ x, z });
      this.addCollider({ type: 'c', x, z, r: 0.14 });
    }
    // 원래 서울섬 가로등: 가는 나무 기둥 + 크림색 동그란 등, 노을이 지면 주황빛이 번짐
    const n = spots.length;
    const pole = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6); pole.translate(0, 1.1, 0);
    const bulb = new THREE.SphereGeometry(0.14, 8, 6); bulb.translate(0, 2.3, 0);
    this.lampBulb = basic({ color: '#ffe7a8' });
    const dummy = new THREE.Object3D();
    this.lampMeshes = [[pole, mat('#c99468')], [bulb, this.lampBulb]].map(([g, mt]) => {
      const im = new THREE.InstancedMesh(g, mt, n);
      spots.forEach((p, i) => { dummy.position.set(p.x, 0, p.z); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.frustumCulled = false;
      this.scene.add(im); return im;
    });
    for (const p of spots) this.glowSpots.push([p.x, 2.3, p.z, 2.4, '#ffb867']);
  }
  // 불빛 번짐 (원래 서울섬 glow 스프라이트를 한꺼번에 그리는 점들로)
  buildGlows() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.3, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    this.glowTex = canvasTexture(c);
    // 크기별로 나눠서 (PointsMaterial은 크기가 하나)
    const bySize = new Map();
    for (const sp of this.glowSpots) { const k = sp[3]; if (!bySize.has(k)) bySize.set(k, []); bySize.get(k).push(sp); }
    this.glowMats = [];
    for (const [size, list] of bySize) {
      const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3), cc = new THREE.Color();
      list.forEach((sp, i) => { pos.set([sp[0], sp[1], sp[2]], i * 3); cc.set(sp[4]); col.set([cc.r, cc.g, cc.b], i * 3); });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = stylize(new THREE.PointsMaterial({ size, map: this.glowTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.defines = { NO_GRADE: '' }; // 불빛 색은 노을 보정에서 빼기
      const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 3;
      this.scene.add(pts); this.glowMats.push(m);
    }
  }
  // 노을·밤 정도(0~1)에 맞춰 불빛 켜기
  setLamps(on) {
    if (!this.lampBulb) return;
    const k = THREE.MathUtils.smoothstep(on, 0.25, 0.6);
    this.lampBulb.color.set('#ffe7a8').lerp(new THREE.Color('#fff4d0'), k);
    for (const m of this.glowMats || []) { m.opacity = k * 0.85; m.visible = k > 0.01; }
  }

  // ---------- 나무 흩뿌리기 (숲은 빽빽하게, 공원·길가는 적당히, 빈 풀밭은 드문드문) ----------
  scatter() {
    const r = this.r, m = this.map;
    const blocked = (x, z, rad) => {
      const cell = this.cgrid.get(Math.floor(x / 4) * 1000 + Math.floor(z / 4)) || [];
      return cell.some((c) => (c.type === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + rad : x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad));
    };
    const plant = (x, z, kind, sc) => {
      if (blocked(x, z, 0.6)) return;
      this.treeList.push({ x, z, kind, s: sc, ry: r() * 3 });
      this.addCollider({ type: 'c', x, z, r: 0.42 * sc });
    };
    const isWay = (t) => t === T.ROAD || t === T.PATH;
    const wideAt = (x, z) => {
      if (!m.inb(x, z) || !isWay(m.tile[m.i(x, z)])) return false;
      let c = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (m.inb(x + dx, z + dz) && isWay(m.tile[m.i(x + dx, z + dz)])) c++;
      return c >= 5;
    };
    const nearWide = (tx, tz) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => wideAt(tx + dx, tz + dz));
    this.buildLamps(wideAt);
    // 구마다 나무 성격 (벚꽃 많은 곳 / 은행나무 많은 곳)
    const BLOSSOM = new Set(['영등포구', '송파구', '중랑구', '서대문구', '광진구']);
    const GINKGO = new Set(['종로구', '중구', '성북구', '강남구', '서초구']);
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      const k = m.i(tx, tz);
      if (m.tile[k] !== T.GRASS) continue;
      const zone = m.zone[k];
      if (zone === ZN.LANDMARK) continue;
      const x = tx + 0.5 - HX + (r() - 0.5) * 0.6, z = tz + 0.5 - HZ + (r() - 0.5) * 0.6;
      const gname = m.gu[k] >= 0 ? GU[m.gu[k]].name : '';
      const pick = () => { const v = r(); if (BLOSSOM.has(gname) && v < 0.4) return 'maple'; if (GINKGO.has(gname) && v < 0.3) return 'ginkgo'; return v < 0.86 ? 'round' : v < 0.94 ? 'maple' : 'ginkgo'; };
      if (zone === ZN.FOREST) {
        if (r() < 0.11) plant(x, z, r() < 0.45 ? 'pine' : 'round', 0.9 + r() * 0.35);
        continue;
      }
      if (zone === ZN.PARK) { if (r() < 0.05) plant(x, z, pick(), 0.85 + r() * 0.3); continue; }
      if (nearWide(tx, tz)) { if ((tx + tz) % 7 === 0 && r() < 0.45) plant(x, z, pick(), 0.8 + r() * 0.15); continue; }
      if (r() < 0.006) plant(x, z, pick(), 0.85 + r() * 0.35);
    }
  }

  // 꽃 (원래 서울섬처럼 세 송이씩 모여 핌) + 풀포기
  buildFlowers() {
    const r = this.r, m = this.map;
    const fpos = [];
    for (let i = 0; i < 40000 && fpos.length < 6000; i++) {
      const x = (r() - 0.5) * NX, z = (r() - 0.5) * NZ;
      const [tx, tz] = m.t(x, z);
      if (!m.inb(tx, tz)) continue;
      const k = m.i(tx, tz);
      if (m.tile[k] !== T.GRASS || m.zone[k] === ZN.LANDMARK) continue;
      if (!this.canWalk(x, z, 0.3)) continue;
      for (let j = 0; j < 3; j++) fpos.push([x + (r() - 0.5) * 0.7, z + (r() - 0.5) * 0.7]);
    }
    const FL = ['#ffffff', '#ffd166', '#ff8fa3', '#c3a6ff', '#ffffff'].map((c) => soft(c));
    const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 6), toonMat({ color: '#ffffff' }), fpos.length);
    const lg = new THREE.SphereGeometry(0.17, 8, 5); lg.scale(1, 0.35, 1);
    const lm = new THREE.InstancedMesh(lg, toonMat('#5aad78'), fpos.length);
    const mtx = new THREE.Matrix4();
    fpos.forEach((p, i) => {
      mtx.makeTranslation(p[0], 0.2, p[1]); fm.setMatrixAt(i, mtx);
      mtx.makeTranslation(p[0], 0.07, p[1]); lm.setMatrixAt(i, mtx);
      fm.setColorAt(i, FL[(r() * FL.length) | 0]);
    });
    fm.frustumCulled = lm.frustumCulled = false;
    this.scene.add(lm, fm);
  }

  // ---------- 동물 · 고양이 시장 · 나비 ----------
  buildLife() {
    const r = this.r;
    const coop = this.coop || { x: 0, z: 0 };
    for (let i = 0; i < 5; i++) {
      const c = makeChicken();
      c.position.set(coop.x - 2 + r() * 4, 0, coop.z + 0.5 + r() * 1.5);
      c.userData.target = c.position.clone(); c.userData.home = c.position.clone(); c.userData.wait = r() * 2;
      this.scene.add(c); this.animals.push(c);
    }
    for (const [hx, hz, n] of [[-0.6, -3.2, 6], [1.2, 9, 4], [32.4, 51.4, 4], [-30, 26, 4]]) {
      for (let i = 0; i < n; i++) {
        const p = makePigeon();
        p.position.set(hx + (r() - 0.5) * 2, 0, hz + (r() - 0.5) * 2);
        if (!this.canWalk(p.position.x, p.position.z, 0.2)) continue;
        p.userData = { ...p.userData, target: p.position.clone(), home: new THREE.Vector3(hx, 0, hz), wait: r() * 2, fly: 0 };
        this.scene.add(p); this.pigeons.push(p);
      }
    }
    // 냥시장 (고양이 시장님, 광화문광장)
    const catAv = new Avatar(npcLook({ type: 'cat', fur: '#f0a040', accent: '#fff4e0', shirt: '#7bc8f6', pants: '#4a6fa5' }), { height: 1.45 });
    // 시장님 띠
    box(0.08, 0.9, 0.06, '#ffd166', 0, 0.62, 0.36, catAv.joints.body).rotation.z = 0.7;
    const cat = catAv.root;
    cat.userData.avatar = catAv;
    cat.position.set(-1.1, 0, -3.4);
    cat.userData.home = cat.position.clone(); cat.userData.target = cat.position.clone(); cat.userData.wait = 1;
    this.scene.add(cat);
    this.cat = cat;
    this.catInteract = {
      x: cat.position.x, z: cat.position.z, r: 1.8, label: '냥시장에게 말 걸기', kind: 'dialog', name: '냥시장', tag: '#E08E1F',
      lines: [
        '어서 오라냥! 나는 서울섬의 시장, 냥시장이다냥.\n여기는 서울섬 한가운데, 광화문광장이다냥.',
        '서울섬은 한강을 사이에 두고 강북과 강남으로 나뉜다냥.\n다리를 건너거나 지하철·수상택시를 타 보라냥.',
        '노란 별이 떠 있는 곳엔 주민들이 놀이를 준비해 뒀다냥!\n말을 걸면 같이 놀 수 있다냥. 이기면 벨을 준다냥~',
        'M을 누르면 지도를 크게 볼 수 있고, T를 누르면 택시를 부른다냥.',
      ],
    };
    this.interactables.push(this.catInteract);
    // 나비
    const wingMat = ['#fff3a6', '#ffb7c8', '#ffffff'].map((c) => toonMat(c, { side: THREE.DoubleSide }));
    const wingG = new THREE.CircleGeometry(0.1, 10);
    const spots = [[2, -12], [8, 12], [36, 11], [63.5, 8.5], [88, 31], [42, -93], [0, 0], [-20, -60], [75, 42], [-10.5, 33.5], [-84, -5], [23, 63]];
    for (let i = 0; i < 30; i++) {
      const b = new THREE.Group();
      const mt = wingMat[i % 3];
      const l = new THREE.Mesh(wingG, mt); l.position.x = -0.09;
      const rr = new THREE.Mesh(wingG, mt); rr.position.x = 0.09;
      const lw = new THREE.Group(); lw.add(l); const rw = new THREE.Group(); rw.add(rr);
      b.add(lw, rw);
      const [sx, sz] = spots[i % spots.length];
      b.userData = { lw, rw, phase: r() * 10, cx: sx + (r() - 0.5) * 6, cz: sz + (r() - 0.5) * 6, rad: 1.5 + r() * 2.5 };
      this.scene.add(b); this.butterflies.push(b);
    }
  }

  // 미니맵용 그림 (1px = 1타일, 서울섬 지도 색)
  buildMinimap() {
    const m = this.map, c = document.createElement('canvas');
    c.width = NX; c.height = NZ;
    const ctx = c.getContext('2d'), img = ctx.createImageData(NX, NZ);
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const col = { [T.GRASS]: hex('#6cc63f'), [T.SAND]: hex('#f8d585'), [T.PATH]: hex('#eec27a'), [T.SOIL]: hex('#e0b58c'), [T.PLAZA]: hex('#fff6e6'), [T.BRIDGE]: hex('#fff8ec'), [T.ROAD]: hex('#eec27a') };
    const sea = hex('#36b2e0'), river = hex('#4fc0e6'), forest = hex('#4cae38'), lm = hex('#ffd1dc');
    for (let k = 0; k < NX * NZ; k++) {
      const t = m.tile[k];
      let cc = t === T.WATER ? (m.wk[k] === WK.OUT ? sea : river) : col[t];
      if (t === T.GRASS && m.zone[k] === ZN.FOREST) cc = forest;
      if (m.zone[k] === ZN.LANDMARK && t !== T.WATER && t !== T.BRIDGE) cc = lm;
      img.data.set([...cc, 255], k * 4);
    }
    ctx.putImageData(img, 0, 0);
    this.minimap = c;
  }

  canWalk(x, z, rad = 0.3) {
    for (const w of this.walkRects) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return true;
    for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) if (this.tileAt(x + dx, z + dz) === T.WATER) return false;
    const seen = new Set();
    for (const [qx, qz] of [[x - rad, z - rad], [x + rad, z - rad], [x - rad, z + rad], [x + rad, z + rad]]) {
      const key = Math.floor(qx / 4) * 1000 + Math.floor(qz / 4);
      if (seen.has(key)) continue;
      seen.add(key);
      const cell = this.cgrid.get(key);
      if (!cell) continue;
      for (const c of cell) {
        if (c.type === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return false; }
        else if (x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad) return false;
      }
    }
    return true;
  }

  update(dt, t, playerPos, camera) {
    this.waterTex.offset.x = (t * 0.018) % 1;
    if (playerPos && camera) {
      U.stOn.value = 1;
      U.stP.value.set(playerPos.x, playerPos.y + 0.9, playerPos.z);
      U.stC.value.copy(camera.position);
    } else U.stOn.value = 0;
    // 멀리 있는 나무 구역은 안 그림 (휘는 지평선 때문에 자동 컬링 대신 거리로)
    if (playerPos) for (const im of this.treeMeshes || []) { const c = im.userData.c; im.visible = Math.hypot(c[0] - playerPos.x, c[1] - playerPos.z) < 125; }
    for (const mk of this.markers) { mk.position.y = mk.userData.y + Math.sin(t * 3) * 0.15; mk.rotation.y = t * 2; }
    if (this.fountain) {
      const k = THREE.MathUtils.smoothstep(U.uDusk.value, 0.3, 0.9);
      for (const f of this.fountain) { f.m.color.setRGB(1, 1, 1).lerp(f.col, k); f.m.opacity = (0.62 + 0.25 * Math.sin(t * 3 + f.ph)) * (0.85 + 0.15 * k); }
    }
    for (const b of this.duckBoats || []) { b.position.y = -0.12 + Math.sin(t * 1.6 + b.position.x) * 0.05; b.rotation.z = Math.sin(t * 1.2 + b.position.x) * 0.05; }
    // 닭
    for (const a of this.animals) {
      const ud = a.userData;
      const d = a.position.distanceTo(ud.target);
      if (d < 0.1) {
        ud.wait -= dt;
        ud.body.rotation.x = Math.max(0, Math.sin(t * 6 + a.id)) * 0.4;
        if (ud.wait < 0) {
          ud.wait = 1 + Math.random() * 3;
          const nx = a.position.x + (Math.random() - 0.5) * 5, nz = a.position.z + (Math.random() - 0.5) * 5;
          if (this.canWalk(nx, nz, 0.3) && Math.hypot(nx - ud.home.x, nz - ud.home.z) < 5) ud.target.set(nx, 0, nz);
        }
      } else {
        ud.body.rotation.x = 0;
        const dir = ud.target.clone().sub(a.position).normalize();
        a.position.addScaledVector(dir, Math.min(d, dt * 1.6));
        a.rotation.y = Math.atan2(dir.x, dir.z);
        a.position.y = Math.abs(Math.sin(t * 16)) * 0.06;
      }
      if (playerPos && a.position.distanceTo(playerPos) < 1.4) {
        const away = a.position.clone().sub(playerPos).setY(0).normalize().multiplyScalar(2.5).add(a.position);
        if (this.canWalk(away.x, away.z, 0.3)) ud.target.copy(away);
      }
    }
    // 비둘기
    for (const p of this.pigeons) {
      const ud = p.userData;
      if (ud.fly > 0) {
        ud.fly -= dt;
        const dir = ud.target.clone().sub(p.position).setY(0);
        const d = dir.length();
        if (d > 0.05) { p.position.addScaledVector(dir.normalize(), Math.min(d, dt * 4)); p.rotation.y = Math.atan2(dir.x, dir.z); }
        p.position.y = Math.max(0, Math.sin(Math.min(1, 1 - ud.fly / 1.4) * Math.PI) * 1.6);
        ud.body.rotation.z = Math.sin(t * 40) * 0.3;
        if (ud.fly <= 0) { p.position.y = 0; ud.body.rotation.z = 0; }
        continue;
      }
      ud.wait -= dt;
      ud.body.rotation.x = Math.max(0, Math.sin(t * 7 + p.id)) * 0.5;
      if (ud.wait < 0) {
        ud.wait = 0.6 + Math.random() * 2;
        const nx = p.position.x + (Math.random() - 0.5) * 1.2, nz = p.position.z + (Math.random() - 0.5) * 1.2;
        if (this.canWalk(nx, nz, 0.2) && Math.hypot(nx - ud.home.x, nz - ud.home.z) < 2.5) { p.position.set(nx, 0, nz); p.rotation.y = Math.random() * 6; }
      }
      if (playerPos && p.position.distanceTo(playerPos) < 1.6) {
        for (let k = 0; k < 6; k++) {
          const nx = ud.home.x + (Math.random() - 0.5) * 4, nz = ud.home.z + (Math.random() - 0.5) * 4;
          if (this.canWalk(nx, nz, 0.2) && Math.hypot(nx - playerPos.x, nz - playerPos.z) > 2.5) { ud.target.set(nx, 0, nz); ud.fly = 1.4; break; }
        }
      }
    }
    // 냥시장: 광장을 느긋하게 산책, 플레이어가 오면 멈춰서 손 흔듦
    const cat = this.cat, cu = cat.userData;
    const near = playerPos && cat.position.distanceTo(playerPos) < 2.6;
    const cd = cat.position.distanceTo(cu.target);
    let catMoving = false, yaw;
    if (near) yaw = Math.atan2(playerPos.x - cat.position.x, playerPos.z - cat.position.z);
    else if (cd < 0.1) {
      cu.wait -= dt;
      if (cu.wait < 0) {
        cu.wait = 2 + Math.random() * 3;
        const nx = cu.home.x + (Math.random() - 0.5) * 1.4, nz = cu.home.z + (Math.random() - 0.5) * 4;
        if (this.canWalk(nx, nz, 0.4)) cu.target.set(nx, 0, nz);
      }
    } else {
      const dir = cu.target.clone().sub(cat.position).normalize();
      cat.position.addScaledVector(dir, Math.min(cd, dt * 1.2));
      catMoving = true; yaw = Math.atan2(dir.x, dir.z);
    }
    cu.avatar.animate(dt, t, { moving: catMoving, yaw, wave: near && Math.sin(t * 0.8) > 0.4 });
    this.catInteract.x = cat.position.x; this.catInteract.z = cat.position.z + 0.4;
    // 주민들
    for (const v of this.villagers) v.update(dt, t, playerPos);
    // 나비
    for (const b of this.butterflies) {
      const u = b.userData, ph = t * 0.5 + u.phase;
      b.position.set(u.cx + Math.cos(ph) * u.rad, 1.2 + Math.sin(ph * 3) * 0.4, u.cz + Math.sin(ph * 1.3) * u.rad);
      b.rotation.y = -ph;
      const f = Math.sin(t * 22 + u.phase) * 1.1;
      u.lw.rotation.y = f; u.rw.rotation.y = -f;
    }
    // 서울섬 하늘을 도는 비행기
    if (this.flyPlane) {
      const a = t * 0.045, R = 70;
      this.flyPlane.position.set(Math.cos(a) * R * 1.3, 24 + Math.sin(t * 0.3) * 1.5, Math.sin(a) * R);
      const ax = -Math.sin(a) * R * 1.3, az = Math.cos(a) * R;
      this.flyPlane.rotation.set(0, Math.atan2(ax, az), 0);
      this.flyPlane.rotateZ(-0.25);
    }
    // 강남역 전광판
    const sc = this.screen;
    if (sc && (sc.t += dt) > 0.25) {
      sc.t = 0;
      const ctx = sc.ctx, ph = Math.floor(t * 4), W = sc.c.width, H = sc.c.height;
      const pals = [['#ff8fb8', '#ffe07a', '#8fe0ff'], ['#a6f0a0', '#8fb0ff', '#ffffff'], ['#ffe07a', '#ffab8f', '#c3a6ff']];
      const p = pals[Math.floor(t / 3) % 3];
      ctx.fillStyle = '#3a3150'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = p[(i + ph) % 3]; ctx.beginPath(); ctx.arc(((i * 7 + ph * 3) % 36) * W / 32, (4 + (i % 3) * 5) * H / 20, H * 0.12, 0, 7); ctx.fill(); }
      sc.tex.needsUpdate = true;
    }
    void mergeGeometries;
  }
}
