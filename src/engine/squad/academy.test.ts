import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { setupFixture } from '../match/simulate';
import { ageOn } from '../player';
import type { GameWorld, Player } from '../types';
import {
  ACADEMY_AGE_LIMIT,
  academyPlayers,
  canSendToAcademy,
  isOverAge,
  promoteToFirstTeam,
  sendToAcademy,
  toggleWatch,
} from './academy';
import { addMonths, GROWTH_MONTHS, growthChange, recordGrowth, recordPlayerGrowth } from './growth';

const START = '2026-07-01';

describe('altyapı (U19)', () => {
  const world = createWorld(gameData, 21, 'besiktas', START);

  it('her kulübün 7–9 kişilik U19 kadrosu var: 15–18 yaş, forma numarasız, A takım kadrosunda değil', () => {
    for (const club of world.clubs) {
      const academy = academyPlayers(world, club.id);
      expect(academy.length).toBeGreaterThanOrEqual(7);
      expect(academy.length).toBeLessThanOrEqual(9);
      const firstTeam = new Set(clubPlayers(world, club.id).map((p) => p.id));
      for (const p of academy) {
        const age = ageOn(p.birthDate, START);
        expect(age).toBeGreaterThanOrEqual(15);
        expect(age).toBeLessThanOrEqual(18);
        expect(p.squadNumber).toBeNull();
        expect(firstTeam.has(p.id)).toBe(false);
      }
    }
  });

  it('potansiyel dağılımı gerçekçi: çoğu sıradan, cevher nadir (5 yıldız ≈ potansiyel 158+)', () => {
    const pas = Object.values(world.players).filter((p) => p.academy).map((p) => p.potentialAbility).sort((a, b) => a - b);
    const median = pas[Math.floor(pas.length / 2)]!;
    expect(median).toBeGreaterThan(95);
    expect(median).toBeLessThan(125);
    expect(pas.filter((x) => x >= 158).length / pas.length).toBeLessThan(0.06);
  });

  it('altyapı eklemek ana dünyayı değiştirmez: A takım kadroları ve fikstür aynı tohumla aynı', () => {
    const again = createWorld(gameData, 21, 'besiktas', START);
    expect(clubPlayers(again, 'besiktas').map((p) => p.id)).toEqual(clubPlayers(world, 'besiktas').map((p) => p.id));
    expect(again.season.fixtures.map((f) => f.homeId + f.awayId)).toEqual(world.season.fixtures.map((f) => f.homeId + f.awayId));
  });

  it('U19 oyuncusu maç kadrosuna girmez', () => {
    const fixture = world.season.fixtures.find((f) => f.homeId === 'besiktas' || f.awayId === 'besiktas')!;
    const setup = setupFixture(world, fixture, 1);
    for (const team of [setup.home, setup.away]) {
      for (const id of [...team.lineup.starters.map((s) => s.playerId), ...team.lineup.bench]) {
        expect(world.players[id]!.academy).toBeFalsy();
      }
    }
  });

  it("A takıma alma ve U19'a gönderme: numara verilir / boşalır, yaş sınırı geçerli", () => {
    const w = createWorld(gameData, 22, 'besiktas', START);
    const youth = academyPlayers(w, 'besiktas')[0]!;
    expect(promoteToFirstTeam(w, youth)).toBe(true);
    expect(youth.academy).toBeFalsy();
    expect(youth.squadNumber).not.toBeNull();
    expect(clubPlayers(w, 'besiktas').some((p) => p.id === youth.id)).toBe(true);
    // Geri gönderilebilir (yaş sınırının altında)
    expect(canSendToAcademy(w, youth)).toBe(ageOn(youth.birthDate, START) < ACADEMY_AGE_LIMIT);
    if (canSendToAcademy(w, youth)) {
      expect(sendToAcademy(w, youth)).toBe(true);
      expect(youth.academy).toBe(true);
      expect(youth.squadNumber).toBeNull();
    }
    // Yaş sınırını geçmiş A takım oyuncusu U19'a gönderilemez
    const veteran = clubPlayers(w, 'besiktas').find((p) => ageOn(p.birthDate, START) >= 25)!;
    expect(sendToAcademy(w, veteran)).toBe(false);
  });

  it('takip listesi: ekle / çıkar', () => {
    const w = createWorld(gameData, 23, 'besiktas', START);
    const target = academyPlayers(w, 'galatasaray')[0]!;
    expect(toggleWatch(w, target.id)).toBe(true);
    expect(w.youthWatch).toContain(target.id);
    expect(toggleWatch(w, target.id)).toBe(false);
    expect(w.youthWatch).not.toContain(target.id);
  });
});

