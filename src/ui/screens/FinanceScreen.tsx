import {
  emptyReport,
  getClub,
  reportTotals,
  totalWages,
  type ExpenseCategory,
  type IncomeCategory,
  type MonthReport,
} from '../../engine';
import { useWorld } from '../../store/gameStore';
import {
  EXPENSE_LABELS,
  formatMoney,
  formatMonth,
  formatNumber,
  formatSignedMoney,
  INCOME_LABELS,
} from '../labels';

const INCOMES = Object.keys(INCOME_LABELS) as IncomeCategory[];
const EXPENSES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];

function signClass(n: number): string {
  return n < 0 ? 'neg' : n > 0 ? 'pos' : '';
}

/** Birden çok ayın toplamı. */
function sumReports(reports: readonly MonthReport[]): MonthReport {
  const total: MonthReport = { ...emptyReport('Toplam'), balanceEnd: reports[reports.length - 1]?.balanceEnd ?? 0 };
  for (const r of reports) {
    for (const k of INCOMES) total.income[k] += r.income[k] ?? 0;
    for (const k of EXPENSES) total.expense[k] += r.expense[k];
  }
  return total;
}

export function FinanceScreen() {
  const world = useWorld();
  const club = getClub(world, world.playerClubId);
  const fin = world.finances[club.id]!;
  const wages = totalWages(Object.values(world.players), club.id);
  const wageUse = Math.round((wages / fin.wageBudget) * 100);
  const current = reportTotals(fin.current);

  // Bu sezonun ayları (Temmuz'dan itibaren) + içinde bulunulan ay
  const seasonStart = `${world.season.year}-07`;
  const seasonMonths = [...fin.history.filter((r) => r.month >= seasonStart), { ...fin.current, balanceEnd: fin.balance }];
  const season = sumReports(seasonMonths);
  const seasonNet = reportTotals(season).net;

  const homeGames = world.season.fixtures.filter((f) => f.homeId === club.id && f.result?.attendance);
  const avgAttendance = homeGames.length === 0 ? null
    : Math.round(homeGames.reduce((s, f) => s + f.result!.attendance!, 0) / homeGames.length);

  const rows = [...seasonMonths].reverse();

  return (
    <div className="screen">
      <div className="finance-cards">
        <div className="fin-card">
          <div className="fin-label">Kasa</div>
          <div className={`fin-value ${signClass(fin.balance)}`}>{formatSignedMoney(fin.balance)}</div>
        </div>
        <div className="fin-card">
          <div className="fin-label">Transfer Bütçesi</div>
          <div className="fin-value">{formatMoney(fin.transferBudget)}</div>
        </div>
        <div className="fin-card">
          <div className="fin-label">Maaşlar / Maaş Bütçesi (yıllık)</div>
          <div className="fin-value">{formatMoney(wages)} <span className="muted">/ {formatMoney(fin.wageBudget)}</span></div>
          <div className="usage-bar"><i style={{ width: `${Math.min(100, wageUse)}%` }} className={wageUse > 100 ? 'over' : ''} /></div>
        </div>
        <div className="fin-card">
          <div className="fin-label">Bu Ay ({formatMonth(fin.current.month)})</div>
          <div className={`fin-value ${signClass(current.net)}`}>{formatSignedMoney(current.net)}</div>
        </div>
      </div>

      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">Bu Ayın Dökümü</h2>
          <div className="panel-body">
            <div className="sub-head">Gelirler</div>
            {INCOMES.map((k) => (
              <div key={k} className="kv"><span className="kv-label">{INCOME_LABELS[k]}</span><span className="kv-value">{formatMoney(fin.current.income[k])}</span></div>
            ))}
            <div className="sub-head sub-head-gap">Giderler</div>
            {EXPENSES.map((k) => (
              <div key={k} className="kv"><span className="kv-label">{EXPENSE_LABELS[k]}</span><span className="kv-value neg">{formatMoney(fin.current.expense[k])}</span></div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel-title">Gelir Kaynakları</h2>
          <div className="panel-body">
            <div className="kv"><span className="kv-label">Yayın geliri (yıllık)</span><span className="kv-value">{formatMoney(fin.tvIncome)}</span></div>
            <div className="kv"><span className="kv-label">Sponsor geliri (yıllık)</span><span className="kv-value">{formatMoney(fin.sponsorIncome)}</span></div>
            <div className="kv"><span className="kv-label">Ortalama bilet fiyatı</span><span className="kv-value">€{fin.ticketPrice}</span></div>
            <div className="kv"><span className="kv-label">Stadyum kapasitesi</span><span className="kv-value">{formatNumber(club.capacity)}</span></div>
            <div className="kv"><span className="kv-label">Ortalama seyirci</span><span className="kv-value">{avgAttendance === null ? '—' : formatNumber(avgAttendance)}</span></div>
            <div className="sub-head sub-head-gap">Sezon Özeti</div>
            <div className="kv"><span className="kv-label">Toplam gelir</span><span className="kv-value">{formatMoney(reportTotals(season).income)}</span></div>
            <div className="kv"><span className="kv-label">Toplam gider</span><span className="kv-value neg">{formatMoney(reportTotals(season).expense)}</span></div>
            <div className="kv"><span className="kv-label">Net</span><span className={`kv-value ${signClass(seasonNet)}`}>{formatSignedMoney(seasonNet)}</span></div>
            <div className="panel-note">Maaşlar, yayın ve sponsor gelirleri her ayın 1'inde; bilet geliri ve primler maç günü işlenir.</div>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Aylık Raporlar — {world.season.year}/{String((world.season.year + 1) % 100).padStart(2, '0')}</h2>
        <div className="table-scroll">
          <table className="data-table finance-table">
            <thead>
              <tr>
                <th>Ay</th>
                {INCOMES.map((k) => <th key={k} className="num">{INCOME_LABELS[k]}</th>)}
                {EXPENSES.map((k) => <th key={k} className="num">{EXPENSE_LABELS[k]}</th>)}
                <th className="num">Net</th>
                <th className="num">Kasa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = reportTotals(r);
                return (
                  <tr key={r.month} className={r.month === fin.current.month ? 'own-row' : ''}>
                    <td className="strong">{formatMonth(r.month)}{r.month === fin.current.month ? ' (sürüyor)' : ''}</td>
                    {INCOMES.map((k) => <td key={k} className="num">{r.income[k] ? formatMoney(r.income[k]) : '—'}</td>)}
                    {EXPENSES.map((k) => <td key={k} className="num neg">{r.expense[k] ? formatMoney(r.expense[k]) : '—'}</td>)}
                    <td className={`num strong ${signClass(t.net)}`}>{formatSignedMoney(t.net)}</td>
                    <td className="num">{formatSignedMoney(r.balanceEnd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
