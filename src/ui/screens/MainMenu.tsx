import { useEffect, useState } from 'react';
import type { SaveSlot } from '../../persistence/db';
import { listSaves } from '../../persistence/saves';
import { useGameStore } from '../../store/gameStore';
import { formatSavedAt } from '../components/SaveDialogs';
import { SettingsPanel } from '../components/SettingsPanel';

export function MainMenu() {
  const openNewGame = useGameStore((s) => s.openNewGame);
  const openLoadGame = useGameStore((s) => s.openLoadGame);
  const loadSave = useGameStore((s) => s.loadSave);
  // null = okunuyor, 'error' = veritabanı açılamadı
  const [saves, setSaves] = useState<SaveSlot[] | null | 'error'>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    listSaves()
      .then(setSaves)
      .catch(() => setSaves('error'));
  }, []);

  const latest = Array.isArray(saves) ? saves[0] : undefined;

  if (settingsOpen) {
    return (
      <div className="splash-settings pitch-bg">
        <div className="splash-settings-bar">
          <h1 className="splash-settings-title">Ayarlar</h1>
          <button className="btn" onClick={() => setSettingsOpen(false)}>‹ Ana Menü</button>
        </div>
        <SettingsPanel />
      </div>
    );
  }

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
              {latest.liveMatch && <div className="save-live">Maç ortasında: {latest.liveMatch}</div>}
            </div>
          )}
          <button className={latest ? 'btn btn-wide' : 'btn-continue btn-wide'} onClick={openNewGame}>
            Yeni Oyun {!latest && <span className="btn-continue-arrow">›</span>}
          </button>
          <button className="btn btn-wide" disabled={!latest} onClick={openLoadGame}>
            Kayıt Yükle
          </button>
          <button className="btn btn-wide" onClick={() => setSettingsOpen(true)}>
            Ayarlar
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
