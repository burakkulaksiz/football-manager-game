import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { addDays } from '../date';
import { advance, todaysUserFixture } from '../gameFlow';
import { createWorld, getClub } from '../generation/worldGenerator';
import { playUntil } from '../testing';
import type { GameWorld } from '../types';
import { EXPECTATION_TARGET } from './expectation';
import {
  acceptJobOffer,
  applyForJob,
  fitsClub,
  jobsDay,
  leaveClub,
  NO_CLUB,
  rejectJobOffer,
  requiredReputation,
  resignJob,
  takeJob,
  UNEMPLOYMENT_LIMIT_DAYS,
} from './jobs';
import { managerReputation } from './manager';

const START = '2026-07-01';

/** İşsizken haftalık teklif olasılığı %30: teklif gelene kadar (en çok 120 gün) iş piyasasını işletir. */
function untilOffer(world: GameWorld, clubId: string): void {
  for (let i = 0; i < 120 && !(world.jobOffers ?? []).some((o) => o.clubId === clubId); i++) runJobsDays(world, 1);
}

/** jobsDay'i (yalnızca iş piyasası) gün gün çalıştırır: tam simülasyon olmadan hızlı. */
function runJobsDays(world: GameWorld, days: number): void {
  for (let i = 0; i < days; i++) {
    world.date = addDays(world.date, 1);
    jobsDay(world);
  }
}

describe('işsizlik', () => {
  it('kovulan menajer işsiz kalır; kulübü yapay zekâya geçer, oyun sürer; 365 gün iş bulamazsa kariyer biter', () => {
    const world = createWorld(gameData, 61, 'kasimpasa', START);
    leaveClub(world, 'sacked', 'Deneme.');
    expect(world.playerClubId).toBe(NO_CLUB);
    expect(world.unemployed).toMatchObject({ lastClubId: 'kasimpasa', reason: 'sacked', since: START });
    expect(world.tactics.kasimpasa).toBeUndefined(); // kadroyu yapay zekâ seçer
    expect(world.vacancies?.some((v) => v.clubId === 'kasimpasa')).toBe(true);

    // Bir sezon + sezon geçişi: kullanıcının maçı yok, eski kulübün maçları oynanır, çökme yok
    let userMatches = 0;
    let guard = 0;
    while (!world.gameOver && guard++ < 3000) {
      if (todaysUserFixture(world)) userMatches++;
      advance(world, gameData, { autoPlayUserMatch: true });
    }
    expect(userMatches).toBe(0);
    expect(world.history.length).toBe(1);
    expect(world.history[0]!.table.some((r) => r.clubId === 'kasimpasa')).toBe(true);
    expect(world.season.year).toBe(2027);
    // Kariyer sonu: işsizlik sınırında
    expect(world.gameOver?.reason).toMatch(/iş bulamadın/);
    expect(world.gameOver!.date >= addDays(START, UNEMPLOYMENT_LIMIT_DAYS)).toBe(true);
  }, 400_000);

  it('istifa: menajer işsiz kalır, itibar 3 düşer, sezon "istifa" olarak yazılır', () => {
    const world = createWorld(gameData, 62, 'goztepe', START);
    const before = managerReputation(world);
    expect(resignJob(world)).toBeNull();
    expect(world.unemployed?.reason).toBe('resigned');
    expect(managerReputation(world)).toBeCloseTo(before - 3, 5);
    expect(world.manager.seasons?.at(-1)).toMatchObject({ clubId: 'goztepe', left: 'resigned' });
    expect(resignJob(world)).toMatch(/çalışmıyorsun/);
  });
});

describe('işe geçiş', () => {
  it('işsizken teklif kabul edilince kulüp, yönetim hedefi, taktik ve antrenman kurulur; sonra kullanıcının maçı oynanır', () => {
    const world = createWorld(gameData, 63, 'goztepe', START);
    leaveClub(world, 'sacked', 'Deneme.');
    takeJob(world, 'konyaspor');
    const club = getClub(world, 'konyaspor');
    expect(world.playerClubId).toBe('konyaspor');
    expect(world.unemployed).toBeNull();
    expect(world.board.targetPosition).toBe(EXPECTATION_TARGET[club.fanExpectation]);
    expect(world.tactics.konyaspor?.lineup.length).toBeGreaterThan(0);
    expect(world.training.konyaspor).toBeDefined();
    expect(world.manager.clubSince).toBe(START);
    // Yeni kulübün ilk lig maçı kullanıcı maçı olarak gelir
    let guard = 0;
    while (!todaysUserFixture(world) && guard++ < 200) advance(world, gameData, { autoPlayUserMatch: false });
    expect(todaysUserFixture(world)).not.toBeNull();
  }, 200_000);

  it('görevdeyken başka kulübe geçiş: eski kulübün koltuğu boşalır, sezon "ayrıldı" olarak yazılır', () => {
    const world = createWorld(gameData, 64, 'goztepe', START);
    takeJob(world, 'besiktas');
    expect(world.playerClubId).toBe('besiktas');
    expect(world.tactics.goztepe).toBeUndefined();
    expect(world.vacancies?.some((v) => v.clubId === 'goztepe')).toBe(true);
    expect(world.manager.seasons?.at(-1)).toMatchObject({ clubId: 'goztepe', left: 'moved' });
  });

  it('ayrılırken süren inşaat eski kulüpte tamamlanır', () => {
    const world = createWorld(gameData, 65, 'goztepe', START);
    const level = world.facilities.levels.goztepe!.training;
    world.facilities.projects.push({ kind: 'training', target: level + 1, cost: 1, started: START, completes: addDays(START, 30) });
    leaveClub(world, 'resigned', 'Deneme.');
    expect(world.facilities.projects[0]!.clubId).toBe('goztepe');
    playUntil(world, addDays(START, 35));
    expect(world.facilities.levels.goztepe!.training).toBe(level + 1);
  }, 200_000);
});

