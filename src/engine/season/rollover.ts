/**
 * Sezonlar arası: sözleşme uyarıları (1 Mayıs), sözleşme bitişleri (30 Haziran) ve
 * yeni sezon (1 Temmuz): küme düşme/çıkma, itibar, emeklilik, altyapı, bütçeler, fikstür.
 */
import type { GameData } from '../data';
import { addDays, makeDate } from '../date';
import { clubPlayers, getClub, leagueClubs } from '../generation/worldGenerator';
import { academyIntake, manageAcademies, renewAcademyContracts } from '../squad/academy';
import { generateSeason, seasonLabel } from '../league/schedule';
import { addNews } from '../news';
import { ageOn } from '../player';
import type { Rng } from '../rng';
import type { Club, GameWorld, Player } from '../types';
import {
  contractExpiry,
  formatPlain,
  preferredYears,
  releasePlayer,
  wageDemand,
} from '../transfer/market';
import { divisionOf, EXPECTATION_TARGET, expectationForRank } from './expectation';

/** Yapay zekâ kulübünün kadro üst sınırı (fazlası serbest bırakılır). */
export const AI_SQUAD_LIMIT = 30;
/** Yapay zekâ, kadro sırası bunun altındaki oyuncuyla sözleşme yeniler. */
const AI_RENEW_RANK = 18;

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

/** 1 Mayıs: sözleşmesi bu yaz biten oyuncularımız için uyarı. */
export function contractWarnings(world: GameWorld): void {
  const deadline = makeDate(Number(world.date.slice(0, 4)), 6, 30);
  const expiring = clubPlayers(world, world.playerClubId).filter((p) => !p.loan && p.contract.expires <= deadline);
  if (expiring.length === 0) return;
  addNews(world, {
    category: 'contract',
    title: `${expiring.length} oyuncunun sözleşmesi bitiyor`,
    body: `Sözleşmesi 30 Haziran'da bitecek oyuncular: ${expiring.map(fullName).join(', ')}. Yenilemezsen kulüpten ayrılacaklar (oyuncu profilinden "Sözleşme Yenile").`,
    important: true,
    clubId: world.playerClubId,
  });
}

/** 30 Haziran: sözleşmesi biten oyuncular. Yapay zekâ işine yarayanları yeniler, kullanıcınınkiler ayrılır. */
export function processExpiringContracts(world: GameWorld, rng: Rng): void {
  renewAcademyContracts(world);
  const released: Player[] = [];
  const ranks = new Map<string, number[]>();
  for (const club of world.clubs) {
    ranks.set(club.id, clubPlayers(world, club.id).sort((a, b) => b.currentAbility - a.currentAbility).map((p) => p.id));
  }
  const nextSeasonDay = addDays(world.date, 1);
  for (const p of Object.values(world.players)) {
    if (!p.clubId || p.loan || p.contract.expires > world.date) continue;
    const clubId = p.clubId;
    if (clubId === world.playerClubId) {
      released.push(p);
      releasePlayer(world, p);
      continue;
    }
    const rank = ranks.get(clubId)!.indexOf(p.id);
    const age = ageOn(p.birthDate, world.date);
    if (rank < AI_RENEW_RANK && age <= 32) {
      const [minYears, maxYears] = preferredYears(age);
      p.contract = { wage: wageDemand(world, p, clubId), expires: contractExpiry(nextSeasonDay, rng.int(minYears, maxYears)) };
    } else {
      releasePlayer(world, p);
    }
  }
  if (released.length > 0) {
    addNews(world, {
      category: 'contract',
      title: `${released.length} oyuncu kulüpten ayrıldı`,
      body: `Sözleşmesi sona eren oyuncular serbest kaldı: ${released.map(fullName).join(', ')}.`,
      important: true,
      clubId: world.playerClubId,
    });
  }
}

/** Emeklilik olasılığı: 34 yaşından itibaren artar, 38'de kesin; serbest kalmış yaşlılar daha çabuk bırakır. */
export function retirementChance(p: Player, age: number): number {
  if (age >= 38) return 1;
  let chance = age >= 34 ? 0.25 + (age - 34) * 0.18 + (p.currentAbility < 90 ? 0.15 : 0) : 0;
  if (!p.clubId && age >= 31) chance += 0.4;
  return Math.min(1, chance);
}

function retirePlayers(world: GameWorld, rng: Rng): void {
  const retiredUser: string[] = [];
  for (const p of Object.values(world.players)) {
    const age = ageOn(p.birthDate, world.date);
    if (!rng.chance(retirementChance(p, age))) continue;
    if (p.clubId === world.playerClubId) retiredUser.push(`${fullName(p)} (${age})`);
    releasePlayer(world, p);
    delete world.players[p.id];
  }
  // Silinen oyunculara ait eski teklifler ve takip listesi de temizlenir.
  world.offers = world.offers.filter((o) => world.players[o.playerId] !== undefined);
  world.youthWatch = world.youthWatch.filter((id) => world.players[id] !== undefined);
  if (retiredUser.length > 0) {
    addNews(world, {
      category: 'player',
      title: 'Futbolu bırakanlar',
      body: `Kariyerini noktalayan oyuncularımız: ${retiredUser.join(', ')}.`,
      important: true,
      clubId: world.playerClubId,
    });
  }
}

