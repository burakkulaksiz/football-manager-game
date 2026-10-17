import { describe, expect, it } from 'vitest';
import { validateGameData } from './engine/data';
import { gameData } from './gameData';

describe('data/ JSON dosyaları', () => {
  it('geçerli ve 18 kulüp içeriyor', () => {
    expect(gameData.clubs).toHaveLength(18);
    expect(new Set(gameData.clubs.map((c) => c.shortName)).size).toBe(18);
  });

  it('her ülkenin isim havuzu var', () => {
    for (const n of gameData.nations) expect(gameData.namePools[n.namePool]).toBeDefined();
  });

  it('hatalı veride anlaşılır hata verir', () => {
    expect(() =>
      validateGameData({
        clubs: [{ id: 'x', name: 'X', reputation: 500 }],
        nations: [],
        namePools: {},
      }),
    ).toThrow(/reputation/);
  });
});
