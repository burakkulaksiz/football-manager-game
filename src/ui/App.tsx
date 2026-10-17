import { useGameStore } from '../store/gameStore';
import { GameShell } from './layout/GameShell';
import { MainMenu } from './screens/MainMenu';

export function App() {
  const phase = useGameStore((s) => s.phase);
  return phase === 'menu' ? <MainMenu /> : <GameShell />;
}
