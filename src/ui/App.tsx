import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { applyAppearance } from './appearance';
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

/** Görünüm ayarları (zemin, vurgu rengi, ölçek) sayfaya uygulanır; kulüp rengi vurgusu yönetilen kulübe göre. */
function useAppearance() {
  const settings = useGameStore((s) => s.settings);
  const colors = useGameStore((s) => s.world?.clubs.find((c) => c.id === s.world?.playerClubId)?.colors ?? null);
  const primary = colors?.primary ?? null;
  const secondary = colors?.secondary ?? null;
  useEffect(() => {
    applyAppearance(settings, primary && secondary ? { primary, secondary } : null);
  }, [settings, primary, secondary]);
}

export function App() {
  useAppearance();
  return (
    <>
      <Phase />
      <NoticeToast />
    </>
  );
}
