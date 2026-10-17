import { useEffect, useState } from 'react';
import type { SaveSlot } from '../../persistence/db';
import { listSaves } from '../../persistence/saves';
import { useGameStore } from '../../store/gameStore';
import { formatSavedAt } from '../components/SaveDialogs';

export function MainMenu() {
  const openNewGame = useGameStore((s) => s.openNewGame);
  const openLoadGame = useGameStore((s) => s.openLoadGame);
  const loadSave = useGameStore((s) => s.loadSave);
  // null = okunuyor, 'error' = veritabanı açılamadı
  const [saves, setSaves] = useState<SaveSlot[] | null | 'error'>(null);

  useEffect(() => {
    listSaves()
      .then(setSaves)
      .catch(() => setSaves('error'));
  }, []);

  const latest = Array.isArray(saves) ? saves[0] : undefined;

  return (
    <div className="splash pitch-bg">
      <div className="splash-card">
        <div className="splash-kicker">Türkiye Süper Ligi</div>
        <h1 className="splash-title">Futbol Menajeri</h1>
        <div className="splash-buttons">
          {latest && (
            <button className="btn-continue btn-wide" onClick={() => void loadSave(latest.id)}>
              Devam Et <span className="btn-continue-arrow">›</span>
            </button>
          )}
          {latest && (
            <div className="splash-latest">
              {latest.managerName ? `${latest.managerName} · ` : ''}{latest.name} · {formatSavedAt(latest.updatedAt)}
            </div>
          )}
          <button className={latest ? 'btn btn-wide' : 'btn-continue btn-wide'} onClick={openNewGame}>
            Yeni Oyun {!latest && <span className="btn-continue-arrow">›</span>}
          </button>
          <button className="btn btn-wide" disabled={!latest} onClick={openLoadGame}>
            Kayıt Yükle
          </button>
        </div>
        <div className="splash-footer">
          {saves === null && 'Kayıtlar okunuyor…'}
          {saves === 'error' && 'Kayıt veritabanı açılamadı!'}
          {Array.isArray(saves) && `Kayıtlı oyun: ${saves.length}`}
        </div>
      </div>
    </div>
  );
}
