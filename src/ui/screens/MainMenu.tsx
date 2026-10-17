import { useEffect, useState } from 'react';
import { db } from '../../persistence/db';
import { useGameStore } from '../../store/gameStore';

export function MainMenu() {
  const startNewGame = useGameStore((s) => s.startNewGame);
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
      <div className="main-menu-box">
        <h1 className="main-menu-title">Futbol Menajeri</h1>
        <div className="main-menu-sub">Türkiye Süper Ligi</div>
        <button className="menu-button" onClick={startNewGame}>
          Yeni Oyun
        </button>
        <button className="menu-button" disabled title="6. aşamada eklenecek">
          Kayıt Yükle
        </button>
        <div className="main-menu-footer">
          {saveCount === null && 'Kayıtlar okunuyor…'}
          {saveCount === -1 && 'Kayıt veritabanı açılamadı!'}
          {saveCount !== null && saveCount >= 0 && `Kayıtlı oyun: ${saveCount}`}
        </div>
      </div>
    </div>
  );
}
