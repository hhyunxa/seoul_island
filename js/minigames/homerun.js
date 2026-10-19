import * as THREE from 'three';
import { rbox } from '../toon.js';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';
import { npcSkin } from './npc.js';

const $ = (id) => document.getElementById(id);
const PITCHES = 10;
const MOUND = new THREE.Vector3(0, 1.45, -11);   // 공이 손을 떠나는 곳
const PLATE = new THREE.Vector3(0, 0.9, 0.35);   // 공이 홈 플레이트를 지나는 곳
const BASE_LOOK = new THREE.Vector3(0, 0.9, -6); // 평소 카메라가 보는 곳
// 배트 방향(y회전): 0이면 홈 플레이트 쪽(+x)을 가로지름. 일정한 속도로 돌아서 CONTACT 때 딱 0이 되게 맞춤
const BAT_READY = -1.6, SWING_T = 0.32, BAT_FINISH = BAT_READY - (BAT_READY * SWING_T) / 0.12;
const CONTACT = 0.12;                            // 스윙 시작 → 배트가 공 자리에 오기까지 (초)
const WIN_HR = 0.055, WIN_HIT = 0.11, WIN_FOUL = 0.2; // 타이밍 판정 (초)
const SWING_V = 1.6;                             // 손 모드: 이보다 빨리 옆으로 움직이면 스윙 (화면 너비/초)
const TYPES = [
  { k: 'fast', name: '직구', t: 0.82, curve: 0 },
  { k: 'curve', name: '커브', t: 0.98, curve: 0.55 },
  { k: 'slow', name: '느린 공', t: 1.3, curve: 0 },
];

// 잠실야구장 홈런 더비: 공이 홈에 오는 순간 맞춰 휘두르기, 10구
export class HomerunGame extends MiniGame {
  static meta = {
    id: 'homerun', title: '잠실야구장 홈런 더비', duration: 0, hearts: 0, resultTitle: '경기 끝!', fov: 44, sky: '#8fd0f5',
    hint: 'Space · 클릭 = 배트 휘두르기 — 공이 홈 플레이트에 오는 순간 딱! 맞추면 홈런',
  };

