/**
 * Gözlemci sistemi: kullanıcının başka kulüplerin oyuncularını ne kadar tanıdığı (bilgi 0–100).
 *
 * - Kendi oyuncularımız (U19 ve kiralık gelenler dahil) ve bir dönem bizde oynamış olanlar tam bilinir.
 * - Diğerleri baştan "ünleri" kadar bilinir: yetenek ve kulüp itibarı yüksekse daha çok (en fazla FAME_CAP).
 * - Karşılaştığımız maçlarda forma giyen rakipler her maçta biraz daha tanınır (en fazla MATCH_KNOWLEDGE_CAP).
 * - Tam bilgi yalnızca gözlemci raporuyla gelir. Gözlemci ağının aynı anda MAX_ASSIGNMENTS görevi olur;
 *   görev ücreti transfer bütçesinden düşer, rapor süresi dolunca gelir.
 *
 * Bilgi yalnızca kullanıcıya gösterileni etkiler: az bilinen oyuncunun özellikleri geniş bir aralık olarak,
 * yetenek / potansiyel yıldızları belirsiz bir tahmin olarak görünür. Yapay zekâ kulüpleri her şeyi bilir.
 */
import { ALL_ATTRS, type AttributeKey } from '../attributes';
import { addDays, type GameDate } from '../date';
import { addExpense } from '../finance/finance';
import { inRegion, type Region } from '../generation/foreign';
import { addNews } from '../news';
import { ageOn, marketValue, primaryPosition } from '../player';
import type { Rng } from '../rng';
import type { GameWorld, Player, Position } from '../types';

export const FULL_KNOWLEDGE = 100;
export const FAME_CAP = 60;
export const MATCH_KNOWLEDGE_GAIN = 20;
export const MATCH_KNOWLEDGE_CAP = 75;
/** Kulüp taraması kadroyu tam değil, bu düzeye kadar tanıtır. */
export const CLUB_SCAN_KNOWLEDGE = 80;
export const MAX_ASSIGNMENTS = 3;
export const SEARCH_RESULTS = 5;
export const MAX_REPORTS = 30;

export type ScoutTarget =
  | { kind: 'player'; playerId: number }
  | { kind: 'club'; clubId: string }
  /** Arama: mevki (yoksa hepsi), en fazla yaş, en fazla piyasa değeri (0 = sınırsız), bölge (yoksa hepsi). */
  | { kind: 'search'; position: Position | null; maxAge: number; maxValue: number; region?: Region };

export type ScoutTargetKind = ScoutTarget['kind'];

/** Görev süresi (gün) ve ücreti (€). */
export const SCOUT_TASKS: Record<ScoutTargetKind, { days: number; cost: number }> = {
  player: { days: 7, cost: 10_000 },
  search: { days: 14, cost: 25_000 },
  club: { days: 21, cost: 40_000 },
};

export interface ScoutAssignment {
  id: number;
  target: ScoutTarget;
  started: GameDate;
  due: GameDate;
}

export interface ScoutReport {
  id: number;
  date: GameDate;
  target: ScoutTarget;
  /** Rapordaki oyuncular (oyuncu raporunda bir, kulüp taramasında kadro, aramada en iyi adaylar). */
  playerIds: number[];
}

export interface ScoutingState {
  /** Oyuncu id → maç ve raporlarla edinilen bilgi (ün bunun altındaysa ün geçerli). */
  knowledge: Record<number, number>;
  assignments: ScoutAssignment[];
  /** En yeni sonda; en fazla MAX_REPORTS. */
  reports: ScoutReport[];
  nextId: number;
}

export function emptyScouting(): ScoutingState {
  return { knowledge: {}, assignments: [], reports: [], nextId: 1 };
}

/** 0–1 arası sabit sayı: aynı oyuncu ve anahtar için hep aynı (aralıklar her çizimde oynamasın). */
function hash01(a: number, b: number): number {
  return ((Math.imul(a ^ Math.imul(b + 1, 0x9e3779b1), 2654435761) >>> 0) % 10_000) / 10_000;
}

/** Yetenek ve kulüp itibarından gelen ün: herkesin bildiği kadar. Başka kulübün U19'u tanınmaz. */
export function fame(world: GameWorld, p: Player): number {
  if (p.academy) return 0;
  const rep = p.clubId ? (world.clubs.find((c) => c.id === p.clubId)?.reputation ?? 0) : 0;
  return Math.round(Math.max(0, Math.min(FAME_CAP, (p.currentAbility - 90) * 0.45 + (rep - 30) * 0.25)));
}

