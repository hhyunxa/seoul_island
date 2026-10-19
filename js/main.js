import './style.css';
import * as THREE from 'three';
import { SkinEditor } from './editor.js';
import { Avatar, drawPortrait, validSkin, farmerSkin } from './character.js';
import { World } from './world.js';
import { DayNight } from './daynight.js';
import { buildSubway, STATIONS, LINE2 } from './subway.js';
import { buildPiers, WaterTaxi } from './watertaxi.js';
import { GAMES } from './minigames/index.js';
import { sfx } from './sfx.js';
import { Tour } from './tour.js';

const $ = (id) => document.getElementById(id);
const PIX = 3; // 화면을 1/3 해상도로 그린 뒤 확대 → 도트 느낌

// ---------- 저장 (브라우저 localStorage, 실패해도 게임은 동작) ----------
const SAVE_KEY = 'dot-island-save-v2';
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
const save = Object.assign({ name: '', skin: null, coins: 0, best: {}, dex: {} }, loadSave());
if (save.skin && !validSkin(save.skin)) save.skin = null;
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 무시 */ } }

// ---------- 렌더러 ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 240);

await document.fonts.load('700 16px Galmuri11').catch(() => {});
const world = new World();
const dayNight = new DayNight(world); // 시계에 맞춰 하늘·빛이 바뀜
buildSubway(world); // 2호선 주요 역 입구
buildPiers(world);  // 한강 수상택시 선착장
const taxi = new WaterTaxi(world);
world.finishTrees(); // 표지판·시작 지점 주변 나무 정리 후 나무 그리기
// 미니게임은 처음 들어갈 때 만들고 재사용
const games = {};
let mini = null, miniEntry = null;
function getGame(id) {
  if (!games[id]) { games[id] = new GAMES[id]({ onEnd: showResult, onFloat: floatText, ctx: { save, persist, world } }); games[id].resize(innerWidth / innerHeight); }
  return games[id];
}

let mode = 'draw';
let avatar = null;   // 월드 속 내 캐릭터 (Avatar)
let player = null;   // avatar.root
let skin = save.skin || farmerSkin();
let vy = 0, airborne = false, yaw = 0;
const keys = new Set();
let zoom = 1;
let gameMinutes = 6 * 60;
let dialog = null;
let subway = null; // 지하철 역 고르기 창이 열려 있으면 { from }
let nearest = null;
let stepT = 0;
let tour = null;
let cab = null;    // 택시 부르기 창이 열려 있으면 { list, sel }   // 팔각정 망원경으로 서울 둘러보는 중이면 Tour

// ---------- 에디터 ----------
const editor = new SkinEditor({
  view: $('skinView'), faceCanvas: $('faceCanvas'), paletteEl: $('palette'), customColorEl: $('customColor'),
  faceLabel: $('faceLabel'), partSel: $('partSel'), faceBtns: $('faceBtns'),
});
editor.load(skin);
$('nameInput').value = save.name || '';
document.querySelectorAll('.tool[data-tool]').forEach((b) => (b.onclick = () => { editor.setTool(b.dataset.tool); sfx.click(); }));
document.querySelectorAll('[data-template]').forEach((b) => (b.onclick = () => { editor.loadTemplate(b.dataset.template); sfx.click(); }));
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { editor.setView(b.dataset.view); sfx.click(); }));
$('mirrorBtn').onclick = () => { editor.mirror = !editor.mirror; $('mirrorBtn').classList.toggle('active', editor.mirror); sfx.click(); };
$('undoBtn').onclick = () => { editor.doUndo(); sfx.click(); };
$('walkBtn').onclick = () => {
  editor.walk = !editor.walk; sfx.click();
  $('walkBtn').classList.toggle('active', editor.walk);
  $('walkBtn').textContent = editor.walk ? '■ 멈추기' : '▶ 걸어보기';
};

$('toPreview').onclick = () => {
  sfx.unlock();
  skin = JSON.parse(JSON.stringify(editor.skin));
  save.skin = skin;
  save.name = $('nameInput').value.trim() || '모험가';
  persist();
  sfx.open();
  transition(() => setMode('preview'));
};
$('backToDraw').onclick = () => { sfx.click(); transition(() => setMode('draw')); };
$('enterWorld').onclick = () => { sfx.open(); transition(() => setMode('world')); };
$('retryMini').onclick = () => { sfx.click(); $('resultScreen').classList.add('hidden'); mini.start(); };
$('exitMini').onclick = () => { sfx.click(); backToIsland(); };
// 게임 도중 나가기: 결과 처리(showResult)를 건너뛰므로 코인·기록·도감이 반영되지 않음
$('quitMini').onclick = () => {
  if (mode !== 'mini' || mini.state === 'done') return; // 이미 끝났거나 나가는 중
  sfx.click();
  mini.quit();
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

// ---------- 화면 전환 ----------
function transition(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 380);
}

