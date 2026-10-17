import { formatDateTR } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';

export function TopBar() {
  const world = useWorld();
  const advance = useGameStore((s) => s.advance);
  const club = world.clubs.find((c) => c.id === world.playerClubId)!;

  return (
    <header className="topbar">
      <div className="topbar-club">
        <ClubBadge club={club} />
        <div className="topbar-club-box">
          <div className="topbar-club-name">{club.name}</div>
          <div className="topbar-sub">Türkiye Süper Ligi</div>
        </div>
      </div>
      <div className="topbar-date">{formatDateTR(world.date)}</div>
      <button className="btn btn-large btn-continue" onClick={advance}>
        Devam ▶
      </button>
    </header>
  );
}
