// 서울 타일맵 생성 (순수 데이터 — DOM/three 없이 동작)
// 좌표: x = 동(+)/서(-), z = 남(+)/북(-). 1타일 = 1유닛 ≈ 147m
import { NX, NZ, LONC, LATC, KX, KZ, GU, ROWS } from './seoulData.js';
import { rng } from './rng.js';

export { NX, NZ, GU };
export const HX = NX / 2, HZ = NZ / 2;
export const T = { WATER: 0, GRASS: 1, SAND: 2, PATH: 3, SOIL: 4, PLAZA: 5, BRIDGE: 6, ROAD: 7 };
export const WK = { NONE: 0, HAN: 1, STREAM: 2, OUT: 3 }; // 물 종류
export const ZN = { NONE: 0, LANDMARK: 1, PARK: 2, FOREST: 3 }; // 용도 구역
export const geo = (lon, lat) => [(lon - LONC) * KX, -(lat - LATC) * KZ];
const GI = Object.fromEntries(GU.map((g, i) => [g.name, i]));

// ---------- 하천 (경위도 폴리라인, 반폭 타일) ----------
const STREAMS = [
  { name: '중랑천', w: 0.9, pts: [[127.047, 37.692], [127.052, 37.665], [127.058, 37.645], [127.066, 37.625], [127.072, 37.607], [127.071, 37.592], [127.063, 37.578], [127.054, 37.566], [127.047, 37.557], [127.040, 37.548], [127.036, 37.539]] },
  { name: '청계천', w: 0.6, xz: [[3.4, -1.4], [10, -0.8], [20, -0.2], [30, 0.1], [37, 0.4], [42.4, 0.8]] }, // 광화문광장 끝에서 시작 (랜드마크 확대에 맞춰 조금 남쪽으로)
  { name: '안양천', w: 0.9, pts: [[126.889, 37.432], [126.888, 37.455], [126.884, 37.478], [126.878, 37.497], [126.873, 37.515], [126.872, 37.530], [126.869, 37.545], [126.862, 37.558]] },
  { name: '탄천', w: 0.9, pts: [[127.112, 37.468], [127.103, 37.483], [127.091, 37.497], [127.078, 37.509], [127.071, 37.520], [127.068, 37.530]] },
  { name: '양재천', w: 0.6, pts: [[127.020, 37.469], [127.040, 37.476], [127.058, 37.484], [127.076, 37.493], [127.090, 37.497]] },
  { name: '불광천', w: 0.6, pts: [[126.927, 37.615], [126.913, 37.600], [126.903, 37.585], [126.893, 37.572]] },
  { name: '샛강', w: 1.0, pts: [[126.951, 37.5185], [126.938, 37.5148], [126.927, 37.5178], [126.917, 37.5238], [126.906, 37.5325]] },
];

// 한강 다리 (lon, 다리 중심 위도)
// 서울섬엔 간격을 넉넉히 두고 꼭 필요한 다리만 (서→동): 서쪽 · 여의도 · 노들섬 · 반포(무지개분수) · 성수 · 잠실
export const BRIDGES = [
  ['양화대교', 126.9033, 37.546], ['마포대교', 126.9345, 37.533], ['한강대교', 126.9595, 37.520],
  ['반포대교', 126.9963, 37.515], ['성수대교', 127.0345, 37.534], ['잠실대교', 127.0925, 37.526],
];

