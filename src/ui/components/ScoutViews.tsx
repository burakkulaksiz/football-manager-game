import {
  assignScout,
  attributeRange,
  FULL_KNOWLEDGE,
  knowledgeOf,
  SCOUT_TASKS,
  scoutBlocker,
  scoutingPlayer,
  scoutVerdict,
  type AttributeKey,
  type Player,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { abilityStarsFor, attrClass, formatDateShort, formatMoney, knowledgeLabel, potentialStarsFor, VERDICT_LABELS } from '../labels';
import { Stars } from './Stars';

/** Özellik değeri: biliniyorsa sayı, bilinmiyorsa aralık ("9–15"); renk aralığın ortasına göre. */
export function AttrValue({ player, attr, knowledge }: { player: Player; attr: AttributeKey; knowledge: number }) {
  const world = useWorld();
  const r = attributeRange(world, player, attr, knowledge);
  if (r.lo === r.hi) return <span className={attrClass(r.lo)}>{r.lo}</span>;
  return (
    <span className={`${attrClass(Math.round((r.lo + r.hi) / 2))} attr-range`} title="Tahmini aralık — gözlemci raporuyla kesinleşir">
      {r.lo}–{r.hi}
    </span>
  );
}

/** Yıldız; tahminse yanında soru işareti. */
export function ScoutStars({ value, known }: { value: number; known: boolean }) {
  return (
    <span className="scout-stars">
      <Stars value={value} title={known ? undefined : `Tahmin (${value} / 5) — gözlemci raporuyla netleşir`} />
      {!known && <span className="stars-unsure">?</span>}
    </span>
  );
}

/** Yetenek yıldızı (başka kulübün oyuncusunda tahmin). */
export function AbilityStars({ player }: { player: Player }) {
  const world = useWorld();
  return <ScoutStars value={abilityStarsFor(world, player)} known={knowledgeOf(world, player) >= FULL_KNOWLEDGE} />;
}

/** Potansiyel yıldızı: kendi oyuncumuzda kesin, başkasında her zaman tahmin. */
export function PotentialStars({ player }: { player: Player }) {
  const world = useWorld();
  return <ScoutStars value={potentialStarsFor(world, player)} known={player.clubId === world.playerClubId} />;
}

export function KnowledgeBar({ knowledge }: { knowledge: number }) {
  return (
    <span className="knowledge" title={`Bilgi düzeyi %${knowledge}`}>
      <span className="knowledge-bar"><span style={{ width: `${knowledge}%` }} /></span>
      <span className={knowledge >= FULL_KNOWLEDGE ? 'pos' : 'muted'}>{knowledgeLabel(knowledge)}</span>
    </span>
  );
}

export function VerdictTag({ player }: { player: Player }) {
  const world = useWorld();
  const v = VERDICT_LABELS[scoutVerdict(world, player)];
  return <span className={`verdict ${v.className}`}>{v.text}</span>;
}

/** Profildeki "Gözlemci gönder" düğmesi; görev sürüyorsa rapor tarihi. */
export function ScoutButton({ player }: { player: Player }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  if (knowledgeOf(world, player) >= FULL_KNOWLEDGE) return null;
  const running = scoutingPlayer(world, player.id);
  if (running) {
    return <button className="btn btn-small" disabled>Gözlemcide · rapor {formatDateShort(running.due)}</button>;
  }
  const target = { kind: 'player', playerId: player.id } as const;
  const blocker = scoutBlocker(world, target);
  const task = SCOUT_TASKS.player;
  return (
    <button
      className="btn btn-small"
      disabled={blocker !== null}
      title={blocker ?? `${formatMoney(task.cost)} · rapor ${task.days} gün sonra`}
      onClick={() => {
        const err = worldAction((w) => assignScout(w, target));
        if (err) showNotice(err, 'error');
        else showNotice(`Gözlemci gönderildi; rapor ${task.days} gün sonra gelecek.`);
      }}
    >
      Gözlemci gönder ({formatMoney(task.cost)})
    </button>
  );
}