describe('altyapı sezon döngüsü', () => {
  // Yeni sezonun ilk gününe (1 Temmuz: altyapı kararları ve yeni grup) kadar oynat; kovulma testi kesmesin
  function playToNextSeason(w: GameWorld): void {
    let guard = 0;
    while (w.date < '2027-07-01' && guard++ < 4000) {
      w.board.confidence = 100;
      advance(w, gameData, { autoPlayUserMatch: true });
    }
  }
  const world = createWorld(gameData, 31, 'besiktas', START);
  const before = new Map(Object.values(world.players).filter((p) => p.academy).map((p) => [p.id, p.clubId] as const));
  playToNextSeason(world);

  it('1 Temmuz: her kulübe 4–6 kişilik yeni grup (15–16 yaş) U19\'a katılır; kullanıcıya haber', () => {
    const newcomers = Object.values(world.players).filter((p) => p.academy && !before.has(p.id));
    for (const club of world.clubs) {
      const intake = newcomers.filter((p) => p.clubId === club.id);
      expect(intake.length).toBeGreaterThanOrEqual(4);
      expect(intake.length).toBeLessThanOrEqual(6);
      for (const p of intake) expect(ageOn(p.birthDate, world.date)).toBeLessThanOrEqual(16);
    }
    expect(world.news.some((n) => n.category === 'academy' && n.title.includes('yeni grup'))).toBe(true);
  });

  it('yapay zekâ kulüplerinde yaş sınırını geçen U19 oyuncusu kalmaz (A takıma alındı ya da bıraktı)', () => {
    for (const club of world.clubs) {
      if (club.id === world.playerClubId) continue;
      for (const p of academyPlayers(world, club.id)) expect(isOverAge(p, world.date)).toBe(false);
    }
  });

  it('U19 sözleşmeleri kendiliğinden uzar: kullanıcının altyapısından kimse sözleşme bitiminden ayrılmadı', () => {
    for (const [id, clubId] of before) {
      const p = world.players[id];
      if (!p || clubId !== 'besiktas') continue;
      expect(p.clubId).toBe('besiktas');
    }
    for (const p of Object.values(world.players)) {
      if (p.academy) expect(p.contract.expires > world.date).toBe(true);
    }
  });

  it('gelişim geçmişi aylık tutulur', () => {
    const youth = academyPlayers(world, 'besiktas').find((p) => before.has(p.id))!;
    // Temmuz 2026 – Temmuz 2027: 13 ay
    expect(youth.growth!.ca.length).toBe(13);
    expect(youth.growth!.start).toBe('2026-07');
  });
});

describe('gelişim geçmişi', () => {
  const player = (ca: number): Player => ({ currentAbility: ca, birthDate: '2010-01-01' }) as Player;

  it('aylar art arda; atlanan ay son değerle dolar; en fazla 36 ay', () => {
    const p = player(60);
    recordPlayerGrowth(p, '2026-07');
    p.currentAbility = 64;
    recordPlayerGrowth(p, '2026-09');
    expect(p.growth).toEqual({ start: '2026-07', ca: [60, 60, 64] });
    recordPlayerGrowth(p, '2026-09');
    expect(p.growth!.ca).toHaveLength(3);
    for (let i = 1; i <= 40; i++) recordPlayerGrowth(p, addMonths('2026-09', i));
    expect(p.growth!.ca).toHaveLength(GROWTH_MONTHS);
    expect(p.growth!.start).toBe(addMonths('2026-09', 40 - GROWTH_MONTHS + 1));
  });

  it('son 6 ayın değişimi; 23 yaşını geçenin geçmişi silinir', () => {
    const p = player(70);
    p.growth = { start: '2026-01', ca: [50, 52, 55, 58, 60, 62, 66, 70] };
    // 6 ay önceki değer: sondan 7. kayıt (52)
    expect(growthChange(p, 6)).toBe(70 - 52);
    const w = { date: '2026-08-01', players: { 1: { ...p, id: 1, clubId: 'x', birthDate: '2000-01-01' } } } as unknown as GameWorld;
    recordGrowth(w);
    expect(w.players[1]!.growth).toBeUndefined();
  });
});