// 랜드마크 배치 (중심 x,z / 반폭 hw, hd) — 3D 모양은 landmarks.js
// zone: 1 랜드마크(건물·길 금지) 2 공원(나무 OK)
// door: 출입구(상대좌표) → 길이 이어지는 지점
export const LANDMARKS = [
  // 강북
  { id: 'gyeongbok', gu: '종로구', x: 0.5, z: -15, hw: 6.5, hd: 7.5, zone: 1, ground: 'plaza', door: [0, 8] },
  { id: 'bugak', gu: '종로구', x: 3.3, z: -29.8, hw: 2.4, hd: 1.6, zone: 1, ground: 'plaza', door: [0, 1.9] },   // 북악스카이웨이 팔각정 (야경 전망대)
  { id: 'gwanghwamun', gu: '종로구', x: 0.5, z: -4, hw: 2.4, hd: 3.2, zone: 1, ground: 'plaza', door: [0, 3.5] },
  { id: 'heunginjimun', gu: '종로구', x: 21, z: -5.5, hw: 2, hd: 1.4, zone: 1, door: [0, 2] },
  { id: 'ddp', gu: '중구', x: 20.5, z: 4.5, hw: 3.2, hd: 2.3, zone: 1, ground: 'plaza', door: [0, -2.8] },
  { id: 'sungnyemun', gu: '중구', x: -2.5, z: 6, hw: 1.8, hd: 1.4, zone: 1, door: [0, 2] },
  { id: 'namsan', gu: '중구', x: 8, z: 12, hw: 6.5, hd: 6, zone: 2, door: [-6.5, 0] },
  { id: 'museum', gu: '용산구', x: 2.5, z: 27.5, hw: 4, hd: 2.4, zone: 1, ground: 'plaza', door: [0, -3] },
  { id: 'seoulforest', gu: '성동구', x: 36, z: 11, hw: 5, hd: 3.5, zone: 2, door: [-5, 0] },
  { id: 'seongsu', gu: '성동구', x: 47.5, z: 12.5, hw: 3, hd: 1.8, zone: 1, ground: 'plaza', door: [0, 2.1] },     // 성수동 카페거리 (스트리트 스냅)
  { id: 'childrenpark', gu: '광진구', x: 63.5, z: 8.5, hw: 4, hd: 3.5, zone: 2, door: [0, 3.5] },
  { id: 'gyeongdong', gu: '동대문구', x: 37.5, z: -13.5, hw: 3.4, hd: 2, zone: 1, ground: 'plaza', door: [0, 2.6] },
  { id: 'rosepark', gu: '중랑구', x: 60.5, z: -34, hw: 1.8, hd: 5, zone: 1, ground: 'path', door: [1.8, 0] },
  { id: 'korea_univ', gu: '성북구', x: 33.5, z: -21.5, hw: 3.2, hd: 2.4, zone: 1, ground: 'plaza', door: [0, 3] },
  { id: 'april19', gu: '강북구', x: 17, z: -62, hw: 3, hd: 3, zone: 1, ground: 'plaza', door: [0, 3.2] },
  { id: 'changpowon', gu: '도봉구', x: 42, z: -93, hw: 3.5, hd: 3, zone: 2, door: [0, 3] },
  { id: 'hwarangdae', gu: '노원구', x: 70, z: -43, hw: 3.6, hd: 1.8, zone: 1, ground: 'path', door: [0, 2] },
  { id: 'eunpyeong_hanok', gu: '은평구', x: -22, z: -60, hw: 4, hd: 3, zone: 1, door: [0, 3.3] },
  { id: 'dongnimmun', gu: '서대문구', x: -10, z: -6, hw: 2.4, hd: 2, zone: 1, ground: 'plaza', door: [0, 2.2] },
  { id: 'myeongdong', gu: '중구', x: 8, z: 3, hw: 2.6, hd: 1.6, zone: 1, ground: 'plaza', door: [0, 1.9] },      // 명동 거리 (길 안내 도우미)
  { id: 'itaewon', gu: '용산구', x: 11.5, z: 21, hw: 2.6, hd: 1.7, zone: 1, ground: 'plaza', door: [0, -2] },     // 이태원 지구촌 축제 (퍼레이드)
  { id: 'karaoke', gu: '마포구', x: -34.5, z: 6.8, hw: 1.7, hd: 1.4, zone: 1, ground: 'plaza', door: [0, 1.6] },      // 홍대 코인노래방 (리듬게임)
  { id: 'clawshop', gu: '마포구', x: -31.2, z: 6.6, hw: 1.2, hd: 1.2, zone: 1, ground: 'plaza', door: [0, 1.4] },     // 홍대 인형뽑기 가게
  { id: 'license', gu: '노원구', x: 54, z: -77, hw: 4.6, hd: 3.4, zone: 1, ground: 'plaza', door: [0, 3.6] },          // 도봉운전면허시험장 (카트 레이싱)
  { id: 'worldcup', gu: '마포구', x: -46, z: -4, hw: 4.8, hd: 4, zone: 1, ground: 'plaza', door: [0, 4.3] },
  // 강남
  { id: 'botanic', gu: '강서구', x: -84.7, z: -5.6, hw: 3, hd: 2.4, zone: 1, ground: 'plaza', door: [3.3, 0] },     // 마곡 서울식물원 (물 주기)
  { id: 'gimpo', gu: '강서구', x: -104, z: 4, hw: 7, hd: 3.5, zone: 1, ground: 'road', door: [7.5, 0] },
  { id: 'mokdong', gu: '양천구', x: -61, z: 25, hw: 3, hd: 2, zone: 1, ground: 'plaza', door: [0, 2.3] },
  { id: 'gocheok', gu: '구로구', x: -65, z: 48.5, hw: 3.2, hd: 3.2, zone: 1, ground: 'plaza', door: [0, 3.5] },
  { id: 'gasan', gu: '금천구', x: -55, z: 62, hw: 2.4, hd: 2.4, zone: 1, ground: 'plaza', door: [0, 2.6] },
  { id: 'assembly', gu: '영등포구', x: -36, z: 22.5, hw: 3, hd: 2.4, zone: 1, ground: 'plaza', door: [0, 2.6] },
  { id: 'b63', gu: '영등포구', x: -23.5, z: 29.5, hw: 1.8, hd: 1.8, zone: 1, ground: 'plaza', door: [-2, 0] },
  { id: 'noryangjin', gu: '동작구', x: -19, z: 38.5, hw: 2.6, hd: 1.6, zone: 1, ground: 'plaza', door: [0, 1.8] },
  { id: 'snu', gu: '관악구', x: -15, z: 72, hw: 2.6, hd: 1.4, zone: 1, ground: 'plaza', door: [0, -1.6] },
  { id: 'artscenter', gu: '서초구', x: 23, z: 63, hw: 3.4, hd: 2.6, zone: 1, ground: 'plaza', door: [0, -2.8] },
  { id: 'coex', gu: '강남구', x: 50, z: 39, hw: 3.6, hd: 2.4, zone: 1, ground: 'plaza', door: [0, -2.6] },
  { id: 'bongeunsa', gu: '강남구', x: 50, z: 33.5, hw: 2.2, hd: 1.6, zone: 1, ground: 'plaza', door: [0, 1.8] },
  { id: 'gangnamstn', gu: '강남구', x: 31, z: 49, hw: 1.6, hd: 1.6, zone: 1, ground: 'plaza', door: [0, 1.8] },
  { id: 'ballpark', gu: '송파구', x: 66.3, z: 40.5, hw: 1.8, hd: 1.9, zone: 1, ground: 'plaza', door: [0, -2.1] },  // 잠실야구장 (홈런 더비) — 실제보다 조금 동쪽 (탄천 자리를 피함)
  { id: 'lotte', gu: '송파구', x: 74.5, z: 37.5, hw: 2.2, hd: 2.2, zone: 1, ground: 'plaza', door: [0, 2.4] },
  { id: 'seokchon', gu: '송파구', x: 75, z: 42.5, hw: 3.6, hd: 2.3, zone: 1, door: [0, -2.4] },
  { id: 'olympic', gu: '송파구', x: 88, z: 31, hw: 6.5, hd: 5, zone: 2, door: [-6.6, 0] },
  { id: 'amsa', gu: '강동구', x: 93, z: 3, hw: 3.2, hd: 2.4, zone: 1, ground: 'path', door: [0, 2.6] },
  // 한강 위/섬
  { id: 'nodeul', gu: '용산구', x: -10.5, z: 33.5, hw: 2.4, hd: 1.0, zone: 1, island: true },
  { id: 'sebitseom', gu: '서초구', x: 10.5, z: 36.5, hw: 1.6, hd: 1.0, zone: 1, inRiver: true },
];

