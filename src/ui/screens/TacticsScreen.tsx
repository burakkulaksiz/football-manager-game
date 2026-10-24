import { useRef, useState } from 'react';
import { AssistantPanel } from '../components/AssistantPanel';
import {
  LINEUP_ADVICE,
  autoPick,
  BENCH_SIZE,
  changeFormation,
  clubPlayers,
  copyPlan,
  CUSTOM_BOUNDS,
  DEFAULT_ORDERS,
  formationName,
  getClub,
  isDefaultOrders,
  layoutOf,
  moveFormationSpot,
  PLAN_LABELS,
  positionAt,
  setSlotOrders,
  slotOrders,
  slotsOf,
  switchPlan,
  type PlayerOrders,
  type Position,
  lineupFits,
  locate,
  naturalPositions,
  placePlayer,
  POSITIONS,
  primaryPosition,
  removePlayer,
  type Player,
  type SquadTarget,
  type Tactics,
  MAX_COMPARE,
} from '../../engine';
import { CompareBar } from '../components/CompareDialog';
import { useGameStore, useUiState, useWorld } from '../../store/gameStore';
import { FormationPicker, InstructionsPanel, OrdersEditor, PlanPicker, SetPieceStyles } from '../components/InstructionsPanel';
import { Shirt } from '../components/Shirt';
import { StatusTags } from '../components/StatusTags';
import { fitClass, POSITION_LABELS, POSITION_NAMES, positionGroup, ratingClass } from '../labels';

/** Seçili öğe: listeden bir oyuncu ya da sahadaki/yedekteki bir yer. */
type Selection = { kind: 'player'; id: number } | SquadTarget | null;

function sameTarget(a: Selection, b: SquadTarget): boolean {
  return a !== null && a.kind === b.kind && a.index === b.index;
}

function occupant(t: Tactics, target: SquadTarget): number | null {
  return target.kind === 'slot' ? t.lineup[target.index] ?? null : t.bench[target.index] ?? null;
}

function avgForm(p: Player): number | null {
  return p.form.length === 0 ? null : p.form.reduce((a, b) => a + b, 0) / p.form.length;
}

const WIDE_POSITIONS: ReadonlySet<Position> = new Set(['DR', 'DL', 'WBR', 'WBL', 'MR', 'ML', 'AMR', 'AML']);

/** Sahadaki rozet: görev oku (▲ ileri çık, ▼ geride kal) ya da başka bir bireysel talimat (•). */
function ordersBadge(o: PlayerOrders | null | undefined): string | null {
  if (isDefaultOrders(o)) return null;
  return o!.duty === 'attack' ? '▲' : o!.duty === 'defend' ? '▼' : '•';
}

const clampSpot = (x: number, y: number): [number, number] => [
  Math.round(Math.max(CUSTOM_BOUNDS.minX, Math.min(CUSTOM_BOUNDS.maxX, x))),
  Math.round(Math.max(CUSTOM_BOUNDS.minY, Math.min(CUSTOM_BOUNDS.maxY, y))),
];

