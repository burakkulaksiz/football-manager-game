import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getClub, type MatchState, type Side } from '../../engine';
import { useWorld } from '../../store/gameStore';
import { readableText } from '../colors';
import { cameraTransform, CAMERA_ZOOM, colorsClash, PITCH_LENGTH, PITCH_VIEW, PITCH_WIDTH, screenUnit, toScreen } from '../pitch';
import { buildScene, frameSpots, isHighlight, playLabel, revealIndex, SCENE_FRAME_MS } from '../pitchScene';

/** Forma/şort sınırı: noktanın yukarıdan %69'u (yarıçap 1.3, merkezin 0.5 altı). */
const SHIRT_SPLIT = 69;
const KEEPER_KIT = '#1d1f24';

/** Öğenin genişliği (px); boyut değişince güncellenir. */
function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Şut karesinde top hızlı gider; diğer karelerde oyuncular ve top yavaşça kayar. */
const SHOT_MOVE_MS = 380;
const MOVE_MS = Math.round(SCENE_FRAME_MS * 0.8);

export function PitchMarkings() {
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
      {/* Köşe yayları */}
      <path d={`M 0 1 A 1 1 0 0 0 1 0`} />
      <path d={`M ${L - 1} 0 A 1 1 0 0 0 ${L} 1`} />
      <path d={`M 0 ${W - 1} A 1 1 0 0 1 1 ${W}`} />
      <path d={`M ${L - 1} ${W} A 1 1 0 0 1 ${L} ${W - 1}`} />
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
        <linearGradient id="pitch-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0.1" />
          <stop offset="0.34" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pitch-sun" cx="0.62" cy="0.78" r="0.75">
          <stop offset="0" stopColor="#fff8d0" stopOpacity="0.09" />
          <stop offset="1" stopColor="#fff8d0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={PITCH_LENGTH} height={PITCH_WIDTH} fill="url(#pitch-stripes)" />
      {/* Işık: üst tribünün gölgesi ve karşıdan vuran hafif güneş */}
      <rect x={PITCH_VIEW.x} y={PITCH_VIEW.y} width={PITCH_VIEW.w} height={PITCH_VIEW.h} fill="url(#pitch-shade)" />
      <rect x={PITCH_VIEW.x} y={PITCH_VIEW.y} width={PITCH_VIEW.w} height={PITCH_VIEW.h} fill="url(#pitch-sun)" />
      <PitchMarkings />
    </svg>
  );
});

const GOAL_DEPTH = 2.2;
const GOAL_HALF = 3.66;

