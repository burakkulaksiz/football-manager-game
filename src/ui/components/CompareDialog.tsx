import { useState, type ReactNode } from 'react';
import {
  ageOn,
  attributeEstimate,
  compareAdvice,
  getClub,
  GOALKEEPING_ATTRS,
  knowledgeOf,
  marketValue,
  MAX_COMPARE,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  playerSeasonStats,
  primaryPosition,
  TECHNICAL_ATTRS,
  type AttributeKey,
  type CompareNote,
  type Player,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { abilityStarsFor, ATTRIBUTE_LABELS, formatMoney, moraleLabel, POSITION_NAMES, potentialStarsFor } from '../labels';
import { PositionBoxes } from '../screens/SquadScreen';
import { Modal } from './Modal';
import { AbilityStars, AttrValue, PotentialStars } from './ScoutViews';

/** Yüksek olması iyi ya da kötü sayılamayan özellikler (vurgulanmaz, sayılmaz). */
const NEUTRAL_ATTRS: ReadonlySet<AttributeKey> = new Set(['aggression', 'eccentricity']);

/** En iyi değerin sütunu (tek başına en iyiyse); eşitlikte ya da değer yoksa null. */
function bestIndex(values: readonly (number | undefined)[], higherIsBetter = true): number | null {
  if (values.some((v) => v === undefined)) return null;
  const nums = values as number[];
  const target = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  const at = nums.filter((v) => v === target).length === 1 ? nums.indexOf(target) : null;
  return at;
}

function CompareRow({ label, cells, values, higherIsBetter }: {
  label: string;
  cells: ReactNode[];
  values?: (number | undefined)[];
  higherIsBetter?: boolean;
}) {
  const best = values ? bestIndex(values, higherIsBetter) : null;
  return (
    <div className="cmp-row">
      <span className="cmp-label">{label}</span>
      {cells.map((c, i) => <span key={i} className={`cmp-val${best === i ? ' better' : ''}`}>{c}</span>)}
    </div>
  );
}

const names = (ps: readonly Player[]) => {
  const list = ps.map((p) => p.lastName);
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} ve ${list[list.length - 1]}`;
};

/** Yardımcı antrenörün notunun metni. */
function noteText(note: CompareNote, byId: Map<number, Player>): string {
  const ps = note.playerIds.map((id) => byId.get(id)!).filter(Boolean);
  const n = names(ps);
  switch (note.kind) {
    case 'pick': return `Önerim ${n}.`;
    case 'best': return `${n} şu an açık ara en iyisi.`;
    case 'close': return `${n} arasında fark az; form ve kondisyon belirleyici olur.`;
    case 'future': return `${n} potansiyeliyle ileride hepsini geçebilir.`;
    case 'inXI': return `${n} şu an ilk 11'imizde.`;
    case 'fitsXI': return `${n} ilk 11'imize girer.`;
    case 'rotation': return `${n} rotasyonda işimize yarar.`;
    case 'prospect': return `${n} geleceğin oyuncusu olabilir.`;
    case 'notNeeded': return `${n} kadromuza katkı sağlamaz.`;
    case 'value': return `Fiyat/performans: ${n} benzer seviyede, çok daha ucuz.`;
    case 'unknown': return `${n} hakkında bilgimiz az; karar vermeden önce gözlemci göndermeni öneririm.`;
    case 'injured': return `${n} sakat.`;
    case 'tired': return `${n} yorgun.`;
    case 'mixedPositions': return 'Farklı mevkilerdeki oyuncuları karşılaştırıyorsun; özellik farklarının bir kısmı mevkiden kaynaklanır.';
  }
}

