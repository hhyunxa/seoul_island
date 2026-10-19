import * as THREE from 'three';
import { box } from '../world.js';
import { Avatar } from '../character.js';
import { signTexture } from '../textures.js';
import { geo } from '../seoulMap.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

const $ = (id) => document.getElementById(id);
// 8방향: 북쪽부터 시계 방향. 키는 QWE / A·D / ZXC (키보드 모양 그대로)
const DIRS = [
  { name: '북', key: 'KeyW', k: 'W' }, { name: '북동', key: 'KeyE', k: 'E' }, { name: '동', key: 'KeyD', k: 'D' }, { name: '남동', key: 'KeyC', k: 'C' },
  { name: '남', key: 'KeyX', k: 'X' }, { name: '남서', key: 'KeyZ', k: 'Z' }, { name: '서', key: 'KeyA', k: 'A' }, { name: '북서', key: 'KeyQ', k: 'Q' },
];
const GRID = [7, 0, 1, 6, -1, 2, 5, 4, 3]; // 3×3 버튼 배치 (가운데는 명동)
const HELLO = ['Excuse me!', '不好意思!', 'すみません!', 'Excusez-moi!', '¡Perdón!', 'Entschuldigung!', 'Xin lỗi!', 'Com licença!'];
const ORIGIN = geo(126.9856, 37.5636); // 명동 (지도 위 진짜 위치 기준으로 방향을 잼)

