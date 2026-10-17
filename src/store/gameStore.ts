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

/** Gezinme geçmişindeki bir sayfa (FM'deki ◀ ▶ okları için). */
export interface Route {
  screen: ScreenId;
  playerId?: number;
}

interface GameState {
  /** 'menu' = ana menü, 'newGame' = kulüp seçimi, 'game' = kariyer açık */
  phase: 'menu' | 'newGame' | 'game';
  world: GameWorld | null;
  /** Geçerli sayfa (history[historyIndex] ile aynı). */
  screen: ScreenId;
  selectedPlayerId: number | null;
  history: Route[];
  historyIndex: number;
  /** Kadro ekranında görüntülenen kulüp (varsayılan: kendi kulübümüz). */
  viewedClubId: string | null;
  /** Fikstür ekranı: kendi maçlarımız mı, haftalık görünüm mü; seçili hafta. */
  fixturesTab: 'club' | 'round';
  fixturesRound: number;

  openNewGame: () => void;
  startNewGame: (clubId: string) => void;
  quitToMenu: () => void;
  navigate: (route: Route) => void;
  setScreen: (screen: ScreenId) => void;
  openPlayer: (playerId: number) => void;
  back: () => void;
  forward: () => void;
  setViewedClub: (clubId: string) => void;
  setFixturesView: (tab: 'club' | 'round', round?: number) => void;
  /**
   * "Devam": maç günüyse maçları oynatır, değilse bir sonraki maç gününe ilerler.
   * Maçlar oynanınca o haftanın sonuçları gösterilir.
   */
  advance: () => void;
}

function routeState(route: Route) {
  return { screen: route.screen, selectedPlayerId: route.playerId ?? null };
}

const START_ROUTE: Route = { screen: 'squad' };

export const useGameStore = create<GameState>()((set, get) => ({
  phase: 'menu',
  world: null,
  screen: START_ROUTE.screen,
  selectedPlayerId: null,
  history: [START_ROUTE],
  historyIndex: 0,
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
      world,
      ...routeState(START_ROUTE),
      history: [START_ROUTE],
      historyIndex: 0,
      viewedClubId: clubId,
      fixturesTab: 'club',
      fixturesRound: 1,
    });
  },

  quitToMenu: () => set({ phase: 'menu', world: null }),

  navigate: (route) => {
    const { history, historyIndex } = get();
    const current = history[historyIndex];
    if (current && current.screen === route.screen && current.playerId === route.playerId) return;
    // İleri geçmişi silinir, yeni sayfa sona eklenir (tarayıcı gibi).
    const next = [...history.slice(0, historyIndex + 1), route].slice(-50);
    set({ history: next, historyIndex: next.length - 1, ...routeState(route) });
  },

  setScreen: (screen) => get().navigate({ screen }),

  openPlayer: (playerId) => get().navigate({ screen: 'player', playerId }),

  back: () => {
    const { history, historyIndex } = get();
    if (historyIndex === 0) return;
    set({ historyIndex: historyIndex - 1, ...routeState(history[historyIndex - 1]!) });
  },

  forward: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    set({ historyIndex: historyIndex + 1, ...routeState(history[historyIndex + 1]!) });
  },

  setViewedClub: (clubId) => set({ viewedClubId: clubId }),

  setFixturesView: (tab, round) =>
    set((s) => ({ fixturesTab: tab, fixturesRound: round ?? s.fixturesRound })),

  advance: () => {
    const { world } = get();
    if (!world) return;
    // Motor dünyayı yerinde değiştirir; yeni referans React'in yeniden çizmesi için.
    const result = advance(world);
    set({ world: { ...world } });
    if (result.kind === 'played') {
      set({ fixturesTab: 'round', fixturesRound: result.round });
      get().navigate({ screen: 'fixtures' });
    }
  },
}));

/** Kariyer açıkken dünyayı döndürür (GameShell içindeki bileşenler için). */
export function useWorld(): GameWorld {
  const world = useGameStore((s) => s.world);
  if (!world) throw new Error('Açık bir oyun yok');
  return world;
}
