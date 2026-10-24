import { useState } from 'react';
import {
  ageOn,
  formatMinute,
  getClub,
  goalDifference,
  GROUP_LETTERS,
  groupOf,
  HOME_NATION,
  isOnNationalDuty,
  isVirtualPlayer,
  nationalPlayer,
  nationalWinner,
  nationFixtures,
  primaryPosition,
  qualifierRanking,
  qualifierRuleText,
  nationalTeams,
  qualifierFixtures,
  TOURNAMENT_FINAL,
  TOURNAMENT_GROUP_ROUNDS,
  TOURNAMENT_NAMES,
  TOURNAMENT_QUARTER,
  TOURNAMENT_SEMI,
  tournamentDate,
  tournamentDrawDate,
  tournamentFixtures,
  tournamentStageName,
  tournamentTable,
  tournamentTitle,
  UEFA_SPOTS,
  qualifierTable,
  type NationalFixture,
  type Outcome,
  type Player,
  type PositionGroup,
  type StandingRow,
  type TurkeyStage,
} from '../../engine';
import { gameData } from '../../gameData';
import { useGameStore, useWorld } from '../../store/gameStore';
import { NationFlag } from '../components/NationFlag';
import { OutcomeBox } from '../components/OutcomeBox';
import { formatDateShort, formatDayMonth, nationName, POSITION_LABELS } from '../labels';

type Tab = 'team' | 'qualifiers' | 'tournament' | 'ours' | 'history';

const GROUP_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'ATT'];

const TURKEY_STAGE_LABELS: Record<TurkeyStage, string> = {
  notQualified: 'Katılamadı',
  group: 'Grup aşaması',
  quarter: 'Çeyrek final',
  semi: 'Yarı final',
  final: 'Finalist',
  winner: 'Şampiyon',
};

function NationName({ code }: { code: string }) {
  return <span className="club-cell"><NationFlag code={code} /> {nationName(code)}</span>;
}

function scoreText(f: NationalFixture): string {
  const r = f.result;
  if (!r) return 'v';
  return `${r.homeGoals} - ${r.awayGoals}${r.penalties ? ` (P ${r.penalties.home}-${r.penalties.away})` : ''}`;
}

function outcomeFor(f: NationalFixture, code: string): Outcome | null {
  const r = f.result;
  if (!r) return null;
  if (r.penalties) return nationalWinner(f) === code ? 'W' : 'L';
  const own = f.homeId === code ? r.homeGoals : r.awayGoals;
  const other = f.homeId === code ? r.awayGoals : r.homeGoals;
  return own > other ? 'W' : own === other ? 'D' : 'L';
}

/** Golcüler (üstüne gelince). */
function goalsTitle(f: NationalFixture): string | undefined {
  if (!f.result || f.result.goals.length === 0) return undefined;
  return f.result.goals
    .map((g) => `${formatMinute(g.minute, g.extra)} ${g.name}${g.penalty ? ' (P)' : ''} — ${nationName(g.side === 'home' ? f.homeId : f.awayId)}`)
    .join('\n');
}

function shortLabel(f: NationalFixture): string {
  if (f.competition === 'friendly') return 'Hazırlık';
  if (f.competition === 'qualifier') return `Eleme · ${f.group} Grubu`;
  return f.round <= TOURNAMENT_GROUP_ROUNDS ? `Turnuva · ${f.group} Grubu` : `Turnuva · ${tournamentStageName(f.round)}`;
}

