/**
 * Menajerin iş hayatı: kulüpten ayrılma (görevden alınma, istifa), işsizlik, boş teknik direktörlük koltukları,
 * iş teklifleri ve başvurular.
 *
 * İşsizken `world.playerClubId` hiçbir kulüple eşleşmeyen NO_CLUB olur: kodun her yerindeki "kullanıcının kulübü mü?"
 * karşılaştırmaları kendiliğinden yanlış döner, böylece eski kulüp dahil bütün kulüpleri yapay zekâ yönetir ve
 * kullanıcının maçı olmaz. Son kulüp `unemployed.lastClubId`'de tutulur.
 *
 * Boş koltuklar basit modelle oluşur (rakip hocalar isimsiz): hedefinin çok gerisinde kalan Süper Lig kulübü hocasını
 * kovabilir, sezon arasında birkaç kulüp hoca değiştirir; koltuk bir süre sonra yapay zekâ tarafından doldurulur.
 * Rastgelelik kendi akışından (JOBS_SEED_SALT + gün): iş piyasası ana dünyanın rastgelelik akışını değiştirmez.
 */
import { addDays, daysBetween, weekday, type GameDate } from '../date';
import { clubPlayers, getClub, leagueClubs } from '../generation/worldGenerator';
import { computeStandings } from '../league/standings';
import { defaultTactics } from '../match/tactics';
import { addNews } from '../news';
import { Rng } from '../rng';
import { DEFAULT_TRAINING } from '../squad/training';
import { isActive } from '../transfer/offers';
import type { Club, GameWorld } from '../types';
import { divisionOf, EXPECTATION_TARGET, initialBoard } from './expectation';
import { managerLeft, managerReputation } from './manager';

/** İşsizken `playerClubId`: hiçbir kulübün kimliği boş metin değildir. */
export const NO_CLUB = '';
export const JOBS_SEED_SALT = 0x10b5;
/** Bu kadar gün iş bulamayan menajerin kariyeri biter. */
export const UNEMPLOYMENT_LIMIT_DAYS = 365;
/** İş teklifinin geçerlilik süresi (gün). */
export const JOB_OFFER_DAYS = 10;
const MAX_OPEN_OFFERS = 3;
/** Kulübün istediği en düşük menajer itibarı: kulüp itibarının bu kadar altı (Galatasaray 92 → 62, orta sıra 70 → 40). */
export const REPUTATION_GAP = 30;
/** Görevdeyken teklif ancak bu kadar daha itibarlı kulüpten ve kulüpte bu kadar gün geçtikten sonra gelir. */
const STEP_UP = 5;
const SETTLE_DAYS = 120;
/** Haftalık teklif olasılığı (uygun her boş koltuk için): işsizken / görevdeyken. */
const OFFER_CHANCE = { unemployed: 0.3, employed: 0.08 };

export type LeaveReason = 'sacked' | 'resigned';

export interface Unemployment {
  since: GameDate;
  lastClubId: string;
  reason: LeaveReason;
}

export interface Vacancy {
  clubId: string;
  since: GameDate;
  /** Bu tarihte yapay zekâ koltuğu doldurur (kullanıcı almazsa). */
  fillBy: GameDate;
}

export interface JobOffer {
  id: number;
  clubId: string;
  date: GameDate;
  expires: GameDate;
  /** Kulüp kendisi mi teklif etti, yoksa başvuruya olumlu mu yanıt verdi. */
  via: 'offer' | 'application';
}

export interface JobApplication {
  clubId: string;
  date: GameDate;
  answerOn: GameDate;
}

export function isUnemployed(world: GameWorld): boolean {
  return world.unemployed != null;
}

/** Kulübün istediği en düşük menajer itibarı. */
export function requiredReputation(club: Club): number {
  return Math.max(1, club.reputation - REPUTATION_GAP);
}

/** Menajerin itibarı bu kulübe yetiyor mu? */
export function fitsClub(world: GameWorld, club: Club): boolean {
  return managerReputation(world) >= requiredReputation(club);
}

