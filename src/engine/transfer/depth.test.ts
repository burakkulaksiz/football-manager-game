import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { totalWages } from '../finance/finance';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { retirementChance } from '../season/rollover';
import type { GameWorld, Player } from '../types';
import { fillAiDepth, groupLevel, MIN_AI_SQUAD } from './ai';
import { releasePlayer } from './market';

const START = '2026-07-10';

/**
 * Kulübün orta sıradaki `count` yedeğini serbest bırakır (kadro MIN_AI_SQUAD altına iner). En zayıflar seçilmez:
 * güçlü kulüp, ilk 11 seviyesinin 30'dan fazla altındaki oyuncuyu zaten almaz (bkz. fillAiDepth).
 */
function thin(world: GameWorld, clubId: string, count: number): Player[] {
  const ranked = clubPlayers(world, clubId).sort((a, b) => b.currentAbility - a.currentAbility);
  const middle = ranked.slice(12, 12 + count);
  for (const p of middle) releasePlayer(world, p);
  return middle;
}

describe('yapay zekâ kadro tamamlama (fillAiDepth)', () => {
  it('kadrosu MIN_AI_SQUAD altına inen yapay zekâ kulübü serbest oyunculardan yedek alır', () => {
    const world = createWorld(gameData, 71, 'galatasaray', START);
    const released = thin(world, 'fenerbahce', 9);
    expect(clubPlayers(world, 'fenerbahce').length).toBeLessThan(MIN_AI_SQUAD);
    // Her gün %35 olasılık: bir ay yeter
    for (let day = 0; day < 40 && clubPlayers(world, 'fenerbahce').length < MIN_AI_SQUAD; day++) {
      world.date = `2026-07-${String(10 + (day % 20)).padStart(2, '0')}`;
      fillAiDepth(world);
    }
    expect(clubPlayers(world, 'fenerbahce').length).toBeGreaterThanOrEqual(MIN_AI_SQUAD);
    // Alınanlar serbest oyunculardı: bedelsiz transfer olarak kaydedildi
    const signed = clubPlayers(world, 'fenerbahce').filter((p) => p.moves?.some((m) => m.kind === 'free' && m.toClubId === 'fenerbahce'));
    expect(signed.length).toBeGreaterThan(0);
    expect(signed.length).toBeLessThanOrEqual(released.length + 5);
  });

  it('kullanıcının kulübüne dokunmaz', () => {
    const world = createWorld(gameData, 72, 'galatasaray', START);
    thin(world, 'galatasaray', 9);
    const before = clubPlayers(world, 'galatasaray').length;
    for (let i = 0; i < 30; i++) fillAiDepth(world);
    expect(clubPlayers(world, 'galatasaray').length).toBe(before);
  });

  it('kadrosu yeterli kulübe oyuncu vermez; serbest oyuncu sayısı yalnızca azalır', () => {
    const world = createWorld(gameData, 73, 'galatasaray', START);
    const sizes = new Map(world.clubs.map((c) => [c.id, clubPlayers(world, c.id).length]));
    thin(world, 'besiktas', 6);
    const freeBefore = Object.values(world.players).filter((p) => !p.clubId && !p.academy).length;
    for (let i = 0; i < 30; i++) fillAiDepth(world);
    const freeAfter = Object.values(world.players).filter((p) => !p.clubId && !p.academy).length;
    expect(freeAfter).toBeLessThanOrEqual(freeBefore);
    for (const c of world.clubs) {
      if (c.id === 'besiktas' || c.id === world.playerClubId) continue;
      const was = sizes.get(c.id)!;
      if (was >= MIN_AI_SQUAD) expect(clubPlayers(world, c.id).length).toBe(was);
    }
  });

  it('maaş bütçesini aşan oyuncuyu almaz', () => {
    const world = createWorld(gameData, 74, 'galatasaray', START);
    thin(world, 'fenerbahce', 9);
    // Bütçe, mevcut maaş toplamının altına çekilir: hiçbir oyuncuya yer kalmaz
    world.finances.fenerbahce!.wageBudget = totalWages(clubPlayers(world, 'fenerbahce'), 'fenerbahce') - 1;
    const before = clubPlayers(world, 'fenerbahce').length;
    for (let i = 0; i < 40; i++) fillAiDepth(world);
    expect(clubPlayers(world, 'fenerbahce').length).toBe(before);
  });

  it('aynı dünya ve gün aynı sonucu verir (kendi rastgelelik akışı, belirleyici)', () => {
    const run = () => {
      const world = createWorld(gameData, 75, 'galatasaray', START);
      thin(world, 'trabzonspor', 8);
      for (let i = 0; i < 10; i++) fillAiDepth(world);
      return clubPlayers(world, 'trabzonspor').map((p) => p.id).sort((a, b) => a - b);
    };
    expect(run()).toEqual(run());
  });
});

describe('mevki grubu seviyesi (groupLevel)', () => {
  const mk = (pos: string, ca: number) => ({ positions: { [pos]: 20 }, currentAbility: ca }) as unknown as Player;

  it('grubun ilk 11 sayısı kadar en iyi oyuncusunun ortalaması: kaleci 1, defans 4, forvet 3', () => {
    const squad = [mk('GK', 110), mk('GK', 130), mk('DC', 120), mk('DC', 124), mk('DL', 128), mk('DR', 132), mk('DC', 90), mk('ST', 150), mk('ST', 140), mk('AMC', 130), mk('ST', 100)];
    expect(groupLevel(squad, 'GK', 0)).toBe(130);
    expect(groupLevel(squad, 'DEF', 0)).toBe((120 + 124 + 128 + 132) / 4);
    expect(groupLevel(squad, 'ATT', 0)).toBe((150 + 140 + 130) / 3);
  });

  it('grupta oyuncu yoksa yedek değer döner', () => {
    expect(groupLevel([mk('ST', 150)], 'GK', 77)).toBe(77);
  });
});

describe('işsiz oyuncuların emekliliği', () => {
  const player = (clubId: string | null, ca: number): Player => ({ clubId, currentAbility: ca }) as Player;

  it('işsiz oyuncu aynı yaş ve seviyedeki kulüp oyuncusundan daha çabuk bırakır', () => {
    expect(retirementChance(player(null, 95), 26)).toBeGreaterThan(retirementChance(player('x', 95), 26));
    expect(retirementChance(player(null, 120), 26)).toBeGreaterThan(retirementChance(player('x', 120), 26));
  });

  it('işsiz ve düşük seviyeli oyuncu daha çok bırakır; genç işsizler (24 altı) bırakmaz', () => {
    expect(retirementChance(player(null, 90), 27)).toBeGreaterThan(retirementChance(player(null, 120), 27));
    expect(retirementChance(player(null, 90), 22)).toBe(0);
  });

  it('31+ yaşta işsizlik emekliliği hızlandırır, 38 yaşta kesin emeklilik', () => {
    expect(retirementChance(player(null, 120), 32)).toBeCloseTo(0.4, 5);
    expect(retirementChance(player('x', 120), 32)).toBe(0);
    expect(retirementChance(player('x', 120), 38)).toBe(1);
  });
});
