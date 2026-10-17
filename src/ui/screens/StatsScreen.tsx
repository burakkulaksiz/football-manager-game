import {
  cleanSheets,
  computeStandings,
  getClub,
  leagueClubs,
  seasonLabel,
  topAssists,
  topRatings,
  topScorers,
  type GameWorld,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { ratingClass } from '../labels';

interface LeaderItem {
  playerId: number;
  clubId: string;
  value: string | number;
  apps?: number;
}

/** Oyuncu sıralama tablosu (gol, asist, puan). */
function LeaderTable({ world, title, unit, rows, empty, ratings = false }: {
  world: GameWorld;
  title: string;
  unit: string;
  rows: LeaderItem[];
  empty: string;
  ratings?: boolean;
}) {
  const openPlayer = useGameStore((s) => s.openPlayer);
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      {rows.length === 0 ? (
        <div className="panel-body muted">{empty}</div>
      ) : (
        <table className="data-table clickable">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Oyuncu</th>
              <th>Kulüp</th>
              {rows[0]?.apps !== undefined && <th className="num">Maç</th>}
              <th className="num">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const player = world.players[r.playerId];
              const club = getClub(world, r.clubId);
              return (
                <tr key={r.playerId} onClick={() => openPlayer(r.playerId)}>
                  <td className="num">{i + 1}</td>
                  <td className="strong">{player ? `${player.firstName} ${player.lastName}` : '?'}</td>
                  <td>
                    <span className="club-cell">
                      <ClubBadge club={club} size={16} /> {club.name}
                    </span>
                  </td>
                  {r.apps !== undefined && <td className="num">{r.apps}</td>}
                  <td className="num value">
                    {ratings ? <span className={ratingClass(Number(r.value))}>{r.value}</span> : r.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function StatsScreen() {
  const world = useWorld();
  const fixtures = world.season.fixtures;
  const roundsPlayed = new Set(fixtures.filter((f) => f.result).map((f) => f.round)).size;
  // Puan sıralamasına girmek için oynanan haftaların en az üçte biri kadar maç gerekir.
  const minApps = Math.max(1, Math.ceil(roundsPlayed / 3));

  const scorers = topScorers(fixtures, 15).map((s) => ({ playerId: s.playerId, clubId: s.clubId, value: s.goals }));
  const assists = topAssists(fixtures, 15);
  const ratings = topRatings(fixtures, minApps, 15).map((r) => ({ ...r, value: r.value.toFixed(2) }));
  const teams = computeStandings(leagueClubs(world).map((c) => c.id), fixtures).sort(
    (a, b) => b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst,
  );
  const empty = 'Henüz maç oynanmadı.';

  return (
    <div className="screen">
      <div className="two-columns">
        <LeaderTable world={world} title="Gol Krallığı" unit="Gol" rows={scorers} empty={empty} />
        <LeaderTable world={world} title="Asist Krallığı" unit="Asist" rows={assists} empty={empty} />
      </div>
      <div className="two-columns">
        <LeaderTable
          world={world}
          title={`En Yüksek Puan Ortalaması (en az ${minApps} maç)`}
          unit="Ort."
          rows={ratings}
          empty={empty}
          ratings
        />
        <section className="panel">
          <h2 className="panel-title">Takım İstatistikleri</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Kulüp</th>
                <th className="num">O</th>
                <th className="num">Attığı</th>
                <th className="num">Yediği</th>
                <th className="num">Maç Başı</th>
                <th className="num">Gol Yemeden</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((row) => {
                const club = getClub(world, row.clubId);
                return (
                  <tr key={row.clubId} className={row.clubId === world.playerClubId ? 'own-row' : ''}>
                    <td className="strong">
                      <span className="club-cell">
                        <ClubBadge club={club} size={16} /> {club.name}
                      </span>
                    </td>
                    <td className="num">{row.played}</td>
                    <td className="num">{row.goalsFor}</td>
                    <td className="num">{row.goalsAgainst}</td>
                    <td className="num">
                      {row.played > 0
                        ? (row.goalsFor / row.played).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                        : '—'}
                    </td>
                    <td className="num">{cleanSheets(fixtures, row.clubId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
      <SeasonHistory world={world} />
    </div>
  );
}

/** Biten sezonların arşivi: şampiyon, sıramız, küme düşenler ve ödüller. */
function SeasonHistory({ world }: { world: GameWorld }) {
  const openPlayer = useGameStore((s) => s.openPlayer);
  const seasons = [...world.history].reverse();
  return (
    <section className="panel">
      <h2 className="panel-title">Geçmiş Sezonlar</h2>
      {seasons.length === 0 ? (
        <div className="panel-body muted">Henüz tamamlanmış sezon yok. Sezon sonunda şampiyon ve ödüller burada listelenir.</div>
      ) : (
        <div className="panel-body history-list">
          {seasons.map((s) => (
            <div key={s.year} className="history-season">
              <div className="sub-head">{seasonLabel(s.year)} — Şampiyon: {s.table[0]?.name}</div>
              <div className="kv">
                <span className="kv-label">{world.clubs.find((c) => c.id === s.userClubId)?.name ?? 'Kulübün'} sırası</span>
                <span className={`kv-value ${s.userPosition <= s.targetPosition ? 'pos' : 'neg'}`}>
                  {s.userPosition}. (hedef {s.targetPosition}.)
                </span>
              </div>
              <div className="kv"><span className="kv-label">Küme düşenler</span><span className="kv-value neg">{s.relegatedNames.join(', ')}</span></div>
              <div className="kv"><span className="kv-label">1. Lig'den çıkanlar</span><span className="kv-value">{s.promotedNames.join(', ')}</span></div>
              {s.awards.map((a) => (
                <div key={a.title} className="kv link" onClick={() => world.players[a.playerId] && openPlayer(a.playerId)}>
                  <span className="kv-label">{a.title}</span>
                  <span className="kv-value">{a.playerName} ({a.clubName}) · {a.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
