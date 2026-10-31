import { useCallback } from 'react';
import { create } from 'zustand';
import {
  advance,
  applyCaptainChange,
  changeTactics,
  clubPlayers,
  DEFAULT_INSTRUCTIONS,
  tacticPlan,
  type TacticsChange,
  createWorld,
  finishUserMatch,
  pendingDecisions,
  todaysUserFixture,
  MAX_COMPARE,
  SEASON_START_DATE,
  simulateToEnd,
  startUserMatch,
  stepMatch,
  teamHierarchy,
  substitute,
  swapPositions,
  giveTeamTalk,
  type TeamTalk,
  type Competition,
  type GameWorld,
  type ManagerBackground,
  type MatchState,
  type Player,
  type Side,
  type Tactics,
} from '../engine';
import { DEFAULT_SQUAD_FILTERS, type SquadFilters, type SquadView } from '../ui/squadFilters';
import { gameData } from '../gameData';
import { autosave, liveMatchLabel, loadGame, loadSavedMatch, saveGame } from '../persistence/saves';
import { logError } from '../persistence/errorLog';
import { autosaveDue, loadSettings, saveSettings, type Settings } from './settings';

/** Fikstür ekranı sekmeleri. */
export type FixturesTab = 'club' | 'round' | 'cup' | 'europe';

/** Maçın organizasyonuna göre fikstür sekmesi. */
export function tabFor(competition: Competition | undefined): FixturesTab {
  return competition === 'cup' ? 'cup' : competition ? 'europe' : 'round';
}

/** Sol menüden açılan ekranlar + menü dışı ekranlar ('player'). */
export type ScreenId =
  | 'settings'
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
  | 'report'
  | 'international'
  | 'manager'
  | 'jobs'
  | 'facilities';

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
  /** Maç ortasında son alınan kaydın maç imzası (bkz. matchSignature); maç sonradan ilerlediyse kayıt eskimiş sayılır. */
  savedMatchSig: string | null;
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
  /** Karşılaştırma için seçilen oyuncular (en fazla MAX_COMPARE). */
  compareIds: number[];
  /** Fikstür ekranı: kendi maçlarımız mı, haftalık görünüm mü; seçili hafta. */
  fixturesTab: FixturesTab;
  fixturesRound: number;
  /** Oynanmakta olan kendi maçımız (yoksa null). */
  liveMatch: MatchState | null;
  /**
   * Canlı maçta geri alınabilir değişiklikler (her birinden önceki durum). Yalnızca `match` hâlâ `liveMatch` ise geçerli:
   * maç adımı, devre arası konuşması, yeniden kurma ve yükleme yeni nesne verdiği için geri alma kendiliğinden düşer.
   */
  liveUndo: { match: MatchState; stack: MatchState[] } | null;
  /**
   * Ekranların gezinmede korunan durumu (filtreler, sekmeler, seçimler): anahtar "<ekran>.<ad>". Oyuncu profiline gidip
   * geri dönünce korunur; menüden başka bir bölüme geçilince (setScreen) sıfırlanır.
   */
  ui: Record<string, unknown>;
  /** Menüden en son girilen bölüm (ui durumu bu bölüme aittir). */
  area: ScreenId;
  /** Karar bekleyen konular penceresi (Devam bu yüzden ilerlemedi). */
  decisionsOpen: boolean;
  /** Devam'ı durduran yeni haberler (belirgin uyarı; tıklanınca ilgili yere gidilir). */
  newsAlert: number[] | null;
  /** Oyun ayarları (tarayıcıda saklanır, kariyerler arasında ortak). */
  settings: Settings;
  /** Son otomatik kaydın oyun içi tarihi (otomatik kayıt sıklığı için; kariyere girince sıfırlanır). */
  lastAutosave: string | null;

  openNewGame: () => void;
  openLoadGame: () => void;
  startNewGame: (clubId: string, managerName: string, background?: ManagerBackground) => void;
  /** Menajer adını değiştirir. */
  renameManager: (name: string) => void;
  /** Elle kayıt: yeni slot ya da `overwriteId` slotunun üzerine. Canlı maç sırasında yapılamaz. */
  saveCurrent: (name: string, overwriteId?: number) => Promise<boolean>;
  loadSave: (id: number) => Promise<boolean>;
  showNotice: (text: string, kind?: Notice['kind']) => void;
  clearNotice: () => void;
  quitToMenu: () => void;
  navigate: (route: Route) => void;
  /** Bölüme git (menü, "… ›" bağlantıları): bölüm değişirse ekran durumu sıfırlanır; `preset` yeni bölümün durumuna yazılır. */
  setScreen: (screen: ScreenId, preset?: Record<string, unknown>) => void;
  setUi: (key: string, value: unknown) => void;
  setDecisionsOpen: (open: boolean) => void;
  updateSettings: (change: Partial<Settings>) => void;
  dismissNewsAlert: () => void;
  openPlayer: (playerId: number) => void;
  openReport: (fixtureId: number) => void;
  back: () => void;
  forward: () => void;
  setViewedClub: (clubId: string) => void;
  setSquadView: (view: SquadView) => void;
  setSquadFilters: (change: Partial<SquadFilters>) => void;
  toggleCompare: (playerId: number) => void;
  clearCompare: () => void;
  setFixturesView: (tab: FixturesTab, round?: number) => void;
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
  liveChangeTactics: (change: TacticsChange) => void;
  /** Canlı maç: kayıtlı taktik setine (A/B/C) geç. */
  liveSwitchPlan: (index: number) => void;
  /** Canlı maç: bir adım (dakika) ilerlet. */
  stepLiveMatch: () => void;
  liveSubstitute: (outId: number, inId: number) => boolean;
  /** Canlı maç: sahadaki iki oyuncunun yerini değiştir. */
  liveSwap: (a: number, b: number) => boolean;
  /** Canlı maç: son değişikliği (oyuncu, yer, taktik) geri al; maç o arada ilerlemediyse. */
  undoLiveChange: () => void;
  /** Devre arası konuşması (bir kez; oyuncuların morali dünyada değişir). */
  liveTeamTalk: (talk: TeamTalk) => boolean;
  /** Kalan dakikaları anında oynat (değişiklikleri yapay zekâ yapar). */
  liveInstantFinish: () => void;
  /** Biten maçı kaydet, günün diğer maçlarını oynat, sonuçları göster. */
  finishLiveMatch: () => void;
}

