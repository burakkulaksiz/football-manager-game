import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { NOTICE_MS } from '../../store/settings';

/** Ekranın köşesinde kısa süre görünen bildirim (kayıt alındı, hata…). */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice);
  const clear = useGameStore((s) => s.clearNotice);
  const length = useGameStore((s) => s.settings.noticeLength);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clear, NOTICE_MS[length] * (notice.kind === 'error' ? 2 : 1));
    return () => clearTimeout(timer);
  }, [notice, clear, length]);

  if (!notice) return null;
  return (
    <div className={`toast toast-${notice.kind}`} role="status" onClick={clear}>
      {notice.text}
    </div>
  );
}
