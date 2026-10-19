import * as THREE from 'three';
import { Avatar, drawPortrait, validLook, defaultLook, TYPES, SKIN_TONES, HAIR_COLORS, FUR_COLORS, CLOTH_COLORS } from './character.js';
import { World } from './world.js';
import { DayNight } from './daynight.js';
import { buildSubway, STATIONS, LINE2 } from './subway.js';
import { buildPiers, WaterTaxi } from './watertaxi.js';
import { GAMES } from './minigames/index.js';
import { sfx } from './sfx.js';
import { Tour } from './tour.js';
import { U, WORLD_CURVE } from './toon.js';

const $ = (id) => document.getElementById(id);

// ---------- 저장 (브라우저 localStorage, 실패해도 게임은 동작) ----------
const SAVE_KEY = 'seoul-island-save-v1';
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } }
const save = Object.assign({ name: '', look: null, coins: 0, best: {}, dex: {}, stamps: {} }, loadSave());
if (!validLook(save.look)) save.look = defaultLook();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 무시 */ } }

// ---------- 렌더러 ----------
const canvas = $('view');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch { $('loading').textContent = '이 브라우저에서는 3D(WebGL)를 켤 수 없어요'; throw new Error('WebGL'); }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; // 미니게임 무대만 그림자를 씀 (월드는 동그란 그림자)
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);

await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
await document.fonts.load('20px Jua').catch(() => {});
await new Promise((r) => setTimeout(r, 50)); // "불러오는 중"이 먼저 보이게 (탭이 가려져 있어도 멈추지 않게 rAF 대신 타이머)
const world = new World();
const dayNight = new DayNight(world);
buildSubway(world);
buildPiers(world);
const taxi = new WaterTaxi(world);
world.finishTrees();
$('loading').classList.add('hidden');

const games = {};
let mini = null, miniEntry = null;
function getGame(id) {
  if (!games[id]) { games[id] = new GAMES[id]({ onEnd: showResult, onFloat: floatText, ctx: { save, persist, world } }); games[id].resize(innerWidth / innerHeight); }
  return games[id];
}

let mode = 'make';
let avatar = null, player = null;
let vy = 0, airborne = false, yaw = 0;
const keys = new Set();
let gameMinutes = 7 * 60;
let dialog = null, subway = null, cab = null, tour = null;
let nearest = null, goal = null, stepT = 0, hint = true;

// ---------- 주민 등록 (꾸미기) ----------
const look = { ...save.look };
function chips(el, list, key, render = (v) => `<i style="background:${v}"></i>`) {
  el.innerHTML = list.map((v) => { const val = typeof v === 'string' ? v : v.id; return `<button type="button" class="chip${look[key] === val ? ' on' : ''}" data-v="${val}" title="${v.label || val}">${render(v)}</button>`; }).join('');
  el.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; look[key] = b.dataset.v; sfx.click(); refreshMake(); };
}
function refreshMake() {
  chips($('optType'), TYPES, 'type', (t) => t.label);
  chips($('optSkin'), SKIN_TONES, 'skin');
  chips($('optHair'), HAIR_COLORS, 'hair');
  chips($('optFur'), FUR_COLORS, 'fur');
  chips($('optShirt'), CLOTH_COLORS, 'shirt');
  chips($('optPants'), CLOTH_COLORS, 'pants');
  const human = look.type === 'human';
  $('rowSkin').classList.toggle('hidden', !human); $('rowHair').classList.toggle('hidden', !human); $('rowFur').classList.toggle('hidden', human);
  look.hat = human;
  drawPortrait(look, $('makeFace'));
  rebuildPlayer();
}
$('nameInput').value = save.name || '';
$('enterWorld').onclick = () => {
  sfx.unlock(); sfx.open();
  save.look = { ...look }; save.name = $('nameInput').value.trim() || '주민';
  persist();
  transition(() => { setMode('world'); resetView(); snapCamera(); setTimeout(() => toast(`${save.name}, 서울섬에 온 걸 환영해요!`), 500); });
};

$('retryMini').onclick = () => { sfx.click(); $('resultScreen').classList.add('hidden'); mini.start(); };
$('exitMini').onclick = () => { sfx.click(); backToIsland(); };
$('quitMini').onclick = () => {
  if (mode !== 'mini' || mini.state === 'done') return;
  sfx.click(); mini.quit();
  toast('게임을 그만뒀어요. 이번 판 보상은 없어요');
  backToIsland();
};
function backToIsland() {
  transition(() => {
    const r = miniEntry?.ret || [world.spawn.x, world.spawn.z];
    player.position.set(r[0], 0, r[1]);
    setMode('world'); snapCamera();
  });
}

function transition(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 380);
}

// 꾸미기 화면: 캐릭터와 카메라 사이를 가리는 것(역 입구·표지판)이 없는 방향을 고름 (남쪽부터)
let makeYaw = 0;
function pickMakeYaw() {
  const p = world.spawn;
  for (let i = 0; i < 32; i++) {
    const a = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.2;
    let clear = true;
    for (let d = 0.8; d <= 5.6 && clear; d += 0.4) if (!world.canWalk(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 0.5)) clear = false;
    if (clear) return a;
  }
  return 0;
}
makeYaw = pickMakeYaw();