/** Oyuncu bir dönem kulübümüzde oynadı mı (transfer, kiralık ya da sezon kaydı)? */
function playedForUs(world: GameWorld, p: Player): boolean {
  const us = world.playerClubId;
  return (p.moves ?? []).some((m) => m.fromClubId === us || m.toClubId === us) || (p.career ?? []).some((c) => c.clubId === us);
}

/** Kullanıcının bu oyuncu hakkındaki bilgisi (0–100). */
export function knowledgeOf(world: GameWorld, p: Player): number {
  if (p.clubId === world.playerClubId || playedForUs(world, p)) return FULL_KNOWLEDGE;
  return Math.max(fame(world, p), world.scouting.knowledge[p.id] ?? 0);
}

export function isFullyKnown(world: GameWorld, p: Player): boolean {
  return knowledgeOf(world, p) >= FULL_KNOWLEDGE;
}

function raiseKnowledge(world: GameWorld, playerId: number, to: number): void {
  const k = world.scouting.knowledge;
  k[playerId] = Math.max(k[playerId] ?? 0, Math.min(FULL_KNOWLEDGE, Math.round(to)));
}

/** Aralığın genişliği: bilgi 0 → 10 puan, 50 → 6, 80 → 4, tam bilgi → 0 (tek sayı). */
export function rangeWidth(knowledge: number): number {
  return knowledge >= FULL_KNOWLEDGE ? 0 : Math.round(2 + (1 - knowledge / FULL_KNOWLEDGE) * 8);
}

/**
 * Özelliğin görünen aralığı. Gerçek değer her zaman aralığın içindedir; aralığın değere göre
 * kayması oyuncu ve özelliğe bağlı sabit bir oran (bilgi arttıkça aynı yöne doğru daralır).
 */
export function attributeRange(world: GameWorld, p: Player, key: AttributeKey, knowledge = knowledgeOf(world, p)): { lo: number; hi: number } {
  const v = p.attributes[key];
  const w = rangeWidth(knowledge);
  if (w === 0) return { lo: v, hi: v };
  let lo = v - Math.round(w * hash01(p.id, ALL_ATTRS.indexOf(key)));
  let hi = lo + w;
  if (lo < 1) { lo = 1; hi = 1 + w; }
  if (hi > 20) { hi = 20; lo = 20 - w; }
  return { lo, hi };
}

/** Aralığın ortası: aramalarda ve karşılaştırmada "tahmini değer" olarak kullanılır. */
export function attributeEstimate(world: GameWorld, p: Player, key: AttributeKey, knowledge = knowledgeOf(world, p)): number {
  const r = attributeRange(world, p, key, knowledge);
  return (r.lo + r.hi) / 2;
}

/** Görünen yetenek (CA ölçeğinde). Bilgi azaldıkça sabit bir sapma büyür (tam bilgide gerçek değer). */
export function abilityEstimate(world: GameWorld, p: Player, knowledge = knowledgeOf(world, p)): number {
  const spread = (1 - knowledge / FULL_KNOWLEDGE) * 40;
  return p.currentAbility + (hash01(p.id, 101) - 0.5) * spread;
}

/**
 * Görünen potansiyel. Kendi oyuncumuzda antrenör raporu (gerçek değer). Başkasında gözlem tahmini:
 * tam bilgide bile ±5 sapma kalır (potansiyel kesin bilinemez), bilgi azaldıkça ±20'ye çıkar.
 */
export function potentialEstimate(world: GameWorld, p: Player, knowledge = knowledgeOf(world, p)): number {
  if (p.clubId === world.playerClubId) return p.potentialAbility;
  const spread = 10 + (1 - knowledge / FULL_KNOWLEDGE) * 30;
  return Math.max(abilityEstimate(world, p, knowledge), p.potentialAbility + (hash01(p.id, 202) - 0.5) * spread);
}

/* ------------------------------------------------------------------ */
/* Maçlar                                                               */
/* ------------------------------------------------------------------ */

/** Kulübümüzün maçından sonra: forma giyen rakip oyuncular biraz daha tanınır. */
export function learnFromMatch(world: GameWorld, homeId: string, awayId: string, playerIds: readonly { playerId: number; clubId: string }[]): void {
  const us = world.playerClubId;
  if (homeId !== us && awayId !== us) return;
  for (const r of playerIds) {
    if (r.clubId === us) continue;
    const p = world.players[r.playerId];
    if (!p) continue;
    const now = knowledgeOf(world, p);
    if (now < MATCH_KNOWLEDGE_CAP) raiseKnowledge(world, p.id, Math.min(MATCH_KNOWLEDGE_CAP, now + MATCH_KNOWLEDGE_GAIN));
  }
}

