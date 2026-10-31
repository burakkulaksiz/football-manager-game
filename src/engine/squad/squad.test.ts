import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { PHYSICAL_ATTRS, TECHNICAL_ATTRS } from '../attributes';
import { addDays } from '../date';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { autoSelectLineup } from '../match/formation';
import { applyResult } from '../match/simulate';
import { Rng } from '../rng';
import { makeResult, playSeason } from '../testing';
import type { CardEvent, Fixture, GameWorld, Player } from '../types';
import { recoverCondition } from './condition';
import { developPlayer } from './development';
import { createInjury, healInjuries, INJURY_TYPES } from './injuries';
import { applyMatchMorale, moraleDrift } from './morale';
import { playerRequests } from './talks';
import { YELLOW_LIMIT } from './discipline';

const START = '2026-07-01';
const rng = new Rng(1);

function fresh(): GameWorld {
  return createWorld(gameData, 31, 'goztepe', START);
}

/** Göztepe'nin bir maçı için sahte sonuç. */
function fixtureFor(world: GameWorld, index = 0): Fixture {
  return world.season.fixtures.filter((f) => f.homeId === 'goztepe' || f.awayId === 'goztepe')[index]!;
}

function playFake(world: GameWorld, fixture: Fixture, opts: { cards?: CardEvent[]; injured?: number[]; played?: Player[]; goals?: [number, number] } = {}) {
  const [hg, ag] = opts.goals ?? [1, 1];
  const result = makeResult(hg, ag);
  result.cards = opts.cards ?? [];
  result.injuries = (opts.injured ?? []).map((playerId) => ({ minute: 30, clubId: 'goztepe', playerId }));
  result.players = (opts.played ?? []).map((p) => ({
    playerId: p.id, clubId: p.clubId!, started: true, minutes: 90, rating: 6.5, goals: 0, assists: 0, condition: 70,
  }));
  applyResult(world, fixture, result, rng);
}

const card = (p: Player, type: 'yellow' | 'red', secondYellow = false): CardEvent =>
  ({ minute: 50, clubId: p.clubId!, playerId: p.id, type, secondYellow });

describe('sakatlıklar', () => {
  it('sakatlık süresi türünün aralığında', () => {
    const r = new Rng(5);
    for (let i = 0; i < 200; i++) {
      const injury = createInjury(r);
      const type = INJURY_TYPES.find((t) => t.name === injury.name)!;
      expect(injury.daysOut).toBeGreaterThanOrEqual(type.minDays);
      expect(injury.daysOut).toBeLessThanOrEqual(type.maxDays);
    }
  });

  it('maçta sakatlanan oyuncu kalıcı sakat olur, gün gün iyileşir, haberi gelir', () => {
    const world = fresh();
    const player = clubPlayers(world, 'goztepe')[4]!;
    playFake(world, fixtureFor(world), { injured: [player.id] });
    expect(player.injury).not.toBeNull();
    expect(world.news.some((n) => n.category === 'injury' && n.playerId === player.id)).toBe(true);
    // Sakat oyuncu kadroya alınmaz
    expect(autoSelectLineup(clubPlayers(world, 'goztepe')).starters.map((s) => s.playerId)).not.toContain(player.id);
    const days = player.injury!.daysOut;
    for (let i = 0; i < days; i++) healInjuries(world);
    expect(player.injury).toBeNull();
  });
});

describe('cezalar', () => {
  it(`${YELLOW_LIMIT} sarı kart 1 maç ceza; ceza bir sonraki maçta çekilir`, () => {
    const world = fresh();
    const player = clubPlayers(world, 'goztepe')[2]!;
    for (let i = 0; i < YELLOW_LIMIT; i++) playFake(world, fixtureFor(world, i), { cards: [card(player, 'yellow')], played: [player] });
    expect(player.suspension).toBe(1);
    expect(player.yellowCards).toBe(0);
    expect(autoSelectLineup(clubPlayers(world, 'goztepe')).starters.map((s) => s.playerId)).not.toContain(player.id);
    playFake(world, fixtureFor(world, YELLOW_LIMIT));
    expect(player.suspension).toBe(0);
  });

  it('ikinci sarıdan kırmızı 1 maç; o maçın sarısı birikime sayılmaz', () => {
    const world = fresh();
    const player = clubPlayers(world, 'goztepe')[3]!;
    player.yellowCards = 2;
    playFake(world, fixtureFor(world), { cards: [card(player, 'yellow'), card(player, 'red', true)], played: [player] });
    expect(player.suspension).toBe(1);
    expect(player.yellowCards).toBe(2);
  });

  it('direkt kırmızı 1–3 maç ceza', () => {
    const world = fresh();
    const player = clubPlayers(world, 'goztepe')[5]!;
    playFake(world, fixtureFor(world), { cards: [card(player, 'red')], played: [player] });
    expect(player.suspension).toBeGreaterThanOrEqual(1);
    expect(player.suspension).toBeLessThanOrEqual(3);
  });
});

