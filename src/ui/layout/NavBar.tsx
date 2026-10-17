import { getClub, nextFixtureFor, type GameWorld } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDayMonth } from '../labels';

/** Gezinme çubuğundaki durum metni. */
function statusText(world: GameWorld): string {
  const next = nextFixtureFor(world, world.playerClubId);
  if (!next) return 'Sezon tamamlandı';
  const home = next.homeId === world.playerClubId;
  const opponent = getClub(world, home ? next.awayId : next.homeId);
  const venue = home ? 'İç saha' : 'Deplasman';
  if (next.date === world.date) return `Maç günü · ${opponent.name} (${venue})`;
  return `Sıradaki: ${opponent.name} (${venue}) · ${formatDayMonth(next.date)}`;
}

/** Başlığın altındaki çubuk: geri/ileri, durum ve Devam. */
export function NavBar() {
  const world = useWorld();
  const back = useGameStore((s) => s.back);
  const forward = useGameStore((s) => s.forward);
  const advance = useGameStore((s) => s.advance);
  const canBack = useGameStore((s) => s.historyIndex > 0);
  const canForward = useGameStore((s) => s.historyIndex < s.history.length - 1);
  const isMatchDay = world.season.fixtures.some((f) => f.date === world.date && f.result === null);

  return (
    <nav className="navbar">
      <div className="nav-arrows">
        <button className="icon-btn" onClick={back} disabled={!canBack} title="Geri">
          ◀
        </button>
        <button className="icon-btn" onClick={forward} disabled={!canForward} title="İleri">
          ▶
        </button>
      </div>
      <div className={`nav-status${isMatchDay ? ' matchday' : ''}`}>{statusText(world)}</div>
      <button className="btn-continue" onClick={advance}>
        {isMatchDay ? 'Maçları Oyna' : 'Devam'}
        <span className="btn-continue-arrow">›</span>
      </button>
    </nav>
  );
}
