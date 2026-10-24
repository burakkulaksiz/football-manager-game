/**
 * Oyuncu karşılaştırması (en çok 4 oyuncu) ve yardımcı antrenörün notu (saf; dünyayı değiştirmez).
 * Notlar yapılandırılmış veridir; metni arayüz kurar. Başka kulübün oyuncusunda bilgi gözlemci düzeyine göredir
 * (yetenek ve potansiyel tahmini), kendi oyuncumuzda kesin.
 */
import { ageOn, marketValue, primaryPosition } from '../player';
import { groupOf } from '../transfer/market';
import { abilityEstimate, knowledgeOf, potentialEstimate, scoutVerdict } from '../transfer/scouting';
import type { GameWorld, Player } from '../types';

/** Aynı anda karşılaştırılabilecek en çok oyuncu. */
export const MAX_COMPARE = 4;

export type CompareNoteKind =
  /** Önerilen oyuncu (aynı mevki grubunda; sakat / yorgun / form hesaba katılır). */
  | 'pick'
  /** Şu an açık ara en iyisi. */
  | 'best'
  /** En iyi ikisi arasında fark az. */
  | 'close'
  /** Gelecekte en iyisini geçebilir (potansiyel). */
  | 'future'
  /** Kendi oyuncumuz, şu an ilk 11'de. */
  | 'inXI'
  /** Başka kulübün oyuncusu: ilk 11'imize girer / rotasyonda işe yarar / geleceğin oyuncusu / katkı sağlamaz. */
  | 'fitsXI'
  | 'rotation'
  | 'prospect'
  | 'notNeeded'
  /** Benzer seviyeye çok daha düşük piyasa değeri. */
  | 'value'
  /** Hakkında bilgimiz az (gözlemci gönderilmeli). */
  | 'unknown'
  | 'injured'
  | 'tired'
  /** Farklı mevki gruplarından oyuncular. */
  | 'mixedPositions';

export interface CompareNote {
  kind: CompareNoteKind;
  playerIds: number[];
}

/** Yetenek tahmininde bu kadarlık fark "az" sayılır. */
const CLOSE_GAP = 4;
/** Potansiyeli en iyinin bugününü bu kadar geçen genç "geleceğin" oyuncusu. */
const FUTURE_GAP = 8;
/** Bu bilgi düzeyinin altında tahmin güvenilmez. */
const LOW_KNOWLEDGE = 45;
/** Fiyat/performans: en iyiye bu kadar yakın seviyede, değeri en iyinin bu oranından düşük. */
const VALUE_LEVEL_GAP = 6;
const VALUE_RATIO = 0.6;

/** Maç için seçim puanı: yetenek + son maçların formu; sakat seçilmez, yorgun geri düşer. */
function pickScore(world: GameWorld, p: Player): number {
  if (p.injury) return -Infinity;
  const recent = p.form.slice(-3);
  const form = recent.length === 0 ? 0 : (recent.reduce((s, r) => s + r, 0) / recent.length - 6.8) * 4;
  const tired = p.condition < 75 ? (75 - p.condition) * 0.5 : 0;
  return abilityEstimate(world, p) + form - tired;
}

/** Yardımcı antrenörün karşılaştırma notları (önem sırasıyla). */
export function compareAdvice(world: GameWorld, players: readonly Player[]): CompareNote[] {
  if (players.length < 2) return [];
  const notes: CompareNote[] = [];
  const ids = (list: readonly Player[]) => list.map((p) => p.id);
  const ability = new Map(players.map((p) => [p.id, abilityEstimate(world, p)]));
  const byAbility = [...players].sort((a, b) => ability.get(b.id)! - ability.get(a.id)!);
  const best = byAbility[0]!;
  const second = byAbility[1]!;
  const sameGroup = new Set(players.map((p) => groupOf(primaryPosition(p)))).size === 1;

  if (!sameGroup) notes.push({ kind: 'mixedPositions', playerIds: [] });
  else {
    const pick = [...players].sort((a, b) => pickScore(world, b) - pickScore(world, a))[0]!;
    if (pickScore(world, pick) > -Infinity) notes.push({ kind: 'pick', playerIds: [pick.id] });
  }
  if (ability.get(best.id)! - ability.get(second.id)! < CLOSE_GAP) notes.push({ kind: 'close', playerIds: [best.id, second.id] });
  else notes.push({ kind: 'best', playerIds: [best.id] });

  // Gelecek: 23 yaş altı, potansiyeli en iyinin bugününü belirgin geçen (en yüksek potansiyelli)
  const future = players
    .filter((p) => p !== best && ageOn(p.birthDate, world.date) <= 23)
    .map((p) => ({ p, potential: potentialEstimate(world, p) }))
    .sort((a, b) => b.potential - a.potential)[0];
  if (future && future.potential - ability.get(best.id)! >= FUTURE_GAP) notes.push({ kind: 'future', playerIds: [future.p.id] });

  const own = players.filter((p) => p.clubId === world.playerClubId);
  const lineup = world.tactics[world.playerClubId]?.lineup ?? [];
  const inXI = own.filter((p) => lineup.includes(p.id));
  if (inXI.length > 0) notes.push({ kind: 'inXI', playerIds: ids(inXI) });

  // Başka kulübün oyuncuları: kadromuza göre gözlemci görüşü
  const others = players.filter((p) => p.clubId !== world.playerClubId);
  for (const kind of ['fitsXI', 'rotation', 'prospect', 'notNeeded'] as const) {
    const verdict = { fitsXI: 'starter', rotation: 'rotation', prospect: 'prospect', notNeeded: 'notNeeded' }[kind];
    const list = others.filter((p) => scoutVerdict(world, p) === verdict);
    if (list.length > 0) notes.push({ kind, playerIds: ids(list) });
  }

  // Fiyat/performans (yalnızca başka kulübün oyuncuları; kendi oyuncumuzu satın almıyoruz)
  const bestValue = marketValue(best, world.date);
  const bargain = others
    .filter((p) => p !== best && ability.get(p.id)! >= ability.get(best.id)! - VALUE_LEVEL_GAP)
    .sort((a, b) => marketValue(a, world.date) - marketValue(b, world.date))[0];
  if (bargain && marketValue(bargain, world.date) < bestValue * VALUE_RATIO) notes.push({ kind: 'value', playerIds: [bargain.id] });

  const injured = players.filter((p) => p.injury);
  if (injured.length > 0) notes.push({ kind: 'injured', playerIds: ids(injured) });
  const tired = players.filter((p) => !p.injury && p.condition < 75);
  if (tired.length > 0) notes.push({ kind: 'tired', playerIds: ids(tired) });
  const unknown = players.filter((p) => knowledgeOf(world, p) < LOW_KNOWLEDGE);
  if (unknown.length > 0) notes.push({ kind: 'unknown', playerIds: ids(unknown) });
  return notes;
}
