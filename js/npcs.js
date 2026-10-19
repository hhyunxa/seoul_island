import * as THREE from 'three';
import { Avatar, npcLook } from './character.js';

// ============================================================
//  서울섬 주민: 미니게임마다 놀이를 준비해 둔 주민이 입구 옆에 서 있어요
//  말을 걸면 몇 마디 하고 "할래?"라고 물어봐요 (main.js의 대화창 선택지)
//  tag: 이름표 색 (원래 서울섬 대화창처럼)
// ============================================================
const L = (type, fur, shirt, extra = {}) => npcLook({ type, fur, shirt, accent: extra.accent, pants: extra.pants || fur, hair: extra.hair, skin: extra.skin });
export const HOSTS = {
  fruit: { name: '도토리', tag: '#E08E1F', look: L('squirrel', '#c98a4b', '#7fcb98', { accent: '#f6e2c4' }), lines: ['경동시장 과일 가게에 온 걸 환영해요!\n오늘은 하늘에서 과일이 우수수 떨어지는 날이에요.', '바구니로 받아 주면 벨로 쳐 줄게요. 돌멩이는 조심!'] },
  fish: { name: '첨벙', tag: '#2F7FB8', look: L('bear', '#8a5a3c', '#ffc93c', { accent: '#e2c49a', pants: '#3e5c8a' }), lines: ['여긴 노량진 앞 한강 낚시 명당이야첨벙~', '찌가 쏙 들어가면 바로 당겨!\n큰 물고기는 멀리 던져야 잘 잡혀첨벙.'] },
  chicken: { name: '꼬순이', tag: '#C9703E', look: L('dog', '#f0d2a8', '#ff9f43', { accent: '#9a6a43' }), lines: ['큰일이다멍! 암사동 선사 마을 닭들이 또 탈출했다멍!', '닭 뒤로 돌아가서 닭장 쪽으로 살살 몰아 줘멍.'] },
  bug: { name: '솜이', tag: '#3C8DC0', look: L('sheep', '#f3dfc8', '#8fd3ff', { accent: '#ffffff' }), lines: ['음냐… 노들섬 텃밭에 벌레가 자꾸 나와음매~', '무당벌레는 착한 벌레니까 때리면 안 돼음매.'] },
  runner: { name: '모카', tag: '#D9708B', look: L('bunny', '#ffffff', '#ff9eb5', { accent: '#ffd6e0' }), lines: ['여의도 한강공원 달리기 코스다깡총!', '공중에서 한 번 더 뛸 수 있어깡총.\n갈매기는 뛰지 말고 그냥 지나가!'] },
  soccer: { name: '골키', tag: '#3A6FC0', look: L('cat', '#a7b0c2', '#3a7bd5', { accent: '#ffffff', pants: '#ffffff' }), lines: ['월드컵경기장에서 3:3 축구 한 판 어때냥?', '공 가까이 가면 저절로 드리블한다냥. E는 패스, Space는 슛!'] },
  duckboat: { name: '곰돌', tag: '#A86F1F', look: L('bear', '#9b6b43', '#ffd166', { accent: '#e6c8a0' }), lines: ['어흠! 헤엄은 못 쳐도 오리배는 탄다곰!', '페달을 열심히 밟아서 1등으로 들어오는 거다곰!'] },
  locks: { name: '하늘', tag: '#E0628A', look: L('bunny', '#f6e6ef', '#ffb7c8', { accent: '#ffd6e0' }), lines: ['남산서울타워 사랑의 자물쇠 울타리야깡총.', '카드랑 똑같은 자물쇠를 찾아 줘!\n색·모양·고리가 다 같아야 해깡총.'] },
  catchball: { name: '피융', tag: '#4E8A35', look: L('deer', '#c4834f', '#6ab04c', { accent: '#f6e6cf' }), lines: ['고척스카이돔에서 캐치볼 연습 중이야사슴.', '공 그림자를 잘 보면 어디로 올지 알 수 있어사슴.'] },
  feed: { name: '사육사 누리', tag: '#5E9E4E', look: npcLook({ shirt: '#9ed39a', pants: '#8a6b45', hair: '#3b2416', skin: '#f6cba6' }), lines: ['어린이대공원 먹이 판매대예요!\n동물 친구들이 배고프대요.', '코끼리는 바나나, 펭귄은 물고기, 기린은 풀, 사자는 고기!\n원숭이가 먹이를 훔쳐 가면 쫓아 주세요.'] },
  kart: { name: '부릉', tag: '#C9403F', look: L('dog', '#f0d2a8', '#e94b4b', { accent: '#9a6a43' }), lines: ['도봉운전면허시험장 카트 코스에 온 걸 환영한다멍!', '노란 화살표를 밟으면 부스터다멍. 커브에선 드리프트!'] },
  karaoke: { name: '레미', tag: '#9B5DE5', look: L('cat', '#ffffff', '#c3a6ff', { accent: '#ffd6e0' }), lines: ['홍대 코인노래방에 왔다냥! 한 곡 뽑고 가라냥~', '내려오는 노트에 맞춰 D F J K를 누르면 노래가 된다냥.'] },
  guide: { name: '안내원 별이', tag: '#E8A33B', look: npcLook({ shirt: '#ffd166', pants: '#4a6fa5', hair: '#6b4226', skin: '#ffdcbf' }), lines: ['명동 관광안내소예요! 오늘따라 길 묻는 여행자가 많네요.', '여행자가 찾는 곳이 명동에서 어느 쪽인지 알려 주세요.\n모르겠으면 M으로 지도를 볼 수 있어요.'] },
  parade: { name: '삼바', tag: '#2FA88A', look: L('squirrel', '#e8a868', '#3fd0b0', { accent: '#fff0d8' }), lines: ['이태원 지구촌 축제 퍼레이드에 어서 와요!', '대장이 보여 주는 동작을 잘 외웠다가 내 차례에 똑같이!'] },
  flight: { name: '기장 하늘', tag: '#2F6FD8', look: npcLook({ shirt: '#ffffff', pants: '#2f3f6a', hair: '#3b2416', skin: '#f6cba6' }), lines: ['DS1017편 기장입니다. 김포에서 제주까지 함께 날아 볼까요?', '새 떼랑 먹구름을 피해서 무사히 도착하면\n"즐거운 여행되세요!"'] },
  fashion: { name: '찰칵', tag: '#E86A8E', look: L('cat', '#3b3b44', '#ff8fa3', { accent: '#ffffff' }), lines: ['성수동 카페거리 스트리트 스냅 촬영 중이다냥!', '위에 나온 옷차림을 한 사람을 찾아서 찰칵! 해 달라냥.'] },
  claw: { name: '탕탕', tag: '#3A6FC0', look: L('cat', '#a7b0c2', '#3a7bd5', { accent: '#ffffff' }), lines: ['홍대 인형뽑기 한 판 어때냥?', '인형 가운데를 노려야 잘 잡힌다냥!\n황금 해치를 뽑으면 대박이다냥.'] },
  homerun: { name: '홈런', tag: '#D9483B', look: L('bear', '#6b4a33', '#ff6b6b', { accent: '#d9b48a', pants: '#fff8ec' }), lines: ['잠실야구장 홈런 더비다곰! 공 10개 중에 몇 개나 넘길까곰?', '공이 홈 플레이트에 오는 순간 딱! 휘두르는 거다곰.'] },
  conductor: { name: '마에스트로 양', tag: '#6E5F96', look: L('sheep', '#ffffff', '#3a3150', { accent: '#ffffff', pants: '#3a3150' }), lines: ['예술의전당 오늘 밤 공연 지휘자가 감기에 걸렸음매…', '대신 지휘해 줄래음매? 내가 지휘하는 만큼만 음악이 나와음매.'] },
  kpop: { name: '연습생 유나', tag: '#FF6EC7', look: npcLook({ shirt: '#ff9ed8', pants: '#3a3150', hair: '#e8e2f0', skin: '#ffdcbf' }), lines: ['강남역 무대에서 K-팝 포즈 챌린지 중이에요!', '센터랑 똑같은 포즈를 빨리 잡을수록 PERFECT!\nS등급이면 데뷔 확정이에요.'] },
  factory: { name: '공장장 철이', tag: '#5B6470', look: L('bear', '#b0b8c4', '#ffd166', { accent: '#e6eaef', pants: '#4a6fa5' }), lines: ['가산디지털단지 로봇 공장이다곰. 일손이 모자라곰!', '벨트로 오는 부품을 같은 색 상자에 넣어 주곰.\n다섯 개마다 로봇이 하나 완성된다곰.'] },
  garden: { name: '새싹', tag: '#5FAE5F', look: L('bunny', '#f0e2c8', '#a6e3a0', { accent: '#ffd6e0' }), lines: ['서울식물원 화분에 물 줄 시간이다깡총.', '화분마다 필요한 물이 달라깡총.\n초록 칸에서 멈추면 꽃이 핀다깡총!'] },
  stairs: { name: '계단왕 두식', tag: '#C9A23B', look: L('squirrel', '#a8743f', '#ffd166', { accent: '#f6e2c4' }), lines: ['63빌딩 엘리베이터가 고장 났어요! 계단으로 올라가 볼래요?', '다음 계단이 반대쪽이면 방향 바꾸기! 63층까지 가면 전망대예요.'] },
};

