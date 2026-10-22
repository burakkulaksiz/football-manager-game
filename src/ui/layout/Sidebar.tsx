import { useState } from 'react';
import { getClub, nextFixtureFor, shortFixtureLabel, unreadCount } from '../../engine';
import { hasUnsavedProgress, useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { QuitDialog, SaveDialog } from '../components/SaveDialogs';
import { formatDayMonth } from '../labels';
import { MENU } from '../screens';
import { actionableOffers } from '../screens/TransferScreen';

/** Sol menünün altındaki yeşil kart: sıradaki maç. */
function NextMatchCard() {
  const world = useWorld();
  const next = nextFixtureFor(world, world.playerClubId);
  if (!next) {
    return (
      <div className="next-card">
        <div className="next-card-title">Sezon arası</div>
        <div className="next-card-date">Yeni sezon 1 Temmuz</div>
      </div>
    );
  }
  const home = getClub(world, next.homeId);
  const away = getClub(world, next.awayId);
  return (
    <div className="next-card">
      <div className="next-card-title">Sıradaki Maç · {shortFixtureLabel(next)}</div>
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
  const liveMatch = useGameStore((s) => s.liveMatch);
  const unsaved = useGameStore(hasUnsavedProgress);
  const world = useWorld();
  // Transfer Merkezi rozeti: yanıt bekleyen teklifler
  const pendingActions = actionableOffers(world.offers, world.playerClubId);
  const unread = unreadCount(world);
  const [dialog, setDialog] = useState<'save' | 'quit' | null>(null);
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
                {item.id === 'transfers' && pendingActions > 0 && <span className="menu-badge">{pendingActions}</span>}
                {item.id === 'inbox' && unread > 0 && <span className="menu-badge inbox-badge">{unread}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-actions">
        <NextMatchCard />
        <div className="action-row">
          <button
            className="action-link"
            onClick={() => setDialog('save')}
            disabled={liveMatch !== null}
            title={liveMatch ? 'Maç sürerken kayıt yapılamaz' : unsaved ? 'Kaydedilmemiş ilerleme var' : 'Tüm ilerleme kayıtlı'}
          >
            Kaydet{unsaved && !liveMatch && <i className="unsaved-dot" />}
          </button>
          <button className="action-link" onClick={() => setDialog('quit')}>
            Ana Menü
          </button>
        </div>
      </div>
      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
      {dialog === 'quit' && <QuitDialog onClose={() => setDialog(null)} />}
    </aside>
  );
}
