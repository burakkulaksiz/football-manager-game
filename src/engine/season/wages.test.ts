import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { Rng } from '../rng';
import { aiRenewalWage, aiSigningWage, CORE_RENEW_RANK, fairWage, wageDemand } from '../transfer/market';
import { processExpiringContracts } from './rollover';

const JUNE_30 = '2027-06-30';

describe('yapay zekâ maaşları: zam sarmalı yok', () => {
  const world = createWorld(gameData, 81, 'galatasaray', '2026-07-01');
  const club = 'fenerbahce';
  const player = clubPlayers(world, club).sort((a, b) => b.currentAbility - a.currentAbility)[0]!;

  it('yenilemede eski maaşa zam yapılmaz; kullanıcıyla pazarlıktaki talep (wageDemand) ise zamlıdır', () => {
    const fair = fairWage(world, player, club);
    player.contract.wage = Math.round(fair * 2); // adil maaşın çok üstünde
    // Eski maaş korunur (yuvarlama payıyla); %5 zam yok
    expect(aiRenewalWage(world, player, club)).toBeGreaterThanOrEqual(player.contract.wage * 0.98);
    expect(aiRenewalWage(world, player, club)).toBeLessThanOrEqual(player.contract.wage * 1.02);
    expect(wageDemand(world, player, club)).toBeGreaterThanOrEqual(player.contract.wage * 1.05 - 1000);
  });

  it('adil maaşın altındaki oyuncunun maaşı adil seviyeye çıkar', () => {
    player.contract.wage = Math.round(fairWage(world, player, club) * 0.3);
    // Adil maaş kulübün maaş toplamına bağlı (clubWageScale): değişiklikten sonra okunur
    const fair = fairWage(world, player, club);
    expect(aiRenewalWage(world, player, club)).toBeGreaterThanOrEqual(fair * 0.98);
    expect(aiRenewalWage(world, player, club)).toBeGreaterThan(player.contract.wage);
  });

  it('yeni imzada adil maaş ödenir (eski maaşın ×1,1\'i değil)', () => {
    player.contract.wage = Math.round(fairWage(world, player, club) * 3);
    const fair = fairWage(world, player, club);
    expect(Math.abs(aiSigningWage(world, player, club) - fair)).toBeLessThanOrEqual(fair * 0.03); // roundNice yuvarlaması
    expect(wageDemand(world, player, club)).toBeGreaterThan(aiSigningWage(world, player, club));
  });
});

describe('sözleşme bitişlerinde maaş bütçesi (30 Haziran)', () => {
  /** Kulübün bütün sözleşmelerini bugün bitecek hâle getirir. */
  function expireAll(clubId: string) {
    const world = createWorld(gameData, 82, 'galatasaray', '2026-07-01');
    world.date = JUNE_30;
    for (const p of clubPlayers(world, clubId)) p.contract.expires = JUNE_30;
    return world;
  }

  it('maaş bütçesi dolunca yedekler gider, çekirdek (ilk 11) kalır', () => {
    const world = expireAll('besiktas');
    const ranked = clubPlayers(world, 'besiktas').sort((a, b) => b.currentAbility - a.currentAbility);
    world.finances.besiktas!.wageBudget = 1;
    processExpiringContracts(world, new Rng(5));
    const kept = new Set(clubPlayers(world, 'besiktas').map((p) => p.id));
    for (const p of ranked.slice(0, CORE_RENEW_RANK)) expect(kept.has(p.id), `çekirdek oyuncu ${p.id}`).toBe(true);
    for (const p of ranked.slice(CORE_RENEW_RANK)) expect(kept.has(p.id), `yedek ${p.id}`).toBe(false);
  });

  it('bol bütçede (yaş sınırını aşmayan) yedekler de yenilenir; yenilenenlerin maaşı artmaz', () => {
    const world = expireAll('besiktas');
    const before = new Map(clubPlayers(world, 'besiktas').map((p) => [p.id, p.contract.wage]));
    world.finances.besiktas!.wageBudget = 10_000_000_000;
    processExpiringContracts(world, new Rng(5));
    const renewed = clubPlayers(world, 'besiktas');
    expect(renewed.length).toBeGreaterThanOrEqual(11);
    for (const p of renewed) {
      expect(p.contract.expires > JUNE_30).toBe(true);
      // Zam yok: yeni maaş eskisinin üstünde yalnızca adil maaş eskisinden yüksekse (kulübün ölçeği değişmez, küçük yuvarlama payı)
      expect(p.contract.wage).toBeLessThanOrEqual(Math.max(before.get(p.id)!, fairWage(world, p, 'besiktas')) * 1.02 + 1000);
    }
  });
});