describe('başvurular ve teklifler', () => {
  /** İşsiz menajer; belirli kulüpte uzun süre açık kalan boş koltuk. */
  function unemployedWithVacancy(clubId: string, reputation: number): GameWorld {
    const world = createWorld(gameData, 66, 'goztepe', START);
    leaveClub(world, 'sacked', 'Deneme.');
    world.manager.reputation = reputation;
    world.vacancies = [{ clubId, since: START, fillBy: addDays(START, 400) }];
    return world;
  }

  it('itibar yetmezse başvuru reddedilir, yeterse teklif gelir; teklif kabul edilince işe başlanır', () => {
    const club = 'galatasaray';
    const low = unemployedWithVacancy(club, requiredReputation(getClub(createWorld(gameData, 66, 'goztepe', START), club)) - 5);
    expect(applyForJob(low, club)).toBeNull();
    expect(applyForJob(low, club)).toMatch(/zaten başvurdun/);
    runJobsDays(low, 8);
    expect(low.jobOffers?.some((o) => o.clubId === club)).toBe(false);
    expect(low.news.some((n) => n.title.includes('başvurunu reddetti'))).toBe(true);

    const high = unemployedWithVacancy(club, 95);
    expect(fitsClub(high, getClub(high, club))).toBe(true);
    applyForJob(high, club);
    runJobsDays(high, 8);
    const offer = high.jobOffers?.find((o) => o.clubId === club);
    expect(offer?.via).toBe('application');
    expect(acceptJobOffer(high, offer!.id)).toBeNull();
    expect(high.playerClubId).toBe(club);
  });

  it('boş koltuk yoksa başvuru yapılamaz; reddedilen teklif listeden düşer', () => {
    const world = unemployedWithVacancy('konyaspor', 90);
    expect(applyForJob(world, 'trabzonspor')).toMatch(/boş koltuk yok/);
    untilOffer(world, 'konyaspor'); // haftalık kontroller: işsizken uygun koltuktan teklif gelir
    const offer = world.jobOffers?.find((o) => o.clubId === 'konyaspor');
    expect(offer?.via).toBe('offer');
    rejectJobOffer(world, offer!.id);
    expect(world.jobOffers?.some((o) => o.clubId === 'konyaspor')).toBe(false);
  });

  it('görevdeyken yalnızca daha itibarlı kulüpten ve kulüpte bir süre geçtikten sonra teklif gelir', () => {
    const world = createWorld(gameData, 67, 'goztepe', START);
    world.manager.reputation = 95;
    const own = getClub(world, 'goztepe').reputation;
    const weaker = world.clubs.find((c) => c.country === undefined && c.reputation < own && c.id !== 'goztepe')!;
    world.vacancies = [
      { clubId: 'galatasaray', since: START, fillBy: addDays(START, 400) },
      { clubId: weaker.id, since: START, fillBy: addDays(START, 400) },
    ];
    runJobsDays(world, 60); // ilk 120 gün yeni kulüpte: teklif yok
    expect(world.jobOffers ?? []).toHaveLength(0);
    runJobsDays(world, 120);
    expect(world.jobOffers?.some((o) => o.clubId === 'galatasaray')).toBe(true);
    expect(world.jobOffers?.some((o) => o.clubId === weaker.id)).toBe(false);
  });

  it('teklif süresi dolunca düşer', () => {
    const world = unemployedWithVacancy('konyaspor', 90);
    untilOffer(world, 'konyaspor');
    const offer = world.jobOffers?.find((o) => o.clubId === 'konyaspor')!;
    world.date = addDays(offer.expires, -1);
    runJobsDays(world, 1);
    expect(world.jobOffers?.some((o) => o.id === offer.id)).toBe(false);
  });

  it('iş piyasası ana dünyanın rastgelelik akışını değiştirmez', () => {
    const world = unemployedWithVacancy('konyaspor', 90);
    const state = world.rngState;
    runJobsDays(world, 40);
    expect(world.rngState).toBe(state);
  });
});
