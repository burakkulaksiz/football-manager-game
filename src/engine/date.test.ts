import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDateTR, makeDate, weekday } from './date';

describe('oyun takvimi', () => {
  it('gün ekler; ay ve yıl geçişlerini doğru yapar', () => {
    expect(addDays('2026-07-01', 1)).toBe('2026-07-02');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // artık yıl
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('iki tarih arasındaki gün farkını hesaplar', () => {
    expect(daysBetween('2026-07-01', '2026-07-31')).toBe(30);
    expect(daysBetween('2026-07-01', '2027-07-01')).toBe(365);
  });

  it('Türkçe tarih biçimi üretir', () => {
    expect(formatDateTR('2026-07-01')).toBe('1 Temmuz 2026, Çarşamba');
    expect(weekday('2026-10-17')).toBe(6); // Cumartesi
  });

  it('makeDate sıfır dolgulu metin döndürür', () => {
    expect(makeDate(2026, 7, 1)).toBe('2026-07-01');
  });

  it('geçersiz tarihte hata verir', () => {
    expect(() => addDays('2026/07/01', 1)).toThrow();
  });
});
