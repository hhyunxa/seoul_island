// ============================================================
//  웹캠 손 인식 (MediaPipe Hand Landmarker) — 몸은 안 보여도 손만 보이면 됨
//  - 처음 켤 때만 라이브러리·모델을 내려받음
//  - hands: 화면에 보이는 손 (최대 2개, 화면 왼쪽부터). 좌표는 거울처럼 뒤집어서 0~1 (x: 왼→오, y: 위→아래)
//  - 이벤트 onEvent(type, hand): 'fist'(손을 쥠) · 'open'(손을 폄) · 'stroke'(손을 아래로 휙 내림)
// ============================================================
const VER = '1.1.1'; // package.json의 @mediapipe/tasks-vision 버전과 맞출 것
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarkerP = null;
function loadLandmarker() {
  if (!landmarkerP) landmarkerP = (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const fs = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate) => HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2 });
    try { return await make('GPU'); } catch { return await make('CPU'); }
  })().catch((e) => { landmarkerP = null; throw e; });
  return landmarkerP;
}

const TIPS = [8, 12, 16, 20], PIPS = [6, 10, 14, 18];
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const STROKE_V = 1.1;   // 이만큼(화면 높이/초)보다 빨리 내리면 '첨벙'
const LOST_T = 0.35;    // 이만큼 안 보이면 손이 없어진 걸로

// 손 하나의 모양 읽기
function readHand(lm) {
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const ext = TIPS.filter((t, i) => d(t, 0) > d(PIPS[i], 0) * 1.1).length; // 펴진 손가락 수 (엄지 제외)
  const palm = [0, 5, 9, 13, 17].reduce((a, i) => ({ x: a.x + lm[i].x / 5, y: a.y + lm[i].y / 5 }), { x: 0, y: 0 });
  return { x: 1 - palm.x, y: palm.y, fist: ext <= 1, open: ext >= 3, size: d(0, 9) };
}

export class HandInput {
  constructor() {
    this.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
    this.canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 192 });
    this.canvas.className = 'pose-cam';
    this.hands = [];       // 지금 보이는 손 (x 순서)
    this.onEvent = null;   // (type, hand) => void
    this.label = '';       // 미리보기 아래에 띄울 글 (게임이 정함)
    this.running = false; this.lastVT = -1; this.lastT = 0; this.flash = null;
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
    this.hands = []; this.running = true; this.lastT = performance.now();
    const loop = () => { if (!this.running) return; this.tick(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  stop() {
    this.wanted = false; this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.video.srcObject = null; this.hands = [];
  }

  tick() {
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVT) return;
    this.lastVT = v.currentTime;
    const now = performance.now(), dt = Math.min(0.2, (now - this.lastT) / 1000); this.lastT = now;
    const res = this.lm.detectForVideo(v, now);
    const raw = (res.landmarks || []).map((lm) => ({ ...readHand(lm), lm })).sort((a, b) => a.x - b.x);
    // 이전 프레임 손과 가까운 것끼리 이어 붙여 속도·상태 계산
    const prev = this.hands, next = [];
    for (const h of raw) {
      let best = null, bd = 0.25;
      for (const p of prev) { const dd = Math.hypot(p.x - h.x, p.y - h.y); if (dd < bd && !next.includes(p)) { bd = dd; best = p; } }
      if (best) {
        const k = Math.min(1, dt * 18);
        const vy = (h.y - best.y) / Math.max(dt, 0.016);
        Object.assign(best, { x: best.x + (h.x - best.x) * k, y: best.y + (h.y - best.y) * k, vy: best.vy + (vy - best.vy) * Math.min(1, dt * 20), lm: h.lm, size: h.size, seenT: now });
        // 주먹/폄: 한 프레임 튀는 건 무시하려고 두 프레임 연속일 때만 바꿈
        const want = h.fist ? 'fist' : h.open ? 'open' : best.shape;
        if (want === best.candShape) best.candN++; else { best.candShape = want; best.candN = 1; }
        if (best.candN >= 2 && want !== best.shape) { best.shape = want; this.onEvent?.(want, best); if (want === 'fist') this.flash = { text: '✊', t: now }; }
        // 첨벙: 위로 올렸다가 아래로 빨리 내림
        if (best.armed && best.vy > STROKE_V) { best.armed = false; this.onEvent?.('stroke', best); this.flash = { text: '💦 첨벙!', t: now }; }
        else if (!best.armed && best.vy < 0.1) best.armed = true;
        next.push(best);
      } else { const shape = h.fist ? 'fist' : 'open'; next.push({ x: h.x, y: h.y, vy: 0, lm: h.lm, size: h.size, shape, candShape: shape, candN: 0, armed: true, seenT: now }); }
    }
    for (const p of prev) if (!next.includes(p) && now - p.seenT < LOST_T * 1000) next.push(p); // 잠깐 놓친 손은 조금 기다려 줌
    this.hands = next.sort((a, b) => a.x - b.x);
    this.draw(now);
  }

  // 편의 함수
  get fresh() { const now = performance.now(); return this.hands.filter((h) => now - h.seenT < LOST_T * 1000); }
  center() { const h = this.fresh; return h.length ? { x: h.reduce((a, b) => a + b.x, 0) / h.length, y: h.reduce((a, b) => a + b.y, 0) / h.length } : null; }
  // 두 손을 잇는 선의 기울기 (라디안, 오른손이 내려가면 +) — 허공 핸들
  wheel() { const h = this.fresh; return h.length === 2 ? Math.atan2(h[1].y - h[0].y, h[1].x - h[0].x) : null; }
  anyFist() { return this.fresh.some((h) => h.shape === 'fist'); }
  allFist() { const h = this.fresh; return h.length > 0 && h.every((x) => x.shape === 'fist'); }

  draw(now) {
    const c = this.canvas, g = c.getContext('2d'), W = c.width, H = c.height;
    g.save(); g.translate(W, 0); g.scale(-1, 1);
    g.drawImage(this.video, 0, 0, W, H);
    for (const h of this.fresh) {
      const lm = h.lm;
      g.strokeStyle = h.shape === 'fist' ? '#ff8a3a' : '#ffe14f'; g.lineWidth = 2;
      for (const [a, b] of BONES) { g.beginPath(); g.moveTo(lm[a].x * W, lm[a].y * H); g.lineTo(lm[b].x * W, lm[b].y * H); g.stroke(); }
    }
    g.restore();
    g.textAlign = 'center';
    const f = this.flash && now - this.flash.t < 450 ? this.flash.text : null;
    if (f) {
      g.strokeStyle = '#6fdc4a'; g.lineWidth = 8; g.strokeRect(0, 0, W, H);
      g.font = '700 22px Galmuri11, monospace'; g.lineWidth = 5; g.strokeStyle = '#3f1d0b';
      g.strokeText(f, W / 2, H / 2); g.fillStyle = '#fff'; g.fillText(f, W / 2, H / 2);
    }
    const n = this.fresh.length;
    g.fillStyle = 'rgba(63,29,11,.75)'; g.fillRect(0, H - 24, W, 24);
    g.fillStyle = '#fff'; g.font = '700 13px Galmuri11, monospace';
    g.fillText(n ? this.label || `손 ${n}개 보임` : '손이 화면에 보이게 해 주세요 ✋', W / 2, H - 7);
  }
}
