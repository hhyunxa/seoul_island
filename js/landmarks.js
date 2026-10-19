// 서울 25개 구 랜드마크 (도트 섬과 같은 상자 그래픽)
import * as THREE from 'three';
import { basic, rbox, toonMat } from './toon.js';
import { Merger, vcMat, lmat } from './city.js';
import { LANDMARKS, GU } from './seoulMap.js';
import { box, mat, makeSign, makeChicken } from './world.js';
import { signTexture, stripeTexture, plankTexture, roofTexture, waterTexture } from './textures.js';

const RED = '#a8322d', DAN = '#3d8a6e', GIWA = '#4a4f58', STONE = '#c9c1b2', STONE2 = '#b3ab9b', WHITE = '#f1ece2';
let VC; // 공용 정점색 재질

// 전통 목조 건물 (기둥 + 창호 + 단청 띠 + 기와지붕)
function pavilion(M, w, d, h, x, z, y = 0, roofH = 0.8, walls = true) {
  const nx = Math.max(2, Math.round(w / 0.8)), nz = Math.max(2, Math.round(d / 0.8));
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) M.box(0.13, h, 0.13, RED, x - w / 2 + (w * i) / nx, y + h / 2, z + sz * d / 2);
  for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) M.box(0.13, h, 0.13, RED, x + sx * w / 2, y + h / 2, z - d / 2 + (d * i) / nz);
  if (walls) M.box(w - 0.12, h * 0.8, d - 0.12, '#d9c39a', x, y + h * 0.4, z);
  M.box(w + 0.14, 0.16, d + 0.14, DAN, x, y + h - 0.08, z);
  M.box(w + 0.02, 0.06, d + 0.02, '#c8473a', x, y + h - 0.19, z);
  M.hanokRoof(w + 0.8, d + 0.8, roofH, GIWA, x, y + h, z);
}

function hanokHouse(M, x, z, ry = 0, w = 2.2, d = 1.4) {
  const rot = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  M.box(w + 0.2, 0.25, d + 0.2, STONE2, x, 0.125, z, ry);
  M.box(w, 0.75, d, '#f1ead9', x, 0.62, z, ry);
  for (const s of [-1, 1]) { const [px, pz] = rot(s * w / 2, d / 2); M.box(0.12, 0.8, 0.12, '#7a4a26', px, 0.65, pz); }
  const [dx, dz] = rot(0, d / 2 + 0.01); M.box(0.7, 0.55, 0.04, '#c9a46a', dx, 0.55, dz, ry);
  M.box(w + 0.1, 0.08, d + 0.1, '#7a4a26', x, 1.02, z, ry);
  M.hanokRoof(w + 0.7, d + 0.7, 0.65, GIWA, x, 1.04, z, ry);
}

function stoneGate(M, w, d, h, x, z, gap = 1.1) {
  const side = (w - gap) / 2;
  for (const s of [-1, 1]) M.box(side, h, d, STONE, x + s * (gap / 2 + side / 2), h / 2, z);
  M.box(gap, 0.4, d, STONE, x, h - 0.2, z);
  M.box(gap * 0.9, 0.25, d + 0.02, '#4a3f35', x, h - 0.5, z); // 홍예(아치) 그림자
  for (let i = 0; i < Math.round(w / 0.5); i++) M.box(0.06, 0.02, d + 0.03, STONE2, x - w / 2 + 0.25 + i * 0.5, h * 0.33 + (i % 2) * 0.3, z);
}

export function buildLandmarks(world, map) {
  VC = vcMat();
  world.markers = [];
  const L = Object.fromEntries(LANDMARKS.map((l) => [l.id, l]));
  for (const l of LANDMARKS) {
    const fn = B[l.id];
    if (!fn) continue;
    const g = new THREE.Group(); g.position.set(l.x, 0, l.z);
    const M = new Merger();
    const ctx = {
      l, g, M, world, map,
      col(x0, x1, z0, z1) { world.addCollider({ type: 'r', x0: l.x + Math.min(x0, x1), x1: l.x + Math.max(x0, x1), z0: l.z + Math.min(z0, z1), z1: l.z + Math.max(z0, z1) }); },
      colC(x, z, r) { world.addCollider({ type: 'c', x: l.x + x, z: l.z + z, r }); },
      sign(title, name, lines, dx, dz, ry = 0) {
        const sg = makeSign(title); sg.position.set(dx, 0, dz); sg.rotation.y = ry; g.add(sg);
        world.addCollider({ type: 'c', x: l.x + dx, z: l.z + dz, r: 0.35 });
        world.signSpots.push({ x: l.x + dx, z: l.z + dz });
        world.interactables.push({ x: l.x + dx + Math.sin(ry) * 0.6, z: l.z + dz + Math.cos(ry) * 0.6, r: 1.4, label: `${name} 안내판`, kind: 'dialog', name, lines });
      },
      marker(x, y, z) { world.addMarker(l.x + x, y, l.z + z); },
      mini(game, label, x, z, rx, rz, r = 1.8) { world.interactables.push({ x: l.x + x, z: l.z + z, r, label, kind: 'minigame', game, ret: [l.x + rx, l.z + rz] }); },
      tree(x, z, kind = 'round', s = 1) { world.treeList.push({ x: l.x + x, z: l.z + z, kind, s, ry: (x * 7 + z) % 3 }); world.addCollider({ type: 'c', x: l.x + x, z: l.z + z, r: 0.4 * s }); },
      add(o) { g.add(o); return o; },
    };
    fn(ctx, L);
    if (!M.empty) g.add(M.build(VC));
    world.scene.add(g);
  }
  // 지도 표시용
  world.landmarkPins = world.interactables.filter((i) => i.kind === 'dialog' && i.label.endsWith('안내판')).map((i) => ({ x: i.x, z: i.z, name: i.name.replace(/ \(.+\)$/, '') }));
  world.guLabels = GU.map((g) => ({ name: g.name, x: g.c[0], z: g.c[1] }));
}

