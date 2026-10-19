import * as THREE from 'three';
import { U } from './toon.js';

// ============================================================
//  하루의 흐름 (실제 7초 = 게임 10분)
//  낮은 원래 서울섬 '낮 12:30', 해 질 녘은 원래 서울섬 '노을 6:40' 그대로:
//   하늘: 보라 → 분홍 → 살구 그라데이션 + 큰 해 + 분홍 구름 줄 (화면에 고정된 그림, 원래처럼)
//   빛: 복숭아빛 하늘광 + 낮게 깔리는 주황 햇빛 + 보랏빛 그늘, 살구색 안개
//   땅 색: 잔디는 올리브·황금빛, 물은 연보라 (toon.js의 uDusk 색 보정)
//  밤은 노을 팔레트를 그대로 어둡게 (별·달, 가로등 불빛)
// ============================================================
// [시각, 안개(지평선), 하늘광, 땅광, 세기, 햇빛 색, 햇빛 세기, 그늘(환경광) 색, 환경광 세기, 노을, 밤]
const KEYS = [
  [0.0, '#4a3f78', '#8a80c8', '#2a2448', 1.0, '#b8b0ff', 0.55, '#3a3060', 0.35, 1, 1],
  [4.6, '#4a3f78', '#8a80c8', '#2a2448', 1.0, '#b8b0ff', 0.55, '#3a3060', 0.35, 1, 1],
  [5.4, '#8a74a8', '#b8a8d8', '#3a3158', 1.35, '#d8b8ff', 0.9, '#5a4a80', 0.35, 1, 0.65],
  [6.1, '#ffcfa6', '#ffd9c0', '#5b4a78', 1.9, '#ffb98a', 1.9, '#6a5a90', 0.4, 0.9, 0.1],
  [7.2, '#e2f4fb', '#ffffff', '#6aa84a', 1.8, '#fff1d6', 2.2, '#ffffff', 0.1, 0, 0],
  [16.6, '#e2f4fb', '#ffffff', '#6aa84a', 1.8, '#fff1d6', 2.2, '#ffffff', 0.1, 0, 0],
  [17.7, '#ffe2c0', '#ffeedd', '#7a8a58', 1.85, '#ffd2a0', 2.4, '#b8a8c8', 0.2, 0.55, 0],
  [18.4, '#ffcfa6', '#ffd9c0', '#5b4a78', 1.95, '#ffb98a', 2.8, '#6a5a90', 0.55, 1, 0],
  [19.3, '#e8b0a0', '#e8c0c0', '#4a3c6a', 1.6, '#ff9f80', 1.8, '#5a4a80', 0.5, 1, 0.35],
  [20.4, '#4a3f78', '#8a80c8', '#2a2448', 1.0, '#b8b0ff', 0.55, '#3a3060', 0.35, 1, 1],
  [24, '#4a3f78', '#8a80c8', '#2a2448', 1.0, '#b8b0ff', 0.55, '#3a3060', 0.35, 1, 1],
].map(([h, ...v]) => ({ h, hor: new THREE.Color(v[0]), hs: new THREE.Color(v[1]), hg: new THREE.Color(v[2]), hi: v[3], lc: new THREE.Color(v[4]), li: v[5], ac: new THREE.Color(v[6]), ai: v[7], dusk: v[8], night: v[9] }));

const SUNRISE = 6, SUNSET = 19;

