import { createPortal } from 'react-dom';
import { formatDateTR, getClub, seasonLabel } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';

/** Görevden alınınca kariyer biter: özet ve çıkış seçenekleri (kapatılamaz). */
export function GameOverOverlay() {
  const world = useWorld();
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const openLoadGame = useGameStore((s) => s.openLoadGame);
  const over = world.gameOver;
  if (!over) return null;
  const club = getClub(world, world.playerClubId);
  const seasons = world.history.filter((s) => s.userClubId === club.id);

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal panel gameover" role="alertdialog" aria-modal="true" aria-label="Görevine son verildi">
        <h2 className="panel-title">Görevine son verildi</h2>
        <div className="panel-body">
          <p className="gameover-reason">{over.reason}</p>
          <div className="kv"><span className="kv-label">Kulüp</span><span className="kv-value">{club.name}</span></div>
          <div className="kv"><span className="kv-label">Tarih</span><span className="kv-value">{formatDateTR(over.date)}</span></div>
          {seasons.map((s) => (
            <div key={s.year} className="kv">
              <span className="kv-label">{seasonLabel(s.year)}</span>
              <span className="kv-value">{s.userPosition}. sıra (hedef {s.targetPosition}.)</span>
            </div>
          ))}
          <div className="panel-note">Kariyerin burada sona erdi. Daha önceki bir kaydı yükleyerek devam edebilirsin.</div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={quitToMenu}>Ana Menü</button>
          <button
            className="btn-continue"
            onClick={() => {
              quitToMenu();
              openLoadGame();
            }}
          >
            Kayıt Yükle <span className="btn-continue-arrow">›</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
