import { HOME_NATION, type GameData, type SquadData, type SquadPlayerData } from '../data';
import { addDays, makeDate, type GameDate } from '../date';
import { ageOn, baseWage, computeCurrentAbility, primaryPosition, roundNice } from '../player';
import { Rng } from '../rng';
import type { Club, GameWorld, Player, Position } from '../types';
import { generateSeason } from '../league/schedule';
import { generateLowerLeague } from '../league/lowerLeague';
import { initFinances } from '../finance/finance';
import { defaultTactics } from '../match/tactics';
import { addNews } from '../news';
import { divisionOf, initialBoard } from '../season/expectation';
import { recordGrowth } from '../squad/growth';
import { refreshAiListings } from '../transfer/listing';
import { emptyScouting } from '../transfer/scouting';
import { AGENT_SEED_SALT, generateAgents } from '../transfer/agents';
import { DEFAULT_TRAINING } from '../squad/training';
import { addForeignClubs, FOREIGN_SEED_SALT } from './foreign';
import { createInternational, emptyInternational } from '../league/international';
import { MANAGER_BACKGROUNDS, type ManagerBackground } from '../season/manager';
import { initFacilities } from '../finance/facilities';

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

function pickNationality(rng: Rng, data: GameData, role: Role, reputation: number, country?: string): string {
  if (country === undefined) {
    if (rng.chance(homeChance(role, reputation))) return HOME_NATION;
    const foreign = data.nations.filter((n) => n.code !== HOME_NATION && n.weight > 0);
    return foreign[rng.weightedIndex(foreign.map((n) => n.weight))]!.code;
  }
  // Yurtdışı kulübü: büyükleri daha çok yabancı oynatır. Yabancılar her ülkeden (Türkler az).
  const home = role === 'youth' ? 0.85 : role === 'backup' ? 0.6 : Math.max(0.3, 0.55 - (reputation - 90) / 100);
  if (rng.chance(home)) return country;
  const pool = data.nations.filter((n) => n.code !== country);
  return pool[rng.weightedIndex(pool.map((n) => (n.code === HOME_NATION ? 1 : n.weight || 3)))]!.code;
}

