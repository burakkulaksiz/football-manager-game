import {
  careerTotals,
  currentSeasonRows,
  getClub,
  seasonLabel,
  type CareerMove,
  type CareerSeason,
  type MoveKind,
  type Player,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from './ClubBadge';
import { formatDateShort, formatMoney, ratingClass } from '../labels';

const MOVE_LABELS: Record<MoveKind, string> = {
  transfer: 'Transfer',
  free: 'Serbest imza',
  loan: 'Kiralık',
  loanEnd: 'Kiralık dönüşü',
  release: 'Serbest bırakıldı',
  promoted: "U19'dan A takıma",
};

function ClubCell({ clubId }: { clubId: string | null }) {
  const world = useWorld();
  const setViewedClub = useGameStore((s) => s.setViewedClub);
  const setScreen = useGameStore((s) => s.setScreen);
  if (!clubId) return <span className="muted">—</span>;
  const club = getClub(world, clubId);
  return (
    <button
      className="link-button club-cell"
      title={`${club.name} kadrosu`}
      onClick={() => {
        setViewedClub(club.id);
        setScreen('squad');
      }}
    >
      <ClubBadge club={club} size={16} /> {club.name}
    </button>
  );
}

function StatCells({ s }: { s: Pick<CareerSeason, 'apps' | 'starts' | 'goals' | 'assists' | 'manOfTheMatch' | 'yellow' | 'red' | 'avgRating'> }) {
  const dash = (n: number) => (s.apps === 0 ? '—' : n);
  return (
    <>
      <td className="num">{s.apps === 0 ? '—' : `${s.starts}${s.apps > s.starts ? ` (${s.apps - s.starts})` : ''}`}</td>
      <td className="num">{dash(s.goals)}</td>
      <td className="num">{dash(s.assists)}</td>
      <td className="num">{dash(s.manOfTheMatch)}</td>
      <td className="num">{dash(s.yellow)}</td>
      <td className="num">{dash(s.red)}</td>
      <td className="num">{s.avgRating === null ? '—' : <span className={ratingClass(s.avgRating)}>{s.avgRating.toFixed(2)}</span>}</td>
    </>
  );
}

/** Kariyer istatistikleri: geçmiş sezonlar (kulüp başına), bu sezon (canlı) ve toplam. */
export function CareerPanel({ player }: { player: Player }) {
  const world = useWorld();
  const current = currentSeasonRows(world, player);
  const past = [...(player.career ?? [])].sort((a, b) => b.year - a.year);
  const rows: (CareerSeason & { live?: boolean })[] = [...current.map((r) => ({ ...r, live: true })), ...past];
  const total = careerTotals(rows);

  return (
    <section className="panel">
      <h2 className="panel-title">Kariyer</h2>
      {rows.length === 0 ? (
        <div className="panel-body muted">Henüz Süper Lig maçına çıkmadı.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Sezon</th>
              <th>Kulüp</th>
              <th className="num">Maç</th>
              <th className="num">Gol</th>
              <th className="num">Asist</th>
              <th className="num">MA</th>
              <th className="num">Sarı</th>
              <th className="num">Kırmızı</th>
              <th className="num">Ort. Puan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.year}-${r.clubId}`}>
                <td>
                  {seasonLabel(r.year)}
                  {r.live && <span className="tag">bu sezon</span>}
                </td>
                <td>
                  <ClubCell clubId={r.clubId} />
                  {r.loan && <span className="tag">Kiralık</span>}
                </td>
                <StatCells s={r} />
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="total-row">
                <td className="strong" colSpan={2}>Toplam</td>
                <StatCells s={total} />
              </tr>
            )}
          </tbody>
        </table>
      )}
      <div className="panel-note">
        Süper Lig maçları. Maç: ilk 11 (oyuna sonradan girdiği) · MA: maçın adamı. Geçmiş oyunun başladığı sezondan itibaren tutulur.
      </div>
    </section>
  );
}

/** Kulüp geçmişi: transferler, kiralıklar, serbest kalma, U19'dan yükselme (en yeni üstte). */
export function MovesPanel({ player }: { player: Player }) {
  const moves: CareerMove[] = [...(player.moves ?? [])].reverse();
  return (
    <section className="panel">
      <h2 className="panel-title">Kulüp Geçmişi</h2>
      {moves.length === 0 ? (
        <div className="panel-body muted">Oyun başından beri kulüp değiştirmedi.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Hareket</th>
              <th>Nereden</th>
              <th>Nereye</th>
              <th className="num">Bedel</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m, i) => (
              <tr key={i}>
                <td>{formatDateShort(m.date)}</td>
                <td>{MOVE_LABELS[m.kind]}</td>
                <td><ClubCell clubId={m.kind === 'free' ? null : m.fromClubId} /></td>
                <td><ClubCell clubId={m.kind === 'release' ? null : m.toClubId} /></td>
                <td className="num">{m.kind === 'transfer' || m.kind === 'loan' ? (m.fee > 0 ? formatMoney(m.fee) : 'Bedelsiz') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
