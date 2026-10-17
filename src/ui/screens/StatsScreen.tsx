import { cleanSheets, computeStandings, getClub, topScorers } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';

export function StatsScreen() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const fixtures = world.season.fixtures;
  const scorers = topScorers(fixtures, 20);
  const teams = computeStandings(world.clubs.map((c) => c.id), fixtures).sort(
    (a, b) => b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst,
  );

  return (
    <div className="two-columns">
      <section className="panel">
        <h2 className="panel-title">Gol Krallığı</h2>
        {scorers.length === 0 ? (
          <div className="panel-body muted">Henüz gol atılmadı.</div>
        ) : (
          <table className="data-table clickable">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Oyuncu</th>
                <th>Kulüp</th>
                <th className="num">Gol</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, i) => {
                const player = world.players[s.playerId];
                const club = getClub(world, s.clubId);
                return (
                  <tr key={s.playerId} onClick={() => openPlayer(s.playerId)}>
                    <td className="num">{i + 1}</td>
                    <td className="strong">{player ? `${player.firstName} ${player.lastName}` : '?'}</td>
                    <td>
                      <span className="club-cell">
                        <ClubBadge club={club} size={16} /> {club.name}
                      </span>
                    </td>
                    <td className="num strong">{s.goals}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Takım İstatistikleri</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Kulüp</th>
              <th className="num">O</th>
              <th className="num">Attığı</th>
              <th className="num">Yediği</th>
              <th className="num">Maç Başı Gol</th>
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
  );
}
