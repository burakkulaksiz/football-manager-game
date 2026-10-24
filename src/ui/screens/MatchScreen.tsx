import { useEffect, useRef, useState } from 'react';
import {
  displayMinute,
  formatMinute,
  formationName,
  getClub,
  LINEUP_ADVICE,
  MAX_SUBS,
  PLAN_LABELS,
  primaryPosition,
  type GameWorld,
  type MatchState,
  type Side,
} from '../../engine';
import { useGameStore, userSide, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { readableText } from '../colors';
import { FormationPicker, InstructionsPanel, PlanPicker, SetPieceStyles } from '../components/InstructionsPanel';
import { MatchStatRows } from '../components/MatchStatRows';
import { AssistantPanel } from '../components/AssistantPanel';
import { MatchMaps } from '../components/MatchMaps';
import { PitchView, type CameraMode } from '../components/PitchView';
import { buildScene, isHighlight, QUIET_MINUTE_MS, revealDelayMs, sceneDurationMs } from '../pitchScene';
import { MENTALITY_LABELS, POSITION_LABELS, positionGroup, ratingClass } from '../labels';

/**
 * Önemli an oynarken sonucu (skor, golcü, anlatım) erken göstermemek için anın öncesindeki durum.
 * Sahne sonuç karesine gelince açıklanır.
 */
interface Held {
  home: number;
  away: number;
  goals: number;
  events: number;
  /** Haritalar: o ana kadarki şutlar ve dakikalar. */
  shots: number;
  timeline: number;
}

function snapshot(m: MatchState): Held {
  return {
    home: m.score.home, away: m.score.away, goals: m.goals.length, events: m.events.length,
    shots: m.shots.length, timeline: m.timeline.length,
  };
}

/** Canlı haritalar (önemli an sürerken o anın şutu ve dakikası gizli). */
function LiveMaps({ match, held }: { match: MatchState; held: Held | null }) {
  const world = useWorld();
  // Motor şut listesini yerinde büyütür: her çizimde kopya (harita hesabı yeni listeyi görsün)
  const shots = match.shots.slice(0, held ? held.shots : match.shots.length);
  const timeline = held ? match.timeline.slice(0, held.timeline) : match.timeline;
  const name = (id: number) => {
    const p = world.players[id];
    return p ? `${p.firstName} ${p.lastName}` : '?';
  };
  return (
    <section className="panel">
      <h2 className="panel-title">Haritalar</h2>
      <MatchMaps
        shots={shots}
        timeline={timeline}
        home={getClub(world, match.home.clubId)}
        away={getClub(world, match.away.clubId)}
        nameOf={name}
        compact
      />
    </section>
  );
}

/** Gösterilecek olaylar: önemli an sürerken sonuç olayları gizli. */
const shownEvents = (match: MatchState, held: Held | null) => (held ? match.events.slice(0, held.events) : match.events);

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
function scorerLines(world: GameWorld, match: MatchState, side: Side, held: Held | null): string[] {
  const clubId = match[side].clubId;
  const byPlayer = new Map<number, string[]>();
  for (const g of held ? match.goals.slice(0, held.goals) : match.goals) {
    if (g.clubId !== clubId) continue;
    const label = formatMinute(g.minute, g.extra) + (g.kind === 'penalty' ? ' (P)' : '');
    byPlayer.set(g.playerId, [...(byPlayer.get(g.playerId) ?? []), label]);
  }
  return [...byPlayer.entries()].map(([id, mins]) => `${world.players[id]?.lastName ?? '?'} ${mins.join(', ')}`);
}

/** Gösterilen skor arttığında birkaç saniye true (gol anında skor parlasın). */
function useGoalFlash(total: number): boolean {
  const [flash, setFlash] = useState(false);
  const last = useRef(total);
  useEffect(() => {
    if (total <= last.current) {
      last.current = total;
      return;
    }
    last.current = total;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 2600);
    return () => clearTimeout(timer);
  }, [total]);
  return flash;
}