function rebuildPlayer() {
  if (avatar) { world.scene.remove(player); avatar.dispose(); }
  avatar = new Avatar(skin, { height: 1.7 });
  player = avatar.root;
  player.position.copy(world.spawn);
  player.rotation.y = 0; yaw = 0; vy = 0; airborne = false;
  world.scene.add(player);
}

function setMode(m) {
  const prev = mode;
  mode = m;
  $('drawScreen').classList.toggle('hidden', m !== 'draw');
  $('previewScreen').classList.toggle('hidden', m !== 'preview');
  $('hud').classList.toggle('hidden', m !== 'world');
  $('miniHud').classList.toggle('hidden', m !== 'mini');
  $('resultScreen').classList.add('hidden');
  $('countdown').classList.add('hidden');
  closeDialog();
  if (m === 'draw') { if (player) player.visible = false; requestAnimationFrame(fitDraw); }
  if (m === 'preview') {
    rebuildPlayer();
    $('pvName').textContent = save.name;
  }
  if (m === 'world') {
    if (!player || prev === 'preview') rebuildPlayer();
    player.visible = true;
    $('hudName').textContent = save.name;
    drawPortrait(skin, $('portrait'));
    $('hudCoins').textContent = save.coins;
    if (prev === 'preview') { resetView(); snapCamera(); setTimeout(() => toast(`${save.name}, 도트 서울에 온 걸 환영해요!`), 500); }
  }
  if (m === 'mini') {
    mini.setPlayer(skin);
    mini.start();
  }
  if (m !== 'mini') $('miniOverlay').innerHTML = '';
  if (prev === 'mini' && m !== 'mini') mini?.leave?.(); // 카메라 등 정리
}

// ---------- 입력 ----------
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (mode === 'draw') {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); editor.doUndo(); }
    else if (e.code === 'KeyB') editor.setTool('pen');
    else if (e.code === 'KeyG') editor.setTool('fill');
    else if (e.code === 'KeyP') editor.setTool('part');
    else if (e.code === 'KeyI') editor.setTool('picker');
    else if (e.code === 'KeyM') $('mirrorBtn').click();
  } else if (mode === 'world' && tour) {
    if (['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code) && !e.repeat) { e.preventDefault(); tour.skip(); }
  } else if (mode === 'world' && subway) {
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) { const b = $('subwayLoop').querySelector(`[data-key="${m[2]}"]`); if (b) b.click(); }
    if (e.code === 'Escape') closeSubway();
  } else if (mode === 'world') {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space' && !e.repeat) { if (dialog) interact(); else if (!taxi.riding) jump(); }
    if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) interact();
    if (e.code === 'KeyR' && !e.repeat && !dialog) { resetView(); toast('시점을 처음대로 돌렸어요'); }
    if (e.code === 'KeyM' && !e.repeat) mmToggle();
    if (e.code === 'KeyT' && !e.repeat && !dialog) openCab();
    if (e.code === 'Escape') { if (dialog) closeDialog(); else if (taxi.riding) toast('선착장에서 E를 눌러 내린 다음 나갈 수 있어요'); else transition(() => setMode('draw')); }
  } else if (mode === 'mini') {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    const resultOpen = !$('resultScreen').classList.contains('hidden');
    if (e.code === 'Enter' && resultOpen) $('exitMini').click();
    else if (e.code === 'Escape' && !resultOpen) $('quitMini').click();
    else if (!e.repeat && !resultOpen && mini.state !== 'choose') mini.keyDown(e.code); // 조작 고르는 창의 1·2 키는 게임에 안 넘김
  }
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (mode === 'mini') mini.keyUp(e.code); });
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => {
  if (e.target === mm) return; // 지도 위 휠은 지도 확대/축소
  if (mode === 'world') zoom = THREE.MathUtils.clamp(zoom + Math.sign(e.deltaY) * 0.1, 0.4, 1.8);
  if (mode === 'preview' && e.target === $('view')) zoom = THREE.MathUtils.clamp(zoom + Math.sign(e.deltaY) * 0.1, 0.7, 1.6);
}, { passive: true });
addEventListener('pointermove', (e) => { if (mode === 'mini') mini.pointer(e, innerWidth, innerHeight); });
$('view').addEventListener('pointerdown', (e) => { if (mode === 'mini' && e.button === 0) mini.pointerDown(e, innerWidth, innerHeight); });
addEventListener('pointerup', (e) => { if (mode === 'mini') mini.pointerUp(e, innerWidth, innerHeight); });
$('dialog').onclick = () => interact();

