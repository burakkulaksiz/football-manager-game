import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { createWorld } from '../generation/worldGenerator';
import { generateLowerLeague, lowerLeagueIds, lowerStandings, playLowerLeague } from './lowerLeague';

describe('1. Lig', () => {
  const world = createWorld(gameData, 7, 'galatasaray', '2026-07-01');
  const ids = lowerLeagueIds(world);

  it('çift devreli fikstür, haftalar Süper Lig lig günlerinde', () => {
    const lower = world.season.lower!;
    expect(lower).toHaveLength(ids.length * (ids.length - 1));
    const days = new Set(world.season.fixtures.filter((f) => f.competition === undefined).map((f) => f.date));
    for (const f of lower) expect(days.has(f.date)).toBe(true);
    // Her kulüp her rakibiyle bir evinde bir deplasmanda
    for (const id of ids) expect(lower.filter((f) => f.homeId === id)).toHaveLength(ids.length - 1);
  });

  it('tarihi gelen maçlar oynanır, aynı dünyada aynı skorlar; ana rastgelelik kaymaz', () => {
    const a = structuredClone(world);
    const b = structuredClone(world);
    const upTo = a.season.lower![a.season.lower!.length / 2]!.date;
    const rng = a.rngState;
    playLowerLeague(a, upTo);
    playLowerLeague(b, upTo);
    expect(a.rngState).toBe(rng);
    expect(a.season.lower).toEqual(b.season.lower);
    expect(a.season.lower!.filter((f) => f.result !== null).length).toBeGreaterThan(0);
    expect(a.season.lower!.every((f) => (f.result !== null) === (f.date <= upTo))).toBe(true);
    const table = lowerStandings(a);
    expect(table).toHaveLength(ids.length);
    expect(table[0]!.points).toBeGreaterThan(0);
  });

  it('tek sayıda kulüpte 1. Lig oynanmaz (çıkanlar rastgele)', () => {
    const odd = structuredClone(world);
    odd.clubs.find((c) => c.id === ids[0])!.division = 1;
    expect(generateLowerLeague(odd, 2026)).toBeUndefined();
  });
});