// 숲(산이 있던 자리 → 평지 숲)
const FORESTS = [
  ['북한산', 126.985, 37.665, 13], ['도봉산', 127.018, 37.692, 7], ['수락산', 127.078, 37.688, 6], ['불암산', 127.093, 37.650, 5],
  ['관악산', 126.957, 37.447, 11], ['청계산', 127.040, 37.437, 7], ['우면산', 127.005, 37.468, 4], ['아차산', 127.104, 37.568, 4],
  ['인왕산', 126.958, 37.585, 3.5], ['북악산', 126.982, 37.597, 5.5], ['안산', 126.942, 37.578, 2.5], ['대모산', 127.080, 37.474, 4], ['봉산', 126.902, 37.613, 3], ['개화산', 126.808, 37.580, 3],
];
// 건물 스타일 강제 구역
export const STYLE_RECTS = [
  { style: 'hanok', x0: 8, x1: 15, z0: -21, z1: -10 },      // 북촌 한옥마을
  { style: 'apt', x0: -70, x1: -52, z0: 18, z1: 32 },       // 목동 아파트 단지
  { style: 'office', x0: -60, x1: -49, z0: 57, z1: 68 },    // 가산디지털단지
  { style: 'office', x0: -36, x1: -24, z0: 20, z1: 31 },    // 여의도
  { style: 'office', x0: 24, x1: 60, z0: 36, z1: 52 },      // 테헤란로
  { style: 'apt', x0: 62, x1: 82, z0: 26, z1: 36 },         // 잠실
];