function rebuildPlayer() {
  const pos = player ? player.position.clone() : world.spawn.clone();
  const ry = player ? player.rotation.y : 0;
  if (avatar) avatar.dispose();
  avatar = new Avatar(mode === 'make' ? look : save.look, { height: 1.7 });
  player = avatar.root;
  player.position.copy(pos); player.rotation.y = ry;
  world.scene.add(player);
}

function setMode(m) {
  const prev = mode;
  mode = m;
  $('makeScreen').classList.toggle('hidden', m !== 'make');
  $('hud').classList.toggle('hidden', m !== 'world');
  $('miniHud').classList.toggle('hidden', m !== 'mini');
  $('resultScreen').classList.add('hidden');
  $('countdown').classList.add('hidden');
  closeDialog();
  U.uCurve.value = m === 'mini' ? 0 : WORLD_CURVE;
  if (m === 'mini') U.stOn.value = 0; // 월드의 '가리면 뚫어 보이기'가 미니게임 무대에 남지 않게
  if (m === 'make') { player?.position.copy(world.spawn); refreshMake(); }
  if (m === 'world') {
    if (prev === 'make') rebuildPlayer();
    player.visible = true;
    $('hudCoins').textContent = save.coins.toLocaleString();
  }
  if (m === 'mini') { mini.setPlayer(save.look); mini.start(); }
  if (m !== 'mini') $('miniOverlay').innerHTML = '';
  if (prev === 'mini' && m !== 'mini') mini?.leave?.();
}

// ---------- 입력 ----------
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (MOVE_KEYS.includes(e.code)) { goal = null; hideHint(); }
  if (mode === 'world' && tour) {
    if (['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code) && !e.repeat) { e.preventDefault(); tour.skip(); }
  } else if (mode === 'world' && subway) {
    const mm = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (mm) { const b = $('subwayLoop').querySelector(`[data-key="${mm[2]}"]`); if (b) b.click(); }
    if (e.code === 'Escape') closeSubway();
  } else if (mode === 'world') {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (dialog?.choice && dialog.shown >= dialog.lines[dialog.i].length && dialog.i === dialog.lines.length - 1) {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { dialog.pick = 1 - dialog.pick; renderChoice(); return; }
      if (e.code === 'Escape' || e.code === 'Digit2') { choose('no'); return; }
      if (e.code === 'Digit1') { choose('yes'); return; }
    }
    if (e.code === 'Space' && !e.repeat) { if (dialog) interact(); else if (!taxi.riding) jump(); }
    if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) interact();
    if (e.code === 'KeyR' && !e.repeat && !dialog) { resetView(); toast('시점을 처음대로 돌렸어요'); }
    if (e.code === 'KeyM' && !e.repeat) mmToggle();
    if (e.code === 'KeyT' && !e.repeat && !dialog) openCab();
    if (e.code === 'Escape') { if (dialog) closeDialog(); else if (mm2Big()) mmToggle(); else if (taxi.riding) toast('선착장에서 E를 눌러 내린 다음 나갈 수 있어요'); else transition(() => setMode('make')); }
  } else if (mode === 'mini') {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    const resultOpen = !$('resultScreen').classList.contains('hidden');
    if (e.code === 'Enter' && resultOpen) $('exitMini').click();
    else if (e.code === 'Escape' && !resultOpen) $('quitMini').click();
    else if (!e.repeat && !resultOpen && mini.state !== 'choose') mini.keyDown(e.code);
  }
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (mode === 'mini') mini.keyUp(e.code); });
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => {
  if (e.target === mm) return;
  if (mode === 'world' && e.target === canvas) cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.01, 7, 28);
}, { passive: true });
addEventListener('pointermove', (e) => { if (mode === 'mini') mini.pointer(e, innerWidth, innerHeight); });
canvas.addEventListener('pointerdown', (e) => { if (mode === 'mini' && e.button === 0) mini.pointerDown(e, innerWidth, innerHeight); });
addEventListener('pointerup', (e) => { if (mode === 'mini') mini.pointerUp(e, innerWidth, innerHeight); });
$('dialogText').onclick = () => { interact(); canvas.focus({ preventScroll: true }); };
$('prompt').onclick = () => { interact(); canvas.focus({ preventScroll: true }); };
$('dialogChoice').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) choose(b.dataset.c); };
document.querySelectorAll('#pad button').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); keys.add(k); goal = null; hideHint(); };
  const off = () => keys.delete(k);
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
function hideHint() { if (hint) { hint = false; $('hint').classList.add('hidden'); } }

