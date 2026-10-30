import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { makeResult } from '../testing';
import type { Fixture } from '../types';
import { fansOf } from './fans';
import { answerPress, pressAfterMatch, PRESS_QUESTIONS } from './press';

const fixture = (id: number, homeId: string, awayId: string, hg: number, ag: number): Fixture =>
  ({ id, round: 1, date: '2026-08-15', homeId, awayId, result: makeResult(hg, ag) });

describe('basın toplantısı', () => {
  it('yalnızca kullanıcının maçından sonra, sonuca göre açılır; sonraki maç öncekini düşürür', () => {
    const w = createWorld(gameData, 5, 'kasimpasa', '2026-07-01');
    pressAfterMatch(w, fixture(1, 'konyaspor', 'trabzonspor', 1, 0));
    expect(w.press).toBeUndefined();
    pressAfterMatch(w, fixture(2, 'kasimpasa', 'konyaspor', 0, 2));
    expect(w.press).toEqual({ fixtureId: 2, tone: 'loss' });
    pressAfterMatch(w, fixture(3, 'konyaspor', 'kasimpasa', 1, 1));
    expect(w.press).toEqual({ fixtureId: 3, tone: 'draw' });
  });

  it('cevap moral, taraftar ve yönetime işler, medyada haber olur, bir kez cevaplanır', () => {
    const w = createWorld(gameData, 5, 'kasimpasa', '2026-07-01');
    pressAfterMatch(w, fixture(2, 'kasimpasa', 'konyaspor', 0, 2));
    const answer = PRESS_QUESTIONS.loss.answers[1]!; // oyuncuları eleştir
    const player = clubPlayers(w, 'kasimpasa')[0]!;
    const morale = player.morale;
    const fans = fansOf(w);
    const confidence = w.board.confidence;
    const news = w.news.length;

    expect(answerPress(w, 1)).toBeNull();
    expect(player.morale).toBe(Math.max(0, morale + answer.morale));
    expect(fansOf(w)).toBe(fans + answer.fans);
    expect(w.board.confidence).toBe(confidence + answer.board);
    expect(w.news.length).toBe(news + 1);
    expect(w.news.at(-1)!.category).toBe('media');
    expect(w.press).toBeNull();
    expect(answerPress(w, 0)).toBeTypeOf('string');
  });
});
