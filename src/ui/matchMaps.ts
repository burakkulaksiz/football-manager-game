/**
 * Şut ve ısı haritası geometrisi (saf, testli). Motor yer saklamaz: şutun çıktığı ve gittiği yer, dakikanın
 * anı da topun yeri 2D sahadaki fonksiyonlarla (shotOrigin, ballSpot) türetilir; böylece haritadaki yer
 * canlı sahada görülenle aynıdır.
 */
import { decodeTimeline, type MatchPlay, type PlayKind, type ShotOutcome, type ShotRecord, type Side } from '../engine';
import { ballSpot, PITCH_LENGTH, PITCH_WIDTH, shotOrigin, type Point } from './pitch';

export interface ShotMark {
  shot: ShotRecord;
  /** Şutun çıktığı yer. */
  from: Point;
  /** Topun gittiği yer (ağ, kaleci, aut, blok). */
  to: Point;
}

const END_KIND: Record<ShotOutcome, PlayKind> = { goal: 'goal', saved: 'save', missed: 'miss', blocked: 'blocked' };

/** Şutların haritadaki çizgileri. Aynı dakikadaki ikinci şut biraz farklı yere düşer (üst üste binmesin). */
export function shotMarks(shots: readonly ShotRecord[]): ShotMark[] {
  const seen = new Map<string, number>();
  return shots.map((shot) => {
    const key = `${shot.second ? 2 : 1}-${shot.minute}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const minute = shot.minute + n * 0.37;
    const play: MatchPlay = {
      side: shot.side,
      kind: END_KIND[shot.outcome],
      playerId: shot.playerId,
      fromPenalty: shot.kind === 'penalty',
      fromCorner: shot.corner === true,
      fromFreeKick: shot.kind === 'freekick',
    };
    const to = ballSpot(play, minute);
    return { shot, from: shotOrigin(play, minute) ?? to, to };
  });
}

export interface HeatPoint extends Point {
  /** O dakika topa sahip / anı yaşayan taraf. */
  side: Side;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Dakika dakika topun yeri (ısı haritası). Ağdaki / auttaki top saha içine çekilir. */
export function heatPoints(timeline: string): HeatPoint[] {
  return decodeTimeline(timeline).map((m) => {
    const p = ballSpot({ side: m.side, kind: m.kind, playerId: null }, m.minute);
    return { x: clamp(p.x, 1, PITCH_LENGTH - 1), y: clamp(p.y, 1, PITCH_WIDTH - 1), side: m.side };
  });
}

/**
 * Topun dakikalarının bölgelere dağılımı (ev sahibinin gözünden): kendi üçte biri, orta, rakip üçte biri.
 * Yüzdeler toplamı 100 (yuvarlama farkı ortaya).
 */
export function territory(points: readonly Point[]): { own: number; middle: number; opp: number } {
  if (points.length === 0) return { own: 0, middle: 0, opp: 0 };
  const third = PITCH_LENGTH / 3;
  const own = Math.round((points.filter((p) => p.x < third).length / points.length) * 100);
  const opp = Math.round((points.filter((p) => p.x > 2 * third).length / points.length) * 100);
  return { own, middle: 100 - own - opp, opp };
}

/** Takımın şut özeti: şut / isabet / gol. */
export function shotSummary(shots: readonly ShotRecord[], side: Side): { shots: number; onTarget: number; goals: number } {
  const own = shots.filter((s) => s.side === side);
  return {
    shots: own.length,
    onTarget: own.filter((s) => s.outcome === 'goal' || s.outcome === 'saved').length,
    goals: own.filter((s) => s.outcome === 'goal').length,
  };
}
