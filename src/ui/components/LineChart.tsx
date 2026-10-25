import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

export interface ChartSeries {
  id: string;
  label: string;
  /** CSS rengi (çizgi, ipucundaki anahtar ve küçük işaret). */
  color: string;
  /** Her x konumundaki değer; null = veri yok (çizgi kopar). */
  values: (number | null)[];
  /** Bağlam serisi: silik, etiketsiz, ipucu ve tabloda yok (diğer takımlar gibi). */
  context?: boolean;
  /** Öne çıkan seri: daha kalın çizgi. */
  primary?: boolean;
  dashed?: boolean;
  /** Çizginin ucunda doğrudan etiket (gösterilmeyecekse false). */
  direct?: boolean;
}

export interface YBand {
  from: number;
  to: number;
  className: string;
}

interface Props {
  series: ChartSeries[];
  /** İpucu başlığı ve tablo satırı: her x konumunun adı. */
  xLabels: string[];
  /** Eksen altındaki etiketler. */
  xTicks: { i: number; label: string }[];
  yDomain: [number, number];
  yTicks: number[];
  /** Büyük değer aşağıda (sıralama: 1 = en üst). */
  invertY?: boolean;
  formatY: (v: number) => string;
  /** İpucunda serilerin altına eklenen satırlar. */
  tooltipExtra?: (i: number) => ReactNode;
  bands?: YBand[];
  ariaLabel: string;
  height?: number;
  /** Tablo görünümünün ilk sütun başlığı. */
  tableHead: string;
}

const W = 720;
const PAD = { left: 34, right: 92, top: 12, bottom: 26 };
const MIN_LABEL_GAP = 13;

/** Yakın etiketleri üst üste binmeyecek şekilde ayırır: önce aşağı iter, taşarsa alttan yukarı sıkıştırır. */
function spreadLabels(items: { id: string; y: number }[], minY: number, maxY: number): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const ys = sorted.map((s) => Math.max(minY, s.y));
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + MIN_LABEL_GAP);
  if (ys.length > 0 && ys[ys.length - 1]! > maxY) {
    ys[ys.length - 1] = maxY;
    for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i]!, ys[i + 1]! - MIN_LABEL_GAP);
  }
  return new Map(sorted.map((s, i) => [s.id, ys[i]!]));
}

/**
 * Çizgi grafik (SVG): silik bağlam çizgileri, öne çıkan seriler, ucunda doğrudan etiket, üstüne gelince / ok tuşlarıyla
 * dikey çizgi ve ipucu, altında tablo görünümü. Tüm değerler tablo görünümünden de okunur.
 */
export function LineChart({ series, xLabels, xTicks, yDomain, yTicks, invertY = false, formatY, tooltipExtra, bands = [], ariaLabel, height = 260, tableHead }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = xLabels.length;
  const shown = series.filter((s) => !s.context);
  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const [lo, hi] = yDomain;
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo);
    return PAD.top + (invertY ? t : 1 - t) * plotH;
  };

  const pathOf = (values: (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const last = (s: ChartSeries) => {
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) return i;
    return -1;
  };
  const labelled = shown.filter((s) => s.direct !== false && last(s) >= 0);
  const labelY = spreadLabels(labelled.map((s) => ({ id: s.id, y: y(s.values[last(s)]!) })), PAD.top + 4, H - PAD.bottom);

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.left) / plotW) * (n - 1)))));
  };
  const key = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' ? -1 : 1;
    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? (step > 0 ? -1 : n)) + step)));
  };

  if (n < 2) return <div className="panel-note">Grafik için en az iki veri noktası gerekiyor.</div>;
  const drawOrder = [...series.filter((s) => s.context), ...shown.filter((s) => !s.primary), ...shown.filter((s) => s.primary)];

  return (
    <div className="viz">
      {shown.length >= 2 && (
        <div className="viz-legend">
          {shown.map((s) => (
            <span key={s.id}>
              <i className={`viz-key${s.dashed ? ' dashed' : ''}`} style={{ color: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="viz-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={move}
          onPointerLeave={() => setHover(null)}
          onKeyDown={key}
          onBlur={() => setHover(null)}
        >
          {bands.map((b, k) => (
            <rect key={k} className={`viz-band ${b.className}`} x={PAD.left} width={plotW} y={Math.min(y(b.from), y(b.to))} height={Math.abs(y(b.to) - y(b.from))} />
          ))}
          {yTicks.map((t) => (
            <g key={t} className="viz-grid">
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{formatY(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t.i} className="viz-tick" x={x(t.i)} y={H - 7} textAnchor={t.i === 0 ? 'start' : t.i === n - 1 ? 'end' : 'middle'}>{t.label}</text>
          ))}
          {drawOrder.map((s) => (
            <path key={s.id} className={`viz-line${s.context ? ' context' : ''}${s.primary ? ' primary' : ''}${s.dashed ? ' dashed' : ''}`} d={pathOf(s.values)} style={s.context ? undefined : { stroke: s.color }} />
          ))}
          {labelled.map((s) => {
            const i = last(s);
            return (
              <g key={s.id}>
                <circle className="viz-dot" cx={x(i)} cy={y(s.values[i]!)} r={4} style={{ fill: s.color }} />
                <text className="viz-label" x={x(i) + 10} y={labelY.get(s.id)! + 4}>{s.label}</text>
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line className="viz-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
              {shown.map((s) => {
                const v = s.values[hover];
                return v === null || v === undefined ? null : <circle key={s.id} className="viz-dot" cx={x(hover)} cy={y(v)} r={4} style={{ fill: s.color }} />;
              })}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className={`viz-tooltip${hover > n * 0.6 ? ' left' : ''}`} style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <div className="viz-tooltip-head">{xLabels[hover]}</div>
            {shown.map((s) => {
              const v = s.values[hover];
              if (v === null || v === undefined) return null;
              return (
                <div key={s.id} className="viz-tooltip-row">
                  <i className={`viz-key${s.dashed ? ' dashed' : ''}`} style={{ color: s.color }} />
                  <strong>{formatY(v)}</strong>
                  <span>{s.label}</span>
                </div>
              );
            })}
            {tooltipExtra?.(hover)}
          </div>
        )}
      </div>
      <button className="link-btn viz-table-toggle" onClick={() => setTable(!table)} aria-expanded={table}>
        {table ? 'Tabloyu gizle' : 'Tablo olarak göster'}
      </button>
      {table && (
        <div className="viz-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tableHead}</th>
                {shown.map((s) => <th key={s.id} className="num">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {xLabels.map((label, i) => (
                <tr key={i}>
                  <td>{label}</td>
                  {shown.map((s) => <td key={s.id} className="num">{s.values[i] === null || s.values[i] === undefined ? '—' : formatY(s.values[i]!)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
