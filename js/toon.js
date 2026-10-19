// ============================================================
//  서울섬 그림체: 3단 툰 셰이딩 · 파스텔 색 · 둥근 상자 · 둥글게 휘는 지평선
//  모든 재질·상자는 여기서 만들어요 (월드·랜드마크·미니게임 공통)
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// 셰이더 공통 값
//  uCurve: 지평선이 둥글게 휘는 정도 (월드에서만 켜고 미니게임에선 0)
//  stOn/stP/stC: 캐릭터를 가리는 랜드마크·나무를 살짝 뚫어 보이게
export const U = {
  uCurve: { value: 0 },
  stP: { value: new THREE.Vector3() }, stC: { value: new THREE.Vector3() }, stOn: { value: 0 },
  night: { value: 0 },
  // 노을 색 보정 (원래 서울섬 '노을' 팔레트 쪽으로): 0 낮 ~ 1 노을·밤
  uDusk: { value: 0 }, uNight: { value: 0 },
  // 낮 색 부드럽게 (0 = 진한 그대로, 1 = 살짝 연하게). 노을·밤에는 영향 없음
  uDaySoft: { value: 1 },
};
export const WORLD_CURVE = 0.0016;

// 3단 그라데이션 (원래 서울섬과 같은 값)
let GRAD = null;
export function gradientMap() {
  if (GRAD) return GRAD;
  GRAD = new THREE.DataTexture(new Uint8Array([100, 180, 255]), 3, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
  return GRAD;
}

// ---------- 색: 진한 원색을 서울섬 파스텔 쪽으로 ----------
const _hsl = {}, _c = new THREE.Color();
export function soft(c, out = new THREE.Color()) {
  _c.set(c);
  _c.getHSL(_hsl, THREE.SRGBColorSpace);
  let { h, s, l } = _hsl;
  if (l < 0.2) { // 아주 어두운 색(눈·머리카락·타이어): 어둡게 두되 따뜻한 갈색 기운
    s = Math.min(s, 0.4); l = 0.07 + l * 0.75;
    if (s < 0.12) { h = 0.07; s = 0.3; }
  } else {
    s = Math.min(1, s * 1.1 + (s > 0.08 ? 0.03 : 0));
    if (s > 0.2) l = Math.min(l, 0.88); // 흰색·회색은 그대로 밝게
  }
  return out.setHSL(h, s, l, THREE.SRGBColorSpace);
}
export const softHex = (c) => `#${soft(c).getHexString(THREE.SRGBColorSpace)}`;

// ---------- 셰이더 패치 (휘는 지평선 + 투과) ----------
function patch(sh) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uCurve;\nvarying vec3 vStW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 stw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        stw = instanceMatrix * stw;
      #endif
      vStW = (modelMatrix * stw).xyz;
      mvPosition.y -= mvPosition.z * mvPosition.z * uCurve;
      gl_Position = projectionMatrix * mvPosition;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform vec3 stP; uniform vec3 stC; uniform float stOn; uniform float uDusk; uniform float uNight; uniform float uDaySoft; varying vec3 vStW;
      vec3 si_hsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }
      vec3 si_rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }`)
    .replace('#include <fog_fragment>', `
      #ifndef NO_GRADE
      float dayW = (1.0 - uDusk) * uDaySoft;
      if (dayW > 0.001) {
        vec3 hd = si_hsv(gl_FragColor.rgb);
        hd.y *= 1.0 - 0.2 * dayW;              // 채도를 조금 빼고
        hd.z += (1.0 - hd.z) * 0.07 * dayW;    // 살짝 밝게
        gl_FragColor.rgb = si_rgb(hd);
      }
      if (uDusk > 0.001) {
        vec3 hv = si_hsv(gl_FragColor.rgb);
        float gw = smoothstep(0.16, 0.24, hv.x) * (1.0 - smoothstep(0.42, 0.48, hv.x)); // 초록 → 올리브·황금빛
        float bw = smoothstep(0.45, 0.50, hv.x) * (1.0 - smoothstep(0.70, 0.76, hv.x)); // 파랑 → 연보라
        vec3 dv = hv;
        dv.x = mix(dv.x, mix(hv.x, 0.19, 0.6), gw); dv.y *= mix(1.0, 0.62, gw); dv.z = min(1.0, dv.z * mix(1.0, 1.12, gw));
        dv.x = mix(dv.x, 0.69, bw); dv.y *= mix(1.0, 0.55, bw);
        vec3 dc = si_rgb(dv) * vec3(1.0, 0.95, 0.9);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, dc, uDusk);
      }
      #endif
      #include <fog_fragment>`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (stOn > 0.5 && vStW.y > 0.35) {
        vec3 dd = stP - stC; float L = length(dd); vec3 n = dd / L;
        vec3 w = vStW - stC; float t = dot(w, n);
        if (t > 0.0 && t < L - 1.1) {
          float rr = length(w - n * t);
          vec2 g = floor(gl_FragCoord.xy * 0.5);
          if (rr < 1.4 || (rr < 2.3 && mod(g.x + g.y, 2.0) < 1.0)) discard;
        }
      }`);
}
export function stylize(m) {
  m.onBeforeCompile = patch;
  m.customProgramCacheKey = () => 'seoulisland-toon';
  return m;
}
// 빛을 받지 않는 재질(유리창 불빛·전광판)도 지평선은 같이 휘어야 해서
export function basic(params) { return stylize(new THREE.MeshBasicMaterial(params)); }

// ---------- 재질 ----------
const cache = new Map();
// toonMat(색) 또는 toonMat({ color, map, emissive, ... }) — MeshLambertMaterial 자리에 그대로 씀
export function toonMat(arg = {}, extra) {
  if (typeof arg === 'string' || typeof arg === 'number' || arg?.isColor) {
    const key = (arg.isColor ? arg.getHexString() : String(arg)) + (extra ? JSON.stringify(extra) : '');
    if (!extra && cache.has(key)) return cache.get(key);
    const m = toonMat({ color: arg, ...extra });
    if (!extra) cache.set(key, m);
    return m;
  }
  const p = { ...arg };
  if (p.color !== undefined && !p.vertexColors) p.color = soft(p.color);
  if (p.emissive !== undefined) p.emissive = new THREE.Color(p.emissive).multiplyScalar(0.8);
  delete p.flatShading; delete p.reflectivity; delete p.shininess; delete p.specular; delete p.roughness; delete p.metalness; delete p.envMap;
  const m = new THREE.MeshToonMaterial({ gradientMap: gradientMap(), ...p });
  return stylize(m);
}

// ---------- 둥근 상자 ----------
const gcache = new Map();
export function rbox(w, h, d) {
  const key = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
  let g = gcache.get(key);
  if (g) return g;
  const mn = Math.min(w, h, d);
  if (mn < 0.035) g = new THREE.BoxGeometry(w, h, d);
  else g = new RoundedBoxGeometry(w, h, d, 2, Math.min(mn * 0.3, 0.16));
  g.userData.shared = true;
  gcache.set(key, g);
  return g;
}

// 바닥에 깔리는 동그란 그림자 (원래 서울섬 방식: 그림자 맵 대신 부드러운 원)
let blobGeo = null, blobMat = null;
export function blobShadow(parent, r = 0.5, y = 0.03) {
  blobGeo ||= (() => { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; })();
  blobMat ||= stylize(new THREE.MeshBasicMaterial({ color: '#2c4a2a', transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.position.y = y; m.scale.set(r, 1, r); m.renderOrder = 1;
  parent.add(m);
  return m;
}
