import { useGameStore, type ScreenId } from '../../store/gameStore';
import { ClubInfoScreen } from '../screens/ClubInfoScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { PlayerProfile } from '../screens/PlayerProfile';
import { SquadScreen } from '../screens/SquadScreen';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

function ScreenContent({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case 'squad': return <SquadScreen />;
    case 'player': return <PlayerProfile />;
    case 'club': return <ClubInfoScreen />;
    default: return <PlaceholderScreen screen={screen} />;
  }
}

/** Kariyer açıkken ana yerleşim: üst bar + sol menü + içerik alanı. */
export function GameShell() {
  const screen = useGameStore((s) => s.screen);
  return (
    <div className="shell">
      <TopBar />
      <div className="shell-body">
        <Sidebar />
        <main className="content">
          <ScreenContent screen={screen} />
        </main>
      </div>
    </div>
  );
}