/** Oyuncu karşılaştırması (2–4 oyuncu): sütun başına bir oyuncu, satırda en iyi değer vurgulu, üstte yardımcı antrenör notu. */
export function CompareDialog({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const toggleCompare = useGameStore((s) => s.toggleCompare);
  const players = ids.map((id) => world.players[id]).filter((p): p is Player => p !== undefined);
  const byId = new Map(players.map((p) => [p.id, p]));
  const stats = players.map((p) => playerSeasonStats(world.season.fixtures, p.id));
  // Tanımadığımız oyuncuda özellikler aralık; karşılaştırma aralığın ortasıyla
  const knowledge = players.map((p) => knowledgeOf(world, p));
  const est = (i: number, k: AttributeKey) => attributeEstimate(world, players[i]!, k, knowledge[i]);
  const keepers = players.filter((p) => primaryPosition(p) === 'GK').length;
  const groups: { title: string; keys: readonly AttributeKey[] }[] = [
    ...(keepers < players.length ? [{ title: 'Teknik', keys: TECHNICAL_ATTRS }] : []),
    ...(keepers > 0 ? [{ title: 'Kalecilik', keys: GOALKEEPING_ATTRS }] : []),
    { title: 'Zihinsel', keys: MENTAL_ATTRS },
    { title: 'Fiziksel', keys: PHYSICAL_ATTRS },
  ];
  // Kaç özellikte tek başına en iyi
  const wins = players.map(() => 0);
  for (const g of groups) {
    for (const k of g.keys) {
      if (NEUTRAL_ATTRS.has(k)) continue;
      const b = bestIndex(players.map((_, i) => est(i, k)));
      if (b !== null) wins[b]!++;
    }
  }
  const notes = compareAdvice(world, players);
  const row = (label: string, cell: (p: Player, i: number) => ReactNode, value?: (p: Player, i: number) => number | undefined, higherIsBetter = true) => (
    <CompareRow label={label} cells={players.map(cell)} values={value ? players.map(value) : undefined} higherIsBetter={higherIsBetter} />
  );

  if (players.length < 2) return null;
  return (
    <Modal title={`Oyuncu Karşılaştırma (${players.length})`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Kapat</button>}>
      <div className={`compare n${players.length}`} style={{ '--cmp-cols': players.length } as React.CSSProperties}>
        {notes.length > 0 && (
          <div className="cmp-advice">
            <div className="cmp-advice-title">Yardımcı Antrenör</div>
            <ul>{notes.map((n, i) => <li key={i} className={n.kind === 'pick' ? 'strong' : undefined}>{noteText(n, byId)}</li>)}</ul>
          </div>
        )}
        <div className="cmp-row cmp-header">
          <span />
          {players.map((p) => (
            <div key={p.id} className="cmp-head">
              <button className="cmp-name link" onClick={() => { onClose(); openPlayer(p.id); }}>{p.firstName} {p.lastName}</button>
              <div className="muted">{p.clubId ? getClub(world, p.clubId).name : 'Serbest'} · {POSITION_NAMES[primaryPosition(p)]}</div>
              <PositionBoxes player={p} />
              {players.length > 2 && <button className="cmp-remove" title="Karşılaştırmadan çıkar" onClick={() => toggleCompare(p.id)}>✕</button>}
            </div>
          ))}
        </div>
        <div className="sub-head">Genel</div>
        {row('Yaş', (p) => ageOn(p.birthDate, world.date))}
        {row('Piyasa değeri', (p) => formatMoney(marketValue(p, world.date)), (p) => marketValue(p, world.date))}
        {row('Maaş', (p) => formatMoney(p.contract.wage))}
        {row('Yetenek', (p) => <AbilityStars player={p} />, (p) => abilityStarsFor(world, p))}
        {row('Potansiyel', (p) => <PotentialStars player={p} />, (p) => potentialStarsFor(world, p))}
        {row('Kondisyon', (p) => `%${p.condition}`, (p) => p.condition)}
        {row('Moral', (p) => moraleLabel(p.morale), (p) => p.morale)}
        {row('Sezon: maç / gol / asist', (_, i) => `${stats[i]!.apps} / ${stats[i]!.goals} / ${stats[i]!.assists}`)}
        {row('Sezon: ort. puan', (_, i) => stats[i]!.avgRating?.toFixed(2) ?? '—', (_, i) => stats[i]!.avgRating ?? undefined)}
        {groups.map((g) => (
          <div key={g.title}>
            <div className="sub-head sub-head-gap">{g.title}</div>
            {g.keys.map((k) => row(
              ATTRIBUTE_LABELS[k],
              (p, i) => <AttrValue player={p} attr={k} knowledge={knowledge[i]!} />,
              NEUTRAL_ATTRS.has(k) ? undefined : (_, i) => est(i, k),
            ))}
          </div>
        ))}
        <div className="cmp-summary">
          {players.map((p, i) => `${p.lastName} ${wins[i]}`).join(' · ')} özellikte tek başına önde.
        </div>
      </div>
    </Modal>
  );
}

/** Karşılaştırma şeridi: seçilenler, "Karşılaştır" (2–4 oyuncu) ve "Temizle"; pencere buradan açılır. */
export function CompareBar({ hint = 'en az bir oyuncu daha seç (başka kulüpten de olabilir)' }: { hint?: string }) {
  const world = useWorld();
  const compareIds = useGameStore((s) => s.compareIds);
  const toggleCompare = useGameStore((s) => s.toggleCompare);
  const clearCompare = useGameStore((s) => s.clearCompare);
  const [open, setOpen] = useState(false);
  const players = compareIds.map((id) => world.players[id]).filter((p): p is Player => p !== undefined);
  if (players.length === 0) return null;
  return (
    <>
      <div className="compare-bar">
        <span>Karşılaştırma ({players.length}/{MAX_COMPARE}):</span>
        {players.map((p) => (
          <span key={p.id} className="compare-chip">
            {p.firstName} {p.lastName}
            <button title="Çıkar" onClick={() => toggleCompare(p.id)}>✕</button>
          </span>
        ))}
        {players.length < 2 && <span className="muted">{hint}</span>}
        <button className="btn btn-small btn-go" disabled={players.length < 2} onClick={() => setOpen(true)}>Karşılaştır</button>
        <button className="btn btn-small" onClick={clearCompare}>Temizle</button>
      </div>
      {open && players.length >= 2 && <CompareDialog ids={players.map((p) => p.id)} onClose={() => setOpen(false)} />}
    </>
  );
}
