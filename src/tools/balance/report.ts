/** Denge raporunu Markdown'a çevirir; önceki koşu verilirse değişimi gösterir. */
import type { Status } from './stats';
import type { MetricResult, Report } from './types';

const STATUS_ICON: Record<Status, string> = { ok: '✅', uncertain: '❓', off: '❌', info: '·' };

/** Sayı biçimi: birime göre uygun basamak. */
export function fmt(value: number, unit: string): string {
  if (Number.isNaN(value)) return '—';
  const digits = unit === '%' ? 1 : unit === 'oran' || unit === 'r' ? 2 : Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return value.toFixed(digits);
}

const range = (r: MetricResult['target']) => (r ? `${r[0]}–${r[1]}` : '—');

function delta(m: MetricResult, prev: MetricResult | undefined): string {
  if (!prev || Number.isNaN(prev.value) || Number.isNaN(m.value)) return '';
  const d = m.value - prev.value;
  // Standart hatanın altındaki fark gürültü sayılır
  const noise = Math.sqrt((m.se ?? 0) ** 2 + (prev.se ?? 0) ** 2) * 1.96;
  const sign = d > 0 ? '+' : '';
  const text = `${sign}${fmt(d, m.unit)}`;
  return Math.abs(d) <= noise ? `${text} (gürültü)` : `**${text}**`;
}

function row(m: MetricResult, prev: MetricResult | undefined, withDelta: boolean): string {
  const se = m.se !== undefined && Number.isFinite(m.se) ? ` ±${fmt(m.se * 1.96, m.unit)}` : '';
  const cells = [
    `${STATUS_ICON[m.status]} ${m.label}`,
    `${fmt(m.value, m.unit)}${se} ${m.unit}`,
    range(m.target),
    String(m.n),
  ];
  if (withDelta) cells.push(delta(m, prev));
  return `| ${cells.join(' | ')} |`;
}

/** Önceki koşu ile aynı ayarlarla mı çalıştı (karşılaştırma anlamlı mı). */
export function sameConfig(a: Report, b: Report): boolean {
  const ca = a.config;
  const cb = b.config;
  return ca.careers === cb.careers && ca.seasons === cb.seasons && ca.baseSeed === cb.baseSeed && ca.clubs.join() === cb.clubs.join();
}

export function renderMarkdown(report: Report, previous?: Report | null): string {
  const lines: string[] = [];
  const prevById = new Map((previous?.metrics ?? []).map((m) => [m.id, m]));
  const compare = previous !== null && previous !== undefined;
  const counts: Record<Status, number> = { ok: 0, uncertain: 0, off: 0, info: 0 };
  for (const m of report.metrics) counts[m.status]++;

  lines.push('# Denge Raporu', '');
  lines.push(`Üretildi: ${report.generatedAt} · süre ${report.elapsedSec.toFixed(0)} sn`);
  lines.push(`Ayarlar: ${report.config.careers} kariyer × ${report.config.seasons} sezon, başlangıç tohumu ${report.config.baseSeed}`);
  lines.push(`Kulüpler: ${report.config.clubs.join(', ')}`, '');
  for (const n of report.notes) lines.push(`- ${n}`);
  lines.push('');
  lines.push(`**Özet:** ✅ ${counts.ok} hedefte · ❓ ${counts.uncertain} belirsiz · ❌ ${counts.off} hedef dışı · · ${counts.info} bilgi`, '');

  const off = report.metrics.filter((m) => m.status === 'off');
  const uncertain = report.metrics.filter((m) => m.status === 'uncertain');
  lines.push('## Yapılacaklar', '');
  if (off.length === 0 && uncertain.length === 0) lines.push('Hedef dışı ölçü yok.', '');
  for (const m of off) {
    lines.push(`- ❌ **${m.label}**: ${fmt(m.value, m.unit)} ${m.unit} (hedef ${range(m.target)})${m.tune ? ` → bak: ${m.tune}` : ''}`);
  }
  for (const m of uncertain) {
    lines.push(`- ❓ **${m.label}**: ${fmt(m.value, m.unit)} ${m.unit} (hedef ${range(m.target)}); daha fazla kariyer / sezonla tekrar ölç`);
  }
  lines.push('');

  if (compare) {
    lines.push(
      sameConfig(report, previous)
        ? `Önceki koşuyla karşılaştırma (${previous.generatedAt}): aynı ayarlar, fark sütunu aşağıda; "(gürültü)" = fark %95 belirsizlik içinde.`
        : `Önceki koşu (${previous.generatedAt}) farklı ayarlarla çalışmıştı; fark sütunu bilgi içindir, doğrudan kıyaslanamaz.`,
      '',
    );
  }

  const groups = [...new Set(report.metrics.map((m) => m.group))];
  for (const group of groups) {
    lines.push(`## ${group}`, '');
    lines.push(`| Ölçü | Değer (%95 aralık) | Hedef | n |${compare ? ' Fark |' : ''}`);
    lines.push(`|---|---|---|---|${compare ? '---|' : ''}`);
    for (const m of report.metrics.filter((x) => x.group === group)) lines.push(row(m, prevById.get(m.id), compare));
    const notes = report.metrics.filter((x) => x.group === group && x.note);
    if (notes.length > 0) {
      lines.push('');
      for (const m of notes) lines.push(`- *${m.label}:* ${m.note}`);
    }
    lines.push('');
  }

  if (report.trends.length > 0 && report.trends[0]!.values.length > 1) {
    const n = report.trends[0]!.values.length;
    lines.push('## Eğilimler (sezon sırasına göre, kariyerler arası ortalama)', '');
    lines.push(`| Ölçü | ${Array.from({ length: n }, (_, i) => `S${i + 1}`).join(' | ')} |`);
    lines.push(`|---|${Array.from({ length: n }, () => '---').join('|')}|`);
    for (const t of report.trends) lines.push(`| ${t.label} (${t.unit}) | ${t.values.map((v) => fmt(v, t.unit)).join(' | ')} |`);
    lines.push('');
  }

  lines.push('## Hedeflerin kaynağı', '');
  lines.push('- Maç ve gol kralı hedefleri: `src/engine/match/engine.test.ts` ve NOTES.md\'deki ölçümler.');
  lines.push('- "Referans" notlu hedefler gerçek Süper Lig\'in yaklaşık değerleridir; kesin değil, yön göstermek içindir.');
  lines.push('- "Sınır" notlu hedefler uzun vadeli kaymayı yakalamak için kendi koyduğumuz koruma sınırlarıdır.');
  lines.push('- Durum: değer aralıkta → ✅; aralık dışı ama %95 güven aralığı aralığa değiyorsa → ❓ (örnek artırılınca netleşir); değilse ❌.');
  lines.push('- Hedefler `src/tools/balance/metrics.ts` içinde.', '');
  return lines.join('\n');
}
