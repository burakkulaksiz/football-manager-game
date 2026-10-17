/**
 * Fikstür üretimi: çift devreli lig.
 * 1. devre çember (circle) yöntemiyle, 2. devre 1. devrenin ev/deplasman ters aynası.
 */
import { addDays, makeDate, weekday, type GameDate } from '../date';
import type { Rng } from '../rng';
import type { Fixture, Season } from '../types';

type Pair = [string, string];

/**
 * Çember yöntemi: ilk takım sabit, diğerleri her turda bir adım döner.
 * n takım (çift) → n-1 tur, her turda n/2 eşleşme. Ev/deplasman burada belirlenmez.
 */
export function circlePairings(teams: readonly string[]): Pair[][] {
  const n = teams.length;
  if (n < 2 || n % 2 !== 0) throw new Error('Takım sayısı çift olmalı');
  const order = [...teams];
  const rounds: Pair[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Pair[] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([order[i]!, order[n - 1 - i]!]);
    rounds.push(pairs);
    order.splice(1, 0, order.pop()!);
  }
  return rounds;
}

/**
 * Ev/deplasman ataması (açgözlü): arka arkaya deplasmanda olan takım evinde oynasın.
 * Seri: +k = k maçtır evinde, -k = k maçtır deplasmanda.
 * Eşitlikte toplam iç saha maçı az olan evinde oynar.
 */
function assignVenues(rounds: Pair[][]): Pair[][] {
  const streak = new Map<string, number>();
  const homeCount = new Map<string, number>();
  const record = (team: string, home: boolean) => {
    const s = streak.get(team) ?? 0;
    streak.set(team, home ? (s > 0 ? s + 1 : 1) : s < 0 ? s - 1 : -1);
    if (home) homeCount.set(team, (homeCount.get(team) ?? 0) + 1);
  };

  return rounds.map((pairs) =>
    pairs.map(([a, b]) => {
      const sa = streak.get(a) ?? 0;
      const sb = streak.get(b) ?? 0;
      const aHome = sa !== sb ? sa < sb : (homeCount.get(a) ?? 0) <= (homeCount.get(b) ?? 0);
      const pair: Pair = aHome ? [a, b] : [b, a];
      record(pair[0], true);
      record(pair[1], false);
      return pair;
    }),
  );
}

/** Lig maçı oynanmayan cumartesiler: milli maç araları ve kış arası. */
export function isBreakWeekend(date: GameDate): boolean {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month === 9 && day <= 7) return true; // Eylül'ün ilk haftası
  if ((month === 10 || month === 11) && day >= 8 && day <= 14) return true; // Ekim/Kasım 2. hafta
  if (month === 3 && day >= 25) return true; // Mart'ın son haftası
  if ((month === 12 && day >= 24) || (month === 1 && day <= 15)) return true; // kış arası
  return false;
}

/** Sezonun hafta tarihleri: Ağustos'un 8'inden sonraki ilk cumartesiden başlar, aralar atlanır. */
export function seasonMatchDates(year: number, rounds: number): GameDate[] {
  let date = makeDate(year, 8, 8);
  while (weekday(date) !== 6) date = addDays(date, 1);
  const dates: GameDate[] = [];
  while (dates.length < rounds) {
    if (!isBreakWeekend(date)) dates.push(date);
    date = addDays(date, 7);
  }
  return dates;
}

export function generateSeason(rng: Rng, clubIds: readonly string[], year: number): Season {
  const teams = rng.shuffle([...clubIds]);
  const firstHalf = assignVenues(circlePairings(teams));
  const secondHalf = firstHalf.map((pairs) => pairs.map(([h, a]): Pair => [a, h]));
  const allRounds = [...firstHalf, ...secondHalf];
  const dates = seasonMatchDates(year, allRounds.length);

  const fixtures: Fixture[] = [];
  allRounds.forEach((pairs, r) => {
    for (const [homeId, awayId] of pairs) {
      fixtures.push({
        id: fixtures.length + 1,
        round: r + 1,
        date: dates[r]!,
        homeId,
        awayId,
        result: null,
      });
    }
  });
  return { year, fixtures };
}

/** 2026 → "2026/27" */
export function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}
