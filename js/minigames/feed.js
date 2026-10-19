import * as THREE from 'three';
import { rbox, toonMat } from '../toon.js';
import { box, makeTree } from '../world.js';
import { rng, signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame, addFence } from './base.js';

const $ = (id) => document.getElementById(id);
// 먹이 4가지 (숫자키 1~4)
const FOODS = [
  { id: 'banana', name: '바나나', icon: '🍌', color: '#ffd23f' },
  { id: 'fish', name: '생선', icon: '🐟', color: '#7fb0d8' },
  { id: 'leaf', name: '나뭇잎', icon: '🌿', color: '#5fae3e' },
  { id: 'meat', name: '고기', icon: '🍖', color: '#c0503a' },
];
// 동물마다 좋아하는 먹이
const ANIMALS = [
  { id: 'elephant', name: '코끼리', food: 'banana', speed: 1.5 },
  { id: 'penguin', name: '펭귄', food: 'fish', speed: 2.1 },
  { id: 'giraffe', name: '기린', food: 'leaf', speed: 1.8 },
  { id: 'lion', name: '사자', food: 'meat', speed: 2.4 },
];
// 받침 있으면 '이/은', 없으면 '가/는'
const josa = (w, a, b) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? a : b);
const FEED_X = 0;          // 먹이 주는 자리 (판매대 앞)
const PATH_Z = -3.2;       // 동물이 지나가는 길
const WIN = 1.5;           // 먹이 줄 수 있는 범위 (FEED_X ± WIN)
const HINT_TIME = 20;      // 처음 20초는 말풍선에 먹이가 보임 → 그 뒤엔 기억해서 줘야 함

