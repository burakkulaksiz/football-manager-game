import { HOME_NATION, type GameData } from '../data';
import type { GameDate } from '../date';
import { roundNice } from '../player';
import { Rng } from '../rng';
import type { Club, GameWorld, Player, Position } from '../types';
import { generateSeason } from '../league/schedule';
import { initFinances } from '../finance/finance';
import { defaultTactics } from '../match/tactics';
import { addNews } from '../news';
import { divisionOf, initialBoard } from '../season/expectation';
import { recordGrowth } from '../squad/growth';
import { refreshAiListings } from '../transfer/listing';
import { emptyScouting } from '../transfer/scouting';
import { DEFAULT_TRAINING } from '../squad/training';

/** Altyapı üretiminin ayrı rng'si için tohum tuzu. */
export const ACADEMY_SEED_SALT = 0xa11ce5;
import { generatePlayer } from './playerGenerator';

type Role = 'starter' | 'backup' | 'youth';

/**
 * Her kulübün 25 kişilik kadro şablonu.
 * starter = ilk 11 adayı, backup = yedek, youth = 17–19 yaş altyapı oyuncusu.
 */
export const SQUAD_TEMPLATE: ReadonlyArray<{ position: Position; role: Role }> = [
  { position: 'GK', role: 'starter' }, { position: 'GK', role: 'backup' }, { position: 'GK', role: 'youth' },
  { position: 'DR', role: 'starter' }, { position: 'DR', role: 'backup' },
  { position: 'DL', role: 'starter' }, { position: 'DL', role: 'backup' },
  { position: 'DC', role: 'starter' }, { position: 'DC', role: 'starter' },
  { position: 'DC', role: 'backup' }, { position: 'DC', role: 'youth' },
  { position: 'DM', role: 'starter' }, { position: 'DM', role: 'backup' },
  { position: 'MC', role: 'starter' }, { position: 'MC', role: 'starter' }, { position: 'MC', role: 'backup' },
  { position: 'MR', role: 'backup' }, { position: 'ML', role: 'backup' },
  { position: 'AMR', role: 'starter' }, { position: 'AML', role: 'starter' },
  { position: 'AMC', role: 'starter' }, { position: 'AMC', role: 'backup' },
  { position: 'ST', role: 'starter' }, { position: 'ST', role: 'backup' }, { position: 'ST', role: 'youth' },
];

/** Forma numarası tercihleri; doluysa boştaki ilk numara verilir. */
const PREFERRED_NUMBERS: Record<Position, number[]> = {
  GK: [1, 12, 23, 30], DR: [2, 22, 13], DL: [3, 33, 15], DC: [4, 5, 15, 24, 44], WBR: [2, 22],
  WBL: [3, 33], DM: [6, 16, 25], MR: [7, 17, 19], MC: [8, 14, 18, 20, 27], ML: [11, 21, 17],
  AMR: [7, 17, 77], AML: [11, 21, 19], AMC: [10, 20, 26], ST: [9, 19, 99, 29, 90],
};

/**
 * Kulüp itibarından (1–100) kadro seviyesi (1–20 ölçeği).
 * İtibar 92 (Galatasaray) → ~14,9; itibar 48 → ~11,4.
 */
export function clubBaseLevel(reputation: number): number {
  return 7.5 + (reputation / 100) * 8;
}

function ageForRole(rng: Rng, role: Role): number {
  if (role === 'youth') return rng.int(17, 19);
  if (role === 'starter') return Math.round(Math.max(20, Math.min(34, rng.normal(27, 3))));
  return Math.round(Math.max(18, Math.min(35, rng.normal(25, 4.5))));
}

function levelForRole(rng: Rng, base: number, role: Role): number {
  if (role === 'starter') return base + rng.normal(0, 0.8);
  if (role === 'backup') return base - 1.5 + rng.normal(0, 1);
  return base - 3 + rng.normal(0, 1);
}

/**
 * Yerli oyuncu olasılığı: büyük kulüplerin ilk 11'inde yabancı çok,
 * küçük kulüplerde ve altyapıda yerli ağırlıklı.
 */
function homeChance(role: Role, reputation: number): number {
  if (role === 'youth') return 0.95;
  if (role === 'backup') return 0.7;
  return 0.65 - (reputation / 100) * 0.25;
}

