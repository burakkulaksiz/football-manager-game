/**
 * Günlük işlemler: takvim her gün ilerlediğinde çalışır.
 * Sıra önemli: önce ay başı finansı, sonra transfer dönemi, kiralıklar, teklifler, yapay zekâ.
 */
import { addDays, formatDateTR } from './date';
import { startNewMonth } from './finance/finance';
import { addNews } from './news';
import type { Rng } from './rng';
import { aiTransferDay } from './transfer/ai';
import { returnLoans } from './transfer/market';
import { processOffers } from './transfer/offers';
import { transferWindow } from './transfer/window';
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
export function processDay(world: GameWorld, rng: Rng): void {
  if (world.date.endsWith('-01')) startNewMonth(world);
  windowNews(world);
  returnLoans(world);
  processOffers(world);
  aiTransferDay(world, rng);
}