function makeAnimal(id) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const leg = (x, z, h, c, w = 0.18) => box(w, h, w, c, x, h / 2, z, body);
  let head = 1.4;
  if (id === 'elephant') {
    const c = '#9aa0a8';
    box(1.3, 0.9, 0.8, c, 0, 1.05, 0, body);
    for (const [x, z] of [[-0.45, -0.25], [-0.45, 0.25], [0.45, -0.25], [0.45, 0.25]]) leg(x, z, 0.65, c, 0.26);
    box(0.6, 0.6, 0.6, c, 0.8, 1.35, 0, body);
    box(0.18, 0.7, 0.18, c, 1.15, 0.95, 0, body);                        // 코
    for (const z of [-0.36, 0.36]) box(0.08, 0.5, 0.36, '#b8bec6', 0.7, 1.4, z, body); // 귀
    box(0.06, 0.06, 0.06, '#222', 1.11, 1.5, -0.18, body); box(0.06, 0.06, 0.06, '#222', 1.11, 1.5, 0.18, body);
    head = 1.9;
  } else if (id === 'penguin') {
    box(0.5, 0.75, 0.45, '#2a2a33', 0, 0.45, 0, body);
    box(0.06, 0.55, 0.36, '#f6f3ea', 0.25, 0.42, 0, body);
    box(0.36, 0.32, 0.36, '#2a2a33', 0, 0.98, 0, body);
    box(0.16, 0.08, 0.12, '#f28c28', 0.24, 0.95, 0, body);
    for (const z of [-0.12, 0.12]) box(0.04, 0.05, 0.05, '#fff', 0.19, 1.04, z, body);
    for (const z of [-0.12, 0.12]) box(0.18, 0.05, 0.12, '#f28c28', 0.05, 0.03, z, body);
    head = 1.3;
  } else if (id === 'giraffe') {
    const c = '#f2b84a', sp = '#a8642a';
    box(0.9, 0.5, 0.45, c, 0, 1.25, 0, body);
    for (const [x, z] of [[-0.32, -0.15], [-0.32, 0.15], [0.32, -0.15], [0.32, 0.15]]) leg(x, z, 1.0, c, 0.12);
    const neck = box(0.18, 1.2, 0.18, c, 0.45, 1.95, 0, body); neck.rotation.z = -0.25;
    box(0.4, 0.22, 0.24, c, 0.7, 2.55, 0, body);
    for (let i = 0; i < 6; i++) box(0.14, 0.14, 0.02, sp, -0.3 + (i % 3) * 0.3, 1.18 + (i >> 1 & 1) * 0.16, 0.235, body);
    for (const z of [-0.06, 0.06]) box(0.04, 0.14, 0.04, sp, 0.6, 2.72, z, body);
    head = 3.0;
  } else if (id === 'lion') {
    const c = '#e0a040';
    box(0.95, 0.5, 0.5, c, 0, 0.7, 0, body);
    for (const [x, z] of [[-0.32, -0.17], [-0.32, 0.17], [0.32, -0.17], [0.32, 0.17]]) leg(x, z, 0.45, c, 0.16);
    box(0.62, 0.62, 0.62, '#9a5a22', 0.55, 1.0, 0, body);                // 갈기
    box(0.36, 0.36, 0.4, c, 0.8, 0.98, 0, body);
    box(0.06, 0.06, 0.06, '#222', 0.99, 1.06, -0.1, body); box(0.06, 0.06, 0.06, '#222', 0.99, 1.06, 0.1, body);
    box(0.4, 0.08, 0.08, c, -0.62, 0.85, 0, body).rotation.z = 0.5;
    head = 1.6;
  } else { // monkey
    const c = '#8a5a35';
    box(0.4, 0.45, 0.32, c, 0, 0.55, 0, body);
    box(0.36, 0.34, 0.34, c, 0, 0.95, 0, body); box(0.22, 0.18, 0.06, '#f2c9a0', 0, 0.92, 0.18, body);
    for (const x of [-0.22, 0.22]) box(0.1, 0.14, 0.06, '#f2c9a0', x, 1.0, 0, body);
    for (const x of [-0.12, 0.12]) leg(x, 0, 0.32, c, 0.12);
    box(0.06, 0.5, 0.06, c, 0, 0.6, -0.25, body).rotation.x = -0.8;
    head = 1.3;
  }
  g.traverse((o) => (o.castShadow = true));
  g.userData = { body, head };
  return g;
}
function makeFood(f) {
  const g = new THREE.Group();
  if (f.id === 'banana') { for (let i = 0; i < 3; i++) { const b = box(0.08, 0.3, 0.08, f.color, (i - 1) * 0.07, 0, 0, g); b.rotation.z = (i - 1) * 0.35; } }
  else if (f.id === 'fish') { box(0.34, 0.14, 0.06, f.color, 0, 0, 0, g); box(0.1, 0.18, 0.04, f.color, -0.2, 0, 0, g); }
  else if (f.id === 'leaf') { box(0.3, 0.04, 0.2, f.color, 0, 0, 0, g); box(0.04, 0.05, 0.3, '#3f8a2a', 0, 0.01, 0, g); }
  else { box(0.24, 0.18, 0.18, f.color, 0, 0, 0, g); box(0.2, 0.06, 0.06, '#f6f3ea', 0.18, 0, 0, g); }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// 어린이대공원 동물 먹이 주기: 앞을 지나가는 동물에게 좋아하는 먹이(1~4)를 던져 주기
export class FeedGame extends MiniGame {
  static meta = {
    id: 'feed', title: '동물 먹이 주기', duration: 60, hearts: 3, resultTitle: '먹이 주기 끝!', fov: 44, sky: '#a8dcf5',
    hint: '1~4 숫자키 · 아래 먹이 버튼 = 판매대 앞(노란 줄)에 온 동물에게 먹이 던지기 · 원숭이는 클릭/Space로 쫓기',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-6, 14, 10], size: 14 });
    this.tileGround(30, 20, (x, y) => (y >= 6 && y <= 8 ? 'path' : 'grass'), 31).position.z = -1;
    // 동물원 울타리 (길 뒤쪽) + 나무
    addFence(s, box, -12, -5.2, 12, -5.2);
    const r = rng(14);
    for (let i = 0; i < 12; i++) { const t = makeTree(r, i % 3 ? 'round' : 'pine'); t.position.set(-13 + i * 2.4 + r(), 0, -7.5 - r() * 2); s.add(t); }
    // 안내판: 동물마다 좋아하는 먹이
    const board = new THREE.Mesh(rbox(5, 1.0, 0.1), toonMat({ map: signTexture('코끼리🍌 펭귄🐟 기린🌿 사자🍖', { w: 200, h: 36, size: 14, bg: '#fff3d0' }) }));
    board.position.set(-6.5, 1.4, -5.6); s.add(board); box(0.12, 1.0, 0.12, '#6b3b1c', -6.5, 0.5, -5.6, s);
    // 먹이 주는 자리 표시 (노란 줄)
    const zone = box(WIN * 2, 0.02, 1.4, '#ffd23f', FEED_X, 0.02, PATH_Z, s); zone.material = toonMat({ color: '#ffd23f', transparent: true, opacity: 0.45 }); zone.castShadow = false;
    // 판매대 (내 앞)
    box(5, 0.9, 0.8, '#c98a46', 0, 0.45, 1.2, s); box(5.2, 0.1, 1.0, '#e8413a', 0, 0.95, 1.2, s);
    this.buckets = FOODS.map((f, i) => {
      const b = new THREE.Group(); b.position.set(-1.8 + i * 1.2, 1.0, 1.2);
      box(0.6, 0.3, 0.5, '#f4ead8', 0, 0.15, 0, b); const fm = makeFood(f); fm.position.y = 0.4; fm.scale.setScalar(1.3); b.add(fm);
      s.add(b); return b;
    });
    this.camera.position.set(0, 4.6, 6.4);
    this.camera.lookAt(0, 0.8, -2.2);
    this.animals = []; this.flying = []; this.monkey = null;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  onAvatar() { this.player.position.set(-3.1, 0, 1.4); this.player.rotation.y = Math.PI; } // 판매대 옆 (먹이를 가리지 않게)

  reset() {
    for (const a of this.animals) this.scene.remove(a.m);
    for (const f of this.flying) this.scene.remove(f.m);
    if (this.monkey) this.scene.remove(this.monkey.m);
    this.animals = []; this.flying = []; this.monkey = null;
    this.spawnT = 0.6; this.monkeyT = 14; this.fed = 0; this.wrong = 0; this.stolen = null;
    this.yaw = Math.PI; this.player.position.set(-3.1, 0, 1.4);
    this.overlay();
  }

  overlay() {
    const o = $('miniOverlay');
    const bar = document.createElement('div');
    bar.className = 'feed-bar';
    bar.innerHTML = FOODS.map((f, i) => `<button class="btn" data-i="${i}"><b>${i + 1}</b> ${f.icon} ${f.name}</button>`).join('');
    bar.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) this.throwFood(+b.dataset.i); };
    o.appendChild(bar);
    this.bar = bar;
  }

  // 판매대 앞 범위 안에서 가장 가운데에 가까운, 아직 안 먹은 동물
  target() {
    let best = null, bd = WIN;
    for (const a of this.animals) if (!a.done && Math.abs(a.m.position.x - FEED_X) < bd) { bd = Math.abs(a.m.position.x - FEED_X); best = a; }
    return best;
  }

  throwFood(i) {
    if (this.state !== 'play') return;
    if (this.stolen && this.stolen.i === i) { this.float(this.buckets[i].position.clone().add(new THREE.Vector3(0, 1, 0)), '원숭이가 가져갔어요!', 'bad'); sfx.miss(); return; }
    const f = FOODS[i];
    const m = makeFood(f);
    const from = this.buckets[i].position.clone().add(new THREE.Vector3(0, 0.5, 0));
    m.position.copy(from); this.scene.add(m);
    const a = this.target();
    const to = a ? a.m.position.clone().add(new THREE.Vector3(0.25, a.m.userData.head * 0.6, 0)) : new THREE.Vector3(FEED_X + (Math.random() - 0.5), 0.2, PATH_Z);
    this.flying.push({ m, from, to, t: 0, tf: 0.45, food: f, animal: a });
    if (a) a.pending = true;
    sfx.jump();
    this.buckets[i].scale.setScalar(1.15); setTimeout(() => this.buckets[i].scale.setScalar(1), 100);
  }

  keyDown(code) {
    const m = /^(Digit|Numpad)([1-4])$/.exec(code);
    if (m) this.throwFood(+m[2] - 1);
    if (code === 'Space') this.shoo();
  }
  pointerDown(e, w, h) {
    if (!this.monkey) return;
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    if (this.ray.intersectObject(this.monkey.m, true).length) this.shoo();
  }
  shoo() {
    if (!this.monkey || this.monkey.run) return;
    this.monkey.run = true; this.score += 5; sfx.catch(4);
    this.float(this.monkey.m.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '훠이! +5', 'gold');
  }

  spawnAnimal() {
    const kind = ANIMALS[(Math.random() * ANIMALS.length) | 0];
    const m = makeAnimal(kind.id);
    m.position.set(-12, 0, PATH_Z);
    this.scene.add(m);
    // 말풍선 (처음엔 먹이 아이콘, 나중엔 "?")
    const bub = document.createElement('div'); bub.className = 'feed-bubble';
    $('miniOverlay').appendChild(bub);
    const speedUp = 1 + (this.duration - this.time) / this.duration * 0.9;
    this.animals.push({ m, kind, bub, done: false, speed: kind.speed * speedUp, phase: Math.random() * 6 });
  }

  idle(dt, t) {
    this.avatar.animate(dt, t, { yaw: this.yaw, wave: this.state === 'done' });
    for (const a of this.animals) this.placeBubble(a);
  }

  placeBubble(a) {
    const v = a.m.position.clone().add(new THREE.Vector3(0, a.m.userData.head + 0.3, 0)).project(this.camera);
    a.bub.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; a.bub.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    const showFood = this.duration - this.time < HINT_TIME;
    const f = FOODS.find((x) => x.id === a.kind.food);
    a.bub.textContent = a.done ? (a.happy ? '💕' : '💢') : showFood ? f.icon : '?';
    a.bub.classList.toggle('hidden', a.m.position.x < -10.5 || a.m.position.x > 10.5);
  }

  step(dt, t) {
    this.avatar.animate(dt, t, { yaw: this.yaw, wave: false });
    // 동물 등장 (갈수록 자주)
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const prog = (this.duration - this.time) / this.duration;
      this.spawnT = 2.6 - prog * 1.4 + Math.random() * 0.6;
      this.spawnAnimal();
    }
    // 동물 이동
    for (const a of this.animals) {
      const p = a.m.position, u = a.m.userData;
      if (a.done && a.happy) { a.hop = (a.hop || 0) + dt; u.body.position.y = Math.abs(Math.sin(a.hop * 10)) * 0.25 * Math.max(0, 1 - a.hop); }
      const slow = Math.abs(p.x - FEED_X) < WIN && !a.done ? 0.55 : 1; // 먹이 자리 앞에선 천천히
      p.x += a.speed * slow * (a.done && !a.happy ? 1.6 : 1) * dt;
      u.body.rotation.z = Math.sin(t * a.speed * 5 + a.phase) * 0.04;
      if (!a.done) u.body.position.y = Math.abs(Math.sin(t * a.speed * 5 + a.phase)) * 0.05;
      // 못 받고 지나가 버림
      if (!a.done && !a.pending && p.x > FEED_X + WIN) {
        a.done = true; a.happy = false; this.combo = 0;
        this.hurt(p.clone().add(new THREE.Vector3(0, u.head, 0)), `${a.kind.name}${josa(a.kind.name, '이', '가')} 배고파요!`);
      }
      this.placeBubble(a);
    }
    for (const a of this.animals.filter((x) => x.m.position.x > 13)) { this.scene.remove(a.m); a.bub.remove(); }
    this.animals = this.animals.filter((x) => x.m.position.x <= 13);
    // 날아가는 먹이
    for (const f of this.flying) {
      f.t += dt;
      const k = Math.min(1, f.t / f.tf);
      if (f.animal && !f.animal.done) f.to.x = f.animal.m.position.x + 0.25;
      f.m.position.lerpVectors(f.from, f.to, k); f.m.position.y += Math.sin(Math.PI * k) * 1.4;
      f.m.rotation.z += dt * 12;
      if (k >= 1 && !f.hit) { f.hit = true; this.landFood(f); }
    }
    for (const f of this.flying.filter((x) => x.hit)) this.scene.remove(f.m);
    this.flying = this.flying.filter((x) => !x.hit);
    // 원숭이: 가끔 나타나 판매대로 달려와 먹이 하나를 훔쳐 감 (클릭/Space로 쫓기)
    this.monkeyT -= dt;
    if (!this.monkey && this.monkeyT <= 0) {
      const m = makeAnimal('monkey'); const side = Math.random() < 0.5 ? -1 : 1;
      m.position.set(side * 9, 0, 0.2); m.rotation.y = side > 0 ? Math.PI : 0; this.scene.add(m);
      this.monkey = { m, side, run: false, i: (Math.random() * 4) | 0 };
      this.monkeyT = 9 + Math.random() * 6;
      this.float(m.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '원숭이다! 클릭!', 'bad');
    }
    if (this.monkey) {
      const mk = this.monkey, p = mk.m.position, goal = this.buckets[mk.i].position.x;
      if (mk.run) { p.x += mk.side * 9 * dt; p.y = Math.abs(Math.sin(t * 20)) * 0.2; if (Math.abs(p.x) > 11) { this.scene.remove(mk.m); this.monkey = null; } }
      else {
        p.x += Math.sign(goal - p.x) * 3.2 * dt; p.y = Math.abs(Math.sin(t * 16)) * 0.15;
        if (Math.abs(goal - p.x) < 0.3) {
          this.stolen = { i: mk.i, t: 4 }; mk.run = true; mk.side *= -1;
          this.buckets[mk.i].visible = false; sfx.hurt();
          this.float(this.buckets[mk.i].position.clone().add(new THREE.Vector3(0, 1, 0)), `${FOODS[mk.i].name} 도둑맞음!`, 'bad');
        }
      }
    }
    if (this.stolen) { this.stolen.t -= dt; if (this.stolen.t <= 0) { this.buckets[this.stolen.i].visible = true; this.stolen = null; } }
    this.bar.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('off', this.stolen?.i === +b.dataset.i));
  }

  landFood(f) {
    const a = f.animal;
    if (!a || a.done) { sfx.miss(); return; }
    a.pending = false;
    const pos = a.m.position.clone().add(new THREE.Vector3(0, a.m.userData.head + 0.4, 0));
    if (f.food.id === a.kind.food) {
      a.done = true; a.happy = true; this.fed++;
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const hint = this.duration - this.time < HINT_TIME;
      const pts = 10 + Math.min(this.combo, 10) * 2 + (hint ? 0 : 5);
      this.score += pts; sfx.catch(this.combo);
      this.float(pos, `${a.kind.name} 냠냠! +${pts}`, 'gold');
    } else {
      this.wrong++; this.combo = 0; sfx.miss();
      this.float(pos, `${a.kind.name}${josa(a.kind.name, '은', '는')} ${f.food.name} 싫어해요`, 'bad');
      // 다시 줄 기회는 있지만 동물이 지나가 버리면 하트 감소
    }
  }

  extraText() { return this.combo > 1 ? `콤보 ${this.combo}` : ''; }
  resultRows() { return [['배부른 동물', `${this.fed}마리`], ['최대 콤보', `${this.maxCombo}`], ['잘못 준 먹이', `${this.wrong}번`]]; }
  quit() { this.cleanup(); super.quit(); }
  finish() { this.cleanup(); super.finish(); }
  cleanup() { for (const a of this.animals) a.bub.remove(); }
}
