import * as THREE from 'three';
import { T, NX, NZ, HX, HZ } from './seoulMap.js';
import { U, toonMat, soft, rbox, stylize, blobShadow } from './toon.js';
import { rng } from './rng.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 서울섬엔 쓸모없는 빌딩·주택을 채우지 않아요. 여기엔 합친 지오메트리 도우미·나무·다리만 있어요.
export const ST = U;
export function seeThrough(m) { return stylize(m); }

const lmatCache = new Map();
export function lmat(color, extra) {
  const key = color + (extra ? JSON.stringify(Object.keys(extra)) : '');
  if (!extra && lmatCache.has(key)) return lmatCache.get(key);
  const m = toonMat({ color, ...extra });
  if (!extra) lmatCache.set(key, m);
  return m;
}

// ---------- 지오메트리 합치기 (정점색) ----------
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();
const geoCache = {};
const niCache = new WeakMap();
const nonIndexed = (g) => { if (!g.index) return g; let n = niCache.get(g); if (!n) { n = g.toNonIndexed(); niCache.set(g, n); } return n; };
export class Merger {
  // round: 상자 모서리를 둥글게 (서울섬 그림체). 아주 많은 작은 조각(다리 상판)은 false
  constructor({ round = true } = {}) { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.round = round; }
  add(geom, color, matrix) {
    const g = nonIndexed(geom);
    const p = g.attributes.position, nm = g.attributes.normal, u = g.attributes.uv;
    soft(color, _c);
    _n.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nm, i).applyMatrix3(_n).normalize(); this.nor.push(_v.x, _v.y, _v.z);
      if (u) this.uv.push(u.getX(i), u.getY(i)); else this.uv.push(0, 0);
      this.col.push(_c.r, _c.g, _c.b);
    }
    return this;
  }
  box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    if (this.round) {
      _m.compose(_v.set(x, y, z), _q, _s.set(1, 1, 1));
      return this.add(rbox(Math.abs(w), Math.abs(h), Math.abs(d)), color, _m);
    }
    geoCache.box ||= new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    _m.compose(_v.set(x, y, z), _q, _s.set(w, h, d));
    return this.add(geoCache.box, color, _m);
  }
  cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8, sx = 1, sz = 1) {
    const sg = seg >= 6 ? Math.max(seg, 18) : seg; // 둥근 기둥은 매끈하게
    const key = `c${rt}_${rb}_${sg}`;
    geoCache[key] ||= new THREE.CylinderGeometry(rt, rb, 1, sg).toNonIndexed();
    _m.compose(_v.set(x, y, z), _q.identity(), _s.set(sx, h, sz));
    return this.add(geoCache[key], color, _m);
  }
  geom(g, color, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    return this.add(g, color, _m);
  }
  sphere(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    geoCache.sph ||= new THREE.SphereGeometry(1, 16, 12).toNonIndexed();
    _m.compose(_v.set(x, y, z), _q.identity(), _s.set(r * sx, r * sy, r * sz));
    return this.add(geoCache.sph, color, _m);
  }
  // 한옥 지붕: 사다리꼴 단면, 처마 끝을 살짝 들어 올림
  hanokRoof(w, d, h, color, x, y, z, ry = 0) {
    const key = 'hroof';
    if (!geoCache[key]) {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0); s.lineTo(-0.56, 0.08); s.quadraticCurveTo(-0.32, 0.3, -0.2, 0.75); s.lineTo(0.2, 0.75); s.quadraticCurveTo(0.32, 0.3, 0.56, 0.08); s.lineTo(0.5, 0);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, -0.5);
      geoCache[key] = g.toNonIndexed();
    }
    this.geom(geoCache[key], color, x, y, z, ry + Math.PI / 2, d, h, w);
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const lx = s1 * (w / 2), lz = s2 * (d * 0.55);
      this.box(0.2, 0.14, 0.2, color, x + lx * c + lz * sn, y + 0.12, z - lx * sn + lz * c, ry);
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
  build(material) { return new THREE.Mesh(this.geometry(), material || vcMat()); }
  get empty() { return this.pos.length === 0; }
}
let VC = null;
export function vcMat() { return (VC ||= toonMat({ vertexColors: true })); }