/** Seçili ülkenin son kadrosu ve maçları. */
function TeamTab({ code, setCode }: { code: string; setCode: (c: string) => void }) {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const state = world.international;
  const squad = state.squads[code];
  const players = (squad?.ids ?? [])
    .map((id) => nationalPlayer(world, gameData, id))
    .filter((p): p is Player => p !== undefined);
  const byGroup = GROUP_ORDER.flatMap((g) => players.filter((p) => groupOf(primaryPosition(p)) === g));
  const fixtures = nationFixtures(state, code);
  const nations = [...nationalTeams(gameData)].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return (
    <>
      <div className="intl-toolbar">
        <label>
          Ülke{' '}
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {nations.map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}
          </select>
        </label>
        <span className="muted">
          {squad ? `Kadro ${formatDateShort(squad.date)} tarihinde açıklandı.` : 'Bu döngüde henüz kadro açıklanmadı.'}
        </span>
      </div>
      <div className="two-columns intl-columns">
        <div>
          <div className="sub-head">Kadro</div>
          {byGroup.length === 0 ? (
            <div className="panel-note">Kadro, ilk milli maçtan 4 gün önce açıklanır.</div>
          ) : (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Mevki</th>
                  <th>Oyuncu</th>
                  <th className="num">Yaş</th>
                  <th>Kulüp</th>
                  <th className="num">Maç</th>
                  <th className="num">Gol</th>
                </tr>
              </thead>
              <tbody>
                {byGroup.map((p) => {
                  const virtual = isVirtualPlayer(p.id);
                  const club = p.clubId ? getClub(world, p.clubId) : null;
                  const ours = p.clubId === world.playerClubId;
                  return (
                    <tr
                      key={p.id}
                      className={[ours ? 'own-row' : '', virtual ? 'virtual-row' : 'clickable-row'].filter(Boolean).join(' ')}
                      onClick={() => !virtual && openPlayer(p.id)}
                      title={virtual ? 'Oyun dünyasında yer almayan oyuncu (yurtdışı liglerinde oynuyor)' : undefined}
                    >
                      <td>{POSITION_LABELS[primaryPosition(p)]}</td>
                      <td className="strong">{p.firstName} {p.lastName}</td>
                      <td className="num">{ageOn(p.birthDate, world.date)}</td>
                      <td>{club ? club.name : <span className="muted">—</span>}</td>
                      <td className="num">{virtual ? '—' : p.intl?.caps ?? 0}</td>
                      <td className="num">{virtual ? '—' : p.intl?.goals ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="panel-note">Soluk satırlar oyun dünyasında yer almayan (kayıtta olmayan) oyunculardır.</div>
        </div>
        <div>
          <div className="sub-head">Maçlar</div>
          <table className="data-table compact">
            <tbody>
              {fixtures.map((f) => {
                const home = f.homeId === code;
                const opponent = home ? f.awayId : f.homeId;
                const outcome = outcomeFor(f, code);
                const venue = f.competition === 'tournament' ? 'T' : home ? 'İ' : 'D';
                return (
                  <tr key={f.id} title={goalsTitle(f)}>
                    <td className="muted">{formatDayMonth(f.date)} {f.date.slice(0, 4)}</td>
                    <td className="muted">{shortLabel(f)}</td>
                    <td className="num muted" title={venue === 'T' ? 'Tarafsız saha' : venue === 'İ' ? 'İç saha' : 'Deplasman'}>{venue}</td>
                    <td className="strong">
                      <span className="link" onClick={() => setCode(opponent)}><NationName code={opponent} /></span>
                    </td>
                    <td className="score">{scoreText(f)}</td>
                    <td>{outcome && <OutcomeBox outcome={outcome} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {fixtures.length === 0 && <div className="panel-note">Bu döngüde maçı yok.</div>}
          <div className="panel-note">Skor ev sahibine göre; golcüler için satırın üstüne gel. İ = iç saha, D = deplasman, T = tarafsız.</div>
        </div>
      </div>
    </>
  );
}

/** Grup tablosu; `qualified` turnuvaya (ya da eleme turuna) gidenler (şu anki sıralamayla). */
function GroupTable({ title, rows, qualified, onPick }: { title: string; rows: StandingRow[]; qualified: ReadonlySet<string>; onPick: (code: string) => void }) {
  return (
    <div className="euro-group">
      <div className="sub-head">{title}</div>
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Ülke</th>
            <th className="num">O</th>
            <th className="num">G</th>
            <th className="num">B</th>
            <th className="num">M</th>
            <th className="num">AV</th>
            <th className="num">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gd = goalDifference(r);
            return (
              <tr
                key={r.clubId}
                className={[qualified.has(r.clubId) ? 'zone-cl' : '', r.clubId === HOME_NATION ? 'own-row' : '', 'clickable-row'].filter(Boolean).join(' ')}
                onClick={() => onPick(r.clubId)}
              >
                <td className="strong"><NationName code={r.clubId} /></td>
                <td className="num">{r.played}</td>
                <td className="num">{r.won}</td>
                <td className="num">{r.drawn}</td>
                <td className="num">{r.lost}</td>
                <td className="num">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="num value">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QualifiersTab({ onPick }: { onPick: (code: string) => void }) {
  const world = useWorld();
  const state = world.international;
  const fixtures = qualifierFixtures(state);
  const left = fixtures.filter((f) => !f.result);
  const next = left.map((f) => f.date).sort()[0];
  // Bitince kesin liste, sürerken şu anki sıralamaya göre turnuvaya gidenler
  const qualified = new Set(state.qualified ?? qualifierRanking(state).slice(0, UEFA_SPOTS));
  return (
    <div className="cup-view">
      <div className="cup-status">
        {tournamentTitle(state.year, state.kind)} Elemeleri: turnuvaya {qualifierRuleText(state)} gider
        {state.kind === 'wc' ? " (Dünya Kupası'nda UEFA dışından en güçlü ülkeler de katılır)" : ''}.{' '}
        {next ? `Sıradaki eleme maçları ${formatDateShort(next)}.` : 'Elemeler tamamlandı.'}
      </div>
      <div className="euro-groups">
        {state.qualifierGroups.map((_, g) => (
          <GroupTable key={g} title={`${GROUP_LETTERS[g]} Grubu`} rows={qualifierTable(state, g)} qualified={qualified} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function KnockoutRound({ round }: { round: number }) {
  const world = useWorld();
  const fixtures = tournamentFixtures(world.international, round);
  if (fixtures.length === 0) return null;
  return (
    <div className="cup-round">
      <div className="sub-head">{tournamentStageName(round)} <span className="muted">· {formatDayMonth(fixtures[0]!.date)}</span></div>
      <table className="data-table round-table">
        <tbody>
          {fixtures.map((f) => {
            const winner = nationalWinner(f);
            const cls = (code: string) => (winner === code ? 'strong' : winner ? 'muted' : '');
            const ours = f.homeId === HOME_NATION || f.awayId === HOME_NATION;
            return (
              <tr key={f.id} className={ours ? 'own-row' : undefined} title={goalsTitle(f)}>
                <td className={`right ${cls(f.homeId)}`}><NationName code={f.homeId} /></td>
                <td className="score">{scoreText(f)}</td>
                <td className={cls(f.awayId)}><NationName code={f.awayId} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TournamentTab({ onPick }: { onPick: (code: string) => void }) {
  const world = useWorld();
  const state = world.international;
  const title = tournamentTitle(state.year, state.kind);
  if (state.tournamentGroups.length === 0) {
    return (
      <div className="cup-view">
        <div className="cup-status">
          {title}: kura {formatDateShort(tournamentDrawDate(state.year))} tarihinde çekilir; turnuva {formatDateShort(tournamentDate(state.year, 1))}
          {' '}– {formatDateShort(tournamentDate(state.year, TOURNAMENT_FINAL))} arasında oynanır
          ({state.kind === 'euro' ? '8 takım: 2 grup, yarı final, final' : '16 takım: 4 grup, çeyrek final, yarı final, final'}).
        </div>
      </div>
    );
  }
  return (
    <div className="cup-view">
      <div className="cup-status">{title}: tüm maçlar tarafsız sahada; grupların ilk 2'si eleme turuna çıkar, elemelerde beraberlikte penaltılar.</div>
      <div className="euro-groups">
        {state.tournamentGroups.map((_, g) => (
          <GroupTable key={g} title={`${GROUP_LETTERS[g]} Grubu`} rows={tournamentTable(state, g)} qualified={new Set(tournamentTable(state, g).slice(0, 2).map((r) => r.clubId))} onPick={onPick} />
        ))}
      </div>
      {[TOURNAMENT_QUARTER, TOURNAMENT_SEMI, TOURNAMENT_FINAL].map((r) => <KnockoutRound key={r} round={r} />)}
    </div>
  );
}

/** Kulübümüzün milli oyuncuları. */
function OursTab() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const state = world.international;
  const inSquad = new Set(Object.values(state.squads).flatMap((s) => s.ids));
  const players = Object.values(world.players)
    .filter((p) => p.clubId === world.playerClubId && (p.intl || inSquad.has(p.id)))
    .sort((a, b) => (b.intl?.caps ?? 0) - (a.intl?.caps ?? 0) || a.lastName.localeCompare(b.lastName, 'tr'));
  if (players.length === 0) return <div className="panel-note">Henüz milli takıma çağrılan oyuncumuz yok.</div>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Oyuncu</th>
          <th>Ülke</th>
          <th className="num">Milli Maç</th>
          <th className="num">Gol</th>
          <th>Durum</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} className="clickable-row" onClick={() => openPlayer(p.id)}>
            <td className="strong">{p.firstName} {p.lastName}</td>
            <td><NationName code={p.nationality} /></td>
            <td className="num">{p.intl?.caps ?? 0}</td>
            <td className="num">{p.intl?.goals ?? 0}</td>
            <td>{isOnNationalDuty(world, p.id) ? <span className="st st-intl">Milli takımda</span> : inSquad.has(p.id) ? 'Son kadroda' : <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryTab() {
  const world = useWorld();
  const history = [...world.international.history].reverse();
  if (history.length === 0) return <div className="panel-note">Henüz tamamlanan turnuva yok.</div>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Turnuva</th>
          <th>Şampiyon</th>
          <th>Finalist</th>
          <th>Türkiye</th>
        </tr>
      </thead>
      <tbody>
        {history.map((h) => (
          <tr key={h.year}>
            <td className="strong">{TOURNAMENT_NAMES[h.kind]} {h.year}</td>
            <td><NationName code={h.winner} /></td>
            <td><NationName code={h.runnerUp} /></td>
            <td>{TURKEY_STAGE_LABELS[h.turkey]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'team', label: 'Takım' },
  { id: 'qualifiers', label: 'Elemeler' },
  { id: 'tournament', label: 'Turnuva' },
  { id: 'ours', label: 'Oyuncularımız' },
  { id: 'history', label: 'Geçmiş' },
];

export function InternationalScreen() {
  const [tab, setTab] = useState<Tab>('team');
  const [code, setCode] = useState(HOME_NATION);
  const pick = (c: string) => {
    setCode(c);
    setTab('team');
  };
  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Milli Takımlar</span>
        <span className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </span>
      </div>
      {tab === 'team' && <TeamTab code={code} setCode={setCode} />}
      {tab === 'qualifiers' && <QualifiersTab onPick={pick} />}
      {tab === 'tournament' && <TournamentTab onPick={pick} />}
      {tab === 'ours' && <OursTab />}
      {tab === 'history' && <HistoryTab />}
    </section>
  );
}

