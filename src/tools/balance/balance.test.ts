import { describe, expect, it } from 'vitest';
import { buildReport } from './metrics';
import { renderMarkdown, sameConfig } from './report';
import { judge, mean, median, seMean, seProportion, slope, spearman } from './stats';
import type { ClubSeason, MatchRow, RawData, SeasonSnapshot } from './types';

describe('istatistik yardımcıları', () => {
  it('ortalama, medyan, standart hata', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(seMean([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(0.756, 2);
    expect(seProportion(0.5, 100)).toBeCloseTo(0.05, 5);
  });

  it('eğim: doğrusal artışta tam eğim, sabitte sıfır', () => {
    expect(slope([1, 3, 5, 7])).toBeCloseTo(2, 10);
    expect(slope([4, 4, 4])).toBe(0);
    expect(slope([1])).toBeNaN();
  });

  it('Spearman: aynı sıra 1, ters sıra −1, eşitlikler ortalama sırayla', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
    expect(spearman([1, 1, 2, 2], [1, 2, 3, 4])).toBeGreaterThan(0.8);
    expect(spearman([1, 2], [1, 2])).toBeNaN();
  });

  it('judge: aralıkta ok; dışında ama güven aralığı değiyorsa belirsiz; uzaksa hedef dışı; hedef yoksa bilgi', () => {
    expect(judge(2.6, [2.45, 2.75], 0.01)).toBe('ok');
    expect(judge(2.8, [2.45, 2.75], 0.05)).toBe('uncertain'); // 2.8 − 1.96×0.05 = 2.70 < 2.75
    expect(judge(2.9, [2.45, 2.75], 0.01)).toBe('off');
    expect(judge(2.9, null, 0.01)).toBe('info');
    expect(judge(NaN, [1, 2])).toBe('info');
    // Standart hata bilinmiyorsa (tek örnek) yalnızca nokta değerine bakılır
    expect(judge(3, [1, 2], NaN)).toBe('off');
  });
});

/** Sentetik veri: 4 kulüplü minik bir lig, tutarlı maç ve güç değerleriyle. */
function match(hg: number, ag: number, overrides: Partial<MatchRow> = {}): MatchRow {
  return { homeId: 'a', awayId: 'b', homeGoals: hg, awayGoals: ag, shots: 24, shotsOnTarget: 9, corners: 10, fouls: 24, yellows: 4, reds: 0, penaltyGoals: 0, ...overrides };
}

function club(id: string, position: number, strength: number, balance = 5e7): ClubSeason {
  return {
    clubId: id, position, points: 80 - position * 15, goalsFor: 50, goalsAgainst: 40, strength, balance,
    wageBudget: 4e7, income12: 8e7, transferSpend12: 1e7, transferIncome12: 5e6, wages12: 4e7, otherExpense12: 5e6, prize12: 2e6,
  };
}

function season(career: number, year: number, over: Partial<SeasonSnapshot> = {}): SeasonSnapshot {
  return {
    career, year, userClubId: 'a', userPosition: 2, userTarget: 4, championId: 'a',
    matches: [match(2, 1), match(1, 1), match(0, 2), match(3, 1)],
    clubs: [club('a', 1, 120), club('b', 2, 110), club('c', 3, 100), club('d', 4, 90)],
    topScorerGoals: 24, topAssists: 12,
    transfers: { count: 10, fee: 1e8, maxFee: 3e7, free: 5, loans: 3 },
    europe: [{ comp: 'cl', turkishClubs: 2, turkishKnockout: 1, turkishFinalists: 0, turkishWinner: false }],
    pool: { squadMean: 26, squadMin: 22, freeAgents: 100 + (year - 2026) * 10, academy: 300, total: 2500 },
    cohort: { size: 100, alive: 95, meanCA: 120 + (year - 2026), meanAge: 26 + (year - 2026) },
    talent: { eliteMeanCA: 120 + (year - 2026), maxCA: 170, over150: 12, meanAge: 26, caByAge: { u22: 100, mid: 130, o29: 120 } },
    ...over,
  };
}

function raw(count = 5): RawData {
  const careers = Array.from({ length: count }, (_, c) => c).map((c) => ({ career: c, seed: 9000 + c, userClubId: 'a', seasons: [season(c, 2026), season(c, 2027), season(c, 2028)], sacks: [] }));
  return { config: { careers: count, seasons: 3, baseSeed: 9000, clubs: ['a', 'b'] }, careers, elapsedSec: 12 };
}

describe('denge ölçüleri', () => {
  const report = buildReport(raw(), '2026-10-25T10:00:00.000Z');
  const byId = (id: string) => report.metrics.find((m) => m.id === id)!;

  it('maç ölçülerini ham maçlardan hesaplar', () => {
    // maçlar: 3, 2, 2, 4 gol → 2.75
    expect(byId('goals').value).toBeCloseTo(2.75, 5);
    expect(byId('homeWin').value).toBeCloseTo(50, 5); // 2-1 ve 3-1
    expect(byId('draw').value).toBeCloseTo(25, 5);
    expect(byId('awayWin').value).toBeCloseTo(25, 5);
    expect(byId('highScoring').value).toBeCloseTo(25, 5); // yalnızca 3-1
    expect(byId('goals').n).toBe(60); // 5 kariyer × 3 sezon × 4 maç
  });

  it('sezon ölçüleri: şampiyon puanı, güç korelasyonu, en güçlü takımın şampiyonluğu', () => {
    expect(byId('champPoints').value).toBe(65);
    expect(byId('strengthCorr').value).toBeCloseTo(1, 5);
    expect(byId('strongestWins').value).toBe(100);
    expect(byId('distinctChamps').value).toBeCloseTo(1 / 15, 5); // tek şampiyon, 15 sezon
  });

  it('ekonomi ve yetenek: kasa, transfer hacmi, eğim', () => {
    expect(byId('negativeBalance').value).toBe(0);
    expect(byId('transferVolume').value).toBeCloseTo(100, 5); // 1e8 → 100 Mn
    expect(byId('wageShare').value).toBeCloseTo(0.5, 5);
    expect(byId('eliteSlope').value).toBeCloseTo(1, 5); // her sezon +1 CA
    expect(byId('eliteSlope').status).toBe('off'); // sınır ±0,8
  });

  it('çok az gözlemle "hedef dışı" denmez, yalnızca "belirsiz" denir', () => {
    const small = buildReport(raw(2));
    const slopeOfSmall = small.metrics.find((m) => m.id === 'eliteSlope')!;
    expect(slopeOfSmall.n).toBe(2);
    expect(slopeOfSmall.status).toBe('uncertain');
  });

  it('oran ölçülerinin standart hatası %0 ya da %100 olsa bile sıfır olmaz', () => {
    expect(byId('strongestWins').value).toBe(100);
    expect(byId('strongestWins').se).toBeGreaterThan(0);
  });

  it('Avrupa ve yönetim ölçüleri', () => {
    expect(byId('clKnockout').value).toBeCloseTo(50, 5);
    expect(byId('targetMet').value).toBe(100);
    expect(byId('sackedSeasons').value).toBe(0);
    expect(byId('sackedCareers').value).toBe(0);
  });

  it('eğilim tablosu sezon sayısı kadar sütun içerir', () => {
    const goals = report.trends.find((t) => t.id === 'goals')!;
    expect(goals.values).toHaveLength(3);
    expect(report.trends.find((t) => t.id === 'elite')!.values).toEqual([120, 121, 122]);
  });
});

describe('Markdown raporu', () => {
  const current = buildReport(raw(), '2026-10-25T10:00:00.000Z');

  it('özet, yapılacaklar ve gruplar yer alır; hedef dışı ölçü ayar ipucuyla listelenir', () => {
    const md = renderMarkdown(current);
    expect(md).toContain('# Denge Raporu');
    expect(md).toContain('## Yapılacaklar');
    expect(md).toContain('## Maç (Süper Lig)');
    expect(md).toContain('## Eğilimler');
    expect(md).toMatch(/❌ \*\*İlk 11 ortalama CA eğimi\*\*.*bak: src\/engine\/squad\/development\.ts/);
  });

  it('önceki koşu varsa fark sütunu ve gürültü işareti gelir', () => {
    const changed = raw();
    for (const c of changed.careers) for (const s of c.seasons) s.topScorerGoals = 30;
    const previous = buildReport(changed, '2026-10-24T10:00:00.000Z');
    const md = renderMarkdown(current, previous);
    expect(md).toContain('| Fark |');
    expect(md).toContain('aynı ayarlar');
    // Gol kralı 30 → 24: ölçülebilir değişiklik (kalın), sabit ölçü: 0 fark
    expect(md).toMatch(/Gol kralının golü.*\*\*-6\.00\*\*/);
  });

  it('farklı ayarlarla çalışmış önceki koşu kıyaslanamaz diye uyarılır', () => {
    const other = raw();
    other.config.seasons = 7;
    const md = renderMarkdown(current, buildReport(other));
    expect(sameConfig(current, buildReport(other))).toBe(false);
    expect(md).toContain('farklı ayarlarla');
  });

  it('boş veriyle çökmez', () => {
    const empty: RawData = { config: { careers: 0, seasons: 0, baseSeed: 1, clubs: [] }, careers: [], elapsedSec: 0 };
    expect(() => renderMarkdown(buildReport(empty))).not.toThrow();
  });
});
