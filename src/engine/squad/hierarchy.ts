/**
 * Takım içi hiyerarşi ve kaptanlık.
 *
 * Etki puanı: liderlik (×1.5) + tecrübe (18 yaşından sonraki yıllar, en fazla 14; ×0.8) + kadrodaki önem
 * (yeteneğe göre ilk 12'de üst sıralar daha çok) + kulüpteki süre (yıl ×1.2, en fazla 6 yıl) + kaptan (+6) /
 * yardımcı kaptan (+3). Sıralamaya göre seviyeler: ilk 2 takım lideri, sonraki 3 etkili, sonraki 5 saygın.
 *
 * Kaptan değişince: kaptanlığı alınan kırılır (etkiliyse daha çok), yeni kaptan sevinir; liderler varken
 * hiyerarşide alt sıradaki birini kaptan yapmak liderleri bozar.
 * Haftalık: liderlerin havası takıma yayılır (mutlularsa takım hafifçe yükselir, mutsuzlarsa düşer).
 */
import { daysBetween, type GameDate } from '../date';
import { clubPlayers } from '../generation/worldGenerator';
import { addNews } from '../news';
import { ageOn } from '../player';
import type { GameWorld, Player } from '../types';

export type HierarchyLevel = 'leader' | 'influential' | 'respected' | 'other';

export interface HierarchyEntry {
  playerId: number;
  level: HierarchyLevel;
  influence: number;
  /** Kulüpteki yıl (kiralıkta 0). */
  tenure: number;
}

/**
 * Katılış tarihi bilinmeyen (oyun başından beri kulüpteki) oyuncunun süresi: oyuncuya göre sabit 1–6 yıl,
 * 17 yaşından önceye gitmez (oyun başı) + oyun başından bu yana geçen süre.
 */
function startingTenure(p: Player, gameStart: GameDate): number {
  const years = 1 + (Math.imul(p.id, 2654435761) >>> 0) % 6;
  return Math.max(0, Math.min(years, ageOn(p.birthDate, gameStart) - 17));
}
const LEVEL_SIZES: readonly [HierarchyLevel, number][] = [['leader', 2], ['influential', 3], ['respected', 5]];
/** Liderlerin ortalama morali bunun üstündeyse takım yükselir, altındaysa düşer. */
const LEADERS_HAPPY = 70;
const LEADERS_UNHAPPY = 35;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

/** Kulüpteki süre (yıl). */
export function tenureYears(p: Player, date: GameDate, gameStart: GameDate = date): number {
  if (p.loan) return 0;
  if (!p.joined) return startingTenure(p, gameStart) + Math.max(0, daysBetween(gameStart, date) / 365);
  return Math.max(0, daysBetween(p.joined, date) / 365);
}

/** Kulübün A takım hiyerarşisi (etkiye göre sıralı). Kaptan / yardımcı kaptan taktikten. */
export function teamHierarchy(world: GameWorld, clubId: string): HierarchyEntry[] {
  const squad = clubPlayers(world, clubId);
  const tactics = world.tactics[clubId];
  const rank = new Map([...squad].sort((a, b) => b.currentAbility - a.currentAbility).map((p, i) => [p.id, i]));
  const entries = squad.map((p) => {
    const tenure = tenureYears(p, world.date, world.manager.joined);
    const experience = Math.min(14, Math.max(0, ageOn(p.birthDate, world.date) - 18));
    const importance = Math.max(0, 12 - rank.get(p.id)!);
    const role = tactics?.captainId === p.id ? 6 : tactics?.viceCaptainId === p.id ? 3 : 0;
    const influence = p.attributes.leadership * 1.5 + experience * 0.8 + importance * 0.8 + Math.min(6, tenure) * 1.2 + role;
    return { playerId: p.id, influence: Math.round(influence * 10) / 10, tenure: Math.round(tenure * 10) / 10, level: 'other' as HierarchyLevel };
  });
  entries.sort((a, b) => b.influence - a.influence);
  let i = 0;
  for (const [level, size] of LEVEL_SIZES) {
    for (let k = 0; k < size && i < entries.length; k++, i++) entries[i]!.level = level;
  }
  return entries;
}

