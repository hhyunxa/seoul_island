import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { box, makeTree } from '../world.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { CamControl } from './camctl.js';

const HALF_W = 6.2;     // 이동 가능한 좌우 범위
const FRUITS = {
  apple: { pts: 1, w: 30 }, orange: { pts: 1, w: 25 }, grape: { pts: 2, w: 14 }, golden: { pts: 5, w: 4 }, rock: { pts: 0, w: 0 },
};

function makeFruit(kind) {
  const g = new THREE.Group();
  if (kind === 'apple') {
    box(0.42, 0.4, 0.42, '#e8413a', 0, 0, 0, g); box(0.06, 0.14, 0.06, '#6b3b1c', 0, 0.26, 0, g); box(0.16, 0.06, 0.1, '#5fae3e', 0.1, 0.3, 0, g);
    box(0.1, 0.1, 0.02, '#ff9f94', -0.1, 0.08, 0.21, g);
  } else if (kind === 'orange') {
    box(0.42, 0.42, 0.42, '#ff9a2e', 0, 0, 0, g); box(0.12, 0.06, 0.12, '#3f8a2a', 0, 0.24, 0, g);
    box(0.08, 0.08, 0.02, '#ffd08a', -0.1, 0.1, 0.21, g);
  } else if (kind === 'grape') {
    for (const [x, y] of [[-0.13, 0.12], [0.13, 0.12], [0, 0.12], [-0.07, -0.02], [0.07, -0.02], [0, -0.15]]) box(0.15, 0.15, 0.15, '#9b5de5', x, y, 0, g);
    box(0.05, 0.12, 0.05, '#6b3b1c', 0, 0.26, 0, g);
  } else if (kind === 'golden') {
    const m = toonMat({ color: '#ffd23f', emissive: '#8a6a00' });
    box(0.46, 0.44, 0.46, m, 0, 0, 0, g); box(0.06, 0.14, 0.06, '#6b3b1c', 0, 0.28, 0, g); box(0.12, 0.12, 0.02, '#fffbe0', -0.1, 0.1, 0.23, g);
  } else {
    box(0.5, 0.42, 0.46, '#7d7d8a', 0, 0, 0, g); box(0.3, 0.2, 0.3, '#a5a5b5', 0.06, 0.26, 0, g); box(0.1, 0.1, 0.02, '#5f5f6e', -0.12, -0.05, 0.24, g);
  }
  return g;
}

// 과일 받기: 머리 위 바구니로 떨어지는 과일 받기, 돌멩이 피하기
export class FruitGame extends MiniGame {
  static meta = {
    id: 'fruit', title: '과일 받기', duration: 45, hearts: 3, resultTitle: '수확 끝!',
    hint: 'A/D · 방향키 · 마우스로 이동 — 돌멩이는 피하세요!',
  };

