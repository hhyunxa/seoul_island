import * as THREE from 'three';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { canvasTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { npcSkin, HAIRS, TONES } from './npc.js';
import { PoseInput } from '../pose.js';

const $ = (id) => document.getElementById(id);
// ============================================================
//  강남 K-팝 포즈 챌린지: 센터가 잡은 포즈를 제한 시간 안에 똑같이!
//  - 몸으로 하기: MediaPipe 관절 좌표로 포즈를 판정 (0.4초 유지하면 성공), 내 캐릭터는 내 팔을 거울처럼 따라 함
//  - 키보드: 포즈 번호 키
// ============================================================
// 팔 각도(라디안)는 화면에서 어깨→손목 방향: 0 = 아래, +π/2 = 화면 오른쪽, ±π = 위 (캐릭터 팔 rotation.z와 같은 기준)
const POSES = [
  { id: 'heart', name: '머리 위 하트', icon: '🫶', keys: ['Digit1', 'Numpad1', 'ArrowUp', 'KeyW'], key: '1', how: '두 손을 머리 위에서 모으기', L: 2.95, R: -2.95, prop: 'top' },
  { id: 'v', name: '브이 만세', icon: '✌️', keys: ['Digit2', 'Numpad2', 'KeyA', 'ArrowLeft'], key: '2', how: '두 팔을 V자로 위로 쭉', L: -2.45, R: 2.45 },
  { id: 't', name: 'T자 쫙', icon: '🙆', keys: ['Digit3', 'Numpad3', 'KeyD', 'ArrowRight'], key: '3', how: '두 팔을 옆으로 쭉 펴기', L: -Math.PI / 2, R: Math.PI / 2 },
  { id: 'point', name: '한 팔 포인트', icon: '👉', keys: ['Digit4', 'Numpad4', 'KeyS', 'ArrowDown'], key: '4', how: '한 팔만 대각선 위로', L: -0.2, R: 2.3 },
  { id: 'chest', name: '가슴 앞 하트', icon: '💗', keys: ['Digit5', 'Numpad5', 'Space'], key: '5', how: '두 손을 가슴 앞에 모으기', front: true, prop: 'chest' },
];
const BPM = 100, BEAT = 60 / BPM;
const HOLD = 0.4;                   // 몸으로: 이만큼 포즈를 유지하면 성공
const LIMIT0 = 3.4, LIMIT_MIN = 1.8; // 한 포즈 제한 시간 (점점 짧아짐)
const CAM_PREF = 'dotseoul.kpopCam';
const loadPref = () => { try { return localStorage.getItem(CAM_PREF) === '1'; } catch { return false; } };
const savePref = (on) => { try { localStorage.setItem(CAM_PREF, on ? '1' : '0'); } catch { /* 저장 못 해도 이번 판은 그대로 */ } };
const cam = new PoseInput();
const BASS = [110, 110, 131, 147, 110, 165, 147, 131];

// ---------- 관절 좌표 → 포즈 판정 ----------
// lm: MediaPipe 33점 (원본 영상 기준). 거울처럼 뒤집어서(화면에서 내가 보는 그대로) 계산
export function readBody(lm, asp) {
  const P = (i) => ({ x: (1 - lm[i].x) * asp, y: lm[i].y });
  let a = { s: P(11), w: P(15) }, b = { s: P(12), w: P(16) };
  if (a.s.x > b.s.x) [a, b] = [b, a]; // a = 화면 왼쪽 팔, b = 화면 오른쪽 팔
  const sw = Math.hypot(b.s.x - a.s.x, b.s.y - a.s.y);
  if (sw < 0.03) return null;
  const nose = P(0), sy = (a.s.y + b.s.y) / 2, cx = (a.s.x + b.s.x) / 2;
  const ang = (arm) => Math.atan2(arm.w.x - arm.s.x, arm.w.y - arm.s.y);
  const gap = Math.abs(b.w.x - a.w.x);
  const up = (w) => w.y < sy - sw * 0.3;
  const atShoulder = (w) => Math.abs(w.y - sy) < sw * 0.5;
  let pose = null;
  if (a.w.y < nose.y && b.w.y < nose.y && gap < sw * 0.9) pose = 'heart';
  else if (up(a.w) && up(b.w) && gap > sw * 1.6) pose = 'v';
  else if (atShoulder(a.w) && atShoulder(b.w) && a.w.x < a.s.x - sw * 0.75 && b.w.x > b.s.x + sw * 0.75) pose = 't';
  else if ((up(b.w) && b.w.x > b.s.x + sw * 0.3 && a.w.y > sy + sw * 0.2) || (up(a.w) && a.w.x < a.s.x - sw * 0.3 && b.w.y > sy + sw * 0.2)) pose = 'point';
  else if (Math.hypot(b.w.x - a.w.x, b.w.y - a.w.y) < sw * 0.55 && a.w.y > sy - sw * 0.2 && a.w.y < sy + sw * 1.3 && Math.abs((a.w.x + b.w.x) / 2 - cx) < sw * 0.6) pose = 'chest';
  return { pose, L: ang(a), R: ang(b) };
}

// ---------- 캐릭터 자세 ----------
// 머리 위·가슴 앞 도트 하트 소품 (머리가 커서 팔만으로는 하트 모양이 안 보이므로)
const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
const heartMat = new THREE.MeshBasicMaterial({ color: '#ff4f9a' });
function makeHeart(av, where) {
  const g = new THREE.Group(), px = where === 'top' ? 0.09 : 0.06;
  HEART.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') { const m = box(px, px, px, heartMat, (c - 2) * px, (4 - r) * px, 0, g); m.castShadow = false; } }));
  if (where === 'top') { g.position.set(0, 11 * av.s, 0); av.joints.head.add(g); } else { g.position.set(0, 7.6 * av.s, 4 * av.s); av.torso.add(g); }
  g.visible = false;
  return g;
}
// c = { av, base, props, L, R, front, prop } — 팔 각도를 부드럽게 따라가며 자세 만들기
function setArms(c, dt, t, L, R, front = false, prop = null, bounce = 0) {
  const av = c.av, J = av.joints, k = Math.min(1, dt * 14);
  av.animate(dt, t, {});
  c.L += (L - c.L) * k; c.R += (R - c.R) * k;
  c.fx = (c.fx || 0) + ((front ? 1 : 0) - (c.fx || 0)) * k;
  // 앞으로 모으는 자세(가슴 하트)는 팔을 앞으로 내밀고 안쪽으로
  J.armL.rotation.set(-1.25 * c.fx, 0, c.L * (1 - c.fx) + 0.5 * c.fx);
  J.armR.rotation.set(-1.25 * c.fx, 0, c.R * (1 - c.fx) - 0.5 * c.fx);
  av.root.position.y = c.base + bounce;
  c.props.top.visible = prop === 'top'; c.props.chest.visible = prop === 'chest';
  if (prop) c.props[prop].scale.setScalar(0.85 + Math.abs(Math.sin(t * 8)) * 0.25);
}
const poseOf = (id) => POSES.find((p) => p.id === id);

export class KpopGame extends MiniGame {
  static meta = {
    id: 'kpop', title: '강남 K-팝 포즈 챌린지', duration: 60, hearts: 3, resultTitle: '무대 끝!', fov: 44, sky: '#120a22',
    hint: '1~5 (또는 ↑←→↓·Space) — 센터가 잡은 포즈와 같은 번호를 시간 안에!',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-4, 12, 9], size: 12, intensity: 1.3 });
    // 무대 + 바닥 네온 줄
    box(16, 0.6, 5.5, '#1e1a2e', 0, 0.3, -0.6, s);
    for (let i = -3; i <= 3; i++) { const l = box(0.06, 0.02, 5.4, new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff6ec7' : '#7fd8ff' }), i * 2, 0.61, -0.6, s); l.castShadow = false; }
    box(16, 0.08, 0.08, new THREE.MeshBasicMaterial({ color: '#ffe14f' }), 0, 0.62, 2.15, s).castShadow = false;
    box(30, 0.1, 14, '#0e0a18', 0, -0.05, 2, s);
    // LED 전광판 (캔버스로 그려서 움직임)
    const c = document.createElement('canvas'); c.width = 96; c.height = 32;
    this.led = { c, g: c.getContext('2d'), tex: canvasTexture(c), t: 0 };
    const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.1), new THREE.MeshBasicMaterial({ map: this.led.tex }));
    wall.position.set(0, 2.9, -3.4); s.add(wall);
    box(12.4, 4.4, 0.2, '#2a2236', 0, 2.9, -3.5, s);
    // 조명: 무대 위 반투명 빛기둥이 좌우로 훑음
    this.beams = [];
    const beamC = ['#ff6ec7', '#7fd8ff', '#ffe14f', '#b07cff'];
    for (let i = 0; i < 4; i++) {
      const pv = new THREE.Group(); pv.position.set(-4.5 + i * 3, 5.6, -1.6); s.add(pv);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5.4, 8, 1, true), new THREE.MeshBasicMaterial({ color: beamC[i], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = -2.7; pv.add(cone);
      box(0.4, 0.3, 0.4, '#3a3f4a', 0, 0.1, 0, pv);
      this.beams.push({ pv, ph: i * 1.3 });
    }
    // 아이돌 (센터 + 멤버 4명, 맞춘 무대 의상)
    const mkIdol = (i, x, z, lead = false) => {
      const sk = npcSkin({ shirt: lead ? '#ff6ec7' : '#f6f3ea', pants: '#1e1a24', hair: lead ? '#e8e2f0' : HAIRS[(i * 3 + 1) % HAIRS.length], skin: TONES[(i * 5) % TONES.length] });
      const av = new Avatar(sk, { height: lead ? 1.75 : 1.6 });
      const sp = av.s;
      for (const sx of [-1, 1]) box(2.6 * sp, 1.2 * sp, 5.4 * sp, lead ? '#ffe14f' : '#ff6ec7', sx * 4.3 * sp, 11.6 * sp, 0, av.torso); // 어깨 장식
      box(8.2 * sp, 0.8 * sp, 5.2 * sp, '#ffe14f', 0, 7.0 * sp, 0, av.torso); // 벨트
      box(0.6 * sp, 3 * sp, 0.6 * sp, '#2a2a2e', 5.2 * sp, 5.5 * sp, 3 * sp, av.joints.head); // 헤드셋 마이크
      av.root.position.set(x, 0.6, z); s.add(av.root);
      return this.dancer(av);
    };
    this.leader = mkIdol(0, 0, -1.3, true);
    this.members = [[-2.4, -1.9], [2.4, -1.9], [-4.6, -1.5], [4.6, -1.5]].map(([x, z], i) => mkIdol(i + 1, x, z));
    // 관객 (화면 아래쪽, 응원봉을 흔듦)
    this.crowd = [];
    const stickC = ['#ff6ec7', '#7fd8ff', '#ffe14f', '#5fc04a', '#b07cff'];
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group(), x = -7.6 + i * 0.9 + (i % 2) * 0.2, z = 3.6 + (i % 3) * 0.55;
      box(0.42, 0.42, 0.42, HAIRS[i % HAIRS.length], 0, 0.95, 0, g);
      box(0.5, 0.6, 0.3, ['#3a3f4a', '#4a3a5e', '#2f3a5a'][i % 3], 0, 0.45, 0, g);
      const st = new THREE.Group(); st.position.set(0.25, 0.8, 0.05); g.add(st);
      box(0.05, 0.3, 0.05, '#dddddd', 0, 0.15, 0, st); box(0.12, 0.2, 0.12, new THREE.MeshBasicMaterial({ color: stickC[i % stickC.length] }), 0, 0.38, 0, st);
      g.position.set(x, 0, z); s.add(g); this.crowd.push({ st, ph: i * 0.7 });
    }
    this.camera.position.set(0, 3.3, 9.2);
    this.camera.lookAt(0, 1.6, -0.8);
    this.useCam = loadPref();
    this.cam = cam; // 테스트·디버그용
    this.drawLed(0, 0);
  }
  dancer(av) { return { av, base: av.root.position.y, L: -0.3, R: 0.3, props: { top: makeHeart(av, 'top'), chest: makeHeart(av, 'chest') } }; }

  onAvatar() { this.player.position.set(3.4, 0.6, 1.3); this.me = this.dancer(this.avatar); }

  // 전광판: 흐르는 무지개 줄 + 글자, 박자마다 번쩍
  drawLed(t, flash) {
    const { g, c, tex } = this.led;
    for (let x = 0; x < c.width; x += 4) { g.fillStyle = `hsl(${(x * 4 + t * 120) % 360},90%,${30 + flash * 25}%)`; g.fillRect(x, 0, 4, c.height); }
    g.fillStyle = 'rgba(10,6,20,.55)'; g.fillRect(0, 9, c.width, 14);
    g.fillStyle = '#ffffff'; g.font = '700 11px Galmuri11, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('GANGNAM K-POP', c.width / 2, 16);
    tex.needsUpdate = true;
  }

  reset() {
    this.round = 0; this.perfects = 0; this.goods = 0; this.misses = 0;
    this.songT = 0; this.lastBeat = -1; this.flash = 0;
    this.player.position.set(3.4, 0.6, 1.3); this.me.base = 0.6;
    this.overlay();
    this.target = null; this.gapT = 0.6; this.myPose = null; this.myPoseT = 0; this.cand = null; this.candT = 0;
    if (this.useCam) this.openCam(); else cam.stop();
  }
  overlay() {
    const o = $('miniOverlay');
    const card = document.createElement('div'); card.className = 'kp-card hidden'; o.appendChild(card); this.cardEl = card;
    const ph = document.createElement('div'); ph.className = 'parade-phase kp-phase'; o.appendChild(ph); this.phaseEl = ph;
    const keys = document.createElement('div'); keys.className = 'parade-keys kp-keys';
    keys.innerHTML = POSES.map((p) => `<div data-p="${p.id}">${this.useCam ? '' : `<b>${p.key}</b>`}${p.icon} ${p.name}</div>`).join(''); // 어떻게 하는지는 포즈 카드에 (아래 줄이 넘치지 않게)
    o.appendChild(keys); this.keysEl = keys;
    const btn = document.createElement('button'); btn.className = 'btn parade-cam-btn';
    btn.textContent = this.useCam ? '⌨️ 키보드로 하기' : '🕺 몸으로 하기';
    btn.title = this.useCam ? '카메라를 끄고 숫자키로 해요' : '웹캠 앞에서 몸으로 포즈를 잡아요 (영상은 내 컴퓨터 밖으로 나가지 않아요)';
    btn.onclick = () => { sfx.click(); btn.blur(); this.setCam(!this.useCam); };
    o.appendChild(btn);
    if (this.useCam) o.appendChild(cam.canvas);
    if (this.camError) {
      const e = document.createElement('div'); e.className = 'parade-cam-err'; e.textContent = this.camError; o.appendChild(e);
      this.camError = null; setTimeout(() => e.remove(), 4000);
    }
  }

  // ---------- 카메라 켜기/끄기 (퍼레이드와 같은 방식) ----------
  setCam(on) { this.useCam = on; savePref(on); this.start(); }
  openCam() {
    if (cam.running) return;
    this.camPending = true;
    cam.start().then(() => {
      this.camPending = false;
      if (this.left) cam.stop(); // 켜는 사이에 나감
    }).catch((e) => {
      this.camPending = false;
      this.camError = e?.name === 'NotAllowedError' ? '카메라를 허용하지 않아서 키보드로 할게요' : `카메라를 켜지 못했어요 (${e?.message || e})`;
      if (this.left) { this.useCam = false; savePref(false); } else this.setCam(false);
    });
  }
  start() { this.left = false; super.start(); }
  update(dt, t, keys) {
    if (this.camPending && this.state === 'countdown') {
      $('countdown').classList.remove('hidden'); $('countdown').textContent = '📷';
      this.phaseEl.textContent = '카메라 준비 중… (처음엔 조금 걸려요)';
      this.idle(dt, t); return;
    }
    super.update(dt, t, keys);
  }
  setupHud() {
    super.setupHud();
    if (this.useCam) $('miniHint').textContent = '허리 위가 카메라에 다 보이게 서서 — 센터와 같은 포즈를 잡고 잠깐 멈춰요! 내 캐릭터가 내 팔을 따라 해요';
  }
  quit() { super.quit(); this.leave(); }
  leave() { this.left = true; cam.stop(); this.chosen = false; }
  get camChoice() { return { label: '🕺 몸으로 하기', desc: '웹캠 앞에서 허리 위가 보이게', how: '허리 위가 보이게 서서 센터와 같은 포즈를 잡고 0.4초 멈춰요. 내 캐릭터가 내 팔을 거울처럼 따라 해요', on: this.useCam, set: (on) => { this.useCam = on; savePref(on); } }; }

  // ---------- 진행 ----------
  newPose() {
    this.round++;
    let p; do p = POSES[(Math.random() * POSES.length) | 0]; while (p === this.target);
    this.target = p; this.limit = Math.max(LIMIT_MIN, LIMIT0 - (this.round - 1) * 0.12); this.poseT = 0; this.cand = null; this.candT = 0;
    this.cardEl.innerHTML = `<i>${p.icon}</i><b>${p.name}</b>${this.useCam ? `<small>${p.how}</small>` : ''}<span class="kp-bar"><span></span></span>`;
    this.cardEl.classList.remove('hidden', 'ok', 'bad'); void this.cardEl.offsetWidth; this.cardEl.classList.add('pop');
    sfx.note(880, 0.1, 'square', 0.05);
  }
  // 성공/실패 처리 (몸으로: 판정이 0.4초 유지되면 / 키보드: 키를 누르면)
  hit(id) {
    if (this.state !== 'play' || !this.target) return;
    const pos = this.player.position.clone().add(new THREE.Vector3(0, 2.4, 0));
    if (id !== this.target.id) { // 키보드로 다른 포즈 → 실수
      this.misses++; this.combo = 0; this.hurt(pos, `${this.target.name}였어요!`); this.endPose(false); return;
    }
    const perf = this.poseT < this.limit * 0.45;
    perf ? this.perfects++ : this.goods++;
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += (perf ? 10 : 6) + Math.min(this.combo, 10);
    sfx.gold(); this.flash = 1;
    this.float(pos, perf ? 'PERFECT!' : 'GOOD!', 'gold');
    this.myPose = id; this.myPoseT = 0.9;
    this.endPose(true);
  }
  endPose(ok) {
    this.cardEl.classList.add(ok ? 'ok' : 'bad');
    this.shown = this.target; this.shownT = 0.7; // 멤버들이 잠깐 그 포즈를 더 유지
    this.target = null; this.gapT = 0.7;
  }
  keyDown(code) {
    if (this.useCam && cam.running) return; // 몸으로 할 때는 몸으로만 (키 실수로 하트 잃지 않게)
    const p = POSES.find((x) => x.keys.includes(code)); if (p) this.hit(p.id);
  }

  // 무대 연출 (조명·관객·전광판·박자)
  stage(dt, t) {
    for (const b of this.beams) { b.pv.rotation.z = Math.sin(t * 1.1 + b.ph) * 0.55; b.pv.rotation.x = Math.cos(t * 0.8 + b.ph) * 0.25; }
    for (const c of this.crowd) c.st.rotation.z = Math.sin(t * (Math.PI * 2 / BEAT) * 0.5 + c.ph) * 0.6;
    this.flash = Math.max(0, (this.flash || 0) - dt * 4);
    this.led.t += dt;
    if ((this.ledT = (this.ledT || 0) + dt) > 0.08) { this.ledT = 0; this.drawLed(this.led.t, this.flash); }
  }
  beat() {
    const b = Math.floor(this.songT / BEAT + 0.0001);
    if (b === this.lastBeat) return;
    this.lastBeat = b;
    sfx.drum('kick'); if (b % 2 === 1) sfx.note(200, 0.07, 'sawtooth', 0.04);
    setTimeout(() => sfx.drum('hat'), BEAT * 500);
    sfx.note(BASS[b % BASS.length], BEAT * 0.8, 'triangle', 0.045);
  }

  // 모두의 자세: 포즈가 있으면 그 포즈, 없으면 박자 그루브
  pose(c, dt, t, p) {
    const g = Math.sin(this.songT * Math.PI * 2 / BEAT);
    if (p) setArms(c, dt, t, p.L ?? 0, p.R ?? 0, p.front, p.prop, 0.04 * Math.abs(g));
    else setArms(c, dt, t, -0.3 + g * 0.15, 0.3 + g * 0.15, false, null, Math.abs(g) * 0.05);
  }
  // 내 캐릭터: 몸으로 하면 내 팔을 거울처럼, 포즈가 잡히면 그 포즈 그대로
  poseMe(dt, t, body) {
    if (this.myPoseT > 0) { this.myPoseT -= dt; this.pose(this.me, dt, t, poseOf(this.myPose)); return; }
    if (body) {
      const p = body.pose && poseOf(body.pose);
      if (p && (p.front || p.prop)) this.pose(this.me, dt, t, p); // 앞으로 모으는 포즈·하트는 화면 각도로 안 보이므로 포즈 그대로
      else setArms(this.me, dt, t, body.L, body.R, false, null, 0);
      return;
    }
    this.pose(this.me, dt, t, null);
  }

  idle(dt, t) {
    this.songT = t;
    const body = this.useCam && cam.running && cam.joints ? readBody(cam.joints, cam.asp) : null;
    for (const c of [this.leader, ...this.members]) this.pose(c, dt, t, null);
    if (this.state === 'done') this.me.av.animate(dt, t, { wave: true }); else this.poseMe(dt, t, body);
    this.stage(dt, t);
  }

  step(dt, t) {
    this.songT += dt;
    this.beat();
    // 몸 포즈 읽기
    const body = this.useCam && cam.running && cam.joints ? readBody(cam.joints, cam.asp) : null;
    if (this.useCam) cam.label = body?.pose ? `${poseOf(body.pose).icon} ${poseOf(body.pose).name}` : '포즈를 잡아 보세요';
    if (!this.target) {
      this.gapT -= dt;
      if (this.gapT <= 0) this.newPose();
    } else {
      this.poseT += dt;
      // 몸으로: 같은 포즈를 HOLD초 유지하면 성공 (다른 포즈는 벌 없음 — 바꿔 보면 됨)
      if (body) {
        if (body.pose === this.cand) this.candT += dt; else { this.cand = body.pose; this.candT = 0; }
        if (this.cand === this.target.id && this.candT >= HOLD) this.hit(this.cand);
      }
      if (this.target) {
        const left = 1 - this.poseT / this.limit;
        this.cardEl.querySelector('.kp-bar span').style.width = `${Math.max(0, left) * 100}%`;
        this.phaseEl.textContent = this.useCam ? `🎤 포즈! ${this.cand === this.target.id ? '그대로 멈춰요!' : ''}` : '🎤 포즈! 같은 번호를 눌러요';
        this.phaseEl.classList.add('mine');
        if (left <= 0) { // 시간 끝
          this.misses++; this.combo = 0;
          this.hurt(this.player.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '시간 끝!');
          this.endPose(false);
        }
      }
    }
    if (!this.target) { this.phaseEl.textContent = '✨'; this.phaseEl.classList.remove('mine'); }
    // 센터·멤버: 지금 포즈 (끝난 뒤에도 잠깐 유지), 아니면 그루브
    this.shownT = Math.max(0, (this.shownT || 0) - dt);
    const show = this.target || (this.shownT > 0 ? this.shown : null);
    this.pose(this.leader, dt, t, show);
    for (const m of this.members) this.pose(m, dt, t, this.target ? null : show); // 멤버는 성공 뒤에 같이 포즈
    this.poseMe(dt, t, body);
    this.keysEl.querySelectorAll('[data-p]').forEach((el) => el.classList.toggle('on', !!body && el.dataset.p === body.pose));
    this.stage(dt, t);
  }

  // 등급: 완벽 1, 좋아요 0.7, 실수 0
  accuracy() { const n = this.perfects + this.goods + this.misses; return n ? (this.perfects + this.goods * 0.7) / n : 0; }
  grade() { const a = this.accuracy(); return a >= 0.9 ? 'S' : a >= 0.75 ? 'A' : a >= 0.5 ? 'B' : 'C'; }
  resultTitle() { return { S: '데뷔 확정!', A: '데뷔 조 합격!', B: '연습생 생활 계속!', C: '다시 도전해요!' }[this.grade()]; }
  extraText() { return `${this.round || 0}번째 포즈 · 콤보 ${this.combo || 0}`; }
  resultRows() {
    return [['최고 등급', `${this.grade()} (정확도 ${Math.round(this.accuracy() * 100)}%)`], ['성공한 포즈', `${this.perfects + this.goods}개`], ['완벽 / 좋아요', `${this.perfects} / ${this.goods}`], ['실수·시간 끝', `${this.misses}번`], ['최대 콤보', `${this.maxCombo}`]];
  }
}
