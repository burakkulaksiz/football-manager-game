import { useGameStore, type ScreenId } from '../../store/gameStore';
import { ClubInfoScreen } from '../screens/ClubInfoScreen';
import { FixturesScreen } from '../screens/FixturesScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { PlayerProfile } from '../screens/PlayerProfile';
import { SquadScreen } from '../screens/SquadScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { TableScreen } from '../screens/TableScreen';
import { Header } from './Header';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

function ScreenContent({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case 'squad': return <SquadScreen />;
    case 'player': return <PlayerProfile />;
    case 'club': return <ClubInfoScreen />;
    case 'fixtures': return <FixturesScreen />;
    case 'table': return <TableScreen />;
    case 'stats': return <StatsScreen />;
    default: return <PlaceholderScreen screen={screen} />;
  }
}

/** Kariyer açıkken ana yerleşim: başlık + gezinme çubuğu + sol menü + çim zemin + alt çubuk. */
export function GameShell() {
  const screen = useGameStore((s) => s.screen);
  const playerId = useGameStore((s) => s.selectedPlayerId);
  return (
    <div className="shell">
      <Header />
      <NavBar />
      <div className="shell-body">
        <Sidebar />
        {/* key: sayfa değişince içerik yeniden kurulur, kaydırma en üste döner */}
        <main className="content pitch-bg" key={`${screen}-${playerId ?? ''}`}>
          <ScreenContent screen={screen} />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
