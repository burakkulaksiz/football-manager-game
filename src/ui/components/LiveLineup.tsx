import { useRef, useState } from 'react';
import { getClub, layoutOf, MAX_SUBS, primaryPosition, slotFit, slotHolders, slotsOf, type MatchState } from '../../engine';
import { liveUndoCount, useGameStore, userSide, useWorld } from '../../store/gameStore';
import { fitClass, POSITION_LABELS, POSITION_NAMES, positionGroup } from '../labels';
import { Shirt } from './Shirt';

/** Sürüklenen ya da seçilen oyuncu: sahadan ya da yedekten. */
type Pick = { from: 'pitch' | 'bench'; id: number } | null;

/** Son değişikliği geri alma düğmesi: maç ilerleyene kadar (oyuncu, yer, taktik değişikliği). */
export function UndoButton() {
  const count = useGameStore(liveUndoCount);
  const undo = useGameStore((s) => s.undoLiveChange);
  if (count === 0) return null;
  return (
    <button className="btn btn-small" onClick={undo} title="Son değişikliği geri al (maç ilerleyene kadar geri alınabilir)">
      ↶ Geri Al{count > 1 ? ` (${count})` : ''}
    </button>
  );
}

/**
 * Maç içi saha düzeni (Taktik ekranındaki gibi): yedeği sahadaki oyuncunun üstüne bırakmak değişiklik, sahadaki iki oyuncu
 * yer değiştirir. Sürüklemek yerine önce birine, sonra diğerine tıklanabilir.
 */
export function LiveLineup({ match }: { match: MatchState }) {
  const world = useWorld();
  const substitute = useGameStore((s) => s.liveSubstitute);
  const swap = useGameStore((s) => s.liveSwap);
  const showNotice = useGameStore((s) => s.showNotice);
  const [selected, setSelected] = useState<Pick>(null);
  const dragging = useRef<Pick>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const side = userSide(match, world);
  const team = match[side];
  const club = getClub(world, team.clubId);
  const slots = slotsOf(team);
  const layout = layoutOf(team);
  const holders = slotHolders(team, match.players);
  const subsLeft = team.subsUsed < MAX_SUBS;

  /** Kaynaktaki oyuncuyu hedefteki oyuncuyla buluşturur: yedek ↔ saha değişiklik, saha ↔ saha yer değişimi. */
  const act = (source: NonNullable<Pick>, target: NonNullable<Pick>) => {
    if (source.id === target.id) return;
    if (source.from === 'pitch' && target.from === 'pitch') {
      swap(source.id, target.id);
      return;
    }
    if (source.from === 'bench' && target.from === 'bench') return;
    if (!subsLeft) {
      showNotice(`Değişiklik hakkın kalmadı (${MAX_SUBS}/${MAX_SUBS}).`);
      return;
    }
    const [out, incoming] = source.from === 'pitch' ? [source.id, target.id] : [target.id, source.id];
    substitute(out, incoming);
  };

  const click = (target: NonNullable<Pick>) => {
    if (selected === null) setSelected(target);
    else {
      act(selected, target);
      setSelected(null);
    }
  };

  const dnd = (target: NonNullable<Pick>) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragging.current = target;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'player');
      setSelected(null);
    },
    onDragEnd: () => {
      dragging.current = null;
      setDragOver(null);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOver !== target.id) setDragOver(target.id);
    },
    onDragLeave: () => setDragOver((id) => (id === target.id ? null : id)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const source = dragging.current;
      dragging.current = null;
      setDragOver(null);
      if (source) act(source, target);
    },
    onClick: () => click(target),
  });

  const isSelected = (id: number) => selected?.id === id;

  return (
    <div className="live-lineup">
      <div className="live-lineup-head">
        <span className="muted">
          {selected === null
            ? 'Sürükle-bırak: yedeği sahadaki oyuncunun üstüne bırak (değişiklik); sahadaki iki oyuncu yer değiştirir.'
            : selected.from === 'bench' ? 'Şimdi çıkacak oyuncuya tıkla.' : 'Şimdi girecek yedeğe ya da yer değiştireceği oyuncuya tıkla.'}
        </span>
        <span className="toolbar">
          <span className="muted">Değişiklik {team.subsUsed}/{MAX_SUBS}</span>
          <UndoButton />
        </span>
      </div>
      <div className="pitch-area">
        <div className="pitch-wrap">
          <div className="pitch">
            <div className="pitch-line halfway" />
            <div className="pitch-line center-circle" />
            <div className="pitch-line box top" />
            <div className="pitch-line box bottom" />
            <div className="pitch-line six top" />
            <div className="pitch-line six bottom" />
            {slots.map((pos, i) => {
              const [x, y] = layout[i]!;
              const id = holders[i] ?? null;
              const p = id === null ? undefined : world.players[id];
              const ps = id === null ? undefined : match.players[id];
              return (
                <button
                  key={i}
                  className={`pitch-slot${id !== null && isSelected(id) ? ' selected' : ''}${id !== null && dragOver === id ? ' drop' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={p ? `${p.firstName} ${p.lastName} — ${POSITION_NAMES[pos]}${ps ? ` · kondisyon %${Math.round(ps.condition)}` : ''}` : POSITION_NAMES[pos]}
                  {...(id === null ? {} : dnd({ from: 'pitch', id }))}
                >
                  {p ? (
                    <>
                      <span className="shirt-holder">
                        <Shirt primary={club.colors.primary} secondary={club.colors.secondary} number={p.squadNumber} size={34} />
                        <i className={`fit-dot ${fitClass(slotFit(p, pos))}`} />
                      </span>
                      <span className="slot-name">{p.lastName}</span>
                      {ps && (
                        <span className="cond-bar" title={`Kondisyon %${Math.round(ps.condition)}`}>
                          <i style={{ width: `${ps.condition}%` }} className={ps.condition < 65 ? 'low' : ''} />
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="empty-slot">–</span>
                      <span className="slot-name muted">{POSITION_LABELS[pos]}</span>
                    </>
                  )}
                  <span className={`slot-pos pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <aside className="bench-side">
          <div className="sub-head bench-head">Yedekler</div>
          <div className="bench-list">
            {team.bench.length === 0 && <span className="muted">Yedek kalmadı.</span>}
            {team.bench.map((id) => {
              const p = world.players[id]!;
              const pos = primaryPosition(p);
              return (
                <button
                  key={id}
                  className={`bench-cell${isSelected(id) ? ' selected' : ''}${dragOver === id ? ' drop' : ''}`}
                  {...dnd({ from: 'bench', id })}
                >
                  <span className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>
                  <span className="bench-name">{p.lastName}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
