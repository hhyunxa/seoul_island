// ============================================================
//  웹캠 몸동작 인식 (MediaPipe Pose Landmarker)
//  - 처음 켤 때만 라이브러리·모델을 내려받음 (게임 첫 로딩에는 영향 없음)
//  - 동작: jump(점프) · wave(한 손 들기) · clap(박수) · hooray(두 손 만세)
// ============================================================
const VER = '1.1.1'; // package.json의 @mediapipe/tasks-vision 버전과 맞출 것
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerP = null;
function loadLandmarker() {
  if (!landmarkerP) landmarkerP = (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fs = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate) => PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
    try { return await make('GPU'); } catch { return await make('CPU'); }
  })().catch((e) => { landmarkerP = null; throw e; });
  return landmarkerP;
}

// 자세가 이만큼 유지돼야 동작으로 인정 (초) — 손 하나 먼저 올라간 만세가 '손 흔들기'로 잡히지 않게
const HOLD = { wave: 0.16, hooray: 0.05, clap: 0.03, neutral: 0.06 };

// 관절 좌표 → 동작 판정
export class Gestures {
  constructor() { this.reset(); }
  reset() { this.base = null; this.sw = null; this.cand = 'neutral'; this.candT = 0; this.fired = 'neutral'; this.jumping = false; this.jumpT = 0; this.pose = 'neutral'; }

  // lm: 정규화 좌표 33개, asp: 영상 가로/세로 비. 새 동작이 시작되면 그 이름을 돌려줌
  update(lm, asp, dt) {
    const P = (i) => ({ x: lm[i].x * asp, y: lm[i].y });
    const ls = P(11), rs = P(12), lw = P(15), rw = P(16), li = P(19), ri = P(20);
    const sw0 = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (sw0 < 0.03) return null; // 너무 멀거나 옆으로 서 있음
    const sy = (ls.y + rs.y) / 2;
    this.sw = this.sw == null ? sw0 : this.sw + (sw0 - this.sw) * Math.min(1, dt * 3);
    const sw = this.sw;
    let fire = null;

    // 팔 자세 (손목과 검지 끝 중 높은 쪽 = 손 높이)
    const hand = (w, f) => ({ x: (w.x + f.x) / 2, y: Math.min(w.y, f.y) });
    const lh = hand(lw, li), rh = hand(rw, ri);
    const up = (h) => h.y < sy - sw * 0.35; // 대략 턱 높이보다 위
    const down = (h) => h.y > sy - sw * 0.1;
    const chest = (h) => h.y > sy - sw * 0.3 && h.y < sy + sw * 1.3; // 박수 치는 높이 (차렷 자세 손은 이보다 아래)
    const gap = Math.min(Math.hypot(lw.x - rw.x, lw.y - rw.y), Math.hypot(li.x - ri.x, li.y - ri.y));
    let pose = 'neutral';
    if (up(lh) && up(rh)) pose = 'hooray';
    else if ((up(lh) && down(rh)) || (up(rh) && down(lh))) pose = 'wave';
    else if (gap < sw * 0.65 && chest(lh) && chest(rh)) pose = 'clap';

    // 점프: 몸통 높이가 평소보다 확 올라감. 엉덩이가 보이면 어깨와 평균 (팔을 들면 어깨만 따라 올라가므로)
    // 기준선은 천천히 따라가야 뛰어오르는 동안 같이 올라가 버리지 않음
    const hipsSeen = (lm[23].visibility ?? 1) > 0.5 && (lm[24].visibility ?? 1) > 0.5;
    const ty = hipsSeen ? (sy + (lm[23].y + lm[24].y) / 2) / 2 : sy;
    if (this.base == null || hipsSeen !== this.hipsSeen) this.base = ty;
    this.hipsSeen = hipsSeen;
    const lift = this.base - ty;
    const need = sw * (pose === 'neutral' || pose === 'clap' ? 0.15 : 0.28); // 팔을 든 채로는 더 확실히 뛰어야 인정
    if (!this.jumping && lift > need) { this.jumping = true; this.jumpT = 0; fire = 'jump'; }
    else if (this.jumping) {
      this.jumpT += dt;
      if (lift < sw * 0.07) this.jumping = false;
      else if (this.jumpT > 1.2) { this.jumping = false; this.base = ty; } // 계단·의자 등으로 아예 높이가 바뀜
    }
    if (!this.jumping) this.base += (ty - this.base) * Math.min(1, dt * (ty > this.base ? 3 : 0.6)); // 내려가는 쪽(쪼그려 앉기)은 빨리 따라감
    this.pose = this.jumping ? 'jump' : pose;

    if (pose !== this.cand) { this.cand = pose; this.candT = 0; } else this.candT += dt;
    if (this.candT >= HOLD[pose] && pose !== this.fired) {
      this.fired = pose;
      if (pose !== 'neutral' && !fire) fire = pose;
    }
    return fire;
  }
}

