/**
 * Sezon sonu (son maçın ertesi günü): final tablosu, ödüller, sıralama primi, küme düşme/çıkma
 * kararları, yönetimin sezon değerlendirmesi ve sezon arşivi. Lig değişiklikleri 1 Temmuz'da uygulanır.
 */
import { addIncome } from '../finance/finance';
import { formatPlain } from '../transfer/market';
import { getClub, leagueClubs } from '../generation/worldGenerator';
import { computeStandings, goalDifference } from '../league/standings';
import { CUP_NAME, cupChampion, leagueFixtures } from '../league/cup';
import { EUROPE, europeChampion } from '../league/europe';
import { topAssists, topRatings, topScorers } from '../league/stats';
import { addNews } from '../news';
import { ageOn, primaryPosition } from '../player';
import type { Rng } from '../rng';
import type { GameWorld, SeasonAward, SeasonSummary } from '../types';
import { recordSeasonCareers } from '../squad/career';
import { sack } from './board';
import { managerSeasonEnd, sackThreshold } from './manager';
import { divisionOf } from './expectation';

export const RELEGATED_COUNT = 3;

/** Sıralama primi (€): şampiyon 15 Mn, ikinci 10 Mn, üçüncü 7 Mn, dördüncü 5 Mn, sonra 3,5 Mn'den 0,8 Mn'e. */
export function prizeFor(position: number, clubCount: number): number {
  const top = [15_000_000, 10_000_000, 7_000_000, 5_000_000];
  if (position <= top.length) return top[position - 1]!;
  const t = (position - 5) / Math.max(1, clubCount - 5);
  return Math.round((3_500_000 - t * 2_700_000) / 50_000) * 50_000;
}

function seasonAwards(world: GameWorld): SeasonAward[] {
  const fixtures = leagueFixtures(world.season.fixtures);
  const awards: SeasonAward[] = [];
  const add = (title: string, playerId: number | undefined, clubId: string | undefined, value: string) => {
    if (playerId === undefined || clubId === undefined) return;
    const p = world.players[playerId];
    if (!p) return;
    awards.push({
      title,
      playerId,
      playerName: `${p.firstName} ${p.lastName}`,
      clubId,
      clubName: getClub(world, clubId).name,
      value,
    });
  };

  const scorer = topScorers(fixtures, 1)[0];
  add('Gol Kralı', scorer?.playerId, scorer?.clubId, `${scorer?.goals ?? 0} gol`);
  const assister = topAssists(fixtures, 1)[0];
  add('Asist Kralı', assister?.playerId, assister?.clubId, `${assister?.value ?? 0} asist`);

  const rounds = new Set(fixtures.map((f) => f.round)).size;
  const rated = topRatings(fixtures, Math.max(10, Math.round(rounds * 0.55)), 200);
  const best = rated[0];
  add('Sezonun Oyuncusu', best?.playerId, best?.clubId, `ort. ${best?.value.toFixed(2) ?? '-'}`);
  const young = topRatings(fixtures, 10, 300).find((r) => {
    const p = world.players[r.playerId];
    return p !== undefined && ageOn(p.birthDate, world.date) <= 21;
  });
  add('Sezonun Genç Oyuncusu', young?.playerId, young?.clubId, `ort. ${young?.value.toFixed(2) ?? '-'}`);
  const keeper = rated.find((r) => {
    const p = world.players[r.playerId];
    return p !== undefined && primaryPosition(p) === 'GK';
  });
  add('Sezonun Kalecisi', keeper?.playerId, keeper?.clubId, `ort. ${keeper?.value.toFixed(2) ?? '-'}`);
  return awards;
}

/** 1. Lig'den çıkacak kulüpler: itibarı yüksek olanın şansı fazla. */
function choosePromoted(world: GameWorld, rng: Rng, count: number): string[] {
  const pool = world.clubs.filter((c) => divisionOf(c) === 2).map((c) => c.id);
  const chosen: string[] = [];
  while (chosen.length < count && pool.length > 0) {
    const weights = pool.map((id) => getClub(world, id).reputation ** 2);
    chosen.push(pool.splice(rng.weightedIndex(weights), 1)[0]!);
  }
  return chosen;
}

