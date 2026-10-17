import { useEffect, useState } from 'react';
import {
  displayMinute,
  formatMinute,
  getClub,
  MAX_SUBS,
  primaryPosition,
  type GameWorld,
  type MatchState,
  type Side,
} from '../../engine';
import { useGameStore, userSide, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { FormationPicker, InstructionsPanel } from '../components/InstructionsPanel';
import { MatchStatRows } from '../components/MatchStatRows';
import { MENTALITY_LABELS, POSITION_LABELS, positionGroup, ratingClass } from '../labels';

/** Dakika başına bekleme süresi (ms). */
const SPEEDS = [
  { label: 'Yavaş', ms: 1000 },
  { label: 'Normal', ms: 450 },
  { label: 'Hızlı', ms: 150 },
  { label: 'Çok Hızlı', ms: 40 },
];

function clockText(match: MatchState): string {
  switch (match.period) {
    case 'pre': return 'Başlama';
    case 'half': return 'Devre Arası';
    case 'full': return 'Maç Sonu';
    default: {
      const { minute, extra } = displayMinute(match);
      return formatMinute(minute, extra);
    }
  }
}

/** Tabela altındaki golcü listesi: "Yılmaz 23', 67' (P)" */
function scorerLines(world: GameWorld, match: MatchState, side: Side): string[] {
  const clubId = match[side].clubId;
  const byPlayer = new Map<number, string[]>();
  for (const g of match.goals) {
    if (g.clubId !== clubId) continue;
    const label = formatMinute(g.minute, g.extra) + (g.kind === 'penalty' ? ' (P)' : '');
    byPlayer.set(g.playerId, [...(byPlayer.get(g.playerId) ?? []), label]);
  }
  return [...byPlayer.entries()].map(([id, mins]) => `${world.players[id]?.lastName ?? '?'} ${mins.join(', ')}`);
}

function Scoreboard({ match }: { match: MatchState }) {
  const world = useWorld();
  const home = getClub(world, match.home.clubId);
  const away = getClub(world, match.away.clubId);
  const live = match.period === 'first' || match.period === 'second';

  return (
    <div className="scoreboard">
      <div className="sb-side">
        <div className="sb-team" style={{ background: home.colors.primary, color: home.colors.secondary }}>
          <ClubBadge club={home} size={30} />
          <span>{home.name}</span>
        </div>
        <div className="sb-scorers">{scorerLines(world, match, 'home').map((l) => <div key={l}>{l}</div>)}</div>
      </div>
      <div className="sb-center">
        <div className="sb-score">
          {match.score.home}<span className="sb-dash">–</span>{match.score.away}
        </div>
        <div className={`sb-clock${live ? ' live' : ''}`}>{clockText(match)}</div>
      </div>
      <div className="sb-side right">
        <div className="sb-team" style={{ background: away.colors.primary, color: away.colors.secondary }}>
          <span>{away.name}</span>
          <ClubBadge club={away} size={30} />
        </div>
        <div className="sb-scorers">{scorerLines(world, match, 'away').map((l) => <div key={l}>{l}</div>)}</div>
      </div>
    </div>
  );
}

/** FM'deki "Son 5 dk" çubuğu gibi: son dakikalarda hangi takım atak yaptı. */
function MomentumBar({ match }: { match: MatchState }) {
  const world = useWorld();
  const homeColor = getClub(world, match.home.clubId).colors.primary;
  const awayColor = getClub(world, match.away.clubId).colors.primary;
  const cells = Array.from({ length: 10 }, (_, i) => match.momentum[match.momentum.length - 10 + i]);
  return (
    <div className="momentum">
      <span className="momentum-label">Son 10 dk</span>
      <div className="momentum-cells">
        {cells.map((m, i) => (
          <i
            key={i}
            style={{ background: m === 1 ? homeColor : m === -1 ? awayColor : undefined }}
            className={m === undefined ? 'empty' : ''}
          />
        ))}
      </div>
    </div>
  );
}

function StatsPanel({ match }: { match: MatchState }) {
  const totalTicks = match.possessionTicks.home + match.possessionTicks.away;
  const possHome = totalTicks === 0 ? 50 : Math.round((match.possessionTicks.home / totalTicks) * 100);
  return (
    <section className="panel">
      <h2 className="panel-title">İstatistikler</h2>
      <MatchStatRows
        home={{ ...match.home.counters, possession: possHome }}
        away={{ ...match.away.counters, possession: 100 - possHome }}
      />
    </section>
  );
}

function Commentary({ match }: { match: MatchState }) {
  const events = [...match.events].reverse();
  return (
    <section className="panel">
      <h2 className="panel-title">Anlatım</h2>
      <div className="commentary">
        {events.length === 0 && <div className="muted commentary-empty">Maç henüz başlamadı.</div>}
        {events.map((e, i) => (
          <div key={match.events.length - i} className={`ev ev-${e.type}${e.side ? ` ev-${e.side}` : ''}`}>
            <span className="ev-minute">{e.type === 'kickoff' ? '' : formatMinute(e.minute, e.extra)}</span>
            <span className="ev-text">{e.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamPanel({ match, side }: { match: MatchState; side: Side }) {
  const world = useWorld();
  const liveSubstitute = useGameStore((s) => s.liveSubstitute);
  const team = match[side];
  const club = getClub(world, team.clubId);
  const isUser = userSide(match, world) === side;
  const canSub = isUser && match.period !== 'full' && team.subsUsed < MAX_SUBS;
  const [selectedOut, setSelectedOut] = useState<number | null>(null);

  // Oyundan çıkanlar ve atılanlar (sahada değil ama oynadı)
  const departed = Object.values(match.players).filter(
    (ps) => ps.side === side && ps.minuteIn !== null && ps.slot === null,
  );

  const icons = (id: number) => {
    const ps = match.players[id]!;
    return (
      <span className="ev-icons">
        {Array.from({ length: ps.goals }, (_, i) => <span key={i} className="ico-goal" title="Gol">⚽</span>)}
        {ps.yellow && !ps.red && <span className="ico-card yellow" title="Sarı kart" />}
        {ps.red && <span className="ico-card red" title="Kırmızı kart" />}
        {ps.injured && <span className="ico-injury" title="Sakat">✚</span>}
      </span>
    );
  };

  return (
    <section className="panel team-panel">
      <h2 className="panel-title panel-title-row">
        <span className="club-cell">
          <ClubBadge club={club} size={20} /> {club.name}
        </span>
        <span className="title-extra">Değişiklik {team.subsUsed}/{MAX_SUBS}</span>
      </h2>
      <div className="lineup">
        {team.onPitch.map((id) => {
          const ps = match.players[id]!;
          const p = world.players[id]!;
          const selected = selectedOut === id;
          return (
            <div
              key={id}
              className={`lu-row${canSub ? ' clickable' : ''}${selected ? ' selected' : ''}`}
              onClick={() => canSub && setSelectedOut(selected ? null : id)}
            >
              <span className={`pos-box pos-${positionGroup(ps.slot!)}`}>{POSITION_LABELS[ps.slot!]}</span>
              <span className="lu-name">{p.lastName}</span>
              {icons(id)}
              <span className="cond-bar" title={`Kondisyon %${Math.round(ps.condition)}`}>
                <i style={{ width: `${ps.condition}%` }} className={ps.condition < 65 ? 'low' : ''} />
              </span>
              <span className={ratingClass(ps.rating)}>{match.period === 'pre' ? '–' : ps.rating.toFixed(1)}</span>
            </div>
          );
        })}

        {departed.length > 0 && <div className="sub-head sub-head-gap">Oyundan Çıkanlar</div>}
        {departed.map((ps) => (
          <div key={ps.playerId} className="lu-row departed">
            <span className="pos-box">{ps.red ? 'KRM' : 'ÇKT'}</span>
            <span className="lu-name">{world.players[ps.playerId]!.lastName}</span>
            {icons(ps.playerId)}
            <span className="lu-minute">{ps.minuteOut}'</span>
            <span className={ratingClass(ps.rating)}>{ps.rating.toFixed(1)}</span>
          </div>
        ))}

        <div className="sub-head sub-head-gap">Yedekler</div>
        {isUser && canSub && (
          <div className="lu-hint">
            {selectedOut === null ? 'Değişiklik için önce sahadaki oyuncuyu seç.' : 'Şimdi oyuna girecek yedeği seç.'}
          </div>
        )}
        {team.bench.map((id) => {
          const p = world.players[id]!;
          const pos = primaryPosition(p);
          const active = canSub && selectedOut !== null;
          return (
            <div
              key={id}
              className={`lu-row bench${active ? ' clickable target' : ''}`}
              onClick={() => {
                if (active && liveSubstitute(selectedOut, id)) setSelectedOut(null);
              }}
            >
              <span className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>
              <span className="lu-name">{p.lastName}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Controls({ match, running, setRunning, speed, setSpeed, showTactics, setShowTactics }: {
  match: MatchState;
  running: boolean;
  setRunning: (r: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  showTactics: boolean;
  setShowTactics: (v: boolean) => void;
}) {
  const world = useWorld();
  const step = useGameStore((s) => s.stepLiveMatch);
  const instant = useGameStore((s) => s.liveInstantFinish);
  const finish = useGameStore((s) => s.finishLiveMatch);
  const mySide = userSide(match, world);
  const myTeam = match[mySide];

  const start = () => {
    // Başlama ve devre arası bir adımla geçilir, sonra dakikalar akar.
    if (match.period === 'pre' || match.period === 'half') step();
    setRunning(true);
  };

  return (
    <div className="match-controls">
      {match.period === 'full' ? (
        <button className="btn-continue" onClick={finish}>
          Maçı Bitir <span className="btn-continue-arrow">›</span>
        </button>
      ) : running ? (
        <button className="btn btn-play" onClick={() => setRunning(false)}>❚❚ Duraklat</button>
      ) : (
        <button className="btn-continue" onClick={start}>
          {match.period === 'pre' ? 'Maçı Başlat' : match.period === 'half' ? 'İkinci Yarı' : 'Devam Et'}
          <span className="btn-continue-arrow">›</span>
        </button>
      )}

      <div className="tabs" role="group" aria-label="Maç hızı">
        {SPEEDS.map((s, i) => (
          <button key={s.label} className={`tab${speed === i ? ' active' : ''}`} onClick={() => setSpeed(i)}>
            {s.label}
          </button>
        ))}
      </div>

      <button
        className={`btn tactics-toggle${showTactics ? ' active' : ''}`}
        disabled={match.period === 'full'}
        onClick={() => setShowTactics(!showTactics)}
        title="Diziliş ve takım talimatları"
      >
        Taktik: {myTeam.formation} · {MENTALITY_LABELS[myTeam.instructions.mentality]} {showTactics ? '▴' : '▾'}
      </button>

      <button
        className="btn"
        disabled={match.period === 'full'}
        onClick={() => {
          setRunning(false);
          instant();
        }}
        title="Kalan dakikalar anında oynanır; değişiklikleri yapay zekâ yapar"
      >
        Anında Sonuçlandır
      </button>
    </div>
  );
}

/** Maç içi taktik paneli: diziliş ve talimatlar anında uygulanır. */
function LiveTactics({ match }: { match: MatchState }) {
  const world = useWorld();
  const change = useGameStore((s) => s.liveChangeTactics);
  const team = match[userSide(match, world)];
  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Taktik Değişikliği</span>
        <FormationPicker value={team.formation} onChange={(formation) => change({ formation })} />
      </div>
      <div className="panel-body">
        <InstructionsPanel instructions={team.instructions} onChange={(instructions) => change({ instructions })} />
        <div className="panel-note">
          Diziliş değişince sahadaki oyuncular yeni mevkilere en uygun şekilde dağıtılır. Değişiklikler hemen etkili olur.
        </div>
      </div>
    </section>
  );
}

export function MatchScreen() {
  const match = useGameStore((s) => s.liveMatch);
  const step = useGameStore((s) => s.stepLiveMatch);
  const refreshPreMatch = useGameStore((s) => s.refreshPreMatch);
  const world = useWorld();
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTactics, setShowTactics] = useState(false);
  const period = match?.period;

  // Başlama öncesi Taktik ekranına gidilip dönüldüyse maçı güncel kadroyla yeniden kur.
  useEffect(() => {
    refreshPreMatch();
  }, [refreshPreMatch]);

  // Saat: çalışırken her tikte bir dakika. Devre arası ve maç sonunda kendiliğinden durur.
  useEffect(() => {
    if (!running) return;
    if (period === 'half' || period === 'full') {
      setRunning(false);
      return;
    }
    const timer = setInterval(step, SPEEDS[speed]!.ms);
    return () => clearInterval(timer);
  }, [running, speed, period, step]);

  if (!match) {
    return (
      <section className="panel">
        <h2 className="panel-title">Maç</h2>
        <div className="panel-body muted">Şu an oynanan bir maç yok.</div>
      </section>
    );
  }

  const motm =
    match.period === 'full'
      ? Object.values(match.players).filter((p) => p.minuteIn !== null).sort((a, b) => b.rating - a.rating)[0]
      : undefined;

  return (
    <div className="match-screen">
      <Scoreboard match={match} />
      <MomentumBar match={match} />
      <Controls
        match={match}
        running={running}
        setRunning={setRunning}
        speed={speed}
        setSpeed={setSpeed}
        showTactics={showTactics}
        setShowTactics={setShowTactics}
      />
      {showTactics && match.period !== 'full' && <LiveTactics match={match} />}
      {match.period === 'pre' && (
        <div className="motm">
          Kadro ve taktik, Taktik ekranındaki ayarlarından geliyor. Değiştirmek için sol menüden Taktik&apos;e gidip geri dönebilirsin.
        </div>
      )}
      {motm && (
        <div className="motm">
          Maçın Adamı: <strong>{world.players[motm.playerId]!.firstName} {world.players[motm.playerId]!.lastName}</strong>{' '}
          <span className={ratingClass(motm.rating)}>{motm.rating.toFixed(1)}</span>
        </div>
      )}
      {match.period === 'half' && <div className="motm">Devre arası — oyuncu değişikliği ve taktik değişikliği yapabilirsin.</div>}
      <div className="match-grid">
        <TeamPanel match={match} side="home" />
        <div className="match-center">
          <StatsPanel match={match} />
          <Commentary match={match} />
        </div>
        <TeamPanel match={match} side="away" />
      </div>
    </div>
  );
}
