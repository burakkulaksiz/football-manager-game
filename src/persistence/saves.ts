/**
 * Kayıt sistemi: kaydet, yükle, listele, sil, otomatik kayıt.
 * GameWorld düz veri olduğu için IndexedDB'ye olduğu gibi yazılır.
 */
import { CURRENT_WORLD_VERSION, getClub, migrateWorld, type GameWorld } from '../engine';
import { gameData } from '../gameData';
import { db, type SaveSlot } from './db';

/** Kayıt biçimi = dünya biçimi sürümü (bkz. engine/migrate.ts). */
export const SAVE_FORMAT_VERSION = CURRENT_WORLD_VERSION;

/** Kariyer kimliği: aynı tohum ve kulüple başlamış oyun. */
export function careerIdOf(world: GameWorld): string {
  return `${world.seed}-${world.playerClubId}`;
}

/** Varsayılan kayıt adı: "Galatasaray — 15.08.2026" */
export function defaultSaveName(world: GameWorld): string {
  const [y, m, d] = world.date.split('-');
  return `${getClub(world, world.playerClubId).name} — ${d}.${m}.${y}`;
}

function meta(world: GameWorld, name: string, isAutosave: boolean): Omit<SaveSlot, 'id' | 'createdAt'> {
  return {
    name,
    careerId: careerIdOf(world),
    clubId: world.playerClubId,
    clubName: getClub(world, world.playerClubId).name,
    gameDate: world.date,
    season: world.season.year,
    isAutosave,
    updatedAt: Date.now(),
    formatVersion: SAVE_FORMAT_VERSION,
    managerName: world.manager?.name,
  };
}

/** Kayıtlar, en yeni önce. */
export async function listSaves(): Promise<SaveSlot[]> {
  return db.saves.orderBy('updatedAt').reverse().toArray();
}

/**
 * Oyunu kaydeder. `overwriteId` verilirse o slotun üzerine yazar, yoksa yeni slot açar.
 * Dünya, kayıt sürerken oyun devam ederse bozulmasın diye kopyalanarak yazılır.
 */
export async function saveGame(world: GameWorld, name: string, overwriteId?: number): Promise<number> {
  const snapshot = structuredClone(world);
  return db.transaction('rw', db.saves, db.saveData, async () => {
    const existing = overwriteId !== undefined ? await db.saves.get(overwriteId) : undefined;
    const data = meta(snapshot, name, false);
    let id: number;
    if (existing) {
      id = existing.id;
      await db.saves.put({ ...data, id, createdAt: existing.createdAt });
    } else {
      id = await db.saves.add({ ...data, createdAt: Date.now() } as SaveSlot);
    }
    await db.saveData.put({ id, world: snapshot });
    return id;
  });
}

/** Kariyerin otomatik kaydını günceller (kariyer başına tek otomatik kayıt). */
export async function autosave(world: GameWorld): Promise<number> {
  const snapshot = structuredClone(world);
  const careerId = careerIdOf(snapshot);
  return db.transaction('rw', db.saves, db.saveData, async () => {
    const existing = await db.saves.where('careerId').equals(careerId).filter((s) => s.isAutosave).first();
    const data = meta(snapshot, `Otomatik — ${defaultSaveName(snapshot)}`, true);
    let id: number;
    if (existing) {
      id = existing.id;
      await db.saves.put({ ...data, id, createdAt: existing.createdAt });
    } else {
      id = await db.saves.add({ ...data, createdAt: Date.now() } as SaveSlot);
    }
    await db.saveData.put({ id, world: snapshot });
    return id;
  });
}

export async function loadGame(id: number): Promise<GameWorld> {
  const slot = await db.saves.get(id);
  const data = await db.saveData.get(id);
  if (!slot || !data) throw new Error('Kayıt bulunamadı.');
  if (slot.formatVersion > SAVE_FORMAT_VERSION) {
    throw new Error(`Bu kayıt daha yeni bir oyun sürümüne ait (biçim ${slot.formatVersion}); açılamıyor.`);
  }
  // Eski kayıtlar yeni biçime dönüştürülür (finans, transfer alanları eklenir).
  const world = slot.formatVersion < SAVE_FORMAT_VERSION ? migrateWorld(data.world, slot.formatVersion, gameData) : data.world;
  if (!world || !world.players || !world.season || !world.tactics || !world.finances) throw new Error('Kayıt dosyası bozuk.');
  return world;
}

export async function deleteSave(id: number): Promise<void> {
  await db.transaction('rw', db.saves, db.saveData, async () => {
    await db.saves.delete(id);
    await db.saveData.delete(id);
  });
}
