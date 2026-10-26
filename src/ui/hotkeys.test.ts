import { describe, expect, it } from 'vitest';
import { MENU } from './screens';
import { SCREEN_KEYS, shortcutGroups } from './hotkeys';

describe('klavye kısayolları', () => {
  it('her ekran tuşu tektir ve harf / virgüldür', () => {
    const keys = Object.values(SCREEN_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z,]$/);
  });

  it('menüdeki her ekranın bir tuşu vardır', () => {
    for (const group of MENU) for (const item of group.items) expect(SCREEN_KEYS[item.id], item.label).toBeDefined();
  });

  it('ekran tuşları genel ve maç kısayollarıyla (Ctrl+S, Boşluk, +/-, V) çakışmaz', () => {
    for (const k of Object.values(SCREEN_KEYS)) expect([' ', '+', '-', '=', '?', 'v']).not.toContain(k);
  });

  it('yardım listesi her ekran tuşunu içerir', () => {
    const screens = shortcutGroups((id) => id).find((g) => g.title === 'Ekranlar')!;
    expect(screens.items).toHaveLength(Object.keys(SCREEN_KEYS).length);
  });
});
