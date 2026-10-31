import { activeForeignLeagues, FOREIGN_EUROPE_SLOTS, getClub, goalDifference, leagueName, leagueTable, lowerStandings, seasonLabel, userLeague } from '../../engine';
import { useUiState, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { OutcomeBox } from '../components/OutcomeBox';
import { TableCharts } from '../components/TableCharts';

/** Sıraya göre bölge: Avrupa kupaları ve küme düşme hattı (1. Lig'de ilk üç çıkar; yurtdışında ülke kontenjanı, küme düşme yok). */
function zoneClass(position: number, total: number, lower: boolean, league: string | undefined): string {
  if (lower) return position <= 3 ? 'zone-cl' : '';
  if (league !== undefined) {
    const [cl, el] = FOREIGN_EUROPE_SLOTS[league] ?? [0, 0];
    return position <= cl ? 'zone-cl' : position <= cl + el ? 'zone-el' : '';
  }
  if (position <= 2) return 'zone-cl';
  if (position <= 4) return 'zone-el';
  if (position > total - 3) return 'zone-rel';
  return '';
}

/** Sekme: 'table' Süper Lig, 'lower' 1. Lig, 'charts' grafikler, diğerleri yurtdışı liginin ülke kodu. */
export function TableScreen() {
  const world = useWorld();
  const own = userLeague(world);
  const [view, setView] = useUiState<string>('table.view', own ?? 'table');
  const tab = (key: string, label: string) => (
    <button key={key} className={`tab${view === key ? ' active' : ''}`} onClick={() => setView(key)}>{label}</button>
  );
  return (
    <div className="screen">
      <div className="tabs" role="tablist">
        {tab('table', 'Süper Lig')}
        {tab('lower', '1. Lig')}
        {activeForeignLeagues(world).map((l) => tab(l, leagueName(l)))}
        {tab('charts', 'Grafikler')}
      </div>
      {view === 'charts' ? <TableCharts /> : <StandingsTable lower={view === 'lower'} league={view === 'table' || view === 'lower' ? undefined : view} />}
    </div>
  );
}

function StandingsTable({ lower, league }: { lower: boolean; league: string | undefined }) {
  const world = useWorld();
  const table = lower ? lowerStandings(world) : leagueTable(world, league);

  if (lower && !world.season.lower) {
    return <section className="panel"><div className="panel-body muted">1. Lig bu sezon oynanmıyor (eski kayıt); gelecek sezondan itibaren oynanır.</div></section>;
  }
  return (
    <section className="panel">
      <h2 className="panel-title">Puan Durumu — {lower ? '1. Lig' : leagueName(league)} {seasonLabel(world.season.year)}</h2>
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
            const classes = [zoneClass(i + 1, table.length, lower, league), row.clubId === world.playerClubId ? 'own-row' : '']
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
      ) : league !== undefined ? (
        <div className="legend">
          <span><i className="zone-mark zone-cl" /> Şampiyonlar Ligi</span>
          <span><i className="zone-mark zone-el" /> Avrupa Ligi</span>
          <span className="muted">Küme düşme yok (alt ligler oyunda değil)</span>
        </div>
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
