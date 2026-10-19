import * as THREE from 'three';
import { box } from '../world.js';
import { canvasTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';

const $ = (id) => document.getElementById(id);
const LANE_KEYS = [['KeyD', 'D'], ['KeyF', 'F'], ['KeyJ', 'J'], ['KeyK', 'K']];
const JUDGE = [[0.06, 'PERFECT', 3], [0.11, 'GREAT', 2], [0.16, 'GOOD', 1]]; // 초 이내 → 판정, 점수
const LEAD = 2.0; // 노트가 위에서 판정선까지 내려오는 시간(초)

const NOTE = (n) => { // 'C4' → Hz
  const m = /^([A-G])(#?)(\d)$/.exec(n), base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0);
  return 440 * 2 ** ((base + (+m[3] - 4) * 12) / 12);
};
// 곡: [음, 박자] 목록 (저작권이 끝난 민요·클래식 + 직접 만든 곡)
const seq = (s) => s.trim().split(/\s+/).map((t) => { const [n, b] = t.split(':'); return [n, b ? +b : 1]; });
const SONGS = [
  { id: 'star', title: '반짝반짝 작은별', level: '쉬움', bpm: 104, notes: seq(`
    C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2
    C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2`) },
  { id: 'joy', title: '환희의 송가', level: '보통', bpm: 128, notes: seq(`
    E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2
    E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2
    D4 D4 E4 C4 D4 E4:0.5 F4:0.5 E4 C4 D4 E4:0.5 F4:0.5 E4 D4 C4 D4 G3:2
    E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2`) },
  { id: 'dot', title: '도트 서울 (오리지널)', level: '어려움', bpm: 150, notes: seq(`
    C4:0.5 E4:0.5 G4:0.5 A4:0.5 G4 E4 D4:0.5 E4:0.5 G4:0.5 E4:0.5 D4 C4
    A3:0.5 C4:0.5 D4:0.5 E4:0.5 G4:0.5 E4:0.5 D4:0.5 C4:0.5 D4:2
    E4:0.5 G4:0.5 A4:0.5 C5:0.5 A4 G4 E4:0.5 G4:0.5 A4:0.5 G4:0.5 E4 D4
    C4:0.5 D4:0.5 E4:0.5 G4:0.5 A4:0.5 G4:0.5 E4:0.5 D4:0.5 C4:2
    G4:0.5 A4:0.5 C5:0.5 D5:0.5 C5 A4 G4:0.5 E4:0.5 G4:0.5 A4:0.5 G4 E4
    D4:0.5 E4:0.5 G4:0.5 E4:0.5 D4:0.5 C4:0.5 A3:0.5 C4:0.5 C4:2`) },
];

// 홍대 코인노래방 리듬게임: 곡을 고르고 D F J K로 노트 치기
export class KaraokeGame extends MiniGame {
  static meta = {
    id: 'karaoke', indoor: true, title: '코인노래방', duration: 0, resultTitle: '노래 끝!', fov: 46, sky: '#1a1024',
    hint: 'D · F · J · K = 4개 줄 — 노트가 아래 판정선에 닿을 때 눌러요! 맞힌 노트는 노래가 되고, 놓치면 소리가 끊겨요',
  };

  build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#c8b0ff', '#2a1a3a', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 0.8); key.position.set(2, 6, 6); key.castShadow = true; s.add(key);
    // 노래방 방: 벽·바닥·소파·화면
    box(14, 0.1, 10, '#3a2a4a', 0, -0.05, 0, s).castShadow = false;
    box(14, 6, 0.2, '#4a2f6a', 0, 3, -4, s); box(0.2, 6, 10, '#3f2860', -6, 3, 0, s); box(0.2, 6, 10, '#3f2860', 6, 3, 0, s);
    for (let x = -5; x <= 5; x += 1) box(0.06, 6, 0.05, '#5a3a80', x, 3, -3.88, s).castShadow = false;
    box(4.6, 0.6, 1.2, '#b0304a', -1.5, 0.3, 2.6, s); box(4.6, 1.0, 0.3, '#901f3a', -1.5, 0.8, 3.2, s); // 소파
    box(1.4, 0.45, 0.8, '#2a2236', 2.6, 0.22, 1.6, s);                                                   // 탁자
    box(0.2, 0.3, 0.2, '#ffd23f', 2.4, 0.6, 1.6, s); box(0.2, 0.3, 0.2, '#7ae8ff', 2.8, 0.6, 1.6, s);   // 탬버린·음료
    // TV 화면 (가사판)
    this.tvCanvas = document.createElement('canvas'); this.tvCanvas.width = 160; this.tvCanvas.height = 90;
    this.tvTex = canvasTexture(this.tvCanvas);
    box(5.4, 3.2, 0.25, '#111', 0, 2.6, -3.8, s);
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.8), new THREE.MeshBasicMaterial({ map: this.tvTex }));
    tv.position.set(0, 2.6, -3.66); s.add(tv);
    // 미러볼 + 색 조명
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), new THREE.MeshStandardMaterial({ color: '#dddddd', metalness: 0.9, roughness: 0.25, flatShading: true }));
    this.ball.position.set(0, 5.3, 0); s.add(this.ball); box(0.04, 0.6, 0.04, '#888', 0, 5.8, 0, s);
    this.spots = ['#ff4fa8', '#4fd8ff', '#ffe14f'].map((c, i) => { const l = new THREE.PointLight(c, 6, 9, 1.5); l.position.set(-3 + i * 3, 4, 1); s.add(l); return l; });
    this.camera.position.set(0, 2.4, 7.2);
    this.camera.lookAt(0, 1.8, -1);
    this.song = SONGS[0];
  }

  onAvatar() { this.player.position.set(0, 0, 0.6); this.player.rotation.y = 0; this.mic(); }
  mic() { // 오른손에 마이크
    const arm = this.avatar.joints.armR;
    const m = new THREE.Group(); box(0.08, 0.28, 0.08, '#222', 0, 0, 0, m); box(0.14, 0.12, 0.14, '#9aa0a8', 0, 0.18, 0, m);
    m.position.set(0, -0.5, 0.1); m.rotation.x = -0.6; arm.add(m);
  }

  // 곡 고르기 → 카운트다운
  start() {
    if (!this.chosen) { super.start(); return; } // 설명 화면 먼저 (base.showIntro → 고르면 다시 여기로)
    this.meta = this.constructor.meta;
    this.state = 'setup';
    $('miniOverlay').innerHTML = '';
    this.setupHud(); $('timerBox').classList.add('hidden'); $('miniScore').textContent = 0; $('miniCombo').textContent = '';
    const pick = document.createElement('div');
    pick.className = 'panel kara-pick';
    pick.innerHTML = `<h3>🎤 곡을 골라 주세요</h3>${SONGS.map((s, i) => `<button class="btn${s === this.song ? ' green' : ''}" data-i="${i}"><b>${i + 1}</b> ${s.title} <small>${s.level} · ${s.notes.length}노트</small></button>`).join('')}<p>숫자키 1~3 · Enter = 선택한 곡</p>`;
    pick.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) this.begin(+b.dataset.i); };
    $('miniOverlay').appendChild(pick);
    this.drawTV('곡을 골라 주세요', '');
  }
  begin(i) {
    if (this.state !== 'setup') return;
    sfx.click();
    this.song = SONGS[i];
    super.start();
  }

  reset() {
    const s = this.song, beat = 60 / s.bpm;
    // 음 높이 순서대로 4줄에 나눠 배치 (낮은 음 = 왼쪽)
    const pitches = [...new Set(s.notes.map(([n]) => NOTE(n)))].sort((a, b) => a - b);
    const laneOf = (f) => Math.min(3, Math.floor((pitches.indexOf(f) / pitches.length) * 4));
    let t = 0;
    this.notes = s.notes.map(([n, b]) => { const f = NOTE(n), note = { t, f, dur: b * beat, lane: laneOf(f), hit: false, missed: false, el: null }; t += b * beat; return note; });
    this.songLen = t; this.beat = beat;
    this.songT = -LEAD; this.lastBeat = -1;
    this.judges = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.maxScore = this.notes.length * 3;
    this.flash = 0;
    this.overlay();
  }

  overlay() {
    const o = $('miniOverlay');
    const hw = document.createElement('div'); hw.className = 'kara-hw';
    hw.innerHTML = LANE_KEYS.map(([, k], i) => `<div class="lane" data-l="${i}"><span class="key">${k}</span></div>`).join('') + '<div class="hitline"></div><div class="judge"></div>';
    o.appendChild(hw);
    this.hw = hw; this.judgeEl = hw.querySelector('.judge');
    this.laneEls = [...hw.querySelectorAll('.lane')];
    for (const n of this.notes) { const el = document.createElement('i'); el.className = `note l${n.lane}`; this.laneEls[n.lane].appendChild(el); n.el = el; }
  }

  drawTV(title, line) {
    const g = this.tvCanvas.getContext('2d');
    g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, 160, 90);
    g.fillStyle = '#ffffff'; g.font = '11px Jua'; g.textAlign = 'center'; g.fillText(title, 80, 22);
    g.fillStyle = '#7ae8ff'; g.font = '14px Jua'; g.fillText(line, 80, 55);
    if (this.notes && this.songT > 0) { g.fillStyle = '#333'; g.fillRect(20, 72, 120, 5); g.fillStyle = '#ff7ad9'; g.fillRect(20, 72, 120 * Math.min(1, this.songT / this.songLen), 5); }
    this.tvTex.needsUpdate = true;
  }

  keyDown(code) {
    if (this.state === 'setup') { const m = /^(Digit|Numpad)([1-3])$/.exec(code); if (m) this.begin(+m[2] - 1); if (code === 'Enter') this.begin(SONGS.indexOf(this.song)); return; }
    const lane = LANE_KEYS.findIndex(([k]) => k === code);
    if (lane < 0 || this.state !== 'play') return;
    this.laneEls[lane].classList.add('press'); setTimeout(() => this.laneEls[lane]?.classList.remove('press'), 90);
    // 이 줄에서 아직 안 친 가장 이른 노트
    let best = null;
    for (const n of this.notes) if (n.lane === lane && !n.hit && !n.missed) { best = n; break; }
    if (!best) return;
    const d = Math.abs(best.t - this.songT);
    const j = JUDGE.find(([w]) => d <= w);
    if (!j) { if (best.t - this.songT < 0.3) this.judge('MISS'); return; } // 너무 일찍 누름
    best.hit = true; best.el.classList.add('hit');
    sfx.note(best.f, Math.min(0.5, best.dur * 0.9), 'square', 0.07);
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += j[2] + (this.combo >= 20 ? 1 : 0);
    this.judge(j[1]);
    this.flash = 1;
  }
  judge(name) {
    this.judges[name]++;
    if (name === 'MISS') { this.combo = 0; sfx.miss(); }
    this.judgeEl.textContent = name + (this.combo > 1 && name !== 'MISS' ? ` ${this.combo}` : '');
    this.judgeEl.className = `judge ${name.toLowerCase()}`; void this.judgeEl.offsetWidth; this.judgeEl.classList.add('show');
  }

  idle(dt, t) {
    this.ball.rotation.y += dt * 0.6;
    this.avatar.animate(dt, t, { wave: this.state === 'done' });
    this.spots.forEach((l, i) => (l.intensity = 3 + Math.sin(t * 2 + i * 2) * 1.5));
  }

  step(dt, t) {
    this.songT += dt;
    const s = this.songT;
    // 박자: 쿵(정박) · 칫(엇박)
    const bi = Math.floor(s / (this.beat / 2));
    if (s >= 0 && bi !== this.lastBeat) { this.lastBeat = bi; sfx.drum(bi % 2 ? 'hat' : 'kick'); }
    // 노트 위치 (판정선까지 LEAD초)
    const H = this.laneEls[0].clientHeight, hitY = H - 56;
    for (const n of this.notes) {
      if (n.hit) { n.el.style.display = 'none'; continue; }
      const y = hitY - ((n.t - s) / LEAD) * hitY;
      n.el.style.transform = `translateY(${y}px)`;
      n.el.style.display = y < -30 || y > H + 10 ? 'none' : 'block';
      if (!n.missed && s - n.t > JUDGE[2][0]) { n.missed = true; n.el.classList.add('miss'); this.judge('MISS'); }
    }
    // 무대 연출: 맞힐 때마다 조명이 번쩍, 콤보가 쌓이면 손 흔들며 신나게
    this.flash = Math.max(0, this.flash - dt * 4);
    this.ball.rotation.y += dt * (0.6 + this.combo * 0.05);
    this.spots.forEach((l, i) => (l.intensity = 3 + this.flash * 8 + Math.sin(t * 4 + i * 2) * 1.5));
    const beatPhase = (s / this.beat) % 1;
    this.avatar.animate(dt, t, { wave: this.combo >= 10, moving: this.combo >= 25 });
    this.player.position.y = this.combo >= 5 ? Math.abs(Math.sin(beatPhase * Math.PI)) * 0.12 : 0;
    // 가사판: 다음에 칠 음 이름 (도레미)
    const next = this.notes.find((n) => !n.hit && !n.missed);
    const solfa = (f) => ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'][((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12];
    if (Math.floor(t * 10) !== this.tvFrame) { this.tvFrame = Math.floor(t * 10); this.drawTV(`♪ ${this.song.title}`, next ? `${solfa(next.f)}~` : '♬ 끝!'); }
    if (s > this.songLen + 1.2) this.finish();
  }

  extraText() { return this.state === 'play' && this.combo > 1 ? `콤보 ${this.combo}` : ''; }
  grade() {
    const acc = this.maxScore ? (this.judges.PERFECT * 3 + this.judges.GREAT * 2 + this.judges.GOOD) / this.maxScore : 0;
    return [acc, acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D'];
  }
  finish() {
    if (this.state === 'done') return;
    const [acc, g] = this.grade();
    this.meta = { ...this.meta, resultTitle: `${g} 등급! ${g === 'S' ? '노래방 가수 탄생!' : g === 'A' ? '앵콜!' : '수고했어요!'}` };
    this.acc = acc;
    super.finish();
  }
  resultRows() {
    const j = this.judges;
    return [['곡', this.song.title], ['PERFECT / GREAT / GOOD', `${j.PERFECT} / ${j.GREAT} / ${j.GOOD}`], ['MISS', `${j.MISS}`], ['최대 콤보', `${this.maxCombo}`], ['정확도', `${Math.round(this.acc * 100)}%`]];
  }
}
