/**
 * Kulüp tesisleri: stadyum (kapasite), antrenman tesisi, altyapı tesisi, sağlık merkezi (seviye 1–10).
 * Kulüpler itibarına göre başlar (yurtdışı kulüplerinde seviye saklanmaz, itibardan hesaplanır).
 * Kullanıcı yatırımı yönetimden ister: yönetim kasaya ve güvenine (menajer itibarı da etkiler) göre onaylar;
 * bedel kasadan ödenir, inşaat birkaç ay sürer (stadyum genişletmesi sezon arasında, 1 Temmuz'da biter).
 * Her seviye yıllık bakım gideri ekler (ay başı, "Tesisler").
 */
import { addDays, daysBetween, formatDateTR, makeDate, type GameDate } from '../date';
import { getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { managerReputation } from '../season/manager';
import type { GameWorld } from '../types';
import { addExpense } from './finance';

export type FacilityKind = 'training' | 'youth' | 'medical';
export type ProjectKind = FacilityKind | 'stadium';

export interface ClubFacilities {
  training: number;
  youth: number;
  medical: number;
}

export interface FacilityProject {
  kind: ProjectKind;
  /** Stadyumda eklenecek koltuk; tesiste hedef seviye. */
  target: number;
  cost: number;
  started: GameDate;
  completes: GameDate;
}

export interface FacilitiesState {
  /** Türkiye kulüplerinin tesis seviyeleri. */
  levels: Record<string, ClubFacilities>;
  /** Kullanıcının süren inşaatları (tür başına en çok bir). */
  projects: FacilityProject[];
  /** Reddedilen taleplerin günü (tür başına; yeniden istemek için bekleme). */
  rejected: Partial<Record<ProjectKind, GameDate>>;
}

export const FACILITY_KINDS: readonly FacilityKind[] = ['training', 'youth', 'medical'];
export const MAX_LEVEL = 10;
/** Stadyum genişletmesi başına koltuk ve en büyük kapasite. */
export const STADIUM_STEP = 5000;
export const MAX_CAPACITY = 80_000;
/** Koltuk başına genişletme bedeli (€). */
const SEAT_COST = 1200;
/** Tesis seviyesi bedeli: taban × mevcut seviye^1.6. */
const LEVEL_COST_BASE = 200_000;
/** Seviye başına yıllık bakım (€) ve stadyumda 1000 koltuk başına yıllık bakım. */
export const MAINTENANCE_PER_LEVEL = 40_000;
const MAINTENANCE_PER_1000_SEATS = 6_000;
/** Reddedilen talep bu kadar gün sonra yeniden istenebilir. */
export const REQUEST_COOLDOWN_DAYS = 60;

const clampLevel = (v: number) => Math.max(1, Math.min(MAX_LEVEL, Math.round(v)));

/** İtibardan başlangıç seviyesi: itibar 92 → 8, 55 → 5, 40 → 4; yurtdışı devleri 10. */
export function levelForReputation(reputation: number): number {
  return clampLevel(1 + (reputation / 100) * 8);
}

export function initFacilities(world: GameWorld): FacilitiesState {
  const levels: Record<string, ClubFacilities> = {};
  for (const club of world.clubs) {
    if (club.country !== undefined) continue;
    const base = levelForReputation(club.reputation);
    // Kulüpten kulübe biraz farklı (kimliğe bağlı sabit sapma; rastgelelik kullanılmaz)
    const nudge = (salt: number) => ((club.id.length * 7 + salt * 13 + club.id.charCodeAt(0)) % 3) - 1;
    levels[club.id] = { training: clampLevel(base + nudge(1)), youth: clampLevel(base + nudge(2)), medical: clampLevel(base + nudge(3)) };
  }
  return { levels, projects: [], rejected: {} };
}

/** Kulübün tesis seviyesi (yurtdışı kulübünde itibardan). */
export function facilityLevel(world: GameWorld, clubId: string | null, kind: FacilityKind): number {
  if (!clubId) return 5;
  const stored = world.facilities?.levels[clubId];
  return stored ? stored[kind] : levelForReputation(getClub(world, clubId).reputation);
}

/* ------------------------------------------------------------------ */
/* Etkiler                                                              */
/* ------------------------------------------------------------------ */

/** Antrenman tesisi: haftalık gelişim çarpanı (seviye 1 → ×0.885, 5 → ×1.025, 10 → ×1.2). */
export function trainingDevelopmentFactor(level: number): number {
  return 0.85 + level * 0.035;
}

/** Antrenman sakatlığı riski çarpanı: antrenman tesisi ve sağlık merkezi (her biri seviye 10 → ×0.85, 1 → ×1.12). */
export function trainingInjuryFactor(trainingLevel: number, medicalLevel: number): number {
  return (1.15 - trainingLevel * 0.03) * (1.15 - medicalLevel * 0.03);
}

/** Sağlık merkezi: maç sakatlığı riski çarpanı (seviye 10 → ×0.87, 1 → ×1.095). */
export function matchInjuryFactor(medicalLevel: number): number {
  return 1.12 - medicalLevel * 0.025;
}

/** Sağlık merkezi: sakatlık süresi çarpanı (seviye 10 → ×0.8, 1 → ×1.16). */
export function injuryDurationFactor(medicalLevel: number): number {
  return 1.2 - medicalLevel * 0.04;
}

/** Altyapı tesisi: U19'a katılan gencin seviye ve potansiyel payı, cevher olasılığı çarpanı. */
export function youthFacilityBonus(level: number): { level: number; potential: number; wonderkid: number } {
  return { level: (level - 5) * 0.25, potential: (level - 5) * 2, wonderkid: 0.6 + level * 0.08 };
}

/* ------------------------------------------------------------------ */
/* Bedel, süre, bakım                                                   */
/* ------------------------------------------------------------------ */

/** Bir üst seviyenin (stadyumda bir genişletmenin) bedeli. */
export function upgradeCost(world: GameWorld, clubId: string, kind: ProjectKind): number {
  if (kind === 'stadium') return STADIUM_STEP * SEAT_COST;
  const level = facilityLevel(world, clubId, kind);
  return Math.round((LEVEL_COST_BASE * level ** 1.6) / 50_000) * 50_000;
}

/** İnşaat süresi (ay): tesislerde 3 + seviye / 3; stadyum sezon arasına kadar (en az 5 ay). */
export function buildMonths(world: GameWorld, clubId: string, kind: ProjectKind): number {
  if (kind === 'stadium') return 5;
  return 3 + Math.floor(facilityLevel(world, clubId, kind) / 3);
}

function completionDate(world: GameWorld, kind: ProjectKind, months: number): GameDate {
  const y = Number(world.date.slice(0, 4));
  const m = Number(world.date.slice(5, 7));
  const d = Number(world.date.slice(8, 10));
  const earliest = makeDate(y + Math.floor((m - 1 + months) / 12), ((m - 1 + months) % 12) + 1, Math.min(d, 28));
  if (kind !== 'stadium') return earliest;
  // Stadyum genişletmesi sezon arasında biter: en erken tarihten sonraki ilk 1 Temmuz
  const july = makeDate(Number(earliest.slice(0, 4)), 7, 1);
  return july >= earliest ? july : makeDate(Number(earliest.slice(0, 4)) + 1, 7, 1);
}

/** Kulübün yıllık tesis bakım gideri. */
export function maintenancePerYear(world: GameWorld, clubId: string): number {
  const levels = world.facilities?.levels[clubId];
  if (!levels) return 0;
  const seats = getClub(world, clubId).capacity;
  return (levels.training + levels.youth + levels.medical) * MAINTENANCE_PER_LEVEL + (seats / 1000) * MAINTENANCE_PER_1000_SEATS;
}

/** Ay başı: tüm Türkiye kulüplerinin bakım gideri (yıllığın 1/12'si). */
export function payFacilityMaintenance(world: GameWorld): void {
  for (const clubId of Object.keys(world.facilities?.levels ?? {})) {
    const fin = world.finances[clubId];
    if (fin) addExpense(fin, 'facilities', maintenancePerYear(world, clubId) / 12);
  }
}

/* ------------------------------------------------------------------ */
/* Yönetimden talep                                                     */
/* ------------------------------------------------------------------ */

/** Yönetimin istediği en düşük güven: 50, menajerin itibarıyla ±15 (itibar 100 → 35, 1 → 65). */
export function requiredConfidence(world: GameWorld): number {
  return 50 - (managerReputation(world) - 50) * 0.3;
}

/** Talep neden yapılamaz (yoksa null): inşaat sürüyor, en üst seviye, bekleme süresi. */
export function requestBlocker(world: GameWorld, kind: ProjectKind): string | null {
  const club = getClub(world, world.playerClubId);
  if (world.facilities.projects.some((p) => p.kind === kind)) return 'İnşaat sürüyor.';
  if (kind === 'stadium' ? club.capacity + STADIUM_STEP > MAX_CAPACITY : facilityLevel(world, club.id, kind) >= MAX_LEVEL) {
    return 'En üst seviyede.';
  }
  const rejected = world.facilities.rejected[kind];
  if (rejected && daysBetween(rejected, world.date) < REQUEST_COOLDOWN_DAYS) {
    return `Yönetim yakın zamanda reddetti; ${formatDateTR(addDays(rejected, REQUEST_COOLDOWN_DAYS))} tarihinden sonra yeniden isteyebilirsin.`;
  }
  return null;
}

export type RequestOutcome = { approved: true; project: FacilityProject } | { approved: false; reason: string };

const FACILITY_NAMES: Record<ProjectKind, string> = {
  stadium: 'Stadyum genişletmesi',
  training: 'Antrenman tesisi',
  youth: 'Altyapı tesisi',
  medical: 'Sağlık merkezi',
};

export function projectName(kind: ProjectKind): string {
  return FACILITY_NAMES[kind];
}

/**
 * Yönetimden yatırım isteği. Onay için: kasa bedelin 1,3 katı + bir buçuk aylık maaş kadar olmalı, yönetimin güveni
 * requiredConfidence'ın üstünde olmalı. Onaylanırsa bedel kasadan ödenir ve inşaat başlar; reddedilirse 60 gün beklenir.
 */
export function requestFacility(world: GameWorld, kind: ProjectKind): RequestOutcome {
  const blocker = requestBlocker(world, kind);
  if (blocker) return { approved: false, reason: blocker };
  const clubId = world.playerClubId;
  const fin = world.finances[clubId]!;
  const cost = upgradeCost(world, clubId, kind);
  const reserve = fin.wageBudget / 8;
  let reason: string | null = null;
  if (fin.balance < cost * 1.3 + reserve) {
    reason = `Kulübün kasası bu yatırım için yetersiz (bedel ${money(cost)}, kasa ${money(Math.max(0, fin.balance))}).`;
  } else if (world.board.confidence < requiredConfidence(world)) {
    reason = 'Yönetim kurulu şu an sana bu kadar büyük bir yatırımı emanet edecek kadar güvenmiyor. Önce sonuçlar gelmeli.';
  }
  const name = FACILITY_NAMES[kind];
  if (reason) {
    world.facilities.rejected[kind] = world.date;
    addNews(world, { category: 'board', title: `Yönetim talebini reddetti: ${name}`, body: reason, important: false, clubId });
    return { approved: false, reason };
  }
  addExpense(fin, 'facilities', cost);
  const project: FacilityProject = {
    kind,
    target: kind === 'stadium' ? STADIUM_STEP : facilityLevel(world, clubId, kind) + 1,
    cost,
    started: world.date,
    completes: completionDate(world, kind, buildMonths(world, clubId, kind)),
  };
  world.facilities.projects.push(project);
  delete world.facilities.rejected[kind];
  addNews(world, {
    category: 'board',
    title: `Yönetim onayladı: ${name}`,
    body: `Yönetim kurulu ${name.toLocaleLowerCase('tr')} yatırımını onayladı (${money(cost)}). İnşaat ${formatDateTR(project.completes)} tarihinde tamamlanacak.`,
    important: false,
    clubId,
  });
  return { approved: true, project };
}

/** Her gün: tamamlanan inşaatlar. */
export function facilitiesDay(world: GameWorld): void {
  const done = world.facilities.projects.filter((p) => p.completes <= world.date);
  if (done.length === 0) return;
  world.facilities.projects = world.facilities.projects.filter((p) => p.completes > world.date);
  const club = getClub(world, world.playerClubId);
  for (const p of done) {
    if (p.kind === 'stadium') club.capacity += p.target;
    else world.facilities.levels[club.id]![p.kind] = p.target;
    addNews(world, {
      category: 'board',
      title: `${FACILITY_NAMES[p.kind]} tamamlandı`,
      body: p.kind === 'stadium'
        ? `${club.stadium} genişletildi: yeni kapasite ${club.capacity.toLocaleString('tr-TR')} kişi.`
        : `${FACILITY_NAMES[p.kind]} ${p.target}. seviyeye yükseldi.`,
      important: true,
      clubId: club.id,
    });
  }
}

function money(n: number): string {
  return n >= 1_000_000 ? `€${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn` : `€${Math.round(n / 1000)} bin`;
}
