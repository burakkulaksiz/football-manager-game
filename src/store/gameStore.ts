import { create } from 'zustand';
import { advance, createWorld, SEASON_START_DATE, type GameWorld } from '../engine';
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
  /** Fikstür ekranı: kendi maçlarımız mı, haftalık görünüm mü; seçili hafta. */
  fixturesTab: 'club' | 'round';
  fixturesRound: number;

  openNewGame: () => void;
  startNewGame: (clubId: string) => void;
  quitToMenu: () => void;
  setScreen: (screen: ScreenId) => void;
  openPlayer: (playerId: number) => void;
  goBack: () => void;
  setViewedClub: (clubId: string) => void;
  setFixturesView: (tab: 'club' | 'round', round?: number) => void;
  /**
   * "Devam": maç günüyse maçları oynatır, değilse bir sonraki maç gününe ilerler.
   * Maçlar oynanınca o haftanın sonuçları gösterilir.
   */
  advance: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  phase: 'menu',
  screen: 'squad',
  previousScreen: 'squad',
  world: null,
  selectedPlayerId: null,
  viewedClubId: null,
  fixturesTab: 'club',
  fixturesRound: 1,

  openNewGame: () => set({ phase: 'newGame' }),

  startNewGame: (clubId) => {
    // Seed oyunun başında bir kez belirlenir; motor içinde Math.random kullanılmaz.
    const seed = Date.now() >>> 0;
    const world = createWorld(gameData, seed, clubId, SEASON_START_DATE);
    set({
      phase: 'game',
      screen: 'squad',
      world,
      viewedClubId: clubId,
      selectedPlayerId: null,
      fixturesTab: 'club',
      fixturesRound: 1,
    });
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

  setFixturesView: (tab, round) =>
    set((s) => ({ fixturesTab: tab, fixturesRound: round ?? s.fixturesRound })),

  advance: () => {
    const { world } = get();
    if (!world) return;
    // Motor dünyayı yerinde değiştirir; yeni referans React'in yeniden çizmesi için.
    const result = advance(world);
    if (result.kind === 'played') {
      set({ world: { ...world }, screen: 'fixtures', fixturesTab: 'round', fixturesRound: result.round });
    } else {
      set({ world: { ...world } });
    }
  },
}));

/** Kariyer açıkken dünyayı döndürür (GameShell içindeki bileşenler için). */
export function useWorld(): GameWorld {
  const world = useGameStore((s) => s.world);
  if (!world) throw new Error('Açık bir oyun yok');
  return world;
}
