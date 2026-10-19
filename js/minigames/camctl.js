import { HandInput } from '../hands.js';
import { sfx } from '../sfx.js';

const $ = (id) => document.getElementById(id);
const hands = new HandInput(); // 카메라는 하나만 (게임끼리 같이 씀)

// ============================================================
//  미니게임 공통 "✋ 손으로 하기" 켜기/끄기
//  - 게임 build()에서 this.camCtl = new CamControl(this, { hint, onEvent }) 만들면
//    base.js가 시작할 때 버튼·미리보기를 붙이고, 카메라 준비될 때까지 카운트다운을 멈추고, 나갈 때 끔
//  - 게임은 this.camCtl.on 일 때 this.camCtl.hands(HandInput)에서 손 위치·모양을 읽음
// ============================================================
export class CamControl {
  constructor(game, { hint = '', onEvent = null } = {}) {
    this.game = game; this.hint = hint; this.onEvent = onEvent;
    this.key = `dotseoul.cam.${game.meta.id}`;
    try { this.on = localStorage.getItem(this.key) === '1'; } catch { this.on = false; }
    this.pending = false; this.err = null;
  }
  get hands() { return hands; }
  // 시작할 때 고르는 창에 쓰는 정보 (base.chooseControl)
  get choice() { return { label: '✋ 손으로 하기', desc: '웹캠에 손만 비추면 돼요', how: this.hint.replace(/^✋+\s*/, ''), on: this.on, set: (on) => this.save(on) }; }

  // base.start()가 오버레이를 비운 뒤 부름
  mount() {
    const o = $('miniOverlay');
    const btn = document.createElement('button'); btn.className = 'btn parade-cam-btn';
    btn.textContent = this.on ? '⌨️ 키보드로 하기' : '✋ 손으로 하기';
    btn.title = this.on ? '카메라를 끄고 키보드·마우스로 해요' : '웹캠에 손을 비춰서 조종해요 (영상은 내 컴퓨터 밖으로 나가지 않아요)';
    btn.onclick = () => { sfx.click(); btn.blur(); this.set(!this.on); };
    o.appendChild(btn);
    if (this.err) {
      const e = document.createElement('div'); e.className = 'parade-cam-err'; e.textContent = this.err; o.appendChild(e);
      this.err = null; setTimeout(() => e.remove(), 4000);
    }
    if (!this.on) { hands.stop(); return; }
    o.appendChild(hands.canvas);
    hands.label = '';
    hands.onEvent = (type, h) => { if (this.on && this.game.state === 'play') this.onEvent?.(type, h); };
    if (this.hint) $('miniHint').textContent = this.hint;
    if (hands.running) return;
    this.pending = true; this.left = false;
    hands.start().then(() => {
      this.pending = false;
      if (this.left) hands.stop();
    }).catch((e) => {
      this.pending = false;
      this.err = e?.name === 'NotAllowedError' ? '카메라를 허용하지 않아서 키보드로 할게요' : `카메라를 켜지 못했어요 (${e?.message || e})`;
      if (this.left) this.save(false); else this.set(false);
    });
  }
  save(on) { this.on = on; try { localStorage.setItem(this.key, on ? '1' : '0'); } catch { /* 저장 못 해도 이번 판은 그대로 */ } }
  // 켜고 끄면 처음부터 다시
  set(on) { this.save(on); this.game.restart(); }
  stop() { this.left = true; hands.stop(); }
}
