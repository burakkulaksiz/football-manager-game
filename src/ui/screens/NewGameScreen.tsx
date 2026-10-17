import { useState } from 'react';
import { gameData } from '../../gameData';
import { useGameStore } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { EXPECTATION_LABELS, formatMoney, formatNumber } from '../labels';

/** Yeni oyun: yönetilecek kulübün seçimi. */
export function NewGameScreen() {
  const startNewGame = useGameStore((s) => s.startNewGame);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const [selected, setSelected] = useState<string | null>(null);
  const [managerName, setManagerName] = useState('');

  const clubs = [...gameData.clubs].sort((a, b) => b.reputation - a.reputation);
  const selectedClub = clubs.find((c) => c.id === selected);
  const nameOk = managerName.trim().length > 0;
  const start = (clubId: string) => nameOk && startNewGame(clubId, managerName);

  return (
    <div className="new-game pitch-bg">
      <div className="new-game-inner">
        <div className="splash-kicker">Yeni Oyun</div>
        <h1 className="splash-title small">Kulübünü Seç</h1>
        <div className="manager-name-row">
          <label className="field">
            Menajer adı
            <input
              autoFocus
              maxLength={40}
              placeholder="Adın ve soyadın"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </label>
        </div>
        <section className="panel">
          <h2 className="panel-title">Süper Lig Kulüpleri</h2>
          <table className="data-table clickable">
            <thead>
              <tr>
                <th></th>
                <th>Kulüp</th>
                <th>Şehir</th>
                <th>Stadyum</th>
                <th className="num">Kapasite</th>
                <th className="num">İtibar</th>
                <th className="num">Transfer Bütçesi</th>
                <th className="num">Maaş Bütçesi (yıllık)</th>
                <th>Beklenti</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr
                  key={c.id}
                  className={c.id === selected ? 'selected' : ''}
                  onClick={() => setSelected(c.id)}
                  onDoubleClick={() => start(c.id)}
                >
                  <td><ClubBadge club={c} size={18} /></td>
                  <td className="strong">{c.name}</td>
                  <td>{c.city}</td>
                  <td>{c.stadium}</td>
                  <td className="num">{formatNumber(c.capacity)}</td>
                  <td className="num">
                    <span className="rep-bar"><i style={{ width: `${c.reputation}%` }} /></span>
                    {c.reputation}
                  </td>
                  <td className="num value">{formatMoney(c.budget)}</td>
                  <td className="num value">{formatMoney(c.wageBudget)}</td>
                  <td>{EXPECTATION_LABELS[c.fanExpectation]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="button-row">
          <button className="btn" onClick={quitToMenu}>
            ‹ Ana Menü
          </button>
          <button
            className="btn-continue"
            disabled={!selectedClub || !nameOk}
            onClick={() => selectedClub && start(selectedClub.id)}
          >
            {!nameOk ? 'Menajer adını yaz' : selectedClub ? `${selectedClub.name} ile Başla` : 'Bir kulüp seç'}
            <span className="btn-continue-arrow">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
