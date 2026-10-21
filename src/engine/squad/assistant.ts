/**
 * Yardımcı antrenör: kullanıcının kadrosunu ve taktiğini inceleyip öneriler üretir (saf; dünyayı değiştirmez).
 * Öneriler yapılandırılmış veridir; metni arayüz kurar.
 *
 * - İlk 11: sakat/cezalı/kulüpten ayrılmış oyuncu, mevkisinin yabancısı, yedekte daha iyi seçenek, yorgun, morali bozuk.
 * - Derinlik: dizilişteki mevkide oynayabilecek (yatkınlık ≥ 15) oyuncu sayısı yetersiz; kadronun en zayıf bölgesi.
 * - Sözleşme: önemli oyuncunun sözleşmesi bu sezon bitiyor.
 * - Gençler: U19 yaş sınırını geçenler, A takıma hazır U19'lular, süre bulamayan gençler.
 * - Kadro ve maaş: kalabalık / dar kadro, maaş bütçesi aşımı.
 */
import { daysBetween, makeDate } from '../date';
import { clubPlayers } from '../generation/worldGenerator';
import { FORMATIONS, slotFit } from '../match/formation';
import { ageOn, isAvailable, primaryPosition } from '../player';
import type { GameWorld, Player, Position } from '../types';
import { academyPlayers, isOverAge } from './academy';
import { leadersMorale, teamHierarchy } from './hierarchy';
import { PROMISE_MATCHES, promiseAtRisk } from './talks';

export type AdviceSeverity = 'high' | 'medium' | 'low';
export type AreaGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

export type AdviceKind =
  | 'unavailableStarter'
  | 'outOfPosition'
  | 'betterOption'
  | 'tiredStarter'
  | 'unhappyStarter'
  | 'thinPosition'
  | 'weakArea'
  | 'expiringContract'
  | 'overAgeU19'
  | 'youthReady'
  | 'needsMinutes'
  | 'squadTooBig'
  | 'squadTooSmall'
  | 'wagesOver'
  | 'playerRequest'
  | 'promiseAtRisk'
  | 'captainNotLeader'
  | 'leadersUnhappy';

export interface Advice {
  /** React anahtarı ve tekrarları ayıklamak için. */
  id: string;
  kind: AdviceKind;
  severity: AdviceSeverity;
  /** İlgili oyuncular (betterOption: [ilk 11'deki, önerilen]). */
  playerIds: number[];
  slot?: Position;
  group?: AreaGroup;
  /** Türüne göre: verim %, kondisyon %, oyuncu sayısı, kadro büyüklüğü, maaş kullanımı %. */
  value?: number;
  /** unavailableStarter: neden. */
  reason?: 'injury' | 'suspension' | 'gone';
}

/** Bu yatkınlıktan itibaren oyuncu mevkide "oynayabilir" sayılır (becerikli). */
export const CAPABLE_FAMILIARITY = 15;
/** Verimi bunun altındaki oyuncu mevkisinin yabancısıdır. */
const OUT_OF_POSITION_FIT = 0.85;
/** Yedekteki oyuncu (yetenek × mevki verimi) bu kadar iyiyse öner. */
const BETTER_OPTION_MARGIN = 10;
const TIRED_CONDITION = 80;
const UNHAPPY_MORALE = 30;
const SQUAD_MAX = 30;
const SQUAD_MIN = 20;

const SEVERITY_ORDER: Record<AdviceSeverity, number> = { high: 0, medium: 1, low: 2 };

export function areaOf(position: Position): AreaGroup {
  if (position === 'GK') return 'GK';
  if (['DR', 'DC', 'DL', 'WBR', 'WBL'].includes(position)) return 'DEF';
  if (['AMR', 'AMC', 'AML', 'ST'].includes(position)) return 'ATT';
  return 'MID';
}

/** Kullanıcının bu sezon maçta oynamış oyuncuları ve oynanan maç sayısı. */
function seasonAppearances(world: GameWorld): { played: Set<number>; rounds: number } {
  const played = new Set<number>();
  let rounds = 0;
  for (const f of world.season.fixtures) {
    if (!f.result || (f.homeId !== world.playerClubId && f.awayId !== world.playerClubId)) continue;
    rounds++;
    for (const r of f.result.players) if (r.clubId === world.playerClubId) played.add(r.playerId);
  }
  return { played, rounds };
}

