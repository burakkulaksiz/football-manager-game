/**
 * Kayıt sistemi: kaydet, yükle, listele, sil, otomatik kayıt.
 * GameWorld düz veri olduğu için IndexedDB'ye olduğu gibi yazılır.
 */
import { CURRENT_WORLD_VERSION, displayMinute, formatMinute, getClub, migrateWorld, type GameWorld, type MatchState } from '../engine';
import { gameData } from '../gameData';
import { db, type SaveSlot } from './db';
import { exportFileName, exportSave, parseSaveExport } from './exchange';

/** Kayıt biçimi = dünya biçimi sürümü (bkz. engine/migrate.ts). */
export const SAVE_FORMAT_VERSION = CURRENT_WORLD_VERSION;

/** Kariyer kimliği: aynı tohum ve kulüple başlamış oyun (kulüp değişse ya da işsiz kalınsa da aynı kalır). */
export function careerIdOf(world: GameWorld): string {
  // Kulüpten ayrılış o sezonu kariyere yazar: ilk kariyer sezonunun kulübü başlangıç kulübüdür
  return `${world.seed}-${world.manager?.seasons?.[0]?.clubId ?? world.playerClubId}`;
}

/** Kayıtta görünen kulüp adı: işsizken "İşsiz". */
function clubNameOf(world: GameWorld): string {
  return world.unemployed ? 'İşsiz' : getClub(world, world.playerClubId).name;
}

/** Varsayılan kayıt adı: "Galatasaray — 15.08.2026" */
export function defaultSaveName(world: GameWorld): string {
  const [y, m, d] = world.date.split('-');
  return `${clubNameOf(world)} — ${d}.${m}.${y}`;
}

/** Kayıt listesinde maçın durumu: "Galatasaray 1-0 Fenerbahçe · 34'" (başlamadıysa "maç başlamadan"). */
export function liveMatchLabel(world: GameWorld, match: MatchState): string {
  const home = getClub(world, match.home.clubId).name;
  const away = getClub(world, match.away.clubId).name;
  const { minute, extra } = displayMinute(match);
  const when = match.period === 'pre' ? 'maç başlamadan' : match.period === 'half' ? 'devre arası' : match.period === 'full' ? 'maç bitti' : formatMinute(minute, extra);
  return `${home} ${match.score.home}-${match.score.away} ${away} · ${when}`;
}

function meta(world: GameWorld, name: string, isAutosave: boolean, liveMatch: MatchState | null = null): Omit<SaveSlot, 'id' | 'createdAt'> {
  return {
    name,
    careerId: careerIdOf(world),
    clubId: world.unemployed?.lastClubId ?? world.playerClubId,
    clubName: clubNameOf(world),
    gameDate: world.date,
    season: world.season.year,
    isAutosave,
    updatedAt: Date.now(),
    formatVersion: SAVE_FORMAT_VERSION,
    managerName: world.manager?.name,
    ...(liveMatch ? { liveMatch: liveMatchLabel(world, liveMatch) } : {}),
  };
}

/** Kayıtlar, en yeni önce. */
export async function listSaves(): Promise<SaveSlot[]> {
  return db.saves.orderBy('updatedAt').reverse().toArray();
}

/**
 * Oyunu kaydeder. `overwriteId` verilirse o slotun üzerine yazar, yoksa yeni slot açar.
 * Maç sürerken alınırsa `liveMatch` (maçın o anki durumu) da yazılır; yüklenince maç kaldığı yerden devam eder.
 * Dünya, kayıt sürerken oyun devam ederse bozulmasın diye kopyalanarak yazılır.
 */
export async function saveGame(world: GameWorld, name: string, overwriteId?: number, liveMatch: MatchState | null = null): Promise<number> {
  const snapshot = structuredClone(world);
  const matchSnapshot = liveMatch ? structuredClone(liveMatch) : undefined;
  return db.transaction('rw', db.saves, db.saveData, async () => {
    const existing = overwriteId !== undefined ? await db.saves.get(overwriteId) : undefined;
    const data = meta(snapshot, name, false, matchSnapshot ?? null);
    let id: number;
    if (existing) {
      id = existing.id;
      await db.saves.put({ ...data, id, createdAt: existing.createdAt });
    } else {
      id = await db.saves.add({ ...data, createdAt: Date.now() } as SaveSlot);
    }
    await db.saveData.put({ id, world: snapshot, ...(matchSnapshot ? { liveMatch: matchSnapshot } : {}) });
    return id;
  });
}

