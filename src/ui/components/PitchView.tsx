import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getClub, type MatchState, type Side } from '../../engine';
import { useWorld } from '../../store/gameStore';
import { readableText } from '../colors';
import { cameraTransform, CAMERA_ZOOM, colorsClash, PITCH_LENGTH, PITCH_VIEW, PITCH_WIDTH } from '../pitch';
import { buildScene, frameSpots, isHighlight, playLabel, revealIndex, SCENE_FRAME_MS } from '../pitchScene';

/** Şut karesinde top hızlı gider; diğer karelerde oyuncular ve top yavaşça kayar. */
const SHOT_MOVE_MS = 380;
const MOVE_MS = Math.round(SCENE_FRAME_MS * 0.8);

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

const VIEW_BOX = `${PITCH_VIEW.x} ${PITCH_VIEW.y} ${PITCH_VIEW.w} ${PITCH_VIEW.h}`;
const ASPECT = PITCH_VIEW.w / PITCH_VIEW.h;

/** Çim ve saha çizgileri: değişmez, yalnızca boyut değişince yeniden çizilir. */
const PitchBackground = memo(function PitchBackground() {
  return (
    <svg className="pitch-grass" viewBox={VIEW_BOX} role="img" aria-label="2D saha">
      <defs>
        <pattern id="pitch-stripes" width={PITCH_LENGTH / 9} height={PITCH_WIDTH} patternUnits="userSpaceOnUse">
          <rect width={PITCH_LENGTH / 18} height={PITCH_WIDTH} fill="#2f7a2a" />
          <rect x={PITCH_LENGTH / 18} width={PITCH_LENGTH / 18} height={PITCH_WIDTH} fill="#2a6f25" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={PITCH_LENGTH} height={PITCH_WIDTH} fill="url(#pitch-stripes)" />
      <PitchMarkings />
    </svg>
  );
});

/** Sahanın altında kalan şerit ve boşluklar (px): saha + şerit ekrana sığsın. */
const BELOW_PITCH = 64;
/** Tam ekranda sahanın üstündeki skor şeridi ve altındaki olay şeridi (px). */
const FULLSCREEN_CHROME = 120;

/**
 * Sahanın en fazla yüksekliği: kaydırma alanının (main.content) görünür yüksekliğinden sahanın
 * üstündeki içerik çıkarılır; böylece saha kaydırmadan bütünüyle görünür (ekran küçülürse en az 320 px).
 */