/** Kale: file (çapraz örgü) ve direkler. Gol anında file dışarı doğru sallanır. */
function GoalNet({ end, ripple }: { end: 'left' | 'right'; ripple: string | null }) {
  const x = end === 'left' ? -GOAL_DEPTH : PITCH_LENGTH;
  const lineX = end === 'left' ? 0 : PITCH_LENGTH;
  const backX = end === 'left' ? -GOAL_DEPTH : PITCH_LENGTH + GOAL_DEPTH;
  const top = PITCH_WIDTH / 2 - GOAL_HALF;
  return (
    <g>
      <rect
        key={ripple ?? 'calm'}
        className={`pitch-net ${end}${ripple ? ' ripple' : ''}`}
        x={x}
        y={top}
        width={GOAL_DEPTH}
        height={GOAL_HALF * 2}
        fill="url(#pitch-net)"
      />
      {/* Kale çerçevesi ve direkler */}
      <path className="pitch-posts" d={`M ${lineX} ${top} H ${backX} V ${top + GOAL_HALF * 2} H ${lineX}`} />
      <circle className="pitch-post" cx={lineX} cy={top} r={0.28} />
      <circle className="pitch-post" cx={lineX} cy={top + GOAL_HALF * 2} r={0.28} />
    </g>
  );
}

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
 * kart, sakatlık, oyuncu değişikliği) kısa bir sahne olarak yavaşça oynar; sakin dakikalarda saha boştur.
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
  const stageRef = useRef<HTMLDivElement>(null);
  const stageWidth = useElementWidth(stageRef);
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
  // Gol karesi ve sevinç: golün girdiği file sallanır (santrada durur)
  const goalRipple = play?.kind === 'goal' && revealed && !frame?.kickoff ? play.side : null;

  // Oyuncular ve top HTML katmanında: kayma animasyonu ekran kartında (ana iş parçacığı serbest).
  // Konumlar kamerayı içerir; katman büyütülmediği için yazılar yakın kamerada da net.
  const unit = screenUnit(cam, stageWidth);
  const dots = frame && spots && stageWidth > 0
    // Topu taşıyan / vurgulanan en son çizilir: adı kalabalıkta (ör. gol sevinci) üstte kalsın
    ? [...spots]
      .sort(([a], [b]) => Number(a === frame.carrierId || a === frame.focusId) - Number(b === frame.carrierId || b === frame.focusId))
      .map(([id, { side, at }]) => {
        const keeper = match.players[id]?.slot === 'GK';
        const carrier = frame.carrierId === id || frame.focusId === id;
        const sub = frame.subs?.find((s) => s.inId === id || s.outId === id);
        // Topu taşıyanın (sevinçte golcünün), kart görenin, sakatlananın ve değişikliktekilerin adı noktanın altında
        const named = carrier || card?.playerId === id || injuredId === id || sub !== undefined;
        // Daha önce sarı kart görmüşse küçük kart; bu dakikanın kartı sonuç karesine kadar gizli
        const booked = match.players[id]?.yellow === true && card?.playerId !== id && !(play?.card?.playerId === id && !revealed);
        const p = toScreen(at, cam, stageWidth);
        // Forma (üst) ve şort (alt); kalecinin forması koyu, şortu takım renginde
        const shirt = keeper ? KEEPER_KIT : kits[side].fill;
        const shorts = keeper ? kits[side].fill : kits[side].stroke;
        return (
          <div key={id} className="pdot" style={{ transform: `translate3d(${p.x}px, ${p.y}px, 0)` }}>
            <div
              className={`pdot-body${carrier ? ' involved' : ''}${frame.injuredId === id ? ' down' : ''}`}
              style={{ background: `linear-gradient(${shirt} ${SHIRT_SPLIT}%, ${shorts} ${SHIRT_SPLIT}%)`, color: keeper ? '#fff' : ink(side) }}
            >
              {world.players[id]?.squadNumber ?? ''}
            </div>
            {/* Alt kenardaki (değişiklik, atılan oyuncu) adı noktanın üstünde: sahne kutusu taşanı keser */}
            {named && <div className={`pdot-name${at.y > PITCH_WIDTH - 2.5 ? ' above' : ''}`}>{world.players[id]?.lastName ?? ''}</div>}
            {card?.playerId === id && <div className={`pdot-card ${card.type}`} />}
            {booked && <div className="pdot-card yellow mini" />}
            {injuredId === id && <div className="pdot-injury">✚</div>}
            {sub && <div className={`pdot-sub ${sub.inId === id ? 'in' : 'out'}`}>{sub.inId === id ? '▲' : '▼'}</div>}
          </div>
        );
      })
    : null;
  const ballAt = frame && stageWidth > 0 ? toScreen(frame.ball, cam, stageWidth) : null;

  return (
    <div className="pitch-view" style={style} ref={ref}>
      {/* İki katman: çim ve çizgiler bir kez çizilir; yalnızca oyuncu katmanı boyanır */}
      <div className="pitch-stage" ref={stageRef} style={{ width: Math.round(maxHeight * ASPECT) }}>
        {/* Kamera: yalnızca CSS dönüşümü (saha yeniden çizilmez, ekran kartında kayar) */}
        <div
          className="pitch-camera"
          style={{ transform: `translate(${cam.tx * 100}%, ${cam.ty * 100}%) scale(${cam.zoom})` }}
        >
        <PitchBackground />
        <svg className="pitch-layer" viewBox={VIEW_BOX} aria-hidden="true">
          <defs>
            <pattern id="pitch-net" width={0.55} height={0.55} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M 0 0 H 0.55 M 0 0 V 0.55" stroke="rgba(255,255,255,0.55)" strokeWidth={0.07} />
            </pattern>
          </defs>
          {/* Ev sahibi sağa hücum eder: ev sahibinin golü sağ kaleye */}
          <GoalNet end="left" ripple={goalRipple === 'away' ? `${match.minute}` : null} />
          <GoalNet end="right" ripple={goalRipple === 'home' ? `${match.minute}` : null} />
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
        </svg>
        </div>
        {/* Oyuncu katmanı: büyütülmez; birim (--u, metre başına px) kamerayla gelir */}
        <div className="pitch-dots" style={{ '--u': `${unit}px` } as CSSProperties}>
          {dots}
          {ballAt && <div className="pball" style={{ transform: `translate3d(${ballAt.x}px, ${ballAt.y}px, 0)` }}><div className="pball-body" /></div>}
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
