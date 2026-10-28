import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { applyAppearance } from './appearance';
import { careerMark, careerSound, sound, type CareerMark } from './sound';
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

/**
 * Maç dışı sesler: dünya her değiştiğinde önceki özetle karşılaştırılıp en büyük kariyer olayı çalınır. İlk tıklama / tuşta ses
 * bağlamı kurulur (tarayıcının oto-oynatma kuralı); "Tıklamalar dahil"de düğmeler hafifçe tıklar.
 */
function useSounds() {
  const settings = useGameStore((s) => s.settings);
  const world = useGameStore((s) => (s.phase === 'game' ? s.world : null));
  const mark = useRef<CareerMark | null>(null);
  useEffect(() => {
    if (!world) {
      mark.current = null;
      return;
    }
    const id = careerSound(mark.current, world, settings.mutedNews);
    mark.current = careerMark(world);
    if (id) sound.play(id, settings);
  }, [world]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      sound.unlock(settings);
      if (e.target instanceof Element && e.target.closest('button, a, [role="tab"]')) sound.play('click', settings);
    };
    const onKey = () => sound.unlock(settings);
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [settings]);
}

export function App() {
  useAppearance();
  useSounds();
  return (
    <>
      <Phase />
      <NoticeToast />
    </>
  );
}
