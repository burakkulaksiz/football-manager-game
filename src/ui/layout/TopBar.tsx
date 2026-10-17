import { formatDateTR } from '../../engine';
import { useGameStore } from '../../store/gameStore';

export function TopBar() {
  const currentDate = useGameStore((s) => s.currentDate);
  const advance = useGameStore((s) => s.advance);

  return (
    <header className="topbar">
      <div className="topbar-club">
        <div className="club-badge">?</div>
        <div>
          <div className="topbar-club-name">Kulüp seçilmedi</div>
          <div className="topbar-sub">Türkiye Süper Ligi</div>
        </div>
      </div>
      <div className="topbar-date">{formatDateTR(currentDate)}</div>
      <button className="btn-continue" onClick={advance}>
        Devam ▶
      </button>
    </header>
  );
}
