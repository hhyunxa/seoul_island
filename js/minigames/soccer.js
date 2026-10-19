import * as THREE from 'three';
import { rbox, toonMat } from '../toon.js';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { signTexture, rng } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

// 경기장: x = 골대 방향(우리 팀은 +x 쪽 골대를 공격), z = 옆줄
const FX = 11, FZ = 7, MOUTH = 1.7, NET = 1.2;
const BLUE = '#3f7fe0', RED = '#e04a3a';
const CONTROL_V = 9.5;   // 이보다 느린 공만 잡을 수 있음
const FRICTION = 1.1;

// 3:3 축구 — 나 + AI 팀원 2명(수비·골키퍼) vs AI 3명
export class SoccerGame extends MiniGame {
  static meta = {
    id: 'soccer', title: '3:3 축구', duration: 90, resultTitle: '경기 종료!', fov: 42, sky: '#8fcdf0',
    hint: 'WASD 이동 · Shift 달리기 · Space 슛 · E 패스 — 공에 가까이 가면 드리블해요. 오른쪽 골대에 넣으세요!',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-6, 20, 10], size: 16 });
    // 잔디 (줄무늬)
    for (let i = 0; i < 12; i++) {
      const m = box(2.2, 0.04, 2 * FZ + 2, i % 2 ? '#5fae3e' : '#6cbb48', -FX - 2.2 + 1.1 + i * 2.2, -0.02, 0, s);
      m.castShadow = false;
    }
    const W = '#ffffff';
    const line = (w, d, x, z) => { const m = box(w, 0.03, d, W, x, 0.02, z, s); m.castShadow = false; };
    line(2 * FX, 0.08, 0, -FZ); line(2 * FX, 0.08, 0, FZ); line(0.08, 2 * FZ, -FX, 0); line(0.08, 2 * FZ, FX, 0);
    line(0.08, 2 * FZ, 0, 0);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; line(0.18, 0.18, Math.cos(a) * 1.8, Math.sin(a) * 1.8); }
    for (const sx of [-1, 1]) {
      line(0.08, 6, sx * (FX - 3), 0); line(3, 0.08, sx * (FX - 1.5), -3); line(3, 0.08, sx * (FX - 1.5), 3);
      // 골대
      const g = new THREE.Group(); g.position.x = sx * FX;
      box(0.14, 1.3, 0.14, W, 0, 0.65, -MOUTH, g); box(0.14, 1.3, 0.14, W, 0, 0.65, MOUTH, g);
      box(0.14, 0.14, 2 * MOUTH + 0.14, W, 0, 1.3, 0, g);
      const net = toonMat({ color: '#e8eef2', transparent: true, opacity: 0.45 });
      box(0.05, 1.3, 2 * MOUTH, net, sx * NET, 0.65, 0, g);
      box(NET, 0.05, 2 * MOUTH, net, sx * NET / 2, 1.3, 0, g);
      box(NET, 1.3, 0.05, net, sx * NET / 2, 0.65, -MOUTH, g); box(NET, 1.3, 0.05, net, sx * NET / 2, 0.65, MOUTH, g);
      s.add(g);
    }
    // 관중석
    const r = rng(17), crowd = ['#e8413a', '#3f7fe0', '#ffd23f', '#ffffff', '#9b5de5', '#f28c28'];
    for (let row = 0; row < 3; row++) {
      const z = -FZ - 2.2 - row * 1.0, y = 0.3 + row * 0.55;
      box(2 * FX + 6, 0.5 + row * 0.55, 1.0, '#c9c4b8', 0, y / 2 + 0.05, z, s);
      for (let x = -FX - 2.5; x <= FX + 2.5; x += 0.55) if (r() < 0.8) box(0.32, 0.4, 0.3, crowd[(r() * crowd.length) | 0], x, y + 0.5 + row * 0.27, z, s);
    }
    const board = new THREE.Mesh(rbox(6, 0.9, 0.1), toonMat({ map: signTexture('서울월드컵경기장', { w: 160, h: 24, size: 14, bg: '#ffd23f' }) }));
    board.position.set(0, 0.5, -FZ - 1.2); s.add(board);
    this.ads = [];
    for (const sx of [-1, 1]) { const ad = box(0.1, 0.6, 2 * FZ, '#2f5fae', sx * (FX + 2.2), 0.3, 0, s); this.ads.push(ad); }

    // 공
    this.ball = new THREE.Group();
    const bm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), toonMat({ color: '#ffffff', flatShading: true }));
    bm.castShadow = true; this.ball.add(bm); this.ballMesh = bm;
    for (const [x, y, z] of [[0.17, 0.05, 0], [-0.12, 0.12, 0.1], [0, -0.15, -0.12], [0.02, 0.1, -0.17]]) box(0.1, 0.1, 0.1, '#222222', x, y, z, bm);
    s.add(this.ball);
    this.bpos = new THREE.Vector3(); this.bvel = new THREE.Vector3(); this.by = 0; this.bvy = 0;

    // 내 발밑 표시
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 12), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
    this.ring.rotation.x = -Math.PI / 2; s.add(this.ring);

    // AI 선수 (팀원 2 + 상대 3)
    const mk = (team, role, i) => {
      const shirt = team === 'B' ? BLUE : RED;
      const gk = role === 'gk';
      const sk = npcSkin({ shirt: gk ? (team === 'B' ? '#3fbf6a' : '#f2c428') : shirt, pants: gk ? '#222' : '#f4f4f4', hair: HAIRS[(i * 3 + (team === 'B' ? 0 : 2)) % HAIRS.length], skin: TONES[i % TONES.length], shoe: '#222222', number: '#ffffff' });
      const av = new Avatar(sk, { height: 1.5 });
      s.add(av.root);
      return { av, root: av.root, team, role, vel: new THREE.Vector3(), yaw: 0, cd: 0, think: 0, plan: null };
    };
    this.ai = [mk('B', 'df', 0), mk('B', 'gk', 1), mk('R', 'fw', 2), mk('R', 'df', 3), mk('R', 'gk', 4)];

    this.camera.position.set(0, 17, 13.5);
    this.camera.lookAt(0, 0, 0.6);
  }

  onAvatar() {
    this.me = { av: this.avatar, root: this.player, team: 'B', role: 'fw', vel: new THREE.Vector3(), yaw: 0, cd: 0, user: true };
    this.all = [this.me, ...this.ai];
    this.player.position.set(-1.2, 0, 0);
  }

  // 시작 위치 (킥오프: kick 팀의 공격수가 공 앞에)
  kickoff(kick) {
    const home = {
      B: { fw: [-1.6, 0], df: [-6, 2.2], gk: [-FX + 0.8, 0] },
      R: { fw: [1.6, 0], df: [6, -2.2], gk: [FX - 0.8, 0] },
    };
    for (const p of this.all) {
      const [x, z] = home[p.team][p.role];
      p.root.position.set(x, 0, z); p.vel.set(0, 0, 0); p.cd = 0; p.home = [x, z];
      p.yaw = p.team === 'B' ? Math.PI / 2 : -Math.PI / 2; p.root.rotation.y = p.yaw;
    }
    const fw = this.all.find((p) => p.team === kick && p.role === 'fw');
    fw.root.position.set(kick === 'B' ? -0.5 : 0.5, 0, 0);
    this.bpos.set(0, 0, 0); this.bvel.set(0, 0, 0); this.by = 0; this.bvy = 0;
    this.owner = null; this.pause = 0.6;
  }

  reset() {
    this.goals = { B: 0, R: 0 }; this.myGoals = 0; this.lastTouch = null; this.result = null; this.celebrate = 0;
    this.kickoff('B');
    this.syncBall();
  }

  // ---------- 공 ----------
  syncBall() {
    this.ball.position.set(this.bpos.x, 0.22 + this.by, this.bpos.z);
  }
  kick(p, dir, power, lift = 0) {
    dir.setY(0).normalize();
    this.bvel.copy(dir).multiplyScalar(power);
    this.bvy = lift;
    this.owner = null; p.cd = 0.4;
    this.bpos.addScaledVector(dir, 0.15);
    sfx.catch(Math.min(12, power / 1.4));
  }
  goalTarget(team) { return new THREE.Vector3(team === 'B' ? FX : -FX, 0, 0); }
  shoot(p, accuracy = 1) {
    const g = this.goalTarget(p.team);
    g.z = (Math.random() * 2 - 1) * MOUTH * 0.75 + (1 - accuracy) * (Math.random() * 2 - 1) * 2.4;
    const d = g.sub(p.root.position);
    this.kick(p, d, 13 + Math.random() * 2.5, 2.2 + Math.random() * 1.5);
  }
  passTo(p, q) {
    // 받는 사람이 달려갈 곳을 살짝 앞에 두고 찬다
    const lead = q.vel.clone().multiplyScalar(0.35);
    const to = q.root.position.clone().add(lead).sub(p.root.position);
    const dist = to.length();
    this.kick(p, to, THREE.MathUtils.clamp(dist * 1.25 + 2.5, 5.5, CONTROL_V - 0.3));
  }

  stepBall(dt) {
    if (this.owner) {
      const o = this.owner.root;
      const f = new THREE.Vector3(Math.sin(o.rotation.y), 0, Math.cos(o.rotation.y));
      const want = o.position.clone().addScaledVector(f, 0.5);
      this.bvel.copy(want.clone().sub(this.bpos).multiplyScalar(14)).setY(0);
      // 자기 골문 쪽으로는 드리블해서 들어가지 않게
      const atk = this.owner.team === 'B' ? 1 : -1;
      if (Math.sign(want.x) !== atk) want.x = THREE.MathUtils.clamp(want.x, -FX + 0.25, FX - 0.25);
      this.bpos.lerp(want, Math.min(1, dt * 16));
      this.by = 0;
    } else {
      this.bpos.addScaledVector(this.bvel, dt);
      this.bvel.multiplyScalar(Math.exp(-FRICTION * dt * (this.by > 0.01 ? 0.3 : 1)));
      // 뜬 공
      if (this.by > 0 || this.bvy > 0) {
        this.bvy -= 22 * dt; this.by += this.bvy * dt;
        if (this.by <= 0) { this.by = 0; this.bvy = Math.abs(this.bvy) > 2 ? -this.bvy * 0.35 : 0; }
      }
    }
    const b = this.bpos;
    // 골 판정 (크로스바 아래로 골문 통과)
    if (Math.abs(b.x) > FX && Math.abs(b.z) < MOUTH - 0.1 && this.by < 1.15) {
      if (!this.goalT) this.scoreGoal(b.x > 0 ? 'B' : 'R');
      b.x = Math.sign(b.x) * Math.min(Math.abs(b.x), FX + NET - 0.25);
      b.z = THREE.MathUtils.clamp(b.z, -MOUTH + 0.2, MOUTH - 0.2);
      this.bvel.multiplyScalar(0.5);
    } else {
      // 옆줄/골라인 벽에 튕김 (광고판)
      if (Math.abs(b.z) > FZ - 0.2) { b.z = Math.sign(b.z) * (FZ - 0.2); this.bvel.z *= -0.6; }
      if (Math.abs(b.x) > FX - 0.2 && !(Math.abs(b.z) < MOUTH - 0.1 && this.by < 1.15)) {
        if (Math.abs(b.x) < FX + 0.3) { b.x = Math.sign(b.x) * (FX - 0.2); this.bvel.x *= -0.6; if (this.owner) this.owner = null; }
      }
    }
    if (!this.owner) {
      const sp = this.bvel.length();
      this.ballMesh.rotation.z -= this.bvel.x * dt * 4; this.ballMesh.rotation.x += this.bvel.z * dt * 4;
      if (sp < 0.05) this.bvel.set(0, 0, 0);
    } else {
      this.ballMesh.rotation.z -= this.bvel.x * dt * 3; this.ballMesh.rotation.x += this.bvel.z * dt * 3;
    }
    this.syncBall();
  }

  scoreGoal(team) {
    this.goals[team]++;
    this.goalT = 2.2; this.goalTeam = team; this.owner = null;
    if (team === 'B') {
      this.score += 30;
      const mine = this.lastTouch === this.me;
      if (mine) { this.myGoals++; this.score += 10; }
      sfx.gold();
      this.float(new THREE.Vector3(FX - 2, 2.5, 0), mine ? '골!!! +40' : '골! +30', 'gold');
    } else {
      sfx.hurt();
      this.float(new THREE.Vector3(-FX + 2, 2.5, 0), '실점...', 'bad');
      const v = document.getElementById('view'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake');
    }
  }

  // 공 잡기 / 뺏기
  contest(dt) {
    if (this.by > 0.6) return;
    const b = this.bpos;
    for (const p of this.all) {
      if (p.cd > 0 || p === this.owner) continue;
      const d = Math.hypot(p.root.position.x - b.x, p.root.position.z - b.z);
      const reach = p.role === 'gk' ? 0.85 : 0.6;
      if (d > reach) continue;
      if (this.owner) {
        if (this.owner.team === p.team) continue;
        // 상대가 붙으면 확률로 뺏김 (내가 가진 공은 조금 덜 뺏김)
        const rate = this.owner.user ? 1.8 : 2.6;
        if (Math.random() < rate * dt) {
          this.owner.cd = 0.7; this.owner = p; this.lastTouch = p; sfx.click();
          if (p.user) this.float(p.root.position.clone().add(new THREE.Vector3(0, 2, 0)), '뺏었다!', 'gold');
        }
        continue;
      }
      const sp = this.bvel.length();
      if (sp < CONTROL_V) { this.owner = p; this.lastTouch = p; p.think = 0.15 + Math.random() * 0.25; return; }
      if (p.role === 'gk' && Math.random() < 0.6) {
        // 골키퍼 선방
        this.bvel.x *= -0.4; this.bvel.z += (Math.random() - 0.5) * 6; this.bvy = 3; p.cd = 0.3; this.lastTouch = p;
        sfx.click();
        this.float(p.root.position.clone().add(new THREE.Vector3(0, 2, 0)), p.team === 'B' ? '선방!' : '막혔다!', p.team === 'B' ? 'gold' : 'bad');
        return;
      }
      p.cd = 0.25;
    }
  }

  // ---------- 선수 이동 ----------
  moveP(p, dir, speed, dt) {
    const k = 1 - Math.exp(-dt * 10);
    p.vel.lerp(dir.clone().setY(0).multiplyScalar(speed), k);
    const pos = p.root.position;
    pos.addScaledVector(p.vel, dt);
    const lim = p.role === 'gk' ? FX - 0.3 : FX - 0.3;
    pos.x = THREE.MathUtils.clamp(pos.x, -lim, lim); pos.z = THREE.MathUtils.clamp(pos.z, -FZ + 0.3, FZ - 0.3);
    const v = p.vel.length();
    if (v > 0.3) p.yaw = Math.atan2(p.vel.x, p.vel.z);
    return v;
  }
  separate() {
    for (let i = 0; i < this.all.length; i++) for (let j = i + 1; j < this.all.length; j++) {
      const a = this.all[i].root.position, b = this.all[j].root.position;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 0.6) { const push = (0.6 - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
    }
  }

  userStep(dt, keys) {
    const mv = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) mv.z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mv.z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mv.x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mv.x += 1;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (mv.lengthSq()) mv.normalize();
    const v = this.moveP(this.me, mv, (run ? 6.4 : 4.6) * (this.owner === this.me ? 0.9 : 1), dt);
    this.me.av.animate(dt, this.t, { moving: v > 0.4, run: run && v > 0.4, yaw: this.me.yaw });
  }

  keyDown(code) {
    if (this.state !== 'play' || this.goalT || this.pause > 0) return;
    const me = this.me;
    if (code === 'Space') {
      const near = Math.hypot(me.root.position.x - this.bpos.x, me.root.position.z - this.bpos.z) < 1.0 && this.by < 0.6;
      if (this.owner === me || (near && !this.owner)) {
        // 바라보는 방향으로 슛 (골대 쪽이면 골문 안쪽으로 살짝 보정)
        const f = new THREE.Vector3(Math.sin(me.root.rotation.y), 0, Math.cos(me.root.rotation.y));
        const g = this.goalTarget('B'); g.z = THREE.MathUtils.clamp(me.root.position.z * 0.3, -1, 1);
        const toGoal = g.sub(me.root.position).normalize();
        if (f.dot(toGoal) > 0.75) f.lerp(toGoal, 0.6);
        this.lastTouch = me;
        this.kick(me, f, 14.5, 2.4);
      }
    } else if (code === 'KeyE' || code === 'KeyK') {
      if (this.owner !== me) return;
      const f = new THREE.Vector3(Math.sin(me.root.rotation.y), 0, Math.cos(me.root.rotation.y));
      const mates = this.all.filter((p) => p.team === 'B' && p !== me);
      // 바라보는 방향에 가까운 팀원 우선
      mates.sort((a, b) => this.passScore(me, b, f) - this.passScore(me, a, f));
      this.lastTouch = me;
      this.passTo(me, mates[0]);
    }
  }
  passScore(from, to, f) {
    const d = to.root.position.clone().sub(from.root.position);
    const len = d.length();
    return d.normalize().dot(f) * 2 - len * 0.08 - (to.role === 'gk' ? 1.5 : 0);
  }

  aiStep(p, dt) {
    const pos = p.root.position, b = this.bpos;
    const atk = p.team === 'B' ? 1 : -1;            // 공격 방향
    const ownGoalX = -atk * FX;
    const mates = this.all.filter((q) => q.team === p.team);
    const opps = this.all.filter((q) => q.team !== p.team);
    const has = this.owner && this.owner.team === p.team;
    const dir = new THREE.Vector3();
    let speed = 4.0;

    if (this.owner === p) {
      // 공을 가졌을 때: 드리블 → 슛/패스 판단
      const goal = new THREE.Vector3(atk * FX, 0, 0);
      const toGoal = goal.clone().sub(pos);
      const dGoal = toGoal.length();
      dir.copy(toGoal).normalize();
      const near = opps.reduce((m, q) => Math.min(m, q.root.position.distanceTo(pos)), 99);
      const blocker = opps.find((q) => { const r = q.root.position.clone().sub(pos); return r.length() < 1.8 && r.normalize().dot(dir) > 0.6; });
      if (blocker) dir.z += (pos.z > blocker.root.position.z ? 1 : -1) * 1.2;
      dir.normalize();
      speed = 4.2;
      p.think -= dt;
      if (p.think <= 0) {
        p.think = 0.25;
        if (p.role === 'gk') {
          const best = mates.filter((q) => q !== p).sort((a, c) => (c.root.position.x * atk) - (a.root.position.x * atk))[0];
          this.passTo(p, best); return;
        }
        if (dGoal < 6.5 && Math.random() < 0.55) { this.shoot(p, p.team === 'R' ? 0.75 : 0.85); this.lastTouch = p; return; }
        if (near < 1.2 && Math.random() < 0.5) {
          const open = mates.filter((q) => q !== p && q.role !== 'gk').sort((a, c) => this.openness(c, opps) - this.openness(a, opps))[0];
          if (open) { this.passTo(p, open); this.lastTouch = p; return; }
        }
        // 팀원(나)이 더 앞에 있고 비어 있으면 패스
        if (p.team === 'B' && Math.random() < 0.35) {
          const me = this.me;
          if (me.root.position.x > pos.x + 1.5 && this.openness(me, opps) > 1.8) { this.passTo(p, me); this.lastTouch = p; return; }
        }
      }
    } else if (p.role === 'gk') {
      // 골키퍼: 골문 앞에서 공의 z를 따라감, 가까우면 달려나감
      const gx = ownGoalX + atk * 0.8;
      const bd = Math.hypot(b.x - ownGoalX, b.z);
      if (!has && bd < 3.2 && Math.sign(b.x) === Math.sign(ownGoalX)) { dir.set(b.x - pos.x, 0, b.z - pos.z); speed = 5.0; }
      else { dir.set(gx - pos.x, 0, THREE.MathUtils.clamp(b.z * 0.55, -MOUTH + 0.3, MOUTH - 0.3) - pos.z); speed = 4.2; if (dir.length() < 0.15) dir.set(0, 0, 0); }
      if (dir.lengthSq() > 1) dir.normalize();
    } else {
      // 필드: 팀에서 공에 가장 가까운 필드 선수가 공을 쫓음
      const field = mates.filter((q) => q.role !== 'gk');
      const dist = (q) => Math.hypot(q.root.position.x - b.x, q.root.position.z - b.z);
      const chaser = field.reduce((a, c) => (dist(c) < dist(a) ? c : a));
      if (!has && chaser === p) {
        // 공 뒤쪽(자기 골대 쪽)에서 접근
        const tgt = b.clone().add(new THREE.Vector3(-atk * 0.35, 0, 0)).add(this.bvel.clone().multiplyScalar(0.25));
        dir.set(tgt.x - pos.x, 0, tgt.z - pos.z);
        speed = p.team === 'R' ? 5.4 : 5.6;
      } else if (has) {
        // 공격 지원: 공보다 앞, 반대편 옆으로 벌림
        const tx = THREE.MathUtils.clamp(b.x + atk * 3.5, -FX + 2, FX - 2);
        const tz = THREE.MathUtils.clamp(-b.z * 0.6 + (p.role === 'df' ? -atk * 2 : atk * 2), -FZ + 1, FZ - 1);
        dir.set(tx - pos.x, 0, tz - pos.z); speed = 4.4;
      } else {
        // 수비: 공과 자기 골대 사이
        const tx = THREE.MathUtils.lerp(ownGoalX, b.x, 0.55), tz = b.z * 0.6;
        dir.set(tx - pos.x, 0, tz - pos.z); speed = 4.6;
      }
      if (dir.length() < 0.2) dir.set(0, 0, 0); else dir.normalize();
    }
    const v = this.moveP(p, dir, speed, dt);
    p.av.animate(dt, this.t, { moving: v > 0.4, run: v > 4.8, yaw: p.yaw });
  }
  openness(q, opps) { return opps.reduce((m, o) => Math.min(m, o.root.position.distanceTo(q.root.position)), 99); }

  idle(dt, t) {
    this.t = t;
    for (const p of this.all) p.av.animate(dt, t, { yaw: p.yaw, wave: this.state === 'done' && p.team === (this.result === 'L' ? 'R' : 'B') });
    this.ring.position.set(this.player.position.x, 0.03, this.player.position.z);
    this.syncBall();
  }

  step(dt, t) {
    this.t = t;
    for (const p of this.all) p.cd = Math.max(0, p.cd - dt);
    if (this.goalT) {
      // 골 세리머니 → 킥오프
      this.goalT -= dt;
      for (const p of this.all) p.av.animate(dt, t, { yaw: p.yaw, armsUp: p.team === this.goalTeam, wave: false });
      this.stepBall(dt);
      if (this.goalT <= 0) { this.goalT = 0; this.kickoff(this.goalTeam === 'B' ? 'R' : 'B'); }
    } else if (this.pause > 0) {
      this.pause -= dt;
      for (const p of this.all) p.av.animate(dt, t, { yaw: p.yaw });
    } else {
      this.userStep(dt, this.keysRef);
      for (const p of this.ai) this.aiStep(p, dt);
      this.separate();
      this.stepBall(dt);
      this.contest(dt);
    }
    this.ring.position.set(this.player.position.x, 0.03, this.player.position.z);
    // 카메라는 공을 살짝 따라감
    this.camera.position.x += (this.bpos.x * 0.35 - this.camera.position.x) * Math.min(1, dt * 2);
    this.camera.lookAt(this.camera.position.x, 0, 0.6);
    if (this.time <= 0) this.endMatch();
  }
  update(dt, t, keys) { this.keysRef = keys; super.update(dt, t, keys); }

  endMatch() {
    if (this.result) return;
    const { B, R } = this.goals;
    this.result = B > R ? 'W' : B === R ? 'D' : 'L';
    this.bonus = this.result === 'W' ? 50 : this.result === 'D' ? 20 : 0;
    this.score += this.bonus;
    this.meta = { ...this.meta, resultTitle: this.result === 'W' ? '승리!' : this.result === 'D' ? '무승부!' : '아쉬운 패배...' };
  }
  finish() { this.endMatch(); super.finish(); }

  extraText() { return `블루 ${this.goals.B} : ${this.goals.R} 레드`; }
  resultRows() {
    const rows = [['최종 스코어', `블루 ${this.goals.B} : ${this.goals.R} 레드`], ['내가 넣은 골', `${this.myGoals}골`]];
    if (this.bonus) rows.push([this.result === 'W' ? '승리 보너스' : '무승부 보너스', `+${this.bonus}`]);
    return rows;
  }
  start() { this.meta = this.constructor.meta; this.goalT = 0; super.start(); }
}
