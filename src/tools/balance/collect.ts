/**
 * Veri toplama: bir kariyeri (kullanıcı kulübü otomatik oynanır) N sezon oynatır ve her sezon sonunda ham özet çıkarır.
 * Motor değiştirilmez; yalnızca `advance` çağrılır. Kovulma olursa kaydedilir ve kariyer yapay olarak sürdürülür
 * (kovulma oranı da bir denge ölçüsü; sonraki sezonların verisi kaybolmasın).
 */
import {
  advance,
  ageOn,
  clubPlayers,
  computeStandings,
  createWorld,
  EUROPE_COMPETITIONS,
  getClub,
  EUROPE_FINAL,
  europeChampion,
  europeFixtures,
  leagueClubs,
  leagueFixtures,
  topAssists,
  topScorers,
  type Fixture,
  type GameWorld,
} from '../../engine';
import { gameData } from '../../gameData';
import type { CareerLog, ClubSeason, EuropeSeason, MatchRow, SackEvent, SeasonSnapshot } from './types';

const START = '2026-07-01';
/** Sezon başına güvenlik sınırı: sonsuz döngüye karşı (bir sezon ~400 `advance` çağrısı). */
const MAX_STEPS_PER_SEASON = 4000;

function matchRow(f: Fixture): MatchRow {
  const r = f.result!;
  return {
    homeId: f.homeId,
    awayId: f.awayId,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    shots: r.stats.home.shots + r.stats.away.shots,
    shotsOnTarget: r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget,
    corners: r.stats.home.corners + r.stats.away.corners,
    fouls: r.stats.home.fouls + r.stats.away.fouls,
    yellows: r.cards.filter((c) => c.type === 'yellow').length,
    reds: r.cards.filter((c) => c.type === 'red').length,
    penaltyGoals: r.goals.filter((g) => g.kind === 'penalty').length,
  };
}

/** Kulübün A takımında en iyi 11 oyuncunun ortalama yeteneği. */
function eliteStrength(world: GameWorld, clubId: string): number {
  const top = clubPlayers(world, clubId).map((p) => p.currentAbility).sort((a, b) => b - a).slice(0, 11);
  return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
}

function sumLast12(world: GameWorld, clubId: string, pick: (m: GameWorld['finances'][string]['history'][number]) => number): number {
  return world.finances[clubId]!.history.slice(-12).reduce((s, m) => s + pick(m), 0);
}

const totalIncome = (m: GameWorld['finances'][string]['history'][number]) => Object.values(m.income).reduce((a, b) => a + b, 0);

function europeSeason(world: GameWorld, comp: 'cl' | 'el'): EuropeSeason | null {
  const fixtures = europeFixtures(world, comp);
  if (fixtures.length === 0) return null;
  const turkish = (id: string) => world.clubs.find((c) => c.id === id)?.country === undefined;
  const ids = (list: Fixture[]) => new Set(list.flatMap((f) => [f.homeId, f.awayId]).filter(turkish));
  const champion = europeChampion(world, comp);
  return {
    comp,
    turkishClubs: ids(fixtures).size,
    turkishKnockout: ids(fixtures.filter((f) => f.round >= 7)).size,
    turkishFinalists: ids(fixtures.filter((f) => f.round === EUROPE_FINAL)).size,
    turkishWinner: champion !== null && turkish(champion),
  };
}

