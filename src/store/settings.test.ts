import { describe, expect, it } from 'vitest';
import { autosaveDue, DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('geçersiz veride varsayılanlara döner', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ matchSpeed: 'warp', scale: 3, showPitch: 'yes' })).toEqual(DEFAULT_SETTINGS);
  });

  it('geçerli değerleri alır, eksikleri varsayılandan doldurur', () => {
    const s = parseSettings({ matchSpeed: 'fast', accent: 'club', showPitch: false, mutedNews: ['finance', 7] });
    expect(s.matchSpeed).toBe('fast');
    expect(s.accent).toBe('club');
    expect(s.showPitch).toBe(false);
    expect(s.mutedNews).toEqual(['finance']);
    expect(s.autosave).toBe(DEFAULT_SETTINGS.autosave);
  });
});

describe('autosaveDue', () => {
  it('kapalıyken hiç kaydetmez', () => {
    expect(autosaveDue('off', null, '2026-08-01')).toBe(false);
  });

  it('maç günü modunda her seferinde kaydeder', () => {
    expect(autosaveDue('matchday', '2026-08-01', '2026-08-02')).toBe(true);
  });

  it('haftalıkta yedi gün geçmesini bekler', () => {
    expect(autosaveDue('weekly', '2026-08-01', '2026-08-07')).toBe(false);
    expect(autosaveDue('weekly', '2026-08-01', '2026-08-08')).toBe(true);
  });

  it('aylıkta yeni aya girilmesini bekler', () => {
    expect(autosaveDue('monthly', '2026-08-01', '2026-08-31')).toBe(false);
    expect(autosaveDue('monthly', '2026-08-31', '2026-09-01')).toBe(true);
  });

  it('daha önce otomatik kayıt yoksa kaydeder', () => {
    expect(autosaveDue('weekly', null, '2026-08-01')).toBe(true);
  });
});
