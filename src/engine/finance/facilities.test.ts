import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { addDays } from '../date';
import { clubPlayers, createWorld, generateYouthPlayer, getClub } from '../generation/worldGenerator';
import { migrateWorld } from '../migrate';
import { Rng } from '../rng';
import { injurePlayer } from '../squad/injuries';
import type { GameWorld } from '../types';
import {
  facilitiesDay,
  facilityLevel,
  levelForReputation,
  maintenancePerYear,
  payFacilityMaintenance,
  REQUEST_COOLDOWN_DAYS,
  requestBlocker,
  requestFacility,
  STADIUM_STEP,
  trainingDevelopmentFactor,
  upgradeCost,
  youthFacilityBonus,
} from './facilities';

const START = '2026-07-01';

function rich(world: GameWorld): GameWorld {
  world.finances[world.playerClubId]!.balance = 500_000_000;
  world.board.confidence = 80;
  return world;
}

describe('tesis seviyeleri', () => {
  const world = createWorld(gameData, 1, 'galatasaray', START);

  it('Türkiye kulüpleri itibarına göre başlar; yurtdışı kulübünde seviye itibardan', () => {
    for (const club of world.clubs.filter((c) => c.country === undefined)) {
      const l = world.facilities.levels[club.id]!;
      for (const kind of ['training', 'youth', 'medical'] as const) expect(Math.abs(l[kind] - levelForReputation(club.reputation))).toBeLessThanOrEqual(1);
    }
    expect(facilityLevel(world, 'galatasaray', 'training')).toBeGreaterThan(facilityLevel(world, 'erzurumspor', 'training'));
    const giant = world.clubs.find((c) => c.country !== undefined && c.reputation >= 115)!;
    expect(facilityLevel(world, giant.id, 'training')).toBe(10);
  });

  it('etkiler seviyeyle artar; yüksek seviye daha pahalı', () => {
    expect(trainingDevelopmentFactor(10)).toBeGreaterThan(trainingDevelopmentFactor(1));
    expect(youthFacilityBonus(10).potential).toBeGreaterThan(youthFacilityBonus(1).potential);
    const w = createWorld(gameData, 1, 'galatasaray', START);
    w.facilities.levels.galatasaray!.training = 3;
    const low = upgradeCost(w, 'galatasaray', 'training');
    w.facilities.levels.galatasaray!.training = 8;
    expect(upgradeCost(w, 'galatasaray', 'training')).toBeGreaterThan(low * 3);
  });
});

describe('yönetimden yatırım isteği', () => {
  it('kasa ve güven yeterse onaylanır: bedel kasadan, inşaat bitince seviye yükselir', () => {
    const world = rich(createWorld(gameData, 2, 'samsunspor', START));
    const before = facilityLevel(world, 'samsunspor', 'training');
    const cost = upgradeCost(world, 'samsunspor', 'training');
    const balance = world.finances.samsunspor!.balance;
    const outcome = requestFacility(world, 'training');
    expect(outcome.approved).toBe(true);
    expect(world.finances.samsunspor!.balance).toBe(balance - cost);
    expect(requestBlocker(world, 'training')).toBe('İnşaat sürüyor.');
    if (!outcome.approved) return;
    world.date = addDays(outcome.project.completes, -1);
    facilitiesDay(world);
    expect(facilityLevel(world, 'samsunspor', 'training')).toBe(before);
    world.date = outcome.project.completes;
    facilitiesDay(world);
    expect(facilityLevel(world, 'samsunspor', 'training')).toBe(before + 1);
    expect(world.facilities.projects).toHaveLength(0);
  });

  it('stadyum genişletmesi 1 Temmuz\'da biter ve kapasiteyi artırır', () => {
    const world = rich(createWorld(gameData, 3, 'eyupspor', START));
    const capacity = getClub(world, 'eyupspor').capacity;
    const outcome = requestFacility(world, 'stadium');
    expect(outcome.approved).toBe(true);
    if (!outcome.approved) return;
    expect(outcome.project.completes.endsWith('-07-01')).toBe(true);
    world.date = outcome.project.completes;
    facilitiesDay(world);
    expect(getClub(world, 'eyupspor').capacity).toBe(capacity + STADIUM_STEP);
  });

  it('güven ya da kasa yetmezse reddedilir; 60 gün sonra yeniden istenebilir', () => {
    const world = rich(createWorld(gameData, 4, 'konyaspor', START));
    world.board.confidence = 10;
    const outcome = requestFacility(world, 'medical');
    expect(outcome.approved).toBe(false);
    expect(requestBlocker(world, 'medical')).toMatch(/reddetti/);
    world.date = addDays(world.date, REQUEST_COOLDOWN_DAYS);
    expect(requestBlocker(world, 'medical')).toBeNull();
    world.board.confidence = 80;
    world.finances.konyaspor!.balance = 100_000;
    const poor = requestFacility(world, 'medical');
    expect(poor.approved).toBe(false);
    if (!poor.approved) expect(poor.reason).toMatch(/kasası/);
  });

  it('itibarlı menajer daha az güvenle yatırım alır', () => {
    const world = rich(createWorld(gameData, 5, 'kasimpasa', START));
    world.board.confidence = 45;
    world.manager.reputation = 15;
    expect(requestFacility(world, 'youth').approved).toBe(false);
    world.facilities.rejected = {};
    world.manager.reputation = 90;
    expect(requestFacility(world, 'youth').approved).toBe(true);
  });
});

describe('tesislerin etkisi', () => {
  it('ay başı bakım gideri', () => {
    const world = createWorld(gameData, 6, 'galatasaray', START);
    const fin = world.finances.galatasaray!;
    const before = fin.current.expense.facilities;
    payFacilityMaintenance(world);
    expect(fin.current.expense.facilities - before).toBeCloseTo(maintenancePerYear(world, 'galatasaray') / 12, -1);
  });

  it('sağlık merkezi sakatlığı kısaltır', () => {
    const days = (medical: number) => {
      const world = createWorld(gameData, 7, 'galatasaray', START);
      world.facilities.levels.galatasaray!.medical = medical;
      const p = clubPlayers(world, 'galatasaray')[0]!;
      injurePlayer(world, p, new Rng(42), 'training');
      return p.injury!.daysOut;
    };
    expect(days(10)).toBeLessThan(days(1));
  });

  it('altyapı tesisi U19 gençlerini iyileştirir (aynı tohumla)', () => {
    const world = createWorld(gameData, 8, 'galatasaray', START);
    const club = getClub(world, 'galatasaray');
    const young = (level: number) => generateYouthPlayer(new Rng(7), gameData, club, START, 99999, [15, 16], youthFacilityBonus(level));
    expect(young(10).potentialAbility).toBeGreaterThan(young(1).potentialAbility);
    expect(young(10).currentAbility).toBeGreaterThanOrEqual(young(1).currentAbility);
  });
});

describe('kayıt dönüşümü (biçim 15 → 16)', () => {
  it('tesisler itibardan kurulur, finans dökümüne tesis gideri eklenir', () => {
    const world = createWorld(gameData, 9, 'trabzonspor', START);
    const raw = structuredClone(world) as Partial<GameWorld>;
    delete raw.facilities;
    for (const fin of Object.values(raw.finances!)) delete (fin.current.expense as Partial<typeof fin.current.expense>).facilities;
    const migrated = migrateWorld(raw, 15, gameData);
    expect(migrated.facilities.levels.trabzonspor).toBeDefined();
    expect(migrated.finances.trabzonspor!.current.expense.facilities).toBe(0);
  });
});
