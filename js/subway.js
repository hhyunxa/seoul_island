import * as THREE from 'three';
import { box } from './world.js';
import { geo, T, ZN } from './seoulMap.js';
import { signTexture } from './textures.js';

// ============================================================
//  지하철 2호선 (주요 역만): 역 입구에서 E → 역 고르기 → 순간이동
//  STATIONS 순서는 실제 2호선 순환 방향(시청 → 왕십리 → 잠실 → 강남 → 신도림 → 홍대입구 → 시청)
// ============================================================
export const LINE2 = '#33a23d';
export const STATIONS = [
  { id: 'cityhall', name: '시청', lon: 126.9770, lat: 37.5657, near: '덕수궁·광화문' },
  { id: 'wangsimni', name: '왕십리', lon: 127.0371, lat: 37.5613, near: '성동구청·서울숲' },
  { id: 'jamsil', name: '잠실', lon: 127.1000, lat: 37.5133, near: '롯데월드타워·석촌호수' },
  { id: 'gangnam', name: '강남', lon: 127.0276, lat: 37.4979, near: '강남대로·테헤란로' },
  { id: 'sindorim', name: '신도림', lon: 126.8913, lat: 37.5088, near: '구로·영등포' },
  { id: 'hongdae', name: '홍대입구', lon: 126.9245, lat: 37.5572, near: '홍대 거리·연남동' },
];

function entranceModel(name) {
  const g = new THREE.Group();
  const wall = '#cfd3d6', dark = '#3a3f46';
  // 양옆·뒤 낮은 벽 + 초록 지붕
  box(0.12, 0.9, 1.8, wall, -0.75, 0.45, 0, g); box(0.12, 0.9, 1.8, wall, 0.75, 0.45, 0, g);
  box(1.62, 0.9, 0.12, wall, 0, 0.45, -0.9, g);
  for (const x of [-0.75, 0.75]) box(0.1, 1.5, 0.1, '#8a9096', x, 1.35, 0.85, g);
  const roof = box(1.9, 0.12, 2.1, LINE2, 0, 2.1, 0, g); roof.rotation.x = -0.08;
  box(1.92, 0.06, 0.08, '#ffffff', 0, 2.02, 1.05, g);
  // 내려가는 계단 (안쪽으로 갈수록 낮고 어둡게)
  for (let i = 0; i < 6; i++) box(1.36, 0.06, 0.28, i % 2 ? '#7a7f86' : '#8a9096', 0, 0.04 - i * 0.002, 0.65 - i * 0.28, g).castShadow = false;
  box(1.36, 0.02, 0.6, dark, 0, 0.05, -0.62, g).castShadow = false;
  // 역 이름판 (지붕 앞)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.36, 0.06), new THREE.MeshLambertMaterial({ map: signTexture(`${name}역`, { w: 96, h: 22, size: 13, bg: '#ffffff', fg: '#1f5f2a' }) }));
  sign.position.set(0, 1.8, 1.0); g.add(sign);
  // 옆 기둥 표지 (초록 동그라미 2)
  const post = new THREE.Group(); post.position.set(1.15, 0, 0.95);
  box(0.08, 2.3, 0.08, '#8a9096', 0, 1.15, 0, post);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), new THREE.MeshLambertMaterial({ map: signTexture('2', { w: 24, h: 24, size: 16, bg: LINE2, fg: '#ffffff' }) }));
  disc.rotation.x = Math.PI / 2; disc.position.y = 2.35; post.add(disc);
  g.add(post);
  g.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
  return g;
}

export function buildSubway(world) {
  const m = world.map;
  world.stations = [];
  for (const st of STATIONS) {
    const [cx, cz] = geo(st.lon, st.lat);
    // 실제 위치 근처에서 입구(2×2)와 앞마당이 들어갈 빈 자리를 찾음 (입구는 남쪽(+z) 또는 북쪽(-z)을 볼 수 있음)
    let spot = null;
    const fits = (x, z, f) => {
      for (let dz = -1.0; dz <= 2.2; dz += 0.4) for (let dx = -1.0; dx <= 1.3; dx += 0.4) {
        const px = x + dx * f, pz = z + dz * f, t = m.tileAt(px, pz);
        if (t === T.WATER || t === T.BRIDGE || !world.canWalk(px, pz)) return false;
        const [tx, tz] = m.t(px, pz);
        if (m.zone[m.i(tx, tz)] === ZN.LANDMARK) return false;
      }
      return true;
    };
    for (let rad = 0; rad <= 12 && !spot; rad += 0.5) {
      const n = Math.max(1, Math.round(rad * 6));
      for (let i = 0; i < n && !spot; i++) {
        const a = (i / n) * Math.PI * 2, x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
        for (const f of [1, -1]) if (fits(x, z, f)) { spot = [x, z, f]; break; }
      }
    }
    if (!spot) { console.warn('역 자리를 못 찾음', st.name); continue; }
    const [x, z, f] = spot; // f: 1이면 입구가 남쪽, -1이면 북쪽
    const g = entranceModel(st.name); g.position.set(x, 0, z); if (f < 0) g.rotation.y = Math.PI;
    world.scene.add(g);
    const rect = (x0, x1, z0, z1) => world.addCollider({ type: 'r', x0: x + Math.min(x0 * f, x1 * f), x1: x + Math.max(x0 * f, x1 * f), z0: z + Math.min(z0 * f, z1 * f), z1: z + Math.max(z0 * f, z1 * f) });
    rect(-0.85, -0.65, -1.0, 0.9); rect(0.65, 0.85, -1.0, 0.9); rect(-0.85, 0.85, -1.0, -0.2);
    world.addCollider({ type: 'c', x: x + 1.15 * f, z: z + 0.95 * f, r: 0.12 });
    const info = { ...st, x, z, exit: [x, z + 1.9 * f] };
    world.stations.push(info);
    world.signSpots.push({ x, z, r: 3.5 });
    world.interactables.push({ x, z: z + 0.9 * f, r: 1.5, label: `${st.name}역 (2호선) 타기`, kind: 'subway', station: st.id });
  }
}
