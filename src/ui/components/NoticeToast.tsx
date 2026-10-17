import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

/** Ekranın köşesinde kısa süre görünen bildirim (kayıt alındı, hata…). */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice);
  const clear = useGameStore((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clear, notice.kind === 'error' ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [notice, clear]);

  if (!notice) return null;
  return (
    <div className={`toast toast-${notice.kind}`} role="status" onClick={clear}>
      {notice.text}
    </div>
  );
}
