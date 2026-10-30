import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { processMatchFinances } from '../finance/finance';
import { createWorld } from '../generation/worldGenerator';
import { makeResult } from '../testing';
import type { Fixture } from '../types';
import { changeFans, DEFAULT_FANS, fansAfterMatch, fansAttendanceFactor, fansMonthly, fansOf } from './fans';

const world = () => createWorld(gameData, 5, 'kasimpasa', '2026-07-01');
const fixture = (homeId: string, awayId: string, hg: number, ag: number): Fixture =>
  ({ id: 999, round: 1, date: '2026-08-15', homeId, awayId, result: makeResult(hg, ag) });

describe('taraftar memnuniyeti', () => {
  it('eski kayıtta 60; sınırlar 0–100', () => {
    const w = world();
    delete w.board.fans;
    expect(fansOf(w)).toBe(DEFAULT_FANS);
    changeFans(w, 80);
    expect(fansOf(w)).toBe(100);
    changeFans(w, -500);
    expect(fansOf(w)).toBe(0);
  });

  it('galibiyet artırır, farklı yenilgi daha çok düşürür; başkasının maçı etkilemez; ay başı ortalamaya döner', () => {
    const w = world();
    fansAfterMatch(w, fixture('kasimpasa', 'konyaspor', 2, 1));
    expect(fansOf(w)).toBe(62);
    fansAfterMatch(w, fixture('konyaspor', 'kasimpasa', 4, 0));
    expect(fansOf(w)).toBe(58);
    fansAfterMatch(w, fixture('konyaspor', 'trabzonspor', 0, 5));
    expect(fansOf(w)).toBe(58);
    fansMonthly(w);
    expect(fansOf(w)).toBeCloseTo(58.2);
  });

  it('iç saha seyircisi memnuniyetle değişir (yalnızca kullanıcı kulübü)', () => {
    const attendance = (fans: number) => {
      const w = world();
      w.clubs.find((c) => c.id === 'kasimpasa')!.capacity = 1_000_000; // kapasite sınırı ölçümü bozmasın
      w.board.fans = fans;
      const f = fixture('kasimpasa', 'konyaspor', 1, 1);
      processMatchFinances(w, f);
      return f.result!.attendance!;
    };
    expect(attendance(100) / attendance(0)).toBeCloseTo(fansAttendanceFactor(100) / fansAttendanceFactor(0), 2);
  });
});