// ---------- 대화창 ----------
function openDialog(it) {
  dialog = { name: it.name, lines: it.lines, i: 0, shown: 0 };
  $('dialog').classList.remove('hidden');
  $('dialogName').textContent = it.name;
  $('dialogText').textContent = '';
}
function closeDialog() { dialog = null; $('dialog').classList.add('hidden'); }

function interact() {
  if (dialog) {
    const line = dialog.lines[dialog.i];
    if (dialog.shown < line.length) { dialog.shown = line.length; return; } // 타자 효과 건너뛰기
    dialog.i++; dialog.shown = 0;
    if (dialog.i >= dialog.lines.length) closeDialog();
    sfx.click();
    return;
  }
  if (!nearest) return;
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
    sfx.open();
    miniEntry = nearest; mini = getGame(nearest.game);
    transition(() => setMode('mini'));
  }
}

// ---------- 지하철 2호선 ----------
// 순환선 위 자리 (네모난 고리를 시계 방향으로: 위쪽 홍대입구·시청·왕십리, 아래쪽 잠실·강남·신도림)
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
    return `<button class="stop${cur ? ' here' : ''}" style="left:${l}%;top:${t}%" ${cur ? 'disabled' : `data-go="${s.id}" data-key="${key}"`}>
      <i></i><b>${s.name}</b><small>${cur ? '현재 위치' : `${key} · ${travelMinutes(here, s)}분`}</small><em>${s.near}</em></button>`;
  }).join('');
  $('subwayPanel').classList.remove('hidden');
}
function closeSubway() { subway = null; $('subwayPanel').classList.add('hidden'); }
$('subwayClose').onclick = () => { sfx.click(); closeSubway(); };
$('subwayLoop').onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) rideTo(b.dataset.go); };
// 순환선에서 가까운 쪽으로 가는 정거장 수 → 게임 시간(분)
function travelMinutes(a, b) {
  const order = STATIONS.map((s) => s.id), N = order.length, i = order.indexOf(a.id), j = order.indexOf(b.id);
  const hops = Math.min((i - j + N) % N, (j - i + N) % N);
  return 10 + hops * 10;
}
function rideTo(id) {
  if (!subway) return;
  const from = world.stations.find((s) => s.id === subway.from), to = world.stations.find((s) => s.id === id);
  closeSubway();
  sfx.click();
  const tv = $('travel');
  $('travelText').innerHTML = `<span class="line2-badge">2</span> ${from.name} → <b>${to.name}</b><br><small>이번 역은 ${to.name}, ${to.name}역입니다</small>`;
  transition(() => {
    tv.classList.remove('hidden');
    player.position.set(to.exit[0], 0, to.exit[1]);
    yaw = 0; player.rotation.y = 0;
    gameMinutes = (gameMinutes + travelMinutes(from, to)) % (24 * 60);
    snapCamera();
    let beeps = 0; const tick = setInterval(() => { sfx.tick(); if (++beeps >= 3) clearInterval(tick); }, 420);
    setTimeout(() => transition(() => { tv.classList.add('hidden'); sfx.open(); toast(`${to.name}역에 도착했어요!`); }), 1700);
  });
}

