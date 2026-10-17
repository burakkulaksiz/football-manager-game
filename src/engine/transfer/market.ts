/**
 * Transfer piyasası: değerleme, oyuncu talepleri ve transferin gerçekleştirilmesi.
 */
import { makeDate, type GameDate } from '../date';
import { addExpense, addIncome, SALE_TO_BUDGET } from '../finance/finance';
import { clubPlayers, getClub } from '../generation/worldGenerator';
import { removePlayer } from '../match/tactics';
import { addNews } from '../news';
import { ageOn, baseWage, marketValue, primaryPosition, roundNice } from '../player';
import type { GameWorld, Player, Position } from '../types';

/** Sezonun bittiği yıl: Temmuz'dan itibaren bir sonraki yıl. */
export function seasonEndYear(date: GameDate): number {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 7 ? year + 1 : year;
}

/** `years` yıllık sözleşmenin bitişi: ilgili sezonun 30 Haziran'ı. */
export function contractExpiry(date: GameDate, years: number): GameDate {
  return makeDate(seasonEndYear(date) + years - 1, 6, 30);
}

/** Kulübün maaş ölçeği: gerçek maaşlar / CA'ya göre ham maaş. Büyük kulüp aynı oyuncuya daha çok öder. */
export function clubWageScale(world: GameWorld, clubId: string): number {
  let paid = 0;
  let raw = 0;
  for (const p of clubPlayers(world, clubId)) {
    paid += p.contract.wage;
    raw += baseWage(p.currentAbility);
  }
  return raw > 0 ? paid / raw : 1;
}

/** Oyuncunun o kulüpte "adil" yıllık maaşı. */
export function fairWage(world: GameWorld, player: Player, clubId: string): number {
  return baseWage(player.currentAbility) * clubWageScale(world, clubId);
}

/** Oyuncunun yıllık maaş talebi (transfer ya da sözleşme yenileme). */
export function wageDemand(world: GameWorld, player: Player, clubId: string): number {
  const renewal = player.clubId === clubId;
  const fair = fairWage(world, player, clubId);
  let demand = Math.max(fair, player.contract.wage * (renewal ? 1.05 : 1.1));
  // Gelişmekte olan genç yetenek kendini daha değerli görür
  const age = ageOn(player.birthDate, world.date);
  if (age < 23 && player.potentialAbility > player.currentAbility + 20) demand *= 1.1;
  return Math.max(12_000, roundNice(demand));
}

/** Yaşa göre istenen sözleşme süresi [en az, en çok]. */
export function preferredYears(age: number): [number, number] {
  if (age < 24) return [3, 5];
  if (age < 29) return [2, 4];
  if (age < 32) return [1, 3];
  return [1, 2];
}

/** Oyuncunun kulübündeki önemi: ilk 11 → 1, rotasyon → 0.5, diğer → 0. */
export function playerImportance(world: GameWorld, player: Player): number {
  if (!player.clubId) return 0;
  const rank = clubPlayers(world, player.clubId)
    .sort((a, b) => b.currentAbility - a.currentAbility)
    .findIndex((p) => p.id === player.id);
  return rank < 11 ? 1 : rank < 16 ? 0.5 : 0;
}

/** Kulübün satış için istediği bonservis. */
export function askingPrice(world: GameWorld, player: Player): number {
  let price = marketValue(player, world.date) * (1.15 + 0.35 * playerImportance(world, player));
  const yearsLeft = (Number(player.contract.expires.slice(0, 4)) - seasonEndYear(world.date)) + 1;
  if (yearsLeft <= 1) price *= 0.8;
  return roundNice(price);
}

/** Kiralık bedeli beklentisi. */
export function loanFeeAsk(world: GameWorld, player: Player): number {
  return roundNice(marketValue(player, world.date) * 0.08);
}

/** Oyuncu bu kulübe gelmeye istekli mi? Çok daha küçük bir kulübe genç oyuncu gitmek istemez. */
export function willingToJoin(world: GameWorld, player: Player, buyerId: string): boolean {
  if (!player.clubId) return true;
  const current = getClub(world, player.clubId).reputation;
  const buyer = getClub(world, buyerId).reputation;
  const age = ageOn(player.birthDate, world.date);
  return buyer >= current - (age >= 30 ? 30 : 20);
}

/** Mevki grubu (kadro ihtiyacı hesabı için). */
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';
export function groupOf(position: Position): PositionGroup {
  if (position === 'GK') return 'GK';
  if (['DR', 'DC', 'DL', 'WBR', 'WBL'].includes(position)) return 'DEF';
  if (['AMR', 'AMC', 'AML', 'ST'].includes(position)) return 'ATT';
  return 'MID';
}

const PREFERRED_NUMBER: Record<PositionGroup, number[]> = {
  GK: [1, 12, 23, 30, 35],
  DEF: [2, 3, 4, 5, 13, 15, 22, 24, 33, 44],
  MID: [6, 8, 14, 16, 18, 20, 25, 27],
  ATT: [7, 9, 10, 11, 17, 19, 77, 99],
};

function freeSquadNumber(world: GameWorld, player: Player, clubId: string): number {
  const used = new Set(clubPlayers(world, clubId).filter((p) => p.id !== player.id).map((p) => p.squadNumber));
  const preferred = PREFERRED_NUMBER[groupOf(primaryPosition(player))].find((n) => !used.has(n));
  if (preferred !== undefined) return preferred;
  let n = 2;
  while (used.has(n)) n++;
  return n;
}