// ---------- 대화창 (원래 서울섬 말풍선 + 이름표) ----------
function openDialog(it) {
  dialog = { name: it.name || it.host?.name, lines: it.lines || it.host.lines, i: 0, shown: 0, choice: it.kind === 'minigame' ? it : null, pick: 0 };
  $('dialog').classList.remove('hidden');
  $('dialogName').textContent = dialog.name;
  $('dialogName').style.background = it.tag || it.host?.tag || '#C9A77A';
  $('dialogText').textContent = '';
  $('dialogChoice').classList.add('hidden');
  $('prompt').classList.add('hidden');
}
function closeDialog() { dialog = null; $('dialog').classList.add('hidden'); }
function renderChoice() { $('dialogChoice').querySelectorAll('.choice').forEach((b, i) => b.classList.toggle('on', i === dialog.pick)); }
function choose(c) {
  const it = dialog?.choice;
  closeDialog();
  if (c === 'yes' && it) { sfx.open(); miniEntry = it; mini = getGame(it.game); transition(() => setMode('mini')); }
  else { sfx.click(); toast('다음에 또 놀자!'); }
}

function interact() {
  if (dialog) {
    const line = dialog.lines[dialog.i];
    if (dialog.shown < line.length) { dialog.shown = line.length; return; }
    if (dialog.choice && dialog.i === dialog.lines.length - 1) { choose(dialog.pick ? 'no' : 'yes'); return; }
    dialog.i++; dialog.shown = 0;
    if (dialog.i >= dialog.lines.length) closeDialog();
    sfx.click();
    return;
  }
  if (!nearest) return;
  goal = null;
  if (nearest.kind === 'dialog') { sfx.click(); openDialog(nearest); }
  if (nearest.kind === 'subway') { sfx.open(); openSubway(nearest.station); }
  if (nearest.kind === 'watertaxi') {
    const pier = world.piers.find((p) => p.id === nearest.pier);
    sfx.open(); taxi.board(pier); airborne = false; vy = 0;
    toast('수상택시 출발! WASD 운전 · Shift 가속 · 선착장 앞에서 E 내리기');
  }
  if (nearest.kind === 'leaveTaxi') {
    const [x, z] = taxi.leave(nearest.pier);
    player.position.set(x, 0, z); player.rotation.set(0, 0, 0);
    sfx.open(); toast(`${nearest.pier.name} 선착장에 내렸어요`);
  }
  if (nearest.kind === 'tour') startTour();
  if (nearest.kind === 'minigame') {
    if (nearest.host) { sfx.click(); openDialog(nearest); return; }
    sfx.open(); miniEntry = nearest; mini = getGame(nearest.game);
    transition(() => setMode('mini'));
  }
}

// ---------- 지하철 2호선 ----------
const LOOP_POS = { hongdae: [18, 22], cityhall: [50, 22], wangsimni: [82, 22], jamsil: [82, 78], gangnam: [50, 78], sindorim: [18, 78] };
function openSubway(from) {
  subway = { from };
  keys.clear();
  const here = STATIONS.find((s) => s.id === from);
  $('subwayHere').textContent = here.name;
  let n = 0;
  $('subwayLoop').innerHTML = '<div class="loop-line"></div>' + world.stations.map((s) => {
    const [l, t] = LOOP_POS[s.id], cur = s.id === from;
    const key = cur ? '' : ++n;
    return `<button type="button" class="stop${cur ? ' here' : ''}" style="left:${l}%;top:${t}%" ${cur ? 'disabled' : `data-go="${s.id}" data-key="${key}"`}>
      <i></i><b>${s.name}</b><small>${cur ? '현재 위치' : `${key} · ${travelMinutes(here, s)}분`}</small><em>${s.near}</em></button>`;
  }).join('');
  $('subwayPanel').classList.remove('hidden');
}
function closeSubway() { subway = null; $('subwayPanel').classList.add('hidden'); }
$('subwayClose').onclick = () => { sfx.click(); closeSubway(); };
$('subwayLoop').onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) rideTo(b.dataset.go); };
function travelMinutes(a, b) {
  const order = STATIONS.map((s) => s.id), N = order.length, i = order.indexOf(a.id), j = order.indexOf(b.id);
  return 10 + Math.min((i - j + N) % N, (j - i + N) % N) * 10;
}
function rideTo(id) {
  if (!subway) return;
  const from = world.stations.find((s) => s.id === subway.from), to = world.stations.find((s) => s.id === id);
  closeSubway(); sfx.click();
  const tv = $('travel');
  $('travelText').innerHTML = `<span class="line2-badge">2</span> ${from.name} → <b>${to.name}</b><br><small>이번 역은 ${to.name}, ${to.name}역입니다</small>`;
  transition(() => {
    tv.classList.remove('hidden');
    player.position.set(to.exit[0], 0, to.exit[1]);
    yaw = 0; player.rotation.y = 0; goal = null;
    gameMinutes = (gameMinutes + travelMinutes(from, to)) % (24 * 60);
    snapCamera();
    let beeps = 0; const tick = setInterval(() => { sfx.tick(); if (++beeps >= 3) clearInterval(tick); }, 420);
    setTimeout(() => transition(() => { tv.classList.add('hidden'); sfx.open(); toast(`${to.name}역에 도착했어요!`); }), 1700);
  });
}

