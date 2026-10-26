/**
 * Kayıt dosyası dışa / içe aktarma (.json yedek): kayıt slotu ve verisi sürümlü bir zarfta, olduğu gibi (ikinci bir biçim yok).
 * Saf: veritabanına ve tarayıcıya dokunmaz (indirme / dosya seçme arayüzde, kayda yazma saves.ts importSave'de).
 * İçe aktarılan dosya güvenilmez: zarf burada denetlenir, dünya kayda yazılmadan önce yüklemedeki dönüştürme + denetimden geçer.
 */
import type { GameWorld, MatchState } from '../engine';
import type { SaveData, SaveSlot } from './db';

export const EXPORT_FORMAT = 'fm-save';
/**
 * shortcut: zarf sıkıştırılmaz; yeni kariyer ~3 MB, sezonlar ilerledikçe büyür. Dosyalar paylaşılmaya başlarsa
 * CompressionStream (gzip) ile sıkıştırılır.
 */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export interface SaveExport {
  format: typeof EXPORT_FORMAT;
  /** Dünya biçimi sürümü (SAVE_FORMAT_VERSION; eski dosya yüklenirken dönüştürülür). */
  formatVersion: number;
  exportedAt: string;
  /** Kayıt listesindeki bilgiler (kimlik hariç: içe aktarılınca yeni slot açılır). */
  slot: Omit<SaveSlot, 'id'>;
  data: Omit<SaveData, 'id'>;
}

/** Zarfın içe aktarılacak kısmı. */
export interface ImportedSave {
  name: string;
  formatVersion: number;
  world: GameWorld;
  liveMatch: MatchState | null;
}

export function exportSave(slot: SaveSlot, data: SaveData, now: Date = new Date()): string {
  const { id: _slotId, ...slotMeta } = slot;
  const { id: _dataId, ...saveData } = data;
  const envelope: SaveExport = { format: EXPORT_FORMAT, formatVersion: slot.formatVersion, exportedAt: now.toISOString(), slot: slotMeta, data: saveData };
  return JSON.stringify(envelope);
}

/** "Galatasaray — 15.08.2026 (2026-08-15).json": dosya adında geçersiz karakterler "_" olur. */
export function exportFileName(slot: Pick<SaveSlot, 'name' | 'gameDate'>): string {
  const name = slot.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100) || 'kayit';
  return `${name} (${slot.gameDate}).json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Dosya metninden zarf; geçersizse kullanıcıya gösterilecek Türkçe mesajla hata fırlatır.
 * `currentVersion`: oyunun biçim sürümü (daha yeni sürümün dosyası açılmaz).
 */
export function parseSaveExport(text: string, currentVersion: number, maxLength: number = MAX_IMPORT_BYTES): ImportedSave {
  // Karakter sayısı UTF-8 bayt sayısını geçmez: arayüz dosyayı okumadan baytla (file.size) eler, burası okunmuş metnin üst sınırı
  if (text.length > maxLength) throw new Error('Dosya çok büyük; bir oyun kaydı olamaz.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir JSON dosyası değil.');
  }
  if (!isObj(raw) || raw.format !== EXPORT_FORMAT) throw new Error('Bu dosya bir oyun kaydı değil.');
  const version = raw.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new Error('Kayıt dosyasının biçim sürümü geçersiz.');
  if (version > currentVersion) throw new Error(`Bu kayıt daha yeni bir oyun sürümüne ait (biçim ${version}); açılamıyor.`);
  const { slot, data } = raw;
  if (!isObj(slot) || typeof slot.name !== 'string' || slot.name.trim() === '') throw new Error('Kayıt dosyası eksik: kayıt adı yok.');
  if (!isObj(data) || !isObj(data.world)) throw new Error('Kayıt dosyası eksik: oyun verisi yok.');
  const world = data.world;
  if (!isObj(world.players) || !isObj(world.season) || !Array.isArray(world.clubs) || typeof world.date !== 'string' || typeof world.playerClubId !== 'string') {
    throw new Error('Kayıt dosyası bozuk: oyun verisinde zorunlu alanlar eksik.');
  }
  if (data.liveMatch !== undefined && !(isObj(data.liveMatch) && typeof data.liveMatch.fixtureId === 'number')) {
    throw new Error('Kayıt dosyası bozuk: maç verisi geçersiz.');
  }
  return {
    name: slot.name.trim().slice(0, 100),
    formatVersion: version,
    world: world as unknown as GameWorld,
    liveMatch: (data.liveMatch as MatchState | undefined) ?? null,
  };
}
