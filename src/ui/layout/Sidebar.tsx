import { getClub, nextFixtureFor } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { formatDayMonth } from '../labels';
import { MENU } from '../screens';

/** Sol menünün altındaki yeşil kart: sıradaki maç. */
function NextMatchCard() {
  const world = useWorld();
  const next = nextFixtureFor(world, world.playerClubId);
  if (!next) {
    return <div className="next-card"><div className="next-card-title">Sezon tamamlandı</div></div>;
  }
  const home = getClub(world, next.homeId);
  const away = getClub(world, next.awayId);
  return (
    <div className="next-card">
      <div className="next-card-title">Sıradaki Maç · {next.round}. Hafta</div>
      <div className="next-card-teams">
        <ClubBadge club={home} size={28} />
        <span className="next-card-vs">v</span>
        <ClubBadge club={away} size={28} />
      </div>
      <div className="next-card-names">
        {home.shortName} – {away.shortName}
      </div>
      <div className="next-card-date">{formatDayMonth(next.date)}</div>
    </div>
  );
}

export function Sidebar() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  // Oyuncu profili açıkken "Kadro" vurgulu kalsın.
  const isActive = (id: string) => id === screen || (screen === 'player' && id === 'squad');

  return (
    <aside className="sidebar">
      <nav className="sidebar-menu">
        {MENU.map((group) => (
          <div key={group.title} className="menu-group">
            <div className="menu-group-title">{group.title}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`menu-item${isActive(item.id) ? ' active' : ''}`}
                onClick={() => setScreen(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-actions">
        <NextMatchCard />
        <button className="action-link" onClick={quitToMenu}>
          Ana Menü
        </button>
      </div>
    </aside>
  );
}
