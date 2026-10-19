import * as THREE from 'three';
import { rbox, toonMat } from '../toon.js';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

const $ = (id) => document.getElementById(id);
const COLORS = [
  { k: 'red', n: '빨간', c: '#e8413a' }, { k: 'yellow', n: '노란', c: '#ffd23f' }, { k: 'blue', n: '파란', c: '#2f7fd8' },
  { k: 'green', n: '초록', c: '#5fc04a' }, { k: 'black', n: '검은', c: '#2a2a2e' }, { k: 'white', n: '하얀', c: '#f4f1ea' }, { k: 'pink', n: '분홍', c: '#f4a6c0' },
];
const PANTS = ['#3a3f4a', '#4f6fae', '#c9b48a', '#2a2a2e', '#7a5a44'];
const pick = (a) => a[(Math.random() * a.length) | 0];
const LANES = [{ z: -0.5, dir: -1 }, { z: 1.3, dir: 1 }]; // 안쪽 줄은 ←, 바깥 줄은 →
const EDGE = 8.2;   // 이 밖으로 나가면 화면 밖
const H = 1.55;     // 지나가는 사람 키

// ---------- 옷차림 ----------
function randomOutfit() {
  return {
    hat: Math.random() < 0.55 ? { type: Math.random() < 0.5 ? 'cap' : 'beanie', color: pick(COLORS).k } : null,
    glasses: Math.random() < 0.3,
    bag: Math.random() < 0.45 ? pick(COLORS).k : null,
    top: pick(COLORS).k,
    pants: pick(PANTS),
  };
}
const matches = (o, c) => (c.cat === 'hat' ? o.hat?.color === c.color : c.cat === 'glasses' ? o.glasses : c.cat === 'bag' ? o.bag === c.color : o.top === c.color);
const matchesAll = (o, conds) => conds.every((c) => matches(o, c));
function force(o, c) {
  if (c.cat === 'hat') o.hat = { type: o.hat?.type || pick(['cap', 'beanie']), color: c.color };
  else if (c.cat === 'glasses') o.glasses = true;
  else if (c.cat === 'bag') o.bag = c.color;
  else o.top = c.color;
}
const colorOf = (k) => COLORS.find((c) => c.k === k);
const condName = (c) => (c.cat === 'glasses' ? '선글라스' : `${colorOf(c.color).n} ${{ hat: '모자', bag: '가방', top: '옷' }[c.cat]}`);
const condIcon = (c) => ({ hat: '🧢', glasses: '🕶️', bag: '🎒', top: '👕' }[c.cat]);

// 아바타에 소품 달기 (단위 s = 키/22 픽셀)
function dress(av, o) {
  const s = av.s, head = av.joints.head, torso = av.torso;
  if (o.hat) {
    const c = colorOf(o.hat.color).c;
    if (o.hat.type === 'cap') { box(10.6 * s, 2.6 * s, 10.6 * s, c, 0, 9.4 * s, 0, head); box(10 * s, 0.8 * s, 4.5 * s, c, 0, 8.4 * s, 6.8 * s, head); }
    else { box(10.8 * s, 4.2 * s, 10.8 * s, c, 0, 9.0 * s, 0, head); box(10.9 * s, 1.2 * s, 10.9 * s, '#ffffff', 0, 7.2 * s, 0, head); box(2.6 * s, 2.6 * s, 2.6 * s, c, 0, 12 * s, 0, head); }
  }
  if (o.glasses) {
    box(9.4 * s, 2 * s, 0.8 * s, '#1a1a1a', 0, 5.4 * s, 5.3 * s, head);
    for (const x of [-5.2, 5.2]) box(0.6 * s, 0.7 * s, 5 * s, '#1a1a1a', x * s, 5.9 * s, 3 * s, head); // 다리 (옆에서도 보이게)
  }
  if (o.bag) {
    const c = colorOf(o.bag).c;
    box(6.4 * s, 6.4 * s, 3 * s, c, 0, 8.6 * s, -4.1 * s, torso);
    box(4.4 * s, 2.2 * s, 0.8 * s, shade(c), 0, 7.2 * s, -5.7 * s, torso); // 앞주머니
    for (const x of [-2.4, 2.4]) box(1 * s, 6.4 * s, 0.6 * s, shade(c), x * s, 8.8 * s, 2.7 * s, torso); // 멜빵 (앞에서도 보이게)
  }
}
function shade(hex) { const c = new THREE.Color(hex); c.multiplyScalar(0.72); return `#${c.getHexString()}`; }