// 각 랜드마크 (좌표는 랜드마크 중심 기준)
const B = {
  // ── 종로구: 북악스카이웨이 팔각정 (야경 전망대) ── 남쪽(+z)이 서울 시내 쪽
  bugak({ M, col, colC, sign, marker, world, l }) {
    // 팔각정: 돌 기단 + 붉은 기둥 8개 + 2층 팔각 지붕
    const px = -0.7, pz = -0.4;
    M.cyl(1.35, 1.45, 0.35, STONE, px, 0.175, pz, 8);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; M.box(0.13, 1.1, 0.13, RED, px + Math.cos(a) * 1.1, 0.9, pz + Math.sin(a) * 1.1); }
    M.cyl(1.22, 1.22, 0.14, DAN, px, 1.5, pz, 8);
    M.cyl(0.75, 1.75, 0.45, GIWA, px, 1.8, pz, 8);            // 1층 지붕
    M.cyl(0.62, 0.62, 0.5, '#d9c39a', px, 2.25, pz, 8);       // 2층
    M.cyl(0.66, 0.66, 0.1, DAN, px, 2.5, pz, 8);
    M.cyl(0.08, 1.15, 0.6, GIWA, px, 2.85, pz, 8);            // 2층 지붕
    M.box(0.1, 0.25, 0.1, '#c9a24a', px, 3.25, pz);
    colC(px, pz, 1.35);
    // 전망 난간 (가운데는 스카이웨이로 나가는 입구)
    for (const [x0, x1] of [[-2.3, -0.6], [0.6, 2.3]]) {
      M.box(x1 - x0, 0.08, 0.08, '#7a4a26', (x0 + x1) / 2, 0.6, 1.5);
      for (let x = x0; x <= x1 + 0.01; x += 0.425) M.box(0.08, 0.6, 0.08, '#7a4a26', x, 0.3, 1.5);
      col(x0, x1, 1.42, 1.58);
    }
    // 한양도성 성곽 조각 (뒤쪽)
    for (let i = 0; i < 6; i++) M.box(0.9, 0.7 + (i % 2) * 0.12, 0.4, STONE2, -2.2 + i * 0.9, 0.38, -1.4);
    col(-2.4, 2.4, -1.6, -1.2);
    // 벤치
    M.box(0.9, 0.08, 0.32, '#a0703a', 1.6, 0.38, -0.6); for (const x of [1.25, 1.95]) M.box(0.08, 0.34, 0.28, '#6b4a2a', x, 0.17, -0.6);
    col(1.15, 2.05, -0.78, -0.42);
    // 망원경 (서울 시내 쪽을 보는 동전 쌍안경) → E: 서울 하늘 둘러보기 (main.js tour)
    const tx = 1.4, tz = 0.85;
    M.box(0.12, 0.85, 0.12, '#5b6470', tx, 0.43, tz); M.box(0.5, 0.28, 0.32, '#2f6fd8', tx, 0.98, tz); M.box(0.3, 0.06, 0.2, '#5b6470', tx, 0.82, tz);
    for (const s of [-0.12, 0.12]) M.box(0.11, 0.11, 0.18, '#1a1a1a', tx + s, 1.0, tz + 0.24);
    colC(tx, tz, 0.25);
    marker(tx, 2.0, tz);
    world.interactables.push({ x: l.x + tx, z: l.z + tz - 0.5, r: 1.3, label: '망원경으로 서울 내려다보기', kind: 'tour' });
    sign('북악스카이웨이', '북악스카이웨이 팔각정 (종로구)', ['북악산 고갯길을 따라 달리는 북악스카이웨이, 그 꼭대기의 팔각정이에요.', '망원경으로 서울을 내려다볼 수 있어요.\n해가 진 뒤에 오면 반짝이는 야경이 정말 멋져요!'], -2.0, 1.0);
  },
  // ── 송파구: 잠실야구장 (홈런 더비) ── 문은 북쪽(-z)
  ballpark({ M, col, sign, marker, mini }) {
    M.box(3.4, 0.04, 3.4, '#5fae4a', 0, 0.02, 0.1);                         // 잔디
    M.box(1.6, 0.05, 1.6, '#c98a46', 0, 0.03, 0.9, Math.PI / 4);              // 내야 흙
    for (const [x, z, w, d] of [[0, 1.75, 3.6, 0.5], [-1.75, 0.3, 0.5, 2.9], [1.75, 0.3, 0.5, 2.9]]) M.box(w, 0.9, d, '#2f6fd8', x, 0.45, z); // 관중석
    for (const x of [-1.6, 1.6]) { M.box(0.12, 3.2, 0.12, '#d8d4cc', x, 1.6, -1.5); M.box(0.6, 0.3, 0.12, '#fff3b0', x, 3.25, -1.5); } // 조명탑
    col(-2.0, 2.0, 1.5, 2.0); col(-2.0, -1.5, -1.2, 1.8); col(1.5, 2.0, -1.2, 1.8);
    marker(0, 2.2, -1.1);
    mini('homerun', '잠실야구장 홈런 더비', 0, -1.1, 0, -2.6, 1.4);
    sign('잠실야구장', '잠실야구장 (송파구)', ['프로야구 팀들의 홈구장, 잠실야구장이에요.\n오늘은 홈런 더비가 열려요!'], 1.2, -1.6, Math.PI);
  },
  // ── 강서구: 마곡 서울식물원 (물 주기) ── 문은 동쪽(+x)
  botanic({ M, col, sign, marker, mini, add }) {
    M.cyl(1.6, 2.0, 1.6, '#bfe6fa', -0.8, 0.8, 0, 12);                       // 유리 온실
    M.cyl(0.6, 1.6, 0.8, '#d8f0fb', -0.8, 2.0, 0, 12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; M.box(0.06, 1.6, 0.06, '#ffffff', -0.8 + Math.cos(a) * 1.85, 0.8, Math.sin(a) * 1.85); }
    col(-2.8, 1.2, -2.0, 2.0);
    for (const [x, z, c] of [[1.8, -1.5, '#ff7aa8'], [1.8, 1.5, '#ffd23f'], [2.6, -1.5, '#b07cff'], [2.6, 1.5, '#ff8a5c']]) { M.box(0.7, 0.2, 0.5, '#8a5428', x, 0.1, z); M.box(0.6, 0.12, 0.4, c, x, 0.26, z); }
    marker(2.2, 2.0, 0);
    mini('garden', '서울식물원 물 주기', 2.2, 0, 3.6, 0, 1.4);
    sign('서울식물원', '서울식물원 (강서구)', ['마곡에 있는 커다란 식물원이에요.\n세계 여러 기후의 식물이 온실 안에 살아요.'], 2.9, -0.9, -Math.PI / 2);
    void add;
  },
  // ── 종로구: 경복궁 ──
  gyeongbok({ M, col, sign, tree, l }) {
    const hw = l.hw - 0.2, hd = l.hd - 0.2;
    const wall = (x0, z0, x1, z1) => {
      const w = Math.abs(x1 - x0) || 0.3, d = Math.abs(z1 - z0) || 0.3;
      M.box(w, 1.0, d, '#d8c7a4', (x0 + x1) / 2, 0.5, (z0 + z1) / 2);
      M.box(w + 0.25, 0.14, d + 0.25, GIWA, (x0 + x1) / 2, 1.05, (z0 + z1) / 2);
      col(x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15);
    };
    wall(-hw, -hd, hw, -hd); wall(-hw, -hd, -hw, hd); wall(hw, -hd, hw, hd);
    wall(-hw, hd, -1.7, hd); wall(1.7, hd, hw, hd);
    // 광화문
    M.box(3.6, 0.35, 1.3, STONE, 0, 2.05, hd);
    stoneGate(M, 3.4, 1.2, 1.9, 0, hd, 1.2);
    col(-1.8, -0.6, hd - 0.6, hd + 0.6); col(0.6, 1.8, hd - 0.6, hd + 0.6);
    pavilion(M, 2.8, 1.0, 0.85, 0, hd, 2.2, 0.75);
    // 근정전 (2단 월대 위)
    M.box(6, 0.25, 4.4, STONE, 0, 0.125, -1.5); M.box(4.9, 0.25, 3.6, STONE2, 0, 0.375, -1.5);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) M.box(0.08, 0.2, 0.08, '#e9e3d6', s * 2.95, 0.35, -3.6 + i * 1.05);
    pavilion(M, 3.8, 2.2, 1.3, 0, -1.5, 0.5, 0.35);
    M.box(4.5, 0.12, 2.9, GIWA, 0, 2.0, -1.5);
    M.box(3.2, 0.5, 1.7, RED, 0, 2.3, -1.5); M.box(3.3, 0.12, 1.8, DAN, 0, 2.5, -1.5);
    M.hanokRoof(4.4, 2.8, 0.95, GIWA, 0, 2.55, -1.5);
    col(-2.3, 2.3, -2.9, -0.1);
    // 박석 길 (월대까지)
    M.box(1.2, 0.03, 4.2, '#d9d2c3', 0, 0.015, 3.6);
    // 경회루 (연못 위 누각)
    const px = -3.8, pz = -4.6;
    M.box(3.6, 0.12, 2.9, STONE2, px, 0.06, pz);
    M.box(3.3, 0.06, 2.6, '#4fa8e0', px, 0.1, pz);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) M.box(0.14, 0.75, 0.14, '#e4ddcf', px - 0.9 + i * 0.6, 0.45, pz - 0.5 + j * 0.5);
    M.box(2.2, 0.12, 1.4, STONE, px, 0.86, pz);
    pavilion(M, 1.9, 1.1, 0.7, px, pz, 0.92, 0.6, false);
    M.box(0.5, 0.06, 1.3, STONE, px + 1.6, 0.5, pz, 0, 0, -0.5);
    col(px - 1.8, px + 1.8, pz - 1.45, pz + 1.45);
    for (const [x, z] of [[4.6, -5.6], [5, 3.6], [-5, 3], [4.2, 1.5], [-4.8, 0.4], [3, -6.2]]) tree(x, z, 'pine', 0.9);
    sign('경복궁', '경복궁 (종로구)', ['조선의 법궁, 경복궁이에요.\n1395년 태조 때 처음 지어졌어요.', '정문인 광화문을 지나면 왕이 나랏일을 보던\n근정전이 나와요.', '왼쪽 연못 위 누각은 경회루!\n나라의 큰 잔치를 열던 곳이에요.'], 2.4, hd + 1.4);
  },
  // ── 광화문광장 (세종대왕·이순신 동상) ──
  gwanghwamun({ M, col, sign }) {
    M.box(0.9, 0.5, 1.2, STONE, 0, 0.25, -1.2);
    M.box(0.75, 0.55, 0.55, '#c9a23a', 0, 0.78, -1.25); M.box(0.55, 0.65, 0.4, '#d9b44a', 0, 1.35, -1.25); M.box(0.32, 0.32, 0.32, '#c9a23a', 0, 1.85, -1.2);
    M.box(0.12, 0.25, 0.25, '#b08a2a', 0.25, 1.2, -1.0);
    col(-0.5, 0.5, -1.85, -0.6);
    M.box(0.6, 1.4, 0.6, STONE, 0, 0.7, 2.0);
    M.box(0.42, 0.7, 0.3, '#4f5d4c', 0, 1.75, 2.0); M.box(0.26, 0.26, 0.26, '#4f5d4c', 0, 2.25, 2.0);
    M.box(0.06, 0.8, 0.06, '#8e9a8c', 0.24, 1.75, 2.15, 0, 0.2);
    col(-0.35, 0.35, 1.65, 2.35);
    for (let i = 0; i < 6; i++) M.box(0.12, 0.02, 0.5, '#7cc6f2', -1.6, 0.02, -2.8 + i * 1.1); // 바닥분수
    sign('광화문광장', '광화문광장', ['세종대왕 동상과 이순신 장군 동상이 있는\n서울의 한가운데 광장이에요.', '북쪽으로 가면 경복궁, 남쪽으로 가면 숭례문,\n동쪽엔 청계천이 흘러요.', '서울은 동서로 걸어서 약 1분!\nShift를 누르면 더 빨리 달릴 수 있어요.'], 1.7, 0.4);
  },
  heunginjimun({ M, col, sign }) {
    M.box(3.4, 0.6, 2.4, STONE, 0, 0.3, -0.3); // 옹성 느낌의 둥근 석축
    stoneGate(M, 2.6, 1.0, 1.4, 0, 0.4, 0.9);
    pavilion(M, 2.0, 0.8, 0.6, 0, 0.4, 1.4, 0.4);
    M.box(2.2, 0.35, 1.0, RED, 0, 2.2, 0.4); M.hanokRoof(2.6, 1.5, 0.6, GIWA, 0, 2.35, 0.4);
    col(-1.7, 1.7, -1.4, 0.95);
    sign('흥인지문', '흥인지문 (동대문)', ['한양도성의 동쪽 대문, 흥인지문이에요.\n흔히 동대문이라고 불러요.'], 1.6, 1.4);
  },
  ddp({ M, col, sign }) {
    const g = new THREE.SphereGeometry(1, 10, 5).toNonIndexed();
    M.geom(g, '#c5cad1', 0, 0.7, 0, 0.2, 3.0, 1.1, 2.0);
    M.geom(g, '#d7dbe0', 0.6, 0.9, -0.2, 0.2, 2.0, 0.9, 1.4);
    for (let i = 0; i < 7; i++) M.box(0.04, 0.9, 1.8, '#aab0b8', -2.2 + i * 0.7, 0.8, 0, 0.2);
    M.box(0.9, 0.9, 0.08, '#2c3440', -0.6, 0.45, 1.75, 0.2);
    col(-2.6, 2.6, -1.6, 1.6);
    sign('DDP', '동대문디자인플라자 (중구)', ['은빛 곡선의 동대문디자인플라자(DDP)예요.\n밤새 불 켜진 동대문 패션타운이 바로 옆!'], -2.6, -2.1);
  },
  sungnyemun({ M, col, sign }) {
    stoneGate(M, 3.0, 1.2, 1.5, 0, 0, 1.0);
    pavilion(M, 2.4, 0.9, 0.7, 0, 0, 1.5, 0.35);
    M.box(2.8, 0.1, 1.4, GIWA, 0, 2.25, 0); M.box(2.0, 0.42, 0.7, RED, 0, 2.45, 0); M.box(2.1, 0.1, 0.8, DAN, 0, 2.62, 0);
    M.hanokRoof(2.7, 1.5, 0.75, GIWA, 0, 2.66, 0);
    col(-1.5, -0.5, -0.6, 0.6); col(0.5, 1.5, -0.6, 0.6);
    sign('숭례문', '숭례문 (중구)', ['국보 제1호였던 숭례문, 한양도성의 남대문이에요.\n바로 옆엔 남대문시장이 있어요.'], 1.9, 1.3);
  },
  // ── 중구: 남산서울타워 ──
  namsan({ M, col, sign, tree, l, marker, mini }) {
    M.box(2.6, 0.9, 2.2, '#e8e2d6', 0, 0.45, 0); M.box(2.8, 0.12, 2.4, '#b9b3a6', 0, 0.96, 0);
    M.cyl(0.36, 0.5, 9.2, '#f4f4f2', 0, 5.5, 0, 8);
    M.cyl(0.38, 0.38, 0.25, '#e8413a', 0, 3.2, 0, 8);
    M.cyl(1.05, 0.85, 0.75, '#e9e6df', 0, 10.4, 0, 10); M.cyl(1.08, 1.08, 0.18, '#6fa8d6', 0, 10.5, 0, 10);
    M.cyl(0.8, 1.0, 0.55, '#dcd8cf', 0, 11.05, 0, 10);
    M.cyl(0.55, 0.7, 0.4, '#f0ede6', 0, 11.5, 0, 8);
    for (let i = 0; i < 6; i++) M.cyl(0.1, 0.12, 0.7, i % 2 ? '#ffffff' : '#e8413a', 0, 12.05 + i * 0.7, 0, 6);
    col(-1.4, 1.4, -1.2, 1.2);
    // 사랑의 자물쇠 울타리
    for (let i = 0; i < 9; i++) { M.box(0.5, 0.5, 0.06, '#8a8f96', -2 + i * 0.5, 0.35, 2.0); M.box(0.08, 0.08, 0.03, ['#e8413a', '#ffd23f', '#9b5de5', '#3fb8e8'][i % 4], -2 + i * 0.5, 0.4, 2.04); }
    col(-2.3, 2.3, 1.9, 2.1);
    const r = (a) => Math.sin(a * 12.9898) * 0.5 + 0.5;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, d = 3.4 + r(i) * (l.hw - 4);
      const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
      if (Math.abs(x + l.hw) < 2.2 && Math.abs(z) < 1.4) continue;
      if (Math.abs(x + 1.2) < 2.2 && z > 2 && z < 4.6) continue; // 자물쇠 찾기 입구 자리
      tree(x, z, i % 3 ? 'round' : (i % 2 ? 'pine' : 'maple'));
    }
    // 미니게임: 사랑의 자물쇠 찾기
    marker(-1.2, 2.3, 2.6);
    mini('locks', '사랑의 자물쇠 찾기', -1.2, 2.7, -1.2, 3.3, 1.7);
    sign('N서울타워', '남산서울타워 (중구)', ['남산 꼭대기의 N서울타워예요.\n(이 섬엔 산이 없어서 평지에 세웠어요!)', '전망대에 오르면 서울이 한눈에 보인대요.\n울타리엔 사랑의 자물쇠가 주렁주렁.'], -2.8, 1.6);
  },
  museum({ M, col, sign }) {
    M.box(2.6, 1.5, 2.2, '#dcd3c3', -2.4, 0.75, 0); M.box(2.6, 1.5, 2.2, '#dcd3c3', 2.4, 0.75, 0);
    M.box(7.6, 0.25, 2.4, '#cfc6b5', 0, 1.62, 0); // 열린 마당 위 지붕
    for (let i = 0; i < 6; i++) M.box(0.04, 1.2, 0.04, '#b8ae9c', -3.6 + i * 0.4 + (i > 2 ? 5.2 : 0) - (i > 2 ? 1.2 : 0), 0.7, 1.11);
    M.box(1.2, 0.8, 0.5, '#efe9dd', 0, 0.4, -0.8); // 계단
    M.box(5.4, 0.05, 0.9, '#4fa8e0', 0, 0.03, 1.8); // 거울못
    col(-3.75, -1.05, -1.15, 1.15); col(1.05, 3.75, -1.15, 1.15); col(-0.7, 0.7, -1.1, -0.5); col(-2.7, 2.7, 1.35, 2.25);
    sign('국립중앙박물관', '국립중앙박물관 (용산구)', ['우리나라 최대의 박물관, 국립중앙박물관이에요.\n용산가족공원 바로 옆이에요.'], 0.9, -2.0);
  },
  seoulforest({ sign, tree, l, M, add, world }) {
    for (let i = 0; i < 30; i++) {
      const x = -l.hw + 1 + ((i * 37) % 9), z = -l.hd + 0.8 + ((i * 53) % 6);
      if (Math.abs(x + 4) < 1.6 && Math.abs(z) < 1.3) continue;
      if (Math.hypot(x - 1.5, z) < 1.8) continue;
      tree(x + ((i * 7) % 3) * 0.3, z + ((i * 3) % 5) * 0.2, i % 4 === 0 ? 'ginkgo' : i % 5 === 0 ? 'maple' : 'round', 0.9);
    }
    // 사슴 두 마리
    for (const [x, z, ry] of [[1.2, 0.4, 0.8], [2.0, -0.4, -2]]) {
      const d = new THREE.Group(); d.position.set(x, 0, z); d.rotation.y = ry;
      box(0.3, 0.3, 0.7, '#b47a45', 0, 0.62, 0, d); box(0.2, 0.32, 0.22, '#b47a45', 0, 0.9, 0.36, d); box(0.12, 0.08, 0.12, '#3a2a1c', 0, 0.92, 0.5, d);
      for (const lx of [-0.1, 0.1]) for (const lz of [-0.25, 0.25]) box(0.06, 0.48, 0.06, '#8a5a32', lx, 0.24, lz, d);
      for (const lx of [-0.07, 0.07]) box(0.04, 0.22, 0.04, '#e9dcc3', lx, 1.15, 0.33, d);
      box(0.08, 0.06, 0.06, '#fff3e0', 0, 0.62, -0.38, d);
      add(d); world.addCollider({ type: 'c', x: l.x + x, z: l.z + z, r: 0.4 });
    }
    M.box(1.6, 0.04, 1.2, '#4fa8e0', 3.2, 0.02, 1.8);
    sign('서울숲', '서울숲 (성동구)', ['뚝섬 경마장이 있던 자리에 만든 큰 숲, 서울숲이에요.\n사슴들이 살고 있어요!'], -l.hw + 0.5, 1.2);
  },
  childrenpark({ M, col, sign, tree, l, add, marker, mini }) {
    M.cyl(1.0, 1.1, 0.35, STONE, 0, 0.17, 0, 12); M.cyl(0.9, 0.9, 0.06, '#7cc6f2', 0, 0.37, 0, 12);
    M.cyl(0.12, 0.16, 1.0, '#e9e3d6', 0, 0.8, 0, 6);
    col(-1.1, 1.1, -1.1, 1.1);
    // 기린 조형물
    const gx = -2.2, gz = -1.4;
    M.box(0.5, 0.4, 0.9, '#f2b84a', gx, 1.0, gz); for (const lx of [-0.15, 0.15]) for (const lz of [-0.3, 0.3]) M.box(0.1, 0.8, 0.1, '#e09a2e', gx + lx, 0.4, gz + lz);
    M.box(0.18, 1.1, 0.18, '#f2b84a', gx, 1.7, gz + 0.38, 0, 0.3); M.box(0.25, 0.22, 0.4, '#f2b84a', gx, 2.3, gz + 0.62);
    for (let i = 0; i < 5; i++) M.box(0.12, 0.12, 0.02, '#a8642a', gx + 0.26, 0.9 + (i % 3) * 0.12, gz - 0.3 + i * 0.14);
    col(gx - 0.35, gx + 0.35, gz - 0.55, gz + 0.8);
    // 놀이터 회전목마
    M.cyl(0.9, 0.9, 0.15, '#e8413a', 2.1, 0.08, -1.2, 10); M.cyl(0.08, 0.08, 1.4, '#ffd23f', 2.1, 0.8, -1.2, 6); M.geom(new THREE.ConeGeometry(1.0, 0.6, 10).toNonIndexed(), '#3fb8e8', 2.1, 1.75, -1.2);
    col(1.2, 3.0, -2.1, -0.3);
    for (const [x, z] of [[-3, 2.5], [3, 2.6], [-3.2, -3], [3.2, -3], [0, -3]]) tree(x, z, 'round');
    // 미니게임: 동물 먹이 주기 (분수대 남서쪽 먹이 판매대)
    const st = new THREE.Group(); st.position.set(-1.6, 0, 2.0);
    box(1.4, 0.7, 0.6, '#c98a46', 0, 0.35, 0, st); box(1.6, 0.08, 0.8, '#e8413a', 0, 1.55, 0, st);
    for (const x of [-0.7, 0.7]) box(0.08, 0.85, 0.08, '#f4ead8', x, 1.1, 0.3, st);
    for (const [x, c] of [[-0.45, '#ffd23f'], [-0.15, '#7fb0d8'], [0.15, '#5fae3e'], [0.45, '#c0503a']]) box(0.22, 0.14, 0.22, c, x, 0.77, 0, st);
    const fsg = new THREE.Mesh(rbox(1.4, 0.32, 0.06), toonMat({ map: signTexture('동물 먹이 주기', { w: 96, h: 22, size: 12, bg: '#ffd23f' }) }));
    fsg.position.set(0, 1.32, 0.34); st.add(fsg);
    add(st); col(-2.3, -0.9, 1.7, 2.3);
    marker(-1.6, 2.5, 2.0);
    mini('feed', '동물 먹이 주기', -1.6, 2.9, -1.6, 3.4, 1.6);
    sign('어린이대공원', '어린이대공원 (광진구)', ['동물원과 놀이동산이 있는 어린이대공원이에요.\n분수대 앞이 약속 장소!'], 1.4, 2.8);
  },
  // ── 중구: 명동 거리 (길 안내 도우미) ──
  myeongdong({ M, col, sign, marker, mini, add }) {
    // 양쪽 작은 가게들 + 가운데 길거리 음식 수레
    const shops = [['#f4a6c0', '화장품'], ['#7fc8f0', '환전'], ['#ffd23f', '기념품'], ['#a5e07f', '카페']];
    shops.forEach(([c, name], i) => {
      const x = -1.95 + i * 1.3;
      M.box(1.2, 1.6, 0.9, c, x, 0.8, -1.05); M.box(1.24, 0.14, 1.0, '#ffffff', x, 1.66, -1.0);
      M.box(0.9, 0.6, 0.04, '#bfe6fa', x, 0.65, -0.58);
      const sg = new THREE.Mesh(rbox(1.0, 0.26, 0.05), toonMat({ map: signTexture(name, { w: 48, h: 14, size: 10, bg: '#ffffff' }) }));
      sg.position.set(x, 1.35, -0.57); add(sg);
    });
    col(-2.6, 2.6, -1.55, -0.55);
    // 길거리 음식 수레 2개
    for (const [x, c] of [[-1.2, '#e8413a'], [1.4, '#2f7fd8']]) {
      M.box(0.8, 0.5, 0.5, '#c98a46', x, 0.45, 0.6); M.box(0.9, 0.06, 0.6, c, x, 1.15, 0.6);
      for (const dx of [-0.38, 0.38]) M.box(0.05, 0.5, 0.05, '#ddd', x + dx, 0.9, 0.6);
      M.box(0.12, 0.2, 0.12, '#1a1a1a', x - 0.3, 0.12, 0.6); M.box(0.12, 0.2, 0.12, '#1a1a1a', x + 0.3, 0.12, 0.6);
      col(x - 0.45, x + 0.45, 0.35, 0.85);
    }
    // 관광안내소 부스 (미니게임 입구)
    M.box(0.9, 1.1, 0.7, '#e8413a', 0.1, 0.55, 0.65); M.box(1.0, 0.1, 0.8, '#ffffff', 0.1, 1.15, 0.65);
    const ib = new THREE.Mesh(rbox(0.5, 0.5, 0.06), toonMat({ map: signTexture('i', { w: 16, h: 16, size: 14, bg: '#e8413a', fg: '#ffffff' }) }));
    ib.position.set(0.1, 1.5, 1.0); add(ib);
    col(-0.35, 0.55, 0.3, 1.0);
    marker(0.1, 2.3, 1.3);
    mini('guide', '명동 길 안내 도우미', 0.1, 1.5, 0.1, 2.0, 1.4);
    sign('명동', '명동 (중구)', ['쇼핑과 길거리 음식으로 유명한 명동이에요.\n세계 곳곳에서 온 여행자들로 늘 북적여요.', '길을 묻는 여행자를 도와줄 수 있을까요?'], 2.3, 1.2);
  },
  // ── 용산구: 이태원 지구촌 축제 (퍼레이드) ──
  itaewon({ M, col, sign, marker, mini, add }) {
    // 축제 아치 + 만국기 줄
    for (const x of [-2.2, 2.2]) { M.box(0.25, 2.6, 0.25, '#f4ead8', x, 1.3, -0.4); col(x - 0.15, x + 0.15, -0.55, -0.25); }
    const banner = new THREE.Mesh(rbox(4.6, 0.5, 0.08), toonMat({ map: signTexture('이태원 지구촌 축제', { w: 128, h: 16, size: 11, bg: '#2f7fd8', fg: '#ffffff' }) }));
    banner.position.set(0, 2.45, -0.4); add(banner);
    const flagC = ['#e8413a', '#ffd23f', '#2f7fd8', '#5fc04a', '#ffffff', '#9b5de5', '#f28c28'];
    for (let i = 0; i < 18; i++) { const x = -2.1 + i * 0.25; M.box(0.18, 0.2, 0.02, flagC[i % flagC.length], x, 2.02 - Math.sin((i / 17) * Math.PI) * 0.25, -0.4); }
    // 작은 무대
    M.box(3.2, 0.3, 1.2, '#8a5428', 0, 0.15, -1.1); M.box(3.2, 0.06, 1.2, '#c98a46', 0, 0.32, -1.1);
    col(-1.6, 1.6, -1.7, -0.5);
    for (const [x, c] of [[-1.0, '#e8413a'], [0, '#ffd23f'], [1.0, '#5fc04a']]) { M.box(0.08, 0.9, 0.08, '#ddd', x, 0.8, -1.5); M.box(0.4, 0.26, 0.02, c, x + 0.22, 1.1, -1.5); }
    marker(0, 2.4, 0.6);
    mini('parade', '지구촌 축제 퍼레이드', 0, 0.8, 0, 1.5, 1.6);
    sign('이태원', '이태원 (용산구)', ['세계 여러 나라 음식점과 사람들이 모이는 이태원이에요.\n해마다 지구촌 축제가 열려요!'], 2.4, 0.9);
  },
  // ── 마포구: 홍대 코인노래방 (리듬게임) ──
  karaoke({ M, col, sign, marker, mini, add }) {
    M.box(3.2, 2.6, 2.4, '#3a2f4a', 0, 1.3, -0.2);
    for (let y = 0.9; y < 2.5; y += 0.6) for (const x of [-1.1, 1.1]) M.box(0.5, 0.35, 0.04, '#ff6ec7', x, y, 1.01);
    M.box(0.9, 1.1, 0.06, '#1a1420', 0, 0.55, 1.01);
    M.box(3.4, 0.12, 2.6, '#2a2236', 0, 2.66, -0.2);
    col(-1.6, 1.6, -1.4, 1.0);
    // 네온 간판 (조명 영향을 안 받아서 밤에 더 눈에 띔)
    const neon = new THREE.Mesh(rbox(2.6, 0.55, 0.08), basic({ map: signTexture('코인노래방', { w: 112, h: 24, size: 15, bg: '#2a1036', fg: '#ff7ad9' }) }));
    neon.position.set(0, 2.2, 1.06); add(neon);
    marker(0, 2.9, 1.5);
    mini('karaoke', '코인노래방 리듬게임', 0, 1.5, 0, 2.2, 1.6);
    sign('코인노래방', '홍대 코인노래방 (마포구)', ['홍대 앞 골목엔 코인노래방이 가득해요.\n오늘은 리듬게임으로 불러 봐요!'], 2.0, 1.4);
  },
  // ── 마포구: 홍대 인형뽑기 가게 (코인노래방 옆) ──
  clawshop({ M, col, marker, mini, add }) {
    M.box(2.2, 2.0, 1.8, '#ff9ec4', 0, 1.0, -0.3);
    M.box(2.3, 0.14, 1.9, '#ff6ec7', 0, 2.07, -0.3);
    M.box(1.7, 1.2, 0.04, '#bfe6fa', 0, 0.85, 0.61);                       // 유리창
    // 창문 너머로 보이는 인형뽑기 기계 두 대
    for (const x of [-0.45, 0.45]) {
      M.box(0.6, 0.35, 0.4, '#ff6ec7', x, 0.4, 0.2); M.box(0.6, 0.1, 0.4, '#ffe14f', x, 1.3, 0.2);
      for (const [dx, c] of [[-0.12, '#a0703a'], [0.1, '#ffd23f']]) M.box(0.16, 0.18, 0.16, c, x + dx, 0.66, 0.2);
    }
    col(-1.1, 1.1, -1.2, 0.62);
    const neon = new THREE.Mesh(rbox(1.8, 0.4, 0.06), basic({ map: signTexture('인형뽑기', { w: 80, h: 18, size: 12, bg: '#2a1036', fg: '#ffe14f' }) }));
    neon.position.set(0, 1.7, 0.63); add(neon);
    marker(0, 2.6, 1.0);
    mini('claw', '홍대 인형뽑기', 0, 1.1, 0, 1.7, 1.4);
  },
  // ── 노원구: 도봉운전면허시험장 (카트 레이싱) ──
  license({ M, col, sign, marker, mini, add, l }) {
    // 기능시험 코스 느낌의 작은 트랙 (아스팔트 + 흰 선 + 라바콘)
    M.box(l.hw * 2 - 0.4, 0.03, l.hd * 2 - 0.6, '#5d6066', 0, 0.02, -0.3);
    M.box(l.hw * 2 - 2.4, 0.04, l.hd * 2 - 2.6, '#6cbb48', 0, 0.03, -0.3);
    for (let i = 0; i < 8; i++) M.box(0.5, 0.045, 0.08, '#ffffff', -3.4 + i * 1.0, 0.03, l.hd - 0.85);
    for (const [x, z] of [[-3.8, -2.8], [-1.8, -2.8], [0.2, -2.8], [2.2, -2.8], [3.9, -1.2], [3.9, 0.8], [-3.9, 0.2]]) { M.cyl(0.02, 0.14, 0.32, '#f28c28', x, 0.16, z, 6); M.box(0.22, 0.03, 0.22, '#f28c28', x, 0.02, z); }
    // 시험장 건물 + 신호등
    M.box(2.2, 1.4, 1.2, '#e8e4dc', 0, 0.7, -0.6); M.box(2.4, 0.12, 1.4, '#2f7fd8', 0, 1.46, -0.6);
    col(-1.1, 1.1, -1.2, 0);
    M.box(0.1, 1.6, 0.1, '#3a3f46', -1.6, 0.8, 1.4); M.box(0.5, 0.18, 0.16, '#222222', -1.6, 1.62, 1.4);
    for (const [i, c] of [[-1, '#e8413a'], [0, '#ffd23f'], [1, '#5fc04a']]) M.box(0.12, 0.12, 0.04, c, -1.6 + i * 0.15, 1.62, 1.49);
    // 카트 한 대 전시
    const kart = new THREE.Group(); kart.position.set(1.6, 0, 1.5); kart.rotation.y = -0.6;
    box(0.6, 0.2, 0.9, '#e8413a', 0, 0.18, 0, kart); box(0.3, 0.3, 0.3, '#222', 0, 0.38, -0.1, kart);
    for (const [x, z] of [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.32], [0.32, 0.32]]) box(0.12, 0.2, 0.2, '#1a1a1a', x, 0.1, z, kart);
    add(kart);
    const bsg = new THREE.Mesh(rbox(2.2, 0.32, 0.06), toonMat({ map: signTexture('운전면허시험장', { w: 112, h: 18, size: 12, bg: '#ffffff', fg: '#1f4f9a' }) }));
    bsg.position.set(0, 1.25, 0.02); add(bsg);
    marker(0, 2.4, 2.4);
    mini('kart', '카트 레이싱', 0, 2.4, 0, 3.4, 1.7);
    sign('운전면허시험장', '도봉운전면허시험장 (노원구)', ['노원구 상계동에 있는 도봉운전면허시험장이에요.\n기능시험 코스에서 오늘은 카트를 타 봐요!'], -2.6, 3.0);
  },
  // ── 동대문구: 경동시장 (과일 받기) ──
  gyeongdong({ M, col, sign, marker, mini, add }) {
    const plank = toonMat({ map: plankTexture() }); plank.map.repeat.set(3, 2);
    const cols = [['#e8413a', '#fff4e0'], ['#2f7fd8', '#ffffff'], ['#2fa84f', '#fff4e0']];
    cols.forEach(([a, b], i) => {
      const st = new THREE.Group(); st.position.set(-2.2 + i * 2.2, 0, -0.6);
      box(1.9, 0.8, 0.9, plank, 0, 0.4, 0, st);
      for (const px of [-0.9, 0.9]) for (const pz of [-0.4, 0.4]) box(0.1, 1.9, 0.1, '#6b3b1c', px, 0.95, pz, st);
      const awn = stripeTexture(a, b); awn.repeat.set(2, 1);
      box(2.1, 0.12, 1.3, toonMat({ map: awn }), 0, 1.95, 0.1, st).rotation.x = 0.18;
      const fruit = [['#e8413a', '#ff9a2e'], ['#9b5de5', '#f2c21b'], ['#7a4a26', '#5fae3e']][i];
      for (let j = 0; j < 6; j++) box(0.2, 0.2, 0.2, fruit[j % 2], -0.6 + (j % 3) * 0.6, 0.92, -0.15 + Math.floor(j / 3) * 0.3, st);
      add(st);
    });
    col(-3.3, 3.3, -1.1, -0.1);
    const ss = new THREE.Mesh(rbox(3.4, 0.6, 0.08), toonMat({ map: signTexture('경동시장', { w: 128, h: 28, size: 15, bg: '#ffd23f' }) }));
    ss.position.set(0, 2.55, 0.2); add(ss);
    marker(0, 3.2, 0.3);
    mini('fruit', '과일 받기 시작', 0, 1.0, 0, 2.2, 1.9);
    sign('경동시장', '경동시장 (동대문구)', ['과일, 채소, 약재가 가득한 경동시장이에요.\n노란 마름모 앞에서 과일 받기를 할 수 있어요!'], 3.0, 1.4);
  },
  rosepark({ M, col, sign }) {
    for (let i = 0; i < 8; i++) {
      const z = -4.2 + i * 1.2;
      for (const s of [-1, 1]) M.box(0.1, 1.9, 0.1, '#3f7a3a', s * 1.0, 0.95, z);
      M.box(2.1, 0.12, 0.12, '#3f7a3a', 0, 1.95, z);
      for (let j = 0; j < 7; j++) M.box(0.2, 0.2, 0.2, ['#e8415a', '#ff8fb0', '#ffffff', '#e8413a'][(i + j) % 4], -1 + (j / 6) * 2, 1.95 + Math.sin((j / 6) * Math.PI) * 0.12, z + (j % 2) * 0.1);
      for (const s of [-1, 1]) M.box(0.25, 0.3, 0.25, ['#e8415a', '#ff8fb0'][i % 2], s * 1.2, 0.15, z + 0.5);
    }
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) col(s * 1.0 - 0.12, s * 1.0 + 0.12, -4.32 + i * 1.2, -4.08 + i * 1.2);
    sign('장미터널', '중랑장미공원 (중랑구)', ['중랑천 따라 5km나 이어지는 장미 터널이에요.\n5월이면 장미 축제가 열려요.'], 1.4, 4.4);
  },
  korea_univ({ M, col, sign }) {
    M.box(5.4, 1.8, 1.8, '#b9b3a6', 0, 0.9, -0.3);
    for (let i = 0; i < 9; i++) M.box(0.22, 0.5, 0.05, '#4d5966', -2.4 + i * 0.6, 1.1, 0.62);
    M.box(1.5, 3.4, 1.5, '#c4beb1', 0, 1.7, 0.1); M.geom(new THREE.ConeGeometry(1.0, 1.3, 4).toNonIndexed(), '#4a4f58', 0, 4.05, 0.1, Math.PI / 4);
    M.box(0.6, 0.9, 0.06, '#3a2a1c', 0, 0.45, 0.86); M.box(0.5, 0.5, 0.04, '#8b1e2d', 0, 2.6, 0.86);
    for (const s of [-1, 1]) M.geom(new THREE.ConeGeometry(0.25, 0.6, 4).toNonIndexed(), '#4a4f58', s * 2.6, 2.1, -0.3, Math.PI / 4);
    col(-2.75, 2.75, -1.25, 0.9);
    sign('고려대학교', '고려대학교 (성북구)', ['돌로 지은 고딕 양식 본관이 멋진 고려대학교예요.\n성북구엔 옛 한양도성 성곽길도 있어요.'], 2.0, 1.6);
  },
  april19({ M, col, sign, tree }) {
    M.cyl(1.6, 1.8, 0.4, STONE, 0, 0.2, 0, 14);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 6)) + Math.PI;
      M.box(0.3, 4.2 + (i % 2) * 0.6 - Math.abs(i - 3) * 0.35, 0.3, WHITE, Math.cos(a) * 0.9, 2.4 - Math.abs(i - 3) * 0.17, Math.sin(a) * 0.9 + 0.2);
    }
    M.box(0.5, 0.8, 0.4, '#5b6a5a', 0, 0.8, 0.9);
    col(-1.7, 1.7, -1.7, 1.5);
    for (const [x, z] of [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) tree(x, z, 'pine');
    sign('4·19 민주묘지', '국립4·19민주묘지 (강북구)', ['1960년 4·19 혁명의 희생자들을 기리는 곳이에요.\n북한산 자락 아래 조용한 곳이에요.'], 1.4, 2.6);
  },
  changpowon({ M, col, sign, tree }) {
    M.box(4.6, 0.04, 3.0, '#4fa8e0', 0, 0.02, -0.4); // 습지 연못
    for (let i = 0; i < 28; i++) M.box(0.14, 0.32, 0.14, i % 3 ? '#7a54c8' : '#9b7be0', -2.1 + ((i * 7) % 21) * 0.2, 0.16, -1.7 + ((i * 11) % 13) * 0.2);
    for (let i = 0; i < 28; i++) M.box(0.08, 0.3, 0.08, '#4f9a35', -2.0 + ((i * 5) % 21) * 0.2, 0.15, -1.6 + ((i * 3) % 13) * 0.2);
    M.box(0.9, 0.12, 3.2, '#b5763b', 0, 0.12, -0.4); // 나무 데크
    col(-2.35, -0.45, -1.95, 1.15); col(0.45, 2.35, -1.95, 1.15);
    for (const [x, z] of [[-3, 2], [3, 2], [-3, -2.4], [3, -2.4]]) tree(x, z, 'round');
    sign('창포원', '서울창포원 (도봉구)', ['보랏빛 붓꽃(창포)이 가득한 서울창포원이에요.\n도봉산이 바로 뒤에 있어요.'], 1.4, 2.4);
  },
  // ── 노원구: 화랑대 철도공원 ──
  hwarangdae({ M, col, sign }) {
    for (let i = 0; i < 14; i++) M.box(0.12, 0.05, 1.0, '#6b4a2a', -3.3 + i * 0.5, 0.03, 0);
    for (const s of [-0.3, 0.3]) M.box(7, 0.06, 0.06, '#8d9299', 0, 0.08, s);
    // 증기기관차
    M.geom(new THREE.CylinderGeometry(0.42, 0.42, 1.8, 10).toNonIndexed(), '#2b2f36', -1.8, 0.8, 0, 0, 1, 1, 1, 0, Math.PI / 2);
    M.box(0.9, 1.3, 0.9, '#2b2f36', -0.6, 0.95, 0); M.box(1.0, 0.1, 1.0, '#1f2228', -0.6, 1.65, 0);
    M.cyl(0.12, 0.15, 0.5, '#1f2228', -2.4, 1.35, 0, 6);
    M.box(0.06, 0.15, 0.9, '#e8413a', -2.75, 0.4, 0);
    for (const x of [-2.4, -1.8, -1.2, -0.6]) for (const s of [-0.45, 0.45]) M.geom(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 8).toNonIndexed(), '#c0443a', x, 0.3, s, 0, 1, 1, 1, Math.PI / 2);
    // 객차
    M.box(2.2, 0.9, 0.86, '#2f7a44', 1.0, 0.75, 0); M.box(2.3, 0.1, 0.96, '#d8d4cc', 1.0, 1.25, 0);
    for (let i = 0; i < 4; i++) M.box(0.3, 0.25, 0.02, '#cfe8f4', 0.3 + i * 0.48, 0.9, 0.44);
    // 옛 화랑대역
    M.box(1.6, 0.9, 1.0, '#efe6d4', 2.5, 0.45, -1.2); M.hanokRoof(2.0, 1.4, 0.5, '#5a4a3a', 2.5, 0.9, -1.2);
    col(-2.8, 2.2, -0.5, 0.5); col(1.7, 3.3, -1.75, -0.65);
    sign('화랑대 철도공원', '화랑대 철도공원 (노원구)', ['서울에 마지막까지 남아 있던 간이역, 화랑대역이에요.\n옛 증기기관차가 쉬고 있어요.'], -3, 1.4);
  },
  eunpyeong_hanok({ M, col, sign }) {
    for (const [x, z, ry] of [[-2.4, -1.4, 0], [0.4, -1.6, 0], [2.6, -0.6, Math.PI / 2], [-2.6, 1.3, 0]]) {
      hanokHouse(M, x, z, ry);
      if (ry) col(x - 0.85, x + 0.85, z - 1.25, z + 1.25); else col(x - 1.25, x + 1.25, z - 0.85, z + 0.85);
    }
    M.box(4, 0.5, 0.2, '#d8c7a4', 0.5, 0.25, 2.6); M.box(4.1, 0.08, 0.3, GIWA, 0.5, 0.52, 2.6);
    col(-1.5, 2.5, 2.45, 2.75);
    sign('은평한옥마을', '은평한옥마을 (은평구)', ['북한산을 병풍처럼 두른 은평한옥마을이에요.\n새로 지은 한옥들이 모여 있어요.'], -1, 2.6);
  },
  dongnimmun({ M, col, sign }) {
    M.box(2.6, 2.8, 1.2, '#d6d0c4', 0, 1.4, 0);
    M.box(0.9, 1.6, 1.22, '#4a3f35', 0, 0.8, 0);
    M.box(2.8, 0.25, 1.35, '#c4beb2', 0, 2.92, 0); M.box(1.4, 0.3, 0.06, '#b1a999', 0, 2.4, 0.62);
    for (let y = 0.4; y < 2.6; y += 0.4) M.box(2.62, 0.03, 1.22, '#c4beb2', 0, y, 0);
    col(-1.3, -0.45, -0.6, 0.6); col(0.45, 1.3, -0.6, 0.6);
    // 서대문형무소 (붉은 벽돌)
    M.box(2.2, 1.3, 1.0, '#a5523e', -0.4, 0.65, -1.4 - 0.1);
    for (let i = 0; i < 5; i++) M.box(0.16, 0.25, 0.02, '#3a2a22', -1.25 + i * 0.4, 0.9, -0.99);
    col(-1.5, 0.7, -2.0, -1.0);
    sign('독립문', '독립문 (서대문구)', ['자주독립의 뜻을 담아 1897년에 세운 독립문이에요.\n뒤쪽 붉은 벽돌 건물은 서대문형무소역사관!'], 1.9, 1.3);
  },
  // ── 마포구: 서울월드컵경기장 ──
  worldcup({ M, col, sign, marker, mini }) {
    const n = 26, rx = 4.0, rz = 3.2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, z = Math.sin(a) * rz;
      const len = (2 * Math.PI * Math.hypot(rx, rz) / Math.SQRT2) / n + 0.08;
      if (Math.abs(a - Math.PI / 2) < 0.18) { M.box(len, 0.3, 0.6, '#c9c4b8', x, 1.25, z, -a + Math.PI / 2); continue; } // 입구
      M.box(len, 1.4, 0.6, '#d9d4c8', x, 0.7, z, -a + Math.PI / 2);
      M.box(len, 0.08, 1.4, '#fbfaf6', Math.cos(a) * (rx - 0.2), 1.75, Math.sin(a) * (rz - 0.2), -a + Math.PI / 2, -0.25);
      if (i % 3 === 0) M.box(0.08, 1.4, 0.08, '#e8e4dc', Math.cos(a) * (rx + 0.2), 2.1, Math.sin(a) * (rz + 0.2));
    }
    M.box(5.4, 0.03, 3.8, '#5fae3e', 0, 0.02, 0);
    M.box(0.05, 0.035, 3.8, '#ffffff', 0, 0.025, 0); M.box(5.4, 0.035, 0.05, '#ffffff', 0, 0.025, 1.9); M.box(5.4, 0.035, 0.05, '#ffffff', 0, 0.025, -1.9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.18) continue;
      const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
      col(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
    }
    // 미니게임: 3:3 축구 (경기장 한가운데)
    marker(0, 2.3, 0);
    mini('soccer', '3:3 축구 시작', 0, 0.2, 0, 1.4, 2.0);
    sign('월드컵경기장', '서울월드컵경기장 (마포구)', ['2002 한일 월드컵 개막식이 열린 서울월드컵경기장이에요.\n지붕은 전통 방패연 모양을 닮았대요.', '근처엔 하늘공원, 조금 동쪽엔 홍대 앞 거리가 있어요.'], 1.6, 4.3);
  },
  // ── 강서구: 김포공항 ──
  gimpo({ M, col, sign, add, world, l, marker, mini }) {
    M.box(13, 0.02, 0.12, '#ffffff', 0, 0.02, 0.8);
    for (let i = 0; i < 12; i++) M.box(0.6, 0.02, 0.1, '#ffffff', -6 + i * 1.1, 0.02, 0.2);
    M.box(4.2, 1.2, 1.4, '#e3e6ea', -2.0, 0.6, -2.4); M.box(4.4, 0.15, 1.6, '#9fb3c6', -2.0, 1.25, -2.4);
    for (let i = 0; i < 8; i++) M.box(0.35, 0.6, 0.02, '#6fa8d6', -3.8 + i * 0.5, 0.65, -1.69);
    M.cyl(0.25, 0.3, 3.2, '#e3e6ea', 3.5, 1.6, -2.6, 8); M.cyl(0.6, 0.45, 0.6, '#6fa8d6', 3.5, 3.4, -2.6, 8); M.cyl(0.65, 0.65, 0.12, '#cfd4da', 3.5, 3.75, -2.6, 8);
    col(-4.2, 0.2, -3.2, -1.6); col(3.2, 3.8, -2.9, -2.3);
    // 세워진 비행기
    const plane = makePlane('#ffffff', '#2f6fd8');
    plane.position.set(2.0, 0, 0.5); plane.rotation.y = -Math.PI / 2; add(plane);
    col(0.3, 3.7, -0.6, 1.6);
    // 하늘을 도는 비행기
    const fly = makePlane('#ffffff', '#e8413a');
    fly.scale.setScalar(1.3);
    world.scene.add(fly); world.flyPlane = fly;
    // 비행기 조종 미니게임 입구 (세워진 비행기 앞)
    marker(2.0, 2.6, 2.3);
    mini('flight', 'DS1017 비행기 조종하기 (김포 → 제주)', 2.0, 2.4, 2.0, 3.0, 1.6);
    sign('김포공항', '김포국제공항 (강서구)', ['서울의 하늘길, 김포공항이에요.\n하늘을 올려다보면 비행기가 서울 위를 돌고 있어요!', '강서구엔 마곡의 서울식물원도 있어요.', '세워진 비행기 앞에서 직접 조종해 제주까지 날아가 볼 수 있어요!'], l.hw - 0.2, 1.6);
  },
  // ── 성동구: 성수동 카페거리 (스트리트 스냅) ──
  seongsu({ M, col, sign, marker, mini, add }) {
    // 빨간 벽돌 공장을 고친 카페·팝업 가게
    for (const [x, w, c, name] of [[-1.7, 2.2, '#a8452f', '카페'], [0.9, 1.6, '#3a3f4a', 'POP-UP'], [2.3, 1.0, '#b5563a', '편집숍']]) {
      M.box(w, 2.0, 1.4, c, x, 1.0, -1.0);
      if (c !== '#3a3f4a') for (let y = 0.35; y < 2; y += 0.35) M.box(w + 0.02, 0.04, 1.42, '#7a2f22', x, y, -1.0);
      M.box(w * 0.7, 0.8, 0.04, '#bfe6fa', x, 0.65, -0.29);
      const sg = new THREE.Mesh(rbox(Math.min(1.4, w - 0.1), 0.3, 0.05), toonMat({ map: signTexture(name, { w: 64, h: 14, size: 10, bg: '#fff8e6' }) }));
      sg.position.set(x, 1.65, -0.27); add(sg);
    }
    col(-2.9, 2.9, -1.75, -0.3);
    // 길가 포토존 액자
    M.box(0.1, 1.3, 0.1, '#2a2a2e', -0.55, 0.65, 0.7); M.box(0.1, 1.3, 0.1, '#2a2a2e', 0.55, 0.65, 0.7); M.box(1.2, 0.1, 0.1, '#2a2a2e', 0, 1.3, 0.7);
    marker(0, 2.1, 0.9);
    mini('fashion', '성수동 스트리트 스냅', 0, 1.1, 0, 1.7, 1.5);
    sign('성수동', '성수동 (성동구)', ['낡은 공장과 창고가 카페·팝업스토어로 바뀐 성수동이에요.\n멋쟁이들이 가득해요!', '오늘의 옷차림을 한 사람을 찾아 사진을 찍어 볼까요?'], 2.5, 1.2);
  },
  mokdong({ M, col, sign }) {
    for (let i = 0; i < 3; i++) {
      const x = -1.8 + i * 1.8;
      M.box(1.2, 7.5 + i * 0.6, 1.0, '#f2efe6', x, (7.5 + i * 0.6) / 2, -0.4);
      for (let f = 0; f < 14 + i; f++) M.box(1.22, 0.06, 1.02, '#c9d9e6', x, 0.6 + f * 0.5, -0.4);
      M.box(0.5, 0.3, 0.02, '#3f6f98', x, 7.0 + i * 0.6, 0.11);
    }
    col(-2.5, 2.5, -1.0, 0.2);
    sign('목동 아파트 단지', '목동 (양천구)', ['반듯반듯한 아파트 단지가 끝없이 이어지는 목동이에요.\n안양천 산책로가 바로 옆이에요.'], 0, 1.4);
  },
  gocheok({ M, col, sign, marker, mini }) {
    M.cyl(3.0, 3.0, 1.2, '#c9cdd3', 0, 0.6, 0, 16);
    M.geom(new THREE.SphereGeometry(3.1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), '#eef0f2', 0, 1.2, 0, 0, 1, 0.45, 1);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; M.box(0.1, 1.4, 0.1, '#9aa1aa', Math.cos(a) * 3.05, 1.5, Math.sin(a) * 3.05); }
    M.box(1.2, 0.8, 0.1, '#2f4f8f', 0, 0.5, 3.0);
    col(-2.8, 2.8, -2.8, 2.8);
    // 미니게임: 캐치볼 (돔 입구 앞)
    marker(-0.5, 2.4, 3.7);
    mini('catchball', '고척돔 캐치볼', -0.5, 3.7, -0.6, 3.8, 1.6); // 돔 앞 길이 좁아서 돌아올 자리도 문 앞
    sign('고척스카이돔', '고척스카이돔 (구로구)', ['우리나라 첫 돔 야구장, 고척스카이돔이에요.\n구로구엔 구로디지털단지도 있어요.'], 1.4, 3.4);
  },
  gasan({ M, col, sign, marker, mini }) {
    const towers = [[-1.1, -1.0, 1.4, 9, '#5f92bd'], [1.0, -0.9, 1.3, 7, '#5fa69f'], [-0.2, 1.0, 1.2, 5.5, '#8fa3b8']];
    for (const [x, z, w, h, c] of towers) {
      M.box(w, h, w, c, x, h / 2, z);
      for (let y = 0.5; y < h; y += 0.5) M.box(w + 0.02, 0.05, w + 0.02, '#3f6f98', x, y, z);
      M.box(w * 0.5, 0.4, w * 0.5, '#8d9299', x, h + 0.2, z);
      col(x - w / 2, x + w / 2, z - w / 2, z + w / 2);
    }
    M.box(0.8, 0.7, 0.6, '#8d9299', 1.45, 0.35, 0.6); M.box(0.5, 0.3, 0.05, '#ffe14f', 1.45, 0.55, 0.91); // 로봇 공장 입구
    col(1.05, 1.85, 0.3, 0.9);
    marker(1.45, 2.0, 1.1);
    mini('factory', '가산 로봇 공장', 1.45, 1.25, 1.45, 2.9, 1.3);
    sign('가산디지털단지', 'G밸리 가산디지털단지 (금천구)', ['옛 구로공단이 IT 회사들이 모인\n가산디지털단지로 바뀌었어요.'], 1.4, 2.2);
  },
  // ── 영등포구: 국회의사당 · 63빌딩 ──
  assembly({ M, col, sign }) {
    M.box(5.4, 0.3, 4.0, STONE, 0, 0.15, 0);
    M.box(4.6, 1.8, 3.2, '#e6e1d6', 0, 1.2, 0);
    for (let i = 0; i < 8; i++) M.box(0.18, 1.9, 0.18, '#f4f1ea', -2.1 + i * 0.6, 1.25, 1.75);
    M.box(4.8, 0.25, 3.6, '#d9d3c6', 0, 2.25, 0.1);
    M.cyl(1.4, 1.5, 0.4, '#d9d3c6', 0, 2.55, 0, 14);
    M.geom(new THREE.SphereGeometry(1.4, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), '#6aa58f', 0, 2.75, 0, 0, 1, 0.7, 1);
    col(-2.6, 2.6, -1.9, 2.0);
    sign('국회의사당', '국회의사당 (영등포구)', ['초록 돔 지붕의 국회의사당이에요.\n여의도는 한강 한가운데 있는 섬이에요.', '봄이면 윤중로에 벚꽃이 가득!'], 1.8, 2.4);
  },
  b63({ M, col, sign, marker, mini }) {
    const parts = [[2.6, 7, 1.6], [2.2, 5, 1.4], [1.7, 4, 1.1]];
    let y = 0;
    for (const [w, h, d] of parts) {
      M.box(w, h, d, '#e2b94e', 0, y + h / 2, 0);
      for (let k = 0.5; k < h; k += 0.5) M.box(w + 0.02, 0.05, d + 0.02, '#b98f2a', 0, y + k, 0);
      M.box(0.15, h, d + 0.03, '#f6dc8a', -w / 2 + 0.3, y + h / 2, 0);
      y += h;
    }
    M.box(1.0, 0.6, 0.7, '#c99f3a', 0, y + 0.3, 0); M.cyl(0.04, 0.04, 1.4, '#ffffff', 0, y + 1.3, 0, 4);
    col(-1.35, 1.35, -0.85, 0.85);
    marker(0.6, 2.2, 1.35);
    mini('stairs', '63빌딩 무한의 계단 (63층까지!)', 0.6, 1.35, 0.6, 2.4, 1.2);
    sign('63빌딩', '63빌딩 (영등포구)', ['금빛으로 반짝이는 63빌딩!\n한때 아시아에서 가장 높은 빌딩이었어요.'], -2.0, 1.2);
  },
  noryangjin({ M, col, sign, add }) {
    M.box(4.6, 1.2, 2.4, '#d6dce2', 0, 0.6, -0.3);
    M.geom(new THREE.CylinderGeometry(1.25, 1.25, 4.8, 12, 1, false, 0, Math.PI).toNonIndexed(), '#5f8fb8', 0, 1.2, -0.3, 0, 0.6, 1, 1, 0, Math.PI / 2);
    M.box(1.2, 0.8, 0.06, '#2c3440', 0, 0.4, 0.92);
    for (let i = 0; i < 6; i++) {
      M.box(0.6, 0.3, 0.45, '#3fb8e8', -2 + i * 0.8, 0.15, 1.35);
      M.box(0.3, 0.1, 0.12, ['#ff9a8a', '#c0c8d0', '#e8a040'][i % 3], -2 + i * 0.8, 0.34, 1.35);
    }
    col(-2.35, 2.35, -1.55, 1.6);
    sign('노량진수산시장', '노량진수산시장 (동작구)', ['새벽마다 경매가 열리는 노량진수산시장이에요.\n바로 앞 한강 부두에서 낚시도 해 봐요!'], 2.6, 1.6);
  },
  snu({ M, col, sign, tree }) {
    // 정문 (ㅅ·ㄷ·ㄱ을 본뜬 조형 문)
    M.box(0.35, 3.0, 0.5, '#d8d6d0', -1.4, 1.5, 0, 0, 0, -0.35);
    M.box(0.35, 3.0, 0.5, '#d8d6d0', -0.4, 1.5, 0, 0, 0, 0.35);
    M.box(2.4, 0.35, 0.5, '#d8d6d0', 0.6, 2.9, 0);
    M.box(0.35, 2.9, 0.5, '#d8d6d0', 1.65, 1.45, 0);
    M.box(1.2, 0.35, 0.5, '#d8d6d0', 1.1, 1.5, 0);
    col(-1.95, -1.0, -0.3, 0.3); col(-0.8, 0.15, -0.3, 0.3); col(1.45, 1.85, -0.3, 0.3);
    for (const [x, z] of [[-2.2, -1], [2.2, -1]]) tree(x, z, 'ginkgo');
    sign('서울대학교', '서울대학교 (관악구)', ['관악산 아래 서울대학교 정문이에요.\n관악구는 젊은 사람이 많이 사는 동네예요.'], 2.2, 0.9);
  },
  // ── 서초구: 예술의전당 (갓 모양 오페라하우스) ──
  artscenter({ M, col, sign, marker, mini }) {
    M.box(6.4, 0.8, 4.2, '#e7e1d5', 0, 0.4, 0.3);
    M.cyl(1.7, 1.9, 1.6, '#f0ebe1', 0, 1.6, 0.3, 16);
    M.cyl(3.0, 3.0, 0.12, '#3a3e45', 0, 2.45, 0.3, 20);
    M.cyl(1.05, 1.15, 1.3, '#3a3e45', 0, 3.1, 0.3, 16);
    M.cyl(1.07, 1.07, 0.1, '#7a2a2a', 0, 2.6, 0.3, 16);
    for (let i = 0; i < 10; i++) M.box(0.4, 0.5, 0.02, '#8fb9d6', -2.6 + i * 0.58, 0.45, -1.81);
    col(-3.2, 3.2, -1.8, 2.4);
    marker(-1.5, 2.2, -2.3);
    mini('conductor', '예술의전당 지휘자 체험', -1.5, -2.25, -1.5, -3.3, 1.4);
    sign('예술의전당', '예술의전당 (서초구)', ['선비의 갓을 닮은 지붕, 예술의전당 오페라하우스예요.\n뒤로는 우면산이 있어요.'], 2.0, -2.5, Math.PI);
  },
  coex({ M, col, sign }) {
    M.box(6.6, 1.4, 3.4, '#cfd8e0', -0.2, 0.7, 0.3);
    for (let i = 0; i < 12; i++) M.box(0.4, 0.9, 0.02, '#6fa8d6', -3.2 + i * 0.55, 0.7, -1.41);
    M.box(1.8, 12, 1.8, '#7f9bb5', 2.4, 6, -0.4);
    for (let y = 0.6; y < 12; y += 0.6) M.box(1.82, 0.06, 1.82, '#5a7690', 2.4, y, -0.4);
    M.box(1.2, 0.8, 1.2, '#a9b6c2', 2.4, 12.4, -0.4);
    col(-3.5, 3.3, -1.4, 2.0);
    sign('코엑스', '코엑스 · 무역센터 (강남구)', ['큰 전시장과 별마당 도서관이 있는 코엑스예요.\n옆의 높은 빌딩은 무역센터!', '바로 북쪽엔 천 년 넘은 절, 봉은사가 있어요.'], -2.5, -2.0, Math.PI);
  },
  bongeunsa({ M, col, sign }) {
    pavilion(M, 2.0, 1.2, 0.8, -0.6, -0.3, 0.2, 0.6);
    M.box(2.4, 0.2, 1.6, STONE, -0.6, 0.1, -0.3);
    for (let i = 0; i < 4; i++) M.box(0.5 - i * 0.08, 0.32, 0.5 - i * 0.08, '#b8b2a6', 1.2, 0.2 + i * 0.4, 0.3), M.box(0.62 - i * 0.08, 0.06, 0.62 - i * 0.08, '#a39d90', 1.2, 0.38 + i * 0.4, 0.3);
    M.box(0.5, 0.6, 0.5, STONE2, 1.5, 0.3, -0.8); M.box(0.4, 1.8, 0.3, '#c4beb2', 1.5, 1.5, -0.8); M.box(0.3, 0.32, 0.3, '#c4beb2', 1.5, 2.55, -0.8);
    for (let i = 0; i < 6; i++) M.box(0.16, 0.2, 0.16, ['#e8413a', '#ffd23f', '#3fb8e8', '#5fae3e'][i % 4], -1.6 + i * 0.4, 1.7, 0.6);
    M.box(2.4, 0.02, 0.02, '#6b3b1c', -0.6, 1.8, 0.6);
    col(-1.8, 0.6, -1.1, 0.5); col(0.9, 1.8, -1.1, 0.6);
    sign('봉은사', '봉은사 (강남구)', ['빌딩 숲 한가운데 있는 천년 고찰 봉은사예요.\n커다란 미륵대불이 서 있어요.'], -1.6, 1.3);
  },
  gangnamstn({ M, col, sign, world, l, marker, mini }) {
    M.box(2.2, 8, 2.2, '#5f92bd', 0, 4, -0.2);
    for (let y = 0.5; y < 8; y += 0.5) M.box(2.22, 0.05, 2.22, '#40709a', 0, y, -0.2);
    col(-1.1, 1.1, -1.3, 0.9);
    // 대형 전광판
    const c = document.createElement('canvas'); c.width = 32; c.height = 20;
    const tex = new THREE.CanvasTexture(c); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(rbox(1.9, 1.2, 0.06), basic({ map: tex }));
    scr.position.set(l.x, 5.6, l.z + 0.93); world.scene.add(scr);
    world.screen = { c, ctx: c.getContext('2d'), tex, t: 0 };
    M.box(1.0, 0.5, 0.6, '#3f9a4a', 1.2, 0.25, 1.2); M.box(1.0, 0.05, 0.6, '#ffffff', 1.2, 0.52, 1.2); // 지하철 입구 (2호선 초록)
    col(0.65, 1.75, 0.85, 1.55);
    M.box(1.0, 0.12, 0.7, '#ff6ec7', 0, 0.06, 1.3); // K-팝 댄스 무대 발판
    marker(0, 2.2, 1.3);
    mini('kpop', '강남 K-팝 포즈 챌린지', 0, 1.35, 0, 2.3, 1.2);
    sign('강남역', '강남역 (강남구)', ['하루 수십만 명이 오가는 강남역 사거리예요.\n강남은 길이 바둑판처럼 반듯해요!'], -1.3, 1.3);
  },
  // ── 송파구: 롯데월드타워 · 석촌호수 · 올림픽공원 ──
  lotte({ M, col, sign, add }) {
    M.box(4.2, 1.2, 4.2, '#d6dde4', 0, 0.6, 0);
    const H = 28, n = 14;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const r0 = 1.5 * (1 - t0 * 0.72), r1 = 1.5 * (1 - t1 * 0.72);
      M.geom(new THREE.CylinderGeometry(r1, r0, H / n, 4).toNonIndexed(), i % 2 ? '#c9d6e2' : '#b9c9d8', 0, 1.2 + (i + 0.5) * (H / n), 0, Math.PI / 4);
    }
    for (const s of [-1, 1]) M.box(0.22, 2.4, 0.5, '#dfe7ee', s * 0.22, 1.2 + H + 1.2, 0);
    M.box(0.1, H, 0.1, '#e9f0f6', 0, 1.2 + H / 2, 1.1);
    // 모서리 불빛 줄 + 꼭대기 경고등 (조명 영향 없이 밝아서 밤에 빛나 보임)
    const glow = basic({ color: '#fff3cf' });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2, line = new THREE.Mesh(rbox(0.08, H, 0.08), glow);
      const r = 1.5 * (1 - 0.36); // 가운데 높이의 반지름
      line.position.set(Math.cos(a) * r, 1.2 + H / 2, Math.sin(a) * r);
      line.rotation.set(Math.sin(a) * 0.035, 0, -Math.cos(a) * 0.035); // 위로 갈수록 가늘어지는 몸통을 따라 살짝 기울임
      add(line);
    }
    const beacon = new THREE.Mesh(rbox(0.3, 0.3, 0.3), basic({ color: '#ff4a3a' }));
    beacon.position.set(0, 1.2 + H + 2.6, 0); add(beacon);
    col(-2.1, 2.1, -2.1, 2.1);
    sign('롯데월드타워', '롯데월드타워 (송파구)', ['123층, 555m! 우리나라에서 가장 높은 롯데월드타워예요.\n(이 섬에서도 제일 높아요)', '남쪽 석촌호수엔 놀이공원의 성이 떠 있어요.'], 2.5, 2.0);
  },
  seokchon({ M, col, sign, tree, l }) {
    // 호수 가운데 '매직아일랜드' 성
    M.box(1.2, 0.4, 3.6, '#e8e2d6', 0, 0.2, 0);
    M.box(0.9, 1.4, 0.9, '#f6f0f6', 0, 1.1, 0); M.geom(new THREE.ConeGeometry(0.6, 1.2, 8).toNonIndexed(), '#5a8fe0', 0, 2.4, 0);
    for (const s of [-1, 1]) { M.cyl(0.25, 0.25, 1.4, '#f6f0f6', 0.35 * s, 0.9, -1.1 * s, 8); M.geom(new THREE.ConeGeometry(0.32, 0.7, 8).toNonIndexed(), '#ff8fb0', 0.35 * s, 1.95, -1.1 * s); }
    col(-0.6, 0.6, -1.8, 1.8);
    for (const [x, z] of [[-3.6, -2.4], [-1.8, -2.6], [1.8, -2.6], [3.6, -2.4], [-3.8, 2.4], [3.8, 2.4], [0, 2.6]]) tree(x, z, 'round', 0.8);
    sign('석촌호수', '석촌호수 (송파구)', ['롯데월드타워 아래 석촌호수예요.\n봄엔 벚꽃, 가을엔 단풍이 예뻐요.'], 1.6, -2.6, Math.PI);
    void l;
  },
  olympic({ M, col, sign, tree, l }) {
    // 세계평화의 문 (서쪽 입구)
    const gx = -l.hw + 1.4;
    for (const s of [-1, 1]) { M.box(0.5, 2.2, 0.5, '#e6e1d6', gx, 1.1, s * 1.6); }
    M.box(1.6, 0.5, 4.6, '#efe9dd', gx, 2.45, 0, 0, 0, 0.12);
    M.box(1.62, 0.12, 4.62, '#3fb8e8', gx, 2.2, 0, 0, 0, 0.12);
    for (let i = 0; i < 5; i++) M.box(1.5, 0.06, 0.4, ['#e8413a', '#ffd23f', '#3fb8e8', '#2fa84f', '#9b5de5'][i], gx, 2.12, -1.6 + i * 0.8);
    col(gx - 0.3, gx + 0.3, -1.9, -1.3); col(gx - 0.3, gx + 0.3, 1.3, 1.9);
    // 몽촌토성 잔디 + 나홀로나무
    world_ltree(tree);
    M.box(0.25, 3.4, 0.25, '#e8e4dc', 2.0, 1.7, -2.6); M.box(0.25, 3.0, 0.25, '#e8e4dc', 2.5, 1.5, -2.6); M.box(0.25, 2.6, 0.25, '#e8e4dc', 3.0, 1.3, -2.6); // 오륜 기념탑 느낌
    col(1.8, 3.2, -2.8, -2.4);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const x = Math.cos(a) * (l.hw - 0.8), z = Math.sin(a) * (l.hd - 0.8); if (x < -l.hw + 2.6) continue; tree(x, z, i % 4 === 0 ? 'maple' : 'round'); }
    sign('올림픽공원', '올림픽공원 (송파구)', ['1988 서울올림픽을 기념하는 올림픽공원이에요.\n입구의 큰 지붕은 세계평화의 문!', '언덕 위에 혼자 서 있는 \'나홀로나무\'가 유명해요.\n백제의 몽촌토성도 공원 안에 있어요.'], gx + 0.2, 2.4);
  },
  // ── 강동구: 암사동 선사유적지 (닭 몰이) ──
  amsa({ M, col, sign, marker, mini, add, world, l }) {
    for (const [x, z] of [[-2.2, -1.0], [-0.6, -1.4], [-2.0, 0.8]]) {
      M.geom(new THREE.ConeGeometry(0.9, 1.6, 7).toNonIndexed(), '#c9a25a', x, 0.8, z);
      M.geom(new THREE.ConeGeometry(0.4, 0.4, 7).toNonIndexed(), '#a8843f', x, 1.55, z);
      M.box(0.4, 0.5, 0.1, '#3a2a1c', x, 0.25, z + 0.75);
      col(x - 0.7, x + 0.7, z - 0.7, z + 0.7);
    }
    // 닭장
    const coop = new THREE.Group(); coop.position.set(1.7, 0, -0.8);
    const cpl = toonMat({ map: plankTexture('#d9534a', '#a83a32', '#ea7a6e') }); cpl.map.repeat.set(2, 1);
    box(2.2, 1.4, 1.6, cpl, 0, 0.7, 0, coop);
    const cr = box(2.6, 0.25, 2.1, toonMat({ map: roofTexture() }), 0, 1.55, 0, coop); cr.rotation.x = 0.12;
    box(0.7, 0.8, 0.1, '#5b2f12', 0, 0.4, 0.82, coop);
    box(1.0, 0.08, 0.45, '#b5763b', 0, 0.04, 1.1, coop);
    add(coop);
    col(0.5, 2.9, -1.65, 0.05);
    marker(1.7, 2.6, 0.2);
    mini('chicken', '닭 몰이 시작', 1.7, 1.2, 1.7, 2.0, 1.7);
    world.coop = { x: l.x + 1.7, z: l.z + 1.6 };
    sign('암사동 선사유적지', '암사동 유적 (강동구)', ['6천 년 전 신석기 사람들이 살던 움집터예요.\n강동구는 도시 텃밭과 농장이 많은 동네예요.', '닭장 앞 노란 마름모에서 닭 몰이를 할 수 있어요!'], -0.4, 1.8);
  },
  // ── 노들섬 (벌레 잡기 텃밭) ──
  nodeul({ M, sign, marker, mini, l, map, col }) {
    const crop = ['#5fae3e', '#4f9a35', '#7fcf4a'];
    M.box(3.0, 0.04, 1.2, '#8f5d37', -0.6, 0.02, -0.2);
    for (let x = -1.9; x <= 0.7; x += 0.55) for (let z = -0.6; z <= 0.3; z += 0.45) {
      const k = Math.round(x * 3 + z * 5 + 9) % 3;
      M.box(0.3, 0.26 + k * 0.08, 0.3, crop[k], x, 0.15, z);
      if (k === 0) M.box(0.16, 0.16, 0.16, '#ff8a2e', x, 0.08, z + 0.18);
    }
    M.box(1.2, 1.0, 0.9, '#e9e5dc', 1.6, 0.5, -0.3); M.box(1.3, 0.1, 1.0, '#7a8a96', 1.6, 1.05, -0.3);
    col(1.0, 2.2, -0.75, 0.15);
    marker(-0.6, 1.8, -0.2);
    mini('bug', '벌레 잡기 시작', -0.6, 0.6, -0.6, 1.0, 1.6);
    sign('노들섬 텃밭', '노들섬 (용산구)', ['한강대교 가운데 있는 섬, 노들섬이에요.\n텃밭에 벌레가 생겼대요! 노란 마름모에서 잡아 줘요.'], 0.9, 0.6);
    void l; void map;
  },
  sebitseom({ M, add, l }) {
    const g = new THREE.SphereGeometry(1, 8, 4).toNonIndexed();
    M.box(3.2, 0.12, 2.0, '#d6d8dc', 0, -0.15, 0);
    M.geom(g, '#9fd0e8', -0.8, 0.3, 0, 0.3, 0.9, 0.9, 0.8);
    M.geom(g, '#b8e3f2', 0.6, 0.25, 0.3, -0.4, 0.7, 0.75, 0.6);
    M.geom(g, '#cfeef8', 0.9, 0.2, -0.5, 0.8, 0.5, 0.5, 0.45);
    void add; void l;
  },
};

function world_ltree(tree) { tree(2.6, 1.6, 'round', 1.25); }

// 비행기 (공항·하늘)
export function makePlane(body = '#ffffff', stripe = '#2f6fd8') {
  const g = new THREE.Group();
  box(0.6, 0.6, 3.6, body, 0, 0.75, 0, g);
  box(0.62, 0.1, 3.0, stripe, 0, 0.8, 0, g);
  box(0.5, 0.45, 0.3, body, 0, 0.72, 1.9, g);
  box(0.4, 0.15, 0.05, '#2c3440', 0, 0.85, 2.06, g);
  box(3.8, 0.08, 0.8, body, 0, 0.62, 0.1, g);
  box(1.5, 0.06, 0.45, body, 0, 0.82, -1.6, g);
  box(0.06, 0.8, 0.6, stripe, 0, 1.3, -1.6, g);
  for (const s of [-1, 1]) box(0.25, 0.25, 0.6, '#c9cdd3', s * 0.9, 0.48, 0.3, g);
  for (const [x, z] of [[0, 1.3], [-0.5, -0.1], [0.5, -0.1]]) box(0.08, 0.35, 0.08, '#2c3440', x, 0.2, z, g);
  return g;
}
