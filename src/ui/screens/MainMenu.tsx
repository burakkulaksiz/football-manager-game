import { useEffect, useState } from 'react';
import { db } from '../../persistence/db';
import { useGameStore } from '../../store/gameStore';

export function MainMenu() {
  const openNewGame = useGameStore((s) => s.openNewGame);
  // Dexie bağlantısını doğrulamak için kayıt sayısını gösteriyoruz.
  const [saveCount, setSaveCount] = useState<number | null>(null);

  useEffect(() => {
    db.saves
      .count()
      .then(setSaveCount)
      .catch(() => setSaveCount(-1));
  }, []);

  return (
    <div className="splash pitch-bg">
      <div className="splash-card">
        <div className="splash-kicker">Türkiye Süper Ligi</div>
        <h1 className="splash-title">Futbol Menajeri</h1>
        <div className="splash-buttons">
          <button className="btn-continue btn-wide" onClick={openNewGame}>
            Yeni Oyun <span className="btn-continue-arrow">›</span>
          </button>
          <button className="btn btn-wide" disabled title="6. aşamada eklenecek">
            Kayıt Yükle
          </button>
        </div>
        <div className="splash-footer">
          {saveCount === null && 'Kayıtlar okunuyor…'}
          {saveCount === -1 && 'Kayıt veritabanı açılamadı!'}
          {saveCount !== null && saveCount >= 0 && `Kayıtlı oyun: ${saveCount}`}
        </div>
      </div>
    </div>
  );
}
