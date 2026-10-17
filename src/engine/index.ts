// Oyun motorunun dışa açık yüzü. UI yalnızca buradan (veya engine/ altından) içe aktarır.
// Bu klasör React'e ya da tarayıcı API'lerine bağımlı OLMAMALI.
export * from './rng';
export * from './date';

/** Yeni kariyer bu tarihte başlar (yaz transfer dönemi başı). */
export const SEASON_START_DATE = '2026-07-01';