// ---------- 택시 (데모) ----------
// 요금: 걸어서 10초 걸리는 거리마다 10골드 (걷는 속도 WALK_SPEED 기준, 직선거리)
const WALK_SPEED = 4.2, CAB_FARE_PER_SEC = 1, CAB_MIN_FARE = 5;
const cabFare = (d) => Math.max(CAB_MIN_FARE, Math.ceil((d / WALK_SPEED) * CAB_FARE_PER_SEC));
function cabPlaces() {
  const out = [];
  for (const p of world.landmarkPins) out.push({ cat: '명소', name: p.name, x: p.x, z: p.z });
  for (const it of world.interactables) if (it.kind === 'minigame') out.push({ cat: '미니게임', name: it.label, x: it.ret?.[0] ?? it.x, z: it.ret?.[1] ?? it.z });
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
  const norm = (s) => s.replace(/\s/g, '').toLowerCase(); // 띄어쓰기·대소문자 무시
  const q = norm($('cabSearch').value);
  const p = player.position;
  cab.list = cab.all
    .filter((d) => !q || norm(d.name).includes(q) || d.cat.includes(q))
    .map((d) => { const dist = Math.hypot(d.x - p.x, d.z - p.z); return { ...d, dist, fare: cabFare(dist) }; })
    .sort((a, b) => a.dist - b.dist);
  cab.sel = Math.min(cab.sel, Math.max(0, cab.list.length - 1));
  $('cabList').innerHTML = cab.list.length ? cab.list.map((d, i) => {
    const near = d.dist < 6, poor = d.fare > save.coins;
    const why = near ? '바로 근처예요' : poor ? '골드가 모자라요' : '';
    return `<button class="cab-row${i === cab.sel ? ' sel' : ''}" data-i="${i}" ${near || poor ? 'disabled' : ''}>
      <em class="cat-${d.cat}">${d.cat}</em><b>${d.name}</b>
      <span>${why || `걸어서 ${Math.round(d.dist / WALK_SPEED)}초`}</span><i class="coin"></i><strong>${d.fare}</strong></button>`;
  }).join('') : '<p class="cab-empty">찾는 곳이 없어요</p>';
  $('cabList').querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
function rideCab(d) {
  if (!cab || !d) return;
  if (d.dist < 6) { toast('바로 근처예요. 걸어가 봐요!'); return; }
  if (d.fare > save.coins) { sfx.miss(); toast(`골드가 ${d.fare - save.coins}개 모자라요`); return; }
  closeCab();
  save.coins -= d.fare; persist(); $('hudCoins').textContent = save.coins;
  sfx.coin();
  // 내릴 자리: 목적지 근처에서 걸을 수 있는 곳
  let spot = [d.x, d.z];
  for (let r = 0; r <= 4; r += 0.5) {
    const n = Math.max(1, Math.round(r * 6)); let ok = false;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r; if (world.canWalk(x, z, 0.4)) { spot = [x, z]; ok = true; break; } }
    if (ok) break;
  }
  const tv = $('travel');
  $('travelText').innerHTML = `🚕 <b>${d.name}</b>(으)로 가는 중…<br><small>요금 ${d.fare}골드를 냈어요</small>`;
  transition(() => {
    tv.classList.add('cab'); tv.classList.remove('hidden');
    player.position.set(spot[0], 0, spot[1]); airborne = false; vy = 0;
    gameMinutes = (gameMinutes + Math.max(10, Math.round(d.dist / WALK_SPEED / 30) * 10)) % (24 * 60);
    snapCamera();
    setTimeout(() => transition(() => { tv.classList.add('hidden'); tv.classList.remove('cab'); sfx.open(); toast(`🚕 ${d.name}에 도착했어요! (-${d.fare}골드)`); }), 1500);
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

// ---------- 결과/연출 ----------
function showResult({ id, title, score, coins, rows }) {
  if (typeof save.best !== 'object' || !save.best) save.best = {};
  const prevBest = save.best[id] || 0;
  const isBest = score > prevBest;
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

// ---------- 월드 업데이트 ----------
// 카메라: 플레이어 주위를 도는 궤도 (마우스 드래그로 회전, 휠로 줌)
const CAM_DIST = 13.8, CAM_PITCH = 0.76;
const cam = { yaw: 0, pitch: CAM_PITCH, target: new THREE.Vector3() };
// pitch가 PITCH_LOW보다 내려가면 카메라는 땅 가까이에 머물고, 대신 고개를 들어 하늘을 올려다봄
const PITCH_MIN = -0.5, PITCH_LOW = 0.2, PITCH_FLOOR = 0.08;
function camOffset() {
  const d = CAM_DIST * zoom, p = Math.max(cam.pitch, PITCH_FLOOR);
  return new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(p) * d, Math.sin(p) * d, Math.cos(cam.yaw) * Math.cos(p) * d);
}
function placeCamera() {
  camera.position.copy(cam.target).add(camOffset());
  const look = Math.max(0, PITCH_LOW - cam.pitch); // 0 ~ 0.9
  if (look <= 0) { camera.lookAt(cam.target.x, cam.target.y + 0.8, cam.target.z); return; }
  // 평소 바라보는 각도(살짝 아래)에서 위로 들어 올림 → 최대 약 30° (아래쪽에 도시 스카이라인이 남게)
  const dx = cam.target.x - camera.position.x, dz = cam.target.z - camera.position.z, dh = Math.hypot(dx, dz);
  const base = Math.atan2(cam.target.y + 0.8 - camera.position.y, dh);
  const elev = base + (look / (PITCH_LOW - PITCH_MIN)) * (0.52 - base);
  camera.lookAt(camera.position.x + (dx / dh) * Math.cos(elev), camera.position.y + Math.sin(elev), camera.position.z + (dz / dh) * Math.cos(elev));
}
function snapCamera() {
  cam.target.set(player.position.x, 0, player.position.z);
  placeCamera();
}
function resetView() { cam.yaw = 0; cam.pitch = CAM_PITCH; zoom = 1; }

// 드래그로 시점 돌리기 (월드·미리보기)
const drag = { on: false, x: 0, y: 0, moved: 0 };
let pv = { yaw: 0, manual: 0, dist: 4.4 };
$('view').addEventListener('pointerdown', (e) => {
  if (mode !== 'world' && mode !== 'preview') return;
  drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0;
  $('view').setPointerCapture(e.pointerId);
  $('view').classList.add('grabbing');
});
$('view').addEventListener('pointermove', (e) => {
  if (!drag.on) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (mode === 'world') {
    cam.yaw -= dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.005, PITCH_MIN, 1.4); // 위로 끝까지 끌면 하늘을 올려다봄
  } else if (mode === 'preview') {
    pv.yaw -= dx * 0.008; pv.manual = 4; // 직접 돌리면 4초간 자동 회전 멈춤
  }
});
const endDrag = () => { drag.on = false; $('view').classList.remove('grabbing'); };
$('view').addEventListener('pointerup', endDrag);
$('view').addEventListener('pointercancel', endDrag);
$('view').addEventListener('contextmenu', (e) => { if (mode === 'world' || mode === 'preview') e.preventDefault(); });

function jump() {
  if (airborne) return;
  airborne = true; vy = 8.2;
  sfx.jump();
}

function updateWorld(dt, t) {
  const mv = new THREE.Vector3();
  if (taxi.riding) {
    // 수상택시 운전: 캐릭터는 배 뒤쪽 자리에 앉아 함께 움직임
    const b = taxi.update(dt, t, dialog ? new Set() : keys, cam.yaw);
    yaw = b.heading;
    player.position.set(b.x - Math.sin(b.heading) * 0.55, b.y, b.z - Math.cos(b.heading) * 0.55);
    player.visible = b.sink < 0.6;
  } else if (!dialog && !subway && !cab) {
    // 카메라가 보는 방향 기준으로 이동 (W = 화면 안쪽)
    let f = 0, r = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    mv.set(-sy * f + cy * r, 0, -cy * f - sy * r);
  }
  const moving = mv.lengthSq() > 0;
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (moving) {
    mv.normalize().multiplyScalar((run ? 7 : 4.2) * dt);
    const p = player.position;
    if (world.canWalk(p.x + mv.x, p.z)) p.x += mv.x;
    if (world.canWalk(p.x, p.z + mv.z)) p.z += mv.z;
    yaw = Math.atan2(mv.x, mv.z);
    stepT -= dt;
    if (stepT <= 0 && !airborne) { sfx.step(); stepT = run ? 0.22 : 0.32; }
  }
  // 점프 (중력) — 바닥 높이는 다리 위면 다리 높이
  if (!taxi.riding) {
    const gy = world.groundY(player.position.x, player.position.z);
    if (airborne) {
      vy -= 26 * dt;
      player.position.y += vy * dt;
      if (player.position.y <= gy) { player.position.y = gy; vy = 0; airborne = false; sfx.step(); }
    } else player.position.y = gy;
  }
  if (!taxi.riding) player.visible = true;
  avatar.animate(dt, t, { moving, run, air: airborne && !taxi.riding, yaw });
  world.update(dt, t, player.position, camera);
  world.followSun(player.position);

  // 카메라 따라가기
  cam.target.lerp(new THREE.Vector3(player.position.x, 0, player.position.z), 1 - Math.exp(-dt * 6));
  placeCamera();

  // 가장 가까운 상호작용 대상
  nearest = null;
  let best = Infinity;
  if (taxi.riding) {
    // 배를 타고 있을 땐 가까운 선착장에서 내리기만 가능
    const p = taxi.nearPier();
    if (p) nearest = { x: p.boatAt[0], z: p.boatAt[1], label: `내리기 (${p.name} 선착장)`, kind: 'leaveTaxi', pier: p };
  } else for (const it of world.interactables) {
    const d = Math.hypot(it.x - player.position.x, it.z - player.position.z);
    if (d < it.r && d < best) { best = d; nearest = it; }
  }
  const bubble = $('promptBubble');
  if (nearest && !dialog && !subway && !cab) {
    const v = new THREE.Vector3(nearest.x, 2.6, nearest.z).project(camera);
    bubble.innerHTML = `<b>E</b>${nearest.label}`;
    bubble.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    bubble.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    bubble.classList.remove('hidden');
  } else bubble.classList.add('hidden');

  // 대화 타자 효과
  if (dialog) {
    const line = dialog.lines[dialog.i];
    if (dialog.shown < line.length) {
      const before = Math.floor(dialog.shown);
      dialog.shown = Math.min(line.length, dialog.shown + dt * 40);
      if (Math.floor(dialog.shown) !== before && before % 3 === 0) sfx.talk();
    }
    $('dialogText').textContent = line.slice(0, Math.floor(dialog.shown));
  }

  // 지금 있는 곳(구) + 미니맵
  const place = world.placeName(player.position.x, player.position.z);
  if (place !== lastPlace) { lastPlace = place; $('hudPlace').textContent = `서울 · ${place}`; }
  drawMinimap();
  tickClock(dt);
}

// ---------- 팔각정 망원경: 서울 하늘 둘러보기 ----------
function startTour() {
  sfx.open(); keys.clear();
  $('promptBubble').classList.add('hidden');
  $('hud').classList.add('hidden'); // 둘러보는 동안 화면을 시원하게
  const home = world.interactables.find((i) => i.kind === 'tour');
  tour = new Tour(camera, home, { pos: camera.position.clone(), look: new THREE.Vector3(cam.target.x, cam.target.y + 0.8, cam.target.z) });
}
function updateTour(dt, t) {
  avatar.animate(dt, t, { yaw: Math.PI }); // 망원경 쪽(남쪽)을 보고 서 있음
  world.update(dt, t, null, null);
  tickClock(dt);
  drawMinimap();
  if (tour.update(dt)) endTour();
}
function endTour() {
  tour.dispose(); tour = null;
  $('hud').classList.remove('hidden');
  snapCamera();
  // 해가 진 뒤에 보면 야경 도장 (처음 한 번 보상)
  if (dayNight.sample(gameMinutes / 60).night > 0.5) {
    if (!save.stamps?.nightView) {
      save.stamps = { ...save.stamps, nightView: true }; save.coins += 50; persist();
      $('hudCoins').textContent = save.coins; sfx.gold();
      toast('🌃 서울 야경 도장을 받았어요! +50골드');
    } else toast('반짝반짝 서울 야경이에요 🌃');
  } else toast('해가 진 뒤에 다시 보면 반짝이는 야경을 볼 수 있어요! (야경 도장 +50골드)');
}

// 시계 (스타듀처럼 10분 단위) — 월드와 미니게임 모두에서 흐름
function tickClock(dt) {
  gameMinutes = (gameMinutes + dt * (10 / 7)) % (24 * 60);
  const m10 = Math.floor(gameMinutes / 10) * 10;
  const hh = Math.floor(m10 / 60), mm = m10 % 60;
  const txt = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
  $('hudTime').textContent = txt;
  $('miniTime').textContent = txt;
}

function setDate() {
  const d = new Date();
  const mo = d.getMonth() + 1;
  const season = mo >= 3 && mo <= 5 ? '봄' : mo <= 8 && mo >= 6 ? '여름' : mo >= 9 && mo <= 11 ? '가을' : '겨울';
  $('hudDate').textContent = `${season} ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
}
setDate();

// ---------- 미니맵 ----------
let lastPlace = '';
const mm = $('minimap'), mctx = mm.getContext('2d');
function sizeMinimap() {
  const big = mm.classList.contains('big');
  const w = big ? Math.min(innerWidth - 40, (innerHeight - 140) * (world.minimap.width / world.minimap.height), 900) : 198;
  mm.width = Math.round(w); mm.height = Math.round(w * world.minimap.height / world.minimap.width);
}
sizeMinimap();
// 지도 확대/이동: 휠 = 확대·축소 (작은 지도는 내 위치 중심, 큰 지도는 마우스 위치 중심), 큰 지도는 드래그로 이동
const mmv = { small: 2, big: 1, cx: 0, cz: 0, drag: null };
const MM_MIN = 1, MM_MAX = 10;
function mmToggle() {
  mm.classList.toggle('big');
  if (mm.classList.contains('big')) { mmv.cx = player?.position.x || 0; mmv.cz = player?.position.z || 0; }
  sizeMinimap();
}
// 지금 지도 보기 상태: 배율 k(지도 px당 화면 px), 중심(월드 좌표)
function mmView() {
  const img = world.minimap, big = mm.classList.contains('big');
  const zoom = big ? mmv.big : mmv.small, k = (mm.width / img.width) * zoom;
  let cx = big ? mmv.cx : player.position.x, cz = big ? mmv.cz : player.position.z;
  const hw = mm.width / 2 / k, hh = mm.height / 2 / k;
  cx = hw >= img.width / 2 ? 0 : THREE.MathUtils.clamp(cx, -img.width / 2 + hw, img.width / 2 - hw);
  cz = hh >= img.height / 2 ? 0 : THREE.MathUtils.clamp(cz, -img.height / 2 + hh, img.height / 2 - hh);
  if (big) { mmv.cx = cx; mmv.cz = cz; }
  return { k, cx, cz, zoom, big };
}
mm.addEventListener('wheel', (e) => {
  e.preventDefault(); e.stopPropagation();
  const v = mmView(), r = mm.getBoundingClientRect();
  const sx = (e.clientX - r.left) * (mm.width / r.width), sy = (e.clientY - r.top) * (mm.height / r.height);
  const wx = v.cx + (sx - mm.width / 2) / v.k, wz = v.cz + (sy - mm.height / 2) / v.k; // 마우스 아래 지점
  const next = THREE.MathUtils.clamp(v.zoom * (e.deltaY < 0 ? 1.25 : 0.8), MM_MIN, MM_MAX);
  if (v.big) {
    mmv.big = next;
    const k2 = (mm.width / world.minimap.width) * next;
    mmv.cx = wx - (sx - mm.width / 2) / k2; mmv.cz = wz - (sy - mm.height / 2) / k2;
  } else mmv.small = next;
}, { passive: false });
mm.addEventListener('pointerdown', (e) => {
  mmv.drag = { x: e.clientX, y: e.clientY, moved: 0 };
  mm.setPointerCapture(e.pointerId);
});
mm.addEventListener('pointermove', (e) => {
  const d = mmv.drag; if (!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
  if (mm.classList.contains('big')) {
    const v = mmView(), r = mm.getBoundingClientRect();
    mmv.cx -= dx * (mm.width / r.width) / v.k; mmv.cz -= dy * (mm.height / r.height) / v.k;
    mm.style.cursor = 'grabbing';
  }
});
mm.addEventListener('pointerup', () => {
  const d = mmv.drag; mmv.drag = null; mm.style.cursor = '';
  if (d && d.moved < 5) mmToggle(); // 끌지 않고 눌렀으면 크게/작게
});
function drawMinimap() {
  const W = mm.width, H = mm.height, img = world.minimap;
  const { k, cx, cz, zoom, big } = mmView();
  const sx = (x) => W / 2 + (x - cx) * k, sy = (z) => H / 2 + (z - cz) * k;
  const showNames = big || zoom >= 5; // 작은 지도는 많이 확대했을 때만 이름 표시 (겹치지 않게)
  mctx.imageSmoothingEnabled = false;
  mctx.fillStyle = '#3e84c4'; mctx.fillRect(0, 0, W, H);
  mctx.drawImage(img, sx(-img.width / 2), sy(-img.height / 2), img.width * k, img.height * k);
  const px = sx(player.position.x), pz = sy(player.position.z);
  // 랜드마크 점
  mctx.font = `700 ${showNames ? 12 : 9}px Galmuri11`;
  mctx.textAlign = 'center';
  for (const l of world.landmarkPins) {
    const x = sx(l.x), y = sy(l.z);
    if (x < -40 || y < -20 || x > W + 40 || y > H + 20) continue;
    mctx.fillStyle = '#e8413a'; mctx.fillRect(x - 2, y - 2, 4, 4);
    if (showNames) { mctx.lineWidth = 3; mctx.strokeStyle = 'rgba(255,248,230,0.9)'; mctx.strokeText(l.name, x, y - 5); mctx.fillStyle = '#3a2410'; mctx.fillText(l.name, x, y - 5); }
  }
  // 수상택시 선착장 (파란 네모)
  for (const p of world.piers) {
    const x = sx(p.x), y = sy(p.z);
    mctx.fillStyle = '#2f7fd8'; mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1.5;
    const r = showNames ? 4.5 : 3; mctx.fillRect(x - r, y - r, r * 2, r * 2); mctx.strokeRect(x - r, y - r, r * 2, r * 2);
    if (showNames) { mctx.font = '700 12px Galmuri11'; mctx.lineWidth = 3; mctx.strokeStyle = 'rgba(255,248,230,0.9)'; mctx.strokeText(`${p.name} 선착장`, x, y + 16); mctx.fillStyle = '#1f4f9a'; mctx.fillText(`${p.name} 선착장`, x, y + 16); }
  }
  // 지하철역 (초록 동그라미)
  for (const s of world.stations) {
    const x = sx(s.x), y = sy(s.z);
    mctx.fillStyle = LINE2; mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.arc(x, y, showNames ? 5 : 3.5, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
    if (showNames) { mctx.font = '700 12px Galmuri11'; mctx.lineWidth = 3; mctx.strokeStyle = 'rgba(255,248,230,0.9)'; mctx.strokeText(`${s.name}역`, x, y + 16); mctx.fillStyle = '#1f5f2a'; mctx.fillText(`${s.name}역`, x, y + 16); }
  }
  if (big) {
    mctx.font = '700 14px Galmuri11'; mctx.lineWidth = 3; mctx.strokeStyle = 'rgba(40,70,30,0.75)'; mctx.fillStyle = '#ffffff';
    for (const g of world.guLabels) { const x = sx(g.x), y = sy(g.z) + 16; mctx.strokeText(g.name, x, y); mctx.fillText(g.name, x, y); }
  }
  // 내 위치 (보는 방향 화살표)
  mctx.save(); mctx.translate(px, pz); mctx.rotate(-yaw + Math.PI);
  mctx.fillStyle = '#ffd23f'; mctx.strokeStyle = '#3a2410'; mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
}

// ---------- 루프 ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(Math.ceil(w / PIX), Math.ceil(h / PIX), false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const g of Object.values(games)) g.resize(w / h);
}
// 그리기 화면을 작은 화면에도 맞게 축소
function fitDraw() {
  const el = $('drawInner');
  el.style.transform = 'none';
  const w = el.offsetWidth, h = el.offsetHeight;
  const sc = Math.min(1, (innerHeight - 24) / h, (innerWidth - 24) / w);
  el.style.transform = `scale(${sc})`;
}
addEventListener('resize', () => { resize(); fitDraw(); sizeMinimap(); });
resize();
fitDraw();

const timer = new THREE.Timer();
timer.connect(document);
function frame(ts) {
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  if (mode === 'draw') {
    const a = t * 0.05;
    const sp = world.spawn;
    camera.position.set(sp.x + Math.cos(a) * 44, 42, sp.z + Math.sin(a) * 44);
    camera.lookAt(sp.x, -2, sp.z);
    world.update(dt, t, null);
    dayNight.update(gameMinutes / 60, t, camera.position);
    world.followSun(new THREE.Vector3(0, 0, 0));
    editor.tick(dt, t);
    renderer.render(world.scene, camera);
  } else if (mode === 'preview') {
    // 앞쪽 반원을 자동으로 왕복, 드래그하면 직접 돌려볼 수 있음
    pv.manual = Math.max(0, pv.manual - dt);
    if (pv.manual <= 0 && !drag.on) pv.yaw += (Math.sin(t * 0.4) * 0.85 - pv.yaw) * Math.min(1, dt * 1.5);
    const a = pv.yaw, p = player.position, pd = pv.dist * zoom;
    camera.position.set(p.x + Math.sin(a) * pd, 1.9 * zoom, p.z + Math.cos(a) * pd);
    camera.lookAt(p.x, 0.35, p.z);
    // 미리보기: 손 흔들기 → 제자리 걷기 → 점프를 번갈아 보여줌
    const ph = Math.floor(t / 2.5) % 3;
    const hop = ph === 2 ? Math.max(0, Math.sin(((t % 2.5) / 2.5) * Math.PI * 2)) : 0;
    player.position.y = hop * 0.7;
    avatar.animate(dt, t, { wave: ph === 0, moving: ph === 1, air: hop > 0.05, yaw: ph === 1 ? Math.sin(t * 0.8) * 0.8 : 0 });
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
setMode('draw');
frame();

// 디버그/테스트용
window.__game = { setMode, world, renderer, camera, cam, setZoom(z) { zoom = z; }, setTime(h) { gameMinutes = h * 60; }, dayNight, taxi, get player() { return player; }, get mini() { return mini; }, save, games, getGame,
  enter(id) { miniEntry = world.interactables.find((i) => i.game === id); mini = getGame(id); setMode('mini'); } };
