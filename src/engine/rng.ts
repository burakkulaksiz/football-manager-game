/**
 * Seed'li, tekrarlanabilir rastgele sayı üreteci (mulberry32).
 *
 * Oyundaki tüm rastgelelik bu sınıftan geçmeli; Math.random() kullanılmaz.
 * Böylece aynı seed + aynı girdiler = aynı sonuçlar (testler ve hata ayıklama için).
 * İç durum tek bir 32-bit sayı olduğundan kayıt dosyasına kolayca yazılır.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // >>> 0 : sayıyı işaretsiz 32-bit tamsayıya indirger.
    this.state = seed >>> 0;
  }

  /** Kayıt için iç durumu döndürür. */
  getState(): number {
    return this.state;
  }

  /** Kayıttan okunan durumla üreteci kaldığı yerden devam ettirir. */
  static fromState(state: number): Rng {
    return new Rng(state);
  }

  /** [0, 1) aralığında ondalık sayı. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] aralığında (her iki uç dahil) tamsayı. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** [min, max) aralığında ondalık sayı. */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** p olasılıkla true döner (0 ≤ p ≤ 1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Diziden rastgele bir eleman seçer. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: boş dizi');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Ağırlıklara göre rastgele indeks seçer (ağırlıklar negatif olmamalı). */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new Error('Rng.weightedIndex: ağırlık toplamı 0');
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] as number;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Normal (Gauss) dağılımlı sayı — Box-Muller yöntemi. */
  normal(mean = 0, stdDev = 1): number {
    // 1 - next() ile log(0) riskini önlüyoruz.
    const u1 = 1 - this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  /** Diziyi yerinde karıştırır (Fisher-Yates) ve aynı diziyi döndürür. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j] as T, items[i] as T];
    }
    return items;
  }
}
