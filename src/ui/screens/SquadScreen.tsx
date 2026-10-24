import { useMemo, type ReactNode } from 'react';
import {
  abilityEstimate,
  ageOn,
  clubPlayers,
  getClub,
  HOME_NATION,
  marketValue,
  naturalPositions,
  playerSeasonStats,
  POSITIONS,
  primaryPosition,
  seasonEndYear,
  type GameWorld,
  type Player,
  type PlayerSeasonStats,
} from '../../engine';
import { useGameStore, useUiState, useWorld } from '../../store/gameStore';
import { ClubOptions } from '../components/ClubOptions';
import { CompareBar } from '../components/CompareDialog';
import { AbilityStars, PotentialStars } from '../components/ScoutViews';
import { StatusTags } from '../components/StatusTags';
import {
  LISTING_LABELS,
  potentialStarsFor,
  formatDateShort,
  formatMoney,
  moraleLabel,
  nationName,
  POSITION_LABELS,
  positionGroup,
  ratingClass,
  trendSymbol,
} from '../labels';
import { filterSquad, GROUP_FILTERS, isExpiring, SQUAD_VIEWS, STATUS_FILTERS, type SquadView } from '../squadFilters';

export function PositionBoxes({ player }: { player: Player }) {
  return (
    <span className="pos-boxes">
      {naturalPositions(player).map((p) => (
        <span key={p} className={`pos-box pos-${positionGroup(p)}`}>
          {POSITION_LABELS[p]}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sütunlar                                                             */
/* ------------------------------------------------------------------ */

interface Ctx {
  world: GameWorld;
  stats: (p: Player) => PlayerSeasonStats;
}

interface Column {
  id: string;
  label: string;
  numeric?: boolean;
  title?: string;
  sort: (p: Player, c: Ctx) => number | string;
  render: (p: Player, c: Ctx) => ReactNode;
}

const age = (p: Player, c: Ctx) => ageOn(p.birthDate, c.world.date);
const dash = (n: number, apps: number) => (apps === 0 ? '—' : n);

const NUMBER: Column = { id: 'number', label: 'No', numeric: true, sort: (p) => p.squadNumber ?? 999, render: (p) => p.squadNumber };
const NAME: Column = {
  id: 'name',
  label: 'İsim',
  sort: (p) => `${p.lastName} ${p.firstName}`,
  render: (p, c) => (
    <span className="strong">
      {p.firstName} {p.lastName}
      {p.loan && <span className="tag" title={'Kiralık, dönüş ' + formatDateShort(p.loan.until)}>Kiralık</span>}
      {p.listing && <span className={`tag tag-list-${p.listing.kind}`}>{LISTING_LABELS[p.listing.kind]}</span>}
      {c.world.requests.some((r) => r.playerId === p.id) && (
        <span className="tag tag-warn" title="Seninle görüşmek istiyor (profilden yanıtla)">Görüşmek istiyor</span>
      )}
      <StatusTags player={p} />
    </span>
  ),
};
// Önce mevki, aynı mevkide forma numarası
const POSITION: Column = {
  id: 'position',
  label: 'Mevki',
  sort: (p) => POSITIONS.indexOf(primaryPosition(p)) * 1000 + (p.squadNumber ?? 999),
  render: (p) => <PositionBoxes player={p} />,
};
const AGE: Column = { id: 'age', label: 'Yaş', numeric: true, sort: age, render: age };
const CONDITION: Column = {
  id: 'condition',
  label: 'Kond.',
  numeric: true,
  sort: (p) => p.condition,
  render: (p) => <span className={p.condition < 75 ? 'neg' : ''}>%{p.condition}</span>,
};
const MORALE: Column = { id: 'morale', label: 'Moral', sort: (p) => p.morale, render: (p) => moraleLabel(p.morale) };
const VALUE: Column = {
  id: 'value',
  label: 'Değer',
  numeric: true,
  sort: (p, c) => marketValue(p, c.world.date),
  render: (p, c) => <span className="value">{formatMoney(marketValue(p, c.world.date))}</span>,
};
const WAGE: Column = {
  id: 'wage',
  label: 'Maaş (yıllık)',
  numeric: true,
  sort: (p) => p.contract.wage,
  render: (p) => <span className="value">{formatMoney(p.contract.wage)}</span>,
};
const EXPIRES: Column = { id: 'expires', label: 'Sözleşme', sort: (p) => p.contract.expires, render: (p) => formatDateShort(p.contract.expires) };

const VIEW_COLUMNS: Record<SquadView, Column[]> = {
  general: [
    NUMBER, NAME, POSITION, AGE,
    { id: 'nation', label: 'Uyruk', sort: (p) => nationName(p.nationality), render: (p) => nationName(p.nationality) },
    CONDITION, MORALE, VALUE, WAGE, EXPIRES,
  ],
  stats: [
    NUMBER, NAME, POSITION,
    {
      id: 'apps', label: 'Maç', numeric: true, title: 'İlk 11 (oyuna sonradan girdiği)',
      sort: (p, c) => c.stats(p).apps,
      render: (p, c) => {
        const s = c.stats(p);
        return s.apps === 0 ? '—' : `${s.starts}${s.apps > s.starts ? ` (${s.apps - s.starts})` : ''}`;
      },
    },
    { id: 'goals', label: 'Gol', numeric: true, sort: (p, c) => c.stats(p).goals, render: (p, c) => dash(c.stats(p).goals, c.stats(p).apps) },
    { id: 'assists', label: 'Asist', numeric: true, sort: (p, c) => c.stats(p).assists, render: (p, c) => dash(c.stats(p).assists, c.stats(p).apps) },
    { id: 'motm', label: 'MA', numeric: true, title: 'Maçın adamı', sort: (p, c) => c.stats(p).manOfTheMatch, render: (p, c) => dash(c.stats(p).manOfTheMatch, c.stats(p).apps) },
    { id: 'yellow', label: 'Sarı', numeric: true, sort: (p, c) => c.stats(p).yellow, render: (p, c) => dash(c.stats(p).yellow, c.stats(p).apps) },
    { id: 'red', label: 'Kırmızı', numeric: true, sort: (p, c) => c.stats(p).red, render: (p, c) => dash(c.stats(p).red, c.stats(p).apps) },
    {
      id: 'rating', label: 'Ort. Puan', numeric: true,
      sort: (p, c) => c.stats(p).avgRating ?? 0,
      render: (p, c) => {
        const r = c.stats(p).avgRating;
        return r === null ? '—' : <span className={ratingClass(r)}>{r.toFixed(2)}</span>;
      },
    },
    {
      id: 'form', label: 'Son Maçlar', sort: (p) => p.form[p.form.length - 1] ?? 0,
      render: (p) => (
        <span className="form-ratings">
          {p.form.length === 0 ? '—' : p.form.map((r, i) => <span key={i} className={ratingClass(r)}>{r.toFixed(1)}</span>)}
        </span>
      ),
    },
  ],
  contract: [
    NUMBER, NAME, POSITION, AGE, VALUE, WAGE, EXPIRES,
    {
      id: 'left', label: 'Kalan', numeric: true,
      sort: (p) => p.contract.expires,
      render: (p, c) => {
        // İçinde bulunulan sezon dahil, sözleşmenin süreceği sezon sayısı
        const seasons = Number(p.contract.expires.slice(0, 4)) - seasonEndYear(c.world.date) + 1;
        return seasons <= 1 ? <span className="neg">Bu sezon</span> : `${seasons} sezon`;
      },
    },
    {
      id: 'note', label: 'Not', sort: (p, c) => (isExpiring(p, c.world.date) ? 0 : 1),
      render: (p, c) => p.loan
        ? <span className="muted">Kiralık · sahibi: {getClub(c.world, p.loan.fromClubId).name}</span>
        : isExpiring(p, c.world.date) ? <span className="neg">Yenilenmezse 30 Haziran'da ayrılır</span> : '',
    },
  ],
  report: [
    NUMBER, NAME, POSITION, AGE,
    // Başka kulübün oyuncusunda yetenek ve potansiyel bilgi düzeyine göre tahmin (kendi oyuncumuzda antrenör raporu)
    { id: 'ability', label: 'Yetenek', sort: (p, c) => abilityEstimate(c.world, p), render: (p) => <AbilityStars player={p} /> },
    {
      id: 'potential', label: 'Potansiyel',
      sort: (p, c) => potentialStarsFor(c.world, p),
      render: (p) => <PotentialStars player={p} />,
    },
    {
      id: 'trend', label: 'Gelişim', sort: (p) => p.trend,
      render: (p) => {
        const t = trendSymbol(p.trend);
        return <span className={t.className}>{t.text}</span>;
      },
    },
    CONDITION, MORALE,
  ],
};

/* ------------------------------------------------------------------ */
/* Ekran                                                                */
/* ------------------------------------------------------------------ */

export function SquadScreen() {
  const world = useWorld();
  const viewedClubId = useGameStore((s) => s.viewedClubId) ?? world.playerClubId;
  const setViewedClub = useGameStore((s) => s.setViewedClub);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const view = useGameStore((s) => s.squadView);
  const setView = useGameStore((s) => s.setSquadView);
  const filters = useGameStore((s) => s.squadFilters);
  const setFilters = useGameStore((s) => s.setSquadFilters);
  const compareIds = useGameStore((s) => s.compareIds);
  const toggleCompare = useGameStore((s) => s.toggleCompare);
  const [sort, setSort] = useUiState<{ id: string; asc: boolean }>('squad.sort', { id: 'position', asc: true });

  const own = viewedClubId === world.playerClubId;
  const squad = clubPlayers(world, viewedClubId);
  const lineup = world.tactics[viewedClubId]?.lineup ?? null;

  // Sezon istatistikleri yalnızca gerektiğinde ve oyuncu başına bir kez hesaplanır.
  const statsCache = useMemo(() => new Map<number, PlayerSeasonStats>(), [world]);
  const ctx: Ctx = {
    world,
    stats: (p) => {
      let s = statsCache.get(p.id);
      if (!s) {
        s = playerSeasonStats(world.season.fixtures, p.id);
        statsCache.set(p.id, s);
      }
      return s;
    },
  };

  const columns = VIEW_COLUMNS[view];
  const sortColumn = columns.find((c) => c.id === sort.id) ?? POSITION;
  const players = filterSquad(squad, filters, { date: world.date, lineup }).sort((a, b) => {
    const va = sortColumn.sort(a, ctx);
    const vb = sortColumn.sort(b, ctx);
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'tr') : va - (vb as number);
    return sort.asc ? cmp : -cmp;
  });

  const toggleSort = (col: Column) =>
    setSort((s) => ({ id: col.id, asc: s.id === col.id ? !s.asc : !col.numeric || col.id === 'number' }));

  // Özet şeridi
  const avgAge = squad.length === 0 ? 0 : squad.reduce((s, p) => s + ageOn(p.birthDate, world.date), 0) / squad.length;
  const summary = [
    `${squad.length} oyuncu`,
    `yaş ort. ${avgAge.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`,
    `${squad.filter((p) => p.nationality !== HOME_NATION).length} yabancı`,
    `${squad.filter((p) => p.injury || p.suspension > 0).length} sakat/cezalı`,
    `${squad.filter((p) => !p.loan && isExpiring(p, world.date)).length} sözleşmesi bitiyor`,
  ];

  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Oyuncular</span>
        <span className="toolbar">
          <span className="tabs">
            {SQUAD_VIEWS.map((v) => (
              <button key={v.id} className={`tab${view === v.id ? ' active' : ''}`} onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </span>
          <select value={viewedClubId} onChange={(e) => setViewedClub(e.target.value)}>
            <ClubOptions world={world} />
          </select>
        </span>
      </div>

      <div className="squad-filters">
        <span className="chips">
          {GROUP_FILTERS.map((g) => (
            <button key={g.id} className={`chip${filters.group === g.id ? ' active' : ''}`} onClick={() => setFilters({ group: g.id })}>
              {g.label}
            </button>
          ))}
        </span>
        <span className="chips">
          {STATUS_FILTERS.filter((s) => !s.ownOnly || own).map((s) => (
            <button key={s.id} className={`chip${filters.status === s.id ? ' active' : ''}`} onClick={() => setFilters({ status: s.id })}>
              {s.label}
            </button>
          ))}
        </span>
        <input
          className="search-input"
          placeholder="İsim ara…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
      </div>

      <div className="squad-summary">
        {summary.map((s) => <span key={s}>{s}</span>)}
        {players.length !== squad.length && <span className="muted">— {players.length} gösteriliyor</span>}
      </div>

      <CompareBar />

      <table className="data-table clickable">
        <thead>
          <tr>
            <th className="cmp-col" title="Karşılaştırmak için seç">⇆</th>
            {columns.map((c) => (
              <th key={c.id} title={c.title} className={`sortable${c.numeric ? ' num' : ''}`} onClick={() => toggleSort(c)}>
                {c.label}
                {sortColumn.id === c.id && (sort.asc ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} onClick={() => openPlayer(p.id)} className={compareIds.includes(p.id) ? 'selected' : ''}>
              <td className="cmp-col" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={compareIds.includes(p.id)} onChange={() => toggleCompare(p.id)} />
              </td>
              {columns.map((c) => (
                <td key={c.id} className={c.numeric ? 'num' : ''}>{c.render(p, ctx)}</td>
              ))}
            </tr>
          ))}
          {players.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="muted">Filtreye uyan oyuncu yok.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
