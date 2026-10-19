// 아주 작은 8비트 효과음 (외부 파일 없이 WebAudio로 생성)
let ac = null;
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, dur = 0.1, type = 'square', vol = 0.08, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export const sfx = {
  unlock: () => ctx(),
  click: () => tone(660, 0.05, 'square', 0.05),
  jump: () => tone(300, 0.15, 'square', 0.05, 400),
  step: () => tone(120 + Math.random() * 30, 0.04, 'triangle', 0.04),
  talk: () => tone(500 + Math.random() * 200, 0.03, 'square', 0.025),
  open: () => { tone(523, 0.08); tone(784, 0.12, 'square', 0.08, 0, 0.08); },
  catch: (combo = 0) => tone(600 + Math.min(combo, 12) * 40, 0.08, 'square', 0.07, 300),
  gold: () => { tone(880, 0.08); tone(1175, 0.08, 'square', 0.08, 0, 0.07); tone(1568, 0.14, 'square', 0.08, 0, 0.14); },
  miss: () => tone(200, 0.12, 'triangle', 0.06, -80),
  hurt: () => tone(160, 0.25, 'sawtooth', 0.09, -100),
  tick: () => tone(440, 0.1, 'square', 0.06),
  go: () => tone(880, 0.25, 'square', 0.07),
  end: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'square', 0.07, 0, i * 0.1)); },
  coin: () => { tone(988, 0.06); tone(1319, 0.15, 'square', 0.07, 0, 0.06); },
  // 리듬게임용: 원하는 음 (주파수 Hz, 길이 초)
  note: (freq, dur = 0.25, type = 'square', vol = 0.06) => tone(freq, dur, type, vol),
  drum: (kind = 'kick') => kind === 'kick' ? tone(110, 0.08, 'triangle', 0.09, -60) : tone(1800 + Math.random() * 400, 0.03, 'square', 0.02),
};