/* ------------------------------------------------------------------ */
/* Görevler                                                             */
/* ------------------------------------------------------------------ */

export function scoutTaskCost(target: ScoutTarget): number {
  return SCOUT_TASKS[target.kind].cost;
}

/** Görev verilemiyorsa nedeni (Türkçe), verilebiliyorsa null. */
export function scoutBlocker(world: GameWorld, target: ScoutTarget): string | null {
  const s = world.scouting;
  if (s.assignments.length >= MAX_ASSIGNMENTS) return `Gözlemcilerin dolu: aynı anda en fazla ${MAX_ASSIGNMENTS} görev.`;
  if (world.finances[world.playerClubId]!.transferBudget < scoutTaskCost(target)) return 'Transfer bütçesi görev ücretine yetmiyor.';
  if (target.kind === 'player') {
    const p = world.players[target.playerId];
    if (!p || p.clubId === world.playerClubId) return 'Kendi oyuncunu zaten tanıyorsun.';
    if (isFullyKnown(world, p)) return 'Bu oyuncuyu zaten tanıyorsun.';
  }
  if (target.kind === 'club' && target.clubId === world.playerClubId) return 'Kendi kadronu zaten tanıyorsun.';
  const same = (t: ScoutTarget) => JSON.stringify(t) === JSON.stringify(target);
  if (s.assignments.some((a) => same(a.target))) return 'Bu görev zaten sürüyor.';
  return null;
}

/** Gözlemci görevlendirir; olmazsa nedeni döner. Ücret hemen transfer bütçesinden ve kasadan düşer. */
export function assignScout(world: GameWorld, target: ScoutTarget): string | null {
  const blocker = scoutBlocker(world, target);
  if (blocker) return blocker;
  const cost = scoutTaskCost(target);
  const fin = world.finances[world.playerClubId]!;
  fin.transferBudget -= cost;
  addExpense(fin, 'scouting', cost);
  const s = world.scouting;
  s.assignments.push({ id: s.nextId++, target, started: world.date, due: addDays(world.date, SCOUT_TASKS[target.kind].days) });
  return null;
}

/** Görevi iptal eder (ücret geri gelmez). */
export function cancelScout(world: GameWorld, id: number): void {
  world.scouting.assignments = world.scouting.assignments.filter((a) => a.id !== id);
}

export function scoutingPlayer(world: GameWorld, playerId: number): ScoutAssignment | undefined {
  return world.scouting.assignments.find((a) => a.target.kind === 'player' && a.target.playerId === playerId);
}

/** Aramanın aday havuzu: kulübümüz dışındaki herkes (başka kulüplerin U19'u ve serbestler dahil). */
function searchPool(world: GameWorld, t: Extract<ScoutTarget, { kind: 'search' }>): Player[] {
  return Object.values(world.players).filter(
    (p) =>
      p.clubId !== world.playerClubId &&
      (t.position === null || (p.positions[t.position] ?? 0) >= 13) &&
      ageOn(p.birthDate, world.date) <= t.maxAge &&
      (t.maxValue === 0 || marketValue(p, world.date) <= t.maxValue) &&
      inRegion(world, p, t.region ?? null),
  );
}

/**
 * Gözlemcinin seçimi: bugünkü yetenek, gençlerde potansiyelin yarısı, bir de gözlemcinin yanılgısı
 * (±12). Böylece arama hep "en iyi" oyuncuyu değil, iyi adayları getirir.
 */