/** Sezon sonu (son maç oynandı, yeni sezon başlamadı) özeti. */
function snapshot(world: GameWorld, career: number, strengths: Map<string, number>, cohort: number[]): SeasonSnapshot {
  const fixtures = world.season.fixtures;
  const league = leagueFixtures(fixtures).filter((f) => f.result !== null);
  const clubs = leagueClubs(world);
  const table = computeStandings(clubs.map((c) => c.id), fixtures);
  const summary = world.history[world.history.length - 1]!;
  const seasonStart = `${world.season.year}-07-01`;

  const clubSeasons: ClubSeason[] = table.map((row, i) => {
    const fin = world.finances[row.clubId]!;
    return {
      clubId: row.clubId,
      position: i + 1,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      strength: strengths.get(row.clubId) ?? eliteStrength(world, row.clubId),
      balance: fin.balance,
      wageBudget: fin.wageBudget,
      income12: sumLast12(world, row.clubId, totalIncome),
      transferSpend12: sumLast12(world, row.clubId, (m) => m.expense.transfersOut),
      transferIncome12: sumLast12(world, row.clubId, (m) => m.income.transfersIn),
      wages12: sumLast12(world, row.clubId, (m) => m.expense.wages),
      otherExpense12: sumLast12(world, row.clubId, (m) => m.expense.bonuses + m.expense.signingBonuses + m.expense.agentFees + m.expense.scouting + m.expense.facilities),
      prize12: sumLast12(world, row.clubId, (m) => m.income.prize),
      baseBudget: getClub(world, row.clubId).budget,
      transferBudget: fin.transferBudget,
    };
  });

  // Yalnızca Süper Lig kulüplerini ilgilendiren hareketler (yurtdışı kulüpler arası trafik sayılmaz)
  const leagueIds = new Set(clubs.map((c) => c.id));
  const transfers = { count: 0, fee: 0, maxFee: 0, free: 0, loans: 0, fees: [] as number[], cas: [] as number[] };
  for (const p of Object.values(world.players)) {
    for (const m of p.moves ?? []) {
      if (m.date < seasonStart) continue;
      if (!(m.fromClubId && leagueIds.has(m.fromClubId)) && !(m.toClubId && leagueIds.has(m.toClubId))) continue;
      if (m.kind === 'transfer') {
        transfers.count++;
        transfers.fee += m.fee;
        transfers.fees.push(m.fee);
        transfers.cas.push(p.currentAbility);
        transfers.maxFee = Math.max(transfers.maxFee, m.fee);
      } else if (m.kind === 'free') transfers.free++;
      else if (m.kind === 'loan') transfers.loans++;
    }
  }

  const players = clubs.flatMap((c) => clubPlayers(world, c.id));
  const alive = cohort.map((id) => world.players[id]).filter((p): p is NonNullable<typeof p> => p !== undefined);
  const eliteMeans = clubs.map((c) => eliteStrength(world, c.id));
  // Kullanıcı kulübü ihmal edildiği için (yenileme / transfer yok) kadro ölçülerine girmez: yapay zekâ kulüplerinin dengesi ölçülür
  const squadSizes = clubs.filter((c) => c.id !== world.playerClubId).map((c) => clubPlayers(world, c.id).length);
  const everyone = Object.values(world.players);
  // Yetenek enflasyonu hangi yaş grubundan geliyor: 22 altı / 22–28 / 29+ ortalama CA
  const ageMean = (pick: (age: number) => boolean) => {
    const group = players.filter((p) => pick(ageOn(p.birthDate, world.date)));
    return group.length === 0 ? NaN : group.reduce((s, p) => s + p.currentAbility, 0) / group.length;
  };

  return {
    career,
    year: world.season.year,
    userClubId: world.playerClubId,
    userPosition: summary.userPosition,
    userTarget: summary.targetPosition,
    championId: summary.championId,
    matches: league.map(matchRow),
    clubs: clubSeasons,
    topScorerGoals: topScorers(league, 1)[0]?.goals ?? 0,
    topAssists: topAssists(league, 1)[0]?.value ?? 0,
    transfers,
    europe: EUROPE_COMPETITIONS.map((c) => europeSeason(world, c)).filter((e): e is EuropeSeason => e !== null),
    pool: {
      squadMean: squadSizes.reduce((a, b) => a + b, 0) / squadSizes.length,
      squadMin: Math.min(...squadSizes),
      freeAgents: everyone.filter((p) => !p.clubId && !p.academy).length,
      academy: everyone.filter((p) => p.academy).length,
      total: everyone.length,
    },
    cohort: {
      size: cohort.length,
      alive: alive.length,
      meanCA: alive.length === 0 ? NaN : alive.reduce((s, p) => s + p.currentAbility, 0) / alive.length,
      meanAge: alive.length === 0 ? NaN : alive.reduce((s, p) => s + ageOn(p.birthDate, world.date), 0) / alive.length,
    },
    talent: {
      eliteMeanCA: eliteMeans.reduce((a, b) => a + b, 0) / eliteMeans.length,
      maxCA: Math.max(...players.map((p) => p.currentAbility)),
      over150: players.filter((p) => p.currentAbility >= 150).length,
      meanAge: players.reduce((s, p) => s + ageOn(p.birthDate, world.date), 0) / players.length,
      caByAge: { u22: ageMean((a) => a < 22), mid: ageMean((a) => a >= 22 && a <= 28), o29: ageMean((a) => a >= 29) },
    },
  };
}

export interface CollectOptions {
  career: number;
  seed: number;
  clubId: string;
  seasons: number;
  /** İlerleme bildirimi (sezon bitince). */
  onSeason?: (career: number, seasonIndex: number) => void;
}

/** Bir kariyeri oynatır. Kullanıcı kulübü varsayılan taktikle otomatik oynar. */
export function collectCareer(opts: CollectOptions): CareerLog {
  const world = createWorld(gameData, opts.seed, opts.clubId, START);
  const log: CareerLog = { career: opts.career, seed: opts.seed, userClubId: opts.clubId, seasons: [], sacks: [] };
  let snapshotYear: number | null = null;
  let strengths: Map<string, number> | null = null;
  /** İlk sezon sonundaki lig oyuncuları: gelişim (aynı oyuncular) ile kadro değişimini ayırmak için. */
  let cohort: number[] | null = null;
  let steps = 0;
  const maxSteps = MAX_STEPS_PER_SEASON * opts.seasons;

  while (log.seasons.length < opts.seasons) {
    if (steps++ > maxSteps) throw new Error(`Kariyer ${opts.career}: ${opts.seasons} sezon ${maxSteps} adımda bitmedi`);
    advance(world, gameData, { autoPlayUserMatch: true });

    if (world.gameOver) {
      const sack: SackEvent = { career: opts.career, year: world.season.year, date: world.gameOver.date, reason: world.gameOver.reason, clubId: world.playerClubId };
      log.sacks.push(sack);
      // Kariyeri sürdür: kovulma kaydedildi, veri akışı kesilmesin
      world.gameOver = null;
      world.board.confidence = 60;
      continue;
    }
    // Güçler ilk lig maçından sonra alınır (yaz transferleri bitmiş, sezon başlamış)
    if (strengths === null && world.season.fixtures.some((f) => f.competition === undefined && f.result !== null)) {
      strengths = new Map(leagueClubs(world).map((c) => [c.id, eliteStrength(world, c.id)]));
    }
    if (world.seasonState === 'ended' && snapshotYear !== world.season.year) {
      snapshotYear = world.season.year;
      cohort ??= leagueClubs(world).flatMap((c) => clubPlayers(world, c.id).map((p) => p.id));
      log.seasons.push(snapshot(world, opts.career, strengths ?? new Map(), cohort));
      strengths = null;
      opts.onSeason?.(opts.career, log.seasons.length);
    }
  }
  return log;
}