const GRID_SONGPA_Z = 45; // 송파구는 이보다 북쪽(잠실·올림픽공원 쪽)만 바둑판
const HAN_WIDEN = 1;
// 북악스카이웨이 길 (x, z) — 팔각정(bugak 랜드마크) 앞을 지나감
export const SKYWAY = [[-5.6, -23.2], [-4.2, -25.6], [-2.0, -26.2], [-0.8, -27.6], [1.0, -27.5], [5.8, -27.5], [7.2, -28.8], [9.0, -29.2], [10.6, -27.4], [12.6, -26.6], [14.6, -28.0], [16.8, -27.6]];      // 한강을 양쪽으로 이만큼(칸) 넓힘

export class SeoulMap {
  constructor(seed = 2026) {
    this.r = rng(seed);
    const n = NX * NZ;
    this.tile = new Uint8Array(n);
    this.gu = new Int8Array(n).fill(-1);
    this.wk = new Uint8Array(n);
    this.zone = new Uint8Array(n);
    this.bkind = new Uint8Array(n); // 1 한강다리 2 작은 다리
    this.nodes = [];
    this.bridgeInfo = [];
    this.decode();
    this.widenHan();
    this.markGrid();
    this.addIslands();
    this.paintStreams();
    this.paintZones();
    this.riverside();
    this.gangnamGrid();
    this.hanBridges();
    this.gangbukRoads();
    this.skyway();
    this.connectDoors();
  }

  i(tx, tz) { return tz * NX + tx; }
  inb(tx, tz) { return tx >= 0 && tz >= 0 && tx < NX && tz < NZ; }
  t(x, z) { return [Math.floor(x + HX), Math.floor(z + HZ)]; }
  tileAt(x, z) { const [tx, tz] = this.t(x, z); return this.inb(tx, tz) ? this.tile[this.i(tx, tz)] : T.WATER; }
  guAt(x, z) { const [tx, tz] = this.t(x, z); return this.inb(tx, tz) ? this.gu[this.i(tx, tz)] : -1; }
  isLand(k) { return this.tile[k] !== T.WATER && this.tile[k] !== T.BRIDGE; }
  north(k) { return this.gu[k] >= 0 && GU[this.gu[k]].north; }
  south(k) { return this.gu[k] >= 0 && !GU[this.gu[k]].north; }
  // 바둑판 도로는 강남구·서초구 + 잠실(송파구 북쪽)만, 나머지는 구불구불한 마을길
  grid(k) { return this.gridA[k] === 1; }
  organic(k) { return this.gu[k] >= 0 && this.gridA[k] === 0; }
  markGrid() {
    this.gridA = new Uint8Array(NX * NZ);
    const GN = GI['강남구'], SC = GI['서초구'], SP = GI['송파구'];
    for (let k = 0; k < NX * NZ; k++) {
      const g = this.gu[k], z = ((k / NX) | 0) + 0.5 - HZ;
      // 서울섬: 바둑판 큰길(빌딩 숲)은 만들지 않고 강남도 구불구불한 흙길로
      void g; void z; void GN; void SC; void SP;
    }
  }

  decode() {
    for (let tz = 0; tz < NZ; tz++) {
      const row = ROWS[tz];
      let tx = 0, num = '';
      for (const ch of row) {
        if (ch >= '0' && ch <= '9') { num += ch; continue; }
        const cnt = num ? +num : 1; num = '';
        for (let k = 0; k < cnt; k++, tx++) {
          const id = this.i(tx, tz);
          if (ch === '~') { this.tile[id] = T.WATER; this.wk[id] = WK.HAN; }
          else if (ch === '.') { this.tile[id] = T.WATER; this.wk[id] = WK.OUT; }
          else { this.tile[id] = T.GRASS; this.gu[id] = ch.charCodeAt(0) - 97; }
        }
      }
    }
    // 한강 타일에도 가까운 강변 구를 기억(표시용 X) — 지도는 '한강'
  }

