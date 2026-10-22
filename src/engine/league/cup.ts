/**
 * Türkiye Kupası: Süper Lig ve 1. Lig kulüpleri, tek maçlı eleme. 32'ye tamamlanmayan katılımda itibarı en
 * yüksek Süper Lig kulüpleri 1. Turu bay geçer (26 kulüpte 6). Sonra Son 16, Çeyrek Final, Yarı Final ve
 * tarafsız sahada Final. Maçlar çarşamba; alt ligdeki takım evinde oynar; beraberlikte penaltı atışları.
 * 1. Turun kurası iki hafta önce, sonraki turlarınki önceki tur bitince çekilir.
 * Kupa durumu ayrıca saklanmaz: sezon fikstüründeki `competition: 'cup'` maçlarından türetilir.
 */
import { addIncome } from '../finance/finance';
import { addDays, formatDateTR, makeDate, weekday, type GameDate } from '../date';
import { getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { Rng } from '../rng';
import { divisionOf } from '../season/expectation';
import type { Fixture, GameWorld } from '../types';

export const CUP_NAME = 'Türkiye Kupası';

export interface CupRound {
  name: string;
  /** Planlanan tarih: bu günden sonraki ilk çarşamba (ay, gün; Temmuz öncesi ay sezonun ikinci yılında). */
  month: number;
  day: number;
  /** Turu geçen kulübe ödül (finalde şampiyona). */
  prize: number;
}

export const CUP_ROUNDS: readonly CupRound[] = [
  { name: '1. Tur', month: 9, day: 23, prize: 100_000 },
  { name: 'Son 16', month: 10, day: 28, prize: 250_000 },
  { name: 'Çeyrek Final', month: 1, day: 27, prize: 500_000 },
  { name: 'Yarı Final', month: 3, day: 3, prize: 1_000_000 },
  { name: 'Final', month: 5, day: 5, prize: 3_000_000 },
];

export const FINAL_ROUND = CUP_ROUNDS.length;
/** 1. Turun kurası maçtan kaç gün önce. */
const FIRST_DRAW_LEAD_DAYS = 14;
/** Kura ile maç arasında en az bu kadar gün. */
const MIN_DAYS_TO_MATCH = 3;
const CUP_SEED_SALT = 0x7c1f3a5d;
const WEDNESDAY = 3;

export function isCupFixture(f: Fixture): boolean {
  return f.competition === 'cup';
}

/** Lig maçları (puan durumu, lig istatistikleri, ödüller). */
export function leagueFixtures(fixtures: readonly Fixture[]): Fixture[] {
  return fixtures.filter((f) => !isCupFixture(f));
}

export function cupRoundName(round: number): string {
  return CUP_ROUNDS[round - 1]?.name ?? `${round}. Tur`;
}

/** "Süper Lig · 5. Hafta" / "Türkiye Kupası · Son 16". */
export function fixtureLabel(f: Fixture): string {
  return isCupFixture(f) ? `${CUP_NAME} · ${cupRoundName(f.round)}` : `Süper Lig · ${f.round}. Hafta`;
}

/** Turun planlanan tarihi: verilen günden sonraki ilk çarşamba. */
export function cupRoundDate(seasonYear: number, round: number): GameDate {
  const r = CUP_ROUNDS[round - 1]!;
  let date = makeDate(r.month >= 7 ? seasonYear : seasonYear + 1, r.month, r.day);
  while (weekday(date) !== WEDNESDAY) date = addDays(date, 1);
  return date;
}

export function cupFixtures(world: GameWorld, round?: number): Fixture[] {
  return world.season.fixtures.filter((f) => isCupFixture(f) && (round === undefined || f.round === round));
}

/** Oynanmış maçın kazananı (beraberlikte penaltılar); oynanmadıysa null. */
export function fixtureWinner(f: Fixture): string | null {
  const r = f.result;
  if (!r) return null;
  if (r.homeGoals !== r.awayGoals) return r.homeGoals > r.awayGoals ? f.homeId : f.awayId;
  if (r.penalties) return r.penalties.home > r.penalties.away ? f.homeId : f.awayId;
  return null;
}

/** Skor yazısı: "2 - 2 (P 4-3)". */
export function scoreLine(f: Fixture): string {
  const r = f.result;
  if (!r) return '—';
  return `${r.homeGoals} - ${r.awayGoals}${r.penalties ? ` (P ${r.penalties.home}-${r.penalties.away})` : ''}`;
}

/** Kupaya katılan kulüpler: Süper Lig ve 1. Lig. */
export function cupParticipants(world: GameWorld): string[] {
  return world.clubs.filter((c) => divisionOf(c) === 1 || divisionOf(c) === 2).map((c) => c.id);
}

/** Kupa şampiyonu (final oynandıysa). */
export function cupChampion(world: GameWorld): string | null {
  const final = cupFixtures(world, FINAL_ROUND)[0];
  return final ? fixtureWinner(final) : null;
}

/** Kulübün kupadaki durumu: en son oynadığı/oynayacağı tur, elendi mi. */
export function cupStatus(world: GameWorld, clubId: string): { round: number; eliminated: boolean; champion: boolean } | null {
  const own = cupFixtures(world).filter((f) => f.homeId === clubId || f.awayId === clubId).sort((a, b) => a.round - b.round);
  const last = own[own.length - 1];
  if (!last) return null;
  const winner = fixtureWinner(last);
  return { round: last.round, eliminated: winner !== null && winner !== clubId, champion: last.round === FINAL_ROUND && winner === clubId };
}

/** Kura tohumu: sezon ve tura göre sabit (oyunun ana rastgeleliğini değiştirmez). */
function drawRng(world: GameWorld, round: number): Rng {
  return new Rng((world.seed ^ CUP_SEED_SALT ^ Math.imul(world.season.year * 8 + round, 2654435761)) >>> 0);
}

/** Turun tarihi: planlanan, ama kuradan en az birkaç gün sonra (eski kayıtta sezon ortasında başlarsa). */
function matchDate(world: GameWorld, round: number): GameDate {
  let date = cupRoundDate(world.season.year, round);
  const earliest = addDays(world.date, MIN_DAYS_TO_MATCH);
  if (date < earliest) {
    date = earliest;
    while (weekday(date) !== WEDNESDAY) date = addDays(date, 1);
  }
  return date;
}

function drawRound(world: GameWorld, round: number, teams: string[]): void {
  const rng = drawRng(world, round);
  const order = rng.shuffle([...teams]);
  const date = matchDate(world, round);
  let nextId = world.season.fixtures.reduce((max, f) => Math.max(max, f.id), 0) + 1;
  const drawn: Fixture[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    const a = order[i]!;
    const b = order[i + 1]!;
    // Alt ligdeki takım evinde oynar (finalde ilk çekilen ev sahibi, saha tarafsız)
    const da = divisionOf(getClub(world, a));
    const db = divisionOf(getClub(world, b));
    const aHome = round === FINAL_ROUND ? true : da !== db ? da > db : rng.chance(0.5);
    drawn.push({ id: nextId++, round, date, homeId: aHome ? a : b, awayId: aHome ? b : a, result: null, competition: 'cup' });
  }
  world.season.fixtures.push(...drawn);

  const name = cupRoundName(round);
  const user = world.playerClubId;
  const ours = drawn.find((f) => f.homeId === user || f.awayId === user);
  const pairs = drawn.map((f) => `${getClub(world, f.homeId).name} – ${getClub(world, f.awayId).name}`).join(', ');
  const ourLine = ours
    ? `Rakibimiz ${getClub(world, ours.homeId === user ? ours.awayId : ours.homeId).name} ` +
      `(${round === FINAL_ROUND ? 'tarafsız saha' : ours.homeId === user ? 'iç saha' : 'deplasman'}, ${formatDateTR(date)}). `
    : '';
  addNews(world, {
    category: 'cup',
    title: ours ? `${CUP_NAME} ${name}: rakibimiz ${getClub(world, ours.homeId === user ? ours.awayId : ours.homeId).name}` : `${CUP_NAME} ${name} kurası çekildi`,
    body: `${CUP_NAME} ${name} kurası çekildi. ${ourLine}Eşleşmeler: ${pairs}.`,
    important: ours !== undefined,
    clubId: user,
  });
}

/**
 * Her gün: sıradaki turun kurası zamanı geldiyse çekilir (günde en fazla bir tur).
 * 1. Tur: katılımcı sayısı 16'yı aştığı kadar maç; itibarı en yüksek Süper Lig kulüpleri bay geçer.
 */
export function cupDay(world: GameWorld): void {
  if (world.seasonState !== 'running') return;
  for (let round = 1; round <= FINAL_ROUND; round++) {
    if (cupFixtures(world, round).length > 0) continue;
    if (round === 1) {
      if (world.date < addDays(cupRoundDate(world.season.year, 1), -FIRST_DRAW_LEAD_DAYS)) return;
      const teams = cupParticipants(world);
      const byes = Math.max(0, 32 - teams.length);
      const seeded = new Set(
        world.clubs.filter((c) => divisionOf(c) === 1).sort((a, b) => b.reputation - a.reputation).slice(0, byes).map((c) => c.id),
      );
      drawRound(world, 1, teams.filter((id) => !seeded.has(id)));
      return;
    }
    const previous = cupFixtures(world, round - 1);
    if (previous.some((f) => !f.result)) return;
    const winners = previous.map((f) => fixtureWinner(f)!);
    // 2. turda 1. Turu bay geçenler katılır
    const byes = round === 2 ? cupParticipants(world).filter((id) => !cupFixtures(world, 1).some((f) => f.homeId === id || f.awayId === id)) : [];
    drawRound(world, round, [...winners, ...byes]);
    return;
  }
}

/** Kupa maçından sonra: turu geçene ödül; kullanıcıya haber; şampiyonluk. */
export function cupAfterMatch(world: GameWorld, fixture: Fixture): void {
  const winner = fixtureWinner(fixture);
  if (!winner) return;
  const loser = winner === fixture.homeId ? fixture.awayId : fixture.homeId;
  const round = CUP_ROUNDS[fixture.round - 1]!;
  const fin = world.finances[winner];
  if (fin) addIncome(fin, 'prize', round.prize);
  const user = world.playerClubId;
  const winnerName = getClub(world, winner).name;
  const loserName = getClub(world, loser).name;

  if (fixture.round === FINAL_ROUND) {
    if (winner === user) {
      world.manager.cups = (world.manager.cups ?? 0) + 1;
      world.board.confidence = Math.min(100, world.board.confidence + 15);
    }
    addNews(world, {
      category: 'cup',
      title: `${winnerName} ${CUP_NAME}'nı kazandı!`,
      body: `${CUP_NAME} finalinde ${winnerName}, ${loserName} karşısında ${scoreLine(fixture)} ile kupayı kaldırdı.`,
      important: winner === user || loser === user,
      clubId: winner,
    });
    return;
  }
  if (winner !== user && loser !== user) return;
  if (loser === user && divisionOf(getClub(world, winner)) > divisionOf(getClub(world, user))) {
    // Alt lig takımına elenmek yönetimi kızdırır
    world.board.confidence = Math.max(0, world.board.confidence - 4);
  }
  addNews(world, {
    category: 'cup',
    title: winner === user ? `${CUP_NAME}: ${round.name} geçildi` : `${CUP_NAME}'na ${round.name} turunda veda`,
    body: winner === user
      ? `${loserName} karşısında ${scoreLine(fixture)} ile ${cupRoundName(fixture.round + 1)} turuna yükseldik.`
      : `${winnerName} karşısında ${scoreLine(fixture)} ile kupaya veda ettik.`,
    important: false,
    clubId: user,
  });
}
