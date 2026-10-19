import { FruitGame } from './fruit.js';
import { FishingGame } from './fishing.js';
import { ChickenGame } from './chicken.js';
import { BugGame } from './bugs.js';
import { RunnerGame } from './runner.js';
import { SoccerGame } from './soccer.js';
import { DuckBoatGame } from './duckboat.js';
import { LockGame } from './locks.js';
import { CatchBallGame } from './catchball.js';
import { FeedGame } from './feed.js';
import { KartGame } from './kart.js';
import { KaraokeGame } from './karaoke.js';
import { GuideGame } from './guide.js';
import { ParadeGame } from './parade.js';
import { FlightGame } from './flight.js';
import { FashionGame } from './fashion.js';
import { ClawGame } from './claw.js';
import { HomerunGame } from './homerun.js';
import { ConductorGame } from './conductor.js';
import { KpopGame } from './kpop.js';
import { FactoryGame } from './factory.js';
import { GardenGame } from './garden.js';
import { StairsGame } from './stairs.js';

// 새 미니게임은 여기에 등록하고, world.js에 입구(interactable kind:'minigame', game:id)를 추가하면 됩니다.
export const GAMES = { fruit: FruitGame, fish: FishingGame, chicken: ChickenGame, bug: BugGame, runner: RunnerGame, soccer: SoccerGame, duckboat: DuckBoatGame, locks: LockGame, catchball: CatchBallGame, feed: FeedGame, kart: KartGame, karaoke: KaraokeGame, guide: GuideGame, parade: ParadeGame, flight: FlightGame, fashion: FashionGame, claw: ClawGame, homerun: HomerunGame, conductor: ConductorGame, kpop: KpopGame, factory: FactoryGame, garden: GardenGame, stairs: StairsGame };
