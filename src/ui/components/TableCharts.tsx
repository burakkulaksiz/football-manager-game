import { useMemo } from 'react';
import { computeStandings, EUROPE, getClub, leagueClubs, type Club } from '../../engine';
import { useUiState, useWorld } from '../../store/gameStore';
import { formSeries, positionHistory, FORM_WINDOW } from '../chartData';
import { formatDayMonth, MONTHS_SHORT, OUTCOME_LABELS } from '../labels';
import { LineChart, type ChartSeries } from './LineChart';
import { OutcomeBox } from './OutcomeBox';

/** Karşılaştırma çizgilerinin renkleri: sabit sırayla (koyu zemin için doğrulanmış kategorik dizi). */
const COMPARE_COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)'];
const MAX_COMPARE = COMPARE_COLORS.length;

/** Eksen etiketleri: ilk ve son dahil, en fazla `max` tane ve birbirine çok yakın olmayacak şekilde. */
function spacedTicks(indices: number[], n: number, minGap: number): { i: number; label: string }[] {
  const out: { i: number; label: string }[] = [];
  for (const i of indices) {
    if (out.length > 0 && i - out[out.length - 1]!.i < minGap) continue;
    if (i !== n - 1 && n - 1 - i < minGap) continue;
    out.push({ i, label: String(i) });
  }
  return out;
}

