import { create } from 'zustand';
import {
  advance,
  applyCaptainChange,
  changeTactics,
  clubPlayers,
  createWorld,
  finishUserMatch,
  SEASON_START_DATE,
  simulateToEnd,
  startUserMatch,
  stepMatch,
  teamHierarchy,
  substitute,
  type FormationId,
  type GameWorld,
  type MatchState,
  type Player,
  type Side,
  type Tactics,
  type TeamInstructions,
} from '../engine';
import { DEFAULT_SQUAD_FILTERS, type SquadFilters, type SquadView } from '../ui/squadFilters';
import { gameData } from '../gameData';
import { autosave, loadGame, saveGame } from '../persistence/saves';

/** Sol menüden açılan ekranlar + menü dışı ekranlar ('player'). */
export type ScreenId =
  | 'inbox'
  | 'squad'
  | 'tactics'
  | 'training'
  | 'academy'
  | 'dynamics'
  | 'club'
  | 'finance'
  | 'transfers'
  | 'fixtures'
  | 'table'
  | 'stats'
  | 'player'
  | 'match'
  | 'report';

/** Gezinme geçmişindeki bir sayfa (FM'deki ◀ ▶ okları için). */
export interface Route {
  screen: ScreenId;
  playerId?: number;
  /** Maç raporu ekranı için. */
  fixtureId?: number;
}

export interface Notice {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

interface GameState {
  /** 'menu' = ana menü, 'newGame' = kulüp seçimi, 'load' = kayıt yükleme, 'game' = kariyer açık */
  phase: 'menu' | 'newGame' | 'load' | 'game';
  world: GameWorld | null;
  /** Dünyadaki her değişiklikte artar; kayıt anındaki değer savedRevision'a yazılır. */
  revision: number;
  savedRevision: number;
  /** Bu kariyerde en son elle kaydedilen/yüklenen slot (kayıt penceresinde öne çıkar). */
  currentSaveId: number | null;
  /** Kısa süreli bildirim (kayıt alındı, hata…). */
  notice: Notice | null;
  /** Geçerli sayfa (history[historyIndex] ile aynı). */
  screen: ScreenId;
  selectedPlayerId: number | null;
  /** Açık maç raporunun fikstürü. */
  selectedFixtureId: number | null;
  history: Route[];
  historyIndex: number;
  /** Kadro ekranında görüntülenen kulüp (varsayılan: kendi kulübümüz). */
  viewedClubId: string | null;
  /** Kadro ekranı: görünüm ve filtreler (profil sayfasından dönünce korunur). */
  squadView: SquadView;
  squadFilters: SquadFilters;
  /** Karşılaştırma için seçilen oyuncular (en fazla 2). */
  compareIds: number[];
  /** Fikstür ekranı: kendi maçlarımız mı, haftalık görünüm mü; seçili hafta. */
  fixturesTab: 'club' | 'round' | 'cup';
  fixturesRound: number;
  /** Oynanmakta olan kendi maçımız (yoksa null). */
  liveMatch: MatchState | null;

