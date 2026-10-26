import { useState } from 'react';
import { daysBetween, getClub, nextFixtureFor, shortFixtureLabel, UNEMPLOYMENT_LIMIT_DAYS, unreadCount } from '../../engine';
import { hasUnsavedProgress, useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { QuitDialog, SaveDialog } from '../components/SaveDialogs';
import { SCREEN_KEYS, useHotkeys } from '../hotkeys';
import { formatDayMonth } from '../labels';
import { MENU, UNEMPLOYED_SCREENS } from '../screens';
import { actionableOffers } from '../screens/TransferScreen';

/** Sol menünün altındaki yeşil kart: sıradaki maç. */
function NextMatchCard() {
  const world = useWorld();
  if (world.unemployed) {
    const left = Math.max(0, UNEMPLOYMENT_LIMIT_DAYS - daysBetween(world.unemployed.since, world.date));
    return (
      <div className="next-card">
        <div className="next-card-title">İşsiz</div>
        <div className="next-card-names">{(world.jobOffers ?? []).length} teklif</div>
        <div className="next-card-date">{left} gün içinde iş bul</div>
      </div>
    );
  }
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
  const quitConfirm = useGameStore((s) => s.settings.quitConfirm);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const hotkeys = useGameStore((s) => s.settings.hotkeys);
  useHotkeys((e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 's') return false;
    setDialog('save');
    return true;
  });
  // Oyuncu profili açıkken "Kadro" vurgulu kalsın.
  const isActive = (id: string) => id === screen || (screen === 'player' && id === 'squad');

  return (
    <aside className="sidebar">
      <nav className={`sidebar-menu${hotkeys ? ' hotkeys' : ''}`}>
        {MENU.map((group) => (
          <div key={group.title} className="menu-group">
            <div className="menu-group-title">{group.title}</div>
            {group.items.filter((item) => !world.unemployed || UNEMPLOYED_SCREENS.has(item.id)).map((item) => (
              <button
                key={item.id}
                className={`menu-item${isActive(item.id) ? ' active' : ''}`}
                onClick={() => setScreen(item.id)}
              >
                {item.label}
                {hotkeys && SCREEN_KEYS[item.id] && <kbd className="menu-key">{SCREEN_KEYS[item.id]!.toUpperCase()}</kbd>}
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
            title={unsaved ? (liveMatch ? 'Maç son kayıttan beri ilerledi; kayıt maçı bu dakikadan sürdürür' : 'Kaydedilmemiş ilerleme var') : 'Tüm ilerleme kayıtlı'}
          >
            Kaydet{unsaved && <i className="unsaved-dot" />}
          </button>
          <button
            className="action-link"
            onClick={() => {
              // Ayar: yalnızca kaydedilmemiş ilerleme varken sor
              if (quitConfirm === 'unsaved' && !unsaved) quitToMenu();
              else setDialog('quit');
            }}
          >
            Ana Menü
          </button>
        </div>
      </div>
      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
      {dialog === 'quit' && <QuitDialog onClose={() => setDialog(null)} />}
    </aside>
  );
}