/** Canlı maçta kullanıcının tarafı. */
export function userSide(state: MatchState, world: GameWorld): Side {
  return state.home.clubId === world.playerClubId ? 'home' : 'away';
}

/** Geri alınabilecek değişiklik sayısı (maç o arada ilerlediyse 0). */
export function liveUndoCount(s: Pick<GameState, 'liveMatch' | 'liveUndo'>): number {
  return s.liveMatch !== null && s.liveUndo?.match === s.liveMatch ? s.liveUndo.stack.length : 0;
}

/** Geri alma yığınının sınırı (her öğe maç durumunun bir kopyası). */
const LIVE_UNDO_LIMIT = 20;

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
    liveUndo: null,
    revision: 0,
    savedRevision: 0,
    savedMatchSig: null,
    ui: {},
    area: START_ROUTE.screen,
    decisionsOpen: false,
    newsAlert: null,
    lastAutosave: null,
  };
}

/** Kaydedilmemiş ilerleme var mı (çıkışta uyarı için). */
/** Maçın ilerleyişini özetler (dakika, devre, olay sayısı): iki imza farklıysa maç kayıttan sonra ilerlemiştir. */
export function matchSignature(match: MatchState): string {
  return `${match.fixtureId}:${match.period}:${match.minute}:${match.events.length}`;
}

export function hasUnsavedProgress(s: Pick<GameState, 'revision' | 'savedRevision' | 'liveMatch' | 'savedMatchSig'>): boolean {
  return s.revision !== s.savedRevision || (s.liveMatch !== null && matchSignature(s.liveMatch) !== s.savedMatchSig);
}

let noticeCounter = 0;

/** Otomatik kaydın, sonuç ekranı çizildikten sonra başlaması için gecikme. */
const AUTOSAVE_DELAY_MS = 150;

