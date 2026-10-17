import { create } from 'zustand';
import { addDays, createWorld, SEASON_START_DATE, type GameWorld } from '../engine';
import { gameData } from '../gameData';

/** Sol menüden açılan ekranlar + menü dışı ekranlar ('player'). */
export type ScreenId =
  | 'inbox'
  | 'squad'
  | 'tactics'
  | 'club'
  | 'finance'
  | 'transfers'
  | 'fixtures'
  | 'table'
  | 'stats'
  | 'player';

interface GameState {
  /** 'menu' = ana menü, 'newGame' = kulüp seçimi, 'game' = kariyer açık */
  phase: 'menu' | 'newGame' | 'game';
  screen: ScreenId;
  /** Oyuncu profilinden "Geri" ile dönülecek ekran. */
  previousScreen: ScreenId;
  world: GameWorld | null;
  selectedPlayerId: number | null;
  /** Kadro ekranında görüntülenen kulüp (varsayılan: kendi kulübümüz). */
  viewedClubId: string | null;

  openNewGame: () => void;
  startNewGame: (clubId: string) => void;
  quitToMenu: () => void;
  setScreen: (screen: ScreenId) => void;
  openPlayer: (playerId: number) => void;
  goBack: () => void;
  setViewedClub: (clubId: string) => void;
  /**
   * "Devam": zamanı bir sonraki olaya kadar ilerletir.
   * Henüz olay sistemi yok (3. aşama); takvimi sadece bir gün ilerletir.
   */
  advance: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  phase: 'menu',
  screen: 'squad',
  previousScreen: 'squad',
  world: null,
  selectedPlayerId: null,
  viewedClubId: null,

  openNewGame: () => set({ phase: 'newGame' }),

  startNewGame: (clubId) => {
    // Seed oyunun başında bir kez belirlenir; motor içinde Math.random kullanılmaz.
    const seed = Date.now() >>> 0;
    const world = createWorld(gameData, seed, clubId, SEASON_START_DATE);
    set({ phase: 'game', screen: 'squad', world, viewedClubId: clubId, selectedPlayerId: null });
  },

  quitToMenu: () => set({ phase: 'menu', world: null }),

  setScreen: (screen) => set({ screen }),

  openPlayer: (playerId) =>
    set((s) => ({
      selectedPlayerId: playerId,
      screen: 'player',
      previousScreen: s.screen === 'player' ? s.previousScreen : s.screen,
    })),

  goBack: () => set((s) => ({ screen: s.previousScreen })),

  setViewedClub: (clubId) => set({ viewedClubId: clubId }),

  advance: () =>
    set((s) => (s.world ? { world: { ...s.world, date: addDays(s.world.date, 1) } } : {})),
}));

/** Kariyer açıkken dünyayı döndürür (GameShell içindeki bileşenler için). */
export function useWorld(): GameWorld {
  const world = useGameStore((s) => s.world);
  if (!world) throw new Error('Açık bir oyun yok');
  return world;
}
