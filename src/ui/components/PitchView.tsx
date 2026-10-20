import type { CSSProperties } from 'react';
import { getClub, type MatchState, type PlayKind, type Side } from '../../engine';
import { useWorld } from '../../store/gameStore';
import { ballSpot, colorsClash, PITCH_LENGTH, PITCH_WIDTH, shotOrigin, teamSpots } from '../pitch';

/** Sahanın üstünde kısa süre görünen etiket. */
const PLAY_LABELS: Partial<Record<PlayKind, string>> = {
  goal: 'GOL!',
  save: 'Kurtarış',
  miss: 'Dışarı',
  blocked: 'Bloke',
  corner: 'Korner',
  freekick: 'Serbest vuruş',
  penalty: 'Penaltı kaçtı',
};

function PitchMarkings() {
  const L = PITCH_LENGTH;
  const W = PITCH_WIDTH;
  const box = (x: number, depth: number, width: number) =>
    <rect x={x} y={(W - width) / 2} width={depth} height={width} />;
  return (
    <g className="pitch-lines">
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <circle cx={L / 2} cy={W / 2} r={9.15} />
      <circle cx={L / 2} cy={W / 2} r={0.4} className="spot" />
      {box(0, 16.5, 40.32)}
      {box(L - 16.5, 16.5, 40.32)}
      {box(0, 5.5, 18.32)}
      {box(L - 5.5, 5.5, 18.32)}
      <circle cx={11} cy={W / 2} r={0.4} className="spot" />
      <circle cx={L - 11} cy={W / 2} r={0.4} className="spot" />
      {/* Ceza sahası yayları */}
      <path d={`M 16.5 ${W / 2 - 7.31} A 9.15 9.15 0 0 1 16.5 ${W / 2 + 7.31}`} />
      <path d={`M ${L - 16.5} ${W / 2 - 7.31} A 9.15 9.15 0 0 0 ${L - 16.5} ${W / 2 + 7.31}`} />
      {/* Kaleler */}
      <rect x={-1.8} y={W / 2 - 3.66} width={1.8} height={7.32} className="goal" />
      <rect x={L} y={W / 2 - 3.66} width={1.8} height={7.32} className="goal" />
    </g>
  );
}

/**
 * Canlı maçın 2D görünümü: oyuncular dizilişteki yerlerinden topu takip ederek kayar,
 * top dakikanın anına göre (atak, şut, korner, gol…) hareket eder.
 * `durationMs`: bir dakikalık geçiş animasyonu (maç hızına göre).
 */
export function PitchView({ match, durationMs }: { match: MatchState; durationMs: number }) {
  const world = useWorld();
  const play = match.lastPlay;
  const ball = ballSpot(play, match.minute);
  const origin = shotOrigin(play, match.minute);
  const kickoff = play === null;

  const homeClub = getClub(world, match.home.clubId);
  const awayClub = getClub(world, match.away.clubId);
  const kits: Record<Side, { fill: string; stroke: string }> = {
    home: { fill: homeClub.colors.primary, stroke: homeClub.colors.secondary },
    away: colorsClash(homeClub.colors.primary, awayClub.colors.primary)
      ? { fill: awayClub.colors.secondary, stroke: awayClub.colors.primary }
      : { fill: awayClub.colors.primary, stroke: awayClub.colors.secondary },
  };

  // Çok kısa geçiş göze görünmez ama her karede SVG'yi yeniden boyatır: hızlı modda kapalı.
  const style = { '--pitch-move': durationMs < 100 ? '0ms' : `${durationMs}ms` } as CSSProperties;
  const label = play ? PLAY_LABELS[play.kind] : undefined;
  const labelKit = play ? kits[play.side] : undefined;

  const dots = (['home', 'away'] as const).flatMap((side) => {
    const spots = teamSpots(match, side, ball, kickoff);
    return [...spots.entries()].map(([id, p]) => {
      const ps = match.players[id]!;
      const keeper = ps.slot === 'GK';
      // Şutu çeken oyuncu şutun çıktığı yerde görünür
      const at = origin && play?.playerId === id ? origin : p;
      return (
        <g key={id} className="pitch-player" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
          <circle
            r={1.85}
            fill={keeper ? '#1d1f24' : kits[side].fill}
            stroke={keeper ? kits[side].fill : kits[side].stroke}
            className={play?.playerId === id ? 'involved' : undefined}
          />
          <text y={0.62} fill={keeper ? '#fff' : kits[side].stroke}>{world.players[id]?.squadNumber ?? ''}</text>
        </g>
      );
    });
  });

  return (
    <div className="pitch-view" style={style}>
      <svg viewBox={`-3 -2 ${PITCH_LENGTH + 6} ${PITCH_WIDTH + 4}`} role="img" aria-label="2D saha">
        <defs>
          <pattern id="pitch-stripes" width={PITCH_LENGTH / 9} height={PITCH_WIDTH} patternUnits="userSpaceOnUse">
            <rect width={PITCH_LENGTH / 18} height={PITCH_WIDTH} fill="#2f7a2a" />
            <rect x={PITCH_LENGTH / 18} width={PITCH_LENGTH / 18} height={PITCH_WIDTH} fill="#2a6f25" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={PITCH_LENGTH} height={PITCH_WIDTH} fill="url(#pitch-stripes)" />
        <PitchMarkings />
        {origin && (
          <line
            key={`shot-${match.minute}`}
            className={`pitch-shot${play?.kind === 'goal' ? ' goal' : ''}`}
            x1={origin.x}
            y1={origin.y}
            x2={ball.x}
            y2={ball.y}
          />
        )}
        {dots}
        <g className="pitch-ball" style={{ transform: `translate(${ball.x}px, ${ball.y}px)` }}>
          <circle r={0.9} />
        </g>
      </svg>
      {label && labelKit && (
        <div
          key={`${match.minute}-${play?.kind}`}
          className={`pitch-label${play?.kind === 'goal' ? ' goal' : ''}`}
          style={{ background: labelKit.fill, color: labelKit.stroke }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
