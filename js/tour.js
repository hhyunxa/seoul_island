// ============================================================
//  팔각정 망원경: 카메라가 서울 하늘을 날며 명소를 하나씩 비춰 줌
//  (main.js가 world 모드에서 tour가 있으면 updateWorld 대신 이걸 돌림)
// ============================================================
import * as THREE from 'three';
import { LANDMARKS } from './seoulMap.js';

const L = Object.fromEntries(LANDMARKS.map((l) => [l.id, l]));
const STOPS = [
  { at: 'gyeongbok', name: '경복궁', desc: '조선의 으뜸 궁궐이에요. 팔각정 바로 아래, 광화문 너머로 서울이 펼쳐져요', h: 0.5 },
  { at: 'namsan', name: '남산서울타워', desc: '서울 한가운데 남산 꼭대기에 선 타워예요. 사랑의 자물쇠로도 유명해요', h: 5, back: 24, up: 9 },
  { at: 'nodeul', name: '한강', desc: '서울을 동서로 가로지르는 한강이에요. 여러 다리가 강북과 강남을 이어요', h: 0 },
  { at: 'b63', name: '63빌딩', desc: '여의도 한강가에서 금빛으로 반짝이는 빌딩이에요', h: 8, back: 30, up: 6 },
  { at: 'lotte', name: '롯데월드타워', desc: '123층, 서울에서 가장 높은 빌딩이에요. 옆엔 석촌호수가 있어요', h: 17, back: 54, up: 3 },
];
const MOVE = 3.0, HOLD = 2.4; // 다음 명소까지 날아가는 시간 / 머무는 시간 (초)

const ease = (k) => k * k * (3 - 2 * k);

export class Tour {
  // home: 팔각정 위치, back: 끝나고 돌아갈 원래 카메라 { pos, look }
  constructor(camera, home, back) {
    this.camera = camera;
    this.frames = [];
    // 처음: 팔각정 위로 올라가 남쪽 서울 시내를 한눈에
    this.frames.push({ pos: camera.position.clone(), look: back.look.clone() });
    this.frames.push({ pos: new THREE.Vector3(home.x, 16, home.z - 5), look: new THREE.Vector3(home.x + 2, 0, home.z + 32), cap: { name: '서울 한눈에 보기', desc: '북악산 팔각정에서 내려다본 서울이에요' } });
    for (const s of STOPS) {
      const t = L[s.at]; if (!t) continue;
      const look = new THREE.Vector3(t.x, s.h, t.z);
      const dir = new THREE.Vector3(t.x - home.x, 0, t.z - home.z).normalize(); // 팔각정 쪽에서 바라봄
      this.frames.push({ pos: look.clone().addScaledVector(dir, -(s.back || 16)).setY(s.h + (s.up || 11)), look, cap: s });
    }
    this.frames.push({ pos: back.pos.clone(), look: back.look.clone() });
    this.i = 0; this.t = 0; this.focus = back.look.clone();
    this.el = document.createElement('div');
    this.el.className = 'panel small tour-cap hidden';
    document.body.appendChild(this.el);
    this.skipEl = document.createElement('div');
    this.skipEl.className = 'tour-skip';
    this.skipEl.textContent = 'E · Esc 그만 보기';
    document.body.appendChild(this.skipEl);
  }

  skip() { this.i = this.frames.length - 2; this.t = MOVE * 0.6; }

  // 끝나면 true
  update(dt) {
    this.t += dt;
    const last = this.i >= this.frames.length - 2;
    if (this.t > MOVE + (last ? 0 : HOLD)) { this.i++; this.t = 0; if (this.i >= this.frames.length - 1) return true; }
    const a = this.frames[this.i], b = this.frames[this.i + 1];
    const k = ease(Math.min(1, this.t / MOVE));
    const pos = a.pos.clone().lerp(b.pos, k);
    pos.y += Math.sin(k * Math.PI) * (a.pos.distanceTo(b.pos) > 30 ? 8 : 2); // 먼 곳은 높이 날아서
    this.focus.copy(a.look).lerp(b.look, k);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.focus);
    // 자막: 그 명소에 가까워지면 띄움
    const cap = k > 0.55 ? b.cap : null;
    if (cap) { this.el.innerHTML = `<b>${cap.name}</b><span>${cap.desc}</span>`; this.el.classList.remove('hidden'); }
    else this.el.classList.add('hidden');
    return false;
  }

  dispose() { this.el.remove(); this.skipEl.remove(); }
}
