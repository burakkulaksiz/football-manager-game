import { useEffect } from 'react';
import { hasUnsavedProgress, useGameStore, type ScreenId } from '../../store/gameStore';
import { GameOverOverlay } from '../components/GameOverOverlay';
import { AcademyScreen } from '../screens/AcademyScreen';
import { ClubInfoScreen } from '../screens/ClubInfoScreen';
import { DynamicsScreen } from '../screens/DynamicsScreen';
import { FinanceScreen } from '../screens/FinanceScreen';
import { InternationalScreen } from '../screens/InternationalScreen';
import { ManagerScreen } from '../screens/ManagerScreen';
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
import { StatusBar } from './StatusBar';

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
    default: return <PlaceholderScreen screen={screen} />;
  }
}

/** Kariyer açıkken ana yerleşim: başlık + gezinme çubuğu + sol menü + çim zemin + alt çubuk. */
export function GameShell() {
  const screen = useGameStore((s) => s.screen);
  const playerId = useGameStore((s) => s.selectedPlayerId);
  const fixtureId = useGameStore((s) => s.selectedFixtureId);
  const unsaved = useGameStore(hasUnsavedProgress);

  // Kaydedilmemiş ilerleme varken sekme kapatılır/yenilenirse tarayıcı uyarsın.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  return (
    <div className="shell">
      <Header />
      <NavBar />
      <div className="shell-body">
        <Sidebar />
        {/* key: sayfa değişince içerik yeniden kurulur, kaydırma en üste döner */}
        <main className="content pitch-bg" key={`${screen}-${playerId ?? ''}-${fixtureId ?? ''}`}>
          <ScreenContent screen={screen} />
        </main>
      </div>
      <StatusBar />
      <GameOverOverlay />
    </div>
  );
}
