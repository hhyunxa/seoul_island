import * as THREE from 'three';
import { box, makeTree } from '../world.js';
import { waterTexture, canvasTexture, drawTile, rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';

const PX = -4;          // 플레이어 x 위치 (화면 왼쪽)
const GRAV = 30;

function makeObstacle(kind) {
  const g = new THREE.Group();
  let w = 0.7, h = 0.7, y0 = 0;
  if (kind === 'log') {
    const m = box(0.8, 0.62, 1.2, '#8a5428', 0, 0.31, 0, g); m.rotation.y = 0;
    box(0.82, 0.5, 0.06, '#c9a26b', 0, 0.31, 0.6, g); box(0.4, 0.22, 0.06, '#8a5428', 0, 0.31, 0.62, g);
    w = 0.8; h = 0.62;
  } else if (kind === 'crab') {
    box(0.7, 0.32, 0.5, '#e8413a', 0, 0.26, 0, g);
    box(0.2, 0.2, 0.2, '#e8413a', -0.45, 0.4, 0.1, g); box(0.2, 0.2, 0.2, '#e8413a', 0.45, 0.4, 0.1, g);
    box(0.06, 0.16, 0.06, '#222', -0.12, 0.5, 0.18, g); box(0.06, 0.16, 0.06, '#222', 0.12, 0.5, 0.18, g);
    for (const x of [-0.3, -0.1, 0.1, 0.3]) box(0.06, 0.18, 0.06, '#c0302a', x, 0.08, 0.2, g);
    w = 0.9; h = 0.55;
  } else if (kind === 'rocks') {
    box(1.0, 0.7, 0.9, '#8f8f9a', 0, 0.35, 0, g); box(0.7, 0.55, 0.7, '#a5a5b5', 0.1, 0.95, 0, g);
    w = 1.0; h = 1.22;
  } else if (kind === 'gull') { // 머리 위로 낮게 나는 갈매기: 점프하면 부딪힘
    const body = new THREE.Group(); g.add(body);
    box(0.6, 0.24, 0.26, '#ffffff', 0, 0, 0, body); box(0.2, 0.2, 0.2, '#ffffff', -0.36, 0.08, 0, body);
    box(0.14, 0.06, 0.08, '#f2a93b', -0.5, 0.06, 0, body); box(0.04, 0.04, 0.2, '#222', -0.4, 0.12, 0, body);
    const wl = box(0.3, 0.04, 0.5, '#d8dde5', 0, 0.1, 0.35, body), wr = box(0.3, 0.04, 0.5, '#d8dde5', 0, 0.1, -0.35, body);
    g.userData.wings = [wl, wr];
    y0 = 2.05; w = 0.7; h = 0.3;
  } else { // coin
    const m = new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#6a4a00' });
    box(0.36, 0.36, 0.1, m, 0, 0, 0, g); box(0.12, 0.2, 0.12, '#fff6b0', 0, 0, 0.02, g);
    w = 0.45; h = 0.45;
  }
  g.traverse((o) => (o.castShadow = true));
  g.userData.box = { w, h, y0 };
  return g;
}

// 해변 달리기: 장애물 넘기 (2단 점프 가능), 갈매기는 점프하지 말고 그냥 지나가기
export class RunnerGame extends MiniGame {
  static meta = {
    id: 'runner', title: '해변 달리기', duration: 60, hearts: 3, resultTitle: '완주!', fov: 40, sky: '#9fd8f5',
    hint: 'Space · W · ↑ · 클릭 = 점프 (공중에서 한 번 더!) — 갈매기는 점프하지 말고 그냥 통과하세요',
  };

  build() {
    const s = this.scene;
    this.scene.fog = new THREE.Fog('#9fd8f5', 30, 60);
    this.lights({ pos: [-4, 14, 10], size: 14 });
    // 바다
    const wt = waterTexture(); wt.repeat.set(50, 15); this.waterTex = wt;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshLambertMaterial({ map: wt }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.3, -32); s.add(sea);
    // 모래 길 (스크롤)
    const c = document.createElement('canvas'); c.width = 64; c.height = 96;
    const g = c.getContext('2d'); const r = rng(4);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) drawTile(g, x * 16, y * 16, 'sand', r);
    const tex = canvasTexture(c, true); tex.repeat.set(20, 16 / 6); this.sandTex = tex;
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(80, 16), new THREE.MeshLambertMaterial({ map: tex }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 5); sand.receiveShadow = true; s.add(sand);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 3), new THREE.MeshLambertMaterial({ color: '#c9b27a' }));
    back.rotation.x = -Math.PI / 2; back.position.set(0, -0.12, -4.4); s.add(back);
    // 배경 야자수 (느린 시차 스크롤)
    this.deco = [];
    const pr = rng(12);
    for (let i = 0; i < 12; i++) {
      const tg = new THREE.Group();
      const hgt = 2.5 + pr() * 1.5;
      for (let k = 0; k < 6; k++) box(0.3, hgt / 6 + 0.02, 0.3, k % 2 ? '#a0703a' : '#8a5a35', Math.sin(k * 0.4) * 0.15, (k + 0.5) * hgt / 6, 0, tg);
      for (let a = 0; a < 5; a++) { const leaf = box(1.6, 0.1, 0.4, '#4f9a35', 0, hgt, 0, tg); leaf.rotation.y = (a / 5) * Math.PI * 2; leaf.position.x = Math.cos(leaf.rotation.y) * 0.7; leaf.position.z = -Math.sin(leaf.rotation.y) * 0.7; leaf.rotation.z = -0.3; }
      tg.position.set(-30 + i * 5.5, 0, -4 - pr() * 3);
      s.add(tg); this.deco.push({ m: tg, k: 0.5 });
    }
    for (let i = 0; i < 6; i++) { const t = makeTree(pr, 'round'); t.position.set(-30 + i * 11, 0, -11); t.scale.setScalar(2); s.add(t); this.deco.push({ m: t, k: 0.25 }); }
    this.items = [];
    this.camera.position.set(1.5, 2.4, 10.5);
    this.camera.lookAt(1.5, 1.9, 0);
  }

  onAvatar() { this.player.position.set(PX, 0, 0); this.player.rotation.y = Math.PI / 2; }

  reset() {
    for (const it of this.items) this.scene.remove(it.m);
    this.items = [];
    this.vy = 0; this.jumps = 0; this.dist = 0; this.coinCount = 0; this.speed = 7; this.spawnX = 6; this.elapsed = 0;
    this.player.position.set(PX, 0, 0);
  }

  jump() {
    if (this.state !== 'play') return;
    if (this.jumps >= 2) return;
    this.vy = this.jumps === 0 ? 10.5 : 9;
    this.jumps++;
    sfx.jump();
  }
  keyDown(code) { if (['Space', 'KeyW', 'ArrowUp'].includes(code)) this.jump(); }
  pointerDown() { this.jump(); }

  // 다음 장애물 묶음 만들기
  pattern(x) {
    const prog = this.elapsed / this.duration;
    const roll = Math.random();
    const add = (kind, dx, y = 0) => { const m = makeObstacle(kind); m.position.set(x + dx, y || m.userData.box.y0, 0); this.scene.add(m); this.items.push({ kind, m }); };
    if (roll < 0.3) { add('log', 0); add('coin', 0, 2.2); }
    else if (roll < 0.5) { add('crab', 0); }
    else if (roll < 0.62 + prog * 0.1) { add('rocks', 0); add('coin', 0, 3.4); }
    else if (roll < 0.8) { add('gull', 0); for (let i = 0; i < 3; i++) add('coin', -1.2 + i * 1.2, 0.8); }
    else { add('log', 0); add('log', 3.2 + (1 - prog) * 1.5); }
    if (Math.random() < 0.4) for (let i = 0; i < 4; i++) add('coin', 4 + i * 0.9, 1 + Math.sin((i / 3) * Math.PI) * 1.4);
    return 9 + Math.random() * 6 - prog * 3;
  }

  idle(dt, t) {
    this.avatar.animate(dt, t, { moving: this.state === 'countdown', run: false, yaw: Math.PI / 2 });
    this.scroll(dt * (this.state === 'countdown' ? 2 : 0), t);
  }

  scroll(dx, t) {
    this.sandTex.offset.x = (this.sandTex.offset.x + dx / 4) % 1;
    this.waterTex.offset.x = (this.waterTex.offset.x + dx * 0.004 + 0.0005) % 1;
    for (const d of this.deco) { d.m.position.x -= dx * d.k; if (d.m.position.x < -34) d.m.position.x += 66; }
  }

  step(dt, t) {
    this.elapsed += dt;
    this.speed = 7 + (this.elapsed / this.duration) * 7;
    const dx = this.speed * dt;
    this.dist += dx;
    this.score = Math.floor(this.dist) + this.coinCount * 5;
    this.scroll(dx, t);
    // 점프 물리
    const p = this.player.position;
    this.vy -= GRAV * dt;
    p.y += this.vy * dt;
    if (p.y <= 0) { if (this.jumps) sfx.step(); p.y = 0; this.vy = 0; this.jumps = 0; }
    const air = p.y > 0.02;
    this.avatar.animate(dt, t, { moving: !air, run: true, air, yaw: Math.PI / 2 });
    // 장애물 생성/이동
    this.spawnX -= dx;
    if (this.spawnX <= 0) this.spawnX = this.pattern(22);
    const pb = { x0: p.x - 0.32, x1: p.x + 0.32, y0: p.y, y1: p.y + this.avatar.height * 0.92 };
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.m, bx = m.userData.box;
      m.position.x -= dx * (it.kind === 'crab' ? 1.15 : 1);
      if (it.kind === 'coin') m.rotation.y += dt * 5;
      if (it.kind === 'gull') { const f = Math.sin(t * 16) * 0.6; m.userData.wings[0].rotation.x = f; m.userData.wings[1].rotation.x = -f; m.position.x -= dx * 0.25; }
      if (it.kind === 'crab') m.position.z = Math.sin(t * 6 + i) * 0.2;
      const by0 = it.kind === 'coin' ? m.position.y - bx.h / 2 : m.position.y;
      const hit = pb.x1 > m.position.x - bx.w / 2 && pb.x0 < m.position.x + bx.w / 2 && pb.y1 > by0 && pb.y0 < by0 + bx.h;
      if (hit && !it.done) {
        if (it.kind === 'coin') { it.done = true; this.coinCount++; sfx.coin(); this.float(m.position, '+5', 'gold'); this.scene.remove(m); this.items.splice(i, 1); continue; }
        if (this.hurt(m.position.clone().add(new THREE.Vector3(0, 1.2, 0)), it.kind === 'gull' ? '꽥!' : '쿵!')) it.done = true;
      }
      if (m.position.x < -16) { this.scene.remove(m); this.items.splice(i, 1); }
    }
  }

  extraText() { return `${Math.floor(this.dist || 0)}m · 코인 ${this.coinCount || 0}`; }
  resultRows() { return [['달린 거리', `${Math.floor(this.dist)}m`], ['주운 코인', `${this.coinCount}개 (×5)`]]; }
}