  build() {
    this.camCtl = new CamControl(this, { hint: '✋ 두 손을 모아 배트를 잡듯이 → 공이 오면 옆으로 휙 휘두르기!' });
    const s = this.scene;
    this.lights({ pos: [-5, 16, 8], size: 16 });
    // 잔디 + 내야 흙 + 마운드 + 홈 플레이트
    this.tileGround(44, 46, () => 'grass', 33).position.z = -14;
    const dirt = box(9, 0.03, 9, '#c98a46', 0, 0.015, -5.6, s); dirt.rotation.y = Math.PI / 4; dirt.receiveShadow = true;
    const inner = box(5.6, 0.04, 5.6, '#6fbf4a', 0, 0.02, -5.6, s); inner.rotation.y = Math.PI / 4;
    box(1.8, 0.2, 1.8, '#c98a46', 0, 0.1, -11, s);
    box(0.5, 0.03, 0.5, '#ffffff', 0, 0.06, 0.35, s);
    for (const [x, z] of [[4, -5.6], [0, -9.6], [-4, -5.6]]) box(0.4, 0.06, 0.4, '#ffffff', x, 0.05, z, s); // 베이스
    for (const sx of [-1, 1]) { const l = box(0.06, 0.02, 30, '#ffffff', sx * 10.6, 0.04, -10.6, s); l.rotation.y = sx * Math.PI / 4; } // 파울 라인
    // 외야 펜스 + 관중석 + 전광판 + 조명탑
    box(44, 1.4, 0.3, '#2f6fd8', 0, 0.7, -32, s);
    const crowd = ['#e8413a', '#ffd23f', '#ffffff', '#2f7fd8', '#5fc04a', '#f4a6c0'];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 26; i++) {
      box(1.6, 0.9, 1, row % 2 ? '#3a3f4a' : '#4a5060', -20 + i * 1.6, 1.8 + row * 0.9, -33.5 - row * 1, s);
      if ((i + row) % 2 === 0) box(0.4, 0.4, 0.3, crowd[(i * 3 + row) % crowd.length], -20 + i * 1.6, 2.45 + row * 0.9, -33.1 - row * 1, s);
    }
    const sb = new THREE.Mesh(rbox(8, 2.2, 0.3), new THREE.MeshBasicMaterial({ map: signTexture('잠실 홈런 더비', { w: 128, h: 36, size: 15, bg: '#1a2a1a', fg: '#ffe14f' }) }));
    sb.position.set(0, 7.6, -37); s.add(sb);
    box(8.4, 2.6, 0.2, '#2a2a2e', 0, 7.6, -37.2, s); box(0.4, 6.5, 0.4, '#555', 0, 3.25, -37.3, s);
    for (const x of [-18, 18]) { box(0.4, 12, 0.4, '#d8d4cc', x, 6, -30, s); box(3, 1.2, 0.3, new THREE.MeshBasicMaterial({ color: '#fff6c8' }), x, 12.2, -30, s); }
    // 투수 (빨간 유니폼)
    this.pitcher = new Avatar(npcSkin({ shirt: '#e8413a', pants: '#f4f1ea', hair: '#1e1a18' }), { height: 1.6 });
    this.pitcher.root.position.set(0, 0.2, -11); this.pitcher.root.rotation.y = 0; s.add(this.pitcher.root);
    // 공 + 그림자
    this.ball = new THREE.Group();
    box(0.2, 0.2, 0.2, '#ffffff', 0, 0, 0, this.ball); box(0.21, 0.035, 0.07, '#e8413a', 0, 0.05, 0, this.ball); box(0.07, 0.035, 0.21, '#e8413a', 0, -0.05, 0, this.ball);
    s.add(this.ball);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 }));
    this.shadow.rotation.x = -Math.PI / 2; s.add(this.shadow);
    // 배트 (타자 손 위치에서 y축으로 돌며 휘두름)
    this.bat = new THREE.Group(); s.add(this.bat);
    box(0.95, 0.09, 0.09, '#c98a46', 0.5, 0, 0, this.bat); box(0.25, 0.12, 0.12, '#8a5428', 0.9, 0, 0, this.bat); box(0.12, 0.07, 0.07, '#2a2a2e', 0.04, 0, 0, this.bat);
    this.bat.position.set(-0.55, 1.05, 0.25);
    this.camera.position.set(0.7, 3.1, 7.2);
    this.look = BASE_LOOK.clone(); this.camera.lookAt(this.look);
  }

  // 나 = 오른손 타자 (포수 쪽에서 보면 홈 플레이트 왼쪽, 투수 쪽을 봄)
  onAvatar() { this.player.position.set(-0.95, 0, 0.35); this.player.rotation.y = Math.PI / 2; }

  reset() {
    this.n = 0; this.hr = 0; this.hits = 0; this.fouls = 0; this.misses = 0; this.longest = 0; this.hrStreak = 0; this.maxStreak = 0;
    this.swingT = -1; this.lastX = null; this.vx = 0; this.cool = 0;
    const o = $('miniOverlay');
    const el = document.createElement('div'); el.className = 'hr-info'; o.appendChild(el); this.infoEl = el;
    this.look.copy(BASE_LOOK); this.camera.lookAt(this.look);
    this.nextPitch();
  }

  nextPitch() {
    this.n++;
    const prog = (this.n - 1) / (PITCHES - 1);
    const base = this.n <= 2 ? TYPES[2] : this.n <= 4 ? TYPES[0] : TYPES[(Math.random() * 3) | 0];
    this.type = { ...base, t: base.t * (1 - prog * 0.18) }; // 뒤로 갈수록 빨라짐
    this.curveDir = Math.random() < 0.5 ? -1 : 1;
    this.phase = 'wait'; this.waitT = 1.3; this.ballT = 0; this.judged = false; this.fly = null;
    this.ball.position.copy(MOUND); this.ball.visible = false;
    this.infoEl.innerHTML = `투구 <b>${this.n}</b>/${PITCHES} · <span>${this.type.name}</span>`;
  }

  // 공 위치 (던진 뒤 t초)
  pitchPos(t) {
    const k = t / this.type.t;
    const p = MOUND.clone().lerp(PLATE, k);
    p.y += Math.sin(Math.min(1, k) * Math.PI) * 0.35;                       // 살짝 포물선
    p.x += this.type.curve * this.curveDir * Math.sin(Math.min(1, k) * Math.PI) * (1 - k * 0.6); // 커브는 옆으로 휘었다가 들어옴
    return p;
  }

  swing() {
    if (this.state !== 'play' || this.swingT >= 0) return;
    this.swingT = 0;
    sfx.jump();
    if (this.phase !== 'pitch' || this.judged) return; // 공이 안 올 때 휘두르면 그냥 연습 스윙
    this.judged = true;
    const eff = this.ballT + CONTACT - this.type.t; // 배트가 오는 순간 - 공이 오는 순간 (+면 늦음)
    const a = Math.abs(eff);
    if (a < WIN_HR) this.hit('hr', eff);
    else if (a < WIN_HIT) this.hit('hit', eff);
    else if (a < WIN_FOUL) this.hit('foul', eff);
    else this.pendingMiss = true; // 헛스윙: 공은 그대로 포수에게
  }
  keyDown(code) { if (code === 'Space' || code === 'Enter') this.swing(); }
  pointerDown() { this.swing(); }

  // 배트에 맞은 공이 날아갈 궤적을 정하고 점수 계산 (실제로 맞는 건 배트가 공 자리에 올 때)
  hit(kind, eff) {
    this.hitKind = kind; this.hitEff = eff;
  }
  launch() {
    const kind = this.hitKind, eff = this.hitEff, from = this.ball.position.clone();
    const side = eff < 0 ? -1 : 1; // 빠르면 왼쪽(당겨 침), 늦으면 오른쪽
    let to, h, dur, dist = 0, text, cls = 'gold', pts = 0;
    if (kind === 'hr') {
      dist = 110 + Math.round(Math.random() * 30);
      to = new THREE.Vector3(side * Math.random() * 6, 6, -46); h = 14; dur = 2.2;
      this.hr++; this.hrStreak++; this.maxStreak = Math.max(this.maxStreak, this.hrStreak);
      pts = 30 + (this.hrStreak - 1) * 10;
      text = this.hrStreak > 1 ? `홈런!! ${this.hrStreak}연속 +${pts}` : `홈런!! +${pts}`;
      sfx.gold(); setTimeout(() => sfx.end(), 300);
    } else if (kind === 'hit') {
      dist = 45 + Math.round(Math.random() * 40);
      to = new THREE.Vector3(side * (2 + Math.random() * 5), 0.1, -14 - Math.random() * 8); h = 3; dur = 1.3;
      this.hits++; this.hrStreak = 0; pts = 10; text = `안타! +${pts}`;
      sfx.catch(6);
    } else {
      to = new THREE.Vector3(side * 16, 0.1, -2 + Math.random() * 4); h = 4; dur = 1.1;
      this.fouls++; this.hrStreak = 0; pts = 2; text = `파울 +${pts}`; cls = '';
      sfx.catch(1);
    }
    this.longest = Math.max(this.longest, dist);
    this.score += pts;
    if (kind !== 'foul') { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); } else this.combo = 0;
    this.fly = { from, to, h, dur, t: 0 };
    this.float(new THREE.Vector3(0, 2.6, -1.5), dist ? `${text} · ${dist}m` : text, cls);
    if (kind === 'hr') for (let i = 0; i < 5; i++) setTimeout(() => this.float(new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 2, -6), ['🎆', '✨', '🎉'][i % 3], 'gold'), 150 + i * 160);
    this.phase = 'result'; this.resultT = dur + 0.6;
  }

  idle(dt, t) {
    this.pitcher.animate(dt, t, { wave: this.state === 'done' });
    this.avatar.animate(dt, t, { yaw: Math.PI / 2, armsUp: this.state === 'done' && this.hr >= 5 });
    this.pose(dt);
  }

  // 배트 + 팔 자세 (휘두르는 중이면 돌아감)
  pose(dt) {
    const J = this.avatar.joints;
    let a;
    if (this.swingT >= 0) {
      this.swingT += dt;
      // 오른손 타자 스윙: 어깨 뒤(포수 쪽) → CONTACT 순간 홈 플레이트 위를 가로질러(a=0) → 투수 쪽으로 팔로스루
      const k = Math.min(1, this.swingT / SWING_T);
      a = THREE.MathUtils.lerp(BAT_READY, BAT_FINISH, k);
      if (this.swingT > 0.6) this.swingT = -1;
    } else a = BAT_READY + Math.sin(performance.now() / 300) * 0.05; // 준비 자세에서 살짝 까딱
    this.bat.rotation.set(0, a, this.swingT >= 0 ? 0.15 : 0.7);
    // 두 팔을 배트 쪽으로 (몸이 +x를 보므로 팔 x회전 = 앞뒤)
    for (const j of [J.armL, J.armR]) { j.rotation.x = -1.2; j.rotation.z = 0; }
  }

  step(dt, t) {
    this.pitcher.animate(dt, t, { armsUp: this.phase === 'wait' && this.waitT < 0.7 && this.waitT > 0.15 });
    this.avatar.animate(dt, t, { yaw: Math.PI / 2 });
    // 손 모드: 두 손(가운데)이 옆으로 빨리 움직이면 스윙
    const hc = this.camCtl.on && this.camCtl.hands.center();
    this.cool = Math.max(0, this.cool - dt);
    if (hc) {
      if (this.lastX !== null) this.vx += ((hc.x - this.lastX) / Math.max(dt, 0.016) - this.vx) * Math.min(1, dt * 25);
      this.lastX = hc.x;
      if (Math.abs(this.vx) > SWING_V && this.cool <= 0) { this.cool = 0.7; this.swing(); }
    } else { this.lastX = null; this.vx = 0; }

    if (this.phase === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) { this.phase = 'pitch'; this.ballT = 0; this.ball.visible = true; this.pendingMiss = false; this.hitKind = null; sfx.miss(); }
    } else if (this.phase === 'pitch') {
      this.ballT += dt;
      this.ball.position.copy(this.pitchPos(this.ballT));
      this.ball.rotation.x += dt * 20;
      // 배트가 공 자리에 온 순간 맞음
      if (this.hitKind && this.swingT >= CONTACT) this.launch();
      else if (this.ballT > this.type.t + 0.35) { // 포수 미트로
        this.misses++; this.hrStreak = 0; this.combo = 0;
        sfx.miss();
        this.float(new THREE.Vector3(0, 2.4, -1), this.pendingMiss ? '헛스윙!' : '스트라이크!', 'bad');
        this.phase = 'result'; this.resultT = 0.9; this.ball.visible = false;
      }
    } else if (this.phase === 'result') {
      this.resultT -= dt;
      if (this.fly) {
        const f = this.fly; f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        this.ball.position.lerpVectors(f.from, f.to, k);
        this.ball.position.y += Math.sin(k * Math.PI) * f.h;
        this.ball.rotation.x += dt * 25;
        if (k >= 1) this.ball.visible = false;
      }
      if (this.resultT <= 0) { if (this.n >= PITCHES) { this.infoEl.innerHTML = ''; this.finish(); return; } this.nextPitch(); }
    }
    // 홈런이면 카메라가 날아가는 공을 올려다봄
    const want = this.fly && this.hitKind === 'hr' && this.ball.visible ? BASE_LOOK.clone().lerp(this.ball.position, 0.45) : BASE_LOOK;
    this.look.lerp(want, Math.min(1, dt * 4)); this.camera.lookAt(this.look);
    this.shadow.visible = this.ball.visible;
    this.shadow.position.set(this.ball.position.x, 0.03, this.ball.position.z);
    this.pose(dt);
  }

  extraText() { return `홈런 ${this.hr || 0} · 안타 ${this.hits || 0}`; }
  resultTitle() { return this.hr >= 5 ? '홈런왕 등극!' : '경기 끝!'; }
  resultRows() {
    return [['홈런 / 안타', `${this.hr} / ${this.hits}`], ['파울 / 헛스윙·스트라이크', `${this.fouls} / ${this.misses}`], ['최장 비거리', this.longest ? `${this.longest}m` : '-'], ['최대 연속 홈런', `${this.maxStreak}번`]];
  }
}