export interface TransferTerms {
  wage: number;
  years: number;
  signingBonus: number;
}

/**
 * Bonservisli transferi gerçekleştirir: para, bütçeler, sözleşme, forma numarası, taktik ve haber.
 * Kontroller (bütçe, dönem) çağıran tarafta yapılır.
 */
export function transferPlayer(world: GameWorld, player: Player, buyerId: string, fee: number, terms: TransferTerms): void {
  const sellerId = player.clubId;
  const buyerFin = world.finances[buyerId]!;
  addExpense(buyerFin, 'transfersOut', fee);
  buyerFin.transferBudget = Math.max(0, buyerFin.transferBudget - fee - terms.signingBonus);
  if (terms.signingBonus > 0) addExpense(buyerFin, 'signingBonuses', terms.signingBonus);
  if (sellerId) {
    const sellerFin = world.finances[sellerId]!;
    addIncome(sellerFin, 'transfersIn', fee);
    sellerFin.transferBudget += fee * SALE_TO_BUDGET;
    detachFromClub(world, player, sellerId);
  }

  player.clubId = buyerId;
  player.loan = null;
  // Yeni kulüp, yeni heyecan
  player.morale = Math.max(player.morale, 72);
  player.contract = { wage: terms.wage, expires: contractExpiry(world.date, terms.years) };
  player.squadNumber = freeSquadNumber(world, player, buyerId);
  cancelOffersFor(world, player.id);

  const from = sellerId ? getClub(world, sellerId).name : 'serbest';
  const to = getClub(world, buyerId).name;
  const involvesUser = buyerId === world.playerClubId || sellerId === world.playerClubId;
  addNews(world, {
    category: 'transfer',
    title: `${player.firstName} ${player.lastName} ${to} yolunda`,
    body: `${to}, ${player.firstName} ${player.lastName} transferini tamamladı (${from} → ${to}). Bonservis: €${formatPlain(fee)}.`,
    important: involvesUser,
    playerId: player.id,
    clubId: buyerId,
  });
}

/** Kiralık: oyuncu sezon sonuna (30 Haziran) kadar kiralayan kulüpte oynar, maaşını o kulüp öder. */
export function loanPlayer(world: GameWorld, player: Player, toClubId: string, fee: number): void {
  const fromClubId = player.clubId!;
  addExpense(world.finances[toClubId]!, 'transfersOut', fee);
  world.finances[toClubId]!.transferBudget = Math.max(0, world.finances[toClubId]!.transferBudget - fee);
  addIncome(world.finances[fromClubId]!, 'transfersIn', fee);
  detachFromClub(world, player, fromClubId);

  player.clubId = toClubId;
  player.loan = { fromClubId, until: makeDate(seasonEndYear(world.date), 6, 30) };
  player.squadNumber = freeSquadNumber(world, player, toClubId);
  cancelOffersFor(world, player.id);

  const from = getClub(world, fromClubId).name;
  const to = getClub(world, toClubId).name;
  addNews(world, {
    category: 'loan',
    title: `${player.firstName} ${player.lastName} kiralandı`,
    body: `${to}, ${from} forması giyen ${player.firstName} ${player.lastName} oyuncusunu sezon sonuna kadar kiraladı.`,
    important: toClubId === world.playerClubId || fromClubId === world.playerClubId,
    playerId: player.id,
    clubId: toClubId,
  });
}

/** Kiralık süresi dolan oyuncular kulüplerine döner. */
export function returnLoans(world: GameWorld): void {
  for (const player of Object.values(world.players)) {
    if (!player.loan || player.loan.until > world.date) continue;
    const borrower = player.clubId!;
    const owner = player.loan.fromClubId;
    detachFromClub(world, player, borrower);
    player.clubId = owner;
    player.loan = null;
    player.squadNumber = freeSquadNumber(world, player, owner);
    addNews(world, {
      category: 'loan',
      title: `${player.firstName} ${player.lastName} kulübüne döndü`,
      body: `Kiralık süresi dolan ${player.firstName} ${player.lastName}, ${getClub(world, owner).name} kadrosuna geri döndü.`,
      important: borrower === world.playerClubId || owner === world.playerClubId,
      playerId: player.id,
      clubId: owner,
    });
  }
}

/** Oyuncu kulüpten ayrılırken: kullanıcının taktiğinden çıkar. */
function detachFromClub(world: GameWorld, player: Player, clubId: string): void {
  const tactics = world.tactics[clubId];
  if (!tactics) return;
  const next = removePlayer(tactics, player.id);
  const clear = (id: number | null) => (id === player.id ? null : id);
  world.tactics[clubId] = {
    ...next,
    captainId: clear(next.captainId),
    penaltyTakerId: clear(next.penaltyTakerId),
    freeKickTakerId: clear(next.freeKickTakerId),
  };
}

/** Transferi tamamlanan oyuncu için açık teklifleri kapatır. */
function cancelOffersFor(world: GameWorld, playerId: number): void {
  for (const o of world.offers) {
    if (o.playerId === playerId && (o.status === 'pending' || o.status === 'countered' || o.status === 'accepted')) {
      o.status = 'cancelled';
      o.note = 'Oyuncu başka bir kulübe gitti.';
    }
  }
}

/** Haber metni için sade para biçimi (UI biçimlendiricisi motorda yok). */
export function formatPlain(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} Mn`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} bin`;
  return String(Math.round(amount));
}