function PositionChart() {
  const world = useWorld();
  const [compare, setCompare] = useUiState<string[]>('table.compare', []);
  const clubs = leagueClubs(world);
  const ids = clubs.map((c) => c.id);
  const fixtures = world.season.fixtures;
  // Dünya yerinde değişir: yeniden hesap, oynanan lig maçı sayısına bağlı
  const playedLeague = fixtures.filter((f) => f.competition === undefined && f.result !== null).length;
  const history = useMemo(() => positionHistory(ids, fixtures), [playedLeague, world.season.year]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = history.rounds.length;
  const total = clubs.length;
  // Seçilebilecek kulüpler güncel sıraya göre
  const order = computeStandings(ids, fixtures).map((r) => getClub(world, r.clubId));
  const picked = compare.filter((id) => id !== world.playerClubId && ids.includes(id)).slice(0, MAX_COMPARE);
  const leaderAt = (i: number) => ids.find((id) => history.positions.get(id)![i] === 1);

  const series: ChartSeries[] = ids.map((id) => {
    const club = getClub(world, id);
    const mine = id === world.playerClubId;
    const k = picked.indexOf(id);
    return {
      id,
      label: club.shortName,
      color: mine ? 'var(--accent)' : k >= 0 ? COMPARE_COLORS[k]! : 'var(--viz-context)',
      values: history.positions.get(id)!,
      primary: mine,
      context: !mine && k < 0,
    };
  });
  const tickIndices = history.rounds.map((r, i) => (r % 5 === 0 || i === 0 ? i : -1)).filter((i) => i >= 0);
  const xTicks = spacedTicks(tickIndices, n, 3).map((t) => ({ i: t.i, label: `${history.rounds[t.i]}` }));

  return (
    <section className="panel">
      <h2 className="panel-title">Sıralama — Haftalara Göre</h2>
      <div className="panel-body">
        <div className="viz-filters">
          <label className="viz-filter">
            <span className="muted">Karşılaştır</span>
            <select
              value=""
              disabled={picked.length >= MAX_COMPARE}
              onChange={(e) => e.target.value && setCompare([...picked, e.target.value])}
            >
              <option value="">{picked.length >= MAX_COMPARE ? `En fazla ${MAX_COMPARE} takım` : 'Takım ekle…'}</option>
              {order.filter((c) => c.id !== world.playerClubId && !picked.includes(c.id)).map((c: Club) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          {picked.map((id, k) => (
            <button key={id} className="chip viz-chip" onClick={() => setCompare(picked.filter((x) => x !== id))} title="Kaldır">
              <i className="viz-key" style={{ color: COMPARE_COLORS[k] }} />
              {getClub(world, id).shortName} ✕
            </button>
          ))}
        </div>
        {n < 2 ? (
          <div className="panel-note">Sıralama grafiği için en az iki lig haftası oynanmalı.</div>
        ) : (
          <LineChart
            series={series}
            xLabels={history.rounds.map((r) => `${r}. hafta`)}
            xTicks={xTicks}
            yDomain={[0.5, total + 0.5]}
            yTicks={[...new Set([1, 5, 10, 15, total])].filter((t) => t <= total)}
            invertY
            formatY={(v) => `${v}.`}
            bands={[
              { from: 0.5, to: 2.5, className: 'viz-band-cl' },
              { from: 2.5, to: 4.5, className: 'viz-band-el' },
              { from: total - 2.5, to: total + 0.5, className: 'viz-band-rel' },
            ]}
            ariaLabel="Lig sıralaması, haftalara göre"
            tableHead="Hafta"
            tooltipExtra={(i) => {
              const leader = leaderAt(i);
              // İşsizken kendi kulübü yok: yalnızca lider
              const mine = history.points.get(world.playerClubId)?.[i];
              return (
                <div className="viz-tooltip-note">
                  {mine !== undefined && <>{getClub(world, world.playerClubId).shortName}: {mine} puan</>}
                  {leader && leader !== world.playerClubId && <> · Lider {getClub(world, leader).shortName}: {history.points.get(leader)![i]} puan</>}
                </div>
              );
            }}
          />
        )}
        <div className="legend">
          <span><i className="zone-mark zone-cl" /> Şampiyonlar Ligi</span>
          <span><i className="zone-mark zone-el" /> Avrupa Ligi</span>
          <span><i className="zone-mark zone-rel" /> Küme düşme</span>
          <span className="muted">Silik çizgiler diğer takımlar.</span>
        </div>
      </div>
    </section>
  );
}

function FormChart() {
  const world = useWorld();
  const fixtures = world.season.fixtures;
  const playedOwn = fixtures.filter((f) => f.result !== null && (f.homeId === world.playerClubId || f.awayId === world.playerClubId)).length;
  const matches = useMemo(() => formSeries(world.playerClubId, fixtures), [playedOwn, world.season.year, world.playerClubId]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = matches.length;
  const last5 = matches.slice(-FORM_WINDOW);

  const monthTicks = matches
    .map((m, i) => (i === 0 || m.fixture.date.slice(0, 7) !== matches[i - 1]!.fixture.date.slice(0, 7) ? i : -1))
    .filter((i) => i >= 0);
  const xTicks = spacedTicks(monthTicks, n, 4).map((t) => ({ i: t.i, label: MONTHS_SHORT[Number(matches[t.i]!.fixture.date.slice(5, 7)) - 1]! }));
  const competitionLabel = (m: (typeof matches)[number]) => {
    const f = m.fixture;
    if (f.competition === 'cup') return 'Kupa';
    if (f.competition) return EUROPE[f.competition].short;
    return `${f.round}. hafta`;
  };

  const series: ChartSeries[] = [
    { id: 'rolling', label: `Son ${FORM_WINDOW} maç`, color: 'var(--accent)', values: matches.map((m) => m.rolling), primary: true },
    { id: 'season', label: 'Sezon ort.', color: 'var(--viz-muted)', values: matches.map((m) => m.seasonAverage), dashed: true },
  ];

  return (
    <section className="panel">
      <h2 className="panel-title">Form Eğrisi — Maç Başına Puan</h2>
      <div className="panel-body">
        {n >= 1 && (
          <div className="viz-form-row">
            <span className="muted">Son {last5.length} maç</span>
            <span className="form-boxes">{last5.map((m, k) => <OutcomeBox key={k} outcome={m.outcome} />)}</span>
            <span className="muted">
              Maç başı <strong className="viz-strong">{(last5.reduce((a, m) => a + m.points, 0) / last5.length).toFixed(2)}</strong> puan
            </span>
          </div>
        )}
        {n < 2 ? (
          <div className="panel-note">Form grafiği için en az iki maç oynanmalı.</div>
        ) : (
          <LineChart
            series={series}
            xLabels={matches.map((m, k) => `${k + 1}. maç · ${formatDayMonth(m.fixture.date)}`)}
            xTicks={xTicks}
            yDomain={[0, 3]}
            yTicks={[0, 1, 2, 3]}
            formatY={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))}
            ariaLabel="Form eğrisi: maç başına puan"
            tableHead="Maç"
            tooltipExtra={(i) => {
              const m = matches[i]!;
              const opponent = getClub(world, m.opponentId);
              return (
                <div className="viz-tooltip-note">
                  <OutcomeBox outcome={m.outcome} /> {m.scored}-{m.conceded} {opponent.shortName} ({m.home ? 'iç saha' : 'deplasman'}) · {competitionLabel(m)}
                </div>
              );
            }}
          />
        )}
        <div className="panel-note">
          Çizgi, o maça kadar son {FORM_WINDOW} maçta aldığın maç başı puan (galibiyet 3, beraberlik 1); kesikli çizgi sezonun ortalaması.
          Lig, kupa ve Avrupa maçları dahil. {OUTCOME_LABELS.W} = galibiyet, {OUTCOME_LABELS.D} = beraberlik, {OUTCOME_LABELS.L} = mağlubiyet.
        </div>
      </div>
    </section>
  );
}

/** Puan Durumu ekranının grafikleri: sıralamanın haftalara göre seyri ve form eğrisi. */
export function TableCharts() {
  return (
    <>
      <PositionChart />
      <FormChart />
    </>
  );
}
