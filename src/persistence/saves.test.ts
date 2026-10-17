// Node'da IndexedDB yok; sahte bir uygulama (bellek içi) Dexie'den önce yüklenmeli.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { advance, createWorld, type GameWorld } from '../engine';
import { gameData } from '../gameData';
import { db } from './db';
import { autosave, careerIdOf, deleteSave, listSaves, loadGame, saveGame } from './saves';

const START = '2026-07-01';

function playRounds(world: GameWorld, matchDays: number): void {
  let played = 0;
  while (played < matchDays) {
    if (advance(world, gameData, { autoPlayUserMatch: true }).kind === 'played') played++;
  }
}

beforeEach(async () => {
  await db.saves.clear();
  await db.saveData.clear();
});

describe('kayıt sistemi', () => {
  it('kaydedilen oyun birebir aynı yüklenir', async () => {
    const world = createWorld(gameData, 1, 'galatasaray', START);
    playRounds(world, 2);
    const id = await saveGame(world, 'Deneme');
    expect(await loadGame(id)).toEqual(world);

    const [slot] = await listSaves();
    expect(slot).toMatchObject({ id, name: 'Deneme', clubName: 'Galatasaray', gameDate: world.date, isAutosave: false });
  });

  it('kayıt anındaki durum saklanır; sonradan oyun ilerlese de kayıt değişmez', async () => {
    const world = createWorld(gameData, 2, 'fenerbahce', START);
    const id = await saveGame(world, 'Başlangıç');
    const dateAtSave = world.date;
    playRounds(world, 1);
    expect((await loadGame(id)).date).toBe(dateAtSave);
  });

  it('üzerine kaydetme aynı slotu günceller', async () => {
    const world = createWorld(gameData, 3, 'besiktas', START);
    const id = await saveGame(world, 'Slot');
    playRounds(world, 1);
    expect(await saveGame(world, 'Slot (güncel)', id)).toBe(id);
    const saves = await listSaves();
    expect(saves).toHaveLength(1);
    expect(saves[0]!.name).toBe('Slot (güncel)');
    expect((await loadGame(id)).date).toBe(world.date);
  });

  it('otomatik kayıt kariyer başına tek slottur', async () => {
    const a = createWorld(gameData, 4, 'trabzonspor', START);
    const b = createWorld(gameData, 5, 'trabzonspor', START);
    await autosave(a);
    playRounds(a, 1);
    await autosave(a);
    await autosave(b);
    const autos = (await listSaves()).filter((s) => s.isAutosave);
    expect(autos).toHaveLength(2);
    const auto = autos.find((s) => s.careerId === careerIdOf(a))!;
    expect(auto.gameDate).toBe(a.date);
  });

  it('silinen kayıt listeden ve veriden kalkar', async () => {
    const world = createWorld(gameData, 6, 'goztepe', START);
    const id = await saveGame(world, 'Silinecek');
    await deleteSave(id);
    expect(await listSaves()).toHaveLength(0);
    await expect(loadGame(id)).rejects.toThrow(/bulunamadı/);
  });

  it('farklı biçim sürümündeki kayıt açılmaz', async () => {
    const world = createWorld(gameData, 7, 'konyaspor', START);
    const id = await saveGame(world, 'Eski');
    await db.saves.update(id, { formatVersion: 999 });
    await expect(loadGame(id)).rejects.toThrow(/sürüm/);
  });

  it('eski biçimdeki (aşama 6) kayıt yeni biçime dönüştürülerek açılır', async () => {
    const world = createWorld(gameData, 9, 'kasimpasa', START);
    const old = structuredClone(world) as Partial<GameWorld>;
    delete old.finances;
    delete old.offers;
    delete old.news;
    for (const p of Object.values(old.players!)) delete (p as { loan?: unknown }).loan;
    const id = await saveGame(world, 'Eski biçim');
    await db.saveData.put({ id, world: old as GameWorld });
    await db.saves.update(id, { formatVersion: 1 });
    const loaded = await loadGame(id);
    expect(loaded.finances.kasimpasa!.balance).toBeGreaterThan(0);
    expect(loaded.offers).toEqual([]);
    expect(Object.values(loaded.players).every((p) => p.loan === null)).toBe(true);
  });

  it('yüklenen oyun, hiç kaydedilmemiş gibi aynı sonuçlarla devam eder', async () => {
    const original = createWorld(gameData, 8, 'samsunspor', START);
    playRounds(original, 3);
    const loaded = await loadGame(await saveGame(original, 'Ara'));
    playRounds(original, 3);
    playRounds(loaded, 3);
    expect(loaded.season.fixtures).toEqual(original.season.fixtures);
  });
});
