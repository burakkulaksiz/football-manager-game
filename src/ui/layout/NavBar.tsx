import { daysBetween, getClub, nextFixtureFor, todaysFixtures, todaysUserFixture, UNEMPLOYMENT_LIMIT_DAYS, type GameWorld } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDayMonth } from '../labels';

/** Gezinme çubuğundaki durum metni. */
function statusText(world: GameWorld): string {
  const next = nextFixtureFor(world, world.playerClubId);
  if (world.gameOver) return 'Kariyerin sona erdi';
  if (world.unemployed) return `İşsizsin · ${Math.max(0, UNEMPLOYMENT_LIMIT_DAYS - daysBetween(world.unemployed.since, world.date))} gün içinde iş bulmalısın`;
  if (!next) return world.seasonState === 'ended' ? 'Sezon arası · yeni sezon 1 Temmuz' : 'Sezon tamamlandı';
  const home = next.homeId === world.playerClubId;
  const opponent = getClub(world, home ? next.awayId : next.homeId);
  const venue = home ? 'İç saha' : 'Deplasman';
  if (next.date === world.date) return `Maç günü · ${opponent.name} (${venue})`;
  return `Sıradaki: ${opponent.name} (${venue}) · ${formatDayMonth(next.date)}`;
}

/** Başlığın altındaki çubuk: geri/ileri, durum ve Devam. */
export function NavBar({ onMenu }: { onMenu: () => void }) {
  const world = useWorld();
  const back = useGameStore((s) => s.back);
  const forward = useGameStore((s) => s.forward);
  const advance = useGameStore((s) => s.advance);
  const canBack = useGameStore((s) => s.historyIndex > 0);
  const canForward = useGameStore((s) => s.historyIndex < s.history.length - 1);
  // "Maça Çık" yalnızca bugün bizim maçımız varsa; yalnızca başkalarının maçı varsa Devam onları oynatıp sonuçları gösterir
  const isMatchDay = todaysUserFixture(world) !== null;
  const othersPlay = !isMatchDay && todaysFixtures(world).length > 0;
  const liveMatch = useGameStore((s) => s.liveMatch);
  const onMatchScreen = useGameStore((s) => s.screen === 'match');
  // Canlı maç sürerken Devam maça döndürür; maç ekranındayken kontroller oradadır.
  const label = liveMatch ? (onMatchScreen ? 'Maç Oynanıyor' : 'Maça Dön') : isMatchDay ? 'Maça Çık' : othersPlay ? 'Günün Maçları' : 'Devam';

  return (
    <nav className="navbar">
      {/* Yalnızca dar ekranda görünür (sol menü çekmece olur) */}
      <button className="icon-btn menu-toggle" onClick={onMenu} title="Menü" aria-label="Menü">☰</button>
      <div className="nav-arrows">
        <button className="icon-btn" onClick={back} disabled={!canBack} title="Geri">
          ◀
        </button>
        <button className="icon-btn" onClick={forward} disabled={!canForward} title="İleri">
          ▶
        </button>
      </div>
      <div className={`nav-status${isMatchDay ? ' matchday' : ''}`}>{statusText(world)}</div>
      <button className="btn-continue" onClick={advance} disabled={(liveMatch !== null && onMatchScreen) || world.gameOver !== null}>
        {label}
        <span className="btn-continue-arrow">›</span>
      </button>
    </nav>
  );
}
