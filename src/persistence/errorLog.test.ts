import { describe, expect, it } from 'vitest';
import { clearErrors, ERROR_LOG_LIMIT, formatErrors, logError, readErrors } from './errorLog';

/** Bellek içi localStorage yerine geçen. */
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('hata günlüğü', () => {
  it('hatayı kaynağı, mesajı ve yığınıyla yazar; en çok ERROR_LOG_LIMIT kayıt tutar', () => {
    const store = memory();
    logError('promise', new Error('Kayıt bozuk'), store, new Date('2026-10-30T10:00:00Z'));
    logError('window', 'düz metin', store);
    const [first, second] = readErrors(store);
    expect(first).toMatchObject({ at: '2026-10-30T10:00:00.000Z', source: 'promise', message: 'Kayıt bozuk' });
    expect(first!.stack).toContain('Kayıt bozuk');
    expect(second).toMatchObject({ source: 'window', message: 'düz metin' });
    expect(second!.stack).toBeUndefined();
    expect(formatErrors([second!])).toContain('(window) düz metin');

    for (let i = 0; i < ERROR_LOG_LIMIT + 5; i++) logError('window', `hata ${i}`, store);
    const all = readErrors(store);
    expect(all).toHaveLength(ERROR_LOG_LIMIT);
    expect(all.at(-1)!.message).toBe(`hata ${ERROR_LOG_LIMIT + 4}`);
    clearErrors(store);
    expect(readErrors(store)).toEqual([]);
  });

  it('bozuk ya da erişilemeyen depolama oyunu durdurmaz', () => {
    const broken = { getItem: () => '{bozuk', setItem: () => { throw new Error('dolu'); }, removeItem: () => {} };
    expect(readErrors(broken)).toEqual([]);
    expect(() => logError('window', 'x', broken)).not.toThrow();
    expect(readErrors(null)).toEqual([]);
  });
});
