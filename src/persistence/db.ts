import Dexie, { type EntityTable } from 'dexie';

/**
 * Bir kayıt slotu. `data` alanı oyunun tamamının serileştirilmiş hâlidir;
 * içeriği 6. aşamada (kayıt sistemi) netleşecek.
 */
export interface SaveSlot {
  id: number;
  name: string;
  clubName: string;
  gameDate: string;
  isAutosave: boolean;
  createdAt: number;
  updatedAt: number;
  data: unknown;
}

export const db = new Dexie('fm-super-lig') as Dexie & {
  saves: EntityTable<SaveSlot, 'id'>;
};

// Şema: '++id' otomatik artan anahtar; diğerleri sorgulanabilir indeksler.
db.version(1).stores({
  saves: '++id, updatedAt, isAutosave',
});