  // 한강을 양쪽으로 HAN_WIDEN칸씩 넓힘 (강가 랜드마크 자리는 그대로 둠)
  // hanOrig: 넓히기 전 한강 — 다리 교각 개수를 예전과 같게 맞출 때 씀
  widenHan() {
    this.hanOrig = Uint8Array.from(this.wk, (w) => (w === WK.HAN ? 1 : 0));
    const keep = LANDMARKS.filter((L) => !L.island && !L.inRiver);
    const protectedAt = (x, z) => keep.some((L) => Math.abs(x - L.x) < L.hw + 1.5 && Math.abs(z - L.z) < L.hd + 1.5);
    for (let pass = 0; pass < HAN_WIDEN; pass++) {
      const add = [];
      for (let tz = 1; tz < NZ - 1; tz++) for (let tx = 1; tx < NX - 1; tx++) {
        const k = this.i(tx, tz);
        if (this.gu[k] < 0) continue;
        if (![k - 1, k + 1, k - NX, k + NX].some((j) => this.wk[j] === WK.HAN)) continue;
        if (protectedAt(tx + 0.5 - HX, tz + 0.5 - HZ)) continue;
        add.push(k);
      }
      for (const k of add) { this.tile[k] = T.WATER; this.wk[k] = WK.HAN; this.gu[k] = -1; }
    }
  }

  // 원/타원/사각 칠하기 도우미
  each(x0, x1, z0, z1, fn) {
    const a = Math.max(0, Math.floor(x0 + HX)), b = Math.min(NX - 1, Math.floor(x1 + HX));
    const c = Math.max(0, Math.floor(z0 + HZ)), d = Math.min(NZ - 1, Math.floor(z1 + HZ));
    for (let tz = c; tz <= d; tz++) for (let tx = a; tx <= b; tx++) fn(this.i(tx, tz), tx + 0.5 - HX, tz + 0.5 - HZ, tx, tz);
  }

  addIslands() {
    const isl = (lmId, rx, rz, guName) => {
      const L = LANDMARKS.find((l) => l.id === lmId);
      this.each(L.x - rx - 1, L.x + rx + 1, L.z - rz - 1, L.z + rz + 1, (k, x, z) => {
        if (((x - L.x) / rx) ** 2 + ((z - L.z) / rz) ** 2 <= 1) { this.tile[k] = T.GRASS; this.wk[k] = 0; this.gu[k] = GI[guName]; }
      });
    };
    isl('nodeul', 3.2, 1.6, '용산구');
    // 밤섬(새들의 섬, 출입 불가) · 선유도
    const [bx, bz] = geo(126.9265, 37.5395);
    this.each(bx - 3, bx + 3, bz - 2, bz + 2, (k, x, z) => { if (((x - bx) / 2.6) ** 2 + ((z - bz) / 0.9) ** 2 <= 1 && this.wk[k] === WK.HAN) { this.tile[k] = T.GRASS; this.wk[k] = 0; this.gu[k] = GI['영등포구']; this.zone[k] = ZN.FOREST; } });
    this.bamseom = [bx, bz];
  }

