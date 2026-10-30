import { useId, useMemo, useState } from 'react';
import { formatMinute, type Club, type ShotOutcome, type ShotRecord, type Side } from '../../engine';
import { teamColorsOn } from '../colors';
import { heatPoints, shotMarks, shotSummary, territory } from '../matchMaps';
import { PITCH_LENGTH, PITCH_WIDTH } from '../pitch';
import { PitchMarkings } from './PitchView';

type Mode = 'shots' | 'heat';
type TeamFilter = 'both' | Side;

const GRASS = '#2c6a28';

/** Haritada takım rengi: çimde okunan ilk kulüp rengi; deplasman ev sahibine çok benziyorsa diğer rengi. */
const mapColors = (home: Club, away: Club): Record<Side, string> => teamColorsOn(home.colors, away.colors, GRASS);

const OUTCOME_LABELS: Record<ShotOutcome, string> = { goal: 'Gol', saved: 'Kurtarıldı', missed: 'Aut', blocked: 'Engellendi' };
const KIND_LABELS: Record<NonNullable<ShotRecord['kind']>, string> = {
  header: 'kafa', long: 'uzaktan', freekick: 'serbest vuruş', penalty: 'penaltı',
};

function shotMinute(s: ShotRecord): string {
  const limit = s.second ? 90 : 45;
  return s.minute > limit ? formatMinute(limit, s.minute - limit) : formatMinute(s.minute);
}

/** Şut işareti: gol dolu büyük, isabet dolu, aut boş halka, engellenen çarpı. */
function ShotMarker({ x, y, outcome, color }: { x: number; y: number; outcome: ShotOutcome; color: string }) {
  if (outcome === 'blocked') {
    const d = 0.9;
    return (
      <g stroke={color} strokeWidth={0.45} strokeLinecap="round">
        <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} />
        <line x1={x - d} y1={y + d} x2={x + d} y2={y - d} />
      </g>
    );
  }
  if (outcome === 'missed') return <circle cx={x} cy={y} r={0.95} fill="none" stroke={color} strokeWidth={0.35} />;
  if (outcome === 'saved') return <circle cx={x} cy={y} r={1} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth={0.2} />;
  return <circle cx={x} cy={y} r={1.6} fill={color} stroke="#fff" strokeWidth={0.4} />;
}

export interface MatchMapsProps {
  shots: readonly ShotRecord[] | undefined;
  timeline: string | undefined;
  home: Club;
  away: Club;
  nameOf: (playerId: number) => string;
  /** Maç ekranındaki küçük hâli (başlık ve açıklamalar daha az). */
  compact?: boolean;
}

/**
 * Şut haritası ve ısı haritası (aynı saha üstünde, sekmeyle). İki yarı tek haritada: ev sahibi hep sağa hücum eder
 * (canlı sahada ikinci yarıda taraflar yer değiştirir; haritada karışmasın diye çevrilir).
 */