  openNewGame: () => void;
  openLoadGame: () => void;
  startNewGame: (clubId: string, managerName: string) => void;
  /** Menajer adını değiştirir. */
  renameManager: (name: string) => void;
  /** Elle kayıt: yeni slot ya da `overwriteId` slotunun üzerine. Canlı maç sırasında yapılamaz. */
  saveCurrent: (name: string, overwriteId?: number) => Promise<boolean>;
  loadSave: (id: number) => Promise<boolean>;
  showNotice: (text: string, kind?: Notice['kind']) => void;
  clearNotice: () => void;
  quitToMenu: () => void;
  navigate: (route: Route) => void;
  setScreen: (screen: ScreenId) => void;
  openPlayer: (playerId: number) => void;
  openReport: (fixtureId: number) => void;
  back: () => void;
  forward: () => void;
  setViewedClub: (clubId: string) => void;
  setSquadView: (view: SquadView) => void;
  setSquadFilters: (change: Partial<SquadFilters>) => void;
  toggleCompare: (playerId: number) => void;
  clearCompare: () => void;
  setFixturesView: (tab: 'club' | 'round' | 'cup', round?: number) => void;
  /**
   * "Devam": maç günüyse maçları oynatır, değilse bir sonraki maç gününe ilerler.
   * Maçlar oynanınca o haftanın sonuçları gösterilir.
   */
  advance: () => void;
  /**
   * Dünyayı değiştiren bir motor işlemini çalıştırır (transfer teklifi, sözleşme…),
   * arayüzü günceller ve işlemin sonucunu döndürür.
   */
  worldAction: <T>(fn: (world: GameWorld) => T) => T;
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
  return { screen: route.screen, selectedPlayerId: route.playerId ?? null, selectedFixtureId: route.fixtureId ?? null };
}

const START_ROUTE: Route = { screen: 'inbox' };

/** Kariyere giriş (yeni oyun ya da kayıt yükleme) sonrası arayüz durumu. */
function enterGame(world: GameWorld) {
  return {
    phase: 'game' as const,
    world,
    ...routeState(START_ROUTE),
    history: [START_ROUTE],
    historyIndex: 0,
    viewedClubId: world.playerClubId,
    compareIds: [] as number[],
    fixturesTab: 'club' as const,
    fixturesRound: 1,
    liveMatch: null,
    revision: 0,
    savedRevision: 0,
  };
}

/** Kaydedilmemiş ilerleme var mı (çıkışta uyarı için). */
export function hasUnsavedProgress(s: Pick<GameState, 'revision' | 'savedRevision'>): boolean {
  return s.revision !== s.savedRevision;
}

let noticeCounter = 0;

/** Otomatik kaydın, sonuç ekranı çizildikten sonra başlaması için gecikme. */
const AUTOSAVE_DELAY_MS = 150;

export const useGameStore = create<GameState>()((set, get) => {
  /** Dünya değişti: yeni referans (React yeniden çizsin) + kaydedilmemiş ilerleme. */
  const touch = (world: GameWorld) => set((s) => ({ world: { ...world }, revision: s.revision + 1 }));

  /**
   * Maç günü sonrası otomatik kayıt (arka planda; hata olursa bildirim).
   * Dünyanın kopyalanması ~1 MB'lık iş: sonuç ekranı önce çizilsin diye kısa bir gecikmeyle başlar.
   * O arada canlı maç başladıysa atlanır (canlı maç sırasında kayıt yok); sonraki maç günü yine kaydedilir.
   */
  const runAutosave = () => {
    setTimeout(() => {
      const { world, revision, liveMatch } = get();
      // Kovulduysan otomatik kayıt alınmaz: önceki kayıttan devam edebilmelisin.
      if (!world || world.gameOver || liveMatch) return;
      autosave(world)
        .then(() => set({ savedRevision: revision }))
        .catch((e: unknown) => get().showNotice(`Otomatik kayıt başarısız: ${String(e)}`, 'error'));
    }, AUTOSAVE_DELAY_MS);
  };

  return {
    phase: 'menu',
    world: null,
    revision: 0,
    savedRevision: 0,
    currentSaveId: null,
    notice: null,
    screen: START_ROUTE.screen,
    selectedPlayerId: null,
    selectedFixtureId: null,
    history: [START_ROUTE],
    historyIndex: 0,
    viewedClubId: null,
    squadView: 'general',
    squadFilters: { ...DEFAULT_SQUAD_FILTERS },
    compareIds: [],
    fixturesTab: 'club',
    fixturesRound: 1,
    liveMatch: null,

    openNewGame: () => set({ phase: 'newGame' }),

    openLoadGame: () => set({ phase: 'load' }),

    startNewGame: (clubId, managerName) => {
      // Seed oyunun başında bir kez belirlenir; motor içinde Math.random kullanılmaz.
      const seed = Date.now() >>> 0;
      const world = createWorld(gameData, seed, clubId, SEASON_START_DATE, managerName);
      set({ ...enterGame(world), currentSaveId: null, revision: 1 });
    },

    renameManager: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      get().worldAction((w) => {
        w.manager.name = trimmed;
      });
    },

    saveCurrent: async (name, overwriteId) => {
      const { world, liveMatch, revision } = get();
      if (!world) return false;
      if (liveMatch) {
        get().showNotice('Maç sürerken kayıt yapılamaz.', 'error');
        return false;
      }
      try {
        const id = await saveGame(world, name, overwriteId);
        set({ savedRevision: revision, currentSaveId: id });
        get().showNotice(`Oyun kaydedildi: ${name}`);
        return true;
      } catch (e) {
        get().showNotice(`Kayıt başarısız: ${String(e)}`, 'error');
        return false;
      }
    },

    loadSave: async (id) => {
      try {
        const world = await loadGame(id);
        set({ ...enterGame(world), currentSaveId: id, notice: null });
        return true;
      } catch (e) {
        get().showNotice(e instanceof Error ? e.message : String(e), 'error');
        return false;
      }
    },

    showNotice: (text, kind = 'ok') => set({ notice: { id: ++noticeCounter, text, kind } }),

    clearNotice: () => set({ notice: null }),

    quitToMenu: () => set({ phase: 'menu', world: null, liveMatch: null, currentSaveId: null }),

    navigate: (route) => {
      const { history, historyIndex } = get();
      const current = history[historyIndex];
      if (current && current.screen === route.screen && current.playerId === route.playerId && current.fixtureId === route.fixtureId) return;
      // İleri geçmişi silinir, yeni sayfa sona eklenir (tarayıcı gibi).
      const next = [...history.slice(0, historyIndex + 1), route].slice(-50);
      set({ history: next, historyIndex: next.length - 1, ...routeState(route) });
    },

    setScreen: (screen) => get().navigate({ screen }),

    openPlayer: (playerId) => get().navigate({ screen: 'player', playerId }),

    openReport: (fixtureId) => get().navigate({ screen: 'report', fixtureId }),

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

    setSquadView: (view) => set({ squadView: view }),

    setSquadFilters: (change) => set((s) => ({ squadFilters: { ...s.squadFilters, ...change } })),

    toggleCompare: (playerId) =>
      set((s) => ({
        compareIds: s.compareIds.includes(playerId)
          ? s.compareIds.filter((id) => id !== playerId)
          : [...s.compareIds, playerId].slice(-2),
      })),

    clearCompare: () => set({ compareIds: [] }),

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
      const result = advance(world, gameData);
      if (result.kind === 'userMatch') {
        const state = startUserMatch(world);
        touch(world);
        set({ liveMatch: state });
        get().navigate({ screen: 'match' });
        return;
      }
      touch(world);
      if (result.kind === 'played') {
        // Kupa günü: kupa sekmesi; lig haftasında hafta sekmesi
        set(result.cup ? { fixturesTab: 'cup' } : { fixturesTab: 'round', fixturesRound: result.round });
        get().navigate({ screen: 'fixtures' });
        runAutosave();
      } else if (result.news.length > 0) {
        // Devam bir haber yüzünden durdu: kullanıcıya göster.
        const [first, ...rest] = result.news;
        get().showNotice(rest.length > 0 ? `${first!.title} (+${rest.length} haber)` : first!.title);
      }
    },

    worldAction: (fn) => {
      const { world } = get();
      if (!world) throw new Error('Açık bir oyun yok');
      const result = fn(world);
      touch(world);
      return result;
    },

    updateTactics: (fn) => {
      const { world } = get();
      if (!world) return;
      const clubId = world.playerClubId;
      const current = world.tactics[clubId];
      if (!current) return;
      const next = fn(current, clubPlayers(world, clubId));
      // Kaptan / yardımcı kaptan değiştiyse moral etkileri (hiyerarşi eski rollerle hesaplanır)
      if (next.captainId !== current.captainId || next.viceCaptainId !== current.viceCaptainId) {
        const before = teamHierarchy(world, clubId);
        applyCaptainChange(world, 'captain', current.captainId, next.captainId, before);
        applyCaptainChange(world, 'vice', current.viceCaptainId, next.viceCaptainId, before);
      }
      touch({ ...world, tactics: { ...world.tactics, [clubId]: next } });
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
      const fixtureId = liveMatch.fixtureId;
      const round = finishUserMatch(world, liveMatch);
      touch(world);
      set(round[0]?.competition === 'cup'
        ? { liveMatch: null, fixturesTab: 'cup' }
        : { liveMatch: null, fixturesTab: 'round', fixturesRound: round[0]?.round ?? 1 });
      get().navigate({ screen: 'report', fixtureId });
      runAutosave();
    },
  };
});

/** Kariyer açıkken dünyayı döndürür (GameShell içindeki bileşenler için). */
export function useWorld(): GameWorld {
  const world = useGameStore((s) => s.world);
  if (!world) throw new Error('Açık bir oyun yok');
  return world;
}