/** Yönetimin sezon sonu değerlendirmesi. Küme düşen ya da hedefin çok gerisinde kalan menajer gider. */
function boardSeasonReview(world: GameWorld, position: number, relegated: boolean): void {
  const board = world.board;
  if (relegated) {
    sack(world, 'Takım küme düştü; yönetim kurulu görevine son verdi.');
    return;
  }
  const diff = board.targetPosition - position;
  const delta = position === 1 ? 30 : diff >= 0 ? 15 : diff >= -3 ? -5 : -20;
  board.confidence = Math.max(0, Math.min(100, board.confidence + delta));
  if (board.confidence < sackThreshold(world, 15)) sack(world, 'Sezon hedeflerinin çok gerisinde kalındı; yönetim kurulu görevine son verdi.');
}

export function endSeason(world: GameWorld, rng: Rng): SeasonSummary {
  const clubs = leagueClubs(world);
  const table = computeStandings(clubs.map((c) => c.id), world.season.fixtures);
  const relegatedIds = table.slice(-RELEGATED_COUNT).map((r) => r.clubId);
  const promotedIds = choosePromoted(world, rng, RELEGATED_COUNT);
  const userPosition = table.findIndex((r) => r.clubId === world.playerClubId) + 1;

  // Sıralama primleri
  table.forEach((row, i) => addIncome(world.finances[row.clubId]!, 'prize', prizeFor(i + 1, table.length)));

  const summary: SeasonSummary = {
    year: world.season.year,
    table: table.map((r) => ({ clubId: r.clubId, name: getClub(world, r.clubId).name, points: r.points, goalDifference: goalDifference(r) })),
    championId: table[0]!.clubId,
    relegatedIds,
    promotedIds,
    relegatedNames: relegatedIds.map((id) => getClub(world, id).name),
    promotedNames: promotedIds.map((id) => getClub(world, id).name),
    userClubId: world.playerClubId,
    userPosition,
    targetPosition: world.board.targetPosition,
    awards: seasonAwards(world),
  };
  const cupWinner = cupChampion(world);
  if (cupWinner) {
    summary.cupWinnerId = cupWinner;
    summary.cupWinnerName = getClub(world, cupWinner).name;
  }
  const clWinner = europeChampion(world, 'cl');
  if (clWinner) summary.clWinnerName = getClub(world, clWinner).name;
  const elWinner = europeChampion(world, 'el');
  if (elWinner) summary.elWinnerName = getClub(world, elWinner).name;
  world.history.push(summary);
  recordSeasonCareers(world);
  world.seasonState = 'ended';

  const champion = getClub(world, summary.championId).name;
  const userName = getClub(world, world.playerClubId).name;
  addNews(world, {
    category: 'season',
    title: `Sezon sona erdi: ${champion} şampiyon!`,
    body:
      `${summary.year}/${String((summary.year + 1) % 100).padStart(2, '0')} sezonu tamamlandı. Şampiyon: ${champion}. ` +
      `${summary.cupWinnerName ? `${CUP_NAME}: ${summary.cupWinnerName}. ` : ''}` +
      `${summary.clWinnerName ? `${EUROPE.cl.name}: ${summary.clWinnerName}. ` : ''}${summary.elWinnerName ? `${EUROPE.el.name}: ${summary.elWinnerName}. ` : ''}Küme düşenler: ${summary.relegatedNames.join(', ')}. 1. Lig'den çıkanlar: ${summary.promotedNames.join(', ')}. ` +
      `${userName} ligi ${userPosition}. sırada bitirdi (hedef ${summary.targetPosition}.) ve €${formatPlain(prizeFor(userPosition, table.length))} sıralama primi kazandı. ` +
      `Ödüller: ${summary.awards.map((a) => `${a.title}: ${a.playerName} (${a.clubName}, ${a.value})`).join('; ')}. ` +
      `Yeni sezon 1 Temmuz'da başlıyor; sözleşmesi 30 Haziran'da biten oyuncular kulüpten ayrılacak.`,
    important: true,
    clubId: world.playerClubId,
  });
  for (const award of summary.awards.filter((a) => a.clubId === world.playerClubId)) {
    addNews(world, {
      category: 'season',
      title: `${award.title}: ${award.playerName}`,
      body: `${award.playerName} sezonun ödülünü kazandı: ${award.title} (${award.value}).`,
      important: false,
      playerId: award.playerId,
      clubId: world.playerClubId,
    });
  }
  if (userPosition === 1) world.manager.titles++;
  // Menajer: itibar (hedefe göre sıra, kupalar) ve kariyer sezonu; görevden alma kararından önce
  managerSeasonEnd(world, userPosition, relegatedIds.includes(world.playerClubId));
  boardSeasonReview(world, userPosition, relegatedIds.includes(world.playerClubId));
  return summary;
}

