import { useState } from 'react';
import {
  formatDateTR,
  getClub,
  managerReputation,
  MANAGER_BACKGROUNDS,
  reputationLabel,
  resignJob,
  seasonLabel,
  type ManagerSeason,
  type Trophy,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { Modal } from '../components/Modal';
import { ClubBadge } from '../components/ClubBadge';
import { formatDateShort, MONTHS_SHORT } from '../labels';

const TROPHY_NAMES: Record<Trophy, string> = {
  league: 'Süper Lig',
  cup: 'Türkiye Kupası',
  cl: 'Şampiyonlar Ligi',
  el: 'Avrupa Ligi',
};
const TROPHY_ORDER: readonly Trophy[] = ['cl', 'el', 'league', 'cup'];

/** 'YYYY-MM' → "Eki 2026". */
function monthLabel(month: string): string {
  return `${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** İtibar grafiği (tek seri): 0–100 ekseni, silik ızgara, üstüne gelince dikey çizgi ve değer. */
function ReputationChart({ points }: { points: { month: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="panel-note">Grafik için en az iki aylık geçmiş gerekiyor; itibarın her ay başında kaydedilir.</div>;
  const W = 640;
  const H = 220;
  const pad = { left: 34, right: 12, top: 12, bottom: 26 };
  const x = (i: number) => pad.left + (i / (points.length - 1)) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / 100) * (H - pad.top - pad.bottom);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  // Eksende sezon başları (Temmuz)
  const seasonTicks = points.flatMap((p, i) => (p.month.endsWith('-07') || i === 0 ? [{ i, label: seasonLabel(Number(p.month.slice(0, 4)) - (Number(p.month.slice(5, 7)) < 7 ? 1 : 0)) }] : []));
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - pad.left) / (W - pad.left - pad.right)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const h = hover !== null ? points[hover]! : null;
  return (
    <div className="rep-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Menajer itibarı, aylık" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[20, 40, 60, 80, 100].map((v) => (
          <g key={v} className="rep-grid">
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} />
            <text x={pad.left - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <line className="rep-axis" x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} />
        {seasonTicks.map((t) => (
          <text key={t.i} className="rep-tick" x={x(t.i)} y={H - 8} textAnchor={t.i === 0 ? 'start' : 'middle'}>{t.label}</text>
        ))}
        <path className="rep-line" d={path} />
        {h && hover !== null && (
          <g>
            <line className="rep-cross" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} />
            <circle className="rep-dot" cx={x(hover)} cy={y(h.value)} r={5} />
          </g>
        )}
        {/* Geniş, görünmez yakalama alanı (üstüne gelme kolay olsun) */}
        <rect x={pad.left} y={pad.top} width={W - pad.left - pad.right} height={H - pad.top - pad.bottom} fill="transparent" />
      </svg>
      {h && hover !== null && (
        <div className="rep-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <span className="muted">{monthLabel(h.month)}</span> <strong>{h.value.toFixed(1)}</strong>
        </div>
      )}
    </div>
  );
}

function recordText(s: ManagerSeason): string {
  return s.won === undefined ? '—' : `${s.won}-${s.drawn}-${s.lost}`;
}

/** Menajer kariyeri: itibar, grafik, toplamlar, kupa dolabı, rekorlar ve sezon sezon geçmiş. */
export function ManagerScreen() {
  const world = useWorld();
  const m = world.manager;
  const reputation = managerReputation(world);
  const history = m.reputationHistory ?? [];
  // Bir yıl önceki itibara göre değişim
  const yearAgo = history.length > 12 ? history[history.length - 13]!.value : history[0]?.value ?? reputation;
  const change = reputation - yearAgo;
  const played = m.won + m.drawn + m.lost;
  const seasons = [...(m.seasons ?? [])].reverse();
  const trophies = (m.seasons ?? []).flatMap((s) => s.trophies.map((t) => ({ t, year: s.year, club: s.clubName })));
  const club = world.unemployed ? null : getClub(world, world.playerClubId);
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const setScreen = useGameStore((s) => s.setScreen);
  const [confirmResign, setConfirmResign] = useState(false);
  const resign = () => {
    const error = worldAction((w) => resignJob(w));
    setConfirmResign(false);
    if (error) showNotice(error, 'error');
    else setScreen('jobs');
  };
  const background = m.background ? MANAGER_BACKGROUNDS[m.background] : null;

  return (
    <div className="screen">
      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">{m.name}</h2>
          <div className="panel-body">
            <div className="mgr-rep">
              <div className="mgr-rep-value">{Math.round(reputation)}</div>
              <div>
                <div className="mgr-rep-label">{reputationLabel(Math.round(reputation))} itibar</div>
                <div className="rep-bar wide"><i style={{ width: `${reputation}%` }} /></div>
                <div className={`mgr-rep-change ${change > 0.05 ? 'pos' : change < -0.05 ? 'neg' : 'muted'}`}>
                  {change > 0.05 ? '▲' : change < -0.05 ? '▼' : '•'} {Math.abs(change).toFixed(1)} (son 12 ay)
                </div>
              </div>
            </div>
            <div className="kv"><span className="kv-label">Geçmişi</span><span className="kv-value">{background?.label ?? '—'}</span></div>
            <div className="kv">
              <span className="kv-label">Kulübü</span>
              <span className="kv-value club-cell">
                {club ? <><ClubBadge club={club} size={16} /> {club.name}</> : <span className="muted">İşsiz</span>}
                {club && !world.gameOver && <button className="link-btn mgr-resign" onClick={() => setConfirmResign(true)}>İstifa et</button>}
              </span>
            </div>
            <div className="kv"><span className="kv-label">Göreve başlama</span><span className="kv-value">{formatDateTR(m.joined)}</span></div>
            <div className="kv"><span className="kv-label">Maç</span><span className="kv-value">{played} ({m.won} G, {m.drawn} B, {m.lost} M)</span></div>
            <div className="kv"><span className="kv-label">Galibiyet yüzdesi</span><span className="kv-value">{played > 0 ? `%${Math.round((m.won / played) * 100)}` : '—'}</span></div>
            <div className="panel-note">
              İtibar maç sonuçları (rakibin gücüne göre), sezon hedefi ve kupalarla değişir. Yüksek itibar oyuncuların kulübe gelme
              isteğini artırır ve yönetimi daha sabırlı yapar.
            </div>
          </div>
        </section>
        <section className="panel">
          <h2 className="panel-title">İtibar (aylık)</h2>
          <div className="panel-body">
            <ReputationChart points={history} />
          </div>
        </section>
      </div>

      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">Kupa Dolabı</h2>
          <div className="panel-body">
            {trophies.length === 0 ? (
              <div className="muted">Henüz kupa yok.</div>
            ) : (
              <div className="trophy-cabinet">
                {TROPHY_ORDER.flatMap((kind) => trophies.filter((x) => x.t === kind)).map((x, i) => (
                  <div key={i} className={`trophy trophy-${x.t}`} title={`${TROPHY_NAMES[x.t]} — ${x.club}`}>
                    <span className="trophy-icon">🏆</span>
                    <span className="trophy-name">{TROPHY_NAMES[x.t]}</span>
                    <span className="muted">{seasonLabel(x.year)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel-title">Rekorlar</h2>
          <div className="panel-body">
            <div className="kv">
              <span className="kv-label">En farklı galibiyet</span>
              <span className="kv-value">{m.bestWin ? `${m.bestWin.scored}-${m.bestWin.conceded}, ${m.bestWin.opponent} (${formatDateShort(m.bestWin.date)})` : '—'}</span>
            </div>
            <div className="kv">
              <span className="kv-label">En farklı yenilgi</span>
              <span className="kv-value">{m.worstDefeat ? `${m.worstDefeat.scored}-${m.worstDefeat.conceded}, ${m.worstDefeat.opponent} (${formatDateShort(m.worstDefeat.date)})` : '—'}</span>
            </div>
            <div className="kv"><span className="kv-label">Lig şampiyonluğu</span><span className="kv-value">{m.titles}</span></div>
            <div className="kv"><span className="kv-label">Türkiye Kupası</span><span className="kv-value">{m.cups ?? 0}</span></div>
            <div className="kv"><span className="kv-label">Avrupa kupası</span><span className="kv-value">{m.europeTitles ?? 0}</span></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Kariyer Geçmişi</h2>
        {seasons.length === 0 ? (
          <div className="panel-body muted">İlk sezonun bitince burada görünecek.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sezon</th>
                <th>Kulüp</th>
                <th className="num">Sıra</th>
                <th className="num">Hedef</th>
                <th className="num">G-B-M</th>
                <th className="num">Gol</th>
                <th>Kupalar</th>
                <th className="num">İtibar</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={`${s.year}-${s.clubId}`}>
                  <td className="strong">{seasonLabel(s.year)}</td>
                  <td>
                    {s.clubName}
                    {s.sacked && <span className="tag tag-warn">Görevden alındı</span>}
                    {s.left === 'resigned' && <span className="tag">İstifa</span>}
                    {s.left === 'moved' && <span className="tag">Ayrıldı</span>}
                  </td>
                  <td className={`num${s.position <= s.target ? ' pos' : ' neg'}`}>{s.position}.</td>
                  <td className="num">{s.target}.</td>
                  <td className="num">{recordText(s)}</td>
                  <td className="num">{s.goalsFor === undefined ? '—' : `${s.goalsFor}:${s.goalsAgainst}`}</td>
                  <td>{s.trophies.length === 0 ? <span className="muted">—</span> : s.trophies.map((t) => TROPHY_NAMES[t]).join(', ')}</td>
                  <td className="num">{s.reputation === undefined ? '—' : Math.round(s.reputation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {confirmResign && club && (
        <Modal
          title="İstifa"
          onClose={() => setConfirmResign(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmResign(false)}>Vazgeç</button>
              <button className="btn-continue" onClick={resign}>İstifa Et <span className="btn-continue-arrow">›</span></button>
            </>
          }
        >
          <p>
            {club.name}'dan istifa edeceksin. İtibarın 3 puan düşer ve işsiz kalırsın; kulübünü yapay zekâ yönetir. İş Merkezi'nden boş kulüplere
            başvurabilirsin. 365 gün içinde iş bulamazsan kariyerin sona erer.
          </p>
        </Modal>
      )}
    </div>
  );
}
