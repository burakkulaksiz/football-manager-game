import { create } from 'zustand';
import {
  advance,
  changeTactics,
  clubPlayers,
  createWorld,
  finishUserMatch,
  SEASON_START_DATE,
  simulateToEnd,
  startUserMatch,
  stepMatch,
  substitute,
  type FormationId,
  type GameWorld,
  type MatchState,
  type Player,
  type Side,
  type Tactics,
  type TeamInstructions,
} from '../engine';
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
  | 'player'
  | 'match';

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
  /** Oynanmakta olan kendi maçımız (yoksa null). */
  liveMatch: MatchState | null;

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
  /** Kendi kulübümüzün taktiğini günceller (motorun saf yardımcılarıyla). */
  updateTactics: (fn: (tactics: Tactics, squad: Player[]) => Tactics) => void;
  /** Canlı maç başlamadan taktik değiştiyse maçı aynı tohumla yeniden kurar. */
  refreshPreMatch: () => void;
  liveChangeTactics: (change: { formation?: FormationId; instructions?: Partial<TeamInstructions> }) => void;
  /** Canlı maç: bir adım (dakika) ilerlet. */
  stepLiveMatch: () => void;
  liveSubstitute: (outId: number, inId: number) => boolean;
  /** Kalan dakikaları anında oynat (değişiklikleri yapay zekâ yapar). */
  liveInstantFinish: () => void;
  /** Biten maçı kaydet, günün diğer maçlarını oynat, sonuçları göster. */
  finishLiveMatch: () => void;
}

/** Canlı maçta kullanıcının tarafı. */
export function userSide(state: MatchState, world: GameWorld): Side {
  return state.home.clubId === world.playerClubId ? 'home' : 'away';
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
  liveMatch: null,

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
      liveMatch: null,
    });
  },

  quitToMenu: () => set({ phase: 'menu', world: null, liveMatch: null }),

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
    const { world, liveMatch } = get();
    if (!world) return;
    // Yarım kalan maç varsa önce ona dön.
    if (liveMatch) {
      get().navigate({ screen: 'match' });
      return;
    }
    // Motor dünyayı yerinde değiştirir; yeni referans React'in yeniden çizmesi için.
    const result = advance(world);
    if (result.kind === 'userMatch') {
      const state = startUserMatch(world);
      set({ world: { ...world }, liveMatch: state });
      get().navigate({ screen: 'match' });
      return;
    }
    set({ world: { ...world } });
    if (result.kind === 'played') {
      set({ fixturesTab: 'round', fixturesRound: result.round });
      get().navigate({ screen: 'fixtures' });
    }
  },

  updateTactics: (fn) => {
    const { world } = get();
    if (!world) return;
    const clubId = world.playerClubId;
    const current = world.tactics[clubId];
    if (!current) return;
    const next = fn(current, clubPlayers(world, clubId));
    set({ world: { ...world, tactics: { ...world.tactics, [clubId]: next } } });
  },

  refreshPreMatch: () => {
    const { world, liveMatch } = get();
    if (!world || !liveMatch || liveMatch.period !== 'pre') return;
    set({ liveMatch: startUserMatch(world, liveMatch.seed) });
  },

  liveChangeTactics: (change) => {
    const { world, liveMatch } = get();
    if (!world || !liveMatch) return;
    changeTactics(liveMatch, world.players, userSide(liveMatch, world), change);
    set({ liveMatch: { ...liveMatch } });
  },

  stepLiveMatch: () => {
    const { world, liveMatch } = get();
    if (!world || !liveMatch) return;
    stepMatch(liveMatch, world.players);
    set({ liveMatch: { ...liveMatch } });
  },

  liveSubstitute: (outId, inId) => {
    const { world, liveMatch } = get();
    if (!world || !liveMatch) return false;
    const ok = substitute(liveMatch, world.players, userSide(liveMatch, world), outId, inId);
    if (ok) set({ liveMatch: { ...liveMatch } });
    return ok;
  },

  liveInstantFinish: () => {
    const { world, liveMatch } = get();
    if (!world || !liveMatch) return;
    simulateToEnd(liveMatch, world.players);
    set({ liveMatch: { ...liveMatch } });
  },

  finishLiveMatch: () => {
    const { world, liveMatch } = get();
    if (!world || !liveMatch || liveMatch.period !== 'full') return;
    const round = finishUserMatch(world, liveMatch);
    set({
      world: { ...world },
      liveMatch: null,
      fixturesTab: 'round',
      fixturesRound: round[0]?.round ?? 1,
    });
    get().navigate({ screen: 'fixtures' });
  },
}));

/** Kariyer açıkken dünyayı döndürür (GameShell içindeki bileşenler için). */
export function useWorld(): GameWorld {
  const world = useGameStore((s) => s.world);
  if (!world) throw new Error('Açık bir oyun yok');
  return world;
}
