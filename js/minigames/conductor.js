import * as THREE from 'three';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { plankTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

const $ = (id) => document.getElementById(id);
const STAGE_Y = 0.6; // 무대 높이
// 환희의 송가 (베토벤 9번) — 한 박자에 한 음, 0은 쉼표(북만)
const C = 523, D = 587, E = 659, F = 698, G = 784, G3 = 392;
const MELODY = [E, E, F, G, G, F, E, D, C, C, D, E, E, D, D, 0, E, E, F, G, G, F, E, D, C, C, D, E, D, C, C, 0,
  D, D, E, C, D, F, E, C, D, F, E, D, C, D, G3, 0, E, E, F, G, G, F, E, D, C, C, D, E, D, C, C, 0];
const BASS = [131, 98, 131, 98, 131, 98, 131, 131, 98, 131, 98, 131, 131, 98, 131, 131]; // 마디마다 낮은 음 (도·솔)
// 구간: 12초마다 바뀜. bpm = [최소, 최대], loud = 'hi'(세게) / 'lo'(여리게) / null
const SECTIONS = [
  { name: '보통 빠르기', it: 'Moderato', tip: '걷는 빠르기로 또박또박', bpm: [85, 125], loud: null },
  { name: '빠르게', it: 'Allegro', tip: '신나게 빠르게!', bpm: [130, 190], loud: null },
  { name: '느리게', it: 'Adagio', tip: '천천히… 아주 느긋하게', bpm: [45, 80], loud: null },
  { name: '세게', it: 'forte', tip: '손을 높이! 크게 크게', bpm: [70, 150], loud: 'hi' },
  { name: '여리게', it: 'piano', tip: '손을 낮게, 살금살금', bpm: [60, 140], loud: 'lo' },
];
const SEC_T = 12;
const BPM_MIN = 40, BPM_MAX = 200;
const LOUD_HI = 0.62, LOUD_LO = 0.38;

// 예술의전당 지휘자: 내가 휘두를 때마다 오케스트라가 한 박자씩 연주
export class ConductorGame extends MiniGame {
  static meta = {
    id: 'conductor', title: '예술의전당 지휘자 체험', duration: 60, hearts: 0, resultTitle: '연주 끝!', fov: 42, sky: '#1a1424',
    hint: 'Space · 클릭 = 한 박자 (누르는 간격 = 빠르기) · ↑/↓ = 세게/여리게 — 위에 나온 지시대로 지휘해요!',
  };

  build() {
    this.camCtl = new CamControl(this, {
      hint: '✋ 손을 위에서 아래로 휙 내릴 때마다 한 박자 · 손을 높이 들면 세게, 낮추면 여리게',
      onEvent: (type) => { if (type === 'stroke') this.beat(); },
    });
    const s = this.scene;
    this.lights({ pos: [-3, 12, 8], size: 10, intensity: 1.7 });
    // 객석 바닥 + 무대 + 뒷벽 + 파이프오르간 + 빨간 커튼
    box(20, 0.1, 12, '#2a1f30', 0, -0.05, 4, s).receiveShadow = true;
    const plank = new THREE.MeshLambertMaterial({ map: plankTexture('#b5763b', '#8a5428', '#cf9150') });
    plank.map.repeat.set(8, 4);
    box(12, STAGE_Y, 7, plank, 0, STAGE_Y / 2, -2.5, s).receiveShadow = true;
    box(12, 7, 0.3, '#3a2a3a', 0, 3.5, -6, s);
    for (let i = 0; i < 13; i++) { const h = 2.2 + Math.sin((i / 12) * Math.PI) * 1.6; box(0.32, h, 0.2, '#d9b44a', -2.4 + i * 0.4, STAGE_Y + 2.4 + h / 2, -5.75, s); }
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) box(0.4, 6.2, 0.4, k % 2 ? '#8f2a26' : '#a8322d', side * (5.6 - k * 0.32), 3.1, -0.6 + k * 0.05, s);
    box(12, 0.8, 0.4, '#8f2a26', 0, 6.4, -0.6, s);
    // 오케스트라: 지휘자를 둘러싼 반원 (모두 지휘자 쪽 +z를 봄)
    this.players = [];
    // 지휘대(0, 1.4)를 중심으로 앞줄 바이올린, 둘째 줄 첼로·트럼펫(단 위), 맨 뒤 팀파니
    const ring = (r, n, a0, a1, kind, up) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1);
        this.addPlayer(Math.sin(a) * r, 1.4 - Math.cos(a) * r, kind, this.players.length, up);
      }
    };
    ring(2.7, 6, -1.25, 1.25, 'violin', 0);
    ring(4.0, 4, -1.1, -0.3, 'cello', 0.25);
    ring(4.0, 3, 0.3, 1.1, 'trumpet', 0.25);
    this.addPlayer(0, -3.8, 'timpani', this.players.length, 0.5);
    box(8.6, 0.25, 1.6, '#8a5428', 0, STAGE_Y + 0.125, -2.0, s); // 둘째 줄 단
    box(3.2, 0.5, 1.2, '#7a4a26', 0, STAGE_Y + 0.25, -3.9, s);   // 팀파니 단
    // 지휘대
    box(1.0, 0.3, 0.8, '#7a2a2a', 0, STAGE_Y + 0.15, 1.4, s);
    // 객석 관객 (뒷모습 실루엣)
    this.audience = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i < 11; i++) {
      const g = new THREE.Group(); g.position.set(-5 + i + (row % 2) * 0.5, 0, 3.2 + row * 1.0);
      box(0.5, 0.45, 0.4, '#3a2f48', 0, 0.62, 0, g); box(0.34, 0.32, 0.32, '#2a2238', 0, 1.0, 0, g);
      s.add(g); this.audience.push({ g, ph: Math.random() * 6, jump: 0 });
    }
    this.camera.position.set(0, 4.3, 7.8);
    this.camera.lookAt(0, 1.3, -1.8);
  }

  addPlayer(x, z, kind, i, up = 0) {
    const sk = npcSkin({ shirt: i % 3 === 0 ? '#ffffff' : '#1e1e24', pants: '#1e1e24', hair: HAIRS[(i * 5) % HAIRS.length], skin: TONES[(i * 3) % TONES.length] });
    const av = new Avatar(sk, { height: 1.3 });
    av.root.position.set(x, STAGE_Y + up, z);
    av.root.rotation.y = Math.atan2(-x, 1.4 - z) * 0.6; // 지휘자 쪽으로 살짝 고개
    const T = av.torso, s = av.s;
    if (kind === 'violin') { box(0.2, 0.1, 0.46, '#a0521e', 0, 0.02, 0.22, av.joints.armL).rotation.x = 0.4; box(0.03, 0.03, 0.6, '#e9d9b0', 0, -0.3, 0.12, av.joints.armR); }
    if (kind === 'cello') { box(0.4, 0.8, 0.18, '#a0521e', 0.2, 0.45, 0.3, av.root); box(0.04, 0.45, 0.04, '#3a2410', 0.2, 1.05, 0.3, av.root); }
    if (kind === 'trumpet') { box(0.1, 0.1, 0.5, '#e2b94e', 0, 9 * s, 0.36, T); box(0.2, 0.2, 0.06, '#f2cf5e', 0, 9 * s, 0.62, T); }
    if (kind === 'timpani') { for (const dx of [-0.45, 0.45]) { box(0.5, 0.4, 0.5, '#c98a46', dx, 0.2, 0.45, av.root); box(0.52, 0.04, 0.52, '#f4ead8', dx, 0.42, 0.45, av.root); } }
    this.scene.add(av.root);
    this.players.push({ av, kind, pulse: 0, ph: i * 0.7, y: STAGE_Y + up });
  }

  onAvatar() {
    // 나 = 지휘자 (뒷모습), 오른손에 지휘봉
    this.player.position.set(0, STAGE_Y + 0.3, 1.4); this.player.rotation.y = Math.PI;
    box(0.03, 0.03, 0.5, '#ffffff', 0, -0.48, 0.2, this.avatar.joints.armR);
  }

  reset() {
    this.elapsed = 0; this.sec = -1; this.ivs = []; this.lastBeatT = null; this.bpm = 0;
    this.level = 0.5; this.noteI = 0; this.swing = 0;
    this.judged = 0; this.good = 0; this.streak = 0; this.bravo = 0;
    this.overlay();
    this.setSection(0, false);
    this.updateMeters();
  }
  overlay() {
    const o = $('miniOverlay');
    const sec = document.createElement('div'); sec.className = 'cd-section'; o.appendChild(sec); this.secEl = sec;
    const m = document.createElement('div'); m.className = 'panel small cd-meters';
    m.innerHTML = `<div class="cd-row"><span>빠르기</span><div class="cd-bar"><b class="zone"></b><i></i></div><em class="bpm">-</em></div>
      <div class="cd-row"><span>세기</span><div class="cd-bar loud"><b class="zone"></b><i></i></div><em class="lv">-</em></div>`;
    o.appendChild(m);
    this.tZone = m.querySelector('.cd-bar .zone'); this.tNeedle = m.querySelector('.cd-bar i'); this.bpmEl = m.querySelector('.bpm');
    this.lZone = m.querySelector('.cd-bar.loud .zone'); this.lNeedle = m.querySelector('.cd-bar.loud i'); this.lvEl = m.querySelector('.lv');
  }

  setSection(i, announce = true) {
    this.sec = i;
    const S = SECTIONS[i];
    this.secEl.innerHTML = `<b>${S.name} <small>(${S.it})</small></b><span>${S.tip}</span>`;
    this.secEl.classList.remove('pop'); void this.secEl.offsetWidth; this.secEl.classList.add('pop');
    const pct = (v) => ((v - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    this.tZone.style.left = `${pct(S.bpm[0])}%`; this.tZone.style.width = `${pct(S.bpm[1]) - pct(S.bpm[0])}%`;
    const [l0, l1] = S.loud === 'hi' ? [LOUD_HI, 1] : S.loud === 'lo' ? [0, LOUD_LO] : [0, 1];
    this.lZone.style.left = `${l0 * 100}%`; this.lZone.style.width = `${(l1 - l0) * 100}%`;
    this.lZone.classList.toggle('any', !S.loud);
    if (announce) { sfx.tick(); this.float(new THREE.Vector3(0, 3.6, -2), `${S.name}!`, 'gold'); }
  }

  updateMeters() {
    const bpm = this.bpm && this.elapsed - this.lastBeatT < 2.5 ? this.bpm : 0;
    this.tNeedle.style.left = `${THREE.MathUtils.clamp((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN), 0, 1) * 100}%`;
    this.tNeedle.style.opacity = bpm ? 1 : 0.3;
    this.bpmEl.textContent = bpm ? `♩=${Math.round(bpm)}` : '-';
    this.lNeedle.style.left = `${this.level * 100}%`;
    this.lvEl.textContent = this.level >= LOUD_HI ? '세게' : this.level <= LOUD_LO ? '여리게' : '보통';
  }

  keyDown(code) { if (code === 'Space' || code === 'Enter') this.beat(); }
  pointerDown() { this.beat(); }

  // 한 박자: 음 하나 연주 + 빠르기·세기 판정
  beat() {
    if (this.state !== 'play') return;
    const now = this.elapsed;
    if (this.lastBeatT !== null) {
      const iv = now - this.lastBeatT;
      if (iv < 0.16) return; // 너무 빠른 연타는 무시
      if (iv < 2.5) { this.ivs.push(iv); if (this.ivs.length > 2) this.ivs.shift(); } else this.ivs = [];
    }
    this.lastBeatT = now;
    this.bpm = this.ivs.length ? 60 / (this.ivs.reduce((a, b) => a + b, 0) / this.ivs.length) : 0;
    // 연주: 세기에 따라 소리 크기
    const vol = 0.02 + this.level * 0.07, i = this.noteI++;
    const note = MELODY[i % MELODY.length];
    if (note) sfx.note(note, 0.3, 'square', vol);
    if (i % 4 === 0) sfx.note(BASS[Math.floor(i / 4) % BASS.length], 0.45, 'triangle', vol * 1.1);
    sfx.drum(i % 2 === 0 ? 'kick' : 'hat');
    for (const p of this.players) p.pulse = 1;
    this.swing = 1;
    // 판정 (첫 박은 빠르기를 아직 모르니 빼고)
    if (!this.bpm) return;
    const S = SECTIONS[this.sec];
    const tempoOk = this.bpm >= S.bpm[0] && this.bpm <= S.bpm[1];
    const loudOk = !S.loud || (S.loud === 'hi' ? this.level >= LOUD_HI : this.level <= LOUD_LO);
    this.judged++;
    const pos = new THREE.Vector3(0, 3.2, -1.5);
    if (tempoOk && loudOk) {
      this.good++; this.streak++; this.combo = this.streak; this.maxCombo = Math.max(this.maxCombo, this.streak);
      this.score += 2 + Math.floor(Math.min(this.streak, 10) / 2);
      if (this.streak % 8 === 0) {
        this.bravo++; this.score += 10; sfx.gold();
        this.float(new THREE.Vector3(0, 2.2, 3.5), '브라보! 👏 +10', 'gold');
        for (const a of this.audience) a.jump = 0.5 + Math.random() * 0.3;
      }
    } else {
      this.streak = 0; this.combo = 0;
      const msg = !tempoOk ? (this.bpm < S.bpm[0] ? '더 빠르게!' : '더 느리게!') : S.loud === 'hi' ? '손을 더 높이!' : '손을 더 낮게!';
      this.float(pos, msg, 'bad');
    }
  }

  // 오케스트라·관객·지휘자 움직임
  animateAll(dt, t) {
    for (const p of this.players) {
      p.pulse = Math.max(0, p.pulse - dt * 3);
      const av = p.av, k = p.pulse;
      av.animate(dt, t, {});
      av.root.position.y = p.y + Math.sin(k * Math.PI) * 0.06;
      av.torso.rotation.x = -k * 0.12;
      if (p.kind === 'violin') { av.joints.armL.rotation.set(-1.3, 0, -0.5); av.joints.armR.rotation.set(-1.0 - Math.sin(t * 6 + p.ph) * 0.25 * (0.3 + k), 0, 0.5); }
      if (p.kind === 'trumpet') { av.joints.armL.rotation.set(-1.4, 0, 0.3); av.joints.armR.rotation.set(-1.4, 0, -0.3); }
      if (p.kind === 'cello') av.joints.armR.rotation.set(-0.6, 0, 0.3 + Math.sin(t * 5 + p.ph) * 0.25 * (0.3 + k));
      if (p.kind === 'timpani') { const hit = k > 0.7 ? -1.6 : -0.9; av.joints.armL.rotation.set(hit, 0, 0); av.joints.armR.rotation.set(hit, 0, 0); }
    }
    for (const a of this.audience) {
      a.jump = Math.max(0, a.jump - dt);
      a.g.position.y = a.jump > 0 ? Math.abs(Math.sin(a.jump * 14)) * 0.25 : Math.sin(t * 1.5 + a.ph) * 0.01;
    }
    // 지휘자: 휘두르면 지휘봉 든 팔이 위에서 아래로, 세기에 따라 팔 높이
    this.swing = Math.max(0, (this.swing || 0) - dt * 4);
    this.avatar.animate(dt, t, {});
    const J = this.avatar.joints, lift = 0.6 + (this.level ?? 0.5) * 1.6;
    J.armR.rotation.set(-(lift + 0.6) + Math.sin(this.swing * Math.PI) * 0.9, 0, -0.25); // 박자마다 위→아래→위
    J.armL.rotation.set(-lift * 0.7, 0, 0.35);
  }

  idle(dt, t) { this.animateAll(dt, t); }

  step(dt, t, keys) {
    this.elapsed += dt;
    const si = Math.min(SECTIONS.length - 1, Math.floor(this.elapsed / SEC_T));
    if (si !== this.sec) this.setSection(si);
    // 세기: 손 높이 (손으로 하기) 또는 ↑/↓
    const hc = this.camCtl.on && this.camCtl.hands.center();
    if (hc) this.level += (THREE.MathUtils.clamp((0.85 - hc.y) / 0.6, 0, 1) - this.level) * Math.min(1, dt * 6);
    if (keys.has('ArrowUp') || keys.has('KeyW')) this.level = Math.min(1, this.level + dt * 0.9);
    if (keys.has('ArrowDown') || keys.has('KeyS')) this.level = Math.max(0, this.level - dt * 0.9);
    if (this.camCtl.on) this.camCtl.hands.label = `세기: ${this.level >= LOUD_HI ? '세게 🔊' : this.level <= LOUD_LO ? '여리게 🔈' : '보통 🔉'}`;
    this.animateAll(dt, t);
    this.updateMeters();
  }

  resultTitle() {
    const r = this.judged ? this.good / this.judged : 0;
    return r >= 0.7 ? '기립 박수! 👏👏' : r >= 0.4 ? '훌륭한 연주였어요!' : '연주 끝!';
  }
  extraText() { return `연속 ${this.streak || 0} · 브라보 ${this.bravo || 0}`; }
  resultRows() {
    const pct = this.judged ? Math.round((this.good / this.judged) * 100) : 0;
    return [['잘 맞춘 박자', `${this.good} / ${this.judged} (${pct}%)`], ['최고 연속', `${this.maxCombo}박`], ['브라보', `${this.bravo}번`]];
  }
}