function pickNationality(rng: Rng, data: GameData, role: Role, reputation: number): string {
  if (rng.chance(homeChance(role, reputation))) return HOME_NATION;
  const foreign = data.nations.filter((n) => n.code !== HOME_NATION && n.weight > 0);
  return foreign[rng.weightedIndex(foreign.map((n) => n.weight))]!.code;
}

function assignSquadNumbers(squad: { player: Player; role: Role; position: Position }[]): void {
  const used = new Set<number>();
  const roleOrder: Role[] = ['starter', 'backup', 'youth'];
  for (const role of roleOrder) {
    for (const entry of squad.filter((e) => e.role === role)) {
      let number = PREFERRED_NUMBERS[entry.position].find((n) => !used.has(n));
      if (number === undefined) {
        // Gençler 40'tan, diğerleri 13'ten başlayan boş numaraları alır.
        number = role === 'youth' ? 40 : 13;
        while (used.has(number)) number++;
      }
      used.add(number);
      entry.player.squadNumber = number;
    }
  }
}

/** Ham maaşları, toplam kulüp maaş bütçesinin %85–95'ine denk gelecek şekilde ölçekler. */
function scaleWages(rng: Rng, club: Club, players: Player[]): void {
  const target = club.wageBudget * rng.float(0.85, 0.95);
  const rawTotal = players.reduce((sum, p) => sum + p.contract.wage, 0);
  const scale = target / rawTotal;
  for (const p of players) p.contract.wage = Math.max(12_000, roundNice(p.contract.wage * scale));
}

/**
 * Yeni bir oyun dünyası üretir: tüm kulüplerin kadroları dahil.
 * Aynı seed + aynı veri = birebir aynı dünya.
 */
export function createWorld(
  data: GameData,
  seed: number,
  playerClubId: string,
  startDate: GameDate,
  managerName = 'Menajer',
): GameWorld {
  if (!data.clubs.some((c) => c.id === playerClubId)) {
    throw new Error(`Bilinmeyen kulüp: ${playerClubId}`);
  }
  const rng = new Rng(seed);
  const players: Record<number, Player> = {};
  let nextId = 1;

  // Kulüpler kopyalanır ki oyun içi değişiklikler kaynak veriyi bozmasın.
  const clubs: Club[] = [
    ...data.clubs.map((c) => ({ ...c, colors: { ...c.colors }, division: 1 as const })),
    ...data.lowerClubs.map((c) => ({ ...c, colors: { ...c.colors }, division: 2 as const })),
  ];
  for (const club of clubs) {
    for (const player of generateClubSquad(rng, data, club, startDate, nextId)) {
      players[player.id] = player;
      nextId = Math.max(nextId, player.id + 1);
    }
  }

  const season = generateSeason(rng, data.clubs.map((c) => c.id), Number(startDate.slice(0, 4)));
  const userClub = clubs.find((c) => c.id === playerClubId)!;

  const world: GameWorld = {
    seed,
    rngState: rng.getState(),
    date: startDate,
    playerClubId,
    clubs,
    players,
    nextPlayerId: nextId,
    season,
    tactics: { [playerClubId]: defaultTactics(Object.values(players).filter((p) => p.clubId === playerClubId)) },
    training: { [playerClubId]: { ...DEFAULT_TRAINING } },
    finances: initFinances(clubs, startDate, players),
    offers: [],
    nextOfferId: 1,
    news: [],
    nextNewsId: 1,
    board: initialBoard(userClub),
    history: [],
    seasonState: 'running',
    gameOver: null,
    manager: { name: managerName.trim() || 'Menajer', joined: startDate, won: 0, drawn: 0, lost: 0, titles: 0 },
    youthWatch: [],
    requests: [],
    nextRequestId: 1,
    promises: [],
    scouting: emptyScouting(),
  };
  fillAcademies(world, data, new Rng((seed ^ ACADEMY_SEED_SALT) >>> 0));
  recordGrowth(world);
  refreshAiListings(world);
  addNews(world, {
    category: 'board',
    title: `${userClub.name} yönetiminden hoş geldin mesajı`,
    body:
      `Sayın ${world.manager.name}, yönetim kurulu olarak sizi kulübümüzde görmekten mutluluk duyuyoruz. Bu sezonki hedefimiz ligi ${world.board.targetPosition}. sırada ya da daha iyi bitirmek. ` +
      "Yaz transfer dönemi açık; kadroyu Transfer Merkezi'nden güçlendirebilir, taktiği ve antrenmanı ayarlayabilirsin. Başarılar!",
    important: false,
    clubId: playerClubId,
  });
  return world;
}