// ---------- 나무 (원래 서울섬 동글동글 나무, 인스턴싱) ----------
//  round: 초록 뭉게 나무 · maple: 벚꽃 나무 · ginkgo: 노란 은행나무 · pine: 고깔 소나무
const TREE_COLS = {
  round: ['#55b86e', '#46a35e', '#8fd89e'], maple: ['#ff9fb8', '#ff86a4', '#ffd0dc'], ginkgo: ['#ffcc4d', '#f2b632', '#ffe28a'],
};
// 나무는 수천 그루라 정점 수를 아끼려고 인덱스 지오메트리를 그대로 합침
const treeCache = {};
function treeGeometry(kind) {
  if (treeCache[kind]) return treeCache[kind];
  const parts = [];
  const part = (g, color, x, y, z, sx, sy = sx, sz = sx) => {
    g = g.clone(); g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
    const c = soft(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  part(new THREE.CylinderGeometry(0.2, 0.28, 1, 8, 1), '#b58965', 0, 0.7, 0, 1, 1.4, 1);
  if (kind === 'pine') {
    const c = ['#3f9a5e', '#4fae6c', '#6cc484'], cg = new THREE.ConeGeometry(1, 1, 10, 1);
    [[1.3, 1.5, 1.7], [1.0, 1.3, 2.5], [0.7, 1.1, 3.2]].forEach(([r, h, y], i) => part(cg, c[i], 0, y, 0, r, h, r));
  } else {
    const [a, b, hi] = TREE_COLS[kind] || TREE_COLS.round, sg = new THREE.SphereGeometry(1, 12, 8);
    part(sg, a, 0, 2.25, 0, 1.25, 1.19, 1.25);
    part(sg, b, 0.75, 1.85, 0.35, 0.9);
    part(sg, b, -0.7, 1.95, -0.3, 0.85);
    part(sg, hi, -0.3, 2.95, 0.5, 0.55);
  }
  return (treeCache[kind] = mergeGeometries(parts));
}

export function buildTrees(world, map, list) {
  const kinds = ['round', 'maple', 'ginkgo', 'pine'];
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  const shadowGeo = new THREE.CircleGeometry(1, 16); shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.InstancedMesh(shadowGeo, blobShadow(new THREE.Group()).material, list.length);
  shadow.renderOrder = 1; shadow.frustumCulled = false;
  let si = 0;
  world.treeMeshes ||= [];
  const cx = list.reduce((a, t) => a + t.x, 0) / list.length, cz = list.reduce((a, t) => a + t.z, 0) / list.length;
  for (const kind of kinds) {
    const items = list.filter((t) => t.kind === kind);
    if (!items.length) continue;
    const im = new THREE.InstancedMesh(treeGeometry(kind), vcMat(), items.length);
    items.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.ry || 0, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, tint.setScalar(0.94 + ((i * 13) % 9) / 140));
      dummy.position.y = 0.04; dummy.scale.setScalar(t.s * 1.35); dummy.updateMatrix();
      shadow.setMatrixAt(si++, dummy.matrix);
    });
    im.frustumCulled = false; im.userData.c = [cx, cz];
    world.scene.add(im); world.treeMeshes.push(im);
  }
  shadow.count = si; shadow.userData.c = [cx, cz];
  world.scene.add(shadow); world.treeMeshes.push(shadow);
}

