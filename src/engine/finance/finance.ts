/**
 * Kulüp finansları.
 *
 * Gelirler maaş bütçesine oranlıdır (yayın %45, sponsor %30) ve bilet geliri seyirciye göre eklenir;
 * böylece tipik bir kulüp maaşlarını aşağı yukarı karşılar, transferler farkı belirler.
 * Ayın 1'inde: önceki ay kapanır, maaşlar ödenir, yayın ve sponsor geliri gelir.
 */
import type {
  Club,
  ClubFinance,
  ExpenseCategory,
  Fixture,
  GameWorld,
  IncomeCategory,
  MonthReport,
  Player,
} from '../types';
import type { GameDate } from '../date';

export const TV_SHARE = 0.45;
export const SPONSOR_SHARE = 0.3;
/** Galibiyet primi (maaş bütçesinin oranı); beraberlikte üçte biri. */
export const WIN_BONUS_SHARE = 0.003;
/** Satıştan gelen paranın transfer bütçesine eklenen kısmı. */
export const SALE_TO_BUDGET = 0.5;

const monthOf = (date: GameDate) => date.slice(0, 7);

export function emptyReport(month: string): MonthReport {
  return {
    month,
    income: { tickets: 0, tv: 0, sponsor: 0, transfersIn: 0, prize: 0 },
    expense: { wages: 0, bonuses: 0, transfersOut: 0, signingBonuses: 0, scouting: 0 },
    balanceEnd: 0,
  };
}

export function initFinance(club: Club, date: GameDate): ClubFinance {
  return {
    // Kasa: transfer bütçesi + üç aylık maaş kadar nakit
    balance: club.budget + club.wageBudget / 4,
    transferBudget: club.budget,
    wageBudget: club.wageBudget,
    tvIncome: Math.round(club.wageBudget * TV_SHARE),
    sponsorIncome: Math.round(club.wageBudget * SPONSOR_SHARE),
    ticketPrice: Math.round(8 + club.reputation * 0.3),
    current: emptyReport(monthOf(date)),
    history: [],
  };
}

export function addIncome(fin: ClubFinance, category: IncomeCategory, amount: number): void {
  const a = Math.round(amount);
  fin.balance += a;
  fin.current.income[category] += a;
}

export function addExpense(fin: ClubFinance, category: ExpenseCategory, amount: number): void {
  const a = Math.round(amount);
  fin.balance -= a;
  fin.current.expense[category] += a;
}

export function reportTotals(r: MonthReport): { income: number; expense: number; net: number } {
  const income = Object.values(r.income).reduce((a, b) => a + b, 0);
  const expense = Object.values(r.expense).reduce((a, b) => a + b, 0);
  return { income, expense, net: income - expense };
}

/** Kulübün oyuncularının yıllık maaş toplamı (kiralık gelenler dahil, kiralık gidenler hariç). */
export function totalWages(players: Iterable<Player>, clubId: string): number {
  let sum = 0;
  for (const p of players) if (p.clubId === clubId) sum += p.contract.wage;
  return sum;
}

/** Ay başı: ödemeler ve sabit gelirler. */
export function payMonthly(fin: ClubFinance, players: Iterable<Player>, clubId: string): void {
  addExpense(fin, 'wages', totalWages(players, clubId) / 12);
  addIncome(fin, 'tv', fin.tvIncome / 12);
  addIncome(fin, 'sponsor', fin.sponsorIncome / 12);
}

/** Ayın ilk günü çağrılır: geçen ayı kapatır, yeni ayın ödemelerini yapar. */
export function startNewMonth(world: GameWorld): void {
  const month = monthOf(world.date);
  for (const [clubId, fin] of Object.entries(world.finances)) {
    if (fin.current.month === month) continue;
    fin.current.balanceEnd = fin.balance;
    fin.history.push(fin.current);
    if (fin.history.length > 36) fin.history.shift();
    fin.current = emptyReport(month);
    payMonthly(fin, Object.values(world.players), clubId);
  }
}

/**
 * Taraftar kitlesi: itibarla üstel artar (itibar 92 → ~49 bin, 48 → ~9 bin).
 * Seyirci = min(kapasite, taraftar × rakibin çekiciliği).
 */
export function attendanceFor(home: Club, away: Club): number {
  const fans = 2000 + (home.reputation / 100) ** 3 * 60000;
  const draw = 0.8 + (away.reputation / 100) * 0.3;
  return Math.round(Math.min(home.capacity, fans * draw));
}

/** Maç sonrası: ev sahibine bilet geliri, kazanana (ve berabere kalanlara) prim gideri. */
export function processMatchFinances(world: GameWorld, fixture: Fixture): void {
  const result = fixture.result;
  if (!result) return;
  const home = world.clubs.find((c) => c.id === fixture.homeId)!;
  const away = world.clubs.find((c) => c.id === fixture.awayId)!;
  const attendance = attendanceFor(home, away);
  result.attendance = attendance;
  const homeFin = world.finances[home.id]!;
  addIncome(homeFin, 'tickets', attendance * homeFin.ticketPrice);

  const bonus = (clubId: string, share: number) => {
    const fin = world.finances[clubId]!;
    addExpense(fin, 'bonuses', fin.wageBudget * share);
  };
  if (result.homeGoals > result.awayGoals) bonus(home.id, WIN_BONUS_SHARE);
  else if (result.homeGoals < result.awayGoals) bonus(away.id, WIN_BONUS_SHARE);
  else {
    bonus(home.id, WIN_BONUS_SHARE / 3);
    bonus(away.id, WIN_BONUS_SHARE / 3);
  }
}

/** Tüm kulüplerin finansı; başlangıç ayının ödemeleri de yapılır. */
export function initFinances(clubs: readonly Club[], date: GameDate, players: Record<number, Player>): Record<string, ClubFinance> {
  const finances: Record<string, ClubFinance> = {};
  for (const club of clubs) {
    const fin = initFinance(club, date);
    payMonthly(fin, Object.values(players), club.id);
    finances[club.id] = fin;
  }
  return finances;
}
