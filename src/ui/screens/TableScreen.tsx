import { computeStandings, getClub, goalDifference, leagueClubs, lowerStandings, seasonLabel } from '../../engine';
import { useUiState, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { OutcomeBox } from '../components/OutcomeBox';
import { TableCharts } from '../components/TableCharts';

/** Sıraya göre bölge: Avrupa kupaları ve küme düşme hattı (1. Lig'de ilk üç çıkar). */
function zoneClass(position: number, total: number, lower: boolean): string {
  if (lower) return position <= 3 ? 'zone-cl' : '';
  if (position <= 2) return 'zone-cl';
  if (position <= 4) return 'zone-el';
  if (position > total - 3) return 'zone-rel';
  return '';
}

export function TableScreen() {
  const [view, setView] = useUiState<'table' | 'lower' | 'charts'>('table.view', 'table');
  return (
    <div className="screen">
      <div className="tabs" role="tablist">
        <button className={`tab${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>Süper Lig</button>
        <button className={`tab${view === 'lower' ? ' active' : ''}`} onClick={() => setView('lower')}>1. Lig</button>
        <button className={`tab${view === 'charts' ? ' active' : ''}`} onClick={() => setView('charts')}>Grafikler</button>
      </div>
      {view === 'charts' ? <TableCharts /> : <StandingsTable lower={view === 'lower'} />}
    </div>
  );
}

function StandingsTable({ lower }: { lower: boolean }) {
  const world = useWorld();
  const table = lower ? lowerStandings(world) : computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);

  if (lower && !world.season.lower) {
    return <section className="panel"><div className="panel-body muted">1. Lig bu sezon oynanmıyor (eski kayıt); gelecek sezondan itibaren oynanır.</div></section>;
  }
  return (
    <section className="panel">
      <h2 className="panel-title">Puan Durumu — {lower ? '1. Lig' : 'Süper Lig'} {seasonLabel(world.season.year)}</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Kulüp</th>
            <th className="num">O</th>
            <th className="num">G</th>
            <th className="num">B</th>
            <th className="num">M</th>
            <th className="num">A</th>
            <th className="num">Y</th>
            <th className="num">AV</th>
            <th className="num">P</th>
            <th>Form</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const club = getClub(world, row.clubId);
            const gd = goalDifference(row);
            const classes = [zoneClass(i + 1, table.length, lower), row.clubId === world.playerClubId ? 'own-row' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <tr key={row.clubId} className={classes}>
                <td className="num"><span className="pos-box league-pos">{i + 1}</span></td>
                <td className="strong">
                  <span className="club-cell">
                    <ClubBadge club={club} size={16} /> {club.name}
                  </span>
                </td>
                <td className="num">{row.played}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.drawn}</td>
                <td className="num">{row.lost}</td>
                <td className="num">{row.goalsFor}</td>
                <td className="num">{row.goalsAgainst}</td>
                <td className="num">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="num value">{row.points}</td>
                <td>
                  <span className="form-boxes">
                    {row.form.map((o, k) => <OutcomeBox key={k} outcome={o} />)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {lower ? (
        <div className="legend"><span><i className="zone-mark zone-cl" /> Süper Lig&apos;e çıkış</span></div>
      ) : (
        <div className="legend">
          <span><i className="zone-mark zone-cl" /> Şampiyonlar Ligi</span>
          <span><i className="zone-mark zone-el" /> Avrupa Ligi (kupa şampiyonu da katılır)</span>
          <span><i className="zone-mark zone-rel" /> Küme düşme</span>
        </div>
      )}
    </section>
  );
}
