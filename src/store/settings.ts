/**
 * Oyun ayarları: tarayıcıda saklanır, bütün kariyerlerde ortaktır (kayda girmez).
 * Depolama kapalıysa / bozuksa varsayılanlar kullanılır.
 */
import type { NewsCategory } from '../engine';

export type AutosaveMode = 'off' | 'matchday' | 'weekly' | 'monthly';
export type MatchSpeed = 'slow' | 'normal' | 'fast' | 'veryFast';
export type CommentaryMode = 'all' | 'key';
export type Background = 'grass' | 'plain' | 'navy';
export type Accent = 'yellow' | 'club' | 'blue' | 'green' | 'orange' | 'pink';
export type UiScale = 'small' | 'normal' | 'large' | 'xlarge';
export type NoticeLength = 'short' | 'normal' | 'long';
export type QuitConfirm = 'always' | 'unsaved';
export type SoundVolume = 'low' | 'medium' | 'high';

export interface Settings {
  /* Oyun */
  autosave: AutosaveMode;
  /** Önemli haberi Devam'ı durdurmayan kategoriler. */
  mutedNews: NewsCategory[];
  /* Maç */
  matchSpeed: MatchSpeed;
  showPitch: boolean;
  camera: 'full' | 'follow';
  commentary: CommentaryMode;
  /** Maç sesleri (düdük, gol, tribün); varsayılan açık (ses yalnızca maç ekranında, saat akarken çalar). */
  sound: boolean;
  soundVolume: SoundVolume;
  /* Görünüm */
  background: Background;
  accent: Accent;
  scale: UiScale;
  /* Onay ve uyarılar */
  /** Sekme kapanırken / yenilenirken kaydedilmemiş ilerleme uyarısı. */
  warnUnsaved: boolean;
  /** Ana menüye dönerken onay: her zaman ya da yalnızca kaydedilmemiş ilerleme varken. */
  quitConfirm: QuitConfirm;
  noticeLength: NoticeLength;
  /** Klavye kısayolları (Boşluk = Devam vb.). */
  hotkeys: boolean;
  /** Devam bir haber yüzünden durunca üstte haber kutusu. */
  newsAlert: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autosave: 'matchday',
  mutedNews: [],
  matchSpeed: 'normal',
  showPitch: true,
  camera: 'full',
  commentary: 'all',
  sound: true,
  soundVolume: 'medium',
  background: 'grass',
  accent: 'yellow',
  scale: 'normal',
  warnUnsaved: true,
  quitConfirm: 'always',
  noticeLength: 'normal',
  newsAlert: true,
  hotkeys: true,
};

export const MATCH_SPEEDS: readonly MatchSpeed[] = ['slow', 'normal', 'fast', 'veryFast'];
export const MATCH_SPEED_LABELS: Record<MatchSpeed, string> = { slow: 'Yavaş', normal: 'Normal', fast: 'Hızlı', veryFast: 'Çok hızlı' };

/** Maç hızı: zaman çarpanı (2 = iki kat hızlı). */
export const MATCH_SPEED_FACTOR: Record<MatchSpeed, number> = { slow: 0.7, normal: 1, fast: 1.6, veryFast: 2.5 };

/** Arayüz ölçeği (CSS zoom). */
export const UI_SCALE_FACTOR: Record<UiScale, number> = { small: 0.9, normal: 1, large: 1.1, xlarge: 1.2 };

/** Bildirimin ekranda kalma süresi (ms); hata bildirimi iki katı. */
export const NOTICE_MS: Record<NoticeLength, number> = { short: 2000, normal: 3000, long: 6000 };

export const SETTINGS_KEY = 'fm.settings';
/** Ayarlar ekranından önceki tek tek tercihler (bir kez taşınır). */
const LEGACY_PITCH_KEY = 'fm.showPitch';
const LEGACY_CAMERA_KEY = 'fm.pitchCamera';

/** Kayıtlı ayar ham verisinden geçerli ayarlar: bilinmeyen / hatalı değer varsayılana döner. */
export function parseSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  const pick = <K extends keyof Settings>(key: K, allowed: readonly Settings[K][]) => {
    if (allowed.includes(r[key] as Settings[K])) s[key] = r[key] as Settings[K];
  };
  pick('autosave', ['off', 'matchday', 'weekly', 'monthly']);
  pick('matchSpeed', ['slow', 'normal', 'fast', 'veryFast']);
  pick('showPitch', [true, false]);
  pick('camera', ['full', 'follow']);
  pick('commentary', ['all', 'key']);
  pick('sound', [true, false]);
  pick('soundVolume', ['low', 'medium', 'high']);
  pick('background', ['grass', 'plain', 'navy']);
  pick('accent', ['yellow', 'club', 'blue', 'green', 'orange', 'pink']);
  pick('scale', ['small', 'normal', 'large', 'xlarge']);
  pick('warnUnsaved', [true, false]);
  pick('quitConfirm', ['always', 'unsaved']);
  pick('noticeLength', ['short', 'normal', 'long']);
  pick('newsAlert', [true, false]);
  pick('hotkeys', [true, false]);
  if (Array.isArray(r.mutedNews)) s.mutedNews = r.mutedNews.filter((c): c is NewsCategory => typeof c === 'string');
  return s;
}

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return parseSettings(JSON.parse(stored));
    // İlk açılış: eski saha / kamera tercihleri taşınır
    return {
      ...DEFAULT_SETTINGS,
      showPitch: localStorage.getItem(LEGACY_PITCH_KEY) !== '0',
      camera: localStorage.getItem(LEGACY_CAMERA_KEY) === 'follow' ? 'follow' : 'full',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // depolama kapalı: ayarlar yalnızca bu oturumda geçerli
  }
}

/** Otomatik kayıt zamanı geldi mi: son otomatik kayıt tarihine (oyun içi) göre. */
export function autosaveDue(mode: AutosaveMode, last: string | null, today: string): boolean {
  if (mode === 'off') return false;
  if (mode === 'matchday' || last === null) return true;
  if (mode === 'weekly') return (Date.parse(today) - Date.parse(last)) / 86_400_000 >= 7;
  return today.slice(0, 7) !== last.slice(0, 7);
}
