// ============================================================
//  서울섬 텍스처: 캔버스로 그린 부드러운 무늬 (도트 X)
//  잔디 얼룩 · 깅엄 광장 · 줄무늬 천막 · 나무 판자 · Jua 글씨 표지판
// ============================================================
import * as THREE from 'three';
import { rng } from './rng.js';
import { softHex } from './toon.js';
export { rng };

export const FONT = 'Jua, "Gowun Dodum", sans-serif';

export function canvasTexture(canvas, repeat = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 바닥 색 (원래 서울섬 낮 팔레트)
export const GROUND = {
  grass: '#b8e39a', grassLt: '#c9eeb0', grassDk: '#9fd17f',
  sand: '#fff1d0', sandDk: '#f3e0b6',
  path: '#fbe8c8', pathDk: '#efd6ac',
  soil: '#d9a77c', soilDk: '#c48e63',
  plaza: '#fff6e6', plazaLine: 'rgba(255,170,190,0.38)',
  road: '#e9e1d6', roadDk: '#d8cfc2',
  bed: '#e8cfa0', forest: '#a6d88e',
};

// 16×16 바닥 조각 (미니게임 바닥 tileGround · 달리기 모래)
export function drawTile(ctx, ox, oy, type, r) {
  const G = GROUND;
  const base = { grass: G.grass, sand: G.sand, path: G.path, soil: G.soil, bed: G.bed, plaza: G.plaza, road: G.road }[type] || G.grass;
  ctx.fillStyle = base; ctx.fillRect(ox, oy, 16, 16);
  const blob = (col, a, rw, rh) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(ox + r() * 16, oy + r() * 16, rw, rh, r() * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };
  if (type === 'grass') {
    blob(G.grassLt, 0.6, 3 + r() * 3, 2 + r() * 2);
    ctx.strokeStyle = G.grassDk; ctx.lineWidth = 1; ctx.lineCap = 'round';
    if (r() < 0.6) { const x = ox + 2 + r() * 12, y = oy + 3 + r() * 10; ctx.beginPath(); ctx.moveTo(x - 1.5, y); ctx.lineTo(x - 0.5, y + 2.5); ctx.moveTo(x + 1.5, y); ctx.lineTo(x + 0.5, y + 2.5); ctx.stroke(); }
    if (r() < 0.05) { ctx.fillStyle = ['#ffffff', '#ffd166', '#ff8fa3'][(r() * 3) | 0]; ctx.beginPath(); ctx.arc(ox + 3 + r() * 10, oy + 3 + r() * 10, 1.4, 0, 7); ctx.fill(); }
  } else if (type === 'sand') {
    blob(G.sandDk, 0.5, 2 + r() * 2, 1 + r());
  } else if (type === 'path' || type === 'road') {
    blob(type === 'path' ? G.pathDk : G.roadDk, 0.55, 2.5 + r() * 2, 2 + r() * 1.5);
  } else if (type === 'soil') {
    ctx.strokeStyle = G.soilDk; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let y = 3; y < 16; y += 5) { ctx.beginPath(); ctx.moveTo(ox + 1, oy + y); ctx.lineTo(ox + 15, oy + y); ctx.stroke(); }
  } else if (type === 'plaza') {
    ctx.fillStyle = G.plazaLine;
    ctx.fillRect(ox, oy, 8, 16); ctx.fillRect(ox, oy, 16, 8);
  }
}

export function dirtSideTexture() {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.fillStyle = '#f3e0b6'; ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = GROUND.grass; ctx.fillRect(0, 0, 32, 7);
  return canvasTexture(c, true);
}

export function waterTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  const r = rng(3);
  ctx.fillStyle = '#8fd8e8'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const x = r() * 100, y = 6 + r() * 116; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10 + r() * 18, y); ctx.stroke(); }
  return canvasTexture(c, true);
}