// ---------- 택시 ----------
// 요금: 걸어서 1초 걸리는 거리마다 1벨 (직선거리, 최소 5벨)
const WALK_SPEED = 4.2, CAB_MIN_FARE = 5;
const cabFare = (d) => Math.max(CAB_MIN_FARE, Math.ceil(d / WALK_SPEED));
function cabPlaces() {
  const out = [];
  for (const p of world.landmarkPins) out.push({ cat: '명소', name: p.name, x: p.x, z: p.z });
  for (const it of world.interactables) if (it.kind === 'minigame') out.push({ cat: '놀이', name: it.title || it.label, x: it.ret?.[0] ?? it.x, z: it.ret?.[1] ?? it.z });
  for (const s of world.stations || []) out.push({ cat: '지하철', name: `${s.name}역`, x: s.exit[0], z: s.exit[1] });
  for (const p of world.piers || []) out.push({ cat: '수상택시', name: `${p.name} 선착장`, x: p.land[0], z: p.land[1] });
  return out;
}
function openCab() {
  if (cab || subway || tour) return;
  if (taxi.riding) { toast('수상택시에서 내린 다음 택시를 부를 수 있어요'); return; }
  closeDialog(); keys.clear(); sfx.open();
  cab = { all: cabPlaces(), list: [], sel: 0 };
  $('cabPanel').classList.remove('hidden');
  $('cabSearch').value = '';
  renderCab();
  setTimeout(() => $('cabSearch').focus(), 0);
}
function closeCab() { cab = null; $('cabPanel').classList.add('hidden'); $('cabSearch').blur(); }
function renderCab() {
  const norm = (s) => s.replace(/\s/g, '').toLowerCase();
  const q = norm($('cabSearch').value), p = player.position;
  cab.list = cab.all
    .filter((d) => !q || norm(d.name).includes(q) || d.cat.includes(q))
    .map((d) => { const dist = Math.hypot(d.x - p.x, d.z - p.z); return { ...d, dist, fare: cabFare(dist) }; })
    .sort((a, b) => a.dist - b.dist);
  cab.sel = Math.min(cab.sel, Math.max(0, cab.list.length - 1));
  $('cabList').innerHTML = cab.list.length ? cab.list.map((d, i) => {
    const near = d.dist < 6, poor = d.fare > save.coins;
    const why = near ? '바로 근처예요' : poor ? '벨이 모자라요' : '';
    return `<button type="button" class="cab-row${i === cab.sel ? ' sel' : ''}" data-i="${i}" ${near || poor ? 'disabled' : ''}>
      <em class="cat-${d.cat}">${d.cat}</em><b>${d.name}</b>
      <span>${why || `걸어서 ${Math.round(d.dist / WALK_SPEED)}초`}</span><i class="coin"></i><strong>${d.fare}</strong></button>`;
  }).join('') : '<p class="cab-empty">찾는 곳이 없어요</p>';
  $('cabList').querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
function rideCab(d) {
  if (!cab || !d) return;
  if (d.dist < 6) { toast('바로 근처예요. 걸어가 봐요!'); return; }
  if (d.fare > save.coins) { sfx.miss(); toast(`벨이 ${d.fare - save.coins}개 모자라요`); return; }
  closeCab();
  save.coins -= d.fare; persist(); $('hudCoins').textContent = save.coins.toLocaleString();
  sfx.coin();
  let spot = [d.x, d.z];
  for (let r = 0; r <= 4; r += 0.5) {
    const n = Math.max(1, Math.round(r * 6)); let ok = false;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r; if (world.canWalk(x, z, 0.4)) { spot = [x, z]; ok = true; break; } }
    if (ok) break;
  }
  const tv = $('travel');
  $('travelText').innerHTML = `🚕 <b>${d.name}</b>(으)로 가는 중…<br><small>요금 ${d.fare}벨을 냈어요</small>`;
  transition(() => {
    tv.classList.add('cab'); tv.classList.remove('hidden');
    player.position.set(spot[0], 0, spot[1]); airborne = false; vy = 0; goal = null;
    gameMinutes = (gameMinutes + Math.max(10, Math.round(d.dist / WALK_SPEED / 30) * 10)) % (24 * 60);
    snapCamera();
    setTimeout(() => transition(() => { tv.classList.add('hidden'); tv.classList.remove('cab'); sfx.open(); toast(`🚕 ${d.name}에 도착했어요! (-${d.fare}벨)`); }), 1500);
  });
}
$('cabBtn').onclick = () => { sfx.click(); if (mode === 'world') (cab ? closeCab() : openCab()); };
$('cabClose').onclick = () => { sfx.click(); closeCab(); };
$('cabSearch').oninput = () => { if (cab) { cab.sel = 0; renderCab(); } };
$('cabSearch').onkeydown = (e) => {
  if (!cab) return;
  if (e.code === 'Escape') { closeCab(); return; }
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { e.preventDefault(); cab.sel = Math.max(0, Math.min(cab.list.length - 1, cab.sel + (e.code === 'ArrowDown' ? 1 : -1))); renderCab(); }
  if (e.code === 'Enter' && !e.isComposing) { e.preventDefault(); rideCab(cab.list[cab.sel]); }
};
$('cabList').onclick = (e) => { const b = e.target.closest('[data-i]'); if (b && !b.disabled) rideCab(cab.list[+b.dataset.i]); };