/** Sıradaki maçımıza kaç gün var (yoksa sonsuz). */
function daysToNextMatch(world: GameWorld): number {
  const next = world.season.fixtures
    .filter((f) => !f.result && (f.homeId === world.playerClubId || f.awayId === world.playerClubId))
    .reduce<string | null>((min, f) => (min === null || f.date < min ? f.date : min), null);
  if (!next) return Infinity;
  return Math.round((Date.parse(next) - Date.parse(world.date)) / 86_400_000);
}

export function assistantAdvice(world: GameWorld): Advice[] {
  const user = world.playerClubId;
  const squad = clubPlayers(world, user);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const tactics = world.tactics[user];
  const advice: Advice[] = [];
  const add = (a: Omit<Advice, 'id'>) =>
    advice.push({ ...a, id: `${a.kind}-${a.slot ?? a.group ?? ''}-${a.playerIds.join('.')}` });

  /* ---------------- İlk 11 ---------------- */
  const slots = tactics ? FORMATIONS[tactics.formation] : [];
  const starters: { p: Player; slot: Position }[] = [];
  if (tactics) {
    tactics.lineup.forEach((id, i) => {
      const slot = slots[i]!;
      if (id === null) return;
      const p = byId.get(id);
      if (!p) {
        add({ kind: 'unavailableStarter', severity: 'high', playerIds: [id], slot, reason: 'gone' });
        return;
      }
      if (p.injury) add({ kind: 'unavailableStarter', severity: 'high', playerIds: [id], slot, reason: 'injury', value: p.injury.daysOut });
      else if (p.suspension > 0) add({ kind: 'unavailableStarter', severity: 'high', playerIds: [id], slot, reason: 'suspension', value: p.suspension });
      else starters.push({ p, slot });
    });

    const inXI = new Set(tactics.lineup.filter((id): id is number => id !== null));
    const soon = daysToNextMatch(world) <= 3;
    for (const { p, slot } of starters) {
      const fit = slotFit(p, slot);
      if (fit < OUT_OF_POSITION_FIT) {
        add({ kind: 'outOfPosition', severity: 'medium', playerIds: [p.id], slot, value: Math.round(fit * 100) });
      }
      // Yedekte (ilk 11 dışında) bu mevkide belirgin şekilde daha iyi bir seçenek
      const current = p.currentAbility * fit;
      const better = squad
        .filter((q) => !inXI.has(q.id) && isAvailable(q))
        .map((q) => ({ q, score: q.currentAbility * slotFit(q, slot) }))
        .filter((c) => c.score >= current + BETTER_OPTION_MARGIN)
        .sort((a, b) => b.score - a.score)[0];
      if (better) add({ kind: 'betterOption', severity: 'low', playerIds: [p.id, better.q.id], slot });
      if (soon && p.condition < TIRED_CONDITION) add({ kind: 'tiredStarter', severity: 'medium', playerIds: [p.id], value: p.condition });
      if (p.morale < UNHAPPY_MORALE) add({ kind: 'unhappyStarter', severity: 'low', playerIds: [p.id] });
    }
  }

  /* ---------------- Derinlik ---------------- */
  const available = squad.filter(isAvailable);
  for (const slot of new Set(slots)) {
    const needed = slots.filter((s) => s === slot).length;
    const capable = available.filter((p) => (p.positions[slot] ?? 0) >= CAPABLE_FAMILIARITY);
    if (capable.length < needed + 1) {
      add({
        kind: 'thinPosition',
        severity: capable.length < needed ? 'high' : 'medium',
        playerIds: capable.map((p) => p.id),
        slot,
        value: capable.length,
      });
    }
  }
  // En zayıf bölge: ilk 11'de bölgenin yetenek ortalaması takım ortalamasının 8+ altında
  if (starters.length >= 9) {
    const avg = starters.reduce((s, x) => s + x.p.currentAbility, 0) / starters.length;
    const groups = new Map<AreaGroup, number[]>();
    for (const { p, slot } of starters) {
      const g = areaOf(slot);
      groups.set(g, [...(groups.get(g) ?? []), p.currentAbility]);
    }
    const weakest = [...groups.entries()]
      .map(([g, cas]) => ({ g, gap: avg - cas.reduce((a, b) => a + b, 0) / cas.length }))
      .sort((a, b) => b.gap - a.gap)[0];
    if (weakest && weakest.gap >= 8) add({ kind: 'weakArea', severity: 'low', playerIds: [], group: weakest.g, value: Math.round(weakest.gap) });
  }

  /* ---------------- Sözleşmeler ---------------- */
  // Tek öneride toplanır; sezon ilerledikçe önemi artar (ocaktan orta, nisandan yüksek)
  const seasonEnd = makeDate(world.season.year + 1, 6, 30);
  const key = [...squad].sort((a, b) => b.currentAbility - a.currentAbility).slice(0, 14);
  const expiring = key.filter((p) => !p.loan && p.contract.expires <= seasonEnd);
  if (expiring.length > 0) {
    const month = Number(world.date.slice(5, 7));
    const late = world.date.slice(0, 4) !== String(world.season.year);
    const severity: AdviceSeverity = late && month >= 4 ? 'high' : late ? 'medium' : 'low';
    add({ kind: 'expiringContract', severity, playerIds: expiring.map((p) => p.id) });
  }

  /* ---------------- Gençler ---------------- */
  const academy = academyPlayers(world, user);
  const overAge = academy.filter((p) => isOverAge(p, world.date));
  if (overAge.length > 0) add({ kind: 'overAgeU19', severity: 'medium', playerIds: overAge.map((p) => p.id) });
  const benchLevel = [...squad].map((p) => p.currentAbility).sort((a, b) => b - a)[17] ?? 0;
  for (const p of academy) {
    if (!isOverAge(p, world.date) && p.currentAbility >= benchLevel) add({ kind: 'youthReady', severity: 'low', playerIds: [p.id] });
  }
  const { played, rounds } = seasonAppearances(world);
  if (rounds >= 6) {
    const idle = squad.filter(
      (p) => !p.loan && !p.listing && ageOn(p.birthDate, world.date) <= 21 && primaryPosition(p) !== 'GK' && !played.has(p.id),
    );
    if (idle.length > 0) add({ kind: 'needsMinutes', severity: 'low', playerIds: idle.map((p) => p.id) });
  }

  /* ---------------- Görüşmeler ---------------- */
  for (const r of world.requests) {
    if (byId.has(r.playerId)) add({ kind: 'playerRequest', severity: 'high', playerIds: [r.playerId], value: daysBetween(world.date, r.respondBy) });
  }
  for (const pr of world.promises) {
    if (byId.has(pr.playerId) && promiseAtRisk(pr)) {
      add({ kind: 'promiseAtRisk', severity: 'medium', playerIds: [pr.playerId], value: PROMISE_MATCHES - pr.matches });
    }
  }

  /* ---------------- Kaptanlık ve hiyerarşi ---------------- */
  const hierarchy = teamHierarchy(world, user);
  const captainEntry = hierarchy.find((e) => e.playerId === tactics?.captainId);
  const topLeader = hierarchy.find((e) => e.level === 'leader' && e.playerId !== tactics?.captainId);
  if (captainEntry && topLeader && (captainEntry.level === 'respected' || captainEntry.level === 'other')) {
    add({ kind: 'captainNotLeader', severity: 'low', playerIds: [captainEntry.playerId, topLeader.playerId] });
  }
  const mood = leadersMorale(world, user);
  if (mood !== null && mood <= 35) {
    add({ kind: 'leadersUnhappy', severity: 'medium', playerIds: hierarchy.filter((e) => e.level === 'leader').map((e) => e.playerId) });
  }

  /* ---------------- Kadro ve maaş ---------------- */
  if (squad.length > SQUAD_MAX) add({ kind: 'squadTooBig', severity: 'low', playerIds: [], value: squad.length });
  if (squad.length < SQUAD_MIN) add({ kind: 'squadTooSmall', severity: 'high', playerIds: [], value: squad.length });
  const fin = world.finances[user];
  if (fin) {
    const wages = Object.values(world.players).filter((p) => p.clubId === user).reduce((s, p) => s + p.contract.wage, 0);
    const usage = Math.round((wages / fin.wageBudget) * 100);
    if (usage > 100) add({ kind: 'wagesOver', severity: 'medium', playerIds: [], value: usage });
  }

  return advice.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** İlk 11 / maç öncesi ile ilgili öneri türleri (Taktik ekranı ve maç öncesi). */
export const LINEUP_ADVICE: ReadonlySet<AdviceKind> = new Set([
  'unavailableStarter',
  'outOfPosition',
  'betterOption',
  'tiredStarter',
  'unhappyStarter',
]);
