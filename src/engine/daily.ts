/**
 * Günlük işlemler: takvim her gün ilerlediğinde çalışır.
 * Sıra önemli: önce ay başı finansı, sonra transfer dönemi, kiralıklar, teklifler, yapay zekâ,
 * ardından oyuncu durumu (iyileşme, kondisyon, moral, antrenman sakatlığı; pazartesi gelişim).
 */
import type { GameData } from './data';
import { addDays, formatDateTR, weekday } from './date';
import { startNewMonth } from './finance/finance';
import { facilitiesDay, payFacilityMaintenance } from './finance/facilities';
import { cupDay } from './league/cup';
import { europeDay } from './league/europe';
import { internationalDay } from './league/international';
import { addNews } from './news';
import type { Rng } from './rng';
import { aiTransferDay } from './transfer/ai';
import { jobsDay } from './season/jobs';
import { returnLoans } from './transfer/market';
import { processOffers } from './transfer/offers';
import { listedOffersDay, listingsOnWindowOpen } from './transfer/listing';
import { scoutingDay } from './transfer/scouting';
import { transferWindow } from './transfer/window';
import { boardMonthly } from './season/board';
import { recordReputationMonth } from './season/manager';
import { recordGrowth } from './squad/growth';
import { contractWarnings, processExpiringContracts, startNewSeason } from './season/rollover';
import { endSeason } from './season/seasonEnd';
import { recoverCondition } from './squad/condition';
import { weeklyDevelopment } from './squad/development';
import { healInjuries, trainingInjuries } from './squad/injuries';
import { moraleDrift } from './squad/morale';
import { leadersInfluence } from './squad/hierarchy';
import { expireRequests, playerRequests } from './squad/talks';
import type { GameWorld } from './types';

/** Transfer dönemi açılış/kapanış haberi. */
function windowNews(world: GameWorld): void {
  const today = transferWindow(world.date);
  const yesterday = transferWindow(addDays(world.date, -1));
  if (today.open && !yesterday.open) {
    addNews(world, {
      category: 'window',
      title: `${today.name} transfer dönemi açıldı`,
      body: `Transfer dönemi ${formatDateTR(today.closes!)} tarihine kadar açık. Transfer Merkezi'nden oyuncu arayabilirsin.`,
      important: true,
    });
  } else if (!today.open && yesterday.open) {
    addNews(world, {
      category: 'window',
      title: `${yesterday.name} transfer dönemi kapandı`,
      body: `Bir sonraki transfer dönemi ${formatDateTR(today.nextOpens!)} tarihinde açılacak.`,
      important: true,
    });
  }
}

/** Takvim yeni güne geçtikten sonra çağrılır. */
export function processDay(world: GameWorld, rng: Rng, data: GameData): void {
  if (world.date.endsWith('-01')) {
    startNewMonth(world);
    payFacilityMaintenance(world);
    boardMonthly(world);
    recordReputationMonth(world);
    recordGrowth(world);
  }
  // Sezon döngüsü
  if (world.seasonState === 'running' && world.season.fixtures.every((f) => f.result !== null)) endSeason(world, rng);
  // Türkiye Kupası ve Avrupa kuraları
  cupDay(world);
  europeDay(world);
  if (world.date.endsWith('-05-01')) contractWarnings(world);
  if (world.seasonState === 'ended' && world.date.endsWith('-07-01')) startNewSeason(world, rng, data);
  // Milli takımlar: kadrolar, milli maçlar (kulüp maçı olmayan günlerde), turnuva
  internationalDay(world, rng, data);

  facilitiesDay(world);
  jobsDay(world);
  windowNews(world);
  listingsOnWindowOpen(world);
  returnLoans(world);
  if (world.date.endsWith('-06-30')) processExpiringContracts(world, rng);
  processOffers(world);
  aiTransferDay(world, rng);
  listedOffersDay(world, rng);
  scoutingDay(world, rng);

  healInjuries(world);
  recoverCondition(world);
  moraleDrift(world);
  expireRequests(world);
  trainingInjuries(world, rng);
  if (weekday(world.date) === 1) {
    weeklyDevelopment(world, rng);
    playerRequests(world);
    leadersInfluence(world);
  }
}
