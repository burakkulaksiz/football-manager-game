import { HOME_NATION, type GameData } from '../data';
import type { GameDate } from '../date';
import { roundNice } from '../player';
import { Rng } from '../rng';
import type { Club, GameWorld, Player, Position } from '../types';
import { generateSeason } from '../league/schedule';
import { defaultTactics } from '../match/tactics';
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
): GameWorld {
  if (!data.clubs.some((c) => c.id === playerClubId)) {
    throw new Error(`Bilinmeyen kulüp: ${playerClubId}`);
  }
  const rng = new Rng(seed);
  const players: Record<number, Player> = {};
  let nextId = 1;

  for (const club of data.clubs) {
    const base = clubBaseLevel(club.reputation);
    const wageFactor = 0.6 + club.reputation / 100;
    const squad = SQUAD_TEMPLATE.map(({ position, role }) => {
      const player = generatePlayer(rng, data, nextId++, startDate, {
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
    for (const { player } of squad) players[player.id] = player;
  }

  const season = generateSeason(rng, data.clubs.map((c) => c.id), Number(startDate.slice(0, 4)));

  return {
    seed,
    rngState: rng.getState(),
    date: startDate,
    playerClubId,
    // Kulüpler kopyalanır ki oyun içi değişiklikler kaynak veriyi bozmasın.
    clubs: data.clubs.map((c) => ({ ...c, colors: { ...c.colors } })),
    players,
    nextPlayerId: nextId,
    season,
    tactics: { [playerClubId]: defaultTactics(Object.values(players).filter((p) => p.clubId === playerClubId)) },
  };
}

/** Bir kulübün oyuncuları. */
export function clubPlayers(world: GameWorld, clubId: string): Player[] {
  return Object.values(world.players).filter((p) => p.clubId === clubId);
}

export function getClub(world: GameWorld, clubId: string): Club {
  const club = world.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error(`Bilinmeyen kulüp: ${clubId}`);
  return club;
}
