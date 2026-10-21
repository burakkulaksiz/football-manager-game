import { useState } from 'react';
import {
  ageOn,
  assignScout,
  cancelScout,
  daysBetween,
  getClub,
  marketValue,
  MAX_ASSIGNMENTS,
  POSITIONS,
  SCOUT_TASKS,
  scoutBlocker,
  type GameWorld,
  type Position,
  type ScoutReport,
  type ScoutTarget,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDateShort, formatMoney, POSITION_LABELS, POSITION_NAMES, positionGroup } from '../labels';
import { ClubBadge } from './ClubBadge';
import { AbilityStars, PotentialStars, VerdictTag } from './ScoutViews';

const SEARCH_VALUE_LIMITS = [0, 500_000, 1_000_000, 3_000_000, 5_000_000, 10_000_000];

/** Görevin / raporun kısa tanımı. */
export function scoutTargetLabel(world: GameWorld, t: ScoutTarget): string {
  if (t.kind === 'player') {
    const p = world.players[t.playerId];
    return p ? `Oyuncu: ${p.firstName} ${p.lastName}` : 'Oyuncu (artık oyunda değil)';
  }
  if (t.kind === 'club') return `Kulüp taraması: ${getClub(world, t.clubId).name}`;
  const parts = [t.position ? POSITION_NAMES[t.position] : 'Tüm mevkiler', `en fazla ${t.maxAge} yaş`];
  if (t.maxValue > 0) parts.push(`değeri en fazla ${formatMoney(t.maxValue)}`);
  return `Arama: ${parts.join(' · ')}`;
}

function TaskButton({ target, label }: { target: ScoutTarget; label: string }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const task = SCOUT_TASKS[target.kind];
  const blocker = scoutBlocker(world, target);
  return (
    <button
      className="btn btn-go"
      disabled={blocker !== null}
      title={blocker ?? ''}
      onClick={() => {
        const err = worldAction((w) => assignScout(w, target));
        if (err) showNotice(err, 'error');
        else showNotice(`Gözlemci yola çıktı; rapor ${task.days} gün sonra gelecek.`);
      }}
    >
      {label} · {formatMoney(task.cost)} · {task.days} gün
    </button>
  );
}

