/** Denge raporu için küçük istatistik yardımcıları (saf). */

export const mean = (xs: readonly number[]): number => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);

export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Ortalamanın standart hatası. */
export const seMean = (xs: readonly number[]): number => sd(xs) / Math.sqrt(xs.length);

/** Oranın (0–1) standart hatası. */
export const seProportion = (p: number, n: number): number => Math.sqrt((p * (1 - p)) / n);

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** En küçük kareler doğrusunun eğimi (x = 0, 1, 2… sıra). */
export function slope(ys: readonly number[]): number {
  const n = ys.length;
  if (n < 2) return NaN;
  const mx = (n - 1) / 2;
  const my = mean(ys);
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return num / den;
}

/** Sıra numaraları (eşitlikte ortalama sıra). */
function ranks(xs: readonly number[]): number[] {
  const order = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]!.i] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman sıra korelasyonu (−1…1). */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length || xs.length < 3) return NaN;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? NaN : num / Math.sqrt(dx * dy);
}

export type Status = 'ok' | 'uncertain' | 'off' | 'info';

/**
 * Ölçülen değeri hedef aralığa göre değerlendirir.
 *  - ok: değer aralıkta
 *  - uncertain: değer aralık dışında ama %95 güven aralığı (±1,96 SE) aralığa değiyor: örnek artırılınca netleşir
 *  - off: aralık dışında ve güven aralığı da dışında
 *  - info: hedef yok
 */
export function judge(value: number, range: readonly [number, number] | null, se = 0): Status {
  if (range === null || Number.isNaN(value)) return 'info';
  const [lo, hi] = range;
  if (value >= lo && value <= hi) return 'ok';
  const margin = 1.96 * (Number.isFinite(se) ? se : 0);
  return value + margin >= lo && value - margin <= hi ? 'uncertain' : 'off';
}