describe('kondisyon', () => {
  it('maç sonu kondisyonu oyuncuya yazılır, sonra günlük toparlanır', () => {
    const world = fresh();
    const player = clubPlayers(world, 'goztepe')[1]!;
    playFake(world, fixtureFor(world), { played: [player] });
    expect(player.condition).toBe(70);
    for (let i = 0; i < 5; i++) recoverCondition(world);
    expect(player.condition).toBe(98); // normal yoğunluk tavanı
  });

  it('yoğun antrenmanda kondisyon tavanı düşer, hafifte 100', () => {
    const world = fresh();
    const player = clubPlayers(world, 'goztepe')[1]!;
    world.training.goztepe = { focus: 'balanced', intensity: 'hard' };
    player.condition = 70;
    for (let i = 0; i < 6; i++) recoverCondition(world);
    expect(player.condition).toBe(94);
    world.training.goztepe = { focus: 'balanced', intensity: 'light' };
    for (let i = 0; i < 3; i++) recoverCondition(world);
    expect(player.condition).toBe(100);
  });
});

describe('moral', () => {
  it('galibiyet morali yükseltir, yenilgi düşürür', () => {
    const world = fresh();
    const squad = clubPlayers(world, 'goztepe');
    const fixture = fixtureFor(world);
    const homeIsUs = fixture.homeId === 'goztepe';
    const before = squad.map((p) => p.morale);
    const win = makeResult(homeIsUs ? 3 : 0, homeIsUs ? 0 : 3);
    win.players = squad.slice(0, 11).map((p) => ({ playerId: p.id, clubId: 'goztepe', started: true, minutes: 90, rating: 7, goals: 0, assists: 0 }));
    applyMatchMorale(world, fixture, win);
    expect(squad[0]!.morale).toBeGreaterThan(before[0]!);

    const lossBefore = squad[0]!.morale;
    const loss = makeResult(homeIsUs ? 0 : 3, homeIsUs ? 3 : 0);
    loss.players = win.players;
    applyMatchMorale(world, fixture, loss);
    expect(squad[0]!.morale).toBeLessThan(lossBefore);
  });

  it('forma bekleyen sağlam oyuncu kenarda kalınca morali düşer; çok düşerse görüşme talep eder', () => {
    const world = fresh();
    const squad = clubPlayers(world, 'goztepe').sort((a, b) => b.currentAbility - a.currentAbility);
    const star = squad[0]!;
    const fixture = fixtureFor(world);
    const draw = makeResult(1, 1);
    draw.players = squad.slice(1, 12).map((p) => ({ playerId: p.id, clubId: 'goztepe', started: true, minutes: 90, rating: 6.5, goals: 0, assists: 0 }));
    const before = star.morale;
    applyMatchMorale(world, fixture, draw);
    expect(star.morale).toBeLessThan(before);

    star.morale = 20;
    playerRequests(world);
    expect(world.requests.some((r) => r.playerId === star.id && r.topic === 'playingTime')).toBe(true);
    // Aynı hafta tekrar talep etmez
    const count = world.requests.length;
    playerRequests(world);
    expect(world.requests.length).toBe(count);
  });

  it('moral zamanla ortalamaya döner', () => {
    const world = fresh();
    const p = clubPlayers(world, 'goztepe')[0]!;
    p.morale = 10;
    for (let i = 0; i < 60; i++) moraleDrift(world);
    expect(p.morale).toBeGreaterThan(40);
  });
});