// 성수동 거리 패션: 제시된 아이템을 입은 사람을 골라 찰칵!
export class FashionGame extends MiniGame {
  static meta = {
    id: 'fashion', title: '성수동 스트리트 스냅', duration: 60, hearts: 3, resultTitle: '오늘의 스냅 끝!', fov: 42, sky: '#bfe3f7',
    hint: '위에 나온 옷차림을 한 사람을 클릭해서 찰칵! 엉뚱한 사람을 찍거나 놓치면 하트가 줄어요',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-5, 14, 10], size: 14 });
    this.tileGround(30, 14, (x, y) => (y >= 5 && y <= 8 ? 'road' : 'plaza'), 77).position.z = 0;
    // 빨간 벽돌 공장을 고친 카페·팝업 가게들 (성수동 느낌)
    const shops = [['#a8452f', '카페'], ['#3a3f4a', 'POP-UP'], ['#b5563a', '편집숍'], ['#f2efe6', '갤러리'], ['#9a3f2b', '베이커리'], ['#2f6f5a', 'POP-UP']];
    shops.forEach(([c, name], i) => {
      const x = -12.5 + i * 5, h = 3 + (i % 3) * 0.7;
      box(4.6, h, 2.6, c, x, h / 2, -4.6, s);
      if (c.startsWith('#a') || c.startsWith('#b') || c.startsWith('#9')) for (let y = 0.4; y < h; y += 0.4) box(4.62, 0.05, 2.62, '#7a2f22', x, y, -4.6, s); // 벽돌 줄눈
      box(3.4, 1.4, 0.06, '#bfe6fa', x, 1.1, -3.28, s);
      const sg = new THREE.Mesh(rbox(2.6, 0.5, 0.08), toonMat({ map: signTexture(name, { w: 96, h: 18, size: 12, bg: '#fff8e6' }) }));
      sg.position.set(x, h - 0.5, -3.25); s.add(sg);
    });
    // 줄 전구
    for (let i = 0; i < 34; i++) { const b = box(0.12, 0.12, 0.12, new THREE.MeshBasicMaterial({ color: ['#ffe14f', '#ffb0c8', '#ffffff'][i % 3] }), -16 + i, 3.2 - Math.abs(Math.sin(i * 0.5)) * 0.35, -3.0, s); b.castShadow = false; }
    this.people = [];
    this.camera.position.set(0, 3.3, 11.2);
    this.camera.lookAt(0, 1.1, 0);
  }

  onAvatar() {
    // 나 = 사진사 (뒷모습), 손에 카메라
    this.player.position.set(-3.0, 0, 6.2); this.player.rotation.y = Math.PI;
    box(0.5, 0.34, 0.26, '#2a2a2e', 0, 1.05, 0.42, this.avatar.torso); box(0.18, 0.18, 0.2, '#555', 0, 1.05, 0.6, this.avatar.torso);
  }

  reset() {
    for (const p of this.people) this.removePerson(p);
    this.people = [];
    this.spawnT = 0.3; this.snaps = 0; this.wrongs = 0; this.missed = 0; this.fast = 0; this.elapsed = 0;
    this.overlay();
    this.newMission();
  }
  overlay() {
    const o = $('miniOverlay');
    const m = document.createElement('div'); m.className = 'fashion-mission'; o.appendChild(m); this.missionEl = m;
    const f = document.createElement('div'); f.className = 'fashion-flash'; o.appendChild(f); this.flashEl = f;
  }

  newMission() {
    const lvl = this.snaps;
    const one = () => {
      const r = Math.random();
      if (r < 0.15) return { cat: 'glasses' };
      return { cat: r < 0.45 ? 'hat' : r < 0.7 ? 'bag' : 'top', color: pick(COLORS).k };
    };
    let conds = [one()];
    if (lvl >= 6 && Math.random() < 0.6) { let c2; do c2 = one(); while (c2.cat === conds[0].cat); conds.push(c2); }
    this.mission = { conds, t: 0, target: null, pendingIn: 1 + ((Math.random() * 3) | 0), done: false };
    this.missionEl.innerHTML = `<small>📸 이 옷차림을 찾아 찰칵!</small><div>${conds.map((c) => `<span class="chip">${condIcon(c)} ${c.color ? `<i style="background:${colorOf(c.color).c}"></i>` : ''}${condName(c)}</span>`).join('<b>+</b>')}</div>`;
    this.missionEl.classList.remove('pop'); void this.missionEl.offsetWidth; this.missionEl.classList.add('pop');
  }

  spawn() {
    const m = this.mission, lane = pick(LANES);
    let o;
    const isTarget = !m.done && !m.target && --m.pendingIn <= 0;
    if (isTarget) { o = randomOutfit(); m.conds.forEach((c) => force(o, c)); }
    else {
      for (let i = 0; i < 30; i++) { o = randomOutfit(); if (!matchesAll(o, m.conds)) break; }
      if (matchesAll(o, m.conds)) { const c = m.conds[0]; if (c.cat === 'glasses') o.glasses = false; else if (c.cat === 'hat') o.hat = null; else if (c.cat === 'bag') o.bag = null; else o.top = pick(COLORS.filter((x) => x.k !== c.color)).k; }
    }
    const av = new Avatar(npcSkin({ shirt: colorOf(o.top).c, pants: o.pants, hair: pick(HAIRS), skin: pick(TONES) }), { height: H });
    dress(av, o);
    av.root.position.set(-lane.dir * EDGE, 0, lane.z + (Math.random() - 0.5) * 0.3);
    av.root.traverse((x) => (x.userData.person = true));
    this.scene.add(av.root);
    const p = { av, o, dir: lane.dir, speed: 1.4 + Math.min(this.snaps, 10) * 0.1 + Math.random() * 0.4, done: false };
    this.people.push(p);
    if (isTarget) m.target = p;
  }

  removePerson(p) {
    this.scene.remove(p.av.root);
    p.av.root.traverse((x) => { if (x.isMesh && !p.av.meshes.includes(x)) x.geometry.dispose(); }); // 소품 (재질은 공용이라 그대로)
    p.av.dispose();
  }

  pointerDown(e, w, h) {
    if (this.state !== 'play') return;
    this.ray.setFromCamera(this.ndc(e, w, h), this.camera);
    const hits = this.ray.intersectObjects(this.people.filter((p) => !p.done).map((p) => p.av.root), true);
    if (!hits.length) return;
    let obj = hits[0].object; while (obj.parent && !this.people.some((p) => p.av.root === obj)) obj = obj.parent;
    const p = this.people.find((q) => q.av.root === obj);
    if (!p) return;
    const pos = p.av.root.position.clone().add(new THREE.Vector3(0, 2.1, 0));
    this.flashEl.classList.remove('on'); void this.flashEl.offsetWidth; this.flashEl.classList.add('on');
    if (!this.mission.done && matchesAll(p.o, this.mission.conds)) {
      p.done = true; p.posing = 1.0;
      this.mission.done = true;
      const quick = this.mission.t < 4; if (quick) this.fast++;
      this.snaps++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 10 * this.mission.conds.length + (quick ? 5 : 0) + Math.min(this.combo, 5);
      this.score += pts;
      sfx.gold(); this.float(pos, quick ? `찰칵! 빠르다! +${pts}` : `찰칵! +${pts}`, 'gold');
      setTimeout(() => { if (this.state === 'play') this.newMission(); }, 700);
    } else {
      this.wrongs++;
      sfx.miss();
      this.hurt(pos, '그 옷차림이 아니에요!');
    }
  }

  idle(dt, t) {
    for (const p of this.people) p.av.animate(dt, t, { moving: false, yaw: p.dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
    this.avatar.animate(dt, t, { yaw: Math.PI });
  }

  step(dt, t) {
    this.elapsed += dt;
    const m = this.mission;
    m.t += dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = Math.max(0.55, 1.15 - this.snaps * 0.04) * (0.8 + Math.random() * 0.4); }
    for (let i = this.people.length - 1; i >= 0; i--) {
      const p = this.people[i], r = p.av.root;
      if (p.posing > 0) { // 찍힌 사람은 잠깐 서서 손 흔들기
        p.posing -= dt;
        p.av.animate(dt, t, { yaw: 0, wave: true });
        continue;
      }
      r.position.x += p.dir * p.speed * dt;
      p.av.animate(dt, t, { moving: true, yaw: p.dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
      if (Math.abs(r.position.x) > EDGE + 0.5) {
        this.removePerson(p); this.people.splice(i, 1);
        if (p === m.target && !m.done) {
          const other = this.people.find((q) => !q.done && matchesAll(q.o, m.conds) && Math.abs(q.av.root.position.x) < EDGE);
          if (other) m.target = other;
          else { m.done = true; this.missed++; this.hurt(new THREE.Vector3(p.dir * 6, 2.2, 0), '놓쳤어요!'); setTimeout(() => { if (this.state === 'play') this.newMission(); }, 500); }
        }
      }
    }
    this.avatar.animate(dt, t, { yaw: Math.PI });
  }

  extraText() { return `찰칵 ${this.snaps || 0}장 · 콤보 ${this.combo || 0}`; }
  resultRows() { return [['찍은 사진', `${this.snaps}장`], ['빨리 찾음 (4초 안)', `${this.fast}번`], ['잘못 찍음 / 놓침', `${this.wrongs} / ${this.missed}`], ['최대 콤보', `${this.maxCombo}`]]; }
}
