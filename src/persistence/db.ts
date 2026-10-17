import Dexie, { type EntityTable } from 'dexie';
import type { GameWorld } from '../engine';

/**
 * Kayıt listesinde gösterilen bilgiler. Oyunun kendisi ayrı tabloda (SaveData) durur;
 * böylece liste açılırken megabaytlarca veri okunmaz.
 */
export interface SaveSlot {
  id: number;
  name: string;
  /** Aynı kariyerin kayıtlarını eşleştirir (otomatik kayıt kariyer başına bir tane). */
  careerId: string;
  clubId: string;
  clubName: string;
  gameDate: string;
  season: number;
  isAutosave: boolean;
  createdAt: number;
  updatedAt: number;
  /** Kayıt biçimi sürümü; ileride biçim değişirse eski kayıtları dönüştürmek için. */
  formatVersion: number;
}

export interface SaveData {
  id: number;
  world: GameWorld;
}

export const db = new Dexie('fm-super-lig') as Dexie & {
  saves: EntityTable<SaveSlot, 'id'>;
  saveData: EntityTable<SaveData, 'id'>;
};

// Şema: '++id' otomatik artan anahtar; diğerleri sorgulanabilir indeksler.
db.version(1).stores({
  saves: '++id, updatedAt, isAutosave',
});
// Sürüm 2: oyun verisi ayrı tabloya taşındı, kariyer kimliği eklendi.
db.version(2).stores({
  saves: '++id, updatedAt, isAutosave, careerId',
  saveData: 'id',
});
