import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('aynı seed ile aynı diziyi üretir', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('farklı seed ile farklı dizi üretir', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('kaydedilen durumdan kaldığı yerden devam eder', () => {
    const a = new Rng(42);
    for (let i = 0; i < 10; i++) a.next();
    const restored = Rng.fromState(a.getState());
    expect(restored.next()).toEqual(a.next());
  });

  it('next() [0,1) aralığında kalır ve ortalaması ~0.5', () => {
    const rng = new Rng(7);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });

  it('int() uçlar dahil sınırlar içinde kalır ve tüm değerleri üretir', () => {
    const rng = new Rng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const x = rng.int(1, 20);
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(20);
      seen.add(x);
    }
    expect(seen.size).toBe(20);
  });

  it('weightedIndex() ağırlıklara uygun dağılır', () => {
    const rng = new Rng(3);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i++) counts[rng.weightedIndex([1, 2, 7])]!++;
    expect(counts[0]! / 30000).toBeCloseTo(0.1, 1);
    expect(counts[2]! / 30000).toBeCloseTo(0.7, 1);
  });

  it('normal() ortalama ve standart sapmaya yakın değerler üretir', () => {
    const rng = new Rng(5);
    const n = 20000;
    const xs = Array.from({ length: n }, () => rng.normal(10, 2));
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    expect(mean).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
  });

  it('shuffle() elemanları korur', () => {
    const rng = new Rng(11);
    const arr = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