// 이음선 (미리보기 그림용)
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
export const POSE_LABEL = { neutral: '…', jump: '⬆️ 점프', wave: '🙋 손 흔들기', clap: '👏 박수', hooray: '🙌 만세' };

export class PoseInput {
  constructor() {
    this.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
    this.canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 192 });
    this.canvas.className = 'pose-cam';
    this.g = new Gestures();
    this.onMove = null; // (moveId) => void
    this.running = false; this.seen = false; this.lastT = 0; this.lastVT = -1;
  }

  start() {
    this.wanted = true;
    if (this.running) return Promise.resolve();
    return (this.startP ||= this.open().finally(() => { this.startP = null; }));
  }
  async open() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라를 쓸 수 없어요');
    const [stream, lm] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
      loadLandmarker(),
    ]);
    this.lm = lm;
    if (!this.wanted) { stream.getTracks().forEach((t) => t.stop()); return; } // 켜는 사이에 꺼 달라고 함
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    this.g.reset(); this.running = true; this.lastT = performance.now();
    const loop = () => { if (!this.running) return; this.tick(); this.raf = requestAnimationFrame(loop); };
    loop();
  }

  stop() {
    this.wanted = false; this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.video.srcObject = null;
  }

  tick() {
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVT) return;
    this.lastVT = v.currentTime;
    const now = performance.now(), dt = Math.min(0.2, (now - this.lastT) / 1000); this.lastT = now;
    const res = this.lm.detectForVideo(v, now);
    const lm = res.landmarks?.[0];
    this.joints = lm || null; this.asp = v.videoWidth / v.videoHeight; // 관절 좌표 (게임이 직접 자세를 판정할 때 씀)
    this.seen = !!lm;
    if (lm) { const m = this.g.update(lm, v.videoWidth / v.videoHeight, dt); if (m) { this.flash = { m, t: now }; this.onMove?.(m); } }
    this.draw(lm);
  }

  // 거울처럼 뒤집은 카메라 화면 + 뼈대 + 지금 인식된 자세
  draw(lm) {
    const c = this.canvas, g = c.getContext('2d'), W = c.width, H = c.height;
    g.save(); g.translate(W, 0); g.scale(-1, 1);
    g.drawImage(this.video, 0, 0, W, H);
    if (lm) {
      g.strokeStyle = '#ffe14f'; g.lineWidth = 3;
      for (const [a, b] of BONES) { g.beginPath(); g.moveTo(lm[a].x * W, lm[a].y * H); g.lineTo(lm[b].x * W, lm[b].y * H); g.stroke(); }
      g.fillStyle = '#ff5a4f';
      for (const i of [0, 15, 16]) g.fillRect(lm[i].x * W - 3, lm[i].y * H - 3, 6, 6);
    }
    g.restore();
    // 방금 인식된 동작: 초록 테두리 + 큰 글씨로 잠깐 보여 줌
    const f = this.flash && performance.now() - this.flash.t < 600 ? this.flash.m : null;
    g.textAlign = 'center';
    if (f) {
      g.strokeStyle = '#6fdc4a'; g.lineWidth = 8; g.strokeRect(0, 0, W, H);
      g.font = '700 24px Galmuri11, monospace'; g.lineWidth = 5; g.strokeStyle = '#3f1d0b';
      g.strokeText(POSE_LABEL[f], W / 2, H / 2); g.fillStyle = '#fff'; g.fillText(POSE_LABEL[f], W / 2, H / 2);
    }
    let msg = '몸이 화면에 보이게 서 주세요';
    if (lm) {
      const vis = (i) => lm[i].visibility ?? 1;
      const sw = Math.abs(lm[11].x - lm[12].x);
      msg = vis(15) < 0.4 && vis(16) < 0.4 ? '두 손이 화면에 보이게!' : sw > 0.45 ? '조금 뒤로 가 주세요' : sw < 0.1 ? '조금 앞으로 와 주세요' : this.label || POSE_LABEL[this.g.pose]; // label: 게임이 정한 안내 (없으면 퍼레이드 동작 이름)
    }
    g.fillStyle = 'rgba(63,29,11,.75)'; g.fillRect(0, H - 24, W, 24);
    g.fillStyle = '#fff'; g.font = '700 14px Galmuri11, monospace';
    g.fillText(msg, W / 2, H - 7);
  }
}
