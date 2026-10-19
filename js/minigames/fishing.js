import * as THREE from 'three';
import { box, makeTree } from '../world.js';
import { waterTexture, plankTexture, rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';

// 물고기 도감: diff = 끌어올리기 난이도(0~1), w = 기본 출현 가중치, far = 멀리 던질수록 늘어나는 가중치
export const FISH = [
  { name: '피라미', color: '#b8c8d0', value: 5, diff: 0.12, w: 30, far: -10, size: [8, 14] },
  { name: '붕어', color: '#9a8a5a', value: 8, diff: 0.25, w: 28, far: -6, size: [12, 26] },
  { name: '고등어', color: '#4a7aa8', value: 15, diff: 0.42, w: 16, far: 6, size: [22, 38] },
  { name: '복어', color: '#e8c25a', value: 20, diff: 0.55, w: 9, far: 8, size: [10, 22], erratic: true },
  { name: '연어', color: '#e8806a', value: 28, diff: 0.68, w: 6, far: 14, size: [45, 80] },
  { name: '황금 잉어', color: '#ffd23f', value: 60, diff: 0.88, w: 1, far: 5, size: [30, 55], erratic: true },
];

function makeFish(f) {
  const g = new THREE.Group();
  box(0.5, 0.24, 0.14, f.color, 0, 0, 0, g);
  box(0.16, 0.2, 0.06, f.color, -0.32, 0, 0, g);
  box(0.14, 0.08, 0.1, '#ffffff', 0.08, -0.08, 0, g);
  box(0.04, 0.04, 0.16, '#222', 0.17, 0.04, 0, g);
  box(0.18, 0.06, 0.04, f.color, 0, 0.14, 0, g);
  return g;
}

export class FishingGame extends MiniGame {
  static meta = {
    id: 'fish', title: '낚시', duration: 75, resultTitle: '오늘의 조과',
    hint: 'Space/마우스 꾹 누르기: 힘 모으기 → 떼면 던지기 · 찌가 쏙 들어가면 바로 누르기 · 누르고 있으면 초록 막대가 올라가요',
  };

  build() {
    this.camCtl = new CamControl(this, {
      hint: '✊ 주먹을 꾹 쥐면 힘 모으기 → 손을 펴면 던지기 · 찌가 쏙 들어가면 바로 주먹! · 주먹을 쥐고 있으면 초록 막대가 올라가요',
      onEvent: (type) => { if (type === 'fist') this.press(); else if (type === 'open') this.release(); },
    });
    const s = this.scene;
    this.scene.fog = new THREE.Fog('#a8dcf5', 30, 70);
    this.lights({ pos: [-8, 16, 6], size: 14 });
    // 물
    const wt = waterTexture(); wt.repeat.set(60, 60); this.waterTex = wt;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ map: wt }));
    water.rotation.x = -Math.PI / 2; water.receiveShadow = true; s.add(water);
    // 부두
    const pl = new THREE.MeshLambertMaterial({ map: plankTexture('#a86c3a', '#7a4a26', '#c98a50') });
    pl.map.repeat.set(1, 5);
    box(2.2, 0.18, 9, pl, 0, 0.3, 4.2, s);
    for (const z of [0, 3, 6]) for (const x of [-1, 1]) box(0.22, 1.4, 0.22, '#6b3b1c', x, -0.3, z, s);
    box(0.6, 0.5, 0.6, '#5b8fd8', 0.7, 0.64, 1.6, s); // 물통
    box(0.5, 0.06, 0.5, '#3a6fd8', 0.7, 0.9, 1.6, s);
    // 먼 섬
    const r = rng(77);
    const far = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 8), new THREE.MeshLambertMaterial({ color: '#74b84f' }));
    far.position.set(0, 0.2, -38); s.add(far);
    for (let i = 0; i < 18; i++) { const t = makeTree(r, r() < 0.5 ? 'pine' : 'round'); t.position.set(-32 + i * 3.8 + r(), 0.8, -37 + r() * 3); t.scale.multiplyScalar(1.6); s.add(t); }
    for (let i = 0; i < 6; i++) { const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 6), new THREE.MeshLambertMaterial({ color: '#4f9a35' })); lp.position.set(-6 + r() * 12, 0.03, -3 - r() * 10); s.add(lp); }
    // 찌 + 낚싯줄
    this.bobber = new THREE.Group();
    box(0.16, 0.12, 0.16, '#ffffff', 0, 0, 0, this.bobber);
    box(0.16, 0.12, 0.16, '#e8413a', 0, 0.12, 0, this.bobber);
    box(0.04, 0.12, 0.04, '#e8413a', 0, 0.24, 0, this.bobber);
    s.add(this.bobber);
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f6f0e0' }));
    s.add(this.line);
    this.rings = [];
    this.camera.position.set(-3.6, 3.6, 5.2);
    this.camera.lookAt(0, 0.4, -4.5);
  }

  onAvatar() {
    this.player.position.set(0, 0.39, 0.2);
    this.player.rotation.y = Math.PI;
    const s = this.avatar.s;
    // 낚싯대: 오른손에 쥠
    const rod = new THREE.Group();
    rod.position.set(0, -7 * s, 0);
    box(0.06, 0.06, 2.0, '#8a5428', 0, 0, 0.9, rod);
    box(0.09, 0.09, 0.3, '#3b2416', 0, 0, -0.05, rod);
    box(0.1, 0.1, 0.1, '#a5a5b5', 0.06, 0, 0.15, rod); // 릴
    this.tip = new THREE.Object3D(); this.tip.position.set(0, 0, 1.9); rod.add(this.tip);
    this.avatar.joints.armR.add(rod);
    this.armX = -0.9;
  }

  reset() {
    this.phase = 'ready'; this.power = 0; this.caughtList = []; this.newDex = 0;
    this.mouseHeld = false; this.msg(this.how('Space(또는 마우스)를 꾹 눌러 힘을 모으세요', '✊ 주먹을 꾹 쥐어 힘을 모으세요'));
    this.hideReel();
  }

  // ---------- UI ----------
  overlay() { return document.getElementById('miniOverlay'); }
  msg(text, cls = '') {
    let el = document.getElementById('fishMsg');
    if (!el) { el = document.createElement('div'); el.id = 'fishMsg'; this.overlay().appendChild(el); }
    el.className = `fish-msg ${cls}`; el.textContent = text; el.classList.toggle('hidden', !text);
  }
  powerBar(v) {
    let el = document.getElementById('powerBar');
    if (!el) { el = document.createElement('div'); el.id = 'powerBar'; el.className = 'power-bar'; el.innerHTML = '<span>힘</span><div><i></i></div>'; this.overlay().appendChild(el); }
    el.classList.toggle('hidden', v === null);
    if (v !== null) el.querySelector('i').style.width = `${v * 100}%`;
  }
  showReel(f) {
    let el = document.getElementById('reel');
    if (!el) {
      el = document.createElement('div'); el.id = 'reel'; el.className = 'reel';
      el.innerHTML = '<div class="reel-track"><div class="reel-bar"></div><div class="reel-fish"></div></div><div class="reel-prog"><div class="reel-progfill"></div></div>';
      this.overlay().appendChild(el);
    }
    el.classList.remove('hidden');
    el.querySelector('.reel-fish').style.background = f.color;
    el.querySelector('.reel-bar').style.height = `${this.barH * 100}%`;
  }
  hideReel() { document.getElementById('reel')?.classList.add('hidden'); }
  card(f, size, isNew) {
    const el = document.createElement('div');
    el.className = 'catch-card';
    el.innerHTML = `<b style="color:${f.color}">■</b> <strong>${f.name}</strong>를 낚았다! <span>${size}cm · +${f.value}</span>${isNew ? '<em>도감 NEW!</em>' : ''}`;
    this.overlay().appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  // ---------- 입력 ----------
  keyDown(code) { if (code === 'Space' || code === 'KeyE') this.press(); }
  keyUp(code) { if (code === 'Space' || code === 'KeyE') this.release(); }
  pointerDown() { this.mouseHeld = true; this.press(); }
  pointerUp() { this.mouseHeld = false; this.release(); }
  held(keys) { return keys.has('Space') || keys.has('KeyE') || this.mouseHeld || (this.camCtl.on && this.camCtl.hands.anyFist()); }
  // 안내 문구: 손으로 할 때는 '주먹'으로
  how(key, hand) { return this.camCtl.on ? hand : key; }

  press() {
    if (this.state !== 'play') return;
    if (this.phase === 'ready') { this.phase = 'charge'; this.chargeT = 0; this.msg(''); }
    else if (this.phase === 'wait') { this.msg('너무 빨리 당겼어요!', 'bad'); sfx.miss(); this.retrieve(); }
    else if (this.phase === 'bite') this.startReel();
  }
  release() {
    if (this.state !== 'play' || this.phase !== 'charge') return;
    this.cast();
  }

  pickFish() {
    const p = this.power;
    const ws = FISH.map((f) => Math.max(0.5, f.w + f.far * p));
    let x = Math.random() * ws.reduce((a, b) => a + b, 0);
    return FISH[ws.findIndex((w) => (x -= w) < 0)];
  }

  cast() {
    this.phase = 'fly'; this.flyT = 0;
    this.powerBar(null);
    this.fish = this.pickFish();
    const dist = 3 + this.power * 9;
    this.from = this.tipPos();
    this.to = new THREE.Vector3((Math.random() - 0.5) * 2, 0.02, -dist);
    this.armX = -0.5;
    sfx.jump();
  }
  retrieve() { this.phase = 'retrieve'; this.retT = 0; this.from = this.bobber.position.clone(); this.hideReel(); }
  startReel() {
    this.phase = 'reel';
    const d = this.fish.diff;
    this.barH = 0.34 - d * 0.13; this.barPos = 0.2; this.barV = 0;
    this.fishPos = 0.3; this.fishTarget = 0.5; this.fishT = 0; this.progress = 0.3;
    this.msg('');
    this.showReel(this.fish);
    sfx.open();
  }

  tipPos() { const v = new THREE.Vector3(); this.tip.getWorldPosition(v); return v; }
  ripple(pos, big = false) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 16), new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.03, pos.z);
    this.scene.add(m); this.rings.push({ m, t: 0, s: big ? 3 : 1.6 });
  }

  idle(dt, t) { this.animate(dt, t); }

  step(dt, t, keys) {
    const b = this.bobber;
    if (this.phase === 'ready') {
      this.armX = -0.9;
    } else if (this.phase === 'charge') {
      this.chargeT += dt;
      this.power = (1 - Math.cos(this.chargeT * 3.2)) / 2; // 0→1→0 왕복
      this.powerBar(this.power);
      this.armX = -1.4 - this.power * 1.3;
      if (!this.held(keys)) this.cast();
    } else if (this.phase === 'fly') {
      this.flyT += dt / 0.6;
      const k = Math.min(1, this.flyT);
      b.position.lerpVectors(this.from, this.to, k);
      b.position.y = THREE.MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) { this.phase = 'wait'; this.waitT = 1.3 + Math.random() * 3; this.ripple(b.position); sfx.miss(); this.msg('입질을 기다리는 중...'); this.armX = -1.0; }
    } else if (this.phase === 'wait') {
      this.waitT -= dt;
      b.position.y = 0.02 + Math.sin(t * 3) * 0.03 - (Math.sin(t * 7.3) > 0.97 ? 0.06 : 0); // 가끔 톡톡
      if (this.waitT <= 0) {
        this.phase = 'bite'; this.biteT = 0.85 - this.fish.diff * 0.3;
        this.msg(this.how('!!! 지금 누르세요', '!!! 지금 주먹!'), 'bite'); sfx.tick(); this.ripple(b.position, true);
      }
    } else if (this.phase === 'bite') {
      this.biteT -= dt;
      b.position.y = -0.12 + Math.sin(t * 30) * 0.04;
      if (this.biteT <= 0) { this.msg('놓쳤다... 다시 던져봐요', 'bad'); sfx.miss(); this.retrieve(); }
    } else if (this.phase === 'reel') {
      this.reel(dt, t, keys);
    } else if (this.phase === 'retrieve') {
      this.retT += dt / 0.45;
      const k = Math.min(1, this.retT), tp = this.tipPos();
      b.position.lerpVectors(this.from, tp, k); b.position.y += Math.sin(k * Math.PI) * 0.6;
      if (k >= 1) { this.phase = 'ready'; setTimeout(() => this.phase === 'ready' && this.state === 'play' && this.msg(this.how('Space를 꾹 눌러 다시 던지기', '✊ 주먹을 꾹 쥐어 다시 던지기')), 900); }
    } else if (this.phase === 'caught') {
      this.caughtT += dt;
      const k = Math.min(1, this.caughtT / 0.8);
      const head = this.player.position.clone().add(new THREE.Vector3(0, this.avatar.height + 0.5, 0));
      this.fishMesh.position.lerpVectors(this.from, head, k);
      this.fishMesh.position.y += Math.sin(k * Math.PI) * 2.5;
      this.fishMesh.rotation.z += dt * 10 * (1 - k);
      this.armX = -2.4;
      if (this.caughtT > 1.7) { this.scene.remove(this.fishMesh); this.phase = 'ready'; this.msg(this.how('Space를 꾹 눌러 다시 던지기', '✊ 주먹을 꾹 쥐어 다시 던지기')); }
    }
    this.animate(dt, t);
  }

  reel(dt, t, keys) {
    const f = this.fish, d = f.diff;
    // 초록 막대: 누르면 위로, 떼면 아래로
    this.barV += (this.held(keys) ? 2.7 : -2.3) * dt;
    this.barPos += this.barV * dt;
    if (this.barPos < 0) { this.barPos = 0; this.barV *= -0.3; }
    if (this.barPos > 1 - this.barH) { this.barPos = 1 - this.barH; this.barV *= -0.3; }
    // 물고기: 무작위로 목표를 바꾸며 이동
    this.fishT -= dt;
    if (this.fishT <= 0) { this.fishTarget = Math.random(); this.fishT = (0.5 + Math.random() * 0.9) / (0.4 + d); }
    const sp = 0.35 + d * 1.3;
    this.fishPos += THREE.MathUtils.clamp(this.fishTarget - this.fishPos, -sp * dt, sp * dt);
    if (f.erratic && Math.random() < dt * 3) this.fishPos += (Math.random() - 0.5) * 0.18;
    this.fishPos = THREE.MathUtils.clamp(this.fishPos, 0.02, 0.98);
    const inBar = this.fishPos >= this.barPos && this.fishPos <= this.barPos + this.barH;
    this.progress += (inBar ? 0.3 : -0.22) * dt;
    const el = document.getElementById('reel');
    el.querySelector('.reel-bar').style.bottom = `${this.barPos * 100}%`;
    el.querySelector('.reel-bar').classList.toggle('on', inBar);
    el.querySelector('.reel-fish').style.bottom = `calc(${this.fishPos * 100}% - 7px)`;
    el.querySelector('.reel-progfill').style.height = `${THREE.MathUtils.clamp(this.progress, 0, 1) * 100}%`;
    // 찌가 점점 다가옴
    const b = this.bobber;
    b.position.y = -0.05 + Math.sin(t * 18) * 0.05;
    b.position.x += Math.sin(t * 5) * dt * 0.6;
    this.armX = -1.2 + Math.sin(t * 20) * 0.08;
    if (inBar && Math.random() < dt * 4) this.ripple(b.position);
    if (this.progress >= 1) this.land();
    else if (this.progress <= 0) { this.msg('도망갔다...', 'bad'); sfx.miss(); this.retrieve(); }
  }

  land() {
    const f = this.fish;
    const size = Math.round(f.size[0] + Math.random() * (f.size[1] - f.size[0]));
    // 도감은 판이 정상적으로 끝날 때 반영 (도중에 나가면 반영 안 됨)
    const isNew = !this.ctx.save.dex?.[f.name] && !this.caughtList.some((c) => c.f.name === f.name);
    if (isNew) this.newDex++;
    this.caughtList.push({ f, size });
    this.score += f.value;
    this.hideReel();
    this.fishMesh = makeFish(f);
    this.fishMesh.scale.setScalar(0.8 + size / 60);
    this.from = this.bobber.position.clone();
    this.scene.add(this.fishMesh);
    this.bobber.position.copy(this.tipPos());
    this.phase = 'caught'; this.caughtT = 0;
    this.card(f, size, isNew);
    this.float(this.player.position.clone().add(new THREE.Vector3(0, 2.3, 0)), `+${f.value}`, f.value >= 28 ? 'gold' : '');
    f.value >= 28 ? sfx.gold() : sfx.coin();
  }

  animate(dt, t) {
    this.waterTex.offset.x = (t * 0.015) % 1;
    this.avatar.animate(dt, t, { yaw: Math.PI });
    const J = this.avatar.joints.armR;
    this._arm = (this._arm ?? -0.9) + ((this.armX ?? -0.9) - (this._arm ?? -0.9)) * Math.min(1, dt * (this.phase === 'fly' ? 25 : 12));
    J.rotation.x = this._arm; J.rotation.z = 0.05;
    // 줄: 찌 위치 갱신
    const tp = this.tipPos();
    if (this.phase === 'ready' || this.phase === 'charge' || this.state !== 'play' && !['wait', 'bite', 'reel'].includes(this.phase)) {
      this.bobber.position.set(tp.x, tp.y - 0.7, tp.z);
    }
    const pos = this.line.geometry.attributes.position;
    pos.setXYZ(0, tp.x, tp.y, tp.z);
    pos.setXYZ(1, this.bobber.position.x, this.bobber.position.y + 0.26, this.bobber.position.z);
    pos.needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      r.m.scale.setScalar(1 + r.t * r.s * 2); r.m.material.opacity = Math.max(0, 0.9 - r.t * 1.2);
      if (r.t > 0.8) { this.scene.remove(r.m); r.m.geometry.dispose(); this.rings.splice(i, 1); }
    }
  }

  extraText() { return this.caughtList?.length ? `${this.caughtList.length}마리` : ''; }
  finish() {
    if (this.state === 'done') return;
    this.hideReel(); this.powerBar(null); this.msg('');
    const dex = (this.ctx.save.dex ||= {});
    for (const { f, size } of this.caughtList) dex[f.name] = Math.max(dex[f.name] || 0, size);
    super.finish();
  }
  quit() { this.hideReel(); this.powerBar(null); this.msg(''); super.quit(); }
  resultRows() {
    const best = this.caughtList.slice().sort((a, b) => b.f.value - a.f.value || b.size - a.size)[0];
    const dexCount = Object.keys(this.ctx.save.dex || {}).length;
    return [
      ['낚은 물고기', `${this.caughtList.length}마리`],
      ['최고의 한 마리', best ? `${best.f.name} ${best.size}cm` : '-'],
      ['도감', `${dexCount}/${FISH.length}종${this.newDex ? ` (새로 ${this.newDex}종)` : ''}`],
    ];
  }
}
