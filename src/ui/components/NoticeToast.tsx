import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { NOTICE_MS } from '../../store/settings';

/** Tarayıcının tam ekran öğesi (yoksa null); tam ekrana girip çıkınca güncellenir. */
function useFullscreenElement(): Element | null {
  const [element, setElement] = useState<Element | null>(() => (typeof document === 'undefined' ? null : document.fullscreenElement));
  useEffect(() => {
    const sync = () => setElement(document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  return element;
}

/**
 * Ekranın üstünde kısa süre görünen bildirim (kayıt alındı, hata…).
 * Tam ekranda (2D saha) yalnızca tam ekran öğesinin içi çizildiği için bildirim oraya taşınır ve skor şeridinin altına iner.
 */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice);
  const clear = useGameStore((s) => s.clearNotice);
  const length = useGameStore((s) => s.settings.noticeLength);
  const fullscreen = useFullscreenElement();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clear, NOTICE_MS[length] * (notice.kind === 'error' ? 2 : 1));
    return () => clearTimeout(timer);
  }, [notice, clear, length]);

  if (!notice) return null;
  const toast = (
    <div className={`toast toast-${notice.kind}${fullscreen ? ' toast-fs' : ''}`} role="status" onClick={clear}>
      {notice.text}
    </div>
  );
  return fullscreen ? createPortal(toast, fullscreen) : toast;
}
