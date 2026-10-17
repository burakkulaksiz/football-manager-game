import { useGameStore } from '../store/gameStore';
import { GameShell } from './layout/GameShell';
import { MainMenu } from './screens/MainMenu';
import { NewGameScreen } from './screens/NewGameScreen';

export function App() {
  const phase = useGameStore((s) => s.phase);
  if (phase === 'menu') return <MainMenu />;
  if (phase === 'newGame') return <NewGameScreen />;
  return <GameShell />;
}
