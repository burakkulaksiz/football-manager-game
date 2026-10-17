import { useGameStore } from '../../store/gameStore';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Kariyer açıkken ana yerleşim: üst bar + sol menü + içerik alanı. */
export function GameShell() {
  const screen = useGameStore((s) => s.screen);
  return (
    <div className="shell">
      <TopBar />
      <div className="shell-body">
        <Sidebar />
        <main className="content">
          <PlaceholderScreen screen={screen} />
        </main>
      </div>
    </div>
  );
}
