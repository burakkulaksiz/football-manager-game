/**
 * Maç raporu yardımcıları: saklanan MatchResult'tan zaman çizelgesi ve oyuncu kayıtları çıkarır.
 * Sonuçta değişiklik olayı tutulmadığı için giriş/çıkış dakikaları oynanan süreden türetilir.
 */
import type { MatchResult, PlayerMatchRecord } from '../types';

export type TimelineKind = 'goal' | 'penalty' | 'yellow' | 'red' | 'secondYellow' | 'injury';

export interface TimelineEvent {
  minute: number;
  extra: number;
  clubId: string;
  playerId: number;
  kind: TimelineKind;
  assistId?: number | null;
}

/** Gol, kart ve sakatlıklar dakika sırasıyla (45+2, 46'dan önce gelir). */
export function matchTimeline(result: MatchResult): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...result.goals.map((g) => ({
      minute: g.minute,
      extra: g.extra ?? 0,
      clubId: g.clubId,
      playerId: g.playerId,
      kind: (g.kind === 'penalty' ? 'penalty' : 'goal') as TimelineKind,
      assistId: g.assistId ?? null,
    })),
    ...result.cards.map((c) => ({
      minute: c.minute,
      extra: c.extra ?? 0,
      clubId: c.clubId,
      playerId: c.playerId,
      kind: (c.type === 'yellow' ? 'yellow' : c.secondYellow ? 'secondYellow' : 'red') as TimelineKind,
    })),
    ...result.injuries.map((i) => ({
      minute: i.minute,
      extra: i.extra ?? 0,
      clubId: i.clubId,
      playerId: i.playerId,
      kind: 'injury' as TimelineKind,
    })),
  ];
  // Sıralama kararlı: aynı dakikada önce gol, sonra kart/sakatlık (dizideki sıra korunur).
  return events.sort((a, b) => a.minute - b.minute || a.extra - b.extra);
}

export interface Appearance {
  record: PlayerMatchRecord;
  /** Yedekten girdiyse giriş dakikası. */
  minuteIn: number | null;
  /** İlk 11'de başlayıp maçı bitirmediyse çıkış dakikası (değişiklik, kırmızı kart ya da sakatlık). */
  minuteOut: number | null;
}

/** Bir takımın maçta oynayan oyuncuları: önce ilk 11, sonra oyuna girenler. */
export function teamAppearances(result: MatchResult, clubId: string): Appearance[] {
  const records = result.players.filter((r) => r.clubId === clubId);
  const starters = records.filter((r) => r.started);
  const subs = records.filter((r) => !r.started).sort((a, b) => b.minutes - a.minutes);
  return [
    ...starters.map((r) => ({ record: r, minuteIn: null, minuteOut: r.minutes < 90 ? r.minutes : null })),
    ...subs.map((r) => ({ record: r, minuteIn: 90 - r.minutes, minuteOut: null })),
  ];
}