/** Forma numaraları; önceden verilmiş olanlar (gerçek kadro) korunur, U19'a numara verilmez. */
function assignSquadNumbers(squad: { player: Player; role: Role; position: Position }[]): void {
  const used = new Set(squad.flatMap((e) => (e.player.squadNumber !== null ? [e.player.squadNumber] : [])));
  const roleOrder: Role[] = ['starter', 'backup', 'youth'];
  for (const role of roleOrder) {
    for (const entry of squad.filter((e) => e.role === role && e.player.squadNumber === null && !e.player.academy)) {
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
function scaleWages(rng: Rng, club: Club, players: Player[], reserved = 0): void {
  // reserved: maaşı dosyada yazan oyuncuların toplamı (bütçenin geri kalanı diğerlerine dağıtılır)
  const target = Math.max(club.wageBudget * 0.2, club.wageBudget * rng.float(0.85, 0.95) - reserved);
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
  background: ManagerBackground = 'player',
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
    manager: {
      name: managerName.trim() || 'Menajer', joined: startDate, won: 0, drawn: 0, lost: 0, titles: 0,
      background, reputation: MANAGER_BACKGROUNDS[background].reputation,
      reputationHistory: [{ month: startDate.slice(0, 7), value: MANAGER_BACKGROUNDS[background].reputation }], seasons: [],
    },
    youthWatch: [],
    requests: [],
    nextRequestId: 1,
    promises: [],
    scouting: emptyScouting(),
    agents: generateAgents(new Rng((seed ^ AGENT_SEED_SALT) >>> 0), data),
    international: emptyInternational(),
    facilities: { levels: {}, projects: [], rejected: {} },
  };
  fillAcademies(world, data, new Rng((seed ^ ACADEMY_SEED_SALT) >>> 0));
  addForeignClubs(world, data, new Rng((seed ^ FOREIGN_SEED_SALT) >>> 0));
  const lower = generateLowerLeague(world, season.year);
  if (lower) world.season.lower = lower;
  recordGrowth(world);
  refreshAiListings(world);
  createInternational(world, data, startDate);
  world.facilities = initFacilities(world);
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
  const real = data.squads[club.id];
  if (real) return realClubSquad(rng, data, club, date, firstId, real);
  const base = clubBaseLevel(club.reputation);
  const wageFactor = 0.6 + club.reputation / 100;
  let id = firstId;
  const squad = SQUAD_TEMPLATE.map(({ position, role }) => {
    const player = generatePlayer(rng, data, id++, date, {
      position,
      level: role === 'youth' ? base - YOUTH_LEVEL_GAP + rng.normal(0, 1) : levelForRole(rng, base, role),
      age: ageForRole(rng, role),
      nationality: pickNationality(rng, data, role, club.reputation, club.country),
      clubId: club.id,
      wageFactor,
      // Gençler, her yaz katılan gençlerle (generateYouthPlayer) aynı modelle: önceden seviye − 3 ve sabit +5…+30 ek potansiyel
      // alıyordu; başlangıçtaki yurtdışı gençlerinin PA ortalaması 168 (yıllık alımda 145) çıkıyor, ilk yıllarda elit katman
      // %35 şişiyordu (denge raporu). Tek çekilişle: rastgelelik akışının uzunluğu değişmez.
      extraPotential: role === 'youth' ? youthExtraPotential(rng.float(0, 1)) : 0,
    });
    return { player, role, position };
  });
  assignSquadNumbers(squad);
  scaleWages(rng, club, squad.map((e) => e.player));
  return squad.map((e) => e.player);
}

/** Bir güç (seviye) puanının yetenek (CA) karşılığı: özellik ortalaması 1 puan artınca CA ~10,5 artar. */
const CA_PER_LEVEL = 199 / 19;

const templateGroup = (p: Position) =>
  p === 'GK' ? 'GK' : ['DR', 'DC', 'DL', 'WBR', 'WBL'].includes(p) ? 'DEF' : ['AMR', 'AMC', 'AML', 'ST'].includes(p) ? 'ATT' : 'MID';

/** Dosyadaki gerçek oyuncu: üretilen oyuncunun üzerine dosyada yazanlar. */
function realPlayer(rng: Rng, data: GameData, club: Club, date: GameDate, id: number, d: SquadPlayerData, wageFactor: number): Player {
  const affinity = Array.isArray(d.positions) ? null : d.positions;
  const listed = Array.isArray(d.positions) ? d.positions : (Object.keys(d.positions) as Position[]);
  const primary = affinity ? listed.reduce((best, p) => (affinity[p]! > affinity[best]! ? p : best)) : listed[0]!;
  const birthDate = typeof d.born === 'number' ? addDays(makeDate(d.born, 1, 1), rng.int(0, 364)) : d.born;
  const player = generatePlayer(rng, data, id, date, {
    position: primary,
    level: d.ability,
    age: Math.max(15, ageOn(birthDate, date)),
    nationality: d.nationality,
    clubId: club.id,
    wageFactor,
  });
  player.firstName = d.firstName;
  player.lastName = d.lastName;
  player.birthDate = birthDate;
  // Tek mevki yazılmışsa üretilen yakın mevkiler kalır; birden çoksa hepsi doğal
  if (affinity) player.positions = { ...affinity };
  else if (listed.length > 1) player.positions = Object.fromEntries(listed.map((p, i) => [p, i === 0 ? 20 : 18]));
  if (d.foot) player.foot = d.foot;
  Object.assign(player.attributes, d.attributes ?? {});
  Object.assign(player.hidden, d.hidden ?? {});
  player.currentAbility = computeCurrentAbility(player.attributes, primaryPosition(player));
  player.potentialAbility = d.potential !== undefined
    ? Math.min(200, Math.max(player.currentAbility, Math.round(player.currentAbility + (d.potential - d.ability) * CA_PER_LEVEL)))
    : Math.max(player.potentialAbility, player.currentAbility);
  player.contract.wage = d.wage ?? baseWage(player.currentAbility) * wageFactor;
  if (d.contractExpires !== undefined) {
    // Sözleşmeler oyunda 30 Haziran'da biter: başka bir gün yazılmışsa sonraki 30 Haziran
    const raw = typeof d.contractExpires === 'number' ? makeDate(d.contractExpires, 6, 30) : d.contractExpires;
    const year = Number(raw.slice(0, 4));
    const expires = raw.slice(5) <= '06-30' ? makeDate(year, 6, 30) : makeDate(year + 1, 6, 30);
    if (expires > date) player.contract.expires = expires;
  }
  player.squadNumber = d.number ?? null;
  // Oyun başladıktan sonraki bir katılış (yaz transferi) oyun başı sayılır
  if (d.joined) player.joined = d.joined < date ? d.joined : date;
  return player;
}

/**
 * Gerçek kadro (data/squads/<kulüpId>.json). Türkiye kulübünde 18 yaş ve altı, kulübün seviyesinin çok altındaki
 * gençler U19'a gider. A takım 25 kişiden azsa şablonun eksik mevki gruplarından rastgele oyuncularla tamamlanır.
 */
function realClubSquad(rng: Rng, data: GameData, club: Club, date: GameDate, firstId: number, squad: SquadData): Player[] {
  const base = clubBaseLevel(club.reputation);
  const wageFactor = 0.6 + club.reputation / 100;
  let id = firstId;
  let reserved = 0;
  const fixedWage = new Set<Player>();
  const entries: { player: Player; role: Role; position: Position }[] = squad.players.map((d) => {
    const player = realPlayer(rng, data, club, date, id++, d, wageFactor);
    if (d.wage !== undefined) {
      fixedWage.add(player);
      reserved += d.wage;
    }
    if (club.country === undefined && ageOn(player.birthDate, date) <= 18 && d.ability < base - 3) {
      player.academy = true;
      player.squadNumber = null;
    }
    const role: Role = d.ability >= base - 0.75 ? 'starter' : 'backup';
    return { player, role, position: primaryPosition(player) };
  });

  // Eksik mevki grupları (şablona göre), zayıf rollerden başlayarak; hâlâ 25'e varmadıysa yedek / genç rolleri
  const have: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const need: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const e of entries) if (!e.player.academy) have[templateGroup(e.position)]!++;
  for (const t of SQUAD_TEMPLATE) need[templateGroup(t.position)]!++;
  const byRole = (['youth', 'backup', 'starter'] as Role[]).flatMap((r) => SQUAD_TEMPLATE.filter((t) => t.role === r));
  let count = entries.filter((e) => !e.player.academy).length;
  const fill = (t: { position: Position; role: Role }) => {
    const player = generatePlayer(rng, data, id++, date, {
      position: t.position,
      level: levelForRole(rng, base, t.role),
      age: ageForRole(rng, t.role),
      nationality: pickNationality(rng, data, t.role, club.reputation, club.country),
      clubId: club.id,
      wageFactor,
      extraPotential: t.role === 'youth' ? rng.int(5, 30) : 0,
    });
    entries.push({ player, role: t.role, position: t.position });
    count++;
  };
  for (const t of byRole) {
    if (count >= SQUAD_TEMPLATE.length) break;
    const g = templateGroup(t.position);
    if (have[g]! < need[g]!) {
      fill(t);
      have[g]!++;
    }
  }
  for (let i = 0; count < SQUAD_TEMPLATE.length; i++) {
    const t = byRole[i % byRole.length]!;
    fill(t.role === 'starter' ? { ...t, role: 'backup' } : t);
  }

  assignSquadNumbers(entries);
  scaleWages(rng, club, entries.map((e) => e.player).filter((p) => !fixedWage.has(p) && !p.academy), reserved);
  for (const e of entries) if (e.player.academy) e.player.contract.wage = roundNice(Math.max(12_000, e.player.contract.wage * 0.4));
  return entries.map((e) => e.player);
}

/** Altyapı gencinin gerçek bir cevher (yüksek ek potansiyel) olma olasılığı. */
export const WONDERKID_CHANCE = 0.06;
/** Altyapıdan gelen gencin seviyesi, kulübün temel seviyesinin bu kadar altında (generateYouthPlayer ve kadro şablonundaki gençler). */
export const YOUTH_LEVEL_GAP = 4.5;

/**
 * Gencin ek potansiyeli, [0, 1) aralığındaki tek bir sayıdan: WONDERKID_CHANCE olasılıkla cevher (+20…+45), yoksa −5…+18.
 * generateYouthPlayer'daki dağılımın aynısı; tek çekilişle (kadro şablonunda rastgelelik akışının uzunluğu değişmesin diye).
 */
export function youthExtraPotential(u: number): number {
  if (u < WONDERKID_CHANCE) return 20 + Math.min(25, Math.floor((u / WONDERKID_CHANCE) * 26));
  return -5 + Math.min(23, Math.floor(((u - WONDERKID_CHANCE) / (1 - WONDERKID_CHANCE)) * 24));
}

/** Altyapıdan gelen genç oyuncu (varsayılan 16–17 yaş): düşük seviye, potansiyeli yaşla gelir; ara sıra cevher. */
export function generateYouthPlayer(
  rng: Rng,
  data: GameData,
  club: Club,
  date: GameDate,
  id: number,
  ages: readonly [number, number] = [16, 17],
  /** Altyapı tesisinin payı (bkz. youthFacilityBonus); yoksa etkisiz. */
  bonus: { level: number; potential: number; wonderkid: number } = { level: 0, potential: 0, wonderkid: 1 },
): Player {
  const positions: Position[] = ['GK', 'DC', 'DR', 'DL', 'DM', 'MC', 'AMR', 'AML', 'AMC', 'ST'];
  const position = positions[rng.weightedIndex([1, 2, 1, 1, 1, 2, 1, 1, 1, 2])]!;
  const player = generatePlayer(rng, data, id, date, {
    position,
    level: clubBaseLevel(club.reputation) - YOUTH_LEVEL_GAP + bonus.level + rng.normal(0, 1),
    age: rng.int(ages[0], ages[1]),
    nationality: pickNationality(rng, data, 'youth', club.reputation, club.country),
    clubId: club.id,
    wageFactor: 0.6 + club.reputation / 100,
    // Gençlerin çoğu sıradan; arada bir gerçek cevher çıkar (yaşa bağlı büyüme payı zaten generatePotential'da)
    extraPotential: (rng.chance(WONDERKID_CHANCE * bonus.wonderkid) ? rng.int(20, 45) : rng.int(-5, 18)) + bonus.potential,
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
    if (club.country !== undefined) continue; // yurtdışı kulüplerinin U19'u yok
    // Gerçek kadrodan U19'a inen gençler sayıya dahil
    const existing = Object.values(world.players).filter((p) => p.clubId === club.id && p.academy).length;
    const count = Math.max(0, rng.int(INITIAL_ACADEMY_SIZE[0], INITIAL_ACADEMY_SIZE[1]) - existing);
    for (let i = 0; i < count; i++) {
      const youth = generateYouthPlayer(rng, data, club, world.date, world.nextPlayerId++, [15, 18]);
      youth.academy = true;
      youth.squadNumber = null;
      world.players[youth.id] = youth;
    }
  }
}

/**
 * id → kulüp önbelleği. Kulüp listesi yalnızca büyür (yeni lig verisi, kayıt dönüşümü); uzunluk değişince
 * yeniden kurulur. Transfer döngüleri binlerce oyuncu için kulüp aradığından doğrusal arama pahalıydı.
 */
const clubIndex = new WeakMap<Club[], { size: number; byId: Map<string, Club> }>();

export function getClub(world: GameWorld, clubId: string): Club {
  let index = clubIndex.get(world.clubs);
  if (!index || index.size !== world.clubs.length) {
    index = { size: world.clubs.length, byId: new Map(world.clubs.map((c) => [c.id, c])) };
    clubIndex.set(world.clubs, index);
  }
  const club = index.byId.get(clubId);
  if (!club) throw new Error(`Bilinmeyen kulüp: ${clubId}`);
  return club;
}