function useFitHeight(ref: React.RefObject<HTMLDivElement | null>, layoutKey: string, fullscreen: boolean): number {
  const [height, setHeight] = useState(520);
  useLayoutEffect(() => {
    const measure = () => {
      if (fullscreen) {
        setHeight(Math.max(320, window.innerHeight - FULLSCREEN_CHROME));
        return;
      }
      const el = ref.current;
      const scroller = el?.closest('main');
      if (!el || !scroller) return;
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setHeight(Math.max(320, Math.round(scroller.clientHeight - top - BELOW_PITCH)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // layoutKey: üstteki içerik değişince (başlama öncesi notu kalkınca vb.) yeniden ölç
  }, [ref, layoutKey, fullscreen]);
  return height;
}

/**
 * Canlı maçın 2D görünümü (FM'deki "önemli anlar" gibi): yalnızca önemli anlar (şut, gol, duran top,
 * kart, sakatlık) kısa bir sahne olarak yavaşça oynar; sakin dakikalarda saha boştur.
 * Maç başlamadan ve devre arasında takımlar başlama dizilişinde görünür.
 */
export type CameraMode = 'full' | 'follow';

export function PitchView({ match, camera, fullscreen }: { match: MatchState; camera: CameraMode; fullscreen: boolean }) {
  const world = useWorld();
  const ref = useRef<HTMLDivElement>(null);
  const play = match.lastPlay;
  const kickoff = play === null;
  const visible = kickoff || isHighlight(play);
  // Sahne yalnızca yeni anda yeniden kurulur (değişiklik vb. ile maç nesnesi değişse de baştan başlamaz)
  const scene = useMemo(() => (visible ? buildScene(match, play, match.minute) : []), [play, match.minute, match.period, visible]);

  // Sahne kare kare ilerler; yeni anda baştan başlar (eski sahnenin karesi gösterilmez).
  const [step, setStep] = useState({ scene, index: 0 });
  const index = step.scene === scene ? step.index : 0;
  useEffect(() => {
    if (scene.length <= 1) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setStep({ scene, index: i });
      if (i >= scene.length - 1) clearInterval(timer);
    }, SCENE_FRAME_MS);
    return () => clearInterval(timer);
  }, [scene]);

  const maxHeight = useFitHeight(ref, match.period, fullscreen);
  const frame = scene[Math.min(index, scene.length - 1)];
  const previous = index > 0 ? scene[index - 1] : undefined;
  // Sonuç (etiket, kart, sakatlık) sonuç karesinden itibaren görünür; golde ardından sevinç gelir
  const revealed = scene.length > 0 && index >= revealIndex(scene);

  const homeClub = getClub(world, match.home.clubId);
  const awayClub = getClub(world, match.away.clubId);
  const kits: Record<Side, { fill: string; stroke: string }> = {
    home: { fill: homeClub.colors.primary, stroke: homeClub.colors.secondary },
    away: colorsClash(homeClub.colors.primary, awayClub.colors.primary)
      ? { fill: awayClub.colors.secondary, stroke: awayClub.colors.primary }
      : { fill: awayClub.colors.primary, stroke: awayClub.colors.secondary },
  };
  // Numara ve etiket yazısı formanın üstünde okunmalı
  const ink = (side: Side) => readableText(kits[side].fill, kits[side].stroke);

  const style = { '--pitch-move': `${frame?.move === 'shot' ? SHOT_MOVE_MS : MOVE_MS}ms` } as CSSProperties;
  const label = !kickoff && revealed ? playLabel(play) : undefined;
  const card = play && revealed ? play.card : undefined;
  const injuredId = revealed ? scene[revealIndex(scene)]?.injuredId : undefined;

  const spots = frame ? frameSpots(match, frame, kickoff) : null;
  // Yakın kamera: topu (sevinçte golcüyü) takip eder; santra ve sakin dakikada tam saha
  const target = camera === 'follow' && frame && spots && !kickoff && !frame.kickoff
    ? (frame.focusId !== undefined ? spots.get(frame.focusId)?.at : undefined) ?? frame.ball
    : null;
  const cam = cameraTransform(target, CAMERA_ZOOM);

  const dots = frame && spots
    // Topu taşıyan / vurgulanan en son çizilir: adı kalabalıkta (ör. gol sevinci) üstte kalsın
    ? [...spots]
      .sort(([a], [b]) => Number(a === frame.carrierId || a === frame.focusId) - Number(b === frame.carrierId || b === frame.focusId))
      .map(([id, { side, at }]) => {
      const keeper = match.players[id]?.slot === 'GK';
      const carrier = frame.carrierId === id || frame.focusId === id;
      // Topu taşıyanın (sevinçte golcünün), kart görenin ve sakatlananın adı noktanın altında
      const named = carrier || card?.playerId === id || injuredId === id;
      return (
        <g key={id} className="pitch-player" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
          <circle
            r={1.3}
            fill={keeper ? '#1d1f24' : kits[side].fill}
            stroke={keeper ? kits[side].fill : kits[side].stroke}
            className={carrier ? 'involved' : undefined}
          />
          <text y={0.48} fill={keeper ? '#fff' : ink(side)}>{world.players[id]?.squadNumber ?? ''}</text>
          {named && <text className="pitch-name" y={3.1}>{world.players[id]?.lastName ?? ''}</text>}
          {card?.playerId === id && <rect className={`pitch-card ${card.type}`} x={0.7} y={-3} width={1.05} height={1.45} rx={0.15} />}
          {injuredId === id && <text className="pitch-injury" x={-1.6} y={-1.6}>✚</text>}
        </g>
      );
    })
    : null;

  return (
    <div className="pitch-view" style={style} ref={ref}>
      {/* İki katman: çim ve çizgiler bir kez çizilir; yalnızca oyuncu katmanı boyanır */}
      <div className="pitch-stage" style={{ width: Math.round(maxHeight * ASPECT) }}>
        {/* Kamera: yalnızca CSS dönüşümü (saha yeniden çizilmez, ekran kartında kayar) */}
        <div
          className="pitch-camera"
          style={{ transform: `translate(${cam.tx * 100}%, ${cam.ty * 100}%) scale(${cam.zoom})` }}
        >
        <PitchBackground />
        <svg className="pitch-layer" viewBox={VIEW_BOX} aria-hidden="true">
          {frame && previous && frame.move !== 'none' && (
            <line
              key={`${match.minute}-${index}`}
              className={`pitch-trail ${frame.move}${play?.kind === 'goal' && frame.result ? ' goal' : ''}`}
              x1={previous.ball.x}
              y1={previous.ball.y}
              x2={frame.ball.x}
              y2={frame.ball.y}
            />
          )}
          {dots}
          {frame && (
            <g className="pitch-ball" style={{ transform: `translate(${frame.ball.x}px, ${frame.ball.y}px)` }}>
              <circle r={0.62} />
            </g>
          )}
        </svg>
        </div>
      </div>
      {label && play && (
        <div
          key={`${match.minute}-${play.kind}`}
          className={`pitch-label${play.kind === 'goal' ? ' goal' : ''}`}
          style={{ background: kits[play.side].fill, color: ink(play.side) }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
