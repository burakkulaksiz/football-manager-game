import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { addDays } from '../date';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { FORMATIONS } from '../match/formation';
import { ageOn } from '../player';
import { makeResult } from '../testing';
import type { GameWorld, Player } from '../types';
import { academyPlayers } from './academy';
import { assistantAdvice, CAPABLE_FAMILIARITY, type AdviceKind } from './assistant';

const START = '2026-07-01';
const fresh = () => createWorld(gameData, 61, 'trabzonspor', START);
const kinds = (w: GameWorld) => assistantAdvice(w).map((a) => a.kind);
const find = (w: GameWorld, kind: AdviceKind) => assistantAdvice(w).filter((a) => a.kind === kind);
/** Taktikteki ilk 11'in i. oyuncusu ve mevkisi. */
function starter(w: GameWorld, i: number): { p: Player; slot: string } {
  const t = w.tactics[w.playerClubId]!;
  return { p: w.players[t.lineup[i]!]!, slot: FORMATIONS[t.formation][i]! };
}

describe('yardımcı antrenör: ilk 11', () => {
  it('sakat ve cezalı ilk 11 oyuncusu en önemli uyarı (ilk sırada), gün / maç sayısıyla', () => {
    const w = fresh();
    const a = starter(w, 3).p;
    const b = starter(w, 7).p;
    a.injury = { name: 'Arka adale', daysOut: 12 };
    b.suspension = 2;
    const advice = assistantAdvice(w);
    expect(advice[0]!.severity).toBe('high');
    const unavailable = advice.filter((x) => x.kind === 'unavailableStarter');
    expect(unavailable.find((x) => x.playerIds[0] === a.id)).toMatchObject({ reason: 'injury', value: 12 });
    expect(unavailable.find((x) => x.playerIds[0] === b.id)).toMatchObject({ reason: 'suspension', value: 2 });
  });

  it('mevkisinin yabancısı olan oyuncu verim yüzdesiyle; yedekte daha iyi seçenek önerilir', () => {
    const w = fresh();
    const t = w.tactics[w.playerClubId]!;
    // Kaleciyi santrfor mevkisine koy
    const keeperId = t.lineup[0]!;
    const stIndex = FORMATIONS[t.formation].lastIndexOf('ST');
    const st = t.lineup[stIndex]!;
    t.lineup[stIndex] = keeperId;
    t.lineup[0] = st;
    const out = find(w, 'outOfPosition').find((x) => x.playerIds[0] === keeperId)!;
    expect(out.slot).toBe('ST');
    expect(out.value).toBeLessThan(85);
    expect(find(w, 'betterOption').some((x) => x.playerIds[0] === keeperId && x.slot === 'ST')).toBe(true);
  });

  it('maça az kala yorgun ilk 11 oyuncusu', () => {
    const w = fresh();
    const next = w.season.fixtures.filter((f) => f.homeId === w.playerClubId || f.awayId === w.playerClubId).sort((a, b) => a.date.localeCompare(b.date))[0]!;
    const p = starter(w, 5).p;
    p.condition = 62;
    expect(find(w, 'tiredStarter')).toHaveLength(0); // maça haftalar var
    w.date = addDays(next.date, -1);
    expect(find(w, 'tiredStarter').find((x) => x.playerIds[0] === p.id)?.value).toBe(62);
  });
});

describe('yardımcı antrenör: kadro', () => {
  it('mevkide yedek yoksa orta, hiç oynayabilen yoksa yüksek önem', () => {
    const w = fresh();
    const squad = clubPlayers(w, w.playerClubId);
    const capableDL = () => squad.filter((p) => (p.positions.DL ?? 0) >= CAPABLE_FAMILIARITY);
    const { p: leftBack } = starter(w, FORMATIONS[w.tactics[w.playerClubId]!.formation].indexOf('DL'));
    for (const p of capableDL()) if (p.id !== leftBack.id) p.positions.DL = 10;
    expect(find(w, 'thinPosition').find((x) => x.slot === 'DL')).toMatchObject({ severity: 'medium', value: 1 });
    leftBack.positions.DL = 10;
    expect(find(w, 'thinPosition').find((x) => x.slot === 'DL')).toMatchObject({ severity: 'high', value: 0 });
  });

  it('önemli oyuncuların biten sözleşmeleri tek öneride; sezon ilerledikçe önemi artar', () => {
    const w = fresh();
    const best = [...clubPlayers(w, w.playerClubId)].sort((a, b) => b.currentAbility - a.currentAbility)[0]!;
    best.contract.expires = '2027-06-30';
    const advice = find(w, 'expiringContract');
    expect(advice).toHaveLength(1);
    expect(advice[0]!.playerIds).toContain(best.id);
    expect(advice[0]!.severity).toBe('low');
    w.date = '2027-01-15';
    expect(find(w, 'expiringContract')[0]!.severity).toBe('medium');
    w.date = '2027-04-10';
    expect(find(w, 'expiringContract')[0]!.severity).toBe('high');
  });

  it('kalabalık / dar kadro ve maaş bütçesi aşımı', () => {
    const w = fresh();
    const squad = clubPlayers(w, w.playerClubId);
    for (const p of squad.slice(0, squad.length - 18)) p.clubId = null; // → 18
    expect(kinds(w)).toContain('squadTooSmall');
    for (const p of squad) p.contract.wage *= 3;
    expect(find(w, 'wagesOver')[0]!.value).toBeGreaterThan(100);
  });
});

describe('yardımcı antrenör: gençler', () => {
  it("U19 yaş sınırını geçenler ve A takıma hazır U19'lu", () => {
    const w = fresh();
    const [old, talent] = academyPlayers(w, w.playerClubId);
    old!.birthDate = '2007-01-01';
    talent!.currentAbility = 200;
    expect(find(w, 'overAgeU19')[0]!.playerIds).toContain(old!.id);
    expect(find(w, 'youthReady').some((x) => x.playerIds[0] === talent!.id)).toBe(true);
  });

  it('6 maçtır hiç oynamayan genç (≤ 21) için süre önerisi', () => {
    const w = fresh();
    const ours = w.season.fixtures.filter((f) => f.homeId === w.playerClubId || f.awayId === w.playerClubId).slice(0, 6);
    expect(find(w, 'needsMinutes')).toHaveLength(0); // sezon başı
    for (const f of ours) f.result = makeResult(1, 0); // oyuncu kaydı yok: kimse oynamamış sayılır
    const young = clubPlayers(w, w.playerClubId).find((p) => ageOn(p.birthDate, w.date) <= 21 && !p.positions.GK)!;
    expect(find(w, 'needsMinutes')).toHaveLength(1);
    expect(find(w, 'needsMinutes')[0]!.playerIds).toContain(young.id);
  });
});
