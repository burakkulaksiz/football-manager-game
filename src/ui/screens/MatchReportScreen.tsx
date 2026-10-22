import {
  fixtureLabel,
  formatDateTR,
  formatMinute,
  getClub,
  isCupFixture,
  matchTimeline,
  primaryPosition,
  teamAppearances,
  type Fixture,
  type GameWorld,
  type TimelineEvent,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { readableText } from '../colors';
import { MatchMaps } from '../components/MatchMaps';
import { MatchStatRows } from '../components/MatchStatRows';
import { formatNumber, POSITION_LABELS, positionGroup, ratingClass } from '../labels';

const EVENT_TEXT: Record<TimelineEvent['kind'], string> = {
  goal: 'Gol',
  penalty: 'Penaltı golü',
  yellow: 'Sarı kart',
  red: 'Kırmızı kart',
  secondYellow: 'İkinci sarıdan kırmızı',
  injury: 'Sakatlandı',
};

function EventIcon({ kind }: { kind: TimelineEvent['kind'] }) {
  if (kind === 'goal' || kind === 'penalty') return <span className="ico-goal">⚽</span>;
  if (kind === 'injury') return <span className="ico-injury">✚</span>;
  return <span className={`ico-card ${kind === 'yellow' ? 'yellow' : 'red'}`} />;
}

function playerName(world: GameWorld, id: number | null | undefined): string {
  const p = id != null ? world.players[id] : undefined;
  return p ? `${p.firstName} ${p.lastName}` : '?';
}

/** Ortada dakika, solda ev sahibi, sağda deplasman olayları. */
function Timeline({ fixture }: { fixture: Fixture }) {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const events = matchTimeline(fixture.result!);

  const side = (e: TimelineEvent) => (
    <div className="tl-event">
      <EventIcon kind={e.kind} />
      <span>
        <button className="link-button strong" onClick={() => openPlayer(e.playerId)}>
          {playerName(world, e.playerId)}
        </button>
        <span className="tl-note">
          {EVENT_TEXT[e.kind]}
          {e.assistId != null && ` · asist ${playerName(world, e.assistId)}`}
        </span>
      </span>
    </div>
  );

  return (
    <section className="panel">
      <h2 className="panel-title">Maç Olayları</h2>
      <div className="panel-body timeline">
        {events.length === 0 && <div className="muted">Gol, kart ya da sakatlık olmadı.</div>}
        {events.map((e, i) => {
          const home = e.clubId === fixture.homeId;
          return (
            <div key={i} className="tl-row">
              <div className="tl-home">{home && side(e)}</div>
              <div className="tl-minute">{formatMinute(e.minute, e.extra)}</div>
              <div className="tl-away">{!home && side(e)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayerRatings({ fixture, clubId }: { fixture: Fixture; clubId: string }) {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const result = fixture.result!;
  const club = getClub(world, clubId);
  const apps = teamAppearances(result, clubId);
  const redIds = new Set(result.cards.filter((c) => c.type === 'red').map((c) => c.playerId));
  const yellowIds = new Set(result.cards.filter((c) => c.type === 'yellow').map((c) => c.playerId));
  const injuredIds = new Set(result.injuries.map((i) => i.playerId));

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="club-cell">
          <ClubBadge club={club} size={20} /> {club.name}
        </span>
      </h2>
      <table className="data-table clickable report-ratings">
        <thead>
          <tr>
            <th>Mevki</th>
            <th>Oyuncu</th>
            <th></th>
            <th className="num">Dk</th>
            <th className="num">G</th>
            <th className="num">A</th>
            <th className="num">Puan</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(({ record, minuteIn, minuteOut }, i) => {
            const p = world.players[record.playerId];
            const pos = p ? primaryPosition(p) : null;
            const motm = result.manOfTheMatch === record.playerId;
            const firstSub = minuteIn !== null && (i === 0 || apps[i - 1]!.minuteIn === null);
            return (
              <tr
                key={record.playerId}
                className={`${motm ? 'motm-row' : ''}${firstSub ? ' sub-start' : ''}`}
                onClick={() => p && openPlayer(p.id)}
              >
                <td>{pos && <span className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>}</td>
                <td className="strong">
                  {p ? `${p.firstName} ${p.lastName}` : '?'}
                  {motm && <span className="motm-star" title="Maçın Adamı">★</span>}
                </td>
                <td>
                  <span className="ev-icons">
                    {Array.from({ length: record.goals }, (_, k) => <span key={k} className="ico-goal">⚽</span>)}
                    {yellowIds.has(record.playerId) && !redIds.has(record.playerId) && <span className="ico-card yellow" />}
                    {redIds.has(record.playerId) && <span className="ico-card red" />}
                    {injuredIds.has(record.playerId) && <span className="ico-injury">✚</span>}
                    {minuteIn !== null && <span className="sub-in" title="Oyuna girdi">▲ {minuteIn}'</span>}
                    {minuteOut !== null && !redIds.has(record.playerId) && <span className="sub-out" title="Oyundan çıktı">▼ {minuteOut}'</span>}
                  </span>
                </td>
                <td className="num">{record.minutes}</td>
                <td className="num">{record.goals || ''}</td>
                <td className="num">{record.assists || ''}</td>
                <td className="num"><span className={ratingClass(record.rating)}>{record.rating.toFixed(1)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** Maç sonrası rapor: tabela, olaylar, istatistikler ve oyuncu puanları. */
export function MatchReportScreen() {
  const world = useWorld();
  const fixtureId = useGameStore((s) => s.selectedFixtureId);
  const setFixturesView = useGameStore((s) => s.setFixturesView);
  const setScreen = useGameStore((s) => s.setScreen);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const fixture = world.season.fixtures.find((f) => f.id === fixtureId);

  if (!fixture?.result) {
    return (
      <section className="panel">
        <h2 className="panel-title">Maç Raporu</h2>
        <div className="panel-body muted">Bu maçın raporu yok (maç oynanmamış ya da önceki sezona ait).</div>
      </section>
    );
  }

  const result = fixture.result;
  const home = getClub(world, fixture.homeId);
  const away = getClub(world, fixture.awayId);
  const motm = result.manOfTheMatch !== null ? world.players[result.manOfTheMatch] : undefined;
  const motmRecord = result.players.find((r) => r.playerId === result.manOfTheMatch);
  const scorers = (clubId: string) =>
    matchTimeline(result)
      .filter((e) => e.clubId === clubId && (e.kind === 'goal' || e.kind === 'penalty'))
      .map((e) => `${world.players[e.playerId]?.lastName ?? '?'} ${formatMinute(e.minute, e.extra)}${e.kind === 'penalty' ? ' (P)' : ''}`);

  const showRound = () => {
    setFixturesView(isCupFixture(fixture) ? 'cup' : 'round', fixture.round);
    setScreen('fixtures');
  };

  return (
    <div className="match-screen">
      <div className="scoreboard">
        <div className="sb-side">
          <div className="sb-team" style={{ background: home.colors.primary, color: readableText(home.colors.primary, home.colors.secondary) }}>
            <ClubBadge club={home} size={30} />
            <span>{home.name}</span>
          </div>
          <div className="sb-scorers">{scorers(home.id).map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
        <div className="sb-center">
          <div className="sb-score">
            {result.homeGoals}<span className="sb-dash">–</span>{result.awayGoals}
          </div>
          {result.penalties && <div className="sb-penalties">Penaltılar {result.penalties.home}-{result.penalties.away}</div>}
          <div className="sb-clock">Maç Sonu</div>
        </div>
        <div className="sb-side right">
          <div className="sb-team" style={{ background: away.colors.primary, color: readableText(away.colors.primary, away.colors.secondary) }}>
            <span>{away.name}</span>
            <ClubBadge club={away} size={30} />
          </div>
          <div className="sb-scorers">{scorers(away.id).map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
      </div>

      <div className="report-meta">
        <span>{formatDateTR(fixture.date)}</span>
        <span>{fixtureLabel(fixture)}</span>
        <span>{home.stadium}</span>
        {result.attendance !== undefined && <span>Seyirci: {formatNumber(result.attendance)}</span>}
      </div>

      <div className="report-actions">
        {motm && motmRecord ? (
          <div className="motm">
            Maçın Adamı:{' '}
            <button className="link-button strong" onClick={() => openPlayer(motm.id)}>
              {motm.firstName} {motm.lastName}
            </button>{' '}
            ({getClub(world, motmRecord.clubId).name}){' '}
            <span className={ratingClass(motmRecord.rating)}>{motmRecord.rating.toFixed(1)}</span>
          </div>
        ) : <div />}
        <button className="btn" onClick={() => setScreen('table')}>Puan Durumu</button>
        <button className="btn-continue" onClick={showRound}>
          Haftanın Sonuçları <span className="btn-continue-arrow">›</span>
        </button>
      </div>

      <div className="two-columns">
        <Timeline fixture={fixture} />
        <div className="column-stack">
          <section className="panel">
            <h2 className="panel-title">İstatistikler</h2>
            <MatchStatRows home={result.stats.home} away={result.stats.away} />
          </section>
          <section className="panel">
            <h2 className="panel-title">Şut ve Isı Haritası</h2>
            <MatchMaps shots={result.shots} timeline={result.timeline} home={home} away={away} nameOf={(id) => playerName(world, id)} />
          </section>
        </div>
      </div>

      <div className="two-columns">
        <PlayerRatings fixture={fixture} clubId={home.id} />
        <PlayerRatings fixture={fixture} clubId={away.id} />
      </div>
    </div>
  );
}
