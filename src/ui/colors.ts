/** Kulüp renkleriyle yazı: ikinci renk zemin üstünde okunmuyorsa beyaz ya da siyah. */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG göreli parlaklık (0–1). */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** İki rengin kontrast oranı (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Zemin üstündeki yazı rengi: tercih edilen renk yeterince okunuyorsa (oran ≥ 2.5) o,
 * değilse zemine göre beyaz ya da siyah.
 */
export function readableText(background: string, preferred: string): string {
  if (contrastRatio(background, preferred) >= 2.5) return preferred;
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#111111') ? '#ffffff' : '#111111';
}
