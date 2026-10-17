/** Transfer dönemleri: yaz (1 Temmuz – 8 Eylül) ve devre arası (2 Ocak – 1 Şubat). */
import { makeDate, type GameDate } from '../date';

export interface WindowStatus {
  open: boolean;
  name: 'Yaz' | 'Devre arası' | null;
  /** Açıksa kapanış günü (dahil). */
  closes: GameDate | null;
  /** Kapalıysa bir sonraki açılış. */
  nextOpens: GameDate | null;
}

export function transferWindow(date: GameDate): WindowStatus {
  const year = Number(date.slice(0, 4));
  const summer = { start: makeDate(year, 7, 1), end: makeDate(year, 9, 8) };
  const winter = { start: makeDate(year, 1, 2), end: makeDate(year, 2, 1) };
  if (date >= summer.start && date <= summer.end) return { open: true, name: 'Yaz', closes: summer.end, nextOpens: null };
  if (date >= winter.start && date <= winter.end) return { open: true, name: 'Devre arası', closes: winter.end, nextOpens: null };
  const nextOpens = date < winter.start ? winter.start : date < summer.start ? summer.start : makeDate(year + 1, 1, 2);
  return { open: false, name: null, closes: null, nextOpens };
}

export function isWindowOpen(date: GameDate): boolean {
  return transferWindow(date).open;
}
