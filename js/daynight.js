import * as THREE from 'three';
import { ST } from './city.js';

// ============================================================
//  하루의 흐름: 시계(게임 시간)에 맞춰 하늘·햇빛·안개·밤 불빛이 바뀜
//  새벽(보라) → 해돋이(주황) → 낮 → 늦은 오후(황금빛) → 노을 → 해질녘 → 밤(별·달)
// ============================================================
// [시각, 하늘 위, 지평선, 반구광 하늘, 반구광 땅, 반구광 세기, 해/달빛 색, 해/달빛 세기, 밤 정도]
const KEYS = [
  [0.0, '#070b26', '#1a2250', '#46559a', '#1c2236', 0.55, '#9fb4ff', 0.45, 1],
  [4.3, '#0a0f2e', '#222c5c', '#46559a', '#1c2236', 0.55, '#9fb4ff', 0.45, 1],
  [5.0, '#141c4c', '#34407a', '#55609e', '#22283a', 0.6, '#a8b6ff', 0.45, 0.85],  // 동트기 전: 짙은 파랑
  [5.7, '#33508e', '#8f9cc8', '#98a6d0', '#465062', 0.8, '#c4c8f0', 0.7, 0.45],   // 새벽: 푸르스름, 지평선만 연보라
  [6.4, '#5f94d0', '#e6dcd8', '#c8d8ee', '#66735a', 1.0, '#ffe6d2', 1.25, 0.1],   // 해 뜰 무렵: 맑고 옅은 복숭아빛
  [7.5, '#5fb2ec', '#cdeafa', '#d8efff', '#7a9a55', 1.2, '#fff0d8', 1.9, 0],
  [12, '#58b0ee', '#bfe6fa', '#d8efff', '#7a9a55', 1.25, '#fff0d0', 2.0, 0],
  [16, '#5aacea', '#c8e6f4', '#e0efff', '#7a9a55', 1.2, '#ffe8c0', 1.9, 0],
  [17.5, '#5f98d6', '#ffcf8a', '#ffe2c0', '#857a4c', 1.1, '#ffc27a', 1.7, 0],     // 황금빛 오후
  [18.6, '#4b58a6', '#ff8656', '#ffb092', '#6a4e40', 0.9, '#ff7444', 1.1, 0.2],  // 노을
  [19.5, '#1c225c', '#6e4888', '#6a6aa6', '#2a2838', 0.65, '#b29aff', 0.5, 0.75], // 해질녘
  [20.8, '#090d2c', '#1e2756', '#46559a', '#1c2236', 0.55, '#9fb4ff', 0.45, 1],
  [24, '#070b26', '#1a2250', '#46559a', '#1c2236', 0.55, '#9fb4ff', 0.45, 1],
].map(([h, ...v]) => ({ h, top: new THREE.Color(v[0]), hor: new THREE.Color(v[1]), hs: new THREE.Color(v[2]), hg: new THREE.Color(v[3]), hi: v[4], lc: new THREE.Color(v[5]), li: v[6], night: v[7] }));

const SUNRISE = 6, SUNSET = 19;