  build() {
    this.camCtl = new CamControl(this, { hint: '✋ 손을 좌우로 움직이면 바구니가 따라와요 (한 손이든 두 손이든 OK) — 돌멩이는 피하세요!' });
    this.camera.position.set(0, 5.4, 15);
    this.camera.lookAt(0, 2.6, 0);
    this.items = [];
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1);
    const s = this.scene;
    this.lights();
    const g = this.tileGround(40, 30, (x, y) => (y >= 15 && y <= 16 ? 'path' : 'grass'));
    g.position.z = 0.5;
    const tr = (() => { let a = 5; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const cols = ['#e8413a', '#ff9a2e', '#9b5de5', '#e8413a', '#ff9a2e'];
    [-8, -4, 0, 4, 8].forEach((x, i) => {
      const t = makeTree(tr, 'fruit', cols[i]); t.scale.setScalar(1.9); t.position.set(x, 0, -4.5); s.add(t);
    });
    for (let x = -12; x <= 12; x += 1) box(0.16, 0.8, 0.16, '#8a5428', x, 0.4, -2.2, s);
    box(25, 0.1, 0.08, '#b5763b', 0, 0.55, -2.2, s); box(25, 0.1, 0.08, '#b5763b', 0, 0.3, -2.2, s);
    for (const x of [-7.5, 7.5]) { box(0.9, 0.5, 0.7, '#b5763b', x, 0.25, -1.2, s); box(0.7, 0.2, 0.5, '#e8413a', x, 0.55, -1.2, s); }
    this.shadowGeo = new THREE.CircleGeometry(0.28, 8);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25 });
    // 바구니
    const basket = new THREE.Group();
    box(1.25, 0.12, 0.8, '#8a5428', 0, 0, 0, basket);
    box(1.25, 0.32, 0.1, '#b5763b', 0, 0.16, 0.36, basket);
    box(1.25, 0.32, 0.1, '#b5763b', 0, 0.16, -0.36, basket);
    box(0.1, 0.32, 0.8, '#b5763b', 0.6, 0.16, 0, basket);
    box(0.1, 0.32, 0.8, '#b5763b', -0.6, 0.16, 0, basket);
    box(1.3, 0.06, 0.06, '#d99a5c', 0, 0.25, 0.42, basket);
    this.basket = basket;
    s.add(basket);
    this.flashTargets = [basket];
  }

  onAvatar() {
    const h = this.avatar.height;
    this.basketBase = h + 0.04;
    this.basketY = h + 0.27;
    this.player.position.set(0, 0, 1);
  }

  pointer(e, w, h) {
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.plane, p)) this.mouseX = THREE.MathUtils.clamp(p.x, -HALF_W, HALF_W);
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.mesh, it.shadow);
    this.items = [];
    this.caught = 0; this.spawnT = 0.6; this.elapsed = 0; this.vx = 0; this.mouseX = null;
    this.player.position.x = 0;
  }

  extraText() { const m = this.mult(); return this.combo >= 3 ? `${this.combo}콤보${m > 1 ? ` ×${m}` : ''}` : ''; }
  mult() { return Math.min(4, 1 + Math.floor(this.combo / 5)); }

  spawn() {
    const prog = this.elapsed / this.duration;
    let kind;
    if (Math.random() < 0.16 + prog * 0.16) kind = 'rock';
    else {
      const tot = Object.values(FRUITS).reduce((a, f) => a + f.w, 0);
      let x = Math.random() * tot;
      kind = Object.keys(FRUITS).find((k) => (x -= FRUITS[k].w) < 0);
    }
    const mesh = makeFruit(kind);
    mesh.traverse((o) => (o.castShadow = true));
    const x = (Math.random() * 2 - 1) * HALF_W;
    mesh.position.set(x, 8.5, 1);
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, 0.02, 1);
    this.scene.add(mesh, shadow);
    this.items.push({ kind, mesh, shadow, vy: -(1.6 + prog * 2.4 + Math.random() * 0.8), spin: (Math.random() - 0.5) * 6, splat: 0 });
  }

  idle(dt, t) { this.pose(dt, t, false); this.updateItems(dt, false); }

  step(dt, t, keys) {
    const p = this.player;
    this.elapsed += dt;
    // 손으로 하기: 손(두 손이면 가운데) 좌우 위치 → 바구니. 화면 가운데 60%만 움직여도 끝까지 가게
    const hc = this.camCtl.on && this.camCtl.hands.center();
    if (hc) this.mouseX = THREE.MathUtils.clamp((hc.x - 0.5) / 0.3, -1, 1) * HALF_W;
    let dir = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dir -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dir += 1;
    const speed = 8.5;
    if (dir !== 0) { this.mouseX = null; this.vx = dir * speed; }
    else if (this.mouseX !== null) { const d = this.mouseX - p.position.x; this.vx = Math.abs(d) < 0.05 ? 0 : THREE.MathUtils.clamp(d * 10, -speed, speed); }
    else this.vx *= 0.7;
    p.position.x = THREE.MathUtils.clamp(p.position.x + this.vx * dt, -HALF_W, HALF_W);
    this.pose(dt, t, Math.abs(this.vx) > 0.3);
    this.basket.rotation.z = -this.vx * 0.012;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      const prog = this.elapsed / this.duration;
      this.spawnT = Math.max(0.32, 0.95 - prog * 0.6) * (0.7 + Math.random() * 0.6);
      if (prog > 0.5 && Math.random() < 0.25) this.spawn();
    }
    this.updateItems(dt, true);
  }

  updateItems(dt, live) {
    const p = this.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.mesh;
      if (it.splat > 0) {
        it.splat -= dt; m.scale.y = Math.max(0.2, m.scale.y - dt * 4);
        if (it.splat <= 0) { this.scene.remove(m, it.shadow); this.items.splice(i, 1); }
        continue;
      }
      it.vy -= 4.5 * dt;
      m.position.y += it.vy * dt;
      m.rotation.z += it.spin * dt;
      const hgt = m.position.y;
      it.shadow.scale.setScalar(THREE.MathUtils.clamp(1.4 - hgt * 0.1, 0.4, 1.4));
      if (live && hgt < this.basketY + 0.25 && hgt > this.basketY - 0.35 && Math.abs(m.position.x - p.position.x) < 0.78) {
        this.scene.remove(m, it.shadow); this.items.splice(i, 1);
        this.catchItem(it.kind, m.position);
        continue;
      }
      if (hgt <= 0.22) {
        m.position.y = 0.22; it.splat = 0.5; it.shadow.visible = false;
        if (live && it.kind !== 'rock') { if (this.combo >= 3) this.float(m.position, '콤보 끊김', 'bad'); this.combo = 0; sfx.miss(); }
      }
    }
  }

  catchItem(kind, pos) {
    if (kind === 'rock') { this.hurt(pos); return; }
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.caught++;
    const pts = FRUITS[kind].pts * this.mult();
    this.score += pts;
    kind === 'golden' ? sfx.gold() : sfx.catch(this.combo);
    this.float(pos, `+${pts}`, kind === 'golden' ? 'gold' : '');
    this.squash = 0.1;
  }

  pose(dt, t, moving) {
    const yaw = moving ? Math.sign(this.vx) * 1.15 : 0;
    this.avatar.animate(dt, t, { moving, run: moving, yaw, armsUp: true });
    this.squash = Math.max(0, (this.squash || 0) - dt);
    this.basket.position.set(this.player.position.x, this.basketBase + this.avatar.torso.position.y - (this.squash > 0 ? 0.08 : 0), this.player.position.z);
  }

  resultRows() { return [['받은 과일', `${this.caught}개`], ['최대 콤보', this.maxCombo]]; }
}