// ---------- 다리 ----------
// 한강 다리: 물 위로 BRIDGE_H만큼 떠 있고, 양 끝은 비탈 → 수상택시가 다리 밑으로 지나감
// 서울섬 다리처럼 하얀 상판 + 알록달록 난간 + 나무 기둥
export const BRIDGE_H = 1.7, BRIDGE_RAMP = 3;
const RAIL = ['#7fcb98', '#ff8fa3', '#c3a6ff', '#ffd166', '#7bc8f6'];
export function buildBridges(world, map) {
  const big = new Merger({ round: false }), deco = new Merger(), small = new Merger({ round: false });
  const isB = (tx, tz, kind) => tx >= 0 && tz >= 0 && tx < NX && tz < NZ && map.tile[tz * NX + tx] === T.BRIDGE && map.bkind[tz * NX + tx] === kind;
  const span0 = new Float32Array(NX * NZ), span1 = new Float32Array(NX * NZ);
  for (let tx = 0; tx < NX; tx++) for (let tz = 0; tz < NZ; tz++) {
    if (!isB(tx, tz, 1) || isB(tx, tz - 1, 1)) continue;
    let e = tz; while (isB(tx, e + 1, 1)) e++;
    for (let j = tz; j <= e; j++) { span0[j * NX + tx] = tz - HZ; span1[j * NX + tx] = e + 1 - HZ; }
  }
  const hAt = (k, z) => BRIDGE_H * THREE.MathUtils.smoothstep(Math.min(z - span0[k], span1[k] - z), 0, Math.min(BRIDGE_RAMP, (span1[k] - span0[k]) * 0.2));
  world.groundY = (x, z) => {
    const tx = Math.floor(x + HX), tz = Math.floor(z + HZ);
    return isB(tx, tz, 1) ? hAt(tz * NX + tx, z) : 0;
  };
  world.bridgePiers = [];
  // 다리마다 난간 색
  const railOf = (x) => {
    let bi = 0, bd = 1e9;
    (map.bridgeInfo || []).forEach((b, i) => { const d = Math.abs((b.x0 + b.x1) / 2 - x); if (d < bd) { bd = d; bi = i; } });
    return RAIL[bi % RAIL.length];
  };
  const pierSpan = (tx, s, x) => {
    let e = s; while (isB(tx, e + 1, 1)) e++;
    let o0 = -1, o1 = -1;
    for (let j = s; j <= e; j++) if (map.hanOrig ? map.hanOrig[j * NX + tx] : 1) { if (o0 < 0) o0 = j; o1 = j; }
    if (o0 < 0) return;
    const oldLen = o1 - o0 + 1, off = o0, ramp = Math.min(BRIDGE_RAMP, oldLen * 0.2);
    let n = 0;
    for (let j = 0; j < oldLen; j++) if ((off + j) % 3 === 0 && BRIDGE_H * THREE.MathUtils.smoothstep(Math.min(j + 0.5, oldLen - j - 0.5), 0, ramp) > 0.5) n++;
    if (!n) return;
    let a = -1, b = -1;
    for (let j = s; j <= e; j++) if (hAt(s * NX + tx + (j - s) * NX, j + 0.5 - HZ) > 0.5) { if (a < 0) a = j; b = j + 1; }
    if (a < 0) return;
    for (let i = 0; i < n; i++) {
      const z = a - HZ + ((i + 0.5) * (b - a)) / n, h = hAt(Math.floor(z + HZ) * NX + tx, z);
      const top = h - 0.28, bot = -1.2;
      for (const px of [x + 0.05, x + 0.95]) deco.cyl(0.32, 0.36, top - bot, '#c99468', px, (top + bot) / 2, z, 12);
      world.bridgePiers.push({ x0: x + 0.5 - 0.95, x1: x + 0.5 + 0.95, z0: z - 0.36, z1: z + 0.36 });
    }
  };
  for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
    const k = tz * NX + tx;
    if (map.tile[k] !== T.BRIDGE) continue;
    const x = tx + 0.5 - HX, z = tz + 0.5 - HZ;
    if (map.bkind[k] === 1) {
      for (let q = 0; q < 4; q++) {
        const zq = tz - HZ + (q + 0.5) / 4, h = hAt(k, zq);
        big.box(1.02, 0.3, 0.27, '#fff8ec', x, h - 0.13, zq);
      }
      const h = hAt(k, z), rc = railOf(x);
      for (const [nx, sx] of [[tx - 1, -1], [tx + 1, 1]]) {
        if (isB(nx, tz, 1)) continue;
        for (let q = 0; q < 2; q++) { const zq = tz - HZ + 0.25 + q * 0.5; big.box(0.16, 0.14, 0.52, rc, x + sx * 0.44, hAt(k, zq) + 0.62, zq); }
        if (tz % 2 === 0) deco.box(0.18, 0.62, 0.18, '#c99468', x + sx * 0.44, h + 0.31, z);
        if (tz % 4 === 0) deco.sphere(0.14, '#ffe7a8', x + sx * 0.44, h + 0.75, z);
      }
      if (!isB(tx - 1, tz, 1) && !isB(tx, tz - 1, 1)) pierSpan(tx, tz, x);
    } else {
      small.box(1, 0.16, 1, '#e9b98f', x, -0.02, z);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = tx + dx, nz = tz + dz;
        if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
        if (map.tile[nz * NX + nx] === T.WATER) small.box(dx ? 0.1 : 1, 0.3, dz ? 0.1 : 1, '#c99468', x + dx * 0.45, 0.2, z + dz * 0.45);
      }
    }
  }
  for (const M of [big, deco, small]) if (!M.empty) world.scene.add(M.build());
  void rng;
}
