/** Menajer kartı kayıt dönüşümü (biçim 14 → 15). Tam sezon oynattığı için manager.test.ts'ten ayrı dosyada (paralel koşsun). */
import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { advance } from '../gameFlow';
import { createWorld } from '../generation/worldGenerator';
import { migrateWorld } from '../migrate';
import { playSeason } from '../testing';

const START = '2026-07-01';

describe('kayıt dönüşümü (biçim 14 → 15)', () => {
  it('itibar geçmiş başarılardan, kariyer sezonları arşivden', () => {
    const world = createWorld(gameData, 8, 'besiktas', START);
    playSeason(world);
    advance(world, gameData);
    const raw = structuredClone(world);
    for (const k of ['background', 'reputation', 'reputationHistory', 'seasons', 'bestWin', 'worstDefeat'] as const) delete raw.manager[k];
    const migrated = migrateWorld(raw, 14, gameData);
    expect(migrated.manager.background).toBe('player');
    expect(migrated.manager.reputation).toBeGreaterThanOrEqual(35);
    expect(migrated.manager.seasons).toEqual([expect.objectContaining({ year: 2026, clubId: 'besiktas', position: world.history[0]!.userPosition })]);
    expect(migrated.manager.reputationHistory).toHaveLength(1);
  }, 60_000);
});