export function MatchMaps({ shots, timeline, home, away, nameOf, compact = false }: MatchMapsProps) {
  const [mode, setMode] = useState<Mode>('shots');
  const [team, setTeam] = useState<TeamFilter>('both');
  const blurId = `heat-blur-${useId().replace(/:/g, '')}`;
  const colors = useMemo(() => mapColors(home, away), [home, away]);
  const marks = useMemo(() => shotMarks(shots ?? []), [shots]);
  const points = useMemo(() => heatPoints(timeline ?? ''), [timeline]);

  if (!shots || timeline === undefined) {
    return <div className="panel-body muted">Bu maçın harita verisi yok (bu özellikten önce oynanmış).</div>;
  }
  const visible = (side: Side) => team === 'both' || team === side;
  const names: Record<Side, string> = { home: home.name, away: away.name };
  const terr = territory(points);
  const direction = `İki yarı birlikte: ${home.shortName} sağa hücum eder.`;
  const summary = (side: Side) => {
    const s = shotSummary(shots, side);
    return `${s.shots} şut · ${s.onTarget} isabet · ${s.goals} gol`;
  };

  return (
    <div className={`match-maps${compact ? ' compact' : ''}`}>
      <div className="match-maps-bar">
        <span className="tabs">
          <button className={`tab${mode === 'shots' ? ' active' : ''}`} onClick={() => setMode('shots')}>Şut haritası</button>
          <button className={`tab${mode === 'heat' ? ' active' : ''}`} onClick={() => setMode('heat')}>Isı haritası</button>
        </span>
        <span className="tabs">
          <button className={`tab${team === 'both' ? ' active' : ''}`} onClick={() => setTeam('both')}>İki takım</button>
          <button className={`tab${team === 'home' ? ' active' : ''}`} onClick={() => setTeam('home')}>{home.shortName}</button>
          <button className={`tab${team === 'away' ? ' active' : ''}`} onClick={() => setTeam('away')}>{away.shortName}</button>
        </span>
      </div>

      <svg className="match-map" viewBox={`-3 -2 ${PITCH_LENGTH + 6} ${PITCH_WIDTH + 4}`} role="img"
        aria-label={mode === 'shots' ? 'Şut haritası' : 'Isı haritası'}>
        <defs>
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={3} />
          </filter>
        </defs>
        <rect x={-3} y={-2} width={PITCH_LENGTH + 6} height={PITCH_WIDTH + 4} fill={GRASS} />
        {mode === 'heat' && (
          <g filter={`url(#${blurId})`}>
            {points.filter((p) => visible(p.side)).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={6} fill={colors[p.side]} opacity={0.5} />
            ))}
          </g>
        )}
        <PitchMarkings />
        {/* Kaleler */}
        <rect className="map-goal" x={-1.6} y={PITCH_WIDTH / 2 - 3.66} width={1.6} height={7.32} />
        <rect className="map-goal" x={PITCH_LENGTH} y={PITCH_WIDTH / 2 - 3.66} width={1.6} height={7.32} />
        {mode === 'shots' && marks.filter((m) => visible(m.shot.side)).map((m, i) => {
          const s = m.shot;
          const color = colors[s.side];
          const detail = [s.kind && KIND_LABELS[s.kind], s.corner && 'korner'].filter(Boolean).join(', ');
          return (
            <g key={i} className={`map-shot shot-${s.outcome}`}>
              <title>{`${shotMinute(s)} ${nameOf(s.playerId)} (${names[s.side]}) — ${OUTCOME_LABELS[s.outcome]}${detail ? ` (${detail})` : ''}`}</title>
              {(s.outcome === 'goal' || s.outcome === 'saved') && (
                <line x1={m.from.x} y1={m.from.y} x2={m.to.x} y2={m.to.y} stroke={color}
                  strokeWidth={s.outcome === 'goal' ? 0.35 : 0.2} opacity={s.outcome === 'goal' ? 0.85 : 0.45} />
              )}
              <ShotMarker x={m.from.x} y={m.from.y} outcome={s.outcome} color={color} />
            </g>
          );
        })}
      </svg>

      {mode === 'shots' ? (
        <div className="match-maps-legend">
          {(['home', 'away'] as const).filter(visible).map((side) => (
            <span key={side}><i className="legend-dot" style={{ background: colors[side] }} /> {names[side]}: {summary(side)}</span>
          ))}
          <span className="muted">{direction}</span>
          {!compact && (
            <span className="muted legend-keys">
              <svg viewBox="-2 -2 4 4" className="legend-icon"><circle r={1.5} fill="#fff" /></svg> gol
              <svg viewBox="-2 -2 4 4" className="legend-icon"><circle r={1.1} fill="#bbb" /></svg> kurtarıldı
              <svg viewBox="-2 -2 4 4" className="legend-icon"><circle r={1.1} fill="none" stroke="#bbb" strokeWidth={0.4} /></svg> aut
              <svg viewBox="-2 -2 4 4" className="legend-icon"><path d="M-1 -1 L1 1 M-1 1 L1 -1" stroke="#bbb" strokeWidth={0.45} /></svg> engellendi
              · üstüne gelince ayrıntı
            </span>
          )}
        </div>
      ) : (
        <div className="match-maps-legend">
          <span>
            Topun yeri (dakika payı): {home.shortName} kalesi önü %{terr.own} · orta saha %{terr.middle} · {away.shortName} kalesi önü %{terr.opp}
          </span>
          <span className="muted">{direction}</span>
          {!compact && <span className="muted">Her dakika topun nerede olduğu, o an topa sahip takımın renginde.</span>}
        </div>
      )}
    </div>
  );
}
