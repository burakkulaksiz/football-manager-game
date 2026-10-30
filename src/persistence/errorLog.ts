/**
 * Hata günlüğü: yakalanmamış hatalar, ekran çökmeleri ve otomatik kayıt hataları tarayıcıda (localStorage) son
 * ERROR_LOG_LIMIT kayıt olarak tutulur; Ayarlar'dan görüntülenir, kopyalanır, temizlenir. Kayıt dosyasına girmez.
 * Depolama erişilemezse (gizli pencere vb.) sessizce atlanır: günlük oyunu asla durdurmamalı.
 */
export interface ErrorEntry {
  /** ISO zaman damgası. */
  at: string;
  /** Nereden: 'window', 'promise', 'ekran', 'otomatik kayıt'… */
  source: string;
  message: string;
  stack?: string;
}

export const ERROR_LOG_KEY = 'fm-error-log';
export const ERROR_LOG_LIMIT = 50;

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): KeyValue | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readErrors(store: KeyValue | null = storage()): ErrorEntry[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(ERROR_LOG_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

/** Hatayı günlüğe ekler (en eskiler silinir). */
export function logError(source: string, error: unknown, store: KeyValue | null = storage(), now: Date = new Date()): void {
  const entry: ErrorEntry = {
    at: now.toISOString(),
    source,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  };
  try {
    store?.setItem(ERROR_LOG_KEY, JSON.stringify([...readErrors(store), entry].slice(-ERROR_LOG_LIMIT)));
  } catch {
    // Depolama dolu ya da kapalı: günlük atlanır
  }
}

export function clearErrors(store: KeyValue | null = storage()): void {
  try {
    store?.removeItem(ERROR_LOG_KEY);
  } catch {
    // yok say
  }
}

/** Panoya / hata bildirimine kopyalanacak düz metin. */
export function formatErrors(entries: readonly ErrorEntry[]): string {
  return entries.map((e) => `[${e.at}] (${e.source}) ${e.message}${e.stack ? `\n${e.stack}` : ''}`).join('\n\n');
}

/** Tarayıcıdaki yakalanmamış hataları ve reddedilen sözleri (promise) günlüğe bağlar. */
export function installErrorLog(): void {
  window.addEventListener('error', (e) => logError('window', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError('promise', e.reason));
}