// ---------- 하늘 그림 (원래 서울섬 배경 그대로, 1024×576을 절반 크기로) ----------
const SW = 512, SH = 288, S = 0.5;
function skyLayer(kind) {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  g.scale(S, S);
  const w = SW / S, h = SH / S;
  const stops = {
    day: [[0, '#6fc0ec'], [0.5, '#a9dcf4'], [1, '#d6eef8']],
    dusk: [[0, '#7A6BB5'], [0.42, '#E59FA8'], [0.78, '#FFC59C'], [1, '#FFD7AB']],
    night: [[0, '#1e1a44'], [0.5, '#3a3170'], [1, '#6a5aa0']],
  }[kind];
  const gr = g.createLinearGradient(0, 0, 0, h * 0.55);
  stops.forEach((st) => gr.addColorStop(st[0], st[1]));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (kind === 'day') {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    [[150, 62, 1], [470, 44, 1.2], [760, 84, 0.95], [940, 36, 0.7], [320, 120, 0.6]].forEach((cl) => {
      [[0, 0, 26], [26, -12, 32], [58, 0, 26], [30, 10, 26]].forEach((p) => { g.beginPath(); g.arc(cl[0] + p[0] * cl[2], cl[1] + p[1] * cl[2], p[2] * cl[2], 0, Math.PI * 2); g.fill(); });
    });
  } else if (kind === 'dusk') {
    const sg = g.createRadialGradient(230, 110, 10, 230, 110, 210);
    sg.addColorStop(0, 'rgba(255,240,200,0.95)'); sg.addColorStop(0.25, 'rgba(255,214,160,0.55)'); sg.addColorStop(1, 'rgba(255,200,160,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FFEBC0'; g.beginPath(); g.arc(230, 110, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,175,165,0.55)';
    [[620, 66, 170, 13], [820, 110, 120, 9], [430, 34, 110, 8], [920, 52, 90, 7]].forEach((cl) => { g.beginPath(); g.ellipse(cl[0], cl[1], cl[2], cl[3], 0, 0, Math.PI * 2); g.fill(); });
  } else {
    let a = 7; const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,250,235,${0.4 + r() * 0.6})`; g.beginPath(); g.arc(r() * w, r() * h * 0.5, 1 + r() * 2.2, 0, 7); g.fill(); }
    const mg = g.createRadialGradient(790, 96, 6, 790, 96, 90);
    mg.addColorStop(0, 'rgba(255,240,210,0.6)'); mg.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = mg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FFF1CF'; g.beginPath(); g.arc(790, 96, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,175,230,0.35)';
    [[560, 70, 150, 10], [300, 120, 110, 8]].forEach((cl) => { g.beginPath(); g.ellipse(cl[0], cl[1], cl[2], cl[3], 0, 0, Math.PI * 2); g.fill(); });
  }
  return c;
}

export class DayNight {
  constructor(world) {
    this.world = world;
    this.layers = { day: skyLayer('day'), dusk: skyLayer('dusk'), night: skyLayer('night') };
    this.sky = document.createElement('canvas'); this.sky.width = SW; this.sky.height = SH;
    this.skyTex = new THREE.CanvasTexture(this.sky); this.skyTex.colorSpace = THREE.SRGBColorSpace;
    world.scene.background = this.skyTex;
    this._a = {}; this.lastKey = '';
  }

  sample(h) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = THREE.MathUtils.smoothstep(h, a.h, b.h);
    const o = this._a;
    for (const key of ['hor', 'hs', 'hg', 'lc', 'ac']) (o[key] ||= new THREE.Color()).lerpColors(a[key], b[key], k);
    for (const key of ['hi', 'li', 'ai', 'dusk', 'night']) o[key] = a[key] + (b[key] - a[key]) * k;
    o.top = o.hor; // (예전 코드 호환)
    return o;
  }

  drawSky(dusk, night) {
    const key = `${dusk.toFixed(2)},${night.toFixed(2)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const g = this.sky.getContext('2d');
    g.globalAlpha = 1; g.drawImage(this.layers.day, 0, 0);
    if (dusk > 0) { g.globalAlpha = dusk; g.drawImage(this.layers.dusk, 0, 0); }
    if (night > 0) { g.globalAlpha = night; g.drawImage(this.layers.night, 0, 0); }
    g.globalAlpha = 1;
    this.skyTex.needsUpdate = true;
  }

  // 미니게임 무대: 시간대 빛을 약하게만 입힘 (게임하기 어렵지 않게, 땅 색 보정은 끔)
  applyMini(g, hour) {
    U.uDusk.value = 0;
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
    const s = this.sample(hour), ref = this.ref, K = 0.55;
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
    const sky = tmp.copy(s.hor);
    const mix = Math.min(0.75, 0.15 + 0.6 * Math.max(s.night, s.dusk));
    if (g._dn.bg) sc.background.copy(g._dn.bg).lerp(sky, mix);
    if (g._dn.fog) sc.fog.color.copy(g._dn.fog).lerp(sky, mix);
  }

  update(hour, t, camPos) {
    const w = this.world, s = this.sample(hour);
    w.scene.fog.color.copy(s.hor);
    w.scene.fog.near = 75 - 15 * s.dusk; w.scene.fog.far = 165 - 15 * s.dusk;
    w.hemi.color.copy(s.hs); w.hemi.groundColor.copy(s.hg); w.hemi.intensity = s.hi;
    w.sun.color.copy(s.lc); w.sun.intensity = s.li;
    w.amb.color.copy(s.ac); w.amb.intensity = s.ai;
    U.night.value = s.night;
    U.uDusk.value = s.dusk;
    U.uNight.value = s.night;
    w.setLamps?.(Math.max(s.dusk * 0.9, s.night));
    this.drawSky(s.dusk, s.night);

    // 빛 방향: 낮엔 해를 따라, 노을엔 원래 서울섬처럼 낮게 서쪽에서, 밤엔 달
    const day = (hour - SUNRISE) / (SUNSET - SUNRISE);
    const sa = THREE.MathUtils.clamp(day, 0, 1) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(sa), Math.max(0.45, Math.sin(sa) * 1.1), 0.55).normalize();
    const duskDir = new THREE.Vector3(-40, 16, -30).normalize();
    dir.lerp(duskDir, s.dusk * (1 - s.night)).normalize();
    w.sunOffset.copy(dir.multiplyScalar(30));
    void t; void camPos;
  }
}
