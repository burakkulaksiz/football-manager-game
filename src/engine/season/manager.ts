/**
 * Menajer itibarı (1–100) ve kariyer geçmişi.
 * Başlangıç itibarı yeni oyunda seçilen geçmişten. Maç sonuçları (rakibin gücüne göre), sezon sonunda hedefe göre
 * sıra ve kupalar, küme düşme ve görevden alınma itibarı değiştirir.
 * Etkileri: oyuncuların kulübe gelme isteği (kulüp itibarına ±10) ve yönetimin sabrı (görevden alma eşiği,
 * yenilgide güven kaybı).
 */
import { getClub } from '../generation/worldGenerator';
import { cupChampion, isCupFixture } from '../league/cup';
import { europeChampion, isEuropeFixture } from '../league/europe';
import type { Fixture, GameWorld } from '../types';

export type ManagerBackground = 'amateur' | 'player' | 'international' | 'coach';

export const MANAGER_BACKGROUNDS: Record<ManagerBackground, { label: string; description: string; reputation: number }> = {
  amateur: { label: 'Amatör', description: 'Futbolu hiç profesyonel oynamadın; işe sıfırdan başlıyorsun.', reputation: 15 },
  player: { label: 'Eski futbolcu', description: "Süper Lig'de oynadın; futbol çevresi seni tanıyor.", reputation: 35 },
  international: { label: 'Eski milli futbolcu', description: 'Milli formayı giydin; adın ülkenin her yerinde biliniyor.', reputation: 50 },
  coach: { label: 'Tecrübeli teknik direktör', description: 'Yıllardır takım çalıştırıyorsun; saygın bir isimsin.', reputation: 65 },
};
export const BACKGROUND_ORDER: readonly ManagerBackground[] = ['amateur', 'player', 'international', 'coach'];

export type Trophy = 'league' | 'cup' | 'cl' | 'el';

/** Menajerin bir sezonu (o sezon çalıştırdığı kulüpte). Eski kayıttan gelen sezonlarda maç istatistikleri yok. */
export interface ManagerSeason {
  year: number;
  clubId: string;
  clubName: string;
  position: number;
  target: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  trophies: Trophy[];
  /** Sezon sonundaki itibar. */
  reputation?: number;
  /** Bu sezon görevden alındı. */
  sacked?: true;
}

/** Rekor maç (en farklı galibiyet / yenilgi). */
export interface ManagerRecordMatch {
  date: string;
  opponent: string;
  scored: number;
  conceded: number;
}

/** İtibar geçmişi: ay ('YYYY-MM') → değer; en fazla REPUTATION_HISTORY_LIMIT ay. */
export const REPUTATION_HISTORY_LIMIT = 360;

const clamp = (v: number) => Math.max(1, Math.min(100, Math.round(v * 10) / 10));

export function managerReputation(world: GameWorld): number {
  return world.manager.reputation ?? MANAGER_BACKGROUNDS.player.reputation;
}

/** "Yerel" … "Dünyaca ünlü". */
export function reputationLabel(reputation: number): string {
  if (reputation >= 85) return 'Dünyaca ünlü';
  if (reputation >= 70) return 'Avrupa çapında';
  if (reputation >= 50) return 'Ulusal';
  if (reputation >= 30) return 'Bölgesel';
  return 'Yerel';
}

function adjust(world: GameWorld, delta: number): void {
  world.manager.reputation = clamp(managerReputation(world) + delta);
}

/**
 * Maç sonrası itibar: güçlü rakibi (itibarı 5+ yüksek) yenmek +0.6, denk rakibi +0.3, zayıfı +0.15; yenilgide tersi
 * (zayıfa −0.6, denge −0.3, güçlüye −0.1); beraberlik güçlüye karşı +0.15, zayıfa karşı −0.15. Avrupa ×1.5, kupa ×0.8.
 */
