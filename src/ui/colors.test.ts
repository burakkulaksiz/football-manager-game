import { describe, expect, it } from 'vitest';
import { contrastRatio, DARK_PANEL, readableText, teamColorsOn } from './colors';

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

describe('koyu zeminde takım renkleri', () => {
  const BJK = { primary: '#000000', secondary: '#FFFFFF' };
  const GS = { primary: '#A90432', secondary: '#FDB912' };
  const SAM = { primary: '#E30613', secondary: '#FFFFFF' };

  it('siyah formalı takım koyu panelde ikinci rengiyle (beyaz) görünür', () => {
    expect(teamColorsOn(BJK, GS, DARK_PANEL, 2.5).home).toBe('#FFFFFF');
  });

  it('okunan birinci renk korunur; deplasman ev sahibiyle karışırsa diğer rengi, o da yoksa yedek', () => {
    expect(teamColorsOn(SAM, BJK, DARK_PANEL, 2.5)).toEqual({ home: '#E30613', away: '#FFFFFF' });
    // İki takımın okunan rengi de beyaz: deplasman yedek renge döner
    expect(teamColorsOn(BJK, { primary: '#000000', secondary: '#FFFFFF' }, DARK_PANEL, 2.5).away).toBe('#7fd3ff');
  });
});