function dayRng(world: GameWorld): Rng {
  const day = Number(world.date.slice(0, 4)) * 372 + Number(world.date.slice(5, 7)) * 31 + Number(world.date.slice(8, 10));
  return new Rng((world.seed ^ JOBS_SEED_SALT ^ Math.imul(day, 2654435761)) >>> 0);
}

/** Koltuk boşalır (kullanıcı ayrıldı ya da yapay zekâ kulübü hocasını kovdu); 20–60 gün içinde yapay zekâ doldurur. */
function openVacancy(world: GameWorld, clubId: string, rng: Rng): void {
  const list = (world.vacancies ??= []);
  if (list.some((v) => v.clubId === clubId)) return;
  list.push({ clubId, since: world.date, fillBy: addDays(world.date, rng.int(20, 60)) });
}

/** Ayrılan menajerin kulübe bağlı işleri temizlenir: taktik ve antrenman yapay zekâya, açık teklifler, talepler, gözlemci görevleri. */
function releaseClub(world: GameWorld, clubId: string): void {
  delete world.tactics[clubId];
  delete world.training[clubId];
  for (const o of world.offers) {
    if (isActive(o) && (o.buyerId === clubId || o.sellerId === clubId)) {
      o.status = 'cancelled';
      o.note = 'Teknik direktör kulüpten ayrıldı.';
    }
  }
  world.requests = [];
  world.promises = [];
  world.scouting.assignments = [];
  world.dismissedDecisions = [];
  // Süren inşaatlar kulübündür: tamamlanınca o kulübe yazılır
  for (const p of world.facilities.projects) p.clubId ??= clubId;
}

function leaguePosition(world: GameWorld, clubId: string): number {
  return computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures).findIndex((r) => r.clubId === clubId) + 1;
}

/** Kulüpten ayrılış (görevden alınma ya da istifa): menajer işsiz kalır, koltuk boşalır. */
export function leaveClub(world: GameWorld, reason: LeaveReason, text: string): void {
  if (isUnemployed(world)) return;
  const old = world.playerClubId;
  const club = getClub(world, old);
  managerLeft(world, leaguePosition(world, old), reason);
  releaseClub(world, old);
  world.unemployed = { since: world.date, lastClubId: old, reason };
  world.playerClubId = NO_CLUB;
  world.jobOffers = [];
  world.jobApplications = [];
  openVacancy(world, old, dayRng(world));
  addNews(world, {
    category: 'job',
    title: reason === 'sacked' ? 'Görevine son verildi' : 'İstifa ettin',
    body: `${text} ${club.name} ile yolların ayrıldı. İş Merkezi'nden boş kulüplere başvurabilir, gelen teklifleri değerlendirebilirsin. ` +
      `${UNEMPLOYMENT_LIMIT_DAYS} gün içinde iş bulamazsan kariyerin sona erer.`,
    important: true,
    clubId: old,
  });
}

/** İstifa (görevdeyken): kısa itibar kaybı, menajer işsiz kalır. */
export function resignJob(world: GameWorld): string | null {
  if (isUnemployed(world)) return 'Zaten bir kulüpte çalışmıyorsun.';
  if (world.gameOver) return 'Kariyerin sona erdi.';
  leaveClub(world, 'resigned', 'Görevinden istifa ettin.');
  return null;
}