export function reputationAfterMatch(world: GameWorld, fixture: Fixture): void {
  const user = world.playerClubId;
  const r = fixture.result;
  if (!r || (fixture.homeId !== user && fixture.awayId !== user)) return;
  const home = fixture.homeId === user;
  const own = home ? r.homeGoals : r.awayGoals;
  const opp = home ? r.awayGoals : r.homeGoals;
  const opponentId = home ? fixture.awayId : fixture.homeId;
  const gap = getClub(world, opponentId).reputation - getClub(world, user).reputation;
  const strength = gap > 5 ? 'stronger' : gap < -5 ? 'weaker' : 'equal';
  const won = own > opp || (own === opp && r.penalties !== undefined && (home ? r.penalties.home > r.penalties.away : r.penalties.away > r.penalties.home));
  const lost = own < opp || (own === opp && r.penalties !== undefined && !won);
  let delta: number;
  if (won) delta = { stronger: 0.6, equal: 0.3, weaker: 0.15 }[strength];
  else if (lost) delta = { stronger: -0.1, equal: -0.3, weaker: -0.6 }[strength];
  else delta = { stronger: 0.15, equal: 0, weaker: -0.15 }[strength];
  const weight = isEuropeFixture(fixture) ? 1.5 : isCupFixture(fixture) ? 0.8 : 1;
  adjust(world, delta * weight);

  // Rekorlar: en farklı galibiyet / yenilgi (eşit farkta çok gol atılan)
  const m = world.manager;
  const match: ManagerRecordMatch = { date: fixture.date, opponent: getClub(world, opponentId).name, scored: own, conceded: opp };
  const margin = (x: ManagerRecordMatch) => x.scored - x.conceded;
  if (own > opp && (!m.bestWin || margin(match) > margin(m.bestWin) || (margin(match) === margin(m.bestWin) && own > m.bestWin.scored))) m.bestWin = match;
  if (own < opp && (!m.worstDefeat || margin(match) < margin(m.worstDefeat) || (margin(match) === margin(m.worstDefeat) && opp > m.worstDefeat.conceded))) m.worstDefeat = match;
}

/** Ay başı: itibar geçmişine bir nokta. */
export function recordReputationMonth(world: GameWorld): void {
  const month = world.date.slice(0, 7);
  const history = (world.manager.reputationHistory ??= []);
  const last = history[history.length - 1];
  if (last?.month === month) last.value = managerReputation(world);
  else history.push({ month, value: managerReputation(world) });
  if (history.length > REPUTATION_HISTORY_LIMIT) history.splice(0, history.length - REPUTATION_HISTORY_LIMIT);
}

/** Bu sezon kulübümüzün tüm maçlarından galibiyet / beraberlik / yenilgi ve goller (penaltılarla biten beraberlik sayılır). */
function seasonRecord(world: GameWorld): Required<Pick<ManagerSeason, 'won' | 'drawn' | 'lost' | 'goalsFor' | 'goalsAgainst'>> {
  const user = world.playerClubId;
  const out = { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const f of world.season.fixtures) {
    if (!f.result || (f.homeId !== user && f.awayId !== user)) continue;
    const own = f.homeId === user ? f.result.homeGoals : f.result.awayGoals;
    const opp = f.homeId === user ? f.result.awayGoals : f.result.homeGoals;
    out.goalsFor += own;
    out.goalsAgainst += opp;
    if (own > opp) out.won++;
    else if (own < opp) out.lost++;
    else out.drawn++;
  }
  return out;
}

/** Sezonun kupaları (kulübümüz kazandıysa). */
export function seasonTrophies(world: GameWorld, leaguePosition: number): Trophy[] {
  const user = world.playerClubId;
  const trophies: Trophy[] = [];
  if (leaguePosition === 1) trophies.push('league');
  if (cupChampion(world) === user) trophies.push('cup');
  if (europeChampion(world, 'cl') === user) trophies.push('cl');
  if (europeChampion(world, 'el') === user) trophies.push('el');
  return trophies;
}

