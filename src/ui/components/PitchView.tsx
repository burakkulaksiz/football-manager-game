import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getClub, type MatchState, type Side } from '../../engine';
import { useWorld } from '../../store/gameStore';
import { readableText } from '../colors';
import {
  cameraTransform,
  CAMERA_ZOOM,
  colorsClash,
  makeView,
  PITCH_LENGTH,
  PITCH_WIDTH,
  screenUnit,
  stretchFor,
  toScreen,
  type CameraTransform,
  type PitchViewBox,
} from '../pitch';
import { ballTrack, dominance, sampleScene, type Spots } from '../pitchMotion';
import { bannerKind, buildScene, frameSpots, frameStartsMs, isHighlight, playLabel, revealIndex, SCENE_HOLD_MS } from '../pitchScene';

/** Forma/şort sınırı: noktanın yukarıdan %69'u (yarıçap 1.3, merkezin 0.5 altı). */
const SHIRT_SPLIT = 69;
const KEEPER_KIT = '#1d1f24';
/** Yakın kameranın topu izleme yumuşaklığı (ms; büyüdükçe kamera daha ağır kayar). */
const CAMERA_LAG_MS = 220;

/** Öğenin iç genişliği (px, dolgu hariç); boyut değişince güncellenir. */
function useInnerWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      setWidth(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Saha çizgileri; `k`: boyuna uzatma (x koordinatları uzar, daireler ve yaylar değişmez). */
export function PitchMarkings({ k = 1 }: { k?: number }) {
  const L = PITCH_LENGTH * k;
  const W = PITCH_WIDTH;
  const X = (x: number) => x * k;
  const box = (x: number, depth: number, width: number) =>
    <rect x={x} y={(W - width) / 2} width={depth} height={width} />;
  // Ceza sahası yayı: penaltı noktasından 9.15 m, ceza sahası çizgisinin dışında kalan kısmı
  const spotToLine = X(16.5) - X(11);
  const arc = spotToLine < 9.15 ? Math.sqrt(9.15 ** 2 - spotToLine ** 2) : 0;
  return (
    <g className="pitch-lines">
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <circle cx={L / 2} cy={W / 2} r={9.15} />
      <circle cx={L / 2} cy={W / 2} r={0.4} className="spot" />
      {box(0, X(16.5), 40.32)}
      {box(L - X(16.5), X(16.5), 40.32)}
      {box(0, X(5.5), 18.32)}
      {box(L - X(5.5), X(5.5), 18.32)}
      <circle cx={X(11)} cy={W / 2} r={0.4} className="spot" />
      <circle cx={L - X(11)} cy={W / 2} r={0.4} className="spot" />
      {arc > 0 && (
        <>
          <path d={`M ${X(16.5)} ${W / 2 - arc} A 9.15 9.15 0 0 1 ${X(16.5)} ${W / 2 + arc}`} />
          <path d={`M ${L - X(16.5)} ${W / 2 - arc} A 9.15 9.15 0 0 0 ${L - X(16.5)} ${W / 2 + arc}`} />
        </>
      )}
      {/* Köşe yayları */}
      <path d={`M 0 1 A 1 1 0 0 0 1 0`} />
      <path d={`M ${L - 1} 0 A 1 1 0 0 0 ${L} 1`} />
      <path d={`M 0 ${W - 1} A 1 1 0 0 1 1 ${W}`} />
      <path d={`M ${L - 1} ${W} A 1 1 0 0 1 ${L} ${W - 1}`} />
    </g>
  );
}

const viewBoxOf = (v: PitchViewBox) => `${v.x} ${v.y} ${v.w} ${v.h}`;

/** Çim ve saha çizgileri: değişmez, yalnızca boyut / uzatma değişince yeniden çizilir. */
const PitchBackground = memo(function PitchBackground({ view }: { view: PitchViewBox }) {
  const L = PITCH_LENGTH * view.k;
  return (
    <svg className="pitch-grass" viewBox={viewBoxOf(view)} role="img" aria-label="2D saha">
      <defs>
        <pattern id="pitch-stripes" width={L / 9} height={PITCH_WIDTH} patternUnits="userSpaceOnUse">
          <rect width={L / 18} height={PITCH_WIDTH} fill="#2f7a2a" />
          <rect x={L / 18} width={L / 18} height={PITCH_WIDTH} fill="#2a6f25" />
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
      <rect x={0} y={0} width={L} height={PITCH_WIDTH} fill="url(#pitch-stripes)" />
      {/* Işık: üst tribünün gölgesi ve karşıdan vuran hafif güneş */}
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#pitch-shade)" />
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#pitch-sun)" />
      <PitchMarkings k={view.k} />
    </svg>
  );
});

const GOAL_DEPTH = 2.2;
const GOAL_HALF = 3.66;

/** Kale: file (çapraz örgü) ve direkler. Gol anında file dışarı doğru sallanır. */
function GoalNet({ end, ripple, k }: { end: 'left' | 'right'; ripple: string | null; k: number }) {
  const L = PITCH_LENGTH * k;
  const x = end === 'left' ? -GOAL_DEPTH : L;
  const lineX = end === 'left' ? 0 : L;
  const backX = end === 'left' ? -GOAL_DEPTH : L + GOAL_DEPTH;
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
/** Tam ekranda skor ve olay şeritleri sahanın üstüne biner: yalnızca kenar boşluğu (px). */
const FULLSCREEN_MARGIN = 16;

/**
 * Sahanın en fazla yüksekliği: kaydırma alanının (main.content) görünür yüksekliğinden sahanın
 * üstündeki içerik çıkarılır; böylece saha kaydırmadan bütünüyle görünür (ekran küçülürse en az 320 px).
 */
function useFitHeight(ref: React.RefObject<HTMLDivElement | null>, layoutKey: string, fullscreen: boolean): number {
  const [height, setHeight] = useState(520);
  useLayoutEffect(() => {
    const measure = () => {
      if (fullscreen) {
        setHeight(Math.max(320, window.innerHeight - FULLSCREEN_MARGIN));
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

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Sakin dakika: boş saha yerine iki takımın birbirini ittiği baskı çubuğu (son dakikaların ataklarına ve topa sahip olmaya göre). */
function DominanceBar({ match, colors, names }: { match: MatchState; colors: Record<Side, string>; names: Record<Side, string> }) {
  const d = dominance(match);
  const home = 50 + d * 42;
  const play = match.lastPlay;
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
  const now = !play
    ? ''
    : play.kind === 'attack' ? `${names[play.side]} atakta`
      : play.kind === 'foul' ? `${names[other(play.side)]} faul yaptı`
        : `${names[play.side]} oyunu kuruyor`;
  const caption = Math.abs(d) < 0.15 ? 'Oyun dengede' : `${names[d > 0 ? 'home' : 'away']} baskılı`;
  return (
    <div className="pitch-quiet">
      <div className="dom-names">
        <span style={{ color: colors.home }}>{names.home}</span>
        <span className="dom-caption">{caption}</span>
        <span style={{ color: colors.away }}>{names.away}</span>
      </div>
      <div className="dom-bar">
        <div className="dom-side home" style={{ width: `${home}%`, background: colors.home }}><span className="dom-arrow">›</span></div>
        <div className="dom-side away" style={{ width: `${100 - home}%`, background: colors.away }}><span className="dom-arrow">‹</span></div>
        <div className="dom-knot" style={{ left: `${home}%` }} />
      </div>
      {now && <div className="dom-now">{now}</div>}
    </div>
  );
}

/**
 * Canlı maçın 2D görünümü (FM'deki "önemli anlar" gibi): yalnızca önemli anlar (şut, gol, duran top,
 * kart, sakatlık, oyuncu değişikliği) kısa bir sahne olarak oynar; sakin dakikalarda baskı çubuğu görünür.
 * Maç başlamadan ve devre arasında takımlar başlama dizilişinde görünür.
 * Akış requestAnimationFrame ile: oyuncular ve top her karede (DOM'a doğrudan) yerleştirilir, React yalnızca
 * sahnenin karesi değişince (adlar, kartlar, etiketler) yeniden çizer.
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
  const spots = useMemo(() => scene.map((f) => frameSpots(match, f, kickoff)), [scene]);
  const starts = useMemo(() => frameStartsMs(scene), [scene]);
  const reveal = scene.length > 0 ? revealIndex(scene) : 0;

  // Boyut: kullanılabilir genişlik ve yükseklik; alan sahadan genişse saha boyuna uzar (geniş ekranı doldursun)
  const maxHeight = useFitHeight(ref, match.period, fullscreen);
  const available = useInnerWidth(ref);
  const view = useMemo(() => makeView(available > 0 ? stretchFor(available, maxHeight) : 1), [available, maxHeight]);
  const stageWidth = available > 0 ? Math.min(available, Math.round((maxHeight * view.w) / view.h)) : 0;

  // Gösterilen kare (adlar, kartlar, etiketler): animasyon döngüsü kare değişince günceller
  const [shown, setShown] = useState({ scene, index: 0 });
  const index = shown.scene === scene ? shown.index : 0;
  const revealed = scene.length > 0 && index >= reveal;
  const frame = scene[Math.min(index, scene.length - 1)];
  const previous = index > 0 ? scene[index - 1] : undefined;

  const dotRefs = useRef(new Map<number, HTMLDivElement>());
  const ballRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /** Önceki sahnenin son yerleri: yeni sahnenin girişinde oyuncular buradan süzülür (ışınlanmasın). */
  const lastPlayers = useRef<Spots | undefined>(undefined);
  const cam = useRef<CameraTransform>({ tx: 0, ty: 0, zoom: 1 });
  const sceneStart = useRef<{ scene: unknown; at: number }>({ scene: null, at: 0 });

  useEffect(() => {
    if (scene.length === 0) {
      lastPlayers.current = undefined;
      return;
    }
    if (stageWidth <= 0) return;
    // Aynı sahne (yalnızca boyut değişti): baştan başlamaz
    if (sceneStart.current.scene !== scene) sceneStart.current = { scene, at: performance.now() };
    const begin = sceneStart.current.at;
    const from = lastPlayers.current;
    const reduce = reducedMotion();
    const end = (starts.at(-1) ?? 0) + SCENE_HOLD_MS;
    let raf = 0;
    let lastIndex = -1;
    let lastTime = performance.now();
    const tick = (now: number) => {
      const t = now - begin;
      let sample = sampleScene(scene, spots, t, from, starts);
      if (reduce && !sample.leadIn) {
        sample = { ...sample, players: spots[sample.index]!, ball: scene[sample.index]!.ball, height: 0 };
      }
      if (sample.index !== lastIndex) {
        lastIndex = sample.index;
        setShown({ scene, index: sample.index });
      }
      const target = scene[sample.index]!;
      // Yakın kamera: topu (sevinçte golcüyü) izler; santra ve başlama dizilişinde tam saha
      const focus = target.focusId !== undefined ? sample.players.get(target.focusId)?.at : undefined;
      const follow = camera === 'follow' && !kickoff && !target.kickoff;
      const desired = cameraTransform(follow ? focus ?? sample.ball : null, CAMERA_ZOOM, view);
      const dt = Math.min(100, now - lastTime);
      lastTime = now;
      const blend = reduce ? 1 : 1 - Math.exp(-dt / CAMERA_LAG_MS);
      const c = cam.current;
      c.tx += (desired.tx - c.tx) * blend;
      c.ty += (desired.ty - c.ty) * blend;
      c.zoom += (desired.zoom - c.zoom) * blend;
      if (cameraRef.current) cameraRef.current.style.transform = `translate(${c.tx * 100}%, ${c.ty * 100}%) scale(${c.zoom})`;
      const unit = screenUnit(c, stageWidth, view);
      layerRef.current?.style.setProperty('--u', `${unit}px`);

      const fadeIn = sample.leadIn && !from ? sample.u : 1;
      for (const [id, el] of dotRefs.current) {
        const s = sample.players.get(id);
        if (!s) {
          el.style.opacity = '0';
          continue;
        }
        const p = toScreen(s.at, c, stageWidth, view);
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        el.style.opacity = String(from?.has(id) || !sample.leadIn ? 1 : fadeIn);
      }
      // Top: gölgesi yerde, kendisi yüksekliği kadar yukarıda ve büyük (havadan giden top)
      const ground = toScreen(sample.ball, c, stageWidth, view);
      const lift = sample.height * unit * 0.55;
      if (shadowRef.current) {
        shadowRef.current.style.transform = `translate3d(${ground.x}px, ${ground.y}px, 0) scale(${1 + sample.height * 0.05})`;
        shadowRef.current.style.opacity = String(fadeIn * Math.max(0.25, 0.55 - sample.height * 0.04));
      }
      if (ballRef.current) {
        ballRef.current.style.transform = `translate3d(${ground.x}px, ${ground.y - lift}px, 0) scale(${1 + sample.height * 0.11})`;
        ballRef.current.style.opacity = String(fadeIn);
      }
      lastPlayers.current = sample.players;
      // Sahne bitince (kamera da oturunca) dur; son hâl ekranda kalır
      const settling = Math.abs(desired.tx - c.tx) + Math.abs(desired.ty - c.ty) + Math.abs(desired.zoom - c.zoom) > 0.001;
      if (t < end || settling) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene, spots, starts, stageWidth, view, camera, kickoff]);

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

  const label = !kickoff && revealed ? playLabel(play) : undefined;
  const banner = bannerKind(play, scene, index, revealed);
  const card = play && revealed ? play.card : undefined;
  const injuredId = revealed ? scene[reveal]?.injuredId : undefined;
  // Gol karesi ve sevinç: golün girdiği file sallanır (santrada durur)
  const goalRipple = play?.kind === 'goal' && revealed && !frame?.kickoff ? play.side : null;

  // Sahnede yer alan herkes (bir karede görünmeyen gizlenir)
  const ids = useMemo(() => [...new Set(spots.flatMap((s) => [...s.keys()]))], [spots]);
  const sides = useMemo(() => new Map(spots.flatMap((s) => [...s].map(([id, v]) => [id, v.side] as const))), [spots]);
  const involved = (id: number) => frame?.carrierId === id || frame?.focusId === id;

  const fullName = (id: number | null | undefined) => (id != null ? world.players[id]?.lastName ?? '' : '');
  const bannerText = banner === 'goal'
    ? { title: 'GOL!', sub: `${fullName(play?.playerId)}${play?.fromPenalty ? ' (penaltı)' : ''}` }
    : banner === 'penalty' ? { title: 'PENALTI!', sub: getClub(world, match[play!.side].clubId).name }
      : banner === 'penaltyMiss' ? { title: 'PENALTI KAÇTI!', sub: fullName(play?.playerId) }
        : banner === 'red' ? { title: 'KIRMIZI KART', sub: fullName(play?.card?.playerId) }
          : null;
  const bannerSide: Side | undefined = banner === 'red' && play?.card ? match.players[play.card.playerId]?.side : play?.side;

  return (
    <div className={`pitch-view${visible ? '' : ' quiet'}`} ref={ref}>
      {/* İki katman: çim ve çizgiler bir kez çizilir; yalnızca oyuncu katmanı boyanır */}
      <div className="pitch-stage" style={{ width: stageWidth || undefined }}>
        {/* Kamera: yalnızca CSS dönüşümü (saha yeniden çizilmez, ekran kartında kayar) */}
        <div className="pitch-camera" ref={cameraRef}>
          <PitchBackground view={view} />
          <svg className="pitch-layer" viewBox={viewBoxOf(view)} aria-hidden="true">
            <defs>
              <pattern id="pitch-net" width={0.55} height={0.55} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M 0 0 H 0.55 M 0 0 V 0.55" stroke="rgba(255,255,255,0.55)" strokeWidth={0.07} />
              </pattern>
            </defs>
            {/* Ev sahibi sağa hücum eder: ev sahibinin golü sağ kaleye */}
            <GoalNet end="left" ripple={goalRipple === 'away' ? `${match.minute}` : null} k={view.k} />
            <GoalNet end="right" ripple={goalRipple === 'home' ? `${match.minute}` : null} k={view.k} />
            {frame && previous && frame.move !== 'none' && frame.move !== 'dribble' && (
              <path
                key={`${match.minute}-${index}`}
                className={`pitch-trail ${frame.move}${play?.kind === 'goal' && frame.result ? ' goal' : ''}`}
                d={ballTrack(previous.ball, frame, view.k)}
              />
            )}
          </svg>
        </div>
        {/* Oyuncu katmanı: büyütülmez; birim (--u, metre başına px) kamerayla gelir; yerleri döngü yazar */}
        <div className="pitch-dots" ref={layerRef} style={{ '--u': `${screenUnit(cam.current, stageWidth, view)}px` } as CSSProperties}>
          {visible && ids.map((id) => {
            const side = sides.get(id) ?? 'home';
            const keeper = match.players[id]?.slot === 'GK';
            const sub = frame?.subs?.find((s) => s.inId === id || s.outId === id);
            const carrier = involved(id);
            const named = carrier || card?.playerId === id || injuredId === id || sub !== undefined;
            // Daha önce sarı kart görmüşse küçük kart; bu dakikanın kartı sonuç karesine kadar gizli
            const booked = match.players[id]?.yellow === true && card?.playerId !== id && !(play?.card?.playerId === id && !revealed);
            const at = frame ? spots[index]?.get(id)?.at : undefined;
            const shirt = keeper ? KEEPER_KIT : kits[side].fill;
            const shorts = keeper ? kits[side].fill : kits[side].stroke;
            return (
              <div
                key={id}
                className="pdot"
                ref={(el) => {
                  if (el) dotRefs.current.set(id, el);
                  else dotRefs.current.delete(id);
                }}
              >
                <div
                  className={`pdot-body${carrier ? ' involved' : ''}${frame?.injuredId === id ? ' down' : ''}`}
                  style={{ background: `linear-gradient(${shirt} ${SHIRT_SPLIT}%, ${shorts} ${SHIRT_SPLIT}%)`, color: keeper ? '#fff' : ink(side) }}
                >
                  {world.players[id]?.squadNumber ?? ''}
                </div>
                {/* Alt kenardaki (değişiklik, atılan oyuncu) adı noktanın üstünde: sahne kutusu taşanı keser */}
                {named && <div className={`pdot-name${at && at.y > PITCH_WIDTH - 2.5 ? ' above' : ''}`}>{world.players[id]?.lastName ?? ''}</div>}
                {card?.playerId === id && <div className={`pdot-card ${card.type}`} />}
                {booked && <div className="pdot-card yellow mini" />}
                {injuredId === id && <div className="pdot-injury">✚</div>}
                {sub && <div className={`pdot-sub ${sub.inId === id ? 'in' : 'out'}`}>{sub.inId === id ? '▲' : '▼'}</div>}
              </div>
            );
          })}
          {visible && <div className="pball-shadow" ref={shadowRef} />}
          {visible && <div className="pball" ref={ballRef}><div className="pball-body" /></div>}
        </div>
        {!visible && (
          <DominanceBar
            match={match}
            colors={{ home: kits.home.fill, away: kits.away.fill }}
            names={{ home: homeClub.name, away: awayClub.name }}
          />
        )}
        {/* Gol anında saha bir an parlar */}
        {banner === 'goal' && index === reveal && <div key={`flash-${match.minute}`} className="pitch-flash" />}
      </div>
      {label && play && !bannerText && play.kind !== 'goal' && (
        <div
          key={`${match.minute}-${play.kind}`}
          className="pitch-label"
          style={{ background: kits[play.side].fill, color: ink(play.side) }}
        >
          {label}
        </div>
      )}
      {bannerText && bannerSide && (
        <div
          key={`${match.minute}-${banner}`}
          className={`pitch-banner ${banner}`}
          style={{ '--banner-bg': kits[bannerSide].fill, '--banner-ink': ink(bannerSide), '--banner-edge': kits[bannerSide].stroke } as CSSProperties}
        >
          <div className="pitch-banner-title">{bannerText.title}</div>
          {bannerText.sub && <div className="pitch-banner-sub">{bannerText.sub}</div>}
        </div>
      )}
    </div>
  );
}