describe('gelişim', () => {
  function youngTalent(world: GameWorld): Player {
    // Saha oyuncusu (kalecide saha tekniği neredeyse hiç gelişmez)
    const outfield = clubPlayers(world, 'goztepe').filter((x) => x.positions.GK === undefined);
    const p = outfield.find((x) => x.potentialAbility - x.currentAbility > 30) ?? outfield[0]!;
    p.birthDate = '2008-03-01'; // 18 yaş
    p.potentialAbility = Math.min(200, p.currentAbility + 45);
    p.hidden.professionalism = 15;
    return p;
  }

  it('genç yetenek bir yılda belirgin gelişir ama potansiyelini aşmaz', () => {
    const world = fresh();
    const p = youngTalent(world);
    const start = p.currentAbility;
    const r = new Rng(3);
    for (let week = 0; week < 52; week++) {
      developPlayer(world, p, r);
      world.date = addDays(world.date, 7);
    }
    expect(p.currentAbility).toBeGreaterThan(start + 8);
    expect(p.currentAbility).toBeLessThanOrEqual(p.potentialAbility);
  });

  it('yaşlı oyuncu geriler, en çok fiziksel özelliklerinden', () => {
    const world = fresh();
    const p = clubPlayers(world, 'goztepe').find((x) => x.positions.GK === undefined)!;
    p.birthDate = '1991-01-01'; // 35 yaş
    const physBefore = PHYSICAL_ATTRS.reduce((s, a) => s + p.attributes[a], 0);
    const start = p.currentAbility;
    const r = new Rng(4);
    for (let week = 0; week < 52; week++) developPlayer(world, p, r);
    expect(p.currentAbility).toBeLessThan(start);
    expect(PHYSICAL_ATTRS.reduce((s, a) => s + p.attributes[a], 0)).toBeLessThan(physBefore - 3);
  });

  it('antrenman odağı hangi özelliklerin gelişeceğini belirler', () => {
    const gains = (focus: 'physical' | 'technical') => {
      const world = fresh();
      world.training.goztepe = { focus, intensity: 'normal' };
      const p = youngTalent(world);
      const phys0 = PHYSICAL_ATTRS.reduce((s, a) => s + p.attributes[a], 0);
      const tech0 = TECHNICAL_ATTRS.reduce((s, a) => s + p.attributes[a], 0);
      const r = new Rng(9);
      for (let week = 0; week < 52; week++) developPlayer(world, p, r);
      return {
        phys: PHYSICAL_ATTRS.reduce((s, a) => s + p.attributes[a], 0) - phys0,
        tech: TECHNICAL_ATTRS.reduce((s, a) => s + p.attributes[a], 0) - tech0,
      };
    };
    const physical = gains('physical');
    const technical = gains('technical');
    expect(physical.phys).toBeGreaterThan(technical.phys);
    expect(technical.tech).toBeGreaterThan(physical.tech);
  });
});

describe('sezon boyunca', () => {
  const world = createWorld(gameData, 12, 'alanyaspor', START);
  const cas = new Map(Object.values(world.players).map((p) => [p.id, p.currentAbility]));
  playSeason(world);
  const results = world.season.fixtures.map((f) => f.result!);

  it('sakatlık ve cezalar makul sayıda', () => {
    const matchInjuries = results.reduce((s, r) => s + r.injuries.length, 0);
    expect(matchInjuries / 18).toBeGreaterThan(3);
    expect(matchInjuries / 18).toBeLessThan(20);
    const injuryNews = world.news.filter((n) => n.category === 'injury' && n.title.includes('sakatlandı'));
    expect(injuryNews.length).toBeGreaterThanOrEqual(2);
    expect(world.news.some((n) => n.category === 'discipline')).toBe(true);
  });

  it('oyuncular gelişir ve geriler', () => {
    const changed = Object.values(world.players).filter((p) => cas.has(p.id) && p.currentAbility !== cas.get(p.id));
    expect(changed.length).toBeGreaterThan(100);
    expect(changed.some((p) => p.currentAbility > cas.get(p.id)!)).toBe(true);
    expect(changed.some((p) => p.currentAbility < cas.get(p.id)!)).toBe(true);
  });
});