/** Takımın liderleri (seviye 'leader'). */
export function teamLeaders(world: GameWorld, clubId: string): Player[] {
  return teamHierarchy(world, clubId).filter((e) => e.level === 'leader').map((e) => world.players[e.playerId]!);
}

/**
 * Kaptan / yardımcı kaptan değişikliğinin moral etkileri (kullanıcının seçimi sonrasında çağrılır).
 * `hierarchyBefore`: değişiklikten önceki hiyerarşi (eski rolün etkisi dahil).
 */
export function applyCaptainChange(
  world: GameWorld,
  role: 'captain' | 'vice',
  previousId: number | null,
  nextId: number | null,
  hierarchyBefore: readonly HierarchyEntry[],
): void {
  if (previousId === nextId) return;
  const levelOf = (id: number | null) => hierarchyBefore.find((e) => e.playerId === id)?.level ?? 'other';
  const big = role === 'captain';
  const previous = previousId !== null ? world.players[previousId] : undefined;
  if (previous && previous.clubId === world.playerClubId) {
    const important = levelOf(previousId) === 'leader' || levelOf(previousId) === 'influential';
    const loss = (big ? 6 : 3) + (important ? (big ? 6 : 3) : 0);
    previous.morale = clamp(previous.morale - loss);
    if (big) {
      addNews(world, {
        category: 'player',
        title: `${fullName(previous)} kaptanlığı bıraktığı için kırgın`,
        body: `${fullName(previous)} kaptanlık bandının elinden alınmasından memnun değil${important ? '; takımdaki ağırlığı düşünülürse bu soyunma odasında konuşulacak' : ''}.`,
        important: false,
        playerId: previous.id,
        clubId: world.playerClubId,
      });
    }
  }
  const next = nextId !== null ? world.players[nextId] : undefined;
  if (next) {
    next.morale = clamp(next.morale + (big ? 8 : 4));
    // Liderler varken hiyerarşinin alt sırasından bir kaptan liderleri bozar
    const nextLevel = levelOf(nextId);
    if (big && (nextLevel === 'respected' || nextLevel === 'other')) {
      for (const e of hierarchyBefore) {
        if (e.level !== 'leader' || e.playerId === nextId) continue;
        const leader = world.players[e.playerId]!;
        leader.morale = clamp(leader.morale - 4);
      }
    }
  }
}

/** Liderlerin ortalama morali (lider yoksa null). */
export function leadersMorale(world: GameWorld, clubId: string): number | null {
  const leaders = teamLeaders(world, clubId);
  return leaders.length === 0 ? null : leaders.reduce((s, p) => s + p.morale, 0) / leaders.length;
}

/** Haftalık: liderlerin havası kullanıcının takımına yayılır. */
export function leadersInfluence(world: GameWorld): void {
  const clubId = world.playerClubId;
  const mood = leadersMorale(world, clubId);
  if (mood === null) return;
  const delta = mood >= LEADERS_HAPPY ? 1 : mood <= LEADERS_UNHAPPY ? -2 : 0;
  if (delta === 0) return;
  const leaders = new Set(teamLeaders(world, clubId).map((p) => p.id));
  for (const p of clubPlayers(world, clubId)) {
    if (!leaders.has(p.id)) p.morale = clamp(p.morale + delta);
  }
}

export type TeamMood = 'great' | 'good' | 'ok' | 'poor' | 'bad';

/** Takımın genel havası (A takım moral ortalaması). */
export function teamMood(world: GameWorld, clubId: string): { average: number; mood: TeamMood } {
  const squad = clubPlayers(world, clubId);
  const average = squad.length === 0 ? 60 : squad.reduce((s, p) => s + p.morale, 0) / squad.length;
  const mood: TeamMood = average >= 75 ? 'great' : average >= 62 ? 'good' : average >= 50 ? 'ok' : average >= 38 ? 'poor' : 'bad';
  return { average: Math.round(average), mood };
}
