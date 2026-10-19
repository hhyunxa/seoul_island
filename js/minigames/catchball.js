import * as THREE from 'three';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { rng, signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';
import { npcSkin } from './npc.js';

const $ = (id) => document.getElementById(id);
const PZ = -14;            // 상대 위치
const CZ = -0.7;           // 공을 잡는 면 (내 앞)
const GX = 2.6, GY0 = 0.35, GY1 = 2.7; // 글러브 움직일 수 있는 범위
const REACH = 0.55;

// 고척돔 캐치볼: 날아오는 공을 글러브로 받고 → 타이밍 맞춰 다시 던져주기
export class CatchBallGame extends MiniGame {
  static meta = {
    id: 'catchball', indoor: true, title: '고척돔 캐치볼', duration: 60, hearts: 3, resultTitle: '캐치볼 끝!', fov: 50, sky: '#1d2a3a',
    hint: '마우스 / WASD = 글러브 움직이기 → 공이 오면 글러브로 받기 · 받은 뒤 Space / 클릭 = 초록 칸에서 던지기',
  };

  build() {
    this.camCtl = new CamControl(this, {
      hint: '✋ 손을 움직이면 글러브가 따라와요 → 공을 받은 뒤 ✊ 주먹을 쥐면 초록 칸에서 던지기',
      onEvent: (type) => { if (type === 'fist') this.release(); },
    });
    const s = this.scene;
    s.fog = new THREE.Fog('#1d2a3a', 30, 70);
    this.scene.add(new THREE.HemisphereLight('#fff6e0', '#4a5a3a', 1.4));
    const sun = new THREE.DirectionalLight('#ffffff', 1.8);
    sun.position.set(-4, 16, 6); sun.target.position.set(0, 0, -7); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, far: 60 });
    s.add(sun, sun.target);
    // 그라운드: 잔디 줄무늬 + 내야 흙
    for (let i = 0; i < 14; i++) box(40, 0.04, 2.5, i % 2 ? '#4f9e3a' : '#5bab45', 0, -0.02, 6 - i * 2.5, s).castShadow = false;
    box(9, 0.05, 9, '#c98a56', 0, 0.0, -7, s).castShadow = false;
    box(1.2, 0.3, 1.2, '#d9a06a', 0, 0.12, PZ, s); // 마운드
    for (const [x, z] of [[0, -2], [-4.2, -7], [4.2, -7], [0, -12]]) { const b = box(0.5, 0.06, 0.5, '#ffffff', x, 0.03, z, s); b.rotation.y = Math.PI / 4; }
    // 관중석 + 돔 지붕
    const r = rng(5), crowd = ['#e8413a', '#3f7fe0', '#ffd23f', '#ffffff', '#f28c28', '#2a2a2a'];
    for (let row = 0; row < 5; row++) {
      const z = PZ - 6 - row * 1.1, y = row * 0.7;
      box(40, 0.7, 1.1, row % 2 ? '#3a4a6a' : '#43557a', 0, y + 0.35, z, s);
      for (let x = -19; x <= 19; x += 0.6) if (r() < 0.65) box(0.34, 0.42, 0.3, crowd[(r() * crowd.length) | 0], x, y + 0.9, z, s);
    }
    for (const sx of [-1, 1]) for (let row = 0; row < 4; row++) box(1.1, 0.7, 30, '#3a4a6a', sx * (13 + row * 1.1), row * 0.7 + 0.35, -8, s);
    for (let i = 0; i < 9; i++) { // 돔 지붕 골조
      const a = (i / 8) * Math.PI;
      const beam = box(0.4, 0.4, 46, '#c9cdd3', Math.cos(a) * 18, 4 + Math.sin(a) * 9, -8, s); beam.castShadow = false;
    }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 18.5, 46, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#e9ecef', side: THREE.BackSide }));
    roof.rotation.x = Math.PI / 2; roof.position.set(0, 4, -8); s.add(roof);
    const board = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 0.2), new THREE.MeshLambertMaterial({ map: signTexture('고척스카이돔', { w: 128, h: 26, size: 14, bg: '#2f4f8f', fg: '#ffffff' }) }));
    board.position.set(0, 5.6, PZ - 12); s.add(board);
    for (const x of [-12, -6, 6, 12]) { const l = box(1.4, 0.3, 0.6, '#fffbe8', x, 11.5, -6, s); l.material = new THREE.MeshBasicMaterial({ color: '#fffbe8' }); }

    // 상대 (포수 마스크 쓴 친구)
    const sk = npcSkin({ shirt: '#f4f4f4', pants: '#f4f4f4', hair: '#1e1a18', shoe: '#222222', number: '#2f4f8f' });
    this.partner = new Avatar(sk, { height: 1.6 });
    this.partner.root.position.set(0, 0.2, PZ); this.partner.root.rotation.y = 0; s.add(this.partner.root);
    box(0.36, 0.3, 0.3, '#7a4a26', 0, 0, 0.0, this.partner.joints.armL).position.set(0, -0.62, 0.05); // 상대 글러브
    // 공
    const ballMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), ballMat); this.ball.castShadow = true; s.add(this.ball);
    box(0.02, 0.2, 0.02, '#e8413a', 0.06, 0, 0, this.ball); box(0.02, 0.2, 0.02, '#e8413a', -0.06, 0, 0, this.ball);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 8), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3 }));
    this.shadow.rotation.x = -Math.PI / 2; s.add(this.shadow);
    // 내 글러브
    this.glove = new THREE.Group();
    box(0.5, 0.52, 0.18, '#9a5a2a', 0, 0, 0, this.glove); box(0.36, 0.36, 0.06, '#c98a50', 0, 0.02, -0.11, this.glove);
    for (let i = 0; i < 4; i++) box(0.09, 0.2, 0.12, '#9a5a2a', -0.17 + i * 0.115, 0.33, 0, this.glove);
    box(0.14, 0.24, 0.14, '#9a5a2a', 0.3, -0.05, 0, this.glove);
    s.add(this.glove);
    // 도착 지점 표시 (점선 고리)
    this.aim = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 12), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, depthTest: false }));
    s.add(this.aim);
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -CZ);
    this.camera.position.set(0, 3.1, 5.2);
    this.camera.lookAt(0, 1.2, -6);
  }

  onAvatar() { this.player.position.set(-0.9, 0, -0.2); this.player.rotation.y = Math.PI; }

  reset() {
    this.caught = 0; this.combo = 0; this.maxCombo = 0; this.goodThrows = 0;
    this.gpos = new THREE.Vector2(0, 1.4); this.gwant = this.gpos.clone();
    this.phase = 'wind'; this.phaseT = 1.0; this.fly = null; this.back = null; this.keysRef = new Set();
    this.yaw = Math.PI;
    this.ball.position.set(0.3, 1.2, PZ + 0.4);
    this.overlay();
  }

  overlay() {
    const o = $('miniOverlay');
    o.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'power-bar catch-bar hidden';
    bar.innerHTML = '<span>던지기</span><div class="catch-track"><b class="zone"></b><b class="perfect"></b><i class="needle"></i></div>';
    o.appendChild(bar);
    this.bar = bar;
  }

  // ---------- 상대가 던지기 ----------
  throwIn() {
    const c = this.combo;
    const kind = c >= 3 && Math.random() < 0.18 ? 'pop' : c >= 2 && Math.random() < 0.25 ? 'curve' : 'line';
    const spread = Math.min(GX - 0.3, 0.8 + c * 0.22);
    const tx = (Math.random() * 2 - 1) * spread;
    const ty = kind === 'pop' ? 0.9 + Math.random() * 1.2 : GY0 + 0.25 + Math.random() * (GY1 - GY0 - 0.5);
    const tf = kind === 'pop' ? 2.1 : Math.max(0.72, 1.35 - c * 0.05) + Math.random() * 0.15;
    this.fly = {
      p0: new THREE.Vector3(0.35, 1.7, PZ + 0.5), p1: new THREE.Vector3(tx, ty, CZ), t: 0, tf, kind,
      arc: kind === 'pop' ? 7 : 0.6 + Math.random() * 0.5, curve: kind === 'curve' ? (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random()) : 0,
    };
    this.phase = 'incoming';
    sfx.jump();
    if (kind === 'pop') this.float(new THREE.Vector3(0, 3.2, -5), '높이 뜬 공!', '');
    if (kind === 'curve') this.float(new THREE.Vector3(0, 3.2, -5), '휘는 공!', '');
  }
  ballAt(f, s) {
    const p = f.p0.clone().lerp(f.p1, s);
    p.y += f.arc * 4 * s * (1 - s);
    p.x += f.curve * Math.sin(Math.PI * s) * (1 - s) * 1.3; // 처음엔 바깥으로, 끝에는 목표로 휘어 들어옴
    return p;
  }

  // ---------- 입력 ----------
  pointer(e, w, h) {
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.plane, p)) { this.gwant.set(p.x, p.y); this.mouseT = 0.6; }
  }
  pointerDown() { this.release(); }
  keyDown(code) { if (code === 'Space' || code === 'Enter') this.release(); }

  release() {
    if (this.state !== 'play' || this.phase !== 'aim') return;
    const v = this.needle;
    const perfect = Math.abs(v - 0.55) < 0.04, good = Math.abs(v - 0.55) < 0.12;
    const target = new THREE.Vector3(0.0, 1.2, PZ + 0.4);
    let miss = 0;
    if (!good) { miss = (v < 0.55 ? -1 : 1); target.x += miss * (2.2 + Math.random() * 1.5); target.y = v < 0.55 ? 0.3 : 3.2; }
    this.back = { p0: new THREE.Vector3(this.gpos.x - 0.2, 1.6, CZ), p1: target, t: 0, tf: 0.85, arc: 1.0, curve: 0, good, perfect };
    this.bar.classList.add('hidden');
    this.phase = 'out';
    sfx.jump();
    const pos = new THREE.Vector3(0, 2.6, -4);
    if (perfect) { this.score += 10; this.goodThrows++; this.float(pos, '스트라이크 송구! +10', 'gold'); }
    else if (good) { this.score += 5; this.goodThrows++; this.float(pos, '좋은 송구! +5', 'gold'); }
    else { this.combo = 0; this.float(pos, '악송구! 콤보 끝', 'bad'); }
    if (!good) { this.partnerRun = target.x; }
  }

  // ---------- 진행 ----------
  idle(dt, t) {
    this.partner.animate(dt, t, { wave: this.state === 'done' });
    this.avatar.animate(dt, t, { yaw: this.yaw, wave: this.state === 'done' });
    this.moveGlove(dt);
    this.shadow.position.set(this.ball.position.x, 0.03, this.ball.position.z);
  }

  moveGlove(dt) {
    const k = this.keysRef;
    let dx = 0, dy = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) dy += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy -= 1;
    if (dx || dy) { this.gwant.x += dx * 5 * dt; this.gwant.y += dy * 4 * dt; }
    // 손으로 하기: 손 위치 → 글러브 (화면 가운데 영역만 움직여도 끝까지)
    const hc = this.camCtl.on && this.camCtl.hands.center();
    if (hc) this.gwant.set(THREE.MathUtils.clamp((hc.x - 0.5) / 0.32, -1, 1) * GX, GY1 - THREE.MathUtils.clamp((hc.y - 0.2) / 0.55, 0, 1) * (GY1 - GY0));
    this.gwant.x = THREE.MathUtils.clamp(this.gwant.x, -GX, GX); this.gwant.y = THREE.MathUtils.clamp(this.gwant.y, GY0, GY1);
    this.gpos.lerp(this.gwant, Math.min(1, dt * 18));
    this.glove.position.set(this.gpos.x, this.gpos.y, CZ + 0.05);
    this.glove.rotation.z = -this.gpos.x * 0.08;
    // 몸은 글러브 왼쪽에서 따라감 (글러브를 가리지 않게)
    const p = this.player.position, want = THREE.MathUtils.clamp(this.gpos.x - 0.95, -3.4, 1.8);
    const moving = Math.abs(want - p.x) > 0.08;
    p.x += (want - p.x) * Math.min(1, dt * 8);
    return moving;
  }

  step(dt, t) {
    const moving = this.moveGlove(dt);
    this.avatar.animate(dt, t, { moving, yaw: this.yaw, armsUp: this.phase === 'incoming' && this.fly?.kind === 'pop' && this.fly.t > this.fly.tf * 0.5 });
    // 상대 움직임 (악송구면 공 쫓아 뛰어감)
    const pp = this.partner.root.position;
    const px = this.partnerRun ?? 0;
    const pm = Math.abs(px - pp.x) > 0.1;
    pp.x += Math.sign(px - pp.x) * Math.min(Math.abs(px - pp.x), 5 * dt);
    this.partner.animate(dt, t, { moving: pm, run: pm, yaw: pm ? (px > pp.x ? Math.PI / 2 : -Math.PI / 2) : 0, wave: this.phase === 'wind' && this.phaseT > 0.6 });

    if (this.phase === 'wind') {
      // 상대가 공을 들고 준비
      this.ball.position.set(pp.x + 0.35, 1.25 + Math.max(0, 0.6 - this.phaseT) * 0.8, PZ + 0.45);
      this.phaseT -= dt;
      if (this.phaseT <= 0 && Math.abs(pp.x) < 0.15) { this.partnerRun = 0; pp.x = 0; this.throwIn(); }
      if (Math.abs(pp.x) >= 0.15) this.partnerRun = 0;
    } else if (this.phase === 'incoming') {
      const f = this.fly;
      f.t += dt;
      const s = Math.min(1, f.t / f.tf);
      this.ball.position.copy(this.ballAt(f, s));
      this.ball.rotation.x += dt * 20;
      // 도착 지점 미리 보여주기 (마지막 절반)
      this.aim.position.set(f.p1.x, f.p1.y, CZ - 0.02);
      this.aim.material.opacity = s > 0.45 ? 0.35 + 0.4 * Math.abs(Math.sin(t * 10)) : 0;
      if (s >= 1) {
        this.aim.material.opacity = 0;
        const d = Math.hypot(this.gpos.x - f.p1.x, this.gpos.y - f.p1.y);
        if (d < REACH) this.catchIt(d, f);
        else { this.phase = 'miss'; this.phaseT = 1.1; this.missV = f.p1.clone().sub(this.ballAt(f, 0.95)).multiplyScalar(20); this.hurt(f.p1.clone().add(new THREE.Vector3(0, 0.6, 0)), '놓쳤다!'); this.combo = 0; }
      }
    } else if (this.phase === 'miss') {
      // 놓친 공은 뒤로 굴러감 → 상대가 새 공을 꺼냄
      this.missV.y -= 18 * dt;
      this.ball.position.addScaledVector(this.missV, dt);
      if (this.ball.position.y < 0.1) { this.ball.position.y = 0.1; this.missV.y *= -0.4; this.missV.multiplyScalar(0.8); }
      this.phaseT -= dt;
      if (this.phaseT <= 0) { this.phase = 'wind'; this.phaseT = 0.9; }
    } else if (this.phase === 'aim') {
      // 바늘이 왔다갔다 (콤보가 높을수록 빨라짐)
      this.aimT += dt * (1.1 + Math.min(this.combo, 10) * 0.12);
      this.needle = 1 - Math.abs(((this.aimT) % 2) - 1);
      this.bar.querySelector('.needle').style.left = `${this.needle * 100}%`;
      this.ball.position.set(this.gpos.x, this.gpos.y, CZ + 0.02);
    } else if (this.phase === 'out') {
      const f = this.back;
      f.t += dt;
      const s = Math.min(1, f.t / f.tf);
      this.ball.position.copy(this.ballAt(f, s));
      if (s >= 1) {
        if (f.good) { sfx.catch(this.combo); this.phase = 'wind'; this.phaseT = 0.7; }
        else { this.phase = 'wind'; this.phaseT = 1.6; }
      }
    }
    this.shadow.position.set(this.ball.position.x, 0.03, this.ball.position.z);
  }
  update(dt, t, keys) { this.keysRef = keys; super.update(dt, t, keys); }

  catchIt(d, f) {
    this.caught++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    const center = d < 0.2;
    let pts = 10 + Math.min(this.combo, 10) * 2 + (center ? 5 : 0) + (f.kind === 'pop' ? 10 : f.kind === 'curve' ? 5 : 0);
    this.score += pts;
    sfx.catch(this.combo);
    const pos = new THREE.Vector3(this.gpos.x, this.gpos.y + 0.6, CZ);
    this.float(pos, `${center ? '정확히 ' : ''}잡았다! +${pts}`, 'gold');
    this.glove.scale.setScalar(1.25); setTimeout(() => this.glove.scale.setScalar(1), 120);
    this.phase = 'aim'; this.aimT = Math.random() * 0.6; this.needle = 0;
    this.bar.classList.remove('hidden');
  }

  extraText() { return this.combo > 1 ? `콤보 ${this.combo}` : ''; }
  resultRows() {
    return [['잡은 공', `${this.caught}개`], ['최대 콤보', `${this.maxCombo}`], ['좋은 송구', `${this.goodThrows}번`]];
  }
  finish() { this.bar?.classList.add('hidden'); super.finish(); }
  start() { this.partnerRun = 0; super.start(); }
}