function Scoreboard({ match, held }: { match: MatchState; held: Held | null }) {
  const world = useWorld();
  const home = getClub(world, match.home.clubId);
  const away = getClub(world, match.away.clubId);
  const live = match.period === 'first' || match.period === 'second';
  const flash = useGoalFlash((held?.home ?? match.score.home) + (held?.away ?? match.score.away));

  return (
    <div className="scoreboard">
      <div className="sb-side">
        <div className="sb-team" style={{ background: home.colors.primary, color: readableText(home.colors.primary, home.colors.secondary) }}>
          <ClubBadge club={home} size={30} />
          <span>{home.name}</span>
        </div>
        <div className="sb-scorers">{scorerLines(world, match, 'home', held).map((l) => <div key={l}>{l}</div>)}</div>
      </div>
      <div className="sb-center">
        <div className={`sb-score${flash ? ' goal-flash' : ''}`}>
          {held?.home ?? match.score.home}<span className="sb-dash">–</span>{held?.away ?? match.score.away}
        </div>
        {match.aggregate && (
          <div className="sb-penalties">
            Toplam {(held?.home ?? match.score.home) + match.aggregate.home}-{(held?.away ?? match.score.away) + match.aggregate.away}
          </div>
        )}
        {match.penalties && !held && <div className="sb-penalties">Penaltılar {match.penalties.home}-{match.penalties.away}</div>}
        <div className={`sb-clock${live ? ' live' : ''}`}>{clockText(match)}</div>
      </div>
      <div className="sb-side right">
        <div className="sb-team" style={{ background: away.colors.primary, color: readableText(away.colors.primary, away.colors.secondary) }}>
          <span>{away.name}</span>
          <ClubBadge club={away} size={30} />
        </div>
        <div className="sb-scorers">{scorerLines(world, match, 'away', held).map((l) => <div key={l}>{l}</div>)}</div>
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

const PITCH_PREF_KEY = 'fm.showPitch';

/** Tercih tarayıcıda hatırlanır; depolama kapalıysa varsayılan açık. */
function readPitchPref(): boolean {
  try {
    return localStorage.getItem(PITCH_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Sahanın altında son olay (FM'deki yorum şeridi gibi). */
function EventBar({ match, held }: { match: MatchState; held: Held | null }) {
  const world = useWorld();
  // Önemli an oynarken: kimin atakta olduğu (sonuç sahnede görülecek)
  if (held && match.lastPlay) {
    const club = getClub(world, match[match.lastPlay.side].clubId);
    return (
      <div className="event-bar" style={{ borderLeftColor: club.colors.primary }}>
        <span className="ev-minute">{formatMinute(displayMinute(match).minute, displayMinute(match).extra)}</span>
        <span>{club.name} atakta…</span>
      </div>
    );
  }
  const last = [...shownEvents(match, held)].reverse().find((e) => e.type !== 'info');
  if (!last) return <div className="event-bar muted">Maç başlamadı.</div>;
  const club = last.side ? getClub(world, match[last.side].clubId) : null;
  return (
    <div
      className={`event-bar${last.type === 'goal' ? ' goal' : ''}`}
      style={club ? { borderLeftColor: club.colors.primary } : undefined}
    >
      <span className="ev-minute">{last.type === 'kickoff' ? '' : formatMinute(last.minute, last.extra)}</span>
      <span>{last.text}</span>
    </div>
  );
}

/** 2D saha açık/kapalı tercihi (tarayıcıda hatırlanır). */
function usePitchPref(): [boolean, () => void] {
  const [show, setShow] = useState(readPitchPref);
  const toggle = () => {
    setShow(!show);
    try {
      localStorage.setItem(PITCH_PREF_KEY, show ? '0' : '1');
    } catch {
      // depolama kapalı: tercih yalnızca bu oturumda geçerli
    }
  };
  return [show, toggle];
}

const CAMERA_PREF_KEY = 'fm.pitchCamera';

/** Kamera tercihi (tam saha / yakın) tarayıcıda hatırlanır. */
function useCameraPref(): [CameraMode, (mode: CameraMode) => void] {
  const [mode, setMode] = useState<CameraMode>(() => {
    try {
      return localStorage.getItem(CAMERA_PREF_KEY) === 'follow' ? 'follow' : 'full';
    } catch {
      return 'full';
    }
  });
  const change = (next: CameraMode) => {
    setMode(next);
    try {
      localStorage.setItem(CAMERA_PREF_KEY, next);
    } catch {
      // depolama kapalı: tercih yalnızca bu oturumda geçerli
    }
  };
  return [mode, change];
}

/** Tam ekranda tabela görünmez: sahanın üstünde skor, saat ve oynat/duraklat. */
function FullscreenBar({ match, held, running, onToggleRun, onExit }: {
  match: MatchState;
  held: Held | null;
  running: boolean;
  onToggleRun: () => void;
  onExit: () => void;
}) {
  const world = useWorld();
  const home = getClub(world, match.home.clubId);
  const away = getClub(world, match.away.clubId);
  const flash = useGoalFlash((held?.home ?? match.score.home) + (held?.away ?? match.score.away));
  return (
    <div className="fs-bar">
      <span className="fs-team" style={{ background: home.colors.primary, color: readableText(home.colors.primary, home.colors.secondary) }}>{home.name}</span>
      <span className={`fs-score${flash ? ' goal-flash' : ''}`}>{held?.home ?? match.score.home} – {held?.away ?? match.score.away}</span>
      <span className="fs-team" style={{ background: away.colors.primary, color: readableText(away.colors.primary, away.colors.secondary) }}>{away.name}</span>
      <span className="fs-clock">{clockText(match)}</span>
      {match.period !== 'full' && (
        <button className="btn btn-small" onClick={onToggleRun}>{running ? '❚❚ Duraklat' : '▶ Devam'}</button>
      )}
      <button className="btn btn-small" onClick={onExit} title="Tam ekrandan çık (Esc)">Küçült</button>
    </div>
  );
}

/** Saha paneli tam ekranda mı (tarayıcının tam ekran olayından). */
function useFullscreen(ref: React.RefObject<HTMLElement | null>): [boolean, () => void, () => void] {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(ref.current !== null && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [ref]);
  const enter = () => {
    ref.current?.requestFullscreen().catch(() => undefined);
  };
  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
  };
  return [fullscreen, enter, exit];
}

/** Kontrol satırındaki saha araçları: kamera, tam ekran, gizle. */
function PitchTools({ camera, setCamera, onFullscreen, onHide }: {
  camera: CameraMode;
  setCamera: (mode: CameraMode) => void;
  onFullscreen: () => void;
  onHide: () => void;
}) {
  return (
    <div className="pitch-tools">
      <span className="tabs" role="group" aria-label="Kamera">
        <button className={`tab${camera === 'full' ? ' active' : ''}`} onClick={() => setCamera('full')} title="Bütün saha">Tam saha</button>
        <button className={`tab${camera === 'follow' ? ' active' : ''}`} onClick={() => setCamera('follow')} title="Topu takip eden yakın görünüm">Yakın</button>
      </span>
      <button className="btn btn-small" onClick={onFullscreen} title="Sahayı tam ekran yap">⛶ Tam ekran</button>
      <button className="btn btn-small" onClick={onHide} title="2D sahayı gizle">Sahayı gizle</button>
    </div>
  );
}

function PitchPanel({ match, held, show, toggle, running, onToggleRun, camera, fullscreen, onExitFullscreen, panelRef }: {
  match: MatchState;
  held: Held | null;
  show: boolean;
  toggle: () => void;
  running: boolean;
  onToggleRun: () => void;
  camera: CameraMode;
  fullscreen: boolean;
  onExitFullscreen: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
}) {
  if (!show) {
    return (
      <section className="panel pitch-panel collapsed">
        <span className="pitch-panel-title">2D Saha</span>
        <button className="btn btn-small" onClick={toggle}>Göster</button>
      </section>
    );
  }
  return (
    <section className={`panel pitch-panel${fullscreen ? ' fullscreen' : ''}`} ref={panelRef}>
      {fullscreen && <FullscreenBar match={match} held={held} running={running} onToggleRun={onToggleRun} onExit={onExitFullscreen} />}
      <PitchView match={match} camera={camera} fullscreen={fullscreen} />
      <EventBar match={match} held={held} />
    </section>
  );
}

function Commentary({ match, held }: { match: MatchState; held: Held | null }) {
  const visible = shownEvents(match, held);
  const events = [...visible].reverse();
  return (
    <section className="panel">
      <h2 className="panel-title">Anlatım</h2>
      <div className="commentary">
        {events.length === 0 && <div className="muted commentary-empty">Maç henüz başlamadı.</div>}
        {events.map((e, i) => (
          <div key={visible.length - i} className={`ev ev-${e.type}${e.side ? ` ev-${e.side}` : ''}`}>
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

function Controls({ match, running, setRunning, showTactics, setShowTactics, extra }: {
  match: MatchState;
  running: boolean;
  setRunning: (r: boolean) => void;
  showTactics: boolean;
  setShowTactics: (v: boolean) => void;
  /** Satırın sağına eklenen araçlar (saha kamerası vb.). */
  extra?: React.ReactNode;
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

      <button
        className={`btn tactics-toggle${showTactics ? ' active' : ''}`}
        disabled={match.period === 'full'}
        onClick={() => setShowTactics(!showTactics)}
        title="Diziliş ve takım talimatları"
      >
        Taktik {PLAN_LABELS[myTeam.plan ?? 0]}: {formationName(myTeam)} · {MENTALITY_LABELS[myTeam.instructions.mentality]} {showTactics ? '▴' : '▾'}
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
      {extra}
    </div>
  );
}

/** Maç içi taktik paneli: taktik seti, diziliş ve talimatlar anında uygulanır. */
function LiveTactics({ match }: { match: MatchState }) {
  const world = useWorld();
  const change = useGameStore((s) => s.liveChangeTactics);
  const switchPlan = useGameStore((s) => s.liveSwitchPlan);
  const team = match[userSide(match, world)];
  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Taktik Değişikliği</span>
        <span className="toolbar">
          <span className="muted">Set</span>
          <PlanPicker value={team.plan ?? 0} onChange={switchPlan} />
        </span>
      </div>
      <div className="panel-body live-tactics-body">
        <FormationPicker value={team.formation} custom={team.custom} onChange={(formation) => change({ formation, custom: null })} />
        <InstructionsPanel instructions={team.instructions} onChange={(instructions) => change({ instructions })} />
        <div className="sub-head">Duran Toplar</div>
        <SetPieceStyles instructions={team.instructions} onChange={(instructions) => change({ instructions })} />
        <div className="panel-note">
          Taktik setine geçince o setin dizilişi, talimatları ve bireysel talimatları uygulanır (Taktik ekranında hazırlanır).
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
  const [showTactics, setShowTactics] = useState(false);
  const [showPitch, togglePitch] = usePitchPref();
  const [camera, setCamera] = useCameraPref();
  const pitchRef = useRef<HTMLElement>(null);
  const [fullscreen, enterFullscreen, exitFullscreen] = useFullscreen(pitchRef);
  const period = match?.period;
  // Saatin attığı son adımdan önceki durum ve önemli an sürerken gizlenen sonuç
  const pendingHold = useRef<Held | null>(null);
  const [held, setHeld] = useState<Held | null>(null);

  // Başlama öncesi Taktik ekranına gidilip dönüldüyse maçı güncel kadroyla yeniden kur.
  useEffect(() => {
    refreshPreMatch();
  }, [refreshPreMatch]);

  // Saat: sakin dakika 1 sn; önemli an sahada oynanırken (saha açıksa) sahne bitene kadar bekler.
  // Devre arası ve maç sonunda kendiliğinden durur.
  useEffect(() => {
    if (!running || !match) return;
    if (period === 'half' || period === 'full') {
      setRunning(false);
      return;
    }
    const delay = showPitch && isHighlight(match.lastPlay)
      ? sceneDurationMs(buildScene(match, match.lastPlay, match.minute))
      : QUIET_MINUTE_MS;
    const timer = setTimeout(() => {
      pendingHold.current = snapshot(match);
      step();
    }, delay);
    return () => clearTimeout(timer);
  }, [running, match, period, step, showPitch]);

  // Önemli an: skor ve anlatım sahne sonuç karesine gelince açıklanır.
  useEffect(() => {
    const before = pendingHold.current;
    pendingHold.current = null;
    if (!match || !before || !showPitch || !isHighlight(match.lastPlay)) return;
    setHeld(before);
    // Sonuç karesine gelince (golde sevinçten önce) açıklanır
    const timer = setTimeout(() => setHeld(null), revealDelayMs(buildScene(match, match.lastPlay, match.minute)));
    return () => {
      clearTimeout(timer);
      setHeld(null);
    };
  }, [match, showPitch]);

  if (!match) {
    return (
      <section className="panel">
        <h2 className="panel-title">Maç</h2>
        <div className="panel-body muted">Şu an oynanan bir maç yok.</div>
      </section>
    );
  }

  // Adımdan hemen sonraki ilk çizimde de sonuç gizli kalsın (efekt held'i bir çizim sonra kurar)
  const pending = pendingHold.current;
  const hold = held ?? (pending && showPitch && isHighlight(match.lastPlay) ? pending : null);

  const motm =
    match.period === 'full'
      ? Object.values(match.players).filter((p) => p.minuteIn !== null).sort((a, b) => b.rating - a.rating)[0]
      : undefined;

  return (
    <div className="match-screen">
      <Scoreboard match={match} held={hold} />
      {/* Saha açıkken baskı çubuğu gereksiz: yer sahaya kalsın */}
      {!showPitch && <MomentumBar match={match} />}
      <Controls
        match={match}
        running={running}
        setRunning={setRunning}
        showTactics={showTactics}
        setShowTactics={setShowTactics}
        extra={showPitch && <PitchTools camera={camera} setCamera={setCamera} onFullscreen={enterFullscreen} onHide={togglePitch} />}
      />
      {showTactics && match.period !== 'full' && <LiveTactics match={match} />}
      {match.period === 'pre' && (
        <AssistantPanel filter={(a) => LINEUP_ADVICE.has(a.kind) && a.severity !== 'low'} limit={4} hideWhenEmpty compact />
      )}
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
      <PitchPanel
        match={match}
        held={hold}
        show={showPitch}
        toggle={togglePitch}
        running={running}
        camera={camera}
        fullscreen={fullscreen}
        onExitFullscreen={exitFullscreen}
        panelRef={pitchRef}
        onToggleRun={() => {
          if (running) {
            setRunning(false);
            return;
          }
          // Başlama ve devre arası bir adımla geçilir (Kontroller'deki "Başlat" ile aynı)
          if (match.period === 'pre' || match.period === 'half') step();
          setRunning(true);
        }}
      />
      <div className="match-grid">
        <TeamPanel match={match} side="home" />
        <div className="match-center">
          <StatsPanel match={match} />
          <LiveMaps match={match} held={hold} />
          <Commentary match={match} held={hold} />
        </div>
        <TeamPanel match={match} side="away" />
      </div>
    </div>
  );
}
