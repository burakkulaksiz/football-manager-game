import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { ALL_ATTRS } from '../attributes';
import { HOME_NATION } from '../data';
import { ageOn, primaryPosition } from '../player';
import { clubPlayers, createWorld, SQUAD_TEMPLATE } from './worldGenerator';

const START = '2026-07-01';
const world = createWorld(gameData, 2026, 'galatasaray', START);
const allPlayers = Object.values(world.players);

/** Kulübün en iyi 11 oyuncusunun ortalama CA'sı. */
function top11Average(clubId: string): number {
  const cas = clubPlayers(world, clubId)
    .map((p) => p.currentAbility)
    .sort((a, b) => b - a)
    .slice(0, 11);
  return cas.reduce((a, b) => a + b, 0) / cas.length;
}

describe('dünya üretimi', () => {
  it('aynı seed ile birebir aynı dünyayı üretir', () => {
    const again = createWorld(gameData, 2026, 'galatasaray', START);
    expect(again).toEqual(world);
  });

  it('farklı seed ile farklı oyuncular üretir', () => {
    const other = createWorld(gameData, 7, 'galatasaray', START);
    expect(other.players[1]).not.toEqual(world.players[1]);
  });

  it('her kulübe şablondaki sayıda oyuncu verir, en az 3 kaleci ile', () => {
    for (const club of gameData.clubs) {
      const squad = clubPlayers(world, club.id);
      expect(squad).toHaveLength(SQUAD_TEMPLATE.length);
      expect(squad.filter((p) => primaryPosition(p) === 'GK').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('oyuncu kimlikleri ve kulüp içi forma numaraları benzersiz', () => {
    expect(new Set(allPlayers.map((p) => p.id)).size).toBe(allPlayers.length);
    for (const club of gameData.clubs) {
      const numbers = clubPlayers(world, club.id).map((p) => p.squadNumber);
      expect(numbers.every((n) => n !== null && n >= 1 && n <= 99)).toBe(true);
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });

  it('tüm özellikler 1–20, CA/PA 1–200 ve PA ≥ CA', () => {
    for (const p of allPlayers) {
      for (const key of ALL_ATTRS) {
        expect(p.attributes[key]).toBeGreaterThanOrEqual(1);
        expect(p.attributes[key]).toBeLessThanOrEqual(20);
      }
      expect(p.currentAbility).toBeGreaterThanOrEqual(1);
      expect(p.potentialAbility).toBeLessThanOrEqual(200);
      expect(p.potentialAbility).toBeGreaterThanOrEqual(p.currentAbility);
    }
  });

  it('yaşlar: A takım 17–35, altyapı (U19) 15–18', () => {
    for (const p of allPlayers) {
      const age = ageOn(p.birthDate, START);
      expect(age).toBeGreaterThanOrEqual(p.academy ? 15 : 17);
      expect(age).toBeLessThanOrEqual(p.academy ? 18 : 35);
    }
  });

  it('büyük kulüpler daha güçlü kadroyla başlar', () => {
    // Birkaç seed ortalaması yerine tek dünyada belirgin fark bekliyoruz.
    const gs = top11Average('galatasaray');
    const fb = top11Average('fenerbahce');
    const bottom = top11Average('karagumruk');
    expect(gs - bottom).toBeGreaterThan(20);
    expect(fb - bottom).toBeGreaterThan(20);

    // İtibar sırası ile güç sırası güçlü biçimde ilişkili olmalı.
    const byRep = [...gameData.clubs].sort((a, b) => b.reputation - a.reputation);
    const top4 = byRep.slice(0, 4).map((c) => top11Average(c.id));
    const last4 = byRep.slice(-4).map((c) => top11Average(c.id));
    expect(Math.min(...top4)).toBeGreaterThan(Math.max(...last4));
  });

  it('oyuncuların çoğu yerli, ama yabancılar da var', () => {
    const home = allPlayers.filter((p) => p.nationality === HOME_NATION).length / allPlayers.length;
    expect(home).toBeGreaterThan(0.55);
    expect(home).toBeLessThan(0.85);
  });

  it('kulüp maaş toplamı bütçeyi aşmaz ama ona yakındır', () => {
    for (const club of gameData.clubs) {
      const total = clubPlayers(world, club.id).reduce((s, p) => s + p.contract.wage, 0);
      expect(total).toBeLessThanOrEqual(club.wageBudget);
      expect(total).toBeGreaterThan(club.wageBudget * 0.75);
    }
  });

  it('sözleşmeler gelecekte 30 Haziran\'da biter', () => {
    for (const p of allPlayers) {
      expect(p.contract.expires > START).toBe(true);
      expect(p.contract.expires.endsWith('-06-30')).toBe(true);
    }
  });
});
