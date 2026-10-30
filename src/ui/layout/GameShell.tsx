import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hasUnsavedProgress, useGameStore, type ScreenId } from '../../store/gameStore';
import { DecisionsDialog } from '../components/DecisionsDialog';
import { GameOverOverlay } from '../components/GameOverOverlay';
import { NewsAlert } from '../components/NewsAlert';
import { ShortcutsDialog } from '../components/ShortcutList';
import { useGlobalHotkeys } from '../hotkeys';
import { AcademyScreen } from '../screens/AcademyScreen';
import { ClubInfoScreen } from '../screens/ClubInfoScreen';
import { DynamicsScreen } from '../screens/DynamicsScreen';
import { FinanceScreen } from '../screens/FinanceScreen';
import { InternationalScreen } from '../screens/InternationalScreen';
import { ManagerScreen } from '../screens/ManagerScreen';
import { FacilitiesScreen } from '../screens/FacilitiesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { JobsScreen } from '../screens/JobsScreen';
import { UNEMPLOYED_SCREENS } from '../screens';
import { FixturesScreen } from '../screens/FixturesScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { MatchReportScreen } from '../screens/MatchReportScreen';
import { MatchScreen } from '../screens/MatchScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { PlayerProfile } from '../screens/PlayerProfile';
import { SquadScreen } from '../screens/SquadScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { TableScreen } from '../screens/TableScreen';
import { TacticsScreen } from '../screens/TacticsScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { TransferScreen } from '../screens/TransferScreen';
import { Header } from './Header';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';

function ScreenContent({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case 'inbox': return <InboxScreen />;
    case 'squad': return <SquadScreen />;
    case 'player': return <PlayerProfile />;
    case 'club': return <ClubInfoScreen />;
    case 'fixtures': return <FixturesScreen />;
    case 'table': return <TableScreen />;
    case 'stats': return <StatsScreen />;
    case 'match': return <MatchScreen />;
    case 'report': return <MatchReportScreen />;
    case 'tactics': return <TacticsScreen />;
    case 'training': return <TrainingScreen />;
    case 'academy': return <AcademyScreen />;
    case 'dynamics': return <DynamicsScreen />;
    case 'transfers': return <TransferScreen />;
    case 'finance': return <FinanceScreen />;
    case 'international': return <InternationalScreen />;
    case 'manager': return <ManagerScreen />;
    case 'facilities': return <FacilitiesScreen />;
    case 'settings': return <SettingsScreen />;
    case 'jobs': return <JobsScreen />;
    default: return <PlaceholderScreen screen={screen} />;
  }
}

/** Kariyer açıkken ana yerleşim: başlık + gezinme çubuğu + sol menü + çim zemin + alt çubuk. */
export function GameShell() {
  const screen = useGameStore((s) => s.screen);
  const playerId = useGameStore((s) => s.selectedPlayerId);
  const fixtureId = useGameStore((s) => s.selectedFixtureId);
  const unsaved = useGameStore(hasUnsavedProgress);
  const warnUnsaved = useGameStore((s) => s.settings.warnUnsaved);
  const unemployed = useGameStore((s) => s.world?.unemployed != null);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const [helpOpen, setHelpOpen] = useState(false);
  // Dar ekranda sol menü açılır çekmece; sayfa değişince kapanır
  const [menuOpen, setMenuOpen] = useState(false);
  useGlobalHotkeys(() => setHelpOpen(true));
  const pageKey = `${screen}-${playerId ?? ''}-${fixtureId ?? ''}`;
  useEffect(() => setMenuOpen(false), [pageKey]);
  // Geri / ileri dönüşte sayfanın kaydırma konumu geri gelir (geçmişteki yer + sayfa başına)
  const mainRef = useRef<HTMLElement>(null);
  const scrolls = useRef(new Map<string, number>());
  const scrollKey = `${historyIndex}:${pageKey}`;
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (main) main.scrollTop = scrolls.current.get(scrollKey) ?? 0;
  }, [scrollKey]);

  // Kaydedilmemiş ilerleme varken sekme kapatılır/yenilenirse tarayıcı uyarsın.
  useEffect(() => {
    if (!unsaved || !warnUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved, warnUnsaved]);

  return (
    <div className="shell">
      <Header />
      <NavBar onMenu={() => setMenuOpen(!menuOpen)} />
      <div className="shell-body">
        <Sidebar open={menuOpen} />
        {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
        {/* key: sayfa değişince içerik yeniden kurulur; kaydırma yeni sayfada en üstte, geri dönüşte eski yerinde */}
        <main
          className="content pitch-bg"
          key={pageKey}
          ref={mainRef}
          onScroll={(e) => scrolls.current.set(scrollKey, e.currentTarget.scrollTop)}
        >
          {/* İşsizken kulüp ekranları açılmaz: İş Merkezi */}
          <ScreenContent screen={unemployed && !UNEMPLOYED_SCREENS.has(screen) ? 'jobs' : screen} />
        </main>
      </div>
      <GameOverOverlay />
      <NewsAlert />
      <DecisionsDialog />
      {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
