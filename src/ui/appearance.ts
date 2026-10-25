/**
 * Görünüm ayarlarının sayfaya uygulanması: zemin (html data-bg), vurgu rengi (CSS değişkenleri) ve arayüz ölçeği (zoom).
 */
import type { Accent, Settings } from '../store/settings';
import { UI_SCALE_FACTOR } from '../store/settings';
import { contrastRatio } from './colors';

/** Vurgunun okunması gereken koyu panel zemini. */
const PANEL_BG = '#0f2412';

export const ACCENT_COLORS: Record<Exclude<Accent, 'club'>, string> = {
  yellow: '#f6cf3c',
  blue: '#5aa9ff',
  green: '#5fd68a',
  orange: '#ff9f43',
  pink: '#ff7eb6',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Rengi beyaza doğru açar (t: 0 = aynı, 1 = beyaz). */
function lighten(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
}

/**
 * Kulüp rengi vurgusu: iki kulüp renginden koyu zeminde daha iyi okunanı; yine de okunmuyorsa
 * (lacivert, bordo…) okunana kadar açılır.
 */
export function clubAccent(primary: string, secondary: string): string {
  let best = [primary, secondary].sort((a, b) => contrastRatio(b, PANEL_BG) - contrastRatio(a, PANEL_BG))[0]!;
  for (let t = 0; t <= 1 && contrastRatio(best, PANEL_BG) < 4.5; t += 0.1) best = lighten(best, 0.1);
  return best;
}

/** Vurgu rengi ve üstündeki yazı rengi. */
export function accentColors(accent: Accent, club: { primary: string; secondary: string } | null): { accent: string; ink: string } {
  const color = accent === 'club' ? (club ? clubAccent(club.primary, club.secondary) : ACCENT_COLORS.yellow) : ACCENT_COLORS[accent];
  return { accent: color, ink: contrastRatio(color, '#14120a') >= contrastRatio(color, '#ffffff') ? '#14120a' : '#ffffff' };
}

/** Ayarları sayfaya uygular (App her ayar / kulüp değişiminde çağırır). */
export function applyAppearance(settings: Settings, club: { primary: string; secondary: string } | null): void {
  const root = document.documentElement;
  root.dataset.bg = settings.background;
  const { accent, ink } = accentColors(settings.accent, club);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', ink);
  root.style.setProperty('--accent-rgb', hexToRgb(accent).join(' '));
  const zoom = UI_SCALE_FACTOR[settings.scale];
  root.style.setProperty('--ui-zoom', String(zoom));
  document.body.style.zoom = zoom === 1 ? '' : String(zoom);
}

/** Arayüz ölçeği (JS ile ölçülen yükseklikler için: pencere pikselini CSS pikseline çevirir). */
export function uiZoom(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'));
  return Number.isFinite(z) && z > 0 ? z : 1;
}
