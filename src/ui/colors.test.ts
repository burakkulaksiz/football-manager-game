import { describe, expect, it } from 'vitest';
import { contrastRatio, readableText } from './colors';

describe('kulüp renkleriyle okunur yazı', () => {
  it('siyah-beyaz en yüksek kontrast, aynı renk en düşük', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#A90432', '#A90432')).toBeCloseTo(1, 5);
  });

  it('okunan ikinci renk korunur (Galatasaray sarı-kırmızı, Fenerbahçe lacivert-sarı)', () => {
    expect(readableText('#A90432', '#FDB912')).toBe('#FDB912');
    expect(readableText('#FFED00', '#163962')).toBe('#163962');
  });

  it('okunmayan ikinci renk beyaz ya da siyaha döner (Rizespor yeşil-mavi)', () => {
    expect(readableText('#00843D', '#0072CE')).toBe('#ffffff');
    expect(readableText('#FFD200', '#FFED00')).toBe('#111111');
  });
});
