import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getClub, type MatchState, type PlayKind, type Side } from '../../engine';
import { useWorld } from '../../store/gameStore';
import { colorsClash, PITCH_LENGTH, PITCH_WIDTH } from '../pitch';
import { buildScene, frameSpots, framesForDuration } from '../pitchScene';

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
 * Canlı maçın 2D görünümü. Her dakika kısa bir sahne olarak oynar (pas → pas → asist → şut → sonuç):
 * top kare kare takım arkadaşları arasında dolaşır, oyuncular topa göre kayar.
 * `minuteMs`: maçta bir dakikanın süresi (hıza göre); hızlı modda yalnızca son kare gösterilir.
 */
export function PitchView({ match, minuteMs }: { match: MatchState; minuteMs: number }) {
  const world = useWorld();
  const play = match.lastPlay;
  const kickoff = play === null;
  const scene = useMemo(() => framesForDuration(buildScene(match, play, match.minute), minuteMs), [match, play, minuteMs]);

  // Sahne kare kare ilerler; yeni dakikada baştan başlar (eski sahnenin karesi gösterilmez).
  const [step, setStep] = useState({ scene, index: 0 });
  const index = step.scene === scene ? step.index : 0;
  const frameMs = (minuteMs * 0.9) / scene.length;
  useEffect(() => {
    if (scene.length <= 1) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setStep({ scene, index: i });
      if (i >= scene.length - 1) clearInterval(timer);
    }, frameMs);
    return () => clearInterval(timer);
  }, [scene, frameMs]);

  const frame = scene[Math.min(index, scene.length - 1)]!;
  const previous = index > 0 ? scene[index - 1] : undefined;
  const isFinal = index >= scene.length - 1;

  const homeClub = getClub(world, match.home.clubId);
  const awayClub = getClub(world, match.away.clubId);
  const kits: Record<Side, { fill: string; stroke: string }> = {
    home: { fill: homeClub.colors.primary, stroke: homeClub.colors.secondary },
    away: colorsClash(homeClub.colors.primary, awayClub.colors.primary)
      ? { fill: awayClub.colors.secondary, stroke: awayClub.colors.primary }
      : { fill: awayClub.colors.primary, stroke: awayClub.colors.secondary },
  };

  // Çok kısa geçiş göze görünmez ama her karede SVG'yi yeniden boyatır: hızlı modda kapalı.
  const moveMs = scene.length > 1 ? frameMs * 0.85 : minuteMs < 100 ? 0 : minuteMs * 0.85;
  const style = { '--pitch-move': `${Math.round(moveMs)}ms` } as CSSProperties;
  const label = play && isFinal ? PLAY_LABELS[play.kind] : undefined;
  const card = play && isFinal ? play.card : undefined;

  const dots = [...frameSpots(match, frame, kickoff)].map(([id, { side, at }]) => {
    const keeper = match.players[id]?.slot === 'GK';
    const carrier = frame.carrierId === id;
    return (
      <g key={id} className="pitch-player" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
        <circle
          r={1.85}
          fill={keeper ? '#1d1f24' : kits[side].fill}
          stroke={keeper ? kits[side].fill : kits[side].stroke}
          className={carrier ? 'involved' : undefined}
        />
        <text y={0.62} fill={keeper ? '#fff' : kits[side].stroke}>{world.players[id]?.squadNumber ?? ''}</text>
        {card?.playerId === id && <rect className={`pitch-card ${card.type}`} x={0.9} y={-3.9} width={1.4} height={1.9} rx={0.2} />}
      </g>
    );
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
        {previous && frame.move !== 'none' && (
          <line
            key={`${match.minute}-${index}`}
            className={`pitch-trail ${frame.move}${play?.kind === 'goal' && isFinal ? ' goal' : ''}`}
            x1={previous.ball.x}
            y1={previous.ball.y}
            x2={frame.ball.x}
            y2={frame.ball.y}
          />
        )}
        {dots}
        <g className="pitch-ball" style={{ transform: `translate(${frame.ball.x}px, ${frame.ball.y}px)` }}>
          <circle r={0.9} />
        </g>
      </svg>
      {label && play && (
        <div
          key={`${match.minute}-${play.kind}`}
          className={`pitch-label${play.kind === 'goal' ? ' goal' : ''}`}
          style={{ background: kits[play.side].fill, color: kits[play.side].stroke }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