export function TacticsScreen() {
  const world = useWorld();
  const updateTactics = useGameStore((s) => s.updateTactics);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const tactics = world.tactics[world.playerClubId];
  const club = getClub(world, world.playerClubId);
  const squad = clubPlayers(world, world.playerClubId).sort(
    (a, b) => POSITIONS.indexOf(primaryPosition(a)) - POSITIONS.indexOf(primaryPosition(b)) || (a.squadNumber ?? 99) - (b.squadNumber ?? 99),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const compareIds = useGameStore((s) => s.compareIds);
  const toggleCompare = useGameStore((s) => s.toggleCompare);
  // Sürükle-bırak: sürüklenen (listeden oyuncu ya da sahadaki/yedekteki yer) ve üzerinde durulan hedef
  const dragging = useRef<Selection>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Diziliş düzenleme: sahadaki yerler sürüklenerek taşınır
  const [editShape, setEditShape] = useState(false);
  const [shapeDrag, setShapeDrag] = useState<{ index: number; x: number; y: number } | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const [ordersSlotPref, setOrdersSlot] = useUiState('tactics.ordersSlot', 10);

  if (!tactics) return <section className="panel"><div className="panel-body">Taktik bulunamadı.</div></section>;

  const byId = new Map(squad.map((p) => [p.id, p]));
  const formation = slotsOf(tactics);
  const layout = layoutOf(tactics);
  const activePlan = tactics.activePlan ?? 0;
  /** İmlecin sahadaki yeri (yüzde). */
  const pitchPoint = (e: React.PointerEvent) => {
    const r = pitchRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const fits = lineupFits(tactics, squad);

  /** Kaynaktaki oyuncuyu (listeden oyuncu ya da bir yer) hedefe taşır; hedefte oyuncu varsa yer değiştirirler. */
  const move = (source: NonNullable<Selection>, target: SquadTarget) => {
    if (source.kind === 'player') {
      const playerId = source.id;
      updateTactics((t) => placePlayer(t, target, playerId));
      return;
    }
    if (sameTarget(source, target)) return;
    const playerId = occupant(tactics, source);
    if (playerId !== null) updateTactics((t) => placePlayer(t, target, playerId));
    else {
      // Boş bir yerden başka bir yere: oradaki oyuncu boş yere geçer.
      const moving = occupant(tactics, target);
      if (moving !== null) updateTactics((t) => placePlayer(t, source, moving));
    }
  };

  /** Seçili kaynaktaki oyuncuyu hedefe taşır; seçim yoksa hedefi seçer. */
  const clickTarget = (target: SquadTarget) => {
    if (selection === null) {
      setSelection(target);
      return;
    }
    if (sameTarget(selection, target)) {
      setSelection(null);
      return;
    }
    move(selection, target);
    setSelection(null);
  };

  const targetKey = (t: SquadTarget) => `${t.kind}-${t.index}`;
  /** Sürüklenebilir öğe (oyuncu satırı, dolu saha yeri, dolu yedek hücresi). */
  const dragFrom = (source: NonNullable<Selection>) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragging.current = source;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'player');
      setSelection(null);
    },
    onDragEnd: () => {
      dragging.current = null;
      setDragOver(null);
    },
  });
  /** Bırakma hedefi: saha yeri ya da yedek hücresi. */
  const dropOn = (target: SquadTarget) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOver !== targetKey(target)) setDragOver(targetKey(target));
    },
    onDragLeave: () => setDragOver((k) => (k === targetKey(target) ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const source = dragging.current;
      dragging.current = null;
      setDragOver(null);
      if (source) move(source, target);
    },
  });
  /** Sahadan / yedekten listeye bırakılan oyuncu kadro dışı kalır. */
  const dropOnList = {
    onDragOver: (e: React.DragEvent) => {
      if (dragging.current && dragging.current.kind !== 'player') {
        e.preventDefault();
        if (dragOver !== 'list') setDragOver('list');
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver((k) => (k === 'list' ? null : k));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const source = dragging.current;
      dragging.current = null;
      setDragOver(null);
      if (!source || source.kind === 'player') return;
      const playerId = occupant(tactics, source);
      if (playerId !== null) updateTactics((t) => removePlayer(t, playerId));
    },
  };

  const clickPlayer = (id: number) => {
    if (selection !== null && selection.kind !== 'player') {
      updateTactics((t) => placePlayer(t, selection, id));
      setSelection(null);
      return;
    }
    setSelection(selection?.kind === 'player' && selection.id === id ? null : { kind: 'player', id });
  };

  const selectedPlayerId =
    selection === null ? null : selection.kind === 'player' ? selection.id : occupant(tactics, selection);
  // Bireysel talimat paneli: sahada seçili yer / oyuncu, yoksa son bakılan mevki
  const selectedSlot = selection?.kind === 'slot' ? selection.index : selectedPlayerId !== null ? tactics.lineup.indexOf(selectedPlayerId) : -1;
  const ordersSlot = selectedSlot > 0 ? selectedSlot : Math.min(Math.max(1, ordersSlotPref), formation.length - 1);
  const ordersPlayer = byId.get(tactics.lineup[ordersSlot] ?? -1);

  // Uyarılar
  const warnings: string[] = [];
  const empty = tactics.lineup.filter((id) => id === null).length;
  if (empty > 0) warnings.push(`İlk 11'de ${empty} boş mevki var; maçta otomatik doldurulur.`);
  tactics.lineup.forEach((id, i) => {
    const p = id === null ? undefined : byId.get(id);
    if (!p) return;
    if (p.injury) warnings.push(`${p.firstName} ${p.lastName} sakat; maçta yerine otomatik biri oynar.`);
    if (p.suspension > 0) warnings.push(`${p.firstName} ${p.lastName} cezalı; maçta yerine otomatik biri oynar.`);
    else if (p.condition < 75) warnings.push(`${p.firstName} ${p.lastName} yorgun (kondisyon %${p.condition}).`);
    const fit = fits[i];
    if (fit !== null && fit !== undefined && fit < 0.82) {
      warnings.push(`${p.lastName} ${POSITION_NAMES[formation[i]!].toLocaleLowerCase('tr')} mevkisinde verimsiz (%${Math.round(fit * 100)}).`);
    }
  });
  if (tactics.captainId !== null && !tactics.lineup.includes(tactics.captainId)) warnings.push('Kaptan ilk 11\'de değil.');

  const xiPlayers = tactics.lineup.flatMap((id) => {
    const p = id === null ? undefined : byId.get(id);
    return p ? [p] : [];
  });
  const roleSelect = (label: string, key: 'captainId' | 'viceCaptainId' | 'penaltyTakerId' | 'freeKickTakerId' | 'cornerTakerId' | 'targetManId') => {
    const chosenId = tactics[key] ?? null;
    // Seçili oyuncu ilk 11'den çıktıysa listede yine görünsün, durumu yazsın.
    const chosenOutside = chosenId !== null && !tactics.lineup.includes(chosenId) ? byId.get(chosenId) : undefined;
    return (
      <div className="kv">
        <span className="kv-label">{label}</span>
        <select
          value={chosenId ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            updateTactics((t) => ({ ...t, [key]: v }));
          }}
        >
          <option value="">Otomatik</option>
          {chosenOutside && (
            <option value={chosenOutside.id}>
              {chosenOutside.firstName} {chosenOutside.lastName} (ilk 11&apos;de değil)
            </option>
          )}
          {xiPlayers.map((p) => (
            <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="screen">

      <div className="tactics-grid">
        {/* Kadro listesi */}
        <div className="tactics-main">
        <section className={`panel${dragOver === 'list' ? ' drop-list' : ''}`} {...dropOnList}>
          <h2 className="panel-title">Kadro</h2>
          <table className="data-table clickable tactics-squad">
            <thead>
              <tr>
                <th className="cmp-col" title="Karşılaştırmak için seç (en çok 4)">⇆</th>
                <th>Durum</th>
                <th className="num">No</th>
                <th>İsim</th>
                <th>Mevki</th>
                <th className="num">Kond.</th>
                <th className="num">Form</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const at = locate(tactics, p.id);
                const form = avgForm(p);
                return (
                  <tr
                    key={p.id}
                    className={selectedPlayerId === p.id ? 'selected' : ''}
                    onClick={() => clickPlayer(p.id)}
                    onDoubleClick={() => openPlayer(p.id)}
                    {...dragFrom({ kind: 'player', id: p.id })}
                  >
                    <td className="cmp-col" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={compareIds.includes(p.id)} onChange={() => toggleCompare(p.id)} />
                    </td>
                    <td>
                      {at?.kind === 'slot' ? (
                        <span className={`pos-box pos-${positionGroup(formation[at.index]!)}`}>{POSITION_LABELS[formation[at.index]!]}</span>
                      ) : at?.kind === 'bench' ? (
                        <span className="pos-box status-bench">YDK</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">{p.squadNumber}</td>
                    <td className="strong">
                      {p.firstName} {p.lastName}
                      <StatusTags player={p} />
                    </td>
                    <td>
                      <span className="pos-boxes">
                        {naturalPositions(p).map((pos) => (
                          <span key={pos} className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>
                        ))}
                      </span>
                    </td>
                    <td className="num">%{p.condition}</td>
                    <td className="num">{form === null ? '—' : <span className={ratingClass(form)}>{form.toFixed(1)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <AssistantPanel filter={(a) => LINEUP_ADVICE.has(a.kind) || a.kind === 'thinPosition'} limit={5} hideWhenEmpty />
        <section className="panel">
          <div className="panel-title panel-title-row">
            <span>Taktik {PLAN_LABELS[activePlan]} — {tactics.custom ? `Özel ${formationName(tactics)}` : tactics.formation}</span>
            <span className="toolbar">
              <PlanPicker value={activePlan} onChange={(i) => updateTactics((t, sq) => switchPlan(t, i, sq))} />
              <select
                value=""
                title="Bu setin dizilişini ve talimatlarını başka bir sete kopyalar"
                onChange={(e) => {
                  const to = Number(e.target.value);
                  if (e.target.value !== '') updateTactics((t) => copyPlan(t, activePlan, to));
                }}
              >
                <option value="">Seti kopyala…</option>
                {PLAN_LABELS.map((label, i) => (i === activePlan ? null : <option key={label} value={i}>{PLAN_LABELS[activePlan]} → {label}</option>))}
              </select>
              <button
                className="btn"
                title="Bu diziliş için en iyi 11'i ve yedekleri seçer; talimatlar ve kaptanlar korunur"
                onClick={() => {
                  // Talimatlar ve kaptanlar korunur (kaptanlığı otomatik seçim yüzünden değiştirmek oyuncuları kırar)
                  updateTactics((t, sq) => autoPick(t, sq));
                  setSelection(null);
                }}
              >
                Otomatik Seç
              </button>
            </span>
          </div>
          <div className="panel-body">
            <FormationPicker
              value={tactics.formation}
              custom={tactics.custom}
              onChange={(f) => updateTactics((t, sq) => changeFormation(t, f, sq))}
            />
          </div>
          <div className="panel-note">
            Oyuncuyu sürükleyip sahaya ya da yedeğe bırak (ya da seçip gideceği yere tıkla); yerdeki oyuncuyla yer değiştirir.
            Sahadan listeye bırakılan oyuncu kadro dışı kalır. Çift tık oyuncu profilini açar; ⇆ ile en çok {MAX_COMPARE} oyuncuyu karşılaştırabilirsin.
            Üç taktik seti (A/B/C) kendi dizilişini ve talimatlarını hatırlar; maç sırasında setler arasında geçebilirsin.
            Kendi dizilişin için sahadaki <b>Dizilişi Düzenle</b> ile yerleri sürükle.
          </div>
          <CompareBar hint="en az bir oyuncu daha seç" />
        </section>
        <div className="two-columns">
          <section className="panel">
            <h2 className="panel-title">Takım Talimatları</h2>
            <div className="panel-body">
              <InstructionsPanel
                instructions={tactics.instructions}
                onChange={(change) => updateTactics((t) => ({ ...t, instructions: { ...t.instructions, ...change } }))}
              />
            </div>
          </section>
          <div>
            <section className="panel">
              <div className="panel-title panel-title-row">
                <span>Oyuncu Talimatları</span>
                <select
                  value={ordersSlot}
                  onChange={(e) => {
                    setSelection(null);
                    setOrdersSlot(Number(e.target.value));
                  }}
                >
                  {formation.map((pos, i) => {
                    if (i === 0) return null;
                    const p = byId.get(tactics.lineup[i] ?? -1);
                    return <option key={i} value={i}>{POSITION_LABELS[pos]} — {p ? p.lastName : 'boş'}</option>;
                  })}
                </select>
              </div>
              <div className="panel-body">
                <div className="orders-who">
                  <span className={`pos-box pos-${positionGroup(formation[ordersSlot]!)}`}>{POSITION_LABELS[formation[ordersSlot]!]}</span>
                  <strong>{ordersPlayer ? `${ordersPlayer.firstName} ${ordersPlayer.lastName}` : 'Boş mevki'}</strong>
                  {!isDefaultOrders(slotOrders(tactics, ordersSlot)) && (
                    <button className="btn btn-small" onClick={() => updateTactics((t) => setSlotOrders(t, ordersSlot, DEFAULT_ORDERS))}>
                      Varsayılana Dön
                    </button>
                  )}
                </div>
                <OrdersEditor
                  orders={slotOrders(tactics, ordersSlot)}
                  wide={WIDE_POSITIONS.has(formation[ordersSlot]!)}
                  onChange={(change) => updateTactics((t) => setSlotOrders(t, ordersSlot, change))}
                />
                <div className="panel-note">
                  Talimat mevkiye verilir: o mevkide kim oynarsa uygular (maçta oyuna giren yedek de). Sahada bir oyuncuya tıklayınca
                  onun talimatları açılır; ▲ ileri çıkan, ▼ geride kalan, • başka talimatı olan oyuncu.
                </div>
              </div>
            </section>
            <section className="panel">
              <h2 className="panel-title">Kaptan ve Duran Toplar</h2>
              <div className="panel-body">
                {roleSelect('Kaptan', 'captainId')}
                {roleSelect('Yardımcı Kaptan', 'viceCaptainId')}
                {roleSelect('Penaltıcı', 'penaltyTakerId')}
                {roleSelect('Serbest Vuruşçu', 'freeKickTakerId')}
                {roleSelect('Kornerci', 'cornerTakerId')}
                {roleSelect('Hedef Adam', 'targetManId')}
                <SetPieceStyles
                  instructions={tactics.instructions}
                  onChange={(change) => updateTactics((t) => ({ ...t, instructions: { ...t.instructions, ...change } }))}
                />
                <div className="panel-note">
                  Seçilen oyuncu sahada değilse en iyi vurucu kullanır. Hedef adam kornerlerde ve ortalanan serbest vuruşlarda
                  kafa vuruşlarının çoğunu alır. Kaptanın (sahada değilse yardımcı kaptanın) liderliği takımı biraz etkiler.
                  Kaptan değişikliği oyuncuların moralini etkiler; hiyerarşiyi Takım Dinamikleri ekranında görebilirsin.
                </div>
              </div>
            </section>
            <section className="panel">
              <h2 className="panel-title">Uyarılar</h2>
              <div className="panel-body">
                {warnings.length === 0 ? (
                  <div className="muted">Her şey yolunda.</div>
                ) : (
                  <ul className="warnings">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                )}
                <div className="fit-legend">
                  <span><i className="fit-dot fit-good" /> Doğal mevki</span>
                  <span><i className="fit-dot fit-ok" /> Oynayabilir</span>
                  <span><i className="fit-dot fit-bad" /> Verimsiz</span>
                </div>
              </div>
            </section>
          </div>
        </div>
        </div>

        {/* Saha + yedekler (sahanın yanında): kaydırınca da görünür kalır */}
        <section className="panel tactics-pitch">
          <div className="panel-title panel-title-row">
            <span>İlk 11</span>
            <span className="toolbar pitch-actions">
              {editShape && tactics.custom && (
                <button className="btn btn-small" onClick={() => updateTactics((t, sq) => changeFormation(t, t.formation, sq))}>
                  Hazır Dizilişe Dön ({tactics.formation})
                </button>
              )}
              <button
                className={`btn btn-small${editShape ? ' active' : ''}`}
                title="Sahadaki yerleri sürükleyerek kendi dizilişini oluştur"
                onClick={() => {
                  setEditShape(!editShape);
                  setSelection(null);
                }}
              >
                {editShape ? 'Düzenlemeyi Bitir' : 'Dizilişi Düzenle'}
              </button>
            </span>
            {!editShape && selectedPlayerId !== null && locate(tactics, selectedPlayerId) !== null && (
              <span className="toolbar pitch-actions">
                <span className="muted">Seçili: {byId.get(selectedPlayerId)?.lastName}</span>
                <button className="btn btn-small" onClick={() => toggleCompare(selectedPlayerId)}>
                  {compareIds.includes(selectedPlayerId) ? 'Karşılaştırmadan Çıkar' : 'Karşılaştırmaya Ekle'}
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => {
                    updateTactics((t) => removePlayer(t, selectedPlayerId));
                    setSelection(null);
                  }}
                >
                  Kadro Dışı Bırak
                </button>
              </span>
            )}
          </div>
          <div className="pitch-area">
            <div className="pitch-wrap">
              {editShape && (
                <div className="shape-note">Yerleri sürükle: mevki, sahadaki konuma göre belirlenir. Kaleci yerinde kalır.</div>
              )}
              <div className={`pitch${editShape ? ' editing' : ''}`} ref={pitchRef}>
                {editShape && (
                  <div className="shape-zones" aria-hidden>
                    <span style={{ top: '10%', height: '17%' }}>Forvet</span>
                    <span style={{ top: '27%', height: '15%' }}>Ofansif orta saha</span>
                    <span style={{ top: '42%', height: '15%' }}>Orta saha</span>
                    <span style={{ top: '57%', height: '10%' }}>Ön libero · kanat bek</span>
                    <span style={{ top: '67%', height: '15%' }}>Defans</span>
                  </div>
                )}
                <div className="pitch-line halfway" />
                <div className="pitch-line center-circle" />
                <div className="pitch-line box top" />
                <div className="pitch-line box bottom" />
                <div className="pitch-line six top" />
                <div className="pitch-line six bottom" />
                {formation.map((basePos, i) => {
                  const moving = shapeDrag?.index === i;
                  const [x, y] = moving ? clampSpot(shapeDrag.x, shapeDrag.y) : layout[i]!;
                  const pos = moving ? positionAt(x, y) : basePos;
                  const id = tactics.lineup[i] ?? null;
                  const p = id === null ? undefined : byId.get(id);
                  const fit = moving && p ? null : fits[i];
                  const target: SquadTarget = { kind: 'slot', index: i };
                  const badge = ordersBadge(tactics.orders?.[i]);
                  // Düzenleme kipinde yer sürüklenir (kaleci hariç); normalde oyuncu sürükle-bırak
                  const handlers = editShape
                    ? i === 0 ? {} : {
                      onPointerDown: (e: React.PointerEvent) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setShapeDrag({ index: i, ...pitchPoint(e) });
                      },
                      onPointerMove: (e: React.PointerEvent) => {
                        if (shapeDrag?.index === i) setShapeDrag({ index: i, ...pitchPoint(e) });
                      },
                      onPointerUp: () => {
                        if (shapeDrag?.index !== i) return;
                        const [nx, ny] = clampSpot(shapeDrag.x, shapeDrag.y);
                        updateTactics((t) => moveFormationSpot(t, i, nx, ny));
                        setShapeDrag(null);
                      },
                      onPointerCancel: () => setShapeDrag(null),
                    }
                    : {
                      onClick: () => clickTarget(target),
                      ...(p ? dragFrom(target) : {}),
                      ...dropOn(target),
                    };
                  return (
                    <button
                      key={i}
                      className={`pitch-slot${!editShape && (sameTarget(selection, target) || (p && selectedPlayerId === p.id)) ? ' selected' : ''}${dragOver === targetKey(target) ? ' drop' : ''}${editShape && i > 0 ? ' movable' : ''}${moving ? ' moving' : ''}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                      onDoubleClick={() => p && openPlayer(p.id)}
                      {...handlers}
                      title={p ? `${p.firstName} ${p.lastName} — ${POSITION_NAMES[pos]}` : POSITION_NAMES[pos]}
                    >
                      {p ? (
                        <>
                          <span className="shirt-holder">
                            <Shirt primary={club.colors.primary} secondary={club.colors.secondary} number={p.squadNumber} size={40} />
                            {fit !== null && fit !== undefined && <i className={`fit-dot ${fitClass(fit)}`} />}
                            {tactics.captainId === p.id && <b className="armband">K</b>}
                            {badge && <b className="orders-badge" title="Bireysel talimat">{badge}</b>}
                          </span>
                          <span className="slot-name">{p.lastName}</span>
                        </>
                      ) : (
                        <>
                          <span className="empty-slot">+</span>
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
            <div className="sub-head bench-head">Yedekler ({tactics.bench.length}/{BENCH_SIZE})</div>
            <div className="bench-list">
              {Array.from({ length: BENCH_SIZE }, (_, i) => {
                const id = tactics.bench[i];
                const p = id === undefined ? undefined : byId.get(id);
                // Boş hücreler sona eklenir: tıklanınca ilk boş yere konur.
                const target: SquadTarget = { kind: 'bench', index: Math.min(i, tactics.bench.length) };
                return (
                  <button
                    key={i}
                    className={`bench-cell${p ? '' : ' empty'}${p && selectedPlayerId === p.id ? ' selected' : ''}${dragOver === targetKey(target) ? ' drop' : ''}`}
                    onClick={() => clickTarget(target)}
                    onDoubleClick={() => p && openPlayer(p.id)}
                    {...(p ? dragFrom(target) : {})}
                    {...dropOn(target)}
                  >
                    {p ? (
                      <>
                        <span className={`pos-box pos-${positionGroup(primaryPosition(p))}`}>{POSITION_LABELS[primaryPosition(p)]}</span>
                        <span className="bench-name">{p.lastName}</span>
                      </>
                    ) : (
                      <span className="muted">Boş</span>
                    )}
                  </button>
                );
              })}
            </div>
            </aside>
          </div>
        </section>
      </div>

    </div>
  );
}
