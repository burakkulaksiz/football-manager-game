import { beforeAll, describe, expect, it } from 'vitest';
import { leagueFixtures } from '../league/cup';
import { gameData } from '../../gameData';
import { playSeason } from '../testing';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import type { MatchResult } from '../types';
import { buildResult, createMatch, simulateToEnd, stepMatch, substitute, type MatchSetup } from './engine';
import { autoSelectLineup, DEFAULT_FORMATION } from './formation';
import { MAX_SUBS } from './state';

const START = '2026-07-01';
const world = createWorld(gameData, 42, 'galatasaray', START);

function setup(homeId: string, awayId: string, seed: number, userHome = false): MatchSetup {
  const team = (id: string, user: boolean) => ({
    clubId: id,
    name: getClub(world, id).name,
    lineup: autoSelectLineup(clubPlayers(world, id)),
    userControlled: user,
  });
  return { fixtureId: 1, home: team(homeId, userHome), away: team(awayId, false), seed };
}

function play(homeId: string, awayId: string, seed: number): MatchResult {
  const state = createMatch(setup(homeId, awayId, seed), world.players);
  simulateToEnd(state, world.players);
  return buildResult(state);
}

describe('kadro seçimi', () => {
  it('diziliş kadar ilk 11, bir yedek kaleci, en fazla 9 yedek', () => {
    const lineup = autoSelectLineup(clubPlayers(world, 'trabzonspor'));
    expect(lineup.starters).toHaveLength(11);
    expect(lineup.starters.map((s) => s.slot)).toEqual([...DEFAULT_FORMATION]);
    expect(world.players[lineup.starters[0]!.playerId]!.positions.GK).toBe(20);
    expect(lineup.bench.length).toBeLessThanOrEqual(9);
    expect(lineup.bench.some((id) => world.players[id]!.positions.GK !== undefined)).toBe(true);
  });
});

describe('tek maç', () => {
  it('aynı seed ile birebir aynı maç', () => {
    expect(play('fenerbahce', 'besiktas', 7)).toEqual(play('fenerbahce', 'besiktas', 7));
  });

  it('maç sonucu kendi içinde tutarlı', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = createMatch(setup('trabzonspor', 'konyaspor', seed), world.players);
      simulateToEnd(state, world.players);
      const r = buildResult(state);
      expect(state.period).toBe('full');
      expect(r.goals).toHaveLength(r.homeGoals + r.awayGoals);
      expect(r.stats.home.possession + r.stats.away.possession).toBe(100);
      expect(r.stats.home.shotsOnTarget).toBeLessThanOrEqual(r.stats.home.shots);
      expect(state.home.subsUsed).toBeLessThanOrEqual(MAX_SUBS);
      expect(state.away.subsUsed).toBeLessThanOrEqual(MAX_SUBS);
      for (const p of r.players) {
        expect(p.rating).toBeGreaterThanOrEqual(1);
        expect(p.rating).toBeLessThanOrEqual(10);
      }
      // Olaylar zaman sırasında
      const order = state.events.map((e) => (e.minute <= 45 && state.events.indexOf(e) < state.events.findIndex((x) => x.type === 'secondhalf') ? 0 : 1) * 1000 + e.minute + e.extra / 100);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });

  it('kullanıcı değişikliği: geçerli olan yapılır, kural dışı olan reddedilir', () => {
    const state = createMatch(setup('galatasaray', 'goztepe', 3, true), world.players);
    for (let i = 0; i < 30; i++) stepMatch(state, world.players);
    const out = state.home.onPitch[5]!;
    const incoming = state.home.bench[1]!;
    expect(substitute(state, world.players, 'home', out, incoming)).toBe(true);
    expect(state.home.onPitch).toContain(incoming);
    expect(state.home.onPitch).not.toContain(out);
    // Çıkan oyuncu geri giremez, yedekte olmayan giremez.
    expect(substitute(state, world.players, 'home', incoming, out)).toBe(false);
    // En fazla 5 değişiklik
    let made = 1;
    for (const benchId of [...state.home.bench]) {
      const target = state.home.onPitch.find((id) => state.players[id]!.slot !== 'GK')!;
      if (substitute(state, world.players, 'home', target, benchId)) made++;
    }
    expect(made).toBe(MAX_SUBS);
  });
});