/** Kariyer başına dönüşümlü otomatik kayıt slotu: son kayıt bozulursa öncekiler yedek kalır. */
export const AUTOSAVE_SLOTS = 3;

/** Kariyerin otomatik kaydı: slot sayısı dolmadıysa yeni slot, dolduysa en eskisinin üzerine yazar. */
export async function autosave(world: GameWorld): Promise<number> {
  const snapshot = structuredClone(world);
  const careerId = careerIdOf(snapshot);
  return db.transaction('rw', db.saves, db.saveData, async () => {
    const autos = (await db.saves.where('careerId').equals(careerId).filter((s) => s.isAutosave).toArray())
      .sort((a, b) => a.updatedAt - b.updatedAt);
    const existing = autos.length >= AUTOSAVE_SLOTS ? autos[0] : undefined;
    const data = meta(snapshot, `Otomatik — ${defaultSaveName(snapshot)}`, true);
    // Aynı milisaniyede art arda kayıtta da sıra korunsun (en eski hep doğru seçilsin)
    data.updatedAt = Math.max(data.updatedAt, (autos.at(-1)?.updatedAt ?? 0) + 1);
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

/** Maç ortasında alınmış kaydın sürmekte olan maçı; yoksa (ya da maç artık geçersizse) null. */
export async function loadSavedMatch(id: number, world: GameWorld): Promise<MatchState | null> {
  const match = (await db.saveData.get(id))?.liveMatch;
  if (!match) return null;
  const fixture = world.season.fixtures.find((f) => f.id === match.fixtureId);
  return fixture && fixture.result === null ? match : null;
}

export async function loadGame(id: number): Promise<GameWorld> {
  const slot = await db.saves.get(id);
  const data = await db.saveData.get(id);
  if (!slot || !data) throw new Error('Kayıt bulunamadı.');
  if (slot.formatVersion > SAVE_FORMAT_VERSION) {
    throw new Error(`Bu kayıt daha yeni bir oyun sürümüne ait (biçim ${slot.formatVersion}); açılamıyor.`);
  }
  return readWorld(data.world, slot.formatVersion);
}

/** Kayıttaki dünya: eskiyse yeni biçime dönüştürülür (finans, transfer alanları eklenir), sonra denetlenir. */
function readWorld(stored: GameWorld, formatVersion: number): GameWorld {
  const world = formatVersion < SAVE_FORMAT_VERSION ? migrateWorld(stored, formatVersion, gameData) : stored;
  if (!world || !world.players || !world.season || !world.tactics || !world.finances) throw new Error('Kayıt dosyası bozuk.');
  return world;
}

/** Slotu .json yedek olarak: dosya adı ve içeriği (indirme arayüzde). */
export async function exportSlot(id: number): Promise<{ fileName: string; text: string }> {
  const slot = await db.saves.get(id);
  const data = await db.saveData.get(id);
  if (!slot || !data) throw new Error('Kayıt bulunamadı.');
  return { fileName: exportFileName(slot), text: exportSave(slot, data) };
}

/**
 * .json yedeği yeni bir slot olarak ekler (hiçbir kaydın üzerine yazmaz; aynı adlı kayıt varsa ada "(içe aktarıldı)" eklenir).
 * Dünya önce yüklemedeki gibi dönüştürülüp denetlenir, güncel biçimde yazılır; bozuksa hiçbir şey yazılmaz.
 * Otomatik kayıt değildir: kariyerin otomatik kayıt slotu (careerIdOf) değişmez.
 */
export async function importSave(text: string): Promise<number> {
  const imported = parseSaveExport(text, SAVE_FORMAT_VERSION);
  let world: GameWorld;
  try {
    world = readWorld(imported.world, imported.formatVersion);
    defaultSaveName(world); // kulübü dünyada olmayan dosya burada elenir
  } catch {
    throw new Error('Kayıt dosyası bozuk: oyun verisi okunamadı.');
  }
  const taken = (await listSaves()).some((s) => s.name === imported.name);
  try {
    return await saveGame(world, taken ? `${imported.name} (içe aktarıldı)` : imported.name, undefined, imported.liveMatch);
  } catch (e) {
    // Çok derin iç içe veri kopyalanırken (structuredClone) yığın taşar; kayıt yazılmamıştır
    if (e instanceof RangeError) throw new Error('Kayıt dosyası bozuk: oyun verisi çok derin iç içe.');
    throw e;
  }
}

export async function deleteSave(id: number): Promise<void> {
  await db.transaction('rw', db.saves, db.saveData, async () => {
    await db.saves.delete(id);
    await db.saveData.delete(id);
  });
}
