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

  const clubs = [...gameData.clubs].sort((a, b) => b.reputation - a.reputation);
  const selectedClub = clubs.find((c) => c.id === selected);

  return (
    <div className="new-game">
      <section className="panel">
        <h2 className="panel-title">Yeni Oyun — Kulüp Seçimi</h2>
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
                onDoubleClick={() => startNewGame(c.id)}
              >
                <td><ClubBadge club={c} size={18} /></td>
                <td className="strong">{c.name}</td>
                <td>{c.city}</td>
                <td>{c.stadium}</td>
                <td className="num">{formatNumber(c.capacity)}</td>
                <td className="num">{c.reputation}</td>
                <td className="num">{formatMoney(c.budget)}</td>
                <td className="num">{formatMoney(c.wageBudget)}</td>
                <td>{EXPECTATION_LABELS[c.fanExpectation]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="button-row">
        <button className="btn" onClick={quitToMenu}>
          ◀ Geri
        </button>
        <button
          className="btn btn-large"
          disabled={!selectedClub}
          onClick={() => selectedClub && startNewGame(selectedClub.id)}
        >
          {selectedClub ? `${selectedClub.name} ile Başla ▶` : 'Bir kulüp seç'}
        </button>
      </div>
    </div>
  );
}