// ---------- 결과 · 연출 ----------
function showResult({ id, title, score, coins, rows }) {
  if (typeof save.best !== 'object' || !save.best) save.best = {};
  const prevBest = save.best[id] || 0, isBest = score > prevBest;
  save.best[id] = Math.max(prevBest, score);
  save.coins += coins;
  persist();
  $('resultTitle').textContent = title;
  $('resultRows').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('rScore').textContent = score;
  $('rBest').textContent = isBest && score > 0 ? '최고 기록!' : `(최고 ${save.best[id]})`;
  $('rCoins').textContent = coins;
  setTimeout(() => { $('resultScreen').classList.remove('hidden'); if (coins > 0) sfx.coin(); }, 700);
}
function floatText(pos, text, cls, cam) {
  const v = pos.clone().project(cam);
  const el = document.createElement('div');
  el.className = `floater ${cls || ''}`;
  el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  $('floaters').appendChild(el);
  setTimeout(() => el.remove(), 950);
}
let toastT;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ---------- 카메라 (원래 서울섬: 플레이어 뒤 위에서 내려다봄) ----------
const cam = { yaw: 0, pitch: 0.55, dist: 14, target: new THREE.Vector3() };
function placeCamera() {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + sp * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  camera.lookAt(cam.target.x, cam.target.y + 0.4, cam.target.z);
}
function snapCamera() { cam.target.set(player.position.x, player.position.y + 1, player.position.z); placeCamera(); }
function resetView() { cam.yaw = 0; cam.pitch = 0.55; cam.dist = 14; }

const drag = { on: false, x: 0, y: 0, sx: 0, sy: 0, t: 0 };
canvas.addEventListener('pointerdown', (e) => {
  canvas.focus({ preventScroll: true });
  if (mode !== 'world') return;
  Object.assign(drag, { on: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  canvas.classList.add('grabbing');
  hideHint();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag.on) return;
  cam.yaw -= (e.clientX - drag.x) * 0.006;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - drag.y) * 0.004, 0.25, 1.15);
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = (e) => {
  if (!drag.on) return;
  drag.on = false; canvas.classList.remove('grabbing');
  if (e.type === 'pointerup' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6 && performance.now() - drag.t < 500) clickMove(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 땅 클릭 → 그곳으로 걷기 (휘는 지평선을 따라 광선을 조금씩 내려 보냄)
function clickMove(cx, cy) {
  if (taxi.riding || dialog || subway || cab || tour) { if (dialog) interact(); return; }
  const rc = canvas.getBoundingClientRect();
  camera.updateMatrixWorld();
  const v = new THREE.Vector3((cx - rc.left) / rc.width * 2 - 1, -((cy - rc.top) / rc.height * 2 - 1), 0.5).applyMatrix4(camera.projectionMatrixInverse).normalize();
  const c = U.uCurve.value, q = new THREE.Vector3();
  const wy = (t) => { const z = v.z * t; q.set(v.x * t, v.y * t + c * z * z, z).applyMatrix4(camera.matrixWorld); return q.y; };
  let prev = 0.5, hit = -1;
  for (let t = 0.5; t < 260; t += 0.5) { if (wy(t) <= 0.05) { hit = t; break; } prev = t; }
  if (hit < 0) return;
  let lo = prev, hi = hit;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (wy(m) <= 0.05) hi = m; else lo = m; }
  wy(hi);
  goal = { x: q.x, z: q.z, t: 0 };
  marker.visible = true; marker.position.set(q.x, 0.08, q.z);
}
const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.9, depthWrite: false }));
marker.visible = false; marker.renderOrder = 2; world.scene.add(marker);

function jump() { if (airborne) return; airborne = true; vy = 8.2; sfx.jump(); }