// 명동 길 안내 도우미: 여행자가 묻는 곳이 명동에서 어느 쪽인지 8방향으로 알려 주기
export class GuideGame extends MiniGame {
  static meta = {
    id: 'guide', title: '명동 길 안내', duration: 60, hearts: 3, resultTitle: '길 안내 끝!', fov: 46, sky: '#a8dcf5',
    hint: 'Q W E / A · D / Z X C = 8방향으로 알려 주기 (버튼 클릭도 OK) · M = 서울 지도 보기 (보는 동안 여행자가 더 빨리 지쳐요)',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-5, 14, 8], size: 14 });
    this.tileGround(16, 30, (x) => (x >= 5 && x <= 10 ? 'path' : 'path'), 51).position.z = -8;
    box(5.4, 0.02, 30, '#cfc6b5', 0, 0.01, -8, s).castShadow = false; // 보도블록 길
    // 양쪽 가게 줄 (명동 거리 느낌)
    const shops = [['#f4a6c0', '화장품'], ['#7fc8f0', '환전'], ['#ffd23f', '기념품'], ['#a5e07f', '카페'], ['#ff9e7a', '분식'], ['#c39bf0', '옷가게'], ['#f6f3ea', '편의점'], ['#ffcf8a', '빵집']];
    for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
      const [c, name] = shops[(i * 3 + (side > 0 ? 1 : 0)) % shops.length], z = 3 - i * 3.2;
      box(2.4, 3.2 + (i % 3) * 0.8, 3, c, side * 4.4, 1.6 + (i % 3) * 0.4, z, s);
      box(0.06, 1.2, 2.2, '#bfe6fa', side * 3.18, 0.9, z, s);
      const sg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 2.0), new THREE.MeshLambertMaterial({ map: signTexture(name, { w: 64, h: 16, size: 11, bg: '#ffffff' }) }));
      sg.position.set(side * 3.16, 2.0, z); sg.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; s.add(sg);
      sg.material.map.center.set(0.5, 0.5);
    }
    // 머리 위 꼬마전구 줄
    for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) { const b = box(0.1, 0.1, 0.1, ['#ffe14f', '#ff7ad9', '#7ae8ff'][(i + j) % 3], -3 + j, 3.4 - Math.sin((j / 6) * Math.PI) * 0.3, 2 - i * 3.2, s); b.material = new THREE.MeshBasicMaterial({ color: b.material.color }); b.castShadow = false; }
    // 관광안내 표지
    const info = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.08), new THREE.MeshLambertMaterial({ map: signTexture('i 관광안내', { w: 64, h: 22, size: 12, bg: '#e8413a', fg: '#ffffff' }) }));
    info.position.set(-1.6, 1.9, 1.6); s.add(info); box(0.08, 1.6, 0.08, '#888', -1.6, 0.8, 1.6, s);
    this.camera.position.set(0, 3.0, 6.6);
    this.camera.lookAt(0, 1.3, -2);
    this.tourists = [];
  }

  onAvatar() { this.player.position.set(0.9, 0, 2.2); this.player.rotation.y = Math.PI; }

  // 갈 곳: 지도 안내판이 있는 랜드마크 + 지하철역 (명동에서 너무 가까운 곳은 빼고)
  places() {
    const w = this.ctx.world;
    const list = [...w.landmarkPins.map((p) => ({ name: p.name, x: p.x, z: p.z })), ...(w.stations || []).map((s) => ({ name: `${s.name}역`, x: s.x, z: s.z }))];
    const seen = new Set();
    return list.filter((p) => { const d = Math.hypot(p.x - ORIGIN[0], p.z - ORIGIN[1]); if (d < 9 || seen.has(p.name) || p.name === '명동') return false; seen.add(p.name); return true; });
  }
  dirOf(p) { const a = Math.atan2(p.x - ORIGIN[0], -(p.z - ORIGIN[1])); return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; }

  reset() {
    for (const t of this.tourists) this.scene.remove(t.av.root);
    this.tourists = []; this.cur = null; this.helped = 0; this.exact = 0; this.near = 0; this.peeks = 0;
    this.pool = this.places(); this.nextT = 0.5; this.mapOpen = false; this.reveal = 0;
    this.player.position.set(0.9, 0, 2.2);
    this.overlay();
  }

  overlay() {
    const o = $('miniOverlay');
    const q = document.createElement('div'); q.className = 'guide-q panel small hidden'; o.appendChild(q); this.qEl = q;
    const pad = document.createElement('div'); pad.className = 'guide-pad';
    pad.innerHTML = GRID.map((d) => (d < 0 ? '<div class="mid">명동</div>' : `<button class="btn" data-d="${d}"><b>${DIRS[d].k}</b>${DIRS[d].name}</button>`)).join('') ;
    pad.onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) this.answer(+b.dataset.d); };
    o.appendChild(pad);
    const mb = document.createElement('button'); mb.className = 'btn guide-mapbtn'; mb.textContent = '🗺️ 지도 (M)'; mb.onclick = () => this.toggleMap(); o.appendChild(mb);
    const cv = document.createElement('canvas'); cv.className = 'guide-map hidden'; o.appendChild(cv); this.mapCv = cv;
  }

  toggleMap(force) {
    this.mapOpen = force ?? !this.mapOpen;
    if (this.mapOpen && this.state === 'play' && force === undefined) this.peeks++;
    this.drawMap();
    this.mapCv.classList.toggle('hidden', !this.mapOpen && this.reveal <= 0);
  }
  // 서울 지도 (월드 미니맵 그림 재사용) + 명동 위치, 정답 공개 때는 화살표
  drawMap(target) {
    const img = this.ctx.world.minimap, cv = this.mapCv, k = 2;
    cv.width = img.width * k; cv.height = img.height * k;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, cv.width, cv.height);
    const sx = (x) => (x + img.width / 2) * k, sy = (z) => (z + img.height / 2) * k;
    g.font = '700 13px Galmuri11'; g.textAlign = 'center';
    for (const n of ['북', '동', '남', '서']) { const [x, y] = { 북: [cv.width / 2, 16], 동: [cv.width - 12, cv.height / 2], 남: [cv.width / 2, cv.height - 6], 서: [12, cv.height / 2] }[n]; g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(n, x, y); g.fillStyle = '#3a2410'; g.fillText(n, x, y); }
    const ox = sx(ORIGIN[0]), oy = sy(ORIGIN[1]);
    if (target) {
      g.strokeStyle = '#e8413a'; g.lineWidth = 4; g.beginPath(); g.moveTo(ox, oy); g.lineTo(sx(target.x), sy(target.z)); g.stroke();
      g.fillStyle = '#e8413a'; g.beginPath(); g.arc(sx(target.x), sy(target.z), 6, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(target.name, sx(target.x), sy(target.z) - 10); g.fillStyle = '#3a2410'; g.fillText(target.name, sx(target.x), sy(target.z) - 10);
    }
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#3a2410'; g.lineWidth = 2; g.beginPath(); g.arc(ox, oy, 6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText('명동', ox, oy + 20); g.fillStyle = '#3a2410'; g.fillText('명동', ox, oy + 20);
  }

  spawn() {
    const i = this.helped + this.tourists.length;
    const sk = npcSkin({ shirt: ['#3f7fe0', '#e04a3a', '#3fbf6a', '#f28c28', '#9b5de5', '#ffffff', '#2a2a33'][(i * 5 + 3) % 7], pants: ['#3a3f4a', '#5b8fd8', '#c9a26b'][i % 3], hair: HAIRS[(i * 3) % HAIRS.length], skin: TONES[(i * 7) % TONES.length] });
    const av = new Avatar(sk, { height: 1.6 });
    // 배낭
    box(0.42, 0.5, 0.22, ['#e8413a', '#2f7fd8', '#ffd23f'][i % 3], 0, 0.95, -0.25, av.torso);
    av.root.position.set((Math.random() - 0.5) * 2, 0, -16); av.root.rotation.y = 0;
    this.scene.add(av.root);
    const prog = Math.min(1, this.helped / 10);
    const place = this.pool[(Math.random() * this.pool.length) | 0];
    const t = { av, place, dir: this.dirOf(place), hello: HELLO[(Math.random() * HELLO.length) | 0], patience: 9 - prog * 3.5, maxP: 9 - prog * 3.5, state: 'walk', leaveT: 0 };
    this.tourists.push(t);
  }

  keyDown(code) {
    if (code === 'KeyM') { this.toggleMap(); return; }
    const d = DIRS.findIndex((x) => x.key === code);
    if (d >= 0) this.answer(d);
  }

  answer(d) {
    const t = this.cur;
    if (this.state !== 'play' || !t || t.state !== 'ask') return;
    const diff = Math.min((d - t.dir + 8) % 8, (t.dir - d + 8) % 8);
    const pos = t.av.root.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    if (diff === 0) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.exact++;
      const pts = 15 + Math.min(this.combo, 10) * 2 + Math.round((t.patience / t.maxP) * 5);
      this.score += pts; sfx.gold(); this.float(pos, `Thank you! +${pts}`, 'gold');
      t.happy = true;
    } else if (diff === 1) {
      this.near++; this.score += 5; sfx.catch(2); this.float(pos, `거의 맞아요! (${DIRS[t.dir].name}쪽) +5`, '');
      t.happy = true;
    } else {
      this.combo = 0; this.hurt(pos, `반대쪽이에요… (${DIRS[t.dir].name}쪽)`); t.happy = false;
    }
    this.helped++;
    this.done(t);
  }
  done(t) {
    t.state = 'leave'; t.leaveT = 0; this.cur = null; this.qEl.classList.add('hidden');
    // 정답 방향을 지도에 잠깐 보여 줌
    this.reveal = 1.6; this.drawMap(t.place); this.mapCv.classList.remove('hidden');
    this.nextT = 0.5;
  }

  idle(dt, t) {
    this.avatar.animate(dt, t, { yaw: Math.PI, wave: this.state === 'done' });
    for (const x of this.tourists) x.av.animate(dt, t, { yaw: x.av.root.rotation.y });
  }

  step(dt, t) {
    this.avatar.animate(dt, t, { yaw: Math.PI, wave: this.cur?.state === 'ask' && Math.sin(t * 2) > 0.7 });
    if (!this.cur && !this.tourists.some((x) => x.state === 'walk')) { this.nextT -= dt; if (this.nextT <= 0) this.spawn(); }
    for (const x of this.tourists) {
      const p = x.av.root.position;
      if (x.state === 'walk') {
        const tx = -0.7, tz = 0.3, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); // 내 캐릭터에 가리지 않게 왼쪽 앞에 섬
        if (d < 0.1) { x.state = 'ask'; this.cur = x; sfx.talk(); }
        else { p.x += (dx / d) * Math.min(d, 5 * dt); p.z += (dz / d) * Math.min(d, 5 * dt); }
        x.av.animate(dt, t, { moving: d >= 0.1, yaw: Math.atan2(dx, dz) });
      } else if (x.state === 'ask') {
        x.patience -= dt * (this.mapOpen ? 2 : 1);
        x.av.animate(dt, t, { yaw: 0, wave: x.patience > x.maxP - 1.2 });
        if (x.patience <= 0) { this.combo = 0; this.hurt(p.clone().add(new THREE.Vector3(0, 2.2, 0)), '여행자가 기다리다 갔어요'); x.happy = false; this.done(x); }
      } else {
        x.leaveT += dt;
        if (x.leaveT < 0.6) x.av.animate(dt, t, { yaw: 0, wave: x.happy, armsUp: false });
        else { p.z -= 4.5 * dt; p.x += (x.happy ? 1 : -1) * dt; x.av.animate(dt, t, { moving: true, yaw: Math.PI }); }
      }
    }
    for (const x of this.tourists.filter((y) => y.state === 'leave' && y.av.root.position.z < -18)) { this.scene.remove(x.av.root); x.av.dispose(); }
    this.tourists = this.tourists.filter((y) => !(y.state === 'leave' && y.av.root.position.z < -18));
    // 질문 말풍선 + 인내심 막대
    const c = this.cur;
    if (c) {
      const v = c.av.root.position.clone().add(new THREE.Vector3(0, 2.1, 0)).project(this.camera);
      this.qEl.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; this.qEl.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      this.qEl.innerHTML = `<div class="hello">${c.hello}</div><div><b>${c.place.name}</b> 어느 쪽이에요?</div><div class="pat"><i style="width:${Math.max(0, c.patience / c.maxP) * 100}%"></i></div>`;
      this.qEl.classList.remove('hidden');
    }
    if (this.reveal > 0) { this.reveal -= dt; if (this.reveal <= 0) { if (this.mapOpen) this.drawMap(); else this.mapCv.classList.add('hidden'); } }
  }

  extraText() { return this.combo > 1 ? `콤보 ${this.combo}` : `도운 여행자 ${this.helped}`; }
  resultRows() { return [['도운 여행자', `${this.helped}명`], ['정확한 안내', `${this.exact}번`], ['거의 맞음', `${this.near}번`], ['지도 본 횟수', `${this.peeks}번`], ['최대 콤보', `${this.maxCombo}`]]; }
}
