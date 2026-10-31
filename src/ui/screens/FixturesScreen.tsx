import {
  activeForeignLeagues,
  aggregateScore,
  CUP_NAME,
  CUP_ROUNDS,
  cupFixtures,
  cupParticipants,
  cupRoundDate,
  cupRoundName,
  cupStatus,
  EUROPE,
  EUROPE_COMPETITIONS,
  EUROPE_FINAL,
  europeCompetitionOf,
  europeFixtures,
  FINAL_ROUND,
  fixtureWinner,
  formatMinute,
  getClub,
  goalDifference,
  GROUPS,
  groupTable,
  isCupFixture,
  leagueFixturesOf,
  leagueName,
  QUARTER_FIRST,
  QUARTER_SECOND,
  scoreLine,
  SEMI_FIRST,
  SEMI_SECOND,
  shortFixtureLabel,
  stageDate,
  tieWinner,
  turkishQualifiers,
  userLeague,
  type EuropeCompetition,
  type Fixture,
  type GameWorld,
  type Outcome,
} from '../../engine';
import { tabFor, useGameStore, useUiState, useWorld } from '../../store/gameStore';
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
            <tr key={f.id} onClick={() => (f.result ? openReport(f.id) : setFixturesView(tabFor(f.competition), f.round))}>
              <td>{f.competition ? <span className={`cup-tag ${f.competition}`}>{shortFixtureLabel(f)}</span> : `${f.round}. Hafta`}</td>
              <td>{formatDateShort(f.date)}</td>
              <td className="strong">
                <span className="club-cell">
                  <ClubBadge club={opponent} size={16} /> {opponent.name}
                </span>
              </td>
              <td>{(isCupFixture(f) && f.round === FINAL_ROUND) || (f.competition !== 'cup' && f.competition && f.round === EUROPE_FINAL) ? 'Tarafsız' : home ? 'İç saha' : 'Deplasman'}</td>
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
  // Lig: '' = Süper Lig, diğerleri yurtdışı liginin ülke kodu; varsayılan kullanıcının ligi
  const [league, setLeague] = useUiState<string>('fixtures.league', userLeague(world) ?? '');
  const leagueFx = leagueFixturesOf(world.season.fixtures, league || undefined);
  const rounds = leagueFx.reduce((max, f) => Math.max(max, f.round), 0) || ROUNDS;
  const fixtures = leagueFx.filter((f) => f.round === round);
  const go = (r: number) => setFixturesView('round', Math.max(1, Math.min(rounds, r)));

  return (
    <>
      <div className="round-nav">
        <select value={league} onChange={(e) => setLeague(e.target.value)} aria-label="Lig">
          {['', ...activeForeignLeagues(world)].map((l) => <option key={l} value={l}>{leagueName(l || undefined)}</option>)}
        </select>
        <button className="btn" disabled={round <= 1} onClick={() => go(round - 1)}>◀</button>
        <select value={round} onChange={(e) => go(Number(e.target.value))}>
          {Array.from({ length: rounds }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}. Hafta
            </option>
          ))}
        </select>
        <button className="btn" disabled={round >= rounds} onClick={() => go(round + 1)}>▶</button>
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

