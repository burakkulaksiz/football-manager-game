import { useGameStore } from '../store/gameStore';
import { NoticeToast } from './components/NoticeToast';
import { GameShell } from './layout/GameShell';
import { LoadGameScreen } from './screens/LoadGameScreen';
import { MainMenu } from './screens/MainMenu';
import { NewGameScreen } from './screens/NewGameScreen';

function Phase() {
  const phase = useGameStore((s) => s.phase);
  if (phase === 'menu') return <MainMenu />;
  if (phase === 'newGame') return <NewGameScreen />;
  if (phase === 'load') return <LoadGameScreen />;
  return <GameShell />;
}

export function App() {
  return (
    <>
      <Phase />
      <NoticeToast />
    </>
  );
}