let lastZone = '', lastArea = '', zoneT = 0;
function updateWorld(dt, t) {
  const mv = new THREE.Vector3();
  if (taxi.riding) {
    const b = taxi.update(dt, t, dialog ? new Set() : keys, cam.yaw);
    yaw = b.heading;
    player.position.set(b.x - Math.sin(b.heading) * 0.55, b.y, b.z - Math.cos(b.heading) * 0.55);
    player.visible = b.sink < 0.6;
  } else if (!dialog && !subway && !cab) {
    let f = 0, r = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    mv.set(-sy * f + cy * r, 0, -cy * f - sy * r);
    if (!mv.lengthSq() && goal) {
      const gx = goal.x - player.position.x, gz = goal.z - player.position.z, gl = Math.hypot(gx, gz);
      if (gl < 0.35) goal = null; else mv.set(gx, 0, gz);
    }
  }
  const moving = mv.lengthSq() > 0;
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (moving) {
    mv.normalize().multiplyScalar((run ? 9 : 5) * dt);
    const p = player.position, ox = p.x, oz = p.z;
    if (world.canWalk(p.x + mv.x, p.z)) p.x += mv.x;
    if (world.canWalk(p.x, p.z + mv.z)) p.z += mv.z;
    if (goal) { if (Math.hypot(p.x - ox, p.z - oz) < mv.length() * 0.25) { goal.t += dt; if (goal.t > 0.5) goal = null; } else goal.t = 0; }
    yaw = Math.atan2(mv.x, mv.z);
    stepT -= dt;
    if (stepT <= 0 && !airborne) { sfx.step(); stepT = run ? 0.22 : 0.32; }
  }
  if (!goal) marker.visible = false; else { const s = 1 + Math.sin(t * 8) * 0.15; marker.scale.set(s, 1, s); }
  if (!taxi.riding) {
    const gy = world.groundY(player.position.x, player.position.z);
    if (airborne) {
      vy -= 26 * dt; player.position.y += vy * dt;
      if (player.position.y <= gy) { player.position.y = gy; vy = 0; airborne = false; sfx.step(); }
    } else player.position.y = gy;
    player.visible = true;
  }
  avatar.animate(dt, t, { moving, run, air: airborne && !taxi.riding, yaw });
  world.update(dt, t, player.position, camera);

  cam.target.lerp(new THREE.Vector3(player.position.x, player.position.y + 1, player.position.z), 1 - Math.exp(-dt * 6));
  placeCamera();

  // 가장 가까운 상호작용 대상 → 아래쪽 E 알약
  nearest = null;
  let best = Infinity;
  if (taxi.riding) {
    const p = taxi.nearPier();
    if (p) nearest = { x: p.boatAt[0], z: p.boatAt[1], label: `내리기 (${p.name} 선착장)`, kind: 'leaveTaxi', pier: p };
  } else for (const it of world.interactables) {
    const d = Math.hypot(it.x - player.position.x, it.z - player.position.z);
    if (d < it.r && d < best) { best = d; nearest = it; }
  }
  const show = nearest && !dialog && !subway && !cab;
  $('prompt').classList.toggle('hidden', !show);
  if (show && $('promptT').textContent !== nearest.label) $('promptT').textContent = nearest.label;

  if (dialog) {
    const line = dialog.lines[dialog.i];
    if (dialog.shown < line.length) {
      const before = Math.floor(dialog.shown);
      dialog.shown = Math.min(line.length, dialog.shown + dt * 40);
      if (Math.floor(dialog.shown) !== before && before % 3 === 0) sfx.talk();
    }
    $('dialogText').textContent = line.slice(0, Math.floor(dialog.shown));
    const ask = dialog.choice && dialog.i === dialog.lines.length - 1 && dialog.shown >= line.length;
    $('dialogChoice').classList.toggle('hidden', !ask);
  }

  zoneT += dt;
  if (zoneT > 0.2) {
    zoneT = 0;
    const p = player.position;
    let zone = world.placeName(p.x, p.z);
    let bd = 9;
    for (const l of world.landmarkPins) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bd) { bd = d; zone = l.name; } }
    const area = world.areaName(p.x, p.z);
    if (zone !== lastZone) { lastZone = zone; $('zone').textContent = zone; }
    if (area !== lastArea) { lastArea = area; $('area').textContent = area; }
  }
  drawMinimap();
  tickClock(dt);
}

// ---------- 팔각정 망원경 ----------
function startTour() {
  sfx.open(); keys.clear();
  $('prompt').classList.add('hidden');
  $('hud').classList.add('hidden');
  const home = world.interactables.find((i) => i.kind === 'tour');
  tour = new Tour(camera, home, { pos: camera.position.clone(), look: new THREE.Vector3(cam.target.x, cam.target.y + 0.4, cam.target.z) });
  U.uCurve.value = WORLD_CURVE * 0.35; // 하늘에서 내려다볼 땐 덜 휘게
}
function updateTour(dt, t) {
  avatar.animate(dt, t, { yaw: Math.PI });
  world.update(dt, t, null, null);
  tickClock(dt);
  if (tour.update(dt)) endTour();
}
function endTour() {
  tour.dispose(); tour = null;
  U.uCurve.value = WORLD_CURVE;
  $('hud').classList.remove('hidden');
  snapCamera();
  if (dayNight.sample(gameMinutes / 60).night > 0.5) {
    if (!save.stamps?.nightView) {
      save.stamps = { ...save.stamps, nightView: true }; save.coins += 50; persist();
      $('hudCoins').textContent = save.coins.toLocaleString(); sfx.gold();
      toast('🌃 서울섬 야경 도장을 받았어요! +50벨');
    } else toast('반짝반짝 서울섬 야경이에요 🌃');
  } else toast('해가 진 뒤에 다시 보면 반짝이는 야경을 볼 수 있어요! (야경 도장 +50벨)');
}

