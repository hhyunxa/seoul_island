import * as THREE from 'three';
import { Avatar } from '../character.js';
import { rng, canvasTexture, drawTile } from '../textures.js';
import { sfx } from '../sfx.js';
import { INTRO } from './intro.js';

const $ = (id) => document.getElementById(id);

// ============================================================
//  모든 미니게임의 공통 뼈대
//  - 하위 클래스가 정의: static meta, build(), reset(), step(dt,t,keys), idle(dt,t), resultRows()
//  - 공통 처리: 카운트다운, 제한시간, 하트, HUD, 피격 깜빡임, 결과 전달
// ============================================================
export class MiniGame {
  constructor({ onEnd, onFloat, ctx }) {
    this.onEnd = onEnd; this.onFloat = onFloat; this.ctx = ctx;
    const m = this.constructor.meta;
    this.meta = m;
    this.duration = m.duration || 0;
    this.maxHearts = m.hearts || 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(m.sky || '#a8dcf5');
    this.baseFov = m.fov || 42;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.1, 200);
    this.ray = new THREE.Raycaster();
    this.flashTargets = [];
    this.build();
  }

  // ---------- 무대 도우미 ----------
  lights({ pos = [-6, 14, 9], size = 12, intensity = 2.0 } = {}) {
    this.scene.add(new THREE.HemisphereLight('#e0f3ff', '#7a9a55', 1.3));
    const sun = new THREE.DirectionalLight('#fff0d0', intensity);
    sun.position.set(...pos); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, far: 80 });
    this.scene.add(sun);
    this.sun = sun;
    return sun;
  }
  tileGround(w, h, pick, seed = 9) {
    const c = document.createElement('canvas'); c.width = w * 16; c.height = h * 16;
    const g = c.getContext('2d'); const r = rng(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) drawTile(g, x * 16, y * 16, pick(x, y), r);
    const tex = canvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  ndc(e, w, h) { return new THREE.Vector2((e.clientX / w) * 2 - 1, -(e.clientY / h) * 2 + 1); }

  setPlayer(skin, height = 1.6) {
    if (this.avatar) { this.scene.remove(this.avatar.root); this.avatar.dispose(); }
    this.avatar = new Avatar(skin, { height });
    this.player = this.avatar.root;
    this.scene.add(this.player);
    this.onAvatar?.();
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1.4 ? this.baseFov * (1.4 / aspect) ** 0.8 : this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  // 입력 (main.js가 전달)
  pointer() {} pointerDown() {} pointerUp() {} keyDown() {} keyUp() {}

  // ---------- 진행 ----------
  start() {
    if (!this.chosen) { this.showIntro(); return; }
    this.time = this.duration; this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hearts = this.maxHearts; this.hitFlash = 0;
    this.state = 'countdown'; this.cdT = 3.2;
    $('miniOverlay').innerHTML = '';
    this.reset();
    this.setupHud();
    this.camCtl?.mount(); // ✋ 손으로 하기 (camctl.js)
    this.renderHud();
  }
  restart() { this.start(); }

  // 카메라로도 할 수 있는 게임: { label, desc, how, on, set(on) } (손 → camctl.js, 몸 → parade·kpop이 직접 정함)
  get camChoice() { return this.camCtl?.choice || null; }
  // 들어오면 먼저: 게임 설명 + 시작 버튼 (카메라 게임은 키보드/카메라 중 골라서 시작). 다시 하기 땐 안 나옴
  showIntro() {
    const ch = this.camChoice, info = INTRO[this.meta.id] || {}, m = this.meta;
    this.state = 'choose';
    $('miniOverlay').innerHTML = '';
    this.setupHud();
    $('timerBox').classList.add('hidden'); $('hearts').classList.add('hidden');
    $('miniScore').textContent = 0; $('miniCombo').textContent = '';
    $('miniHint').textContent = '';
    const chips = [m.duration && `⏱ ${m.duration}초`, m.hearts && `❤️ 하트 ${m.hearts}개`].filter(Boolean);
    const el = document.createElement('div');
    el.className = 'panel game-intro';
    el.innerHTML = `<h2>${m.title}</h2>
      ${chips.length ? `<div class="gi-chips">${chips.map((c) => `<span>${c}</span>`).join('')}</div>` : ''}
      <p class="gi-goal">${info.goal || ''}</p>
      ${info.tips ? `<ul class="gi-tips">${info.tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
      <div class="gi-ctrl"><div><b>⌨️ 키보드</b><span>${m.hint || ''}</span></div>${ch ? `<div><b>${ch.label.replace(' 하기', '')}</b><span>${ch.how || ch.desc}</span></div>` : ''}</div>
      <div class="btn-row">${ch
        ? `<button class="btn big${ch.on ? '' : ' green'}" data-on="0">⌨️ 키보드로 시작<small>1</small></button><button class="btn big${ch.on ? ' green' : ''}" data-on="1">${ch.label.replace('하기', '시작')}<small>2 · ${ch.desc}</small></button>`
        : '<button class="btn big green" data-on="0">▶ 시작하기<small>Enter</small></button>'}</div>
      <p class="gi-foot">Enter = ${ch ? '초록 버튼으로 ' : ''}시작 · Esc = 나가기${ch ? ' · 게임 중에도 오른쪽 위 버튼으로 조작을 바꿀 수 있어요' : ''}</p>`;
    const pick = (on) => { removeEventListener('keydown', onKey); sfx.click(); ch?.set(on); this.chosen = true; this.start(); };
    const onKey = (e) => {
      if (this.state !== 'choose') return removeEventListener('keydown', onKey);
      if (e.code === 'Enter' || e.code === 'NumpadEnter') pick(!!ch?.on);
      else if (ch && e.code === 'Digit1') pick(false);
      else if (ch && e.code === 'Digit2') pick(true);
    };
    el.onclick = (e) => { const b = e.target.closest('[data-on]'); if (b) pick(b.dataset.on === '1'); };
    removeEventListener('keydown', this.chooseKey); this.chooseKey = onKey; // 예전 창의 키 처리는 떼어 냄
    addEventListener('keydown', onKey);
    $('miniOverlay').appendChild(el);
  }

  update(dt, t, keys) {
    if (this.state === 'choose') return; // 조작 고르는 중: 아직 reset() 전이라 화면만 보여 줌
    if (this.state === 'countdown' && this.camCtl?.pending) { // 카메라 준비될 때까지 기다림
      const cd = $('countdown'); cd.classList.remove('hidden'); cd.textContent = '📷';
      this.idle(dt, t); return;
    }
    if (this.state === 'countdown') {
      const prev = Math.ceil(this.cdT);
      this.cdT -= dt;
      const n = Math.ceil(this.cdT);
      const cd = $('countdown');
      cd.classList.remove('hidden');
      cd.textContent = n > 0 ? n : '시작!';
      if (n !== prev) n > 0 ? sfx.tick() : sfx.go();
      if (this.cdT < -0.5) { this.state = 'play'; cd.classList.add('hidden'); }
      this.idle(dt, t);
      return;
    }
    if (this.state !== 'play') { this.idle(dt, t); return; }
    if (this.duration) this.time = Math.max(0, this.time - dt);
    this.step(dt, t, keys);
    // 피격 깜빡임
    if (this.player) {
      if (this.hitFlash > 0) { this.hitFlash -= dt; this.player.visible = Math.floor(this.hitFlash * 15) % 2 === 0; }
      else this.player.visible = true;
      for (const o of this.flashTargets) o.visible = this.player.visible;
    }
    if (this.state === 'play' && ((this.duration && this.time <= 0) || (this.maxHearts && this.hearts <= 0))) this.finish();
    this.renderHud();
  }

  hurt(pos, text = '아야!') {
    if (this.hitFlash > 0) return false;
    this.hearts--; this.combo = 0; this.hitFlash = 1.2;
    sfx.hurt();
    this.float(pos, text, 'bad');
    const v = $('view'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake');
    return true;
  }
  float(pos, text, cls = '') { this.onFloat?.(pos, text, cls, this.camera); }

  setupHud() {
    $('miniTitle').textContent = this.meta.title;
    $('miniHint').textContent = this.meta.hint;
    $('hearts').classList.toggle('hidden', !this.maxHearts);
    $('timerBox').classList.toggle('hidden', !this.duration);
  }
  renderHud() {
    if (this.maxHearts) $('hearts').innerHTML = Array.from({ length: this.maxHearts }, (_, i) => `<div class="heart ${i < this.hearts ? '' : 'off'}"></div>`).join('');
    if (this.duration) $('timerFill').style.width = `${(this.time / this.duration) * 100}%`;
    $('miniScore').textContent = this.score;
    $('miniCombo').textContent = this.extraText?.() || '';
  }

  // 도중에 나가기: 결과를 전달하지 않으므로 이번 판 보상은 반영되지 않음
  quit() {
    this.state = 'done';
    $('countdown').classList.add('hidden');
    this.leave();
  }
  // 미니게임에서 나갈 때 (main.js가 부름)
  leave() { this.camCtl?.stop(); this.chosen = false; }

  finish() {
    if (this.state === 'done') return;
    this.state = 'done';
    $('countdown').classList.add('hidden');
    sfx.end();
    this.onEnd?.({ id: this.meta.id, title: this.resultTitle?.() || this.meta.resultTitle || '끝!', score: this.score, coins: this.coins?.() ?? this.score, rows: this.resultRows() });
  }
}

// 공통 소품
export function addFence(scene, box, x0, z0, x1, z1, color = '#8a5428') {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) box(0.16, 0.8, 0.16, color, x0 + ((x1 - x0) * i) / n, 0.4, z0 + ((z1 - z0) * i) / n, scene);
  const w = Math.abs(x1 - x0) || 0.08, d = Math.abs(z1 - z0) || 0.08;
  box(w, 0.1, d, '#b5763b', (x0 + x1) / 2, 0.55, (z0 + z1) / 2, scene);
  box(w, 0.1, d, '#b5763b', (x0 + x1) / 2, 0.3, (z0 + z1) / 2, scene);
}
