import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { emptyReport, trailingIncome } from '../finance/finance';
import { createWorld, getClub } from '../generation/worldGenerator';
import { seasonTransferBudget, TRANSFER_BUDGET_INCOME_CAP } from './rollover';

/** Kulübün finans geçmişine `months` aylık, aylık geliri `monthly` olan kayıt ekler. */
function withIncome(clubId: string, months: number, monthly: number) {
  const world = createWorld(gameData, 91, 'galatasaray', '2026-07-01');
  const fin = world.finances[clubId]!;
  fin.history = Array.from({ length: months }, (_, i) => {
    const r = emptyReport(`2026-${String((i % 12) + 1).padStart(2, '0')}`);
    r.income.tv = monthly;
    return r;
  });
  return { world, fin, club: getClub(world, clubId) };
}

describe('trailingIncome', () => {
  it('son 12 ayın transfer dışı gelirini toplar; transfer satışı sayılmaz', () => {
    const { fin } = withIncome('fenerbahce', 14, 1_000_000);
    fin.history[13]!.income.transfersIn = 50_000_000;
    expect(trailingIncome(fin)).toBe(12_000_000);
    expect(trailingIncome(fin, 3)).toBe(3_000_000);
  });
});

describe('sezon transfer bütçesi (seasonTransferBudget)', () => {
  it('kasa fazlası yoksa temel bütçedir', () => {
    const { fin, club } = withIncome('fenerbahce', 12, 5_000_000);
    fin.balance = 0;
    expect(seasonTransferBudget(club, fin)).toBe(club.budget);
  });

  it('kasa fazlasının %30\'u eklenir; ama yıllık gelirin yarısını aşmaz', () => {
    const { fin, club } = withIncome('fenerbahce', 12, 1_000_000); // yıllık gelir 12 Mn €
    fin.balance = fin.wageBudget / 4 + 1_000_000_000; // devasa fazla
    const budget = seasonTransferBudget(club, fin);
    expect(budget).toBe(Math.max(club.budget, Math.round(12_000_000 * TRANSFER_BUDGET_INCOME_CAP)));
  });

  it('sınır, temel bütçenin altına inmez', () => {
    const { fin, club } = withIncome('fenerbahce', 12, 1); // neredeyse sıfır gelir
    fin.balance = fin.wageBudget / 4 + 10_000_000;
    expect(seasonTransferBudget(club, fin)).toBeGreaterThanOrEqual(club.budget);
    expect(seasonTransferBudget(club, fin)).toBe(club.budget);
  });

  it('küçük fazlada sınır devreye girmez: temel + %30', () => {
    const { fin, club } = withIncome('fenerbahce', 12, 50_000_000); // çok yüksek gelir → sınır geniş
    fin.balance = fin.wageBudget / 4 + 1_000_000;
    expect(seasonTransferBudget(club, fin)).toBe(Math.round(club.budget + 300_000));
  });
});
