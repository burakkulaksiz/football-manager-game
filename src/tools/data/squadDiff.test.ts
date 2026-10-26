import { describe, expect, it } from 'vitest';
import type { SquadPlayerData } from '../../engine/data';
import { diffSquads, formatDiff } from './squadDiff';

const p = (lastName: string, over: Partial<SquadPlayerData> = {}): SquadPlayerData => ({
  firstName: 'Ali', lastName, born: '1998-05-10', nationality: 'TUR', positions: ['MC'], ability: 12, marketValue: 1_000_000, ...over,
});

describe('kadro değişiklik raporu', () => {
  it('gelen, giden, kulüp değiştiren ve bilgisi değişen oyuncular', () => {
    const before = { a: { players: [p('Kalan'), p('Giden'), p('Transfer')] }, b: { players: [] } };
    const after = {
      a: { players: [p('Kalan', { marketValue: 2_500_000, positions: ['DM'], ability: 13 }), p('Yeni')] },
      b: { players: [p('Transfer')] },
    };
    const diff = diffSquads(before, after);
    expect(diff.arrived.map((r) => r.name)).toEqual(['Ali Yeni']);
    expect(diff.left.map((r) => r.name)).toEqual(['Ali Giden']);
    expect(diff.moved).toEqual([{ name: 'Ali Transfer', from: 'a', to: 'b' }]);
    expect(diff.changed).toEqual([{ name: 'Ali Kalan', clubId: 'a', changes: ['değer €1 M → €2.5 M', 'mevki MC → DM', 'güç 12 → 13'] }]);
  });

  it('aynı veride fark yok; ad aynı ama doğum yılı farklıysa başka oyuncu', () => {
    const squads = { a: { players: [p('Aynı')] } };
    expect(diffSquads(squads, structuredClone(squads))).toEqual({ arrived: [], left: [], moved: [], changed: [] });
    const diff = diffSquads(squads, { a: { players: [p('Aynı', { born: 2003 })] } });
    expect([diff.arrived.length, diff.left.length]).toEqual([1, 1]);
  });

  it('rapor özet satırı ve boş olmayan bölümler', () => {
    const md = formatDiff(diffSquads({ a: { players: [] } }, { a: { players: [p('Yeni', { marketValue: 450_000 })] } }), 'HEAD → çalışma kopyası');
    expect(md).toContain('Gelen 1 · Giden 0 · Kulüp değiştiren 0 · Bilgisi değişen 0');
    expect(md).toContain('## Gelen (1)\n- a: Ali Yeni (MC, 1998, €450 bin)');
    expect(md).not.toContain('## Giden');
  });
});
