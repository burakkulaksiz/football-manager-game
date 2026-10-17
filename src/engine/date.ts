/**
 * Oyun takvimi yardımcıları.
 *
 * Tarihler kayıt dostu olsun diye 'YYYY-MM-DD' metni (GameDate) olarak tutulur.
 * Hesaplamalar UTC üzerinden yapılır; böylece saat dilimi / yaz saati kayması olmaz.
 */
export type GameDate = string;

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const WEEKDAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: GameDate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Geçersiz tarih: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function fromUtc(d: Date): GameDate {
  return d.toISOString().slice(0, 10);
}

export function makeDate(year: number, month: number, day: number): GameDate {
  return fromUtc(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(date: GameDate, days: number): GameDate {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

/** b - a, gün cinsinden. */
export function daysBetween(a: GameDate, b: GameDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}

/** 0 = Pazar … 6 = Cumartesi */
export function weekday(date: GameDate): number {
  return toUtc(date).getUTCDay();
}

/** Örn. "1 Temmuz 2026, Çarşamba" */
export function formatDateTR(date: GameDate): string {
  const d = toUtc(date);
  return `${d.getUTCDate()} ${MONTHS_TR[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${WEEKDAYS_TR[d.getUTCDay()]}`;
}