export const useGameStore = create<GameState>()((set, get) => {
  /** Dünya değişti: yeni referans (React yeniden çizsin) + kaydedilmemiş ilerleme. */
  const touch = (world: GameWorld) => set((s) => ({ world: { ...world }, revision: s.revision + 1 }));

  /**
   * Canlı maçta kullanıcı değişikliği: önceki durum geri alma yığınına girer. `fn` false dönerse (kural dışı) iz bırakmaz.
   * Motor maçı yerinde değiştirir; kopya değişiklikten önce alınır.
   */
  const liveEdit = (fn: (match: MatchState, world: GameWorld) => boolean | void): boolean => {
    const s = get();
    const { world, liveMatch } = s;
    if (!world || !liveMatch) return false;
    const before = structuredClone(liveMatch);
    if (fn(liveMatch, world) === false) return false;
    const stack = liveUndoCount(s) > 0 ? s.liveUndo!.stack : [];
    const next = { ...liveMatch };
    set({ liveMatch: next, liveUndo: { match: next, stack: [...stack, before].slice(-LIVE_UNDO_LIMIT) } });
    return true;
  };

  /**
   * Maç günü sonrası otomatik kayıt (arka planda; hata olursa bildirim).
   * Dünyanın kopyalanması ~1 MB'lık iş: sonuç ekranı önce çizilsin diye kısa bir gecikmeyle başlar.
   * O arada canlı maç başladıysa atlanır (canlı maç sırasında kayıt yok); sonraki maç günü yine kaydedilir.
   */
  const runAutosave = () => {
    setTimeout(() => {
      const { world, revision, liveMatch, settings, lastAutosave } = get();
      // Kovulduysan otomatik kayıt alınmaz: önceki kayıttan devam edebilmelisin.
      if (!world || world.gameOver || liveMatch) return;
      // Ayarlardaki sıklık: kapalı / her maç günü / haftada / ayda bir
      if (!autosaveDue(settings.autosave, lastAutosave, world.date)) return;
      const date = world.date;
      autosave(world)
        .then(() => set({ savedRevision: revision, lastAutosave: date }))
        .catch((e: unknown) => {
          logError('otomatik kayıt', e);
          get().showNotice(`Otomatik kayıt başarısız: ${String(e)}`, 'error');
        });
    }, AUTOSAVE_DELAY_MS);
  };

  return {
    phase: 'menu',
    world: null,
    revision: 0,
    savedRevision: 0,
    savedMatchSig: null,
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
    liveUndo: null,
    ui: {},
    area: START_ROUTE.screen,
    decisionsOpen: false,
    newsAlert: null,
    settings: loadSettings(),
    lastAutosave: null,

    openNewGame: () => set({ phase: 'newGame' }),

    openLoadGame: () => set({ phase: 'load' }),

    startNewGame: (clubId, managerName, background = 'player') => {
      // Seed oyunun başında bir kez belirlenir; motor içinde Math.random kullanılmaz.
      const seed = Date.now() >>> 0;
      const world = createWorld(gameData, seed, clubId, SEASON_START_DATE, managerName, background);
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
      // Maç yerinde ilerler: imza kayıt başlarken alınır, yazma beklenirken ilerleme kayda dahil sayılmaz
      const matchSig = liveMatch ? matchSignature(liveMatch) : null;
      try {
        // Maç sürüyorsa maçın o anki durumu da kaydedilir
        const id = await saveGame(world, name, overwriteId, liveMatch);
        set({ savedRevision: revision, savedMatchSig: matchSig, currentSaveId: id });
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
        const match = await loadSavedMatch(id, world);
        set({ ...enterGame(world), currentSaveId: id, notice: null, lastAutosave: world.date, liveMatch: match, savedMatchSig: match ? matchSignature(match) : null });
        // Maç ortasında alınmış kayıt: maç ekranından kaldığı yerden devam eder
        if (match) {
          get().navigate({ screen: 'match' });
          get().showNotice(`Maç kaldığı yerden devam ediyor: ${liveMatchLabel(world, match)}`);
        }
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

    setScreen: (screen, preset) => {
      // Başka bir bölüme geçildi: önceki bölümün filtreleri / sekmeleri bırakılır
      if (screen !== get().area) set({ ui: { ...preset }, area: screen });
      else if (preset) set((s) => ({ ui: { ...s.ui, ...preset } }));
      get().navigate({ screen });
    },

    setUi: (key, value) => set((s) => ({ ui: { ...s.ui, [key]: value } })),

    setDecisionsOpen: (open) => set({ decisionsOpen: open }),

    updateSettings: (change) => {
      const settings = { ...get().settings, ...change };
      saveSettings(settings);
      set({ settings });
    },

    dismissNewsAlert: () => set({ newsAlert: null }),

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
          : [...s.compareIds, playerId].slice(-MAX_COMPARE),
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
      set({ newsAlert: null });
      // Karar bekleyen konu varken tarih ilerlemez (bugün maçımız varsa maça çıkılabilir)
      if (!world.gameOver && !todaysUserFixture(world) && pendingDecisions(world).length > 0) {
        set({ decisionsOpen: true });
        return;
      }
      // Motor dünyayı yerinde değiştirir; yeni referans React'in yeniden çizmesi için.
      // Ayarlarda kapatılan haber türlerinde Devam durmaz
      const muted = new Set(get().settings.mutedNews);
      const result = advance(world, gameData, { stopOn: (n) => !muted.has(n.category) });
      if (result.kind === 'userMatch') {
        const state = startUserMatch(world);
        touch(world);
        set({ liveMatch: state });
        get().navigate({ screen: 'match' });
        return;
      }
      touch(world);
      if (result.kind === 'played') {
        // Kupa / Avrupa günü: ilgili sekme; lig haftasında hafta sekmesi
        set(result.competition ? { fixturesTab: tabFor(result.competition) } : { fixturesTab: 'round', fixturesRound: result.round });
        get().navigate({ screen: 'fixtures' });
        runAutosave();
      } else if (result.news.length > 0) {
        // Devam bir haber yüzünden durdu: belirgin uyarı (tıklanınca habere / teklife gidilir)
        if (get().settings.newsAlert) set({ newsAlert: result.news.map((n) => n.id) });
        // Haber kutusu kapalıysa kısa bildirim: Devam neden durdu
        else get().showNotice(`Yeni haber: ${result.news[0]!.title}${result.news.length > 1 ? ` (+${result.news.length - 1})` : ''}`);
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
      liveEdit((m, w) => changeTactics(m, w.players, userSide(m, w), change));
    },

    liveSwitchPlan: (index) => {
      const tactics = get().world?.tactics[get().world!.playerClubId];
      if (!tactics) return;
      const plan = tacticPlan(tactics, index);
      liveEdit((m, w) => changeTactics(m, w.players, userSide(m, w), {
        formation: plan.formation,
        custom: plan.custom ?? null,
        instructions: { ...DEFAULT_INSTRUCTIONS, ...plan.instructions },
        orders: plan.orders ?? [],
        plan: index,
      }));
    },

    stepLiveMatch: () => {
      const { world, liveMatch } = get();
      if (!world || !liveMatch) return;
      stepMatch(liveMatch, world.players);
      set({ liveMatch: { ...liveMatch } });
    },

    liveSubstitute: (outId, inId) => liveEdit((m, w) => substitute(m, w.players, userSide(m, w), outId, inId)),

    liveSwap: (a, b) => liveEdit((m, w) => swapPositions(m, userSide(m, w), a, b)),

    undoLiveChange: () => {
      const s = get();
      if (liveUndoCount(s) === 0) return;
      const stack = s.liveUndo!.stack;
      const previous = stack.at(-1)!;
      set({ liveMatch: previous, liveUndo: { match: previous, stack: stack.slice(0, -1) } });
    },

    liveTeamTalk: (talk) => {
      const { liveMatch } = get();
      if (!get().world || !liveMatch) return false;
      // Moral dünyadaki oyuncularda değişir: worldAction yeni referans verir (kaydedilmemiş ilerleme izlenir)
      const ok = get().worldAction((w) => giveTeamTalk(liveMatch, w.players, userSide(liveMatch, w), talk));
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
      const competition = round[0]?.competition;
      set(competition
        ? { liveMatch: null, fixturesTab: tabFor(competition) }
        : { liveMatch: null, fixturesTab: 'round', fixturesRound: round[0]?.round ?? 1 });
      get().navigate({ screen: 'report', fixtureId });
      runAutosave();
    },
  };
});

/**
 * Gezinmede korunan ekran durumu (useState gibi): oyuncu profiline gidip geri dönünce kaybolmaz, menüden başka bir bölüme
 * geçilince sıfırlanır. Anahtar "<ekran>.<ad>" biçiminde.
 */
export function useUiState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const stored = useGameStore((s) => s.ui[key]) as T | undefined;
  const setUi = useGameStore((s) => s.setUi);
  const value = stored === undefined ? initial : stored;
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = useGameStore.getState().ui[key] as T | undefined;
      const prev = current === undefined ? initial : current;
      setUi(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next);
    },
    // initial yalnızca ilk değer; değişmesi güncellemeyi etkilemesin
    [key, setUi],
  );
  return [value, update];
}

/** Kariyer açıkken dünyayı döndürür (GameShell içindeki bileşenler için). */
export function useWorld(): GameWorld {
  const world = useGameStore((s) => s.world);
  if (!world) throw new Error('Açık bir oyun yok');
  return world;
}