export function plankTexture(base = '#e9b98f', dark = '#c99468', light = '#f3cfa8') {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = softHex(base); ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = softHex(dark);
  for (let y = 15; y < 64; y += 16) ctx.fillRect(0, y, 64, 2);
  for (let row = 0; row < 4; row++) ctx.fillRect((row * 27) % 64, row * 16, 2, 15);
  ctx.globalAlpha = 0.5; ctx.fillStyle = softHex(light);
  for (let row = 0; row < 4; row++) ctx.fillRect(6 + row * 11, row * 16 + 5, 14, 2);
  ctx.globalAlpha = 1;
  return canvasTexture(c, true);
}

// 분홍 기와 (원래 서울섬 단독주택 지붕 색)
export function roofTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#ff9fb0'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#f08a9e';
  for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < 64; x += 32) { ctx.beginPath(); ctx.arc(x + 16, y + 16, 15, 0, Math.PI); ctx.fill(); }
  return canvasTexture(c, true);
}

export function stripeTexture(a = '#ff8fa3', b = '#ffffff') {
  const [c, ctx] = makeCanvas(64, 16);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? softHex(b) : softHex(a); ctx.fillRect(i * 16, 0, 16, 16); }
  return canvasTexture(c, true);
}

// 표지판: 둥근 크림색 판 + 나무 테두리 + Jua 글씨 (작은 크기로 불러도 4배로 크게 그림)
export function signTexture(text, { w = 128, h = 48, bg = '#fff6dc', fg = '#6b4f2e', size = 16 } = {}) {
  const S = 4, [c, ctx] = makeCanvas(w * S, h * S);
  ctx.scale(S, S);
  const plain = bg === '#c98a46' || bg === '#fff6dc';
  ctx.fillStyle = plain ? '#fff6dc' : softHex(bg); ctx.fillRect(0, 0, w, h);
  const bw = Math.max(2, Math.min(w, h) * 0.07);
  ctx.strokeStyle = plain ? '#d8b88a' : 'rgba(107,79,46,0.35)'; ctx.lineWidth = bw;
  rrect(ctx, bw / 2, bw / 2, w - bw, h - bw, Math.min(w, h) * 0.18); ctx.stroke();
  ctx.fillStyle = fg === '#3f1d0b' ? '#6b4f2e' : fg;
  ctx.font = `${size * 1.08}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((ln, i) => {
    const y = h / 2 + (i - (lines.length - 1) / 2) * (size + 2) + 1;
    const mw = ctx.measureText(ln).width, sx = Math.min(1, (w - bw * 3) / mw);
    ctx.save(); ctx.translate(w / 2, y); ctx.scale(sx, 1); ctx.fillText(ln, 0, 0); ctx.restore();
  });
  return canvasTexture(c);
}

// 랜드마크 외벽 (부드러운 창문 무늬)
export function wallTexture(kind) {
  const [c, ctx] = makeCanvas(64, 64);
  const P = {
    brick: ['#f2b8a0', '#e8a58c', '#bfe6f7'], tan: ['#f5dcbc', '#e9c9a0', '#bfe6f7'], stucco: ['#fff8ec', '#f1e6d4', '#bfe6f7'],
    apt: ['#fff8ec', '#efe6d8', '#bfe6f7'], glass: ['#bfe0f5', '#a6d0ec', '#e6f6ff'], glass2: ['#bfeee6', '#a5dcd5', '#e9fffb'], glass3: ['#d8e4ef', '#c2d2e2', '#f2f8ff'],
    hanok: ['#fff8ec', '#c99468', '#f6e3c0'], stone: ['#ece4d6', '#ddd2c0', '#9bb4c8'],
  }[kind] || ['#fff8ec', '#efe6d8', '#bfe6f7'];
  ctx.fillStyle = P[0]; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = P[1]; ctx.fillRect(0, 30, 64, 4); ctx.fillRect(0, 62, 64, 2);
  for (const fy of [6, 38]) for (const fx of [8, 38]) { ctx.fillStyle = P[2]; rrect(ctx, fx, fy, 18, 18, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(fx + 4, fy + 4, 4, 8); }
  return canvasTexture(c, true);
}

export function giwaTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#8b9ab0'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#7a8aa2'; for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 5, 64);
  return canvasTexture(c, true);
}