function ReportTable({ report }: { report: ScoutReport }) {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const players = report.playerIds.map((id) => world.players[id]).filter((p) => p !== undefined);
  if (players.length === 0) return <div className="panel-body muted">Raporda oyuncu yok.</div>;
  return (
    <table className="data-table clickable">
      <thead>
        <tr>
          <th>Oyuncu</th>
          <th>Kulüp</th>
          <th>Mevki</th>
          <th className="num">Yaş</th>
          <th>Yetenek</th>
          <th>Potansiyel</th>
          <th>Gözlemcinin görüşü</th>
          <th className="num">Değer</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const club = p.clubId ? getClub(world, p.clubId) : null;
          const own = p.clubId === world.playerClubId;
          return (
            <tr key={p.id} onClick={() => openPlayer(p.id)}>
              <td className="strong">
                {p.firstName} {p.lastName}
                {p.academy && <span className="tag tag-u19">U19</span>}
              </td>
              <td>{club ? <span className="club-cell"><ClubBadge club={club} size={16} /> {club.name}</span> : <span className="tag tag-free">Serbest</span>}</td>
              <td>
                <span className="pos-boxes">
                  {POSITIONS.filter((pos) => (p.positions[pos] ?? 0) >= 18).map((pos) => (
                    <span key={pos} className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>
                  ))}
                </span>
              </td>
              <td className="num">{ageOn(p.birthDate, world.date)}</td>
              <td><AbilityStars player={p} /></td>
              <td><PotentialStars player={p} /></td>
              <td>{own ? <span className="muted">Artık bizim oyuncumuz</span> : <VerdictTag player={p} />}</td>
              <td className="num value">{formatMoney(marketValue(p, world.date))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Transfer Merkezi → Gözlemciler: süren görevler, yeni görev, raporlar. */
export function ScoutingTab() {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const [position, setPosition] = useState<Position | ''>('');
  const [maxAge, setMaxAge] = useState(23);
  const [maxValue, setMaxValue] = useState(0);
  const others = world.clubs.filter((c) => c.id !== world.playerClubId).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const [clubId, setClubId] = useState(others[0]?.id ?? '');
  const reports = [...world.scouting.reports].reverse();
  // Seçilmediyse en yeni rapor açık (sekme açıkken yeni rapor gelirse o açılır)
  const [picked, setOpen] = useState<number | null | undefined>(undefined);
  const open = picked === undefined ? (reports[0]?.id ?? null) : picked;
  const assignments = world.scouting.assignments;

  return (
    <>
      <div className="panel-note">
        Tanımadığın oyuncuların özellikleri aralık olarak, yetenek ve potansiyelleri tahmin (?) olarak görünür. Karşılaştığın
        takımların oyuncularını maçlarda biraz tanırsın; tam bilgi gözlemci raporuyla gelir. Gözlemci ağın aynı anda{' '}
        {MAX_ASSIGNMENTS} görev yürütür; ücret transfer bütçesinden düşer. Tek bir oyuncu için profildeki "Gözlemci gönder"
        düğmesini kullan.
      </div>

      <div className="sub-head">Süren Görevler ({assignments.length} / {MAX_ASSIGNMENTS})</div>
      {assignments.length === 0 ? (
        <div className="panel-body muted">Şu an görevde gözlemcin yok.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Görev</th><th>Başladı</th><th>Rapor</th><th>İlerleme</th><th></th></tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const total = Math.max(1, daysBetween(a.started, a.due));
              const done = Math.min(total, Math.max(0, daysBetween(a.started, world.date)));
              return (
                <tr key={a.id}>
                  <td className="strong">{scoutTargetLabel(world, a.target)}</td>
                  <td>{formatDateShort(a.started)}</td>
                  <td>{formatDateShort(a.due)}</td>
                  <td>
                    <span className="knowledge-bar wide"><span style={{ width: `${(done / total) * 100}%` }} /></span>
                    <span className="muted"> {total - done} gün kaldı</span>
                  </td>
                  <td className="actions">
                    <button className="btn btn-small" title="Ücret geri gelmez" onClick={() => worldAction((w) => cancelScout(w, a.id))}>İptal</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="sub-head sub-head-gap">Yeni Görev</div>
      <div className="scout-forms">
        <div className="scout-form">
          <div className="strong">Oyuncu araması</div>
          <div className="muted">Gözlemcin ölçütlere uyan oyuncular arasından en iyi {5} adayı bulup tam rapor verir.</div>
          <div className="filters">
            <label>
              <span>Mevki</span>
              <select value={position} onChange={(e) => setPosition(e.target.value as Position | '')}>
                <option value="">Tümü</option>
                {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_NAMES[p]}</option>)}
              </select>
            </label>
            <label>
              <span>En fazla yaş</span>
              <input type="number" min={16} max={40} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} />
            </label>
            <label>
              <span>En fazla değer</span>
              <select value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))}>
                {SEARCH_VALUE_LIMITS.map((v) => <option key={v} value={v}>{v === 0 ? 'Sınırsız' : formatMoney(v)}</option>)}
              </select>
            </label>
          </div>
          <TaskButton target={{ kind: 'search', position: position || null, maxAge, maxValue }} label="Aramaya gönder" />
        </div>
        <div className="scout-form">
          <div className="strong">Kulüp taraması</div>
          <div className="muted">Gözlemcin kulübün A takım kadrosunu izler; oyuncular çok daha iyi tanınır (tam değil).</div>
          <div className="filters">
            <label>
              <span>Kulüp</span>
              <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
                {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <TaskButton target={{ kind: 'club', clubId }} label="Taramaya gönder" />
        </div>
      </div>

      <div className="sub-head sub-head-gap">Raporlar</div>
      {reports.length === 0 ? (
        <div className="panel-body muted">Henüz rapor yok.</div>
      ) : (
        reports.map((r) => (
          <div key={r.id} className="scout-report">
            <button className="scout-report-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span>{open === r.id ? '▾' : '▸'}</span>
              <span className="muted">{formatDateShort(r.date)}</span>
              <span className="strong">{scoutTargetLabel(world, r.target)}</span>
              <span className="muted">{r.playerIds.length} oyuncu</span>
            </button>
            {open === r.id && <ReportTable report={r} />}
          </div>
        ))
      )}
    </>
  );
}