  paintStreams() {
    const r = this.r;
    for (const s of STREAMS) {
      const pts = s.xz || s.pts.map(([lo, la]) => geo(lo, la));
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az), steps = Math.ceil(len / 0.25);
        for (let j = 0; j <= steps; j++) {
          const u = j / steps, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
          const w = s.w;
          this.each(x - w - 1, x + w + 1, z - w - 1, z + w + 1, (k, cx, cz) => {
            if (Math.hypot(cx - x, cz - z) <= w + 0.15 && this.tile[k] !== T.WATER) { this.tile[k] = T.WATER; this.wk[k] = WK.STREAM; }
          });
        }
      }
    }
    // 석촌호수
    const L = LANDMARKS.find((l) => l.id === 'seokchon');
    this.each(L.x - 4, L.x + 4, L.z - 3, L.z + 3, (k, x, z) => {
      const dx = (x - L.x) / 3.4, dz = (z - L.z) / 1.9;
      if (dx * dx + dz * dz <= 1 && Math.abs(x - L.x) > 0.6) { this.tile[k] = T.WATER; this.wk[k] = WK.STREAM; }
    });
    void r;
  }

  paintZones() {
    for (const [, lo, la, rad] of FORESTS) {
      const [fx, fz] = geo(lo, la);
      this.each(fx - rad - 1, fx + rad + 1, fz - rad - 1, fz + rad + 1, (k, x, z) => {
        const a = Math.atan2(z - fz, x - fx);
        const R = rad * (1 + 0.18 * Math.sin(3 * a + lo) + 0.1 * Math.sin(5 * a));
        if (Math.hypot(x - fx, z - fz) < R && this.isLand(k)) this.zone[k] = ZN.FOREST;
      });
    }
    for (const L of LANDMARKS) {
      if (L.inRiver) continue;
      const tileType = { plaza: T.PLAZA, path: T.PATH, road: T.ROAD }[L.ground];
      this.each(L.x - L.hw, L.x + L.hw - 0.01, L.z - L.hd, L.z + L.hd - 0.01, (k) => {
        if (this.tile[k] === T.WATER) { if (this.wk[k] === WK.STREAM) this.zone[k] = L.zone; return; }
        this.zone[k] = L.zone;
        if (tileType) this.tile[k] = tileType;
        this.gu[k] = GI[L.gu];
      });
    }
  }

  // 한강공원: 물가 모래 + 자전거길, 바깥 바다 쪽 모래사장
  riverside() {
    const n = NX * NZ, dH = new Uint8Array(n).fill(99), dO = new Uint8Array(n).fill(99);
    const q = [];
    for (let k = 0; k < n; k++) if (this.wk[k] === WK.HAN) { dH[k] = 0; q.push(k); }
    const bfs = (d, q) => {
      for (let h = 0; h < q.length; h++) {
        const k = q[h], tx = k % NX, tz = (k / NX) | 0;
        if (d[k] >= 3) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = tx + dx, nz = tz + dz;
          if (!this.inb(nx, nz)) continue;
          const m = this.i(nx, nz);
          if (d[m] > d[k] + 1) { d[m] = d[k] + 1; q.push(m); }
        }
      }
    };
    bfs(dH, q);
    const q2 = [];
    for (let k = 0; k < n; k++) if (this.wk[k] === WK.OUT) { dO[k] = 0; q2.push(k); }
    bfs(dO, q2);
    for (let k = 0; k < n; k++) {
      if (this.tile[k] !== T.GRASS || this.zone[k] === ZN.LANDMARK) continue;
      if (dH[k] === 1) this.tile[k] = T.SAND;
      else if (dH[k] === 2 && dO[k] > 1) this.tile[k] = T.PATH; // 한강 자전거길
      else if (dO[k] === 1) this.tile[k] = T.SAND;
    }
    this.dHan = dH;
  }

  // 강남·잠실 — 바둑판 도로
  gangnamGrid() {
    const P = 10, OX = 3, OZ = 4; // 큰길 간격
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      const k = this.i(tx, tz);
      if (!this.grid(k) && !(this.wk[k] === WK.STREAM && this.nearGrid(tx, tz))) continue;
      if (this.zone[k] === ZN.LANDMARK || this.zone[k] === ZN.FOREST || this.zone[k] === ZN.PARK) continue;
      if (this.tile[k] === T.SAND) continue;
      const mx = (((tx - OX) % P) + P) % P, mz = (((tz - OZ) % P) + P) % P;
      const main = mx <= 1 || mz <= 1;
      const alley = mx === 6 || mz === 6;
      if (!main && !alley) continue;
      if (this.tile[k] === T.WATER) { if (this.wk[k] === WK.STREAM) { this.tile[k] = T.BRIDGE; this.bkind[k] = 2; } continue; }
      this.tile[k] = main ? T.ROAD : T.PLAZA;
    }
  }
  nearGrid(tx, tz) {
    for (let d = 1; d <= 3; d++) for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      if (this.inb(tx + dx, tz + dz) && this.grid(this.i(tx + dx, tz + dz))) return true;
    }
    return false;
  }

  hanBridges() {
    for (const [name, lon, lat] of BRIDGES) {
      const [bx, bz] = geo(lon, lat);
      const tx0 = Math.floor(bx + HX), tc = Math.floor(bz + HZ);
      let zN = -1, zS = -1;
      for (let tz = tc; tz >= Math.max(0, tc - 25); tz--) { const k = this.i(tx0, tz); if (this.isLand(k) && this.north(k) && this.zone[k] !== ZN.FOREST) { zN = tz; break; } }
      for (let tz = tc; tz < Math.min(NZ, tc + 25); tz++) { const k = this.i(tx0, tz); if (this.isLand(k) && this.south(k)) { zS = tz; break; } }
      if (zN < 0 || zS < 0) continue;
      for (const tx of [tx0, tx0 + 1]) {
        for (let tz = zN + 1; tz < zS; tz++) {
          const k = this.i(tx, tz);
          if (this.tile[k] === T.WATER) { this.tile[k] = T.BRIDGE; this.bkind[k] = 1; this.wk[k] = WK.HAN; }
          else if (this.zone[k] !== ZN.LANDMARK) this.tile[k] = T.ROAD;
        }
        // 남단: 바둑판 지역이면 큰길까지, 아니면 강변을 지나 마을길이 시작되는 곳까지
        const toGrid = this.grid(this.i(tx0, Math.min(NZ - 1, zS + 3)));
        for (let tz = zS; tz < zS + (toGrid ? 14 : 4) && tz < NZ; tz++) {
          const k = this.i(tx, tz);
          if (this.tile[k] === T.ROAD && tz > zS + 1) break;
          if (this.tile[k] === T.WATER || this.zone[k] === ZN.LANDMARK) break;
          this.tile[k] = T.ROAD;
        }
        // 북단: 강변 모래·자전거길 지나 땅까지
        for (let tz = zN; tz > zN - 4 && tz >= 0; tz--) {
          const k = this.i(tx, tz);
          if (this.tile[k] === T.WATER || this.zone[k] === ZN.LANDMARK) break;
          this.tile[k] = T.PATH;
        }
      }
      const nx = tx0 + 1 - HX, nz = zN - 3 + 0.5 - HZ;
      this.nodes.push({ x: nx, z: nz, fixed: true, w: 2, bridge: name });
      if (!this.grid(this.i(tx0, Math.min(NZ - 1, zS + 3)))) this.nodes.push({ x: nx, z: zS + 3 + 0.5 - HZ, fixed: true, w: 2 });
      this.bridgeInfo.push({ name, x0: tx0 - HX, x1: tx0 + 2 - HX, z0: zN + 1 - HZ, z1: zS - HZ });
    }
  }

  // 강북 + 강남·잠실 밖의 한강 이남 — 구불구불 자연스러운 길
  gangbukRoads() {
    const r = this.r;
    const nodes = this.nodes.slice();
    for (const L of LANDMARKS) {
      if (L.island || L.inRiver) continue;
      const [dtx, dtz] = this.t(L.x + L.door[0] * 1.15, L.z + L.door[1] * 1.15);
      if (!this.inb(dtx, dtz) || this.grid(this.i(dtx, dtz))) continue;
      nodes.push({ x: L.x + L.door[0] * 1.15, z: L.z + L.door[1] * 1.15, fixed: true, w: 2 });
    }
    // 무작위 마을 거점
    let tries = 0;
    while (tries++ < 6000) {
      const x = (r() - 0.5) * NX, z = (r() - 0.5) * NZ;
      const [tx, tz] = this.t(x, z);
      if (!this.inb(tx, tz)) continue;
      const k = this.i(tx, tz);
      if (!this.organic(k) || !this.isLand(k) || this.zone[k] === ZN.LANDMARK) continue;
      if (this.zone[k] === ZN.FOREST && r() < 0.85) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 11)) continue;
      nodes.push({ x, z, w: 1 });
    }
    this.gbNodes = nodes;
    // 최소 신장 트리 (큰길) + 가까운 이웃 몇 개 (골목)
    const N = nodes.length, inT = new Uint8Array(N), best = new Float64Array(N).fill(Infinity), par = new Int32Array(N).fill(-1);
    best[0] = 0;
    const edges = [];
    for (let it = 0; it < N; it++) {
      let u = -1;
      for (let v = 0; v < N; v++) if (!inT[v] && (u < 0 || best[v] < best[u])) u = v;
      inT[u] = 1;
      if (par[u] >= 0 && best[u] < 1e5) edges.push([par[u], u, 2]); // 한강 건너는 연결은 빼기 (다리가 이어 줌)
      for (let v = 0; v < N; v++) {
        if (inT[v]) continue;
        const d = this.edgeCost(nodes[u], nodes[v]);
        if (d < best[v]) { best[v] = d; par[v] = u; }
      }
    }
    const has = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    for (let a = 0; a < N; a++) {
      const near = nodes.map((n, b) => [b, Math.hypot(n.x - nodes[a].x, n.z - nodes[a].z)]).filter(([b, d]) => b !== a && d < 19).sort((p, q) => p[1] - q[1]).slice(0, 2);
      for (const [b] of near) {
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (has.has(key) || this.edgeCost(nodes[a], nodes[b]) > 1e5) continue;
        has.add(key); edges.push([a, b, 1]);
      }
    }
    this.gbEdges = edges;
    for (const [a, b, w] of edges) this.curvyPath(nodes[a], nodes[b], w);
    // 짧은 골목길
    for (let i = 0; i < 40; i++) {
      const n = nodes[(r() * N) | 0];
      const ang = r() * Math.PI * 2, len = 3 + r() * 5;
      const ex = n.x + Math.cos(ang) * len * (0.8 + r()), ez = n.z + Math.sin(ang) * len * (0.8 + r());
      this.curvyPath({ x: n.x + (r() - 0.5) * 6, z: n.z + (r() - 0.5) * 6 }, { x: ex, z: ez }, 1, true);
    }
  }
  // 한강/바다/다른 강안을 건너면 비싸게
  edgeCost(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / 0.7);
    let bad = 0;
    for (let j = 1; j < steps; j++) {
      const u = j / steps;
      const [tx, tz] = this.t(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u);
      if (!this.inb(tx, tz)) { bad++; continue; }
      const k = this.i(tx, tz);
      if (this.wk[k] === WK.HAN || this.wk[k] === WK.OUT || this.grid(k) || this.zone[k] === ZN.LANDMARK) bad++;
    }
    return bad ? 1e6 + d : d;
  }
  curvyPath(a, b, w, soft = false) {
    const r = this.r;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.5) return;
    const nx = -dz / d, nz = dx / d;
    const a1 = (r() - 0.5) * d * 0.28, a2 = (r() - 0.5) * d * 0.14, a3 = (r() - 0.5) * d * 0.06;
    const steps = Math.ceil(d / 0.2);
    const rad = w === 2 ? 0.95 : 0.5;
    for (let j = 0; j <= steps; j++) {
      const u = j / steps;
      const off = a1 * Math.sin(Math.PI * u) + a2 * Math.sin(2 * Math.PI * u) + a3 * Math.sin(3 * Math.PI * u);
      const x = a.x + dx * u + nx * off, z = a.z + dz * u + nz * off;
      let stop = false;
      this.each(x - rad - 0.5, x + rad + 0.5, z - rad - 0.5, z + rad + 0.5, (k, cx, cz) => {
        if (Math.max(Math.abs(cx - x), Math.abs(cz - z)) > rad) return;
        const t = this.tile[k];
        if (this.zone[k] === ZN.LANDMARK || this.grid(k)) { if (soft) stop = true; return; }
        if (t === T.WATER) {
          if (this.wk[k] === WK.STREAM) { this.tile[k] = T.BRIDGE; this.bkind[k] = 2; } else if (soft) stop = true;
          return;
        }
        if (t === T.GRASS || t === T.SAND) this.tile[k] = T.PATH;
      });
      if (stop) return;
    }
  }

  // 랜드마크 입구 → 가장 가까운 길까지 곧은 길
  // 북악스카이웨이: 창의문 → 북악산 숲 속 구불구불한 고갯길 → 팔각정 앞 → 아리랑고개
  skyway() {
    const pts = SKYWAY;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
      for (let j = 0; j <= steps; j++) {
        const u = j / steps, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
        this.each(x - 1.5, x + 1.5, z - 1.5, z + 1.5, (k, cx, cz) => {
          if (Math.hypot(cx - x, cz - z) <= 0.75 && this.isLand(k) && this.zone[k] !== ZN.LANDMARK) this.tile[k] = T.ROAD;
        });
      }
    }
  }

  connectDoors() {
    for (const L of LANDMARKS) {
      if (L.inRiver || L.island) continue;
      let x = L.x + L.door[0], z = L.z + L.door[1];
      const ux = Math.sign(L.door[0]) * (Math.abs(L.door[0]) > Math.abs(L.door[1]) ? 1 : 0);
      const uz = Math.sign(L.door[1]) * (Math.abs(L.door[1]) >= Math.abs(L.door[0]) ? 1 : 0);
      const isRoad = (t) => t === T.ROAD || t === T.PATH || t === T.PLAZA || t === T.BRIDGE;
      const path = [];
      let ok = false;
      for (let s = 0; s < 14; s++) {
        const [tx, tz] = this.t(x, z);
        if (!this.inb(tx, tz)) break;
        const k = this.i(tx, tz);
        if (this.zone[k] !== ZN.LANDMARK && isRoad(this.tile[k]) && s > 0) { ok = true; break; }
        if (this.tile[k] === T.WATER) { if (this.wk[k] === WK.STREAM) path.push([k, true]); else break; }
        else if (this.zone[k] !== ZN.LANDMARK) path.push([k, false]);
        x += ux; z += uz;
      }
      if (!ok) continue;
      const [gtx, gtz] = this.t(L.x + L.door[0], L.z + L.door[1]);
      const south = this.inb(gtx, gtz) && this.grid(this.i(gtx, gtz)); // 바둑판 지역은 보도블록, 나머지는 흙길
      for (const [k, br] of path) {
        if (br) { this.tile[k] = T.BRIDGE; this.bkind[k] = 2; } else this.tile[k] = south ? T.PLAZA : T.PATH;
        // 길 폭 2
        const tx = k % NX, tz = (k / NX) | 0;
        const k2 = ux ? this.i(tx, tz + 1) : this.i(tx + 1, tz);
        if (!br && this.tile[k2] !== T.WATER && this.zone[k2] !== ZN.LANDMARK) this.tile[k2] = south ? T.PLAZA : T.PATH;
      }
    }
  }
}