// ---------- 시계: 실제 7초 = 게임 10분 ----------
let dusk = null;
function tickClock(dt) {
  gameMinutes = (gameMinutes + dt * (10 / 7)) % (24 * 60);
  const m10 = Math.floor(gameMinutes / 10) * 10, hh = Math.floor(m10 / 60), mi = m10 % 60;
  const txt = `${((hh + 11) % 12) + 1}:${String(mi).padStart(2, '0')}`;
  if ($('hudTime').textContent !== txt) { $('hudTime').textContent = txt; $('hudAmPm').textContent = hh < 12 ? 'AM' : 'PM'; $('miniTime').textContent = `${txt} ${hh < 12 ? 'AM' : 'PM'}`; }
  // 해 질 녘부터 새벽까지는 노을 테마 (원래 서울섬 '노을' 화면처럼 글꼴·색이 바뀜)
  const h = gameMinutes / 60, d = h >= 17.5 || h < 5.5;
  if (d !== dusk) { dusk = d; document.body.classList.toggle('dusk', d); }
}
(() => {
  const d = new Date();
  $('hudDate').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 · ${'일월화수목금토'[d.getDay()]}요일 · 서울섬`;
})();

// ---------- 미니맵 (동그란 작은 지도 / M: 큰 지도) ----------
const mm = $('minimap'), mctx = mm.getContext('2d'), mmWrap = $('mapWrap');
const mm2Big = () => mmWrap.classList.contains('big');
function sizeMinimap() {
  const img = world.minimap, big = mm2Big();
  const w = big ? Math.min(innerWidth - 40, (innerHeight - 120) * (img.width / img.height), 900) : (innerWidth < 760 ? 108 : 160);
  const h = big ? w * img.height / img.width : w;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  mm.width = Math.round(w * dpr); mm.height = Math.round(h * dpr);
  mm.style.width = `${Math.round(w)}px`; mm.style.height = `${Math.round(h)}px`;
}
const mmv = { small: 2.2, big: 1, cx: 0, cz: 0, drag: null };
function mmToggle() {
  mmWrap.classList.toggle('big');
  if (mm2Big()) { mmv.cx = player?.position.x || 0; mmv.cz = player?.position.z || 0; }
  sizeMinimap();
}
function mmView() {
  const img = world.minimap, big = mm2Big();
  const zoom = big ? mmv.big : mmv.small, k = (mm.width / img.width) * zoom;
  let cx = big ? mmv.cx : player.position.x, cz = big ? mmv.cz : player.position.z;
  if (big) {
    const hw = mm.width / 2 / k, hh = mm.height / 2 / k;
    cx = hw >= img.width / 2 ? 0 : THREE.MathUtils.clamp(cx, -img.width / 2 + hw, img.width / 2 - hw);
    cz = hh >= img.height / 2 ? 0 : THREE.MathUtils.clamp(cz, -img.height / 2 + hh, img.height / 2 - hh);
    mmv.cx = cx; mmv.cz = cz;
  }
  return { k, cx, cz, zoom, big };
}
mm.addEventListener('wheel', (e) => {
  e.preventDefault(); e.stopPropagation();
  const v = mmView(), r = mm.getBoundingClientRect();
  const sx = (e.clientX - r.left) * (mm.width / r.width), sy = (e.clientY - r.top) * (mm.height / r.height);
  const wx = v.cx + (sx - mm.width / 2) / v.k, wz = v.cz + (sy - mm.height / 2) / v.k;
  const next = THREE.MathUtils.clamp(v.zoom * (e.deltaY < 0 ? 1.25 : 0.8), 1, 10);
  if (v.big) { mmv.big = next; const k2 = (mm.width / world.minimap.width) * next; mmv.cx = wx - (sx - mm.width / 2) / k2; mmv.cz = wz - (sy - mm.height / 2) / k2; }
  else mmv.small = next;
}, { passive: false });
mm.addEventListener('pointerdown', (e) => { mmv.drag = { x: e.clientX, y: e.clientY, moved: 0 }; mm.setPointerCapture(e.pointerId); });
mm.addEventListener('pointermove', (e) => {
  const d = mmv.drag; if (!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
  if (mm2Big()) { const v = mmView(), r = mm.getBoundingClientRect(); mmv.cx -= dx * (mm.width / r.width) / v.k; mmv.cz -= dy * (mm.height / r.height) / v.k; }
});
mm.addEventListener('pointerup', () => { const d = mmv.drag; mmv.drag = null; if (d && d.moved < 5) mmToggle(); });
function drawMinimap() {
  const W = mm.width, H = mm.height, img = world.minimap, dpr = W / parseFloat(mm.style.width || W);
  const { k, cx, cz, zoom, big } = mmView();
  const sx = (x) => W / 2 + (x - cx) * k, sy = (z) => H / 2 + (z - cz) * k;
  const showNames = big || zoom >= 5;
  const css = getComputedStyle(document.body);
  mctx.imageSmoothingEnabled = true;
  mctx.fillStyle = css.getPropertyValue('--mm-sea') || '#8fd8e8'; mctx.fillRect(0, 0, W, H);
  mctx.drawImage(img, sx(-img.width / 2), sy(-img.height / 2), img.width * k, img.height * k);
  const font = (px) => `${px * dpr}px Jua, sans-serif`;
  const label = (txt, x, y, col) => { mctx.font = font(12); mctx.lineWidth = 3 * dpr; mctx.strokeStyle = 'rgba(255,250,234,0.95)'; mctx.strokeText(txt, x, y); mctx.fillStyle = col; mctx.fillText(txt, x, y); };
  mctx.textAlign = 'center';
  for (const l of world.landmarkPins) {
    const x = sx(l.x), y = sy(l.z);
    if (x < -40 || y < -20 || x > W + 40 || y > H + 20) continue;
    mctx.fillStyle = '#ff8fa3'; mctx.beginPath(); mctx.arc(x, y, 2.6 * dpr, 0, 7); mctx.fill();
    if (showNames) label(l.name, x, y - 6 * dpr, '#6b4f2e');
  }
  for (const it of world.interactables) {
    if (it.kind !== 'minigame') continue;
    const x = sx(it.x), y = sy(it.z);
    mctx.fillStyle = '#ffd166'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5 * dpr;
    mctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? 2 : 4.5) * dpr; mctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } mctx.closePath(); mctx.fill(); mctx.stroke();
  }
  for (const p of world.piers) {
    const x = sx(p.x), y = sy(p.z), r = (showNames ? 4.5 : 3) * dpr;
    mctx.fillStyle = '#7bc8f6'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5 * dpr;
    mctx.beginPath(); mctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.4); mctx.fill(); mctx.stroke();
    if (showNames) label(`${p.name} 선착장`, x, y + 16 * dpr, '#23607A');
  }
  for (const s of world.stations) {
    const x = sx(s.x), y = sy(s.z);
    mctx.fillStyle = LINE2; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5 * dpr;
    mctx.beginPath(); mctx.arc(x, y, (showNames ? 5 : 3.5) * dpr, 0, 7); mctx.fill(); mctx.stroke();
    if (showNames) label(`${s.name}역`, x, y + 16 * dpr, '#2f7a3a');
  }
  if (big) {
    mctx.font = font(14); mctx.lineWidth = 3 * dpr; mctx.strokeStyle = 'rgba(107,79,46,0.6)'; mctx.fillStyle = '#ffffff';
    for (const g of world.guLabels) { const x = sx(g.x), y = sy(g.z) + 16 * dpr; mctx.strokeText(g.name, x, y); mctx.fillText(g.name, x, y); }
  }
  // 내 위치 (원래 서울섬 화살표)
  mctx.save(); mctx.translate(sx(player.position.x), sy(player.position.z)); mctx.rotate(-yaw + Math.PI);
  mctx.scale(dpr, dpr);
  mctx.fillStyle = css.getPropertyValue('--mm-me') || '#F2A73B'; mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 2; mctx.lineJoin = 'round';
  mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5.5, 5); mctx.lineTo(0, 2.5); mctx.lineTo(-5.5, 5); mctx.closePath(); mctx.stroke(); mctx.fill();
  mctx.restore();
}

// ---------- 루프 ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = camera.aspect < 0.9 ? 62 : 46; camera.updateProjectionMatrix();
  for (const g of Object.values(games)) g.resize(w / h);
  sizeMinimap();
}
addEventListener('resize', resize);
resize();

const timer = new THREE.Timer();
timer.connect(document);
function frame(ts) {
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.05), t = timer.getElapsed();
  if (mode === 'make') {
    // 꾸미기: 광화문광장에서 내 캐릭터를 앞에서 보여 줌 (화면 오른쪽)
    const p = player.position;
    const a = makeYaw + Math.sin(t * 0.4) * 0.35;
    const sx = Math.cos(makeYaw) * 1.6, sz = -Math.sin(makeYaw) * 1.6; // 화면 오른쪽에 보이게 (왼쪽엔 꾸미기 판)
    camera.position.set(p.x + Math.sin(a) * 5.2 - sx, 2.4, p.z + Math.cos(a) * 5.2 - sz);
    camera.lookAt(p.x - sx, 0.9, p.z - sz);
    avatar.animate(dt, t, { wave: Math.floor(t / 3) % 2 === 0, yaw: makeYaw });
    world.update(dt, t, null);
    dayNight.update(gameMinutes / 60, t, camera.position);
    world.followSun(p);
    renderer.render(world.scene, camera);
  } else if (mode === 'world') {
    if (tour) updateTour(dt, t); else updateWorld(dt, t);
    dayNight.update(gameMinutes / 60, t, camera.position);
    world.followSun(tour ? tour.focus : player.position);
    renderer.render(world.scene, camera);
  } else if (mode === 'mini') {
    mini.update(dt, t, keys);
    tickClock(dt);
    dayNight.applyMini(mini, gameMinutes / 60);
    renderer.render(mini.scene, mini.camera);
  }
  requestAnimationFrame(frame);
}
rebuildPlayer();
setMode(save.name ? 'world' : 'make');
if (mode === 'world') { resetView(); snapCamera(); }
frame();

// 디버그/테스트용
window.__game = { setMode, world, renderer, camera, cam, setTime(h) { gameMinutes = h * 60; }, dayNight, taxi, get player() { return player; }, get mini() { return mini; }, save, games, getGame,
  enter(id) { miniEntry = world.interactables.find((i) => i.game === id); mini = getGame(id); setMode('mini'); },
  warp(x, z) { player.position.set(x, 0, z); snapCamera(); } };
