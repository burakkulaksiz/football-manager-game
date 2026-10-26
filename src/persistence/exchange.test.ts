import { describe, expect, it } from 'vitest';
import { createWorld, CURRENT_WORLD_VERSION, type MatchState } from '../engine';
import { gameData } from '../gameData';
import type { SaveData, SaveSlot } from './db';
import { exportFileName, exportSave, parseSaveExport } from './exchange';

const VERSION = CURRENT_WORLD_VERSION;
const world = createWorld(gameData, 21, 'goztepe', '2026-07-01');
const slot: SaveSlot = {
  id: 4, name: 'Göztepe — 01.07.2026', careerId: '21-goztepe', clubId: 'goztepe', clubName: 'Göztepe', gameDate: '2026-07-01',
  season: 2026, isAutosave: false, createdAt: 1, updatedAt: 2, formatVersion: VERSION,
};
const liveMatch = { fixtureId: 12, minute: 34 } as unknown as MatchState;

/** Zarfı bozup yeniden metne çevirir. */
function tampered(change: (envelope: Record<string, any>) => void): string {
  const envelope = JSON.parse(exportSave(slot, { id: 4, world }));
  change(envelope);
  return JSON.stringify(envelope);
}

describe('kayıt dışa / içe aktarma (zarf)', () => {
  it('gidiş-dönüş: dünya, ad, sürüm ve canlı maç aynen geri gelir; zarfta slot kimliği yok', () => {
    const data: SaveData = { id: 4, world, liveMatch };
    const text = exportSave(slot, data, new Date('2026-10-27T12:00:00Z'));
    const envelope = JSON.parse(text);
    expect(envelope).toMatchObject({ format: 'fm-save', formatVersion: VERSION, exportedAt: '2026-10-27T12:00:00.000Z' });
    expect(envelope.slot.id).toBeUndefined();
    expect(envelope.data.id).toBeUndefined();
    const back = parseSaveExport(text, VERSION);
    expect(back).toEqual({ name: slot.name, formatVersion: VERSION, world, liveMatch });
  });

  it('canlı maçsız kayıtta maç null', () => {
    expect(parseSaveExport(exportSave(slot, { id: 4, world }), VERSION).liveMatch).toBeNull();
  });

  it('bozuk JSON, yanlış biçim işareti ve JSON olmayan içerik anlaşılır hata verir', () => {
    expect(() => parseSaveExport('{"format": "fm-save", ', VERSION)).toThrow(/geçerli bir JSON/);
    expect(() => parseSaveExport('[1, 2]', VERSION)).toThrow(/oyun kaydı değil/);
    expect(() => parseSaveExport(tampered((e) => (e.format = 'baska-oyun')), VERSION)).toThrow(/oyun kaydı değil/);
  });

  it('gelecek ve geçersiz biçim sürümü reddedilir; eski sürüm kabul edilir (dönüştürme yüklemede)', () => {
    expect(() => parseSaveExport(tampered((e) => (e.formatVersion = VERSION + 1)), VERSION)).toThrow(/daha yeni bir oyun sürümüne/);
    expect(() => parseSaveExport(tampered((e) => (e.formatVersion = '17')), VERSION)).toThrow(/biçim sürümü geçersiz/);
    expect(() => parseSaveExport(tampered((e) => (e.formatVersion = 0)), VERSION)).toThrow(/biçim sürümü geçersiz/);
    expect(parseSaveExport(tampered((e) => (e.formatVersion = 3)), VERSION).formatVersion).toBe(3);
  });

  it('eksik ya da yanlış türde alanlar reddedilir', () => {
    expect(() => parseSaveExport(tampered((e) => delete e.slot), VERSION)).toThrow(/kayıt adı yok/);
    expect(() => parseSaveExport(tampered((e) => (e.slot.name = '  ')), VERSION)).toThrow(/kayıt adı yok/);
    expect(() => parseSaveExport(tampered((e) => delete e.data.world), VERSION)).toThrow(/oyun verisi yok/);
    expect(() => parseSaveExport(tampered((e) => delete e.data.world.players), VERSION)).toThrow(/zorunlu alanlar eksik/);
    expect(() => parseSaveExport(tampered((e) => (e.data.world.clubs = {})), VERSION)).toThrow(/zorunlu alanlar eksik/);
    expect(() => parseSaveExport(tampered((e) => (e.data.liveMatch = 'maç')), VERSION)).toThrow(/maç verisi geçersiz/);
  });

  it('dosya adı: geçersiz karakterler temizlenir, oyun tarihi eklenir', () => {
    expect(exportFileName({ name: 'Göztepe: "son" <kayıt>/?', gameDate: '2026-08-15' })).toBe('Göztepe_ _son_ _kayıt___ (2026-08-15).json');
    expect(exportFileName({ name: '   ', gameDate: '2026-08-15' })).toBe('kayit (2026-08-15).json');
  });
});
