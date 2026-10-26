import { describe, expect, it } from 'vitest';
import clubs from '../../../data/clubs.json';
import foreignClubs from '../../../data/foreign_clubs.json';
import lowerClubs from '../../../data/lower_league.json';
import nations from '../../../data/nations.json';
import type { SquadData, SquadPlayerData } from '../../engine/data';
import { gameData } from '../../gameData';
import { checkData, checkSquads, formatIssues } from './squadCheck';

const TODAY = '2026-07-01';

let next = 0;
function player(over: Partial<SquadPlayerData> = {}): SquadPlayerData {
  next++;
  return { firstName: 'Ali', lastName: `Oyuncu${next}`, born: '1998-05-10', nationality: 'TUR', positions: ['MC'], ability: 12, ...over };
}

/** Dengeli 24 kişilik kadro: 3 kaleci, 8 defans, 8 orta saha, 5 hücum. */
function squad(extra: SquadPlayerData[] = []): SquadData {
  const line = (pos: SquadPlayerData['positions'], n: number) => Array.from({ length: n }, () => player({ positions: pos }));
  return { players: [...line(['GK'], 3), ...line(['DC'], 8), ...line(['MC'], 8), ...line(['ST'], 5), ...extra] };
}

const texts = (s: Record<string, SquadData>) => checkSquads(s, TODAY).map((i) => `${i.level}: ${i.text}`);

describe('veri denetimi', () => {
  it('düzgün kadroda sorun yok', () => {
    expect(checkSquads({ a: squad() }, TODAY)).toEqual([]);
  });

  it('imkânsız yaş ve takvimde olmayan doğum tarihi hata; çok yaşlı uyarı', () => {
    const t = texts({ a: squad([player({ born: '2014-01-01' }), player({ born: '2001-02-30' }), player({ born: 1980 })]) });
    expect(t).toContainEqual(expect.stringMatching(/^error: imkânsız yaş: 12/));
    expect(t).toContainEqual(expect.stringMatching(/^error: doğum tarihi takvimde yok/));
    expect(t).toContainEqual(expect.stringMatching(/^warning: yaşı çok büyük: 46/));
  });

  it('imkânsız piyasa değeri, sözleşmeden sonra katılış hata; güçten düşük potansiyel, bitmiş sözleşme uyarı', () => {
    const t = texts({
      a: squad([
        player({ marketValue: 0 }),
        player({ joined: '2028-01-01', contractExpires: 2027 }),
        player({ potential: 10, ability: 14 }),
        player({ contractExpires: '2026-06-30' }),
      ]),
    });
    expect(t).toContainEqual(expect.stringMatching(/^error: imkânsız piyasa değeri/));
    expect(t).toContainEqual(expect.stringMatching(/^error: kulübe katılışı \(2028-01-01\) sözleşme bitişinden/));
    expect(t).toContainEqual(expect.stringMatching(/^warning: potansiyel \(10\) güçten \(14\) düşük/));
    expect(t).toContainEqual(expect.stringMatching(/^warning: sözleşmesi sezon başından önce bitmiş/));
  });

  it('kaleci + oyuncu mevkisi ters mevki uyarısı', () => {
    expect(texts({ a: squad([player({ positions: ['GK', 'ST'] })]) })).toContainEqual(expect.stringMatching(/^warning: ters mevki/));
  });

  it('aynı kadroda yinelenen oyuncu hata, başka kadroda da olan uyarı', () => {
    const twin = player();
    const t = texts({ a: squad([twin, { ...twin }]), b: squad([{ ...twin }]) });
    expect(t).toContainEqual('error: aynı kadroda iki kez');
    expect(t).toContainEqual(expect.stringMatching(/^warning: squads\/a\.json kadrosunda da var/));
  });

  it('kadro büyüklüğü ve mevki dengesi uyarıları', () => {
    const small = { players: squad().players.filter((p) => !Array.isArray(p.positions) || p.positions[0] !== 'GK').slice(0, 10) };
    const t = texts({ a: small, b: squad(Array.from({ length: 20 }, () => player())) });
    expect(t).toContainEqual(expect.stringMatching(/^warning: kadro küçük: 10/));
    expect(t).toContainEqual(expect.stringMatching(/^warning: kadro büyük: 44/));
    expect(t).toContainEqual(expect.stringMatching(/^warning: mevki dengesi: kaleci 0 \(en az 2\)/));
  });

  it('yapı hataları (bilinmeyen kulüp / uyruk) açılış doğrulamasından gelir', () => {
    const raw = { clubs, lowerClubs, foreignClubs, nations, namePools: gameData.namePools, squads: { yok: squad([player({ nationality: 'XXX' })]) } };
    const issues = checkData(raw, TODAY);
    expect(issues.every((i) => i.level === 'error')).toBe(true);
    expect(issues.map((i) => i.text)).toContainEqual(expect.stringMatching(/'yok' adında kulüp yok/));
    expect(issues.map((i) => i.text)).toContainEqual(expect.stringMatching(/uyruk 'XXX' nations\.json'da yok/));
  });

  it('gerçek data/ klasöründe hata yok', () => {
    const raw = { clubs, lowerClubs, foreignClubs, nations, namePools: gameData.namePools, squads: gameData.squads };
    expect(checkData(raw, TODAY).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('rapor önce hataları sonra uyarıları sayar', () => {
    const out = formatIssues([{ level: 'warning', where: 'w', text: 'u' }, { level: 'error', where: '', text: 'h' }], 'Özet');
    expect(out).toBe('Özet\n\nHatalar (1)\n  - h\n\nUyarılar (1)\n  - w: u');
  });
});