/**
 * Sezon sonu: itibar hedefe göre sıra ile değişir (hedefin her sırası üstü/altı ±1.5, en çok ±10), şampiyonluk +8,
 * Türkiye Kupası +4, Şampiyonlar Ligi +12, Avrupa Ligi +7, küme düşme −12; ardından sezon kariyere yazılır.
 */
export function managerSeasonEnd(world: GameWorld, position: number, relegated: boolean): void {
  const target = world.board.targetPosition;
  const trophies = seasonTrophies(world, position);
  let delta = Math.max(-10, Math.min(10, (target - position) * 1.5));
  if (trophies.includes('league')) delta += 8;
  if (trophies.includes('cup')) delta += 4;
  if (trophies.includes('cl')) delta += 12;
  if (trophies.includes('el')) delta += 7;
  if (relegated) delta -= 12;
  adjust(world, delta);
  (world.manager.seasons ??= []).push({
    year: world.season.year,
    clubId: world.playerClubId,
    clubName: getClub(world, world.playerClubId).name,
    position,
    target,
    ...seasonRecord(world),
    trophies,
    reputation: managerReputation(world),
  });
  recordReputationMonth(world);
}

/** Görevden alınma: itibar −8; sezon ortasındaysa o ana kadarki sezon kariyere yazılır. */
export function managerSacked(world: GameWorld, position: number): void {
  adjust(world, -8);
  const seasons = (world.manager.seasons ??= []);
  const current = seasons.find((s) => s.year === world.season.year && s.clubId === world.playerClubId);
  if (current) {
    current.sacked = true;
    current.reputation = managerReputation(world);
  } else {
    seasons.push({
      year: world.season.year,
      clubId: world.playerClubId,
      clubName: getClub(world, world.playerClubId).name,
      position,
      target: world.board.targetPosition,
      ...seasonRecord(world),
      trophies: [],
      reputation: managerReputation(world),
      sacked: true,
    });
  }
  recordReputationMonth(world);
}

/** Oyuncuların kulübümüze gelme isteğinde kulüp itibarına eklenen pay: itibar 50 → 0, 100 → +10, 1 → −10. */
export function managerTransferBonus(world: GameWorld): number {
  return (managerReputation(world) - 50) * 0.2;
}

/** Görevden alma eşiği (yönetim güveni): itibar 50 → 10, 100 → 5, 15 → 13.5. */
export function sackThreshold(world: GameWorld, base: number): number {
  return base - (managerReputation(world) - 50) * 0.1;
}

/** Yenilgide güven kaybı çarpanı: itibar 100 → ×0.8, 50 → ×1, 1 → ×1.2. */
export function lossPenaltyFactor(world: GameWorld): number {
  return 1 - (managerReputation(world) - 50) / 250;
}

/** Eski kayıt: itibar geçmiş başarılardan, kariyer sezonları arşivden (maç istatistikleri olmadan). */
export function migrateManager(world: GameWorld): void {
  const m = world.manager;
  m.background ??= 'player';
  if (m.reputation === undefined) {
    m.reputation = clamp(MANAGER_BACKGROUNDS[m.background].reputation + m.titles * 8 + (m.cups ?? 0) * 4 + (m.europeTitles ?? 0) * 10);
  }
  if (!m.seasons) {
    m.seasons = world.history
      .filter((h) => h.userClubId)
      .map((h) => {
        const clubName = world.clubs.find((c) => c.id === h.userClubId)?.name ?? h.userClubId;
        const trophies: Trophy[] = [];
        if (h.championId === h.userClubId) trophies.push('league');
        if (h.cupWinnerId === h.userClubId) trophies.push('cup');
        if (h.clWinnerName === clubName) trophies.push('cl');
        if (h.elWinnerName === clubName) trophies.push('el');
        return { year: h.year, clubId: h.userClubId, clubName, position: h.userPosition, target: h.targetPosition, trophies };
      });
  }
  if (!m.reputationHistory || m.reputationHistory.length === 0) recordReputationMonth(world);
}