const skyVert = `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFrag = `
uniform vec3 top, hor, sunDir, moonDir, sunCol; uniform float stars, sunVis, moonVis, time;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(hor, top, smoothstep(-0.02, 0.55, y));
  // 해: 주변 번짐 + 네모난 도트 원반
  float sg = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(sg, 24.0) * 0.45 + pow(sg, 6.0) * 0.18) * sunVis;
  if (sg > 0.9975) col = mix(col, vec3(1.0, 0.96, 0.82), sunVis);
  // 달
  float mg = dot(d, moonDir);
  if (mg > 0.9988) col = mix(col, vec3(0.96, 0.94, 0.84), moonVis);
  else col += vec3(0.5, 0.55, 0.8) * pow(max(mg, 0.0), 80.0) * 0.25 * moonVis;
  // 별 (방향을 격자로 나눠서 일부 칸만 반짝)
  if (stars > 0.01 && y > 0.02) {
    vec3 q = floor(d * 150.0);
    float h = hash(q);
    if (h > 0.993) col += vec3(0.9, 0.92, 1.0) * stars * (0.55 + 0.45 * sin(time * 2.0 + h * 90.0)) * smoothstep(0.02, 0.2, y);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class DayNight {
  constructor(world) {
    this.world = world;
    this.u = {
      top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color('#ffb070') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) },
      stars: { value: 0 }, sunVis: { value: 1 }, moonVis: { value: 0 }, time: { value: 0 },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.dome.renderOrder = -1; this.dome.frustumCulled = false;
    world.scene.add(this.dome);
    world.scene.background = null;
    this._a = {}; this.hour = -1;
  }

  // 시각(0~24, 소수)에서 두 키프레임 사이를 섞음
  sample(h) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = THREE.MathUtils.smoothstep(h, a.h, b.h);
    const o = this._a;
    for (const key of ['top', 'hor', 'hs', 'hg', 'lc']) (o[key] ||= new THREE.Color()).lerpColors(a[key], b[key], k);
    o.hi = a.hi + (b.hi - a.hi) * k; o.li = a.li + (b.li - a.li) * k; o.night = a.night + (b.night - a.night) * k;
    return o;
  }

  // 미니게임 무대에도 시간대 색을 입힘 (게임하기 어렵지 않게 월드보다 약하게)
  // meta.indoor 인 게임(고척돔)은 조명이 일정해서 건너뜀
  applyMini(g, hour) {
    if (g.meta.indoor) return;
    const sc = g.scene;
    if (!g._dn) {
      const L = [];
      sc.traverse((o) => {
        if (o.isHemisphereLight) L.push({ o, c: o.color.clone(), g: o.groundColor.clone(), i: o.intensity });
        else if (o.isDirectionalLight) L.push({ o, c: o.color.clone(), i: o.intensity });
      });
      g._dn = { L, bg: sc.background?.isColor ? sc.background.clone() : null, fog: sc.fog ? sc.fog.color.clone() : null };
    }
    if (!this.ref) { const r = this.sample(12); this.ref = { lc: r.lc.clone(), hs: r.hs.clone(), hg: r.hg.clone(), hi: r.hi, li: r.li }; }
    const s = this.sample(hour), ref = this.ref, K = 0.7;
    const ratio = (c, a, b) => c.set(Math.min(2, a.r / Math.max(0.02, b.r)), Math.min(2, a.g / Math.max(0.02, b.g)), Math.min(2, a.b / Math.max(0.02, b.b)));
    const tmp = this._t ||= new THREE.Color(), one = this._one ||= new THREE.Color(1, 1, 1);
    for (const l of g._dn.L) {
      if (l.g) {
        l.o.color.copy(l.c).multiply(ratio(tmp, s.hs, ref.hs).lerp(one, 1 - K));
        l.o.groundColor.copy(l.g).multiply(ratio(tmp, s.hg, ref.hg).lerp(one, 1 - K));
        l.o.intensity = l.i * (1 + (s.hi / ref.hi - 1) * K);
      } else {
        l.o.color.copy(l.c).multiply(ratio(tmp, s.lc, ref.lc).lerp(one, 1 - K));
        l.o.intensity = l.i * (1 + (s.li / ref.li - 1) * K);
      }
    }
    // 하늘: 원래 하늘색을 지금 시간대 하늘(지평선·위 중간)로 섞음
    const sky = tmp.copy(s.hor).lerp(s.top, 0.45);
    const mix = 0.2 + 0.65 * Math.max(s.night, Math.min(1, Math.abs(hour - 12.5) / 6)); // 한낮엔 원래 하늘 위주, 아침·저녁·밤엔 시간대 하늘 위주
    if (g._dn.bg) sc.background.copy(g._dn.bg).lerp(sky, Math.min(0.85, mix));
    if (g._dn.fog) sc.fog.color.copy(g._dn.fog).lerp(sky, Math.min(0.85, mix));
  }

  update(hour, t, camPos) {
    const w = this.world, s = this.sample(hour);
    this.u.top.value.copy(s.top); this.u.hor.value.copy(s.hor);
    this.u.time.value = t;
    w.scene.fog.color.copy(s.hor);
    w.hemi.color.copy(s.hs); w.hemi.groundColor.copy(s.hg); w.hemi.intensity = s.hi;
    w.sun.color.copy(s.lc); w.sun.intensity = s.li;
    ST.night.value = s.night;
    w.setLamps?.(s.night);
    this.u.stars.value = Math.max(0, (s.night - 0.3) / 0.7);

    // 해: 동(+x)에서 떠서 남쪽(+z) 하늘을 지나 서(-x)로 짐 / 달은 그 반대
    const day = (hour - SUNRISE) / (SUNSET - SUNRISE);
    const sa = day * Math.PI;
    const sunDir = this.u.sunDir.value.set(Math.cos(sa), Math.sin(sa) * 1.1, 0.55).normalize();
    const nightLen = 24 - (SUNSET - SUNRISE);
    const ma = (((hour - SUNSET + 24) % 24) / nightLen) * Math.PI;
    const moonDir = this.u.moonDir.value.set(Math.cos(ma), Math.sin(ma) * 1.1, 0.4).normalize();
    this.u.sunVis.value = THREE.MathUtils.smoothstep(sunDir.y, -0.12, 0.05);
    this.u.moonVis.value = THREE.MathUtils.smoothstep(moonDir.y, -0.05, 0.1) * Math.min(1, s.night * 1.4);
    this.u.sunCol.value.copy(s.lc);
    // 그림자 방향: 낮엔 해, 밤엔 달 (너무 눕지 않게 높이 보정)
    const L = sunDir.y > -0.02 ? sunDir : moonDir;
    const dir = L.clone(); dir.y = Math.max(dir.y, 0.45); dir.normalize();
    w.sunOffset.copy(dir.multiplyScalar(30));

    if (camPos) this.dome.position.copy(camPos);
  }
}
