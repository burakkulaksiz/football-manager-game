import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { validateGameData, type GameData, type SquadPlayerData } from '../data';
import { ageOn, primaryPosition } from '../player';
import { clubBaseLevel, clubPlayers, createWorld, SQUAD_TEMPLATE } from './worldGenerator';

const START = '2026-07-01';

describe('Gerçek kadro dosyaları (data/squads)', () => {
  it('Süper Lig ve 1. Lig kulüplerinin hepsinin kadro dosyası var', () => {
    for (const club of [...gameData.clubs, ...gameData.lowerClubs]) expect(gameData.squads[club.id], club.id).toBeDefined();
  });

  const world = createWorld(gameData, 1, 'galatasaray', START);
  const named = (clubId: string, last: string) => Object.values(world.players).find((p) => p.clubId === clubId && p.lastName === last);

  it('dosyadaki her oyuncu kulübünde, bilgileriyle', () => {
    for (const [clubId, squad] of Object.entries(gameData.squads)) {
      for (const d of squad.players) {
        const p = Object.values(world.players).find((x) => x.clubId === clubId && x.firstName === d.firstName && x.lastName === d.lastName);
        expect(p, `${clubId}: ${d.firstName} ${d.lastName}`).toBeDefined();
        expect(p!.nationality).toBe(d.nationality);
        if (typeof d.born === 'string') expect(p!.birthDate).toBe(d.born);
        const primary = Array.isArray(d.positions) ? d.positions[0] : undefined;
        if (primary) expect(primaryPosition(p!)).toBe(primary);
        if (d.number !== undefined && !p!.academy) expect(p!.squadNumber).toBe(d.number);
      }
    }
  });

  it('A takım en az 25 kişi; forma numaraları benzersiz; sözleşmeler 30 Haziran\'da biter', () => {
    for (const club of gameData.clubs) {
      const squad = clubPlayers(world, club.id);
      expect(squad.length).toBeGreaterThanOrEqual(SQUAD_TEMPLATE.length);
      expect(squad.filter((p) => primaryPosition(p) === 'GK').length).toBeGreaterThanOrEqual(2);
      const numbers = squad.map((p) => p.squadNumber);
      expect(numbers.every((n) => n !== null)).toBe(true);
      expect(new Set(numbers).size).toBe(numbers.length);
      for (const p of squad) expect(p.contract.expires.endsWith('-06-30') && p.contract.expires > START).toBe(true);
    }
  });

  it('güç (1–20) yetenekle uyumlu: seviye L ≈ CA 1 + (L − 1) × 10,5', () => {
    const errors: number[] = [];
    for (const [clubId, squad] of Object.entries(gameData.squads)) {
      for (const d of squad.players) {
        const p = named(clubId, d.lastName);
        if (!p || p.firstName !== d.firstName) continue;
        errors.push(p.currentAbility - (1 + (d.ability - 1) * (199 / 19)));
      }
    }
    const mean = errors.reduce((s, x) => s + x, 0) / errors.length;
    const spread = Math.sqrt(errors.reduce((s, x) => s + (x - mean) ** 2, 0) / errors.length);
    expect(Math.abs(mean)).toBeLessThan(8);
    expect(spread).toBeLessThan(10);
  });

  it('kulübün çok altındaki 18 yaş ve altı gençler U19\'da', () => {
    for (const club of gameData.clubs) {
      const base = clubBaseLevel(club.reputation);
      for (const d of gameData.squads[club.id]!.players) {
        const p = named(club.id, d.lastName);
        if (!p || p.firstName !== d.firstName || typeof d.born !== 'string') continue;
        expect(Boolean(p.academy)).toBe(ageOn(d.born, START) <= 18 && d.ability < base - 3);
      }
    }
  });
});

describe('Kadro dosyası kuralları', () => {
  const player = (over: Partial<SquadPlayerData> = {}): SquadPlayerData => ({
    firstName: 'Deneme', lastName: 'Oyuncu', born: '1998-03-04', nationality: 'TUR', positions: ['MC'], ability: 14, ...over,
  });
  const withSquad = (players: SquadPlayerData[]): GameData => ({ ...gameData, squads: { kasimpasa: { players } } });

  it('eksik kadro şablonun eksik mevkileriyle 25\'e tamamlanır', () => {
    const data = withSquad([
      player({ lastName: 'Bir', positions: ['GK'], number: 1 }),
      player({ lastName: 'İki', positions: ['ST'], number: 9 }),
    ]);
    const world = createWorld(data, 3, 'galatasaray', START);
    const squad = clubPlayers(world, 'kasimpasa');
    expect(squad).toHaveLength(SQUAD_TEMPLATE.length);
    expect(squad.filter((p) => primaryPosition(p) === 'GK')).toHaveLength(3);
    expect(squad.find((p) => p.lastName === 'Bir')!.squadNumber).toBe(1);
  });

  it('isteğe bağlı alanlar üretilen değeri ezer', () => {
    const data = withSquad([
      player({
        positions: { AMC: 20, ST: 16 }, foot: 'left', wage: 1_234_000, contractExpires: 2029, potential: 17, joined: '2024-01-15',
        attributes: { finishing: 20, passing: 1 }, hidden: { professionalism: 20 }, born: 2005,
      }),
    ]);
    const world = createWorld(data, 4, 'galatasaray', START);
    const p = clubPlayers(world, 'kasimpasa').find((x) => x.lastName === 'Oyuncu')!;
    expect(p.positions).toEqual({ AMC: 20, ST: 16 });
    expect(p.foot).toBe('left');
    expect(p.contract.wage).toBe(1_234_000);
    expect(p.contract.expires).toBe('2029-06-30');
    expect(p.attributes.finishing).toBe(20);
    expect(p.attributes.passing).toBe(1);
    expect(p.hidden.professionalism).toBe(20);
    expect(p.birthDate.startsWith('2005-')).toBe(true);
    expect(p.joined).toBe('2024-01-15');
    expect(p.potentialAbility).toBeGreaterThan(p.currentAbility + 20);
  });

  it('hatalı kadro dosyasında anlaşılır hata', () => {
    const raw = (squads: Record<string, unknown>) => () => validateGameData({
      clubs: gameData.clubs, lowerClubs: gameData.lowerClubs, foreignClubs: gameData.foreignClubs,
      nations: gameData.nations, namePools: gameData.namePools, squads,
    });
    expect(raw({ yokboylekulup: { players: [] } })).toThrow(/kulüp yok/);
    expect(raw({ kasimpasa: { players: [player({ nationality: 'XXX' })] } })).toThrow(/uyruk 'XXX'/);
    expect(raw({ kasimpasa: { players: [player({ number: 7 }), player({ number: 7 })] } })).toThrow(/7 tekrar ediyor/);
    expect(raw({ kasimpasa: { players: [player({ ability: 25 })] } })).toThrow(/'ability' 1–20/);
    expect(raw({ kasimpasa: { players: [player({ positions: ['XX' as 'ST'] })] } })).toThrow(/positions/);
  });
});
