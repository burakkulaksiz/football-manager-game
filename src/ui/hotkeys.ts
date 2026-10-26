/**
 * Klavye kısayolları: tuş haritası ve kısayolları dinleyen hook'lar.
 * Metin girilirken, pencere (modal) açıkken ve Ayarlar'dan kapatılmışken devreye girmez.
 */
import { useEffect, useRef } from 'react';
import { useGameStore, type ScreenId } from '../store/gameStore';

/** Sol menüdeki ekranların tek tuşlu kısayolları (ipucu olarak menüde de görünür). */
export const SCREEN_KEYS: Partial<Record<ScreenId, string>> = {
  inbox: 'g',
  squad: 'k',
  dynamics: 'd',
  tactics: 't',
  training: 'a',
  academy: 'y',
  club: 'b',
  manager: 'm',
  jobs: 'j',
  finance: 'f',
  facilities: 'e',
  transfers: 'n',
  fixtures: 's',
  table: 'p',
  stats: 'l',
  international: 'z',
  settings: ',',
};

const KEY_TO_SCREEN = new Map(Object.entries(SCREEN_KEYS).map(([screen, key]) => [key, screen as ScreenId]));

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/** Tab ile odaklanmış düğme / bağlantı: Boşluk ve Enter onu çalıştırır, kısayol karışmaz (fareyle tıklanan düğme sayılmaz). */
function keyboardFocusedControl(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches('button, a[href], [role="button"]') && el.matches(':focus-visible');
}

/** Bu tuş olayında kısayol çalışabilir mi? */
export function hotkeyAllowed(e: KeyboardEvent): boolean {
  if (!useGameStore.getState().settings.hotkeys) return false;
  if (e.defaultPrevented || e.isComposing) return false;
  if (isEditable(e.target)) return false;
  return document.querySelector('.modal-backdrop') === null;
}

/**
 * Pencere düzeyinde tuş dinler. İşleyici tuşu kullandıysa true döner (tarayıcının varsayılanı engellenir).
 * Alt bileşenin işleyicisi üst bileşeninkinden önce çalışır; kullanılan tuş üste ulaşmaz.
 */
export function useHotkeys(handler: (e: KeyboardEvent) => boolean | void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hotkeyAllowed(e)) return;
      if (latest.current(e) !== true) return;
      e.preventDefault();
      // Fareyle tıklanmış düğme odakta kalmışsa Boşluk bırakılınca onu da tıklamasın
      const active = document.activeElement;
      if (e.key === ' ' && active instanceof HTMLElement && active.matches('button') && !active.matches(':focus-visible')) active.blur();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Her ekranda geçerli kısayollar: Devam, geri / ileri, ekran tuşları, yardım. */
export function useGlobalHotkeys(onHelp: () => void) {
  useHotkeys((e) => {
    const s = useGameStore.getState();
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (e.key === 'ArrowLeft') s.back();
      else s.forward();
      return true;
    }
    if (e.key === 'F1') {
      onHelp();
      return true;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    if (e.key === '?') {
      onHelp();
      return true;
    }
    if (e.key === 'Escape' && s.newsAlert) {
      s.dismissNewsAlert();
      return true;
    }
    if (e.key === ' ') {
      if (keyboardFocusedControl()) return false;
      // Tuşa basılı tutmak günleri art arda atlatmasın
      if (e.repeat) return true;
      const canAdvance = s.world !== null && !s.world.gameOver && !(s.liveMatch !== null && s.screen === 'match');
      if (canAdvance) s.advance();
      return true;
    }
    const screen = e.shiftKey ? undefined : KEY_TO_SCREEN.get(e.key.toLowerCase());
    if (screen) {
      s.setScreen(screen);
      return true;
    }
    return false;
  });
}

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; text: string }[];
}

/** Yardım penceresi ve Ayarlar'daki kısayol listesi için gruplar; ekran tuşları SCREEN_KEYS'ten gelir. */
export function shortcutGroups(screenLabel: (id: ScreenId) => string): ShortcutGroup[] {
  return [
    {
      title: 'Genel',
      items: [
        { keys: ['Boşluk'], text: 'Devam / Maça Çık / Maça Dön' },
        { keys: ['Alt', '←'], text: 'Geri' },
        { keys: ['Alt', '→'], text: 'İleri' },
        { keys: ['Ctrl', 'S'], text: 'Kaydet' },
        { keys: ['Esc'], text: 'Pencereyi ya da haber kutusunu kapat' },
        { keys: ['?'], text: 'Kısayol listesini aç (F1 de olur)' },
      ],
    },
    {
      title: 'Maç',
      items: [
        { keys: ['Boşluk'], text: 'Maçı başlat / duraklat / devam ettir; maç bitince Maçı Bitir' },
        { keys: ['+'], text: 'Maç hızını artır' },
        { keys: ['-'], text: 'Maç hızını azalt' },
      ],
    },
    {
      title: 'Ekranlar',
      items: (Object.entries(SCREEN_KEYS) as [ScreenId, string][]).map(([id, key]) => ({ keys: [key.toUpperCase()], text: screenLabel(id) })),
    },
  ];
}
