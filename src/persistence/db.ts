import Dexie, { type EntityTable } from 'dexie';
import type { GameWorld, MatchState } from '../engine';

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
  /** Menajer adı (biçim 5 öncesi kayıtlarda yok). */
  managerName?: string;
  /** Maç ortasında alınan kayıt: maçın o anki durumu ("Galatasaray 1-0 Fenerbahçe · 34'"). */
  liveMatch?: string;
  /** Kayıt biçimi sürümü; ileride biçim değişirse eski kayıtları dönüştürmek için. */
  formatVersion: number;
}

export interface SaveData {
  id: number;
  world: GameWorld;
  /** Maç ortasında alınan kayıtta sürmekte olan maç (dünya, maçın başladığı günkü hâlinde). */
  liveMatch?: MatchState;
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
