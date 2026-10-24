import { useMemo, useState } from 'react';
import {
  academyPlayers,
  ACADEMY_AGE_LIMIT,
  ageOn,
  canSendToAcademy,
  clubPlayers,
  getClub,
  growthChange,
  growthRate,
  isOverAge,
  leagueClubs,
  marketValue,
  naturalPositions,
  primaryPosition,
  promoteToFirstTeam,
  releasePlayer,
  sendToAcademy,
  toggleWatch,
  type Player,
  abilityEstimate,
} from '../../engine';
import { useGameStore, useUiState, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { GrowthChart } from '../components/GrowthChart';
import { AbilityStars, PotentialStars } from '../components/ScoutViews';
import { Stars } from '../components/Stars';
import {
  abilityStars,
  formatMoney,
  GROWTH_LABELS,
  POSITION_LABELS,
  positionGroup,
  potentialStarsFor,
  type PositionGroup,
} from '../labels';

type Tab = 'u19' | 'growth' | 'league';

/** Bu yaşa kadar "genç" sayılır (gelişim ve lig taraması). */
const YOUTH_MAX_AGE = 21;
const LEAGUE_PAGE = 50;

function PositionBox({ player }: { player: Player }) {
  const pos = primaryPosition(player);
  return <span className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>;
}

function GrowthLabel({ player }: { player: Player }) {
  const g = GROWTH_LABELS[growthRate(player)];
  return <span className={g.className}>{g.text}</span>;
}

/** U19 kadrosu: A takıma alma ve serbest bırakma. */
function U19Tab() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const [confirmRelease, setConfirmRelease] = useState<number | null>(null);
  const squad = academyPlayers(world, world.playerClubId).sort(
    (a, b) => Number(isOverAge(b, world.date)) - Number(isOverAge(a, world.date)) || b.potentialAbility - a.potentialAbility,
  );
  const firstTeamSize = clubPlayers(world, world.playerClubId).length;

  const promote = (p: Player) => {
    worldAction((w) => promoteToFirstTeam(w, w.players[p.id]!));
    showNotice(`${p.firstName} ${p.lastName} A takıma alındı.`);
  };
  const release = (p: Player) => {
    worldAction((w) => releasePlayer(w, w.players[p.id]!));
    setConfirmRelease(null);
    showNotice(`${p.firstName} ${p.lastName} serbest bırakıldı.`);
  };

  return (
    <>
      <div className="panel-note">
        U19 oyuncuları lig maçlarında oynamaz ama altyapı antrenmanıyla gelişir. {ACADEMY_AGE_LIMIT} yaşına girenler U19&apos;da
        kalamaz: A takıma al ya da serbest bırak. Her yaz altyapıdan yeni bir grup gelir. A takım: {firstTeamSize} oyuncu.
      </div>
      {squad.length === 0 ? (
        <div className="panel-body muted">U19 kadrosunda oyuncu yok.</div>
      ) : (
        <table className="data-table clickable">
          <thead>
            <tr>
              <th>Mevki</th>
              <th>Oyuncu</th>
              <th className="num">Yaş</th>
              <th>Yetenek</th>
              <th>Potansiyel</th>
              <th>Son 6 Ay</th>
              <th>Gelişim</th>
              <th className="num">Maaş</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {squad.map((p) => {
              const over = isOverAge(p, world.date);
              return (
                <tr key={p.id} onClick={() => openPlayer(p.id)} className={over ? 'row-warn' : ''}>
                  <td><PositionBox player={p} /></td>
                  <td className="strong">
                    {p.firstName} {p.lastName}
                    {over && <span className="tag tag-warn">Yaş sınırı</span>}
                  </td>
                  <td className="num">{ageOn(p.birthDate, world.date)}</td>
                  <td><Stars value={abilityStars(p.currentAbility)} /></td>
                  <td><Stars value={potentialStarsFor(world, p)} /></td>
                  <td><GrowthLabel player={p} /></td>
                  <td><GrowthChart player={p} /></td>
                  <td className="num">{formatMoney(p.contract.wage)}</td>
                  <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                    {confirmRelease === p.id ? (
                      <>
                        <button className="btn btn-small btn-danger" onClick={() => release(p)}>Evet, bırak</button>{' '}
                        <button className="btn btn-small" onClick={() => setConfirmRelease(null)}>Vazgeç</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-small btn-go" onClick={() => promote(p)}>A takıma al</button>{' '}
                        <button className="btn btn-small" onClick={() => setConfirmRelease(p.id)}>Bırak</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

/** Kendi gençlerimiz (U19 + A takımdaki ≤ 21 yaş): gelişim grafikleri. */
function GrowthTab() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const youngsters = Object.values(world.players)
    .filter((p) => p.clubId === world.playerClubId && ageOn(p.birthDate, world.date) <= YOUTH_MAX_AGE)
    .sort((a, b) => growthChange(b, 6) - growthChange(a, 6));

  const move = (p: Player) => {
    if (p.academy) {
      worldAction((w) => promoteToFirstTeam(w, w.players[p.id]!));
      showNotice(`${p.firstName} ${p.lastName} A takıma alındı.`);
    } else {
      worldAction((w) => sendToAcademy(w, w.players[p.id]!));
      showNotice(`${p.firstName} ${p.lastName} U19'a gönderildi.`);
    }
  };

  return (
    <>
      <div className="panel-note">
        {YOUTH_MAX_AGE} yaş ve altındaki oyuncularının son 6 aydaki gelişimi (en hızlı gelişen üstte). Grafik aylık yeteneği
        gösterir; yetenek puanı gizlidir.
      </div>
      <table className="data-table clickable">
        <thead>
          <tr>
            <th>Mevki</th>
            <th>Oyuncu</th>
            <th>Takım</th>
            <th className="num">Yaş</th>
            <th>Yetenek</th>
            <th>Potansiyel</th>
            <th>Son 6 Ay</th>
            <th>Gelişim</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {youngsters.map((p) => (
            <tr key={p.id} onClick={() => openPlayer(p.id)}>
              <td><PositionBox player={p} /></td>
              <td className="strong">{p.firstName} {p.lastName}</td>
              <td>{p.academy ? <span className="tag tag-u19">U19</span> : <span className="muted">A Takım</span>}</td>
              <td className="num">{ageOn(p.birthDate, world.date)}</td>
              <td><Stars value={abilityStars(p.currentAbility)} /></td>
              <td><Stars value={potentialStarsFor(world, p)} /></td>
              <td><GrowthLabel player={p} /></td>
              <td><GrowthChart player={p} /></td>
              <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                {p.academy ? (
                  <button className="btn btn-small btn-go" onClick={() => move(p)}>A takıma al</button>
                ) : canSendToAcademy(world, p) ? (
                  <button className="btn btn-small" onClick={() => move(p)}>U19&apos;a gönder</button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const GROUP_OPTIONS: { value: PositionGroup | ''; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'gk', label: 'Kaleci' },
  { value: 'def', label: 'Defans' },
  { value: 'mid', label: 'Orta Saha' },
  { value: 'att', label: 'Hücum' },
];

/** Ligdeki diğer kulüplerin gençleri (A takım + U19): gözlem tahmini ve takip listesi. */
function LeagueTab() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const worldAction = useGameStore((s) => s.worldAction);
  const [group, setGroup] = useUiState<PositionGroup | ''>('academy.group', '');
  const [maxAge, setMaxAge] = useUiState('academy.maxAge', YOUTH_MAX_AGE);
  const [clubId, setClubId] = useUiState('academy.clubId', '');
  const [watchOnly, setWatchOnly] = useUiState('academy.watchOnly', false);
  const [limit, setLimit] = useUiState('academy.limit', LEAGUE_PAGE);
  const clubs = leagueClubs(world).filter((c) => c.id !== world.playerClubId).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const watch = new Set(world.youthWatch);

  const rows = useMemo(
    () =>
      Object.values(world.players)
        .filter((p) => p.clubId && p.clubId !== world.playerClubId && getClub(world, p.clubId).country === undefined)
        .filter((p) => ageOn(p.birthDate, world.date) <= maxAge)
        .filter((p) => !group || positionGroup(primaryPosition(p)) === group)
        .filter((p) => !clubId || p.clubId === clubId)
        .filter((p) => !watchOnly || world.youthWatch.includes(p.id))
        .map((p) => ({ p, potential: potentialStarsFor(world, p) }))
        .sort((a, b) => b.potential - a.potential || abilityEstimate(world, b.p) - abilityEstimate(world, a.p)),
    [world, group, maxAge, clubId, watchOnly],
  );

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(LEAGUE_PAGE);
  };

  return (
    <>
      <div className="filters">
        <label>
          <span>Mevki</span>
          <select value={group} onChange={(e) => setFilter(setGroup)(e.target.value as PositionGroup | '')}>
            {GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          <span>En fazla yaş</span>
          <select value={maxAge} onChange={(e) => setFilter(setMaxAge)(Number(e.target.value))}>
            {[17, 18, 19, 20, 21].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          <span>Kulüp</span>
          <select value={clubId} onChange={(e) => setFilter(setClubId)(e.target.value)}>
            <option value="">Tümü (1. Lig dahil)</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={watchOnly} onChange={(e) => setFilter(setWatchOnly)(e.target.checked)} />
          <span>Yalnızca takip listem ({world.youthWatch.length})</span>
        </label>
      </div>
      <div className="panel-note">
        {rows.length} genç oyuncu{rows.length > limit ? ` (ilk ${limit} gösteriliyor)` : ''}. Yetenek ve potansiyel
        tahminidir; gözlemci raporu tahmini netleştirir (?: tahmin). ☆ ile takip listene ekle; profilden teklif yapabilirsin.
      </div>
      <table className="data-table clickable">
        <thead>
          <tr>
            <th></th>
            <th>Oyuncu</th>
            <th>Kulüp</th>
            <th className="num">Yaş</th>
            <th>Mevki</th>
            <th>Yetenek</th>
            <th>Potansiyel (tahmin)</th>
            <th>Son 6 Ay</th>
            <th className="num">Değer</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map(({ p }) => {
            const club = getClub(world, p.clubId!);
            const watched = watch.has(p.id);
            return (
              <tr key={p.id} onClick={() => openPlayer(p.id)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`watch-toggle${watched ? ' on' : ''}`}
                    title={watched ? 'Takip listesinden çıkar' : 'Takip listesine ekle'}
                    onClick={() => worldAction((w) => toggleWatch(w, p.id))}
                  >
                    {watched ? '★' : '☆'}
                  </button>
                </td>
                <td className="strong">
                  {p.firstName} {p.lastName}
                  {p.academy && <span className="tag tag-u19">U19</span>}
                </td>
                <td><span className="club-cell"><ClubBadge club={club} size={16} /> {club.name}</span></td>
                <td className="num">{ageOn(p.birthDate, world.date)}</td>
                <td>
                  <span className="pos-boxes">
                    {naturalPositions(p).map((pos) => (
                      <span key={pos} className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span>
                    ))}
                  </span>
                </td>
                <td><AbilityStars player={p} /></td>
                <td><PotentialStars player={p} /></td>
                <td><GrowthLabel player={p} /></td>
                <td className="num value">{formatMoney(marketValue(p, world.date))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > limit && (
        <div className="panel-note">
          <button className="btn btn-small" onClick={() => setLimit(limit + LEAGUE_PAGE)}>
            Daha fazla göster ({Math.min(LEAGUE_PAGE, rows.length - limit)} oyuncu daha)
          </button>
        </div>
      )}
    </>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'u19', label: 'U19 Kadrosu' },
  { id: 'growth', label: 'Gelişim' },
  { id: 'league', label: 'Ligdeki Gençler' },
];

export function AcademyScreen() {
  const world = useWorld();
  const [tab, setTab] = useUiState<Tab>('academy.tab', 'u19');
  const count = academyPlayers(world, world.playerClubId).length;
  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Altyapı · U19 ({count} oyuncu)</span>
        <span className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </span>
      </div>
      {tab === 'u19' && <U19Tab />}
      {tab === 'growth' && <GrowthTab />}
      {tab === 'league' && <LeagueTab />}
    </section>
  );
}