class Villager {
  constructor(world, def, x, z, face) {
    this.def = def; this.x = x; this.z = z;
    this.av = new Avatar(def.look, { height: 1.5 });
    this.av.root.position.set(x, 0, z);
    this.av.root.rotation.y = face;
    this.face = face; this.ph = Math.random() * 6;
    world.scene.add(this.av.root);
    world.addCollider({ type: 'c', x, z, r: 0.45 });
  }
  update(dt, t, p) {
    const near = p && Math.hypot(p.x - this.x, p.z - this.z) < 6;
    const yaw = near ? Math.atan2(p.x - this.x, p.z - this.z) : this.face;
    const close = p && Math.hypot(p.x - this.x, p.z - this.z) < 3;
    this.av.animate(dt, t + this.ph, { yaw, wave: close && Math.sin(t * 0.9 + this.ph) > 0.55 });
  }
}

export function buildVillagers(world) {
  for (const it of world.interactables) {
    if (it.kind !== 'minigame') continue;
    const def = HOSTS[it.game];
    if (!def) continue;
    // 입구 옆 걸을 수 있는 자리 (돌아오는 자리·입구 바로 앞은 피함)
    let spot = null;
    for (const rad of [1.7, 2.2, 2.7, 1.3, 3.2]) {
      for (let i = 0; i < 12 && !spot; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.3, x = it.x + Math.cos(a) * rad, z = it.z + Math.sin(a) * rad;
        if (!world.canWalk(x, z, 0.55)) continue;
        if (it.ret && Math.hypot(x - it.ret[0], z - it.ret[1]) < 1.1) continue;
        spot = [x, z];
      }
      if (spot) break;
    }
    if (!spot) { console.warn('주민 자리를 못 찾음', it.game); continue; }
    const face = Math.atan2(it.x - spot[0], it.z - spot[1]);
    const v = new Villager(world, def, spot[0], spot[1], face);
    world.villagers.push(v);
    it.host = def;
    it.title = it.label;
    it.label = `${def.name}에게 말 걸기 · ${it.title}`;
  }
}
