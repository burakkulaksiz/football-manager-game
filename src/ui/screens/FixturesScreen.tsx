import { formatMinute, getClub, type Fixture, type GameWorld, type Outcome } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { OutcomeBox } from '../components/OutcomeBox';
import { formatDateShort, formatDayMonth } from '../labels';

const ROUNDS = 34;

function outcomeFor(f: Fixture, clubId: string): Outcome | null {
  if (!f.result) return null;
  const own = f.homeId === clubId ? f.result.homeGoals : f.result.awayGoals;
  const other = f.homeId === clubId ? f.result.awayGoals : f.result.homeGoals;
  return own > other ? 'W' : own === other ? 'D' : 'L';
}

/** "Ahmet Yılmaz 23', 67'" biçiminde golcü listesi. */
function scorerText(world: GameWorld, f: Fixture, clubId: string): string {
  const byPlayer = new Map<number, string[]>();
  for (const g of f.result?.goals ?? []) {
    if (g.clubId !== clubId) continue;
    const label = formatMinute(g.minute, g.extra) + (g.kind === 'penalty' ? ' (P)' : '');
    byPlayer.set(g.playerId, [...(byPlayer.get(g.playerId) ?? []), label]);
  }
  return [...byPlayer.entries()]
    .map(([id, minutes]) => `${world.players[id]?.lastName ?? '?'} ${minutes.join(', ')}`)
    .join('; ');
}

function ClubFixtures() {
  const world = useWorld();
  const setFixturesView = useGameStore((s) => s.setFixturesView);
  const clubId = world.playerClubId;
  const fixtures = world.season.fixtures
    .filter((f) => f.homeId === clubId || f.awayId === clubId)
    .sort((a, b) => a.round - b.round);

  return (
    <table className="data-table clickable">
      <thead>
        <tr>
          <th className="num">Hafta</th>
          <th>Tarih</th>
          <th>Rakip</th>
          <th>Saha</th>
          <th className="num">Skor</th>
          <th></th>
          <th>Gollerimiz</th>
        </tr>
      </thead>
      <tbody>
        {fixtures.map((f) => {
          const home = f.homeId === clubId;
          const opponent = getClub(world, home ? f.awayId : f.homeId);
          const outcome = outcomeFor(f, clubId);
          return (
            <tr key={f.id} onClick={() => setFixturesView('round', f.round)}>
              <td className="num">{f.round}</td>
              <td>{formatDateShort(f.date)}</td>
              <td className="strong">
                <span className="club-cell">
                  <ClubBadge club={opponent} size={16} /> {opponent.name}
                </span>
              </td>
              <td>{home ? 'İç saha' : 'Deplasman'}</td>
              <td className="num strong">{f.result ? `${f.result.homeGoals} - ${f.result.awayGoals}` : '—'}</td>
              <td>{outcome && <OutcomeBox outcome={outcome} />}</td>
              <td className="muted">{scorerText(world, f, clubId)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RoundFixtures() {
  const world = useWorld();
  const round = useGameStore((s) => s.fixturesRound);
  const setFixturesView = useGameStore((s) => s.setFixturesView);
  const fixtures = world.season.fixtures.filter((f) => f.round === round);
  const go = (r: number) => setFixturesView('round', Math.max(1, Math.min(ROUNDS, r)));

  return (
    <>
      <div className="round-nav">
        <button className="btn" disabled={round <= 1} onClick={() => go(round - 1)}>◀</button>
        <select value={round} onChange={(e) => go(Number(e.target.value))}>
          {Array.from({ length: ROUNDS }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}. Hafta
            </option>
          ))}
        </select>
        <button className="btn" disabled={round >= ROUNDS} onClick={() => go(round + 1)}>▶</button>
        <span className="round-date">{fixtures[0] && formatDayMonth(fixtures[0].date)}</span>
      </div>
      <table className="data-table round-table">
        <tbody>
          {fixtures.map((f) => {
            const home = getClub(world, f.homeId);
            const away = getClub(world, f.awayId);
            const ours = f.homeId === world.playerClubId || f.awayId === world.playerClubId;
            return (
              <tr key={f.id} className={ours ? 'own-row' : ''}>
                <td className="right">
                  <div className="strong">{home.name}</div>
                  <div className="scorers">{scorerText(world, f, f.homeId)}</div>
                </td>
                <td className="score">
                  {f.result ? `${f.result.homeGoals} - ${f.result.awayGoals}` : 'v'}
                </td>
                <td>
                  <div className="strong">{away.name}</div>
                  <div className="scorers">{scorerText(world, f, f.awayId)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

export function FixturesScreen() {
  const tab = useGameStore((s) => s.fixturesTab);
  const setFixturesView = useGameStore((s) => s.setFixturesView);

  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Fikstür & Sonuçlar</span>
        <span className="tabs">
          <button className={`tab${tab === 'club' ? ' active' : ''}`} onClick={() => setFixturesView('club')}>
            Kulübüm
          </button>
          <button className={`tab${tab === 'round' ? ' active' : ''}`} onClick={() => setFixturesView('round')}>
            Haftalar
          </button>
        </span>
      </div>
      {tab === 'club' ? <ClubFixtures /> : <RoundFixtures />}
    </section>
  );
}
