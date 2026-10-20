import { addMonths, type Player } from '../../engine';
import { MONTHS_SHORT } from '../labels';

/**
 * Gelişim grafiği: aylık yetenek eğrisi (yetenek puanı gizli olduğu için eksende sayı yok).
 * `large`: profilde, başlangıç ve son ay etiketleriyle.
 */
export function GrowthChart({ player, large = false }: { player: Player; large?: boolean }) {
  const growth = player.growth;
  if (!growth || growth.ca.length < 2) return <span className="muted">—</span>;
  const width = large ? 520 : 96;
  const height = large ? 120 : 24;
  const pad = large ? 6 : 2;
  const values = growth.ca;
  // En az 20 puanlık aralık: küçük oynamalar abartılı görünmesin
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(20, max - min);
  const low = min - (span - (max - min)) / 2;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - low) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const rising = values[values.length - 1]! >= values[0]!;
  const label = (month: string) => `${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

  return (
    <span className={`growth-chart${large ? ' large' : ''}`}>
      {/* Büyük grafik panel genişliğine yayılır (çizgi kalınlığı sabit kalır) */}
      <svg
        width={large ? '100%' : width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={large ? 'none' : undefined}
        aria-label="Gelişim grafiği"
      >
        {large && <polyline className="growth-area" points={`${x(0)},${height - pad} ${points} ${x(values.length - 1)},${height - pad}`} />}
        <polyline className={`growth-line ${rising ? 'up' : 'down'}`} points={points} />
        {/* Yayılan grafikte nokta elipse dönerdi: yalnızca küçük grafikte */}
        {!large && <circle className={`growth-dot ${rising ? 'up' : 'down'}`} cx={x(values.length - 1)} cy={y(values[values.length - 1]!)} r={2} />}
      </svg>
      {large && (
        <span className="growth-axis">
          <span>{label(growth.start)}</span>
          <span>{label(addMonths(growth.start, values.length - 1))}</span>
        </span>
      )}
    </span>
  );
}
