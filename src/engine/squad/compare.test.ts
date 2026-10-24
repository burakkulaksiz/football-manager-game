import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { primaryPosition } from '../player';
import { groupOf } from '../transfer/market';
import { knowledgeOf } from '../transfer/scouting';
import { compareAdvice, MAX_COMPARE } from './compare';

const world = createWorld(gameData, 8, 'galatasaray', '2026-07-01');
const own = clubPlayers(world, 'galatasaray');
const kinds = (notes: ReturnType<typeof compareAdvice>) => notes.map((n) => n.kind);

describe('karşılaştırmada yardımcı antrenör notu', () => {
  it('en çok 4 oyuncu; tek oyuncuda not yok', () => {
    expect(MAX_COMPARE).toBe(4);
    expect(compareAdvice(world, own.slice(0, 1))).toEqual([]);
  });

  it('aynı mevkideki kendi oyuncularımızda öneri, en iyi / fark az ve ilk 11 notu', () => {
    const mids = own.filter((p) => groupOf(primaryPosition(p)) === 'MID').slice(0, 3);
    const notes = compareAdvice(world, mids);
    expect(kinds(notes)[0]).toBe('pick');
    expect(kinds(notes).some((k) => k === 'best' || k === 'close')).toBe(true);
    const lineup = world.tactics[world.playerClubId]!.lineup;
    const inXI = notes.find((n) => n.kind === 'inXI');
    expect(inXI?.playerIds ?? []).toEqual(mids.filter((p) => lineup.includes(p.id)).map((p) => p.id));
    // Kendi oyuncularımız için gözlemci görüşü ve fiyat/performans yok
    expect(kinds(notes)).not.toContain('fitsXI');
    expect(kinds(notes)).not.toContain('value');
  });

  it('sakat oyuncu önerilmez ve sakat notu çıkar', () => {
    const [a, b] = own.filter((p) => groupOf(primaryPosition(p)) === 'ATT').sort((x, y) => y.currentAbility - x.currentAbility);
    const injured = structuredClone(world);
    injured.players[a!.id]!.injury = { name: 'Darbe', daysOut: 5 };
    const notes = compareAdvice(injured, [injured.players[a!.id]!, injured.players[b!.id]!]);
    expect(notes.find((n) => n.kind === 'pick')!.playerIds).toEqual([b!.id]);
    expect(notes.find((n) => n.kind === 'injured')!.playerIds).toEqual([a!.id]);
  });

  it('farklı mevkiler uyarısı (öneri yok); başka kulübün oyuncusunda gözlemci görüşü, az bilinende gözlemci önerisi', () => {
    const keeper = own.find((p) => primaryPosition(p) === 'GK')!;
    const striker = own.find((p) => primaryPosition(p) === 'ST')!;
    expect(kinds(compareAdvice(world, [keeper, striker]))).toContain('mixedPositions');
    expect(kinds(compareAdvice(world, [keeper, striker]))).not.toContain('pick');

    const rival = clubPlayers(world, 'erzurumspor').filter((p) => groupOf(primaryPosition(p)) === 'ATT');
    const notes = compareAdvice(world, [striker, ...rival.slice(0, 2)]);
    const verdicts = notes.filter((n) => ['fitsXI', 'rotation', 'prospect', 'notNeeded'].includes(n.kind)).flatMap((n) => n.playerIds);
    expect(verdicts.sort()).toEqual(rival.slice(0, 2).map((p) => p.id).sort());
    const unknown = rival.slice(0, 2).filter((p) => knowledgeOf(world, p) < 45).map((p) => p.id);
    if (unknown.length > 0) expect(notes.find((n) => n.kind === 'unknown')!.playerIds).toEqual(unknown);
  });
});