/** Avrupa grubu: puan tablosu (ilk iki çeyrek finale). */
function GroupTable({ comp, group }: { comp: EuropeCompetition; group: string }) {
  const world = useWorld();
  const rows = groupTable(world, comp, group);
  return (
    <div className="euro-group">
      <div className="sub-head">{group} Grubu</div>
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Kulüp</th>
            <th className="num">O</th>
            <th className="num">G</th>
            <th className="num">B</th>
            <th className="num">M</th>
            <th className="num">AV</th>
            <th className="num">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const club = getClub(world, r.clubId);
            const gd = goalDifference(r);
            return (
              <tr key={r.clubId} className={[i < 2 ? 'zone-cl' : '', r.clubId === world.playerClubId ? 'own-row' : ''].filter(Boolean).join(' ')}>
                <td className="strong">
                  <span className="club-cell"><ClubBadge club={club} size={14} /> {club.name}</span>
                </td>
                <td className="num">{r.played}</td>
                <td className="num">{r.won}</td>
                <td className="num">{r.drawn}</td>
                <td className="num">{r.lost}</td>
                <td className="num">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="num value">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Eleme aşaması: iki maçlı eşleşmeler (toplam skor) ya da final. */
function KnockoutStage({ comp, title, first, second }: { comp: EuropeCompetition; title: string; first: number; second?: number }) {
  const world = useWorld();
  const openReport = useGameStore((s) => s.openReport);
  const legs = europeFixtures(world, comp, first);
  if (legs.length === 0) return null;
  return (
    <div className="cup-round">
      <div className="sub-head">{title} <span className="muted">· {formatDayMonth(legs[0]!.date)}</span></div>
      <table className="data-table round-table">
        <tbody>
          {legs.map((leg) => {
            const rematch = second !== undefined
              ? europeFixtures(world, comp, second).find((f) => f.homeId === leg.awayId && f.awayId === leg.homeId)
              : undefined;
            const decider = rematch ?? leg;
            const winner = decider.result ? tieWinner(world, decider) : null;
            const agg = rematch ? aggregateScore(world, rematch) : null;
            const ours = leg.homeId === world.playerClubId || leg.awayId === world.playerClubId;
            const cls = (id: string) => (winner === id ? 'strong' : winner ? 'muted' : '');
            return (
              <tr key={leg.id} className={ours ? 'own-row' : undefined}>
                <td className={`right ${cls(leg.homeId)}`}>{getClub(world, leg.homeId).name}</td>
                <td className="score">
                  <span className={leg.result ? 'link' : undefined} onClick={() => leg.result && openReport(leg.id)}>{leg.result ? scoreLine(leg) : 'v'}</span>
                  {rematch && (
                    <div className="leg-line">
                      Rövanş{' '}
                      <span className={rematch.result ? 'link' : undefined} onClick={() => rematch.result && openReport(rematch.id)}>
                        {rematch.result ? scoreLine(rematch) : formatDayMonth(rematch.date)}
                      </span>
                      {agg && <> · Toplam {agg.away}-{agg.home}</>}
                    </div>
                  )}
                </td>
                <td className={cls(leg.awayId)}>{getClub(world, leg.awayId).name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Avrupa kupaları: grup tabloları ve eleme turları; varsayılan kendi kupamız. */
function EuropeFixtures() {
  const world = useWorld();
  const [comp, setComp] = useUiState<EuropeCompetition>('fixtures.europe', europeCompetitionOf(world, world.playerClubId) ?? 'cl');
  const info = EUROPE[comp];
  const drawn = europeFixtures(world, comp).length > 0;
  return (
    <div className="cup-view">
      <div className="tabs euro-tabs">
        {EUROPE_COMPETITIONS.map((c) => (
          <button key={c} className={`tab${c === comp ? ' active' : ''}`} onClick={() => setComp(c)}>{EUROPE[c].name}</button>
        ))}
      </div>
      {!drawn ? (
        <div className="cup-status">
          Grup kurası 25 Ağustos'ta çekilir; ilk maçlar {formatDayMonth(stageDate(world.season.year, comp, 1))}.
          {' '}Türkiye'den katılacaklar: {turkishQualifiers(world)[comp].map((id) => getClub(world, id).name).join(', ')}.
        </div>
      ) : (
        <>
          <div className="euro-groups">
            {GROUPS.map((g) => <GroupTable key={g} comp={comp} group={g} />)}
          </div>
          <KnockoutStage comp={comp} title="Çeyrek Final" first={QUARTER_FIRST} second={QUARTER_SECOND} />
          <KnockoutStage comp={comp} title="Yarı Final" first={SEMI_FIRST} second={SEMI_SECOND} />
          <KnockoutStage comp={comp} title={`Final (tarafsız saha)`} first={EUROPE_FINAL} />
          <div className="cup-byes muted">
            {info.name}: maçlar {comp === 'cl' ? 'salı' : 'perşembe'}; grupların ilk ikisi çeyrek finale çıkar; çeyrek ve yarı final iki maçlı (toplamda eşitlikte penaltılar).
          </div>
        </>
      )}
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
          <button className={`tab${tab === 'europe' ? ' active' : ''}`} onClick={() => setFixturesView('europe')}>
            Avrupa
          </button>
        </span>
      </div>
      {tab === 'club' ? <ClubFixtures /> : tab === 'cup' ? <CupFixtures /> : tab === 'europe' ? <EuropeFixtures /> : <RoundFixtures />}
    </section>
  );
}