describe('istatistik doğrulama (binlerce maç)', () => {
  // 10 sezon × 306 lig maçı ≈ 3060 maç (kupa ve Avrupa maçları hariç: Süper Lig dengesi). Daha büyük örnekli ölçüm: npm run balance.
  // Simülasyon beforeAll'da: describe gövdesinde çalışınca süresi raporda görünmüyor, Vitest bu en uzun dosyayı en sona bırakıyordu.
  const SEASONS = 10;
  const s = { goals: 0, homeWin: 0, draw: 0, shots: 0, onTarget: 0, corners: 0, yellows: 0, reds: 0, kingAvg: 0, kings: [] as number[] };

  beforeAll(() => {
    const seasons = Array.from({ length: SEASONS }, (_, i) => {
      const w = createWorld(gameData, 500 + i, 'galatasaray', START);
      playSeason(w);
      return leagueFixtures(w.season.fixtures).map((f) => f.result!);
    });
    const results = seasons.flat();
    // Her sezonun gol kralının gol sayısı
    s.kings = seasons.map((season) => {
      const goals = new Map<number, number>();
      for (const r of season) for (const g of r.goals) goals.set(g.playerId, (goals.get(g.playerId) ?? 0) + 1);
      return Math.max(...goals.values());
    });
    s.kingAvg = s.kings.reduce((sum, k) => sum + k, 0) / s.kings.length;
    const avg = (fn: (r: MatchResult) => number) => results.reduce((sum, r) => sum + fn(r), 0) / results.length;
    s.goals = avg((r) => r.homeGoals + r.awayGoals);
    s.homeWin = avg((r) => (r.homeGoals > r.awayGoals ? 1 : 0));
    s.draw = avg((r) => (r.homeGoals === r.awayGoals ? 1 : 0));
    s.shots = avg((r) => r.stats.home.shots + r.stats.away.shots) / 2;
    s.onTarget = avg((r) => r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget) / 2;
    s.corners = avg((r) => r.stats.home.corners + r.stats.away.corners) / 2;
    s.yellows = avg((r) => r.cards.filter((c) => c.type === 'yellow').length);
    s.reds = avg((r) => r.cards.filter((c) => c.type === 'red').length);
  }, 600_000);

  it('maç başına ~2.6 gol', () => {
    expect(s.goals, `ölçülen ${s.goals.toFixed(3)}`).toBeGreaterThan(2.45);
    expect(s.goals, `ölçülen ${s.goals.toFixed(3)}`).toBeLessThan(2.75);
  });

  it('ev sahibi galibiyeti ~%45', () => {
    expect(s.homeWin, `ölçülen %${(s.homeWin * 100).toFixed(1)}`).toBeGreaterThan(0.41);
    expect(s.homeWin, `ölçülen %${(s.homeWin * 100).toFixed(1)}`).toBeLessThan(0.49);
  });

  it('beraberlik ~%27', () => {
    expect(s.draw, `ölçülen %${(s.draw * 100).toFixed(1)}`).toBeGreaterThan(0.24);
    expect(s.draw, `ölçülen %${(s.draw * 100).toFixed(1)}`).toBeLessThan(0.3);
  });

  it('takım başına şut, isabetli şut ve korner makul aralıkta', () => {
    expect(s.shots, `şut ${s.shots.toFixed(1)}`).toBeGreaterThan(9);
    expect(s.shots, `şut ${s.shots.toFixed(1)}`).toBeLessThan(16);
    expect(s.onTarget, `isabetli ${s.onTarget.toFixed(1)}`).toBeGreaterThan(3);
    expect(s.onTarget, `isabetli ${s.onTarget.toFixed(1)}`).toBeLessThan(6.5);
    expect(s.corners, `korner ${s.corners.toFixed(1)}`).toBeGreaterThan(3.5);
    expect(s.corners, `korner ${s.corners.toFixed(1)}`).toBeLessThan(7);
  });

  it('maç başına sarı ve kırmızı kart makul', () => {
    expect(s.yellows, `sarı ${s.yellows.toFixed(2)}`).toBeGreaterThan(2.5);
    expect(s.yellows, `sarı ${s.yellows.toFixed(2)}`).toBeLessThan(6);
    expect(s.reds, `kırmızı ${s.reds.toFixed(3)}`).toBeLessThan(0.3);
  });

  it('gol kralı ~24 gol', () => {
    // Süper Lig'de son yıllarda gol kralı 22–30 gol (38 hafta); bizde 34 hafta.
    expect(s.kingAvg, `ölçülen ort. ${s.kingAvg.toFixed(1)}, en çok ${Math.max(...s.kings)}`).toBeGreaterThan(19);
    expect(s.kingAvg, `ölçülen ort. ${s.kingAvg.toFixed(1)}`).toBeLessThan(29);
    // Süper Lig rekoru 39 (Tanju Çolak). Tek bir uç sezon olabilir (rastgelelik); dağılım kaymasın: 10 sezonun en fazla birinde 38+
    // (15 sezonda en fazla 2 idi; yurtdışı kulüpleriyle 30 sezonluk ölçüm: ort. 26.9, 2 sezon 38+, en çok 42)
    expect(s.kings.filter((k) => k >= 38).length).toBeLessThanOrEqual(1);
  });

  it('güçlü takım zayıf takımı çoğunlukla yener', () => {
    let wins = 0;
    let losses = 0;
    const N = 600;
    for (let seed = 0; seed < N; seed++) {
      const r = play('galatasaray', 'erzurumspor', 10_000 + seed);
      if (r.homeGoals > r.awayGoals) wins++;
      if (r.homeGoals < r.awayGoals) losses++;
    }
    expect(wins / N).toBeGreaterThan(0.55);
    expect(losses / N).toBeLessThan(0.2);
  });
});