/** Yeni kulübe geçiş: görevdeysen eski kulübünden ayrılırsın (koltuğu boşalır), yönetim yeni hedefle başlar. */
export function takeJob(world: GameWorld, clubId: string): void {
  const club = getClub(world, clubId);
  if (!isUnemployed(world)) {
    const old = world.playerClubId;
    managerLeft(world, leaguePosition(world, old), 'moved');
    releaseClub(world, old);
    openVacancy(world, old, dayRng(world));
  }
  world.vacancies = (world.vacancies ?? []).filter((v) => v.clubId !== clubId);
  world.playerClubId = clubId;
  world.unemployed = null;
  world.jobOffers = [];
  world.jobApplications = [];
  world.board = initialBoard(club);
  world.tactics[clubId] = defaultTactics(clubPlayers(world, clubId));
  world.training[clubId] = { ...DEFAULT_TRAINING };
  world.facilities.rejected = {};
  world.manager.clubSince = world.date;
  addNews(world, {
    category: 'job',
    title: `${club.name}'ın yeni teknik direktörü sensin`,
    body: `${club.name} ile anlaştın. Yönetimin hedefi: ${world.board.targetPosition}. sıra. Kadro, taktik ve transfer artık senin elinde.`,
    important: true,
    clubId,
  });
}

/** Boş koltuğa başvuru: kulüp 3–7 gün içinde yanıt verir. */
export function applyForJob(world: GameWorld, clubId: string): string | null {
  if (world.gameOver) return 'Kariyerin sona erdi.';
  if (clubId === world.playerClubId) return 'Zaten bu kulübün teknik direktörüsün.';
  if (!(world.vacancies ?? []).some((v) => v.clubId === clubId)) return 'Bu kulüpte boş koltuk yok.';
  if ((world.jobApplications ?? []).some((a) => a.clubId === clubId)) return 'Bu kulübe zaten başvurdun.';
  if ((world.jobOffers ?? []).some((o) => o.clubId === clubId)) return 'Bu kulübün teklifi zaten elinde.';
  (world.jobApplications ??= []).push({ clubId, date: world.date, answerOn: addDays(world.date, dayRng(world).int(3, 7)) });
  return null;
}

export function acceptJobOffer(world: GameWorld, offerId: number): string | null {
  const offer = (world.jobOffers ?? []).find((o) => o.id === offerId);
  if (!offer) return 'Teklif artık geçerli değil.';
  takeJob(world, offer.clubId);
  return null;
}

export function rejectJobOffer(world: GameWorld, offerId: number): void {
  world.jobOffers = (world.jobOffers ?? []).filter((o) => o.id !== offerId);
}

function makeOffer(world: GameWorld, club: Club, via: JobOffer['via']): void {
  const id = world.nextJobOfferId ?? 1;
  world.nextJobOfferId = id + 1;
  (world.jobOffers ??= []).push({ id, clubId: club.id, date: world.date, expires: addDays(world.date, JOB_OFFER_DAYS), via });
  addNews(world, {
    category: 'job',
    title: via === 'application' ? `${club.name} başvuruna olumlu yanıt verdi` : `${club.name}'dan iş teklifi`,
    body: `${club.name} teknik direktörlük için seninle anlaşmak istiyor. Teklif ${JOB_OFFER_DAYS} gün geçerli; İş Merkezi'nden kabul edebilir ya da reddedebilirsin.`,
    important: true,
    clubId: club.id,
  });
}

/** Ay başı ve sezon arası: yapay zekâ kulüplerinde boşalan koltuklar. */
function sackingsInAiClubs(world: GameWorld, rng: Rng): void {
  const user = world.unemployed?.lastClubId ?? world.playerClubId;
  const vacant = new Set((world.vacancies ?? []).map((v) => v.clubId));
  // Sezon arası (1 Temmuz): her kulüpte küçük olasılık; geçen sezon küme düşenlerde yüksek
  if (world.date.endsWith('-07-01')) {
    const relegated = new Set(world.history[world.history.length - 1]?.relegatedIds ?? []);
    for (const c of world.clubs) {
      if (c.country !== undefined || c.id === world.playerClubId || vacant.has(c.id)) continue;
      if (rng.chance(relegated.has(c.id) ? 0.5 : 0.08)) openVacancy(world, c.id, rng);
    }
    return;
  }
  // Sezon içi ay başı: hedefinin çok gerisindeki Süper Lig kulübü hocasını kovabilir (6 hafta oynandıktan sonra)
  if (!world.date.endsWith('-01') || world.seasonState !== 'running') return;
  const leagueGames = world.season.fixtures.filter((f) => f.competition === undefined && f.result !== null).length;
  if (leagueGames < leagueClubs(world).length * 3) return;
  const table = computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);
  table.forEach((row, i) => {
    const club = getClub(world, row.clubId);
    if (club.id === world.playerClubId || club.id === user || vacant.has(club.id) || divisionOf(club) !== 1) return;
    const gap = i + 1 - EXPECTATION_TARGET[club.fanExpectation];
    const chance = gap >= 5 ? 0.3 : gap >= 3 ? 0.12 : 0;
    if (chance > 0 && rng.chance(chance)) openVacancy(world, club.id, rng);
  });
}

