import { describe, expect, it } from 'vitest';
import { clubPlayers, createWorld, primaryPosition } from '../engine';
import { gameData } from '../gameData';
import { DEFAULT_SQUAD_FILTERS, filterSquad, isExpiring } from './squadFilters';

const world = createWorld(gameData, 3, 'trabzonspor', '2026-07-01');
const squad = clubPlayers(world, 'trabzonspor');
const ctx = { date: world.date, lineup: world.tactics.trabzonspor!.lineup };

describe('kadro filtreleri', () => {
  it('filtre yoksa herkes', () => {
    expect(filterSquad(squad, DEFAULT_SQUAD_FILTERS, ctx)).toHaveLength(squad.length);
  });

  it('mevki grubu', () => {
    const keepers = filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, group: 'gk' }, ctx);
    expect(keepers.length).toBeGreaterThan(0);
    expect(keepers.every((p) => primaryPosition(p) === 'GK')).toBe(true);
  });

  it('sakat / cezalı', () => {
    squad[0]!.injury = { name: 'Darbe', daysOut: 3 };
    squad[1]!.suspension = 1;
    const out = filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, status: 'unavailable' }, ctx);
    expect(out.map((p) => p.id).sort()).toEqual([squad[0]!.id, squad[1]!.id].sort());
    squad[0]!.injury = null;
    squad[1]!.suspension = 0;
  });

  it('sözleşmesi bu sezon bitenler', () => {
    const out = filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, status: 'expiring' }, ctx);
    expect(out.every((p) => p.contract.expires === '2027-06-30')).toBe(true);
    expect(out.length).toBe(squad.filter((p) => isExpiring(p, world.date)).length);
  });

  it('listedekiler (satılık / kiralık)', () => {
    squad[2]!.listing = { kind: 'transfer', price: null, since: world.date };
    squad[3]!.listing = { kind: 'loan', price: 100_000, since: world.date };
    const out = filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, status: 'listed' }, ctx);
    expect(out.map((p) => p.id).sort()).toEqual([squad[2]!.id, squad[3]!.id].sort());
    delete squad[2]!.listing;
    delete squad[3]!.listing;
  });

  it('ilk 11 ve gençler', () => {
    expect(filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, status: 'xi' }, ctx)).toHaveLength(11);
    expect(filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, status: 'xi' }, { ...ctx, lineup: null })).toHaveLength(0);
    const young = filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, status: 'young' }, ctx);
    expect(young.length).toBeGreaterThan(0);
  });

  it('isim araması Türkçe büyük/küçük harf duyarsız', () => {
    const target = squad.find((p) => /[İIıi]/.test(p.lastName)) ?? squad[0]!;
    const query = target.lastName.toLocaleUpperCase('tr');
    const out = filterSquad(squad, { ...DEFAULT_SQUAD_FILTERS, search: query }, ctx);
    expect(out.map((p) => p.id)).toContain(target.id);
  });
});