/** Bir kulübün şablona göre 25 kişilik kadrosu (id'ler firstId'den başlar). */
export function generateClubSquad(rng: Rng, data: GameData, club: Club, date: GameDate, firstId: number): Player[] {
  const base = clubBaseLevel(club.reputation);
  const wageFactor = 0.6 + club.reputation / 100;
  let id = firstId;
  const squad = SQUAD_TEMPLATE.map(({ position, role }) => {
    const player = generatePlayer(rng, data, id++, date, {
      position,
      level: levelForRole(rng, base, role),
      age: ageForRole(rng, role),
      nationality: pickNationality(rng, data, role, club.reputation),
      clubId: club.id,
      wageFactor,
      extraPotential: role === 'youth' ? rng.int(5, 30) : 0,
    });
    return { player, role, position };
  });
  assignSquadNumbers(squad);
  scaleWages(rng, club, squad.map((e) => e.player));
  return squad.map((e) => e.player);
}

/** Altyapı gencinin gerçek bir cevher (yüksek ek potansiyel) olma olasılığı. */
export const WONDERKID_CHANCE = 0.06;

/** Altyapıdan gelen genç oyuncu (varsayılan 16–17 yaş): düşük seviye, potansiyeli yaşla gelir; ara sıra cevher. */
export function generateYouthPlayer(
  rng: Rng,
  data: GameData,
  club: Club,
  date: GameDate,
  id: number,
  ages: readonly [number, number] = [16, 17],
): Player {
  const positions: Position[] = ['GK', 'DC', 'DR', 'DL', 'DM', 'MC', 'AMR', 'AML', 'AMC', 'ST'];
  const position = positions[rng.weightedIndex([1, 2, 1, 1, 1, 2, 1, 1, 1, 2])]!;
  const player = generatePlayer(rng, data, id, date, {
    position,
    level: clubBaseLevel(club.reputation) - 4.5 + rng.normal(0, 1),
    age: rng.int(ages[0], ages[1]),
    nationality: pickNationality(rng, data, 'youth', club.reputation),
    clubId: club.id,
    wageFactor: 0.6 + club.reputation / 100,
    // Gençlerin çoğu sıradan; arada bir gerçek cevher çıkar (yaşa bağlı büyüme payı zaten generatePotential'da)
    extraPotential: rng.chance(WONDERKID_CHANCE) ? rng.int(20, 45) : rng.int(-5, 18),
  });
  player.contract.wage = roundNice(Math.max(12_000, player.contract.wage * 0.4));
  return player;
}

/** Süper Lig'deki kulüpler. */
export function leagueClubs(world: GameWorld): Club[] {
  return world.clubs.filter((c) => divisionOf(c) === 1);
}

/** Bir kulübün A takım oyuncuları (altyapı / U19 hariç). */
export function clubPlayers(world: GameWorld, clubId: string): Player[] {
  return Object.values(world.players).filter((p) => p.clubId === clubId && !p.academy);
}

/** Başlangıçtaki altyapı kadrosu büyüklüğü (kulüp başına). */
export const INITIAL_ACADEMY_SIZE: readonly [number, number] = [7, 9];

/**
 * Her kulübe U19 kadrosu üretir (15–18 yaş). Ayrı bir rng ile: aynı tohumla ana dünya
 * (kadrolar, fikstür) altyapı eklenmeden önceki hâliyle birebir aynı kalır.
 */
export function fillAcademies(world: GameWorld, data: GameData, rng: Rng): void {
  for (const club of world.clubs) {
    const count = rng.int(INITIAL_ACADEMY_SIZE[0], INITIAL_ACADEMY_SIZE[1]);
    for (let i = 0; i < count; i++) {
      const youth = generateYouthPlayer(rng, data, club, world.date, world.nextPlayerId++, [15, 18]);
      youth.academy = true;
      youth.squadNumber = null;
      world.players[youth.id] = youth;
    }
  }
}

export function getClub(world: GameWorld, clubId: string): Club {
  const club = world.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error(`Bilinmeyen kulüp: ${clubId}`);
  return club;
}
