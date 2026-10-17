import { useState } from 'react';
import {
  ageOn,
  clubPlayers,
  confidenceLabel,
  formatDateTR,
  HOME_NATION,
  marketValue,
  MIN_ROUNDS_BEFORE_SACK,
  seasonLabel,
  userPosition,
  WARNING_CONFIDENCE,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { EXPECTATION_LABELS, formatMoney, formatNumber, formatSignedMoney } from '../labels';

/** Menajer kartı: ad (değiştirilebilir) ve kariyer kaydı. */
function ManagerCard() {
  const world = useWorld();
  const renameManager = useGameStore((s) => s.renameManager);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(world.manager.name);
  const m = world.manager;
  const played = m.won + m.drawn + m.lost;
  const save = () => {
    if (!draft.trim()) return;
    renameManager(draft);
    setEditing(false);
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Menajer</h2>
      <div className="panel-body">
        {editing ? (
          <div className="manager-name-row">
            <label className="field">
              Menajer adı
              <input
                autoFocus
                maxLength={40}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
            </label>
            <button className="btn" disabled={!draft.trim()} onClick={save}>Kaydet</button>
            <button className="btn" onClick={() => setEditing(false)}>Vazgeç</button>
          </div>
        ) : (
          <div className="club-header">
            <span className="club-header-name">{m.name}</span>
            <button className="btn btn-small" onClick={() => { setDraft(m.name); setEditing(true); }}>Adı Değiştir</button>
          </div>
        )}
        <div className="manager-record">
          <div><strong>{played}</strong><span>Maç</span></div>
          <div><strong>{m.won}</strong><span>Galibiyet</span></div>
          <div><strong>{m.drawn}</strong><span>Beraberlik</span></div>
          <div><strong>{m.lost}</strong><span>Mağlubiyet</span></div>
        </div>
        <div className="kv"><span className="kv-label">Göreve başlama</span><span className="kv-value">{formatDateTR(m.joined)}</span></div>
        <div className="kv"><span className="kv-label">Galibiyet yüzdesi</span><span className="kv-value">{played > 0 ? `%${Math.round((m.won / played) * 100)}` : '—'}</span></div>
        <div className="kv"><span className="kv-label">Lig şampiyonluğu</span><span className="kv-value">{m.titles}</span></div>
      </div>
    </section>
  );
}

export function ClubInfoScreen() {
  const world = useWorld();
  const club = world.clubs.find((c) => c.id === world.playerClubId)!;
  const players = clubPlayers(world, club.id);
  const fin = world.finances[club.id]!;

  const totalWages = players.reduce((s, p) => s + p.contract.wage, 0);
  const totalValue = players.reduce((s, p) => s + marketValue(p, world.date), 0);
  const avgAge = players.reduce((s, p) => s + ageOn(p.birthDate, world.date), 0) / players.length;
  const foreigners = players.filter((p) => p.nationality !== HOME_NATION).length;

  const clubRows: [string, string][] = [
    ['Şehir', club.city],
    ['Stadyum', `${club.stadium} (${formatNumber(club.capacity)} kişilik)`],
    ['İtibar', `${club.reputation} / 100`],
    ['Taraftar Beklentisi', EXPECTATION_LABELS[club.fanExpectation]],
    ['Kasa', formatSignedMoney(fin.balance)],
    ['Transfer Bütçesi', formatMoney(fin.transferBudget)],
    ['Maaş Bütçesi', `${formatMoney(fin.wageBudget)} / yıl`],
  ];
  const squadRows: [string, string][] = [
    ['Oyuncu Sayısı', String(players.length)],
    ['Yabancı Oyuncu', String(foreigners)],
    ['Yaş Ortalaması', avgAge.toLocaleString('tr-TR', { maximumFractionDigits: 1 })],
    ['Toplam Maaş', `${formatMoney(totalWages)} / yıl`],
    ['Maaş Bütçesi Kullanımı', `%${Math.round((totalWages / fin.wageBudget) * 100)}`],
    ['Kadro Değeri', formatMoney(totalValue)],
  ];

  const board = world.board;
  // Sezon başında (henüz maç oynanmadıysa) sıra anlamsız; sezon arasında geçen sezonun sırası.
  const playedAny = world.season.fixtures.some((f) => f.result && (f.homeId === club.id || f.awayId === club.id));
  const position = world.seasonState === 'ended'
    ? world.history[world.history.length - 1]?.userPosition
    : playedAny ? userPosition(world) : undefined;
  const pastSeasons = [...world.history].reverse();

  return (
    <div className="screen">
      <div className="two-columns">
        <ManagerCard />
        <section className="panel">
          <h2 className="panel-title">Yönetim</h2>
          <div className="panel-body">
            <div className="kv"><span className="kv-label">Beklenti</span><span className="kv-value">{EXPECTATION_LABELS[club.fanExpectation]}</span></div>
            <div className="kv"><span className="kv-label">Hedef sıra</span><span className="kv-value">{board.targetPosition}. veya daha iyi</span></div>
            <div className="kv"><span className="kv-label">Şu anki sıra</span><span className="kv-value">{position ? `${position}.` : '—'}</span></div>
            <div className="kv">
              <span className="kv-label">Yönetimin güveni</span>
              <span className={`kv-value ${board.confidence < WARNING_CONFIDENCE ? 'neg' : ''}`}>
                {confidenceLabel(board.confidence)} ({Math.round(board.confidence)}/100)
              </span>
            </div>
            <div className="usage-bar confidence-bar">
              <i style={{ width: `${board.confidence}%` }} className={board.confidence < WARNING_CONFIDENCE ? 'over' : ''} />
            </div>
            <div className="panel-note">
              Güven galibiyetlerle artar, yenilgilerle düşer; her ay sıralama hedefe göre değerlendirilir. Çok düşerse
              (sezonun ilk {MIN_ROUNDS_BEFORE_SACK} haftasından sonra) ya da takım küme düşerse görevine son verilir.
            </div>
          </div>
        </section>
      </div>
      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">Kulübün Geçmiş Sezonları</h2>
          {pastSeasons.length === 0 ? (
            <div className="panel-body muted">Henüz tamamlanmış sezon yok.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Sezon</th><th className="num">Sıra</th><th className="num">Hedef</th><th className="num">Puan</th></tr></thead>
              <tbody>
                {pastSeasons.map((s) => {
                  const row = s.table.find((r) => r.clubId === club.id);
                  const pos = s.table.findIndex((r) => r.clubId === club.id) + 1;
                  return (
                    <tr key={s.year}>
                      <td>{seasonLabel(s.year)}</td>
                      <td className={`num strong ${pos > 0 && pos <= s.targetPosition ? 'pos' : 'neg'}`}>{pos > 0 ? `${pos}.` : '1. Lig'}</td>
                      <td className="num">{s.userClubId === club.id ? `${s.targetPosition}.` : '—'}</td>
                      <td className="num">{row?.points ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel">
          <h2 className="panel-title">Kulüp Bilgisi</h2>
          <div className="panel-body">
            <div className="club-header">
              <ClubBadge club={club} size={48} />
              <span className="club-header-name">{club.name}</span>
            </div>
            <table className="info-table">
              <tbody>
                {clubRows.map(([k, v]) => (
                  <tr key={k}><th>{k}</th><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2 className="panel-title">Kadro Özeti</h2>
          <div className="panel-body">
            <table className="info-table">
              <tbody>
                {squadRows.map(([k, v]) => (
                  <tr key={k}><th>{k}</th><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