/** Her gün: koltukların dolması, başvuru yanıtları, haftalık teklifler, süresi dolan teklifler, işsizlik sınırı. */
export function jobsDay(world: GameWorld): void {
  if (world.gameOver) return;
  const rng = dayRng(world);
  world.vacancies = (world.vacancies ?? []).filter((v) => v.fillBy > world.date);
  sackingsInAiClubs(world, rng);

  // Başvuru yanıtları
  const due = (world.jobApplications ?? []).filter((a) => a.answerOn <= world.date);
  world.jobApplications = (world.jobApplications ?? []).filter((a) => a.answerOn > world.date);
  for (const a of due) {
    const club = getClub(world, a.clubId);
    const open = (world.vacancies ?? []).some((v) => v.clubId === a.clubId);
    if (open && fitsClub(world, club)) {
      makeOffer(world, club, 'application');
    } else {
      addNews(world, {
        category: 'job',
        title: `${club.name} başvurunu reddetti`,
        body: open
          ? `${club.name} daha tanınmış bir teknik direktör arıyor (istenen itibar ${requiredReputation(club)}, seninki ${Math.round(managerReputation(world))}).`
          : `${club.name} koltuğu başka bir teknik direktörle doldurdu.`,
        important: false,
        clubId: club.id,
      });
    }
  }

  // Süresi dolan teklifler
  const expired = (world.jobOffers ?? []).filter((o) => o.expires <= world.date);
  world.jobOffers = (world.jobOffers ?? []).filter((o) => o.expires > world.date);
  for (const o of expired) {
    addNews(world, {
      category: 'job',
      title: `${getClub(world, o.clubId).name} teklifinin süresi doldu`,
      body: 'Yanıt verilmediği için kulüp başka adaylara yöneldi.',
      important: false,
      clubId: o.clubId,
    });
  }

  // Haftalık (pazartesi) teklifler: işsizken uygun her boş koltuktan; görevdeyken yalnızca daha itibarlı kulüpten
  if (weekday(world.date) === 1) {
    const unemployed = isUnemployed(world);
    const current = unemployed ? null : getClub(world, world.playerClubId);
    const settled = unemployed || daysBetween(world.manager.clubSince ?? world.manager.joined, world.date) >= SETTLE_DAYS;
    const candidates = (world.vacancies ?? [])
      .map((v) => getClub(world, v.clubId))
      .filter((c) => c.id !== world.unemployed?.lastClubId && fitsClub(world, c))
      .filter((c) => !(world.jobOffers ?? []).some((o) => o.clubId === c.id))
      .filter((c) => current === null || c.reputation >= current.reputation + STEP_UP)
      .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id));
    for (const club of candidates) {
      if (!settled || (world.jobOffers ?? []).length >= MAX_OPEN_OFFERS) break;
      if (rng.chance(unemployed ? OFFER_CHANCE.unemployed : OFFER_CHANCE.employed)) makeOffer(world, club, 'offer');
    }
  }

  // İşsizlik sınırı: kariyer sona erer
  if (world.unemployed && daysBetween(world.unemployed.since, world.date) >= UNEMPLOYMENT_LIMIT_DAYS) {
    world.gameOver = { date: world.date, reason: `${UNEMPLOYMENT_LIMIT_DAYS} gündür iş bulamadın; menajerlik kariyerin sona erdi.` };
  }
}
