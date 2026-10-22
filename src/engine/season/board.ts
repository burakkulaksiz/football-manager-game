/**
 * Yönetim: hedef sıra ve güven (0–100).
 * Maç sonuçları ve aylık sıralama değerlendirmesiyle değişir; çok düşerse görevden alınırsın.
 */
import { getClub, leagueClubs } from '../generation/worldGenerator';
import { computeStandings } from '../league/standings';
import { addNews } from '../news';
import type { Fixture, GameWorld } from '../types';

/** Bu güvenin altında (ve en az bu kadar hafta oynandıysa) görevden alınır. */
export const SACK_CONFIDENCE = 10;
export const MIN_ROUNDS_BEFORE_SACK = 8;
export const WARNING_CONFIDENCE = 30;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export function confidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'Çok memnun';
  if (confidence >= 60) return 'Memnun';
  if (confidence >= 40) return 'Kararsız';
  if (confidence >= 20) return 'Endişeli';
  return 'Güveni kalmadı';
}

/** Kullanıcının sıradaki/şimdiki lig sırası. */
export function userPosition(world: GameWorld): number {
  const table = computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);
  return table.findIndex((r) => r.clubId === world.playerClubId) + 1;
}

function roundsPlayed(world: GameWorld): number {
  return world.season.fixtures.filter((f) => f.result && f.competition === undefined && (f.homeId === world.playerClubId || f.awayId === world.playerClubId)).length;
}

/** Kullanıcının maçından sonra: galibiyet +1.5, yenilgi −2.5 (büyük hedefli kulüpte daha sert). */
export function boardAfterMatch(world: GameWorld, fixture: Fixture): void {
  const user = world.playerClubId;
  if (!fixture.result || (fixture.homeId !== user && fixture.awayId !== user)) return;
  const own = fixture.homeId === user ? fixture.result.homeGoals : fixture.result.awayGoals;
  const opp = fixture.homeId === user ? fixture.result.awayGoals : fixture.result.homeGoals;
  // Menajer kariyer kaydı
  if (own > opp) world.manager.won++;
  else if (own === opp) world.manager.drawn++;
  else world.manager.lost++;

  const bigClub = world.board.targetPosition <= 4;
  const delta = own > opp ? 1.5 : own === opp ? (bigClub ? -0.5 : 0.3) : bigClub ? -3.5 : -2.5;
  world.board.confidence = clamp(world.board.confidence + delta);
  checkSacking(world);
}

/** Ay başı: sıra hedefe göre değerlendirilir, kasa eksideyse güven düşer; mesaj gelir. */
export function boardMonthly(world: GameWorld): void {
  if (world.seasonState !== 'running' || world.gameOver) return;
  const played = roundsPlayed(world);
  const board = world.board;
  if (played >= 5) {
    const diff = board.targetPosition - userPosition(world);
    board.confidence = clamp(board.confidence + Math.max(-5, Math.min(3, diff * 0.8)));
  }
  const fin = world.finances[world.playerClubId]!;
  if (fin.balance < 0) board.confidence = clamp(board.confidence - 3);
  if (played < 3) return; // sezon başında mesaj yok

  const position = userPosition(world);
  const warning = board.confidence < WARNING_CONFIDENCE;
  addNews(world, {
    category: 'board',
    title: warning ? 'Yönetimden uyarı' : 'Yönetimin aylık değerlendirmesi',
    body:
      `Sayın ${world.manager.name}, yönetim kurulu durumu değerlendirdi: takım ${position}. sırada, hedef ${board.targetPosition}. sıra. ` +
      `Güven: ${confidenceLabel(board.confidence)} (${Math.round(board.confidence)}/100).` +
      (warning ? ' Sonuçlar düzelmezse görevine son verilecek.' : '') +
      (fin.balance < 0 ? ' Kulübün kasası eksiye düştü; harcamalara dikkat edilmeli.' : ''),
    important: warning,
    clubId: world.playerClubId,
  });
  checkSacking(world);
}

/** Güven dibe vurduysa (ve sezon yeterince ilerlediyse) görevden alma. */
export function checkSacking(world: GameWorld): void {
  if (world.gameOver || world.board.confidence >= SACK_CONFIDENCE) return;
  if (world.seasonState === 'running' && roundsPlayed(world) < MIN_ROUNDS_BEFORE_SACK) return;
  sack(world, 'Yönetim kurulu, kötü sonuçlar nedeniyle görevine son verdi.');
}

export function sack(world: GameWorld, reason: string): void {
  world.gameOver = { date: world.date, reason };
  addNews(world, {
    category: 'board',
    title: 'Görevine son verildi',
    body: `${reason} ${getClub(world, world.playerClubId).name} ile yolların ayrıldı.`,
    important: true,
    clubId: world.playerClubId,
  });
}