/** Yapay zekâ kulübü fazla kalabalıksa en zayıf (genç olmayan) oyuncuları serbest bırakır. */
function trimAiSquads(world: GameWorld): void {
  for (const club of world.clubs) {
    if (club.id === world.playerClubId) continue;
    const squad = clubPlayers(world, club.id)
      .filter((p) => !p.loan && ageOn(p.birthDate, world.date) >= 20)
      .sort((a, b) => a.currentAbility - b.currentAbility);
    let size = clubPlayers(world, club.id).length;
    for (const p of squad) {
      if (size <= AI_SQUAD_LIMIT) break;
      releasePlayer(world, p);
      size--;
    }
  }
}

/** Küme düşme / çıkma ve itibar değişimleri (geçen sezonun sonucuna göre). */
function applyLeagueChanges(world: GameWorld): void {
  const summary = world.history[world.history.length - 1];
  if (!summary) return;
  const clampRep = (n: number) => Math.max(30, Math.min(99, n));
  const repRank = [...leagueClubs(world)].sort((a, b) => b.reputation - a.reputation).map((c) => c.id);

  summary.table.forEach((row, i) => {
    const club = getClub(world, row.clubId);
    const position = i + 1;
    const expected = repRank.indexOf(club.id) + 1;
    let delta = position === 1 ? 3 : position <= 4 ? 1 : 0;
    if (position <= expected - 3) delta += 1;
    if (position >= expected + 3) delta -= 1;
    club.reputation = clampRep(club.reputation + delta);
  });

  const scale = (club: Club, wage: number, budget: number) => {
    club.wageBudget = Math.round(club.wageBudget * wage);
    club.budget = Math.round(club.budget * budget);
    world.finances[club.id]!.wageBudget = club.wageBudget;
  };
  for (const id of summary.relegatedIds) {
    const club = getClub(world, id);
    club.division = 2;
    club.reputation = clampRep(club.reputation - 5);
    scale(club, 0.6, 0.5);
  }
  for (const id of summary.promotedIds) {
    const club = getClub(world, id);
    club.division = 1;
    club.reputation = clampRep(club.reputation + 3);
    scale(club, 1.4, 1.5);
  }
}

/** Yeni sezon bütçeleri ve gelirleri; beklentiler itibar sırasından. */
function newSeasonFinances(world: GameWorld): void {
  const ranked = [...leagueClubs(world)].sort((a, b) => b.reputation - a.reputation);
  for (const club of world.clubs) {
    const fin = world.finances[club.id]!;
    const top = divisionOf(club) === 1;
    fin.tvIncome = Math.round(fin.wageBudget * (top ? 0.45 : 0.3));
    fin.sponsorIncome = Math.round(fin.wageBudget * 0.3);
    fin.ticketPrice = Math.round(8 + club.reputation * 0.3);
    // Temel bütçe + kasadaki fazlanın bir kısmı
    const surplus = Math.max(0, fin.balance - fin.wageBudget / 4);
    fin.transferBudget = Math.round(club.budget + surplus * 0.3);
    club.fanExpectation = top ? expectationForRank(ranked.indexOf(club) + 1) : 'avoid_relegation';
  }
}

/** 1 Temmuz: yeni sezon. */
export function startNewSeason(world: GameWorld, rng: Rng, data: GameData): void {
  applyLeagueChanges(world);
  retirePlayers(world, rng);
  // Altyapı: yaş sınırını geçenler (yapay zekâ alır ya da bırakır), sonra yeni grup U19'a
  manageAcademies(world);
  academyIntake(world, rng, data);
  trimAiSquads(world);
  newSeasonFinances(world);

  for (const p of Object.values(world.players)) {
    p.yellowCards = 0;
    p.morale = Math.round((p.morale + 60) / 2);
  }

  const year = world.season.year + 1;
  world.season = generateSeason(rng, leagueClubs(world).map((c) => c.id), year);
  world.seasonState = 'running';

  const userClub = getClub(world, world.playerClubId);
  world.board.targetPosition = EXPECTATION_TARGET[userClub.fanExpectation];
  world.board.confidence = Math.max(world.board.confidence, 45);
  const fin = world.finances[userClub.id]!;
  addNews(world, {
    category: 'season',
    title: `${seasonLabel(year)} sezonu başladı`,
    body:
      `Yeni sezonda yönetimin hedefi: ${world.board.targetPosition}. sıra. ` +
      `Transfer bütçesi €${formatPlain(fin.transferBudget)}, maaş bütçesi yıllık €${formatPlain(fin.wageBudget)}. ` +
      `Süper Lig'e yeni katılanlar: ${world.history[world.history.length - 1]?.promotedNames.join(', ') ?? '-'}.`,
    important: true,
    clubId: userClub.id,
  });
}
