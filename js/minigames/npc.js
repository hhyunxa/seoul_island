import { npcLook } from '../character.js';

// 미니게임 속 주민(팀원·상대·경주 참가자·관중) 생김새
// 서울섬처럼 사람과 동물 주민이 섞여 있음: 세 명 중 한 명꼴로 동물
const ANIMALS = [
  { type: 'bear', fur: '#9b6b43' }, { type: 'cat', fur: '#a7b0c2' }, { type: 'bunny', fur: '#ffffff' }, { type: 'dog', fur: '#f0d2a8' },
  { type: 'squirrel', fur: '#c98a4b' }, { type: 'sheep', fur: '#f3dfc8' }, { type: 'deer', fur: '#c4834f' },
];
let n = 0;
export function npcSkin(o = {}) {
  const i = n++;
  if (i % 3 === 2 && !o.human) return npcLook({ ...o, ...ANIMALS[(i / 3 | 0) % ANIMALS.length] });
  return npcLook(o);
}

export const HAIRS = ['#3b2416', '#6b4226', '#7a4a26', '#c98a46', '#5a3a2a', '#f2d38a'];
export const TONES = ['#ffdcbf', '#f6cba6', '#e8b48a', '#d9a273'];
