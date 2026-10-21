/**
 * Altyapı (U19): kulübün A takımdan ayrı genç kadrosu.
 *
 * - U19 oyuncuları lig maçlarında oynamaz, A takım kadrosunda görünmez (clubPlayers onları saymaz),
 *   ama haftalık gelişime katılır (altyapı antrenmanı: normal yoğunluk).
 * - Her yaz (1 Temmuz) altyapıdan 4–6 kişilik yeni grup U19'a katılır.
 * - 19 yaşına giren U19'dan çıkmalıdır: yapay zekâ yeterli olanı A takıma alır, diğerleri futbolu bırakır;
 *   kullanıcıya haber gelir, karar onundur.
 * - U19 sözleşmeleri her yaz kendiliğinden bir yıl uzar.
 */
import type { GameData } from '../data';
import { addDays } from '../date';
import { clubPlayers, generateYouthPlayer, getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { ageOn } from '../player';
import type { Rng } from '../rng';
import type { GameWorld, Player } from '../types';
import { cancelOffersFor, contractExpiry, freeSquadNumber } from '../transfer/market';
import { recordMove } from './career';

/** Bu yaşa giren oyuncu U19'da kalamaz (yaş sınırı). */
export const ACADEMY_AGE_LIMIT = 19;
/** Yaz altyapı grubu büyüklüğü. */
export const INTAKE_SIZE: readonly [number, number] = [4, 6];
/** Yapay zekâ A takımını bu büyüklükten fazla doldurmaz. */
const AI_FIRST_TEAM_MAX = 28;

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

/** Kulübün U19 kadrosu. */
export function academyPlayers(world: GameWorld, clubId: string): Player[] {
  return Object.values(world.players).filter((p) => p.clubId === clubId && p.academy === true);
}

/** U19 yaş sınırını geçti mi (A takıma alınmalı ya da bırakılmalı). */
export function isOverAge(p: Player, date: string): boolean {
  return ageOn(p.birthDate, date) >= ACADEMY_AGE_LIMIT;
}

/** U19 oyuncusunu A takıma alır (boş forma numarası verilir). */
export function promoteToFirstTeam(world: GameWorld, p: Player): boolean {
  if (!p.clubId || !p.academy) return false;
  delete p.academy;
  recordMove(p, { date: world.date, kind: 'promoted', fromClubId: p.clubId, toClubId: p.clubId, fee: 0 });
  p.squadNumber = freeSquadNumber(world, p, p.clubId);
  return true;
}

/** A takımdaki genç U19'a gönderilebilir mi: yaş sınırının altında, kiralık değil. */
export function canSendToAcademy(world: GameWorld, p: Player): boolean {
  return p.clubId !== null && !p.academy && !p.loan && !isOverAge(p, world.date);
}

/** A takımdan U19'a gönderir (forma numarası boşalır; taktikteki yerine maçta otomatik biri girer). */
export function sendToAcademy(world: GameWorld, p: Player): boolean {
  if (!canSendToAcademy(world, p)) return false;
  p.academy = true;
  p.squadNumber = null;
  return true;
}

/** Oyuncuyu dünyadan siler (futbolu bıraktı): teklifler ve takip listesi temizlenir. */
function removePlayer(world: GameWorld, p: Player): void {
  cancelOffersFor(world, p.id);
  delete world.players[p.id];
  world.youthWatch = world.youthWatch.filter((id) => id !== p.id);
}

/** 30 Haziran: U19 sözleşmeleri bir yıl uzar (altyapı oyuncusu sözleşme yüzünden ayrılmaz). */
export function renewAcademyContracts(world: GameWorld): void {
  const nextSeasonDay = addDays(world.date, 1);
  for (const p of Object.values(world.players)) {
    if (p.academy && p.clubId && p.contract.expires <= world.date) {
      p.contract = { wage: p.contract.wage, expires: contractExpiry(nextSeasonDay, 1) };
    }
  }
}

/**
 * 1 Temmuz (yeni grup gelmeden önce): yaş sınırını geçen U19 oyuncuları.
 * Yapay zekâ: A takıma girecek kadar iyiyse (kadronun 22. oyuncusundan iyi) alır, değilse oyuncu futbolu bırakır.
 * Yaş sınırına gelmemiş ama A takım seviyesindeki (16. oyuncudan iyi) cevherler de erken alınır.
 * Kullanıcı: yaş sınırını geçenler için haber (karar kullanıcının).
 */
export function manageAcademies(world: GameWorld): void {
  for (const club of world.clubs) {
    const academy = academyPlayers(world, club.id);
    if (academy.length === 0) continue;
    if (club.id === world.playerClubId) {
      const over = academy.filter((p) => isOverAge(p, world.date));
      if (over.length > 0) {
        addNews(world, {
          category: 'academy',
          title: `${over.length} genç U19 yaş sınırını geçti`,
          body:
            `${over.map((p) => `${fullName(p)} (${ageOn(p.birthDate, world.date)})`).join(', ')} artık U19'da oynayamayacak yaşta. ` +
            "Altyapı ekranından A takıma alabilir ya da serbest bırakabilirsin.",
          important: true,
          clubId: club.id,
        });
      }
      continue;
    }
    const firstTeam = clubPlayers(world, club.id).map((p) => p.currentAbility).sort((a, b) => b - a);
    const bar = (rank: number) => firstTeam[Math.min(rank, firstTeam.length) - 1] ?? 0;
    let size = firstTeam.length;
    for (const p of [...academy].sort((a, b) => b.currentAbility - a.currentAbility)) {
      const over = isOverAge(p, world.date);
      const age = ageOn(p.birthDate, world.date);
      const prodigy = age >= 17 && p.currentAbility >= bar(16);
      if ((over && p.currentAbility >= bar(22) && size < AI_FIRST_TEAM_MAX) || (prodigy && size < AI_FIRST_TEAM_MAX)) {
        promoteToFirstTeam(world, p);
        size++;
      } else if (over) {
        removePlayer(world, p);
      }
    }
  }
}

/** 1 Temmuz: altyapıdan yeni grup (15–16 yaş) U19'a katılır. Kullanıcıya en umut vadedeni de söyler. */
export function academyIntake(world: GameWorld, rng: Rng, data: GameData): void {
  for (const club of world.clubs) {
    const count = rng.int(INTAKE_SIZE[0], INTAKE_SIZE[1]);
    const intake: Player[] = [];
    for (let i = 0; i < count; i++) {
      const youth = generateYouthPlayer(rng, data, club, world.date, world.nextPlayerId++, [15, 16]);
      youth.academy = true;
      youth.squadNumber = null;
      youth.joined = world.date;
      world.players[youth.id] = youth;
      intake.push(youth);
    }
    if (club.id === world.playerClubId) {
      const best = [...intake].sort((a, b) => b.potentialAbility - a.potentialAbility)[0]!;
      addNews(world, {
        category: 'academy',
        title: 'Altyapıdan yeni grup geldi',
        body:
          `${getClub(world, club.id).name} U19 kadrosuna katılan gençler: ` +
          `${intake.map((p) => `${fullName(p)} (${ageOn(p.birthDate, world.date)})`).join(', ')}. ` +
          `Altyapı sorumlusu en çok ${fullName(best)} için umutlu. Gelişimlerini Altyapı ekranından takip edebilirsin.`,
        important: true,
        playerId: best.id,
        clubId: club.id,
      });
    }
  }
}

/** Takip listesine ekler / çıkarır. */
export function toggleWatch(world: GameWorld, playerId: number): boolean {
  if (world.youthWatch.includes(playerId)) {
    world.youthWatch = world.youthWatch.filter((id) => id !== playerId);
    return false;
  }
  world.youthWatch = [...world.youthWatch, playerId];
  return true;
}
