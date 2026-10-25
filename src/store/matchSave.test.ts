import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { advance, createWorld, startUserMatch, stepMatch } from '../engine';
import { gameData } from '../gameData';
import { db } from '../persistence/db';
import { hasUnsavedProgress, matchSignature, useGameStore } from './gameStore';

beforeEach(async () => {
  await db.saves.clear();
  await db.saveData.clear();
});

/** Maç gününe gelinmiş, canlı maç birkaç dakika oynanmış bir kariyer açar. */
function openMidMatch() {
  const world = createWorld(gameData, 31, 'galatasaray', '2026-07-01');
  let guard = 0;
  while (advance(world, gameData).kind !== 'userMatch' && guard++ < 400);
  const match = startUserMatch(world)!;
  for (let i = 0; i < 25; i++) stepMatch(match, world.players);
  useGameStore.setState({ phase: 'game', world, liveMatch: match, revision: 1, savedRevision: 1, savedMatchSig: null, currentSaveId: null });
  return { world, match };
}

describe('maç ortasında kayıt (store)', () => {
  it('maç sürerken kaydedilir; kayıttan sonra maç ilerleyene kadar "kaydedilmemiş" sayılmaz', async () => {
    const { match } = openMidMatch();
    expect(hasUnsavedProgress(useGameStore.getState())).toBe(true);
    expect(await useGameStore.getState().saveCurrent('Maç ortası')).toBe(true);
    expect(hasUnsavedProgress(useGameStore.getState())).toBe(false);

    stepMatch(match, useGameStore.getState().world!.players);
    expect(matchSignature(match)).not.toBe(useGameStore.getState().savedMatchSig);
    expect(hasUnsavedProgress(useGameStore.getState())).toBe(true);
  });

  it('kayıt yüklenince maç kaldığı dakikadan açılır ve maç ekranına gidilir', async () => {
    const { match } = openMidMatch();
    const minute = match.minute;
    await useGameStore.getState().saveCurrent('Maç ortası');
    const id = useGameStore.getState().currentSaveId!;
    useGameStore.getState().quitToMenu();
    expect(useGameStore.getState().liveMatch).toBeNull();

    expect(await useGameStore.getState().loadSave(id)).toBe(true);
    const s = useGameStore.getState();
    expect(s.liveMatch?.minute).toBe(minute);
    expect(s.screen).toBe('match');
    expect(hasUnsavedProgress(s)).toBe(false);
  });

  it('maçsız kayıt yüklenince canlı maç yoktur', async () => {
    const world = createWorld(gameData, 32, 'galatasaray', '2026-07-01');
    useGameStore.setState({ phase: 'game', world, liveMatch: null, revision: 1, savedRevision: 0 });
    await useGameStore.getState().saveCurrent('Düz');
    const id = useGameStore.getState().currentSaveId!;
    await useGameStore.getState().loadSave(id);
    expect(useGameStore.getState().liveMatch).toBeNull();
    expect(useGameStore.getState().screen).not.toBe('match');
  });
});