function pickCandidates(world: GameWorld, pool: readonly Player[], rng: Rng): Player[] {
  return pool
    .map((p) => {
      const young = ageOn(p.birthDate, world.date) <= 23;
      return { p, score: p.currentAbility + (young ? (p.potentialAbility - p.currentAbility) * 0.5 : 0) + rng.float(-12, 12) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_RESULTS)
    .map((x) => x.p);
}

function targetTitle(world: GameWorld, t: ScoutTarget, players: readonly Player[]): string {
  if (t.kind === 'player') {
    const p = players[0];
    return p ? `Gözlemci raporu: ${p.firstName} ${p.lastName}` : 'Gözlemci raporu';
  }
  if (t.kind === 'club') return `Kulüp taraması tamamlandı: ${world.clubs.find((c) => c.id === t.clubId)?.name ?? t.clubId}`;
  return `Oyuncu araması tamamlandı: ${players.length} aday`;
}

function finishAssignment(world: GameWorld, a: ScoutAssignment, rng: Rng): void {
  const t = a.target;
  let players: Player[] = [];
  if (t.kind === 'player') {
    const p = world.players[t.playerId];
    if (p) players = [p];
    for (const q of players) raiseKnowledge(world, q.id, FULL_KNOWLEDGE);
  } else if (t.kind === 'club') {
    players = Object.values(world.players).filter((p) => p.clubId === t.clubId && !p.academy);
    for (const q of players) raiseKnowledge(world, q.id, CLUB_SCAN_KNOWLEDGE);
  } else {
    players = pickCandidates(world, searchPool(world, t), rng);
    for (const q of players) raiseKnowledge(world, q.id, FULL_KNOWLEDGE);
  }
  const s = world.scouting;
  const report: ScoutReport = { id: a.id, date: world.date, target: t, playerIds: players.map((p) => p.id) };
  s.reports.push(report);
  if (s.reports.length > MAX_REPORTS) s.reports.splice(0, s.reports.length - MAX_REPORTS);
  addNews(world, {
    category: 'scouting',
    title: targetTitle(world, t, players),
    body:
      t.kind === 'player'
        ? 'Gözlemcin raporunu verdi; oyuncunun özellikleri artık tam olarak biliniyor. Transfer Merkezi → Gözlemciler.'
        : t.kind === 'club'
          ? 'Gözlemcin kadroyu izledi; oyuncular artık çok daha iyi biliniyor. Transfer Merkezi → Gözlemciler.'
          : players.length > 0
            ? `Gözlemcin önerdiği adaylar: ${players.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}. Transfer Merkezi → Gözlemciler.`
            : 'Gözlemcin aradığın özelliklerde oyuncu bulamadı.',
    important: true,
    clubId: world.playerClubId,
    ...(t.kind === 'player' ? { playerId: t.playerId } : {}),
  });
}

/** Günlük: süresi dolan görevlerin raporları gelir. */
export function scoutingDay(world: GameWorld, rng: Rng): void {
  const s = world.scouting;
  const due = s.assignments.filter((a) => a.due <= world.date);
  if (due.length === 0) return;
  s.assignments = s.assignments.filter((a) => a.due > world.date);
  for (const a of due) finishAssignment(world, a, rng);
}

/** Artık oyunda olmayan oyuncuların bilgisini siler (emekliler; sezon başında). */
export function pruneKnowledge(world: GameWorld): void {
  const k = world.scouting.knowledge;
  for (const id of Object.keys(k)) if (!world.players[Number(id)]) delete k[Number(id)];
}

/* ------------------------------------------------------------------ */
/* Gözlemci görüşü                                                      */
/* ------------------------------------------------------------------ */

export type ScoutVerdict = 'starter' | 'rotation' | 'prospect' | 'notNeeded';

type Group = 'gk' | 'def' | 'mid' | 'att';
const groupOf = (pos: Position): Group =>
  pos === 'GK' ? 'gk' : ['DR', 'DC', 'DL', 'WBR', 'WBL'].includes(pos) ? 'def' : ['AMR', 'AMC', 'AML', 'ST'].includes(pos) ? 'att' : 'mid';
/** İlk 11'de mevki grubundan kaç kişi oynar (kabaca). */
const STARTERS: Record<Group, number> = { gk: 1, def: 4, mid: 4, att: 2 };

/**
 * Gözlemcinin görüşü: oyuncunun (görünen) yeteneği, kadromuzda aynı mevki grubundakilerle karşılaştırılır.
 * İlk 11 düzeyinin üstündeyse "ilk 11'e girer", yedek düzeyinin üstündeyse "rotasyon", değilse genç ve
 * potansiyeli ilk 11 düzeyindeyse "geleceğin oyuncusu".
 */
export function scoutVerdict(world: GameWorld, p: Player): ScoutVerdict {
  const g = groupOf(primaryPosition(p));
  const ours = Object.values(world.players)
    .filter((q) => q.clubId === world.playerClubId && !q.academy && groupOf(primaryPosition(q)) === g)
    .map((q) => q.currentAbility)
    .sort((a, b) => b - a);
  const n = STARTERS[g];
  const starterLevel = ours[n - 1] ?? 0;
  const benchLevel = ours[2 * n - 1] ?? 0;
  const ability = abilityEstimate(world, p);
  if (ability > starterLevel) return 'starter';
  if (ability > benchLevel) return 'rotation';
  if (ageOn(p.birthDate, world.date) <= 21 && potentialEstimate(world, p) > starterLevel) return 'prospect';
  return 'notNeeded';
}
