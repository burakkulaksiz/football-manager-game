import {
  CUP_NAME,
  CUP_ROUNDS,
  cupFixtures,
  cupParticipants,
  cupRoundDate,
  cupRoundName,
  cupStatus,
  FINAL_ROUND,
  fixtureWinner,
  formatMinute,
  getClub,
  isCupFixture,
  scoreLine,
  type Fixture,
  type GameWorld,
  type Outcome,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { OutcomeBox } from '../components/OutcomeBox';
import { formatDateShort, formatDayMonth } from '../labels';

const ROUNDS = 34;

function outcomeFor(f: Fixture, clubId: string): Outcome | null {
  if (!f.result) return null;
  // Penaltılarla biten kupa maçı: turu geçen kazanmış sayılır
  if (f.result.penalties) return fixtureWinner(f) === clubId ? 'W' : 'L';
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
  const openReport = useGameStore((s) => s.openReport);
  const clubId = world.playerClubId;
  const fixtures = world.season.fixtures
    .filter((f) => f.homeId === clubId || f.awayId === clubId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return (
    <table className="data-table clickable">
      <thead>
        <tr>
          <th>Maç</th>
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
            <tr key={f.id} className={isCupFixture(f) ? 'cup-row' : undefined} onClick={() => (f.result ? openReport(f.id) : setFixturesView(isCupFixture(f) ? 'cup' : 'round', f.round))}>
              <td>{isCupFixture(f) ? <span className="cup-tag">Kupa · {cupRoundName(f.round)}</span> : `${f.round}. Hafta`}</td>
              <td>{formatDateShort(f.date)}</td>
              <td className="strong">
                <span className="club-cell">
                  <ClubBadge club={opponent} size={16} /> {opponent.name}
                </span>
              </td>
              <td>{isCupFixture(f) && f.round === FINAL_ROUND ? 'Tarafsız' : home ? 'İç saha' : 'Deplasman'}</td>
              <td className="num strong">{scoreLine(f)}</td>
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
  const openReport = useGameStore((s) => s.openReport);
  const fixtures = world.season.fixtures.filter((f) => f.round === round && !isCupFixture(f));
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
              <tr
                key={f.id}
                className={`${ours ? 'own-row' : ''}${f.result ? ' clickable-row' : ''}`}
                title={f.result ? 'Maç raporu' : undefined}
                onClick={() => f.result && openReport(f.id)}
              >
                <td className="right">
                  <div className="strong">{home.name}</div>
                  <div className="scorers">{scorerText(world, f, f.homeId)}</div>
                </td>
                <td className="score">
                  {f.result ? scoreLine(f) : 'v'}
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

/** Kulübümüzün kupadaki durumu (tek satır). */
function cupStatusText(world: GameWorld): string {
  const status = cupStatus(world, world.playerClubId);
  if (!status) {
    const first = cupFixtures(world, 1).length > 0;
    return first ? '1. Turu bay geçtik; Son 16 kurasını bekliyoruz.' : '1. Tur kurası maçtan iki hafta önce çekilecek.';
  }
  if (status.champion) return 'Kupayı kazandık!';
  if (status.eliminated) return `${cupRoundName(status.round)} turunda elendik.`;
  const fixture = cupFixtures(world, status.round).find((f) => f.homeId === world.playerClubId || f.awayId === world.playerClubId);
  return fixture?.result ? `${cupRoundName(status.round)} geçildi; sıradaki tur kurası bekleniyor.` : `${cupRoundName(status.round)} turundayız.`;
}

/** Türkiye Kupası: turlar, eşleşmeler, sonuçlar (penaltılarla). */
function CupFixtures() {
  const world = useWorld();
  const openReport = useGameStore((s) => s.openReport);
  const firstRound = cupFixtures(world, 1);
  const byes = firstRound.length > 0
    ? cupParticipants(world).filter((id) => !firstRound.some((f) => f.homeId === id || f.awayId === id))
    : [];

  return (
    <div className="cup-view">
      <div className="cup-status">{cupStatusText(world)}</div>
      {CUP_ROUNDS.map((r, i) => {
        const round = i + 1;
        const fixtures = cupFixtures(world, round);
        const date = fixtures[0]?.date ?? cupRoundDate(world.season.year, round);
        return (
          <div key={r.name} className="cup-round">
            <div className="sub-head">
              {r.name} <span className="muted">· {formatDayMonth(date)}{fixtures.length === 0 ? ' (kura bekleniyor)' : ''}</span>
            </div>
            {fixtures.length > 0 && (
              <table className="data-table round-table">
                <tbody>
                  {fixtures.map((f) => {
                    const home = getClub(world, f.homeId);
                    const away = getClub(world, f.awayId);
                    const winner = fixtureWinner(f);
                    const ours = f.homeId === world.playerClubId || f.awayId === world.playerClubId;
                    return (
                      <tr
                        key={f.id}
                        className={`${ours ? 'own-row' : ''}${f.result ? ' clickable-row' : ''}`}
                        title={f.result ? 'Maç raporu' : undefined}
                        onClick={() => f.result && openReport(f.id)}
                      >
                        <td className={`right${winner === f.homeId ? ' strong' : ''}${winner && winner !== f.homeId ? ' muted' : ''}`}>{home.name}</td>
                        <td className="score">{f.result ? scoreLine(f) : 'v'}</td>
                        <td className={`${winner === f.awayId ? 'strong' : ''}${winner && winner !== f.awayId ? ' muted' : ''}`}>{away.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {round === 1 && byes.length > 0 && (
              <div className="cup-byes muted">Bay geçenler (Son 16'dan başlar): {byes.map((id) => getClub(world, id).name).join(', ')}</div>
            )}
          </div>
        );
      })}
    </div>
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
          <button className={`tab${tab === 'cup' ? ' active' : ''}`} onClick={() => setFixturesView('cup')}>
            {CUP_NAME}
          </button>
        </span>
      </div>
      {tab === 'club' ? <ClubFixtures /> : tab === 'cup' ? <CupFixtures /> : <RoundFixtures />}
    </section>
  );
}
