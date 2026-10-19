import * as THREE from 'three';
import { box, makeChicken, makeTree } from '../world.js';
import { roofTexture, plankTexture, rng, signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame, addFence } from './base.js';

const ARENA = { x0: -10, x1: 10, z0: -7, z1: 7 };
const PEN = { x0: -2.6, x1: 2.6, z0: -7, z1: -3.4, gate: 1.15 }; // 닭장 울타리, 앞쪽 가운데가 입구
const N_CHICKENS = 7;

// 닭 몰이: 닭은 나를 피해 도망감 → 닭장 입구로 몰아넣기
export class ChickenGame extends MiniGame {
  static meta = {
    id: 'chicken', title: '닭 몰이', duration: 60, resultTitle: '닭 몰이 끝!', fov: 40,
    hint: 'WASD/방향키 이동 · Shift 달리기 — 닭은 나를 피해 도망가요. 뒤로 돌아가서 닭장(위쪽) 입구로 몰아요!',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-8, 18, 10], size: 16 });
    this.tileGround(30, 24, (x, y) => (y < 5 ? 'grass' : 'grass'), 21);
    // 바깥 울타리
    addFence(s, box, ARENA.x0, ARENA.z0, ARENA.x1, ARENA.z0);
    addFence(s, box, ARENA.x0, ARENA.z1, ARENA.x1, ARENA.z1);
    addFence(s, box, ARENA.x0, ARENA.z0, ARENA.x0, ARENA.z1);
    addFence(s, box, ARENA.x1, ARENA.z0, ARENA.x1, ARENA.z1);
    // 닭장 울타리 (흰색) — 앞쪽에 입구
    const W = '#f4ead8';
    addFence(s, box, PEN.x0, PEN.z0, PEN.x0, PEN.z1, W);
    addFence(s, box, PEN.x1, PEN.z0, PEN.x1, PEN.z1, W);
    addFence(s, box, PEN.x0, PEN.z1, -PEN.gate, PEN.z1, W);
    addFence(s, box, PEN.gate, PEN.z1, PEN.x1, PEN.z1, W);
    // 바닥 짚
    const straw = box(5.1, 0.04, 3.5, '#e8cf7a', 0, 0.02, (PEN.z0 + PEN.z1) / 2, s); straw.castShadow = false;
    // 닭장 집
    const coop = new THREE.Group(); coop.position.set(0, 0, -8.6);
    const pl = new THREE.MeshLambertMaterial({ map: plankTexture('#d9534a', '#a83a32', '#ea7a6e') }); pl.map.repeat.set(2, 1);
    box(4, 1.8, 2, pl, 0, 0.9, 0, coop);
    const roof = box(4.6, 0.3, 2.6, new THREE.MeshLambertMaterial({ map: roofTexture() }), 0, 2.0, 0, coop); roof.rotation.x = 0.12;
    box(1, 1.1, 0.1, '#5b2f12', 0, 0.55, 1.02, coop);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.06), new THREE.MeshLambertMaterial({ map: signTexture('닭장', { w: 96, h: 28, size: 14, bg: '#ffd23f' }) }));
    sign.position.set(0, 1.5, 1.05); coop.add(sign);
    s.add(coop);
    // 화살표 표시 (입구)
    this.arrow = new THREE.Group();
    box(0.5, 0.06, 0.5, '#ffd23f', 0, 0, 0, this.arrow).rotation.y = Math.PI / 4;
    box(0.22, 0.06, 0.6, '#ffd23f', 0, 0, 0.45, this.arrow);
    this.arrow.position.set(0, 0.06, PEN.z1 + 0.8);
    s.add(this.arrow);
    // 주변 나무
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const t = makeTree(r, r() < 0.5 ? 'pine' : 'round');
      const side = i % 2 ? 1 : -1;
      t.position.set(side * (12 + r() * 3), 0, -8 + (i >> 1) * 2.4);
      s.add(t);
    }
    this.camera.position.set(0, 15, 12.5);
    this.camera.lookAt(0, 0, -0.6);
    this.chickens = [];
  }

  onAvatar() { this.player.position.set(0, 0, 5); }

  // 벽 충돌: 바깥 울타리 + 닭장 (닭장 안 닭은 입구도 막힘, 플레이어는 닭장에 못 들어감)
  free(x, z, r, who) {
    if (x < ARENA.x0 + r || x > ARENA.x1 - r || z < ARENA.z0 + r || z > ARENA.z1 - r) return false;
    const inPenBox = (px, pz, m) => px > PEN.x0 - m && px < PEN.x1 + m && pz > PEN.z0 - m && pz < PEN.z1 + m;
    if (who === 'player') return !inPenBox(x, z, r);
    if (who === 'penned') return x > PEN.x0 + r && x < PEN.x1 - r && z < PEN.z1 - r;
    // 바깥 닭: 닭장 옆/앞 울타리는 통과 못하고, 입구로만 들어감
    if (inPenBox(x, z, r)) {
      const throughGate = Math.abs(x) < PEN.gate - r * 0.5;
      const insideSides = x > PEN.x0 + r && x < PEN.x1 - r;
      if (!(throughGate || (insideSides && z < PEN.z1 - r))) return false;
    }
    return true;
  }

  reset() {
    for (const c of this.chickens) this.scene.remove(c);
    this.chickens = [];
    for (let i = 0; i < N_CHICKENS; i++) {
      const c = makeChicken();
      c.position.set(-8 + Math.random() * 16, 0, -1 + Math.random() * 6);
      c.userData.vel = new THREE.Vector3(); c.userData.wander = 0; c.userData.penned = false;
      c.traverse((o) => (o.castShadow = true));
      this.scene.add(c); this.chickens.push(c);
    }
    this.player.position.set(0, 0, 5.5);
    this.yaw = Math.PI; this.penned = 0;
  }

  idle(dt, t) { this.avatar.animate(dt, t, { yaw: this.yaw }); this.arrow.position.y = 0.06 + Math.abs(Math.sin(t * 4)) * 0.15; }

  step(dt, t, keys) {
    // 플레이어 이동
    const mv = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) mv.z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mv.z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mv.x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mv.x += 1;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const p = this.player.position;
    if (mv.lengthSq()) {
      mv.normalize().multiplyScalar((run ? 6.8 : 4.6) * dt);
      if (this.free(p.x + mv.x, p.z, 0.35, 'player')) p.x += mv.x;
      if (this.free(p.x, p.z + mv.z, 0.35, 'player')) p.z += mv.z;
      this.yaw = Math.atan2(mv.x, mv.z);
    }
    this.avatar.animate(dt, t, { moving: mv.lengthSq() > 0, run, yaw: this.yaw });
    this.arrow.position.y = 0.06 + Math.abs(Math.sin(t * 4)) * 0.15;

    // 닭 AI
    for (const c of this.chickens) {
      const u = c.userData;
      const away = c.position.clone().sub(p).setY(0);
      const d = away.length();
      let speed = 1.0;
      const want = new THREE.Vector3();
      if (!u.penned && d < 3.4) {
        want.copy(away.normalize()).multiplyScalar(1 + (3.4 - d) * 0.6);
        speed = 3.6 + (run ? 0.6 : 0);
        if (!u.scared) { u.scared = true; if (Math.random() < 0.4) sfx.talk(); }
      } else {
        u.scared = false;
        u.wander -= dt;
        if (u.wander <= 0) { u.wander = 0.8 + Math.random() * 2; u.wdir = Math.random() < 0.4 ? null : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(); }
        if (u.wdir) want.copy(u.wdir).multiplyScalar(0.6);
        speed = u.penned ? 0.6 : 1.2;
      }
      u.vel.lerp(want.multiplyScalar(speed), Math.min(1, dt * 6));
      const who = u.penned ? 'penned' : 'chicken';
      const nx = c.position.x + u.vel.x * dt, nz = c.position.z + u.vel.z * dt;
      let moved = false;
      if (this.free(nx, c.position.z, 0.3, who)) { c.position.x = nx; moved = true; } else u.vel.x *= -0.5;
      if (this.free(c.position.x, nz, 0.3, who)) { c.position.z = nz; moved = true; } else u.vel.z *= -0.5;
      const sp = u.vel.length();
      if (sp > 0.2) { c.rotation.y = Math.atan2(u.vel.x, u.vel.z); c.position.y = Math.abs(Math.sin(t * 18 + c.id)) * 0.08 * Math.min(1, sp / 2); }
      else { c.position.y = 0; u.body.rotation.x = Math.max(0, Math.sin(t * 6 + c.id)) * 0.4; }
      if (sp > 0.2) u.body.rotation.x = 0;
      // 날갯짓 (겁먹었을 때 몸 들썩)
      u.body.position.y = u.scared ? Math.abs(Math.sin(t * 30)) * 0.05 : 0;
      // 닭장 안으로 들어옴
      if (!u.penned && c.position.z < PEN.z1 - 0.45 && c.position.x > PEN.x0 && c.position.x < PEN.x1) {
        u.penned = true; this.penned++;
        this.score += 10;
        sfx.coin();
        this.float(c.position.clone().add(new THREE.Vector3(0, 1, 0)), '+10 꼬꼬!', 'gold');
      }
      if (!moved) u.wander = 0;
    }
    if (this.penned >= N_CHICKENS) {
      const bonus = Math.ceil(this.time);
      this.score += bonus;
      this.bonus = bonus;
      this.float(p.clone().add(new THREE.Vector3(0, 2.2, 0)), `전부 성공! 남은 시간 +${bonus}`, 'gold');
      this.finish();
    }
  }

  extraText() { return `닭장 ${this.penned}/${N_CHICKENS}`; }
  resultRows() {
    const rows = [['닭장에 넣은 닭', `${this.penned}/${N_CHICKENS}마리`]];
    if (this.bonus) rows.push(['남은 시간 보너스', `+${this.bonus}`]);
    return rows;
  }
  start() { this.bonus = 0; super.start(); }
}
