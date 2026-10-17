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
    <div className="main-menu">
      <div className="panel main-menu-box">
        <h1 className="panel-title main-menu-title">Futbol Menajeri — Türkiye Süper Ligi</h1>
        <div className="main-menu-buttons">
          <button className="btn btn-large" onClick={openNewGame}>
            Yeni Oyun
          </button>
          <button className="btn btn-large" disabled title="6. aşamada eklenecek">
            Kayıt Yükle
          </button>
        </div>
        <div className="main-menu-footer">
          {saveCount === null && 'Kayıtlar okunuyor…'}
          {saveCount === -1 && 'Kayıt veritabanı açılamadı!'}
          {saveCount !== null && saveCount >= 0 && `Kayıtlı oyun: ${saveCount}`}
        </div>
      </div>
    </div>
  );
}
