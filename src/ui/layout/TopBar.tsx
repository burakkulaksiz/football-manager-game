import { formatDateTR, getClub, nextFixtureFor, seasonLabel, type GameWorld } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { formatDayMonth } from '../labels';

/** Üst bardaki "sıradaki maç" bilgisi. */
function nextMatchText(world: GameWorld): string {
  const next = nextFixtureFor(world, world.playerClubId);
  if (!next) return 'Sezon tamamlandı';
  const home = next.homeId === world.playerClubId;
  const opponent = getClub(world, home ? next.awayId : next.homeId);
  const venue = home ? 'İ' : 'D';
  if (next.date === world.date) return `Bugün maç günü: ${opponent.name} (${venue})`;
  return `Sıradaki maç: ${opponent.name} (${venue}) — ${formatDayMonth(next.date)}`;
}

export function TopBar() {
  const world = useWorld();
  const advance = useGameStore((s) => s.advance);
  const club = getClub(world, world.playerClubId);

  return (
    <header className="topbar">
      <div className="topbar-club">
        <ClubBadge club={club} />
        <div className="topbar-club-box">
          <div className="topbar-club-name">{club.name}</div>
          <div className="topbar-sub">Türkiye Süper Ligi {seasonLabel(world.season.year)}</div>
        </div>
      </div>
      <div className="topbar-info">
        <div className="topbar-date">{formatDateTR(world.date)}</div>
        <div className="topbar-next">{nextMatchText(world)}</div>
      </div>
      <button className="btn btn-large btn-continue" onClick={advance}>
        Devam ▶
      </button>
    </header>
  );
}
