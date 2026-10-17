import { create } from 'zustand';
import { addDays, SEASON_START_DATE, type GameDate } from '../engine';

/** Sol menüden açılan ekranlar. */
export type ScreenId =
  | 'inbox'
  | 'squad'
  | 'tactics'
  | 'club'
  | 'finance'
  | 'transfers'
  | 'fixtures'
  | 'table'
  | 'stats';

interface GameState {
  /** 'menu' = ana menü, 'game' = kariyer açık */
  phase: 'menu' | 'game';
  screen: ScreenId;
  currentDate: GameDate;

  startNewGame: () => void;
  quitToMenu: () => void;
  setScreen: (screen: ScreenId) => void;
  /**
   * "Devam": zamanı bir sonraki olaya kadar ilerletir.
   * Aşama 1'de henüz olay yok; takvimi sadece bir gün ilerletir.
   */
  advance: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  phase: 'menu',
  screen: 'inbox',
  currentDate: SEASON_START_DATE,

  startNewGame: () => set({ phase: 'game', screen: 'inbox', currentDate: SEASON_START_DATE }),
  quitToMenu: () => set({ phase: 'menu' }),
  setScreen: (screen) => set({ screen }),
  advance: () => set((s) => ({ currentDate: addDays(s.currentDate, 1) })),
}));
