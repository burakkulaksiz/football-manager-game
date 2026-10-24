import {
  buildMonths,
  daysBetween,
  facilityLevel,
  formatDateTR,
  getClub,
  injuryDurationFactor,
  leagueClubs,
  maintenancePerYear,
  MAINTENANCE_PER_LEVEL,
  matchInjuryFactor,
  MAX_CAPACITY,
  MAX_LEVEL,
  projectName,
  requestBlocker,
  requestFacility,
  requiredConfidence,
  STADIUM_STEP,
  trainingDevelopmentFactor,
  trainingInjuryFactor,
  upgradeCost,
  youthFacilityBonus,
  type FacilityKind,
  type FacilityProject,
  type GameWorld,
  type ProjectKind,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatMoney, formatNumber, formatSignedMoney } from '../labels';

const pct = (factor: number) => `${factor >= 1 ? '+' : '−'}%${Math.round(Math.abs(factor - 1) * 100)}`;

/** Tesisin şu anki etkisi (oyunda kullanılan çarpanlardan). */
function effectLines(kind: FacilityKind, level: number): string[] {
  switch (kind) {
    case 'training':
      return [`Gelişim hızı ${pct(trainingDevelopmentFactor(level))}`, `Antrenman sakatlığı riski ${pct(1.15 - level * 0.03)}`];
    case 'youth': {
      const b = youthFacilityBonus(level);
      return [
        `U19'a gelen gençlerin seviyesi ${b.level >= 0 ? '+' : '−'}${Math.abs(b.level).toFixed(2)}, potansiyeli ${b.potential >= 0 ? '+' : '−'}${Math.abs(b.potential)}`,
        `Cevher çıkma olasılığı ${pct(b.wonderkid)} · U19 gelişim hızı ${pct(trainingDevelopmentFactor(level))}`,
      ];
    }
    case 'medical':
      return [`Sakatlık süresi ${pct(injuryDurationFactor(level))}`, `Maç sakatlığı riski ${pct(matchInjuryFactor(level))}, antrenmanda ${pct(trainingInjuryFactor(5, level) / trainingInjuryFactor(5, 5))}`];
  }
}

const DESCRIPTIONS: Record<ProjectKind, string> = {
  stadium: 'Ek tribün: kapasite dolmuyorsa işe yaramaz; stadyum doluyorsa daha çok seyirci ve bilet geliri.',
  training: 'Oyuncuların haftalık gelişimini hızlandırır, antrenman sakatlığını azaltır.',
  youth: 'Her yaz U19 kadrosuna katılan gençlerin kalitesini ve cevher çıkma olasılığını artırır.',
  medical: 'Sakatlıkları kısaltır, maçta ve antrenmanda sakatlanma riskini azaltır.',
};

function LevelBar({ level }: { level: number }) {
  return (
    <span className="fac-level" aria-label={`Seviye ${level} / ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
    </span>
  );
}

/** Süren inşaatın ilerlemesi. */
function ProjectProgress({ project, today }: { project: FacilityProject; today: string }) {
  const total = Math.max(1, daysBetween(project.started, project.completes));
  const done = Math.min(total, Math.max(0, daysBetween(project.started, today)));
  return (
    <div className="fac-project">
      <div className="fac-project-bar"><i style={{ width: `${(done / total) * 100}%` }} /></div>
      <span>İnşaat sürüyor · {formatDateTR(project.completes)} tarihinde tamamlanacak</span>
    </div>
  );
}

/** Ligdeki sırası (Süper Lig kulüpleri arasında). */
function leagueRank(world: GameWorld, kind: FacilityKind): { rank: number; best: number } {
  const levels = leagueClubs(world).map((c) => ({ id: c.id, level: facilityLevel(world, c.id, kind) }));
  const own = facilityLevel(world, world.playerClubId, kind);
  return { rank: 1 + levels.filter((l) => l.level > own).length, best: Math.max(...levels.map((l) => l.level)) };
}

function FacilityCard({ kind }: { kind: ProjectKind }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const clubId = world.playerClubId;
  const club = getClub(world, clubId);
  const project = world.facilities.projects.find((p) => p.kind === kind);
  const blocker = requestBlocker(world, kind);
  const cost = upgradeCost(world, clubId, kind);
  const months = buildMonths(world, clubId, kind);
  const request = () => {
    const outcome = worldAction((w) => requestFacility(w, kind));
    showNotice(outcome.approved ? `Yönetim onayladı: ${projectName(kind)}` : outcome.reason, outcome.approved ? 'ok' : 'error');
  };

  let body: React.ReactNode;
  if (kind === 'stadium') {
    // Bu sezonki iç saha maçlarının seyircisi: kapasite doluyor mu
    const home = world.season.fixtures.filter((f) => f.homeId === clubId && f.result?.attendance !== undefined);
    const avg = home.length > 0 ? home.reduce((s, f) => s + f.result!.attendance!, 0) / home.length : null;
    body = (
      <>
        <div className="fac-big">{formatNumber(club.capacity)} <span className="muted">kişilik · {club.stadium}</span></div>
        <div className="fac-effect">
          {avg === null ? 'Bu sezon henüz iç saha maçı oynanmadı.' : `Ortalama seyirci ${formatNumber(Math.round(avg))} (%${Math.round((avg / club.capacity) * 100)} dolu)`}
        </div>
        <div className="fac-next muted">
          Genişletme: +{formatNumber(STADIUM_STEP)} koltuk · {formatMoney(cost)} · sezon arasında (1 Temmuz) biter · en çok {formatNumber(MAX_CAPACITY)}
        </div>
      </>
    );
  } else {
    const level = facilityLevel(world, clubId, kind);
    const { rank, best } = leagueRank(world, kind);
    body = (
      <>
        <div className="fac-big"><LevelBar level={level} /> <span>{level} / {MAX_LEVEL}</span></div>
        <div className="muted">Ligde {rank}. sırada (en iyi seviye {best})</div>
        <ul className="fac-effects">{effectLines(kind, level).map((l) => <li key={l}>{l}</li>)}</ul>
        {level < MAX_LEVEL && (
          <div className="fac-next muted">
            {level + 1}. seviye: {formatMoney(cost)} · {months} ay inşaat · bakım +{formatMoney(MAINTENANCE_PER_LEVEL)} / yıl · sonra: {effectLines(kind, level + 1)[0]}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="panel fac-card">
      <h2 className="panel-title">{kind === 'stadium' ? 'Stadyum' : projectName(kind)}</h2>
      <div className="panel-body">
        <div className="panel-note fac-desc">{DESCRIPTIONS[kind]}</div>
        {body}
        {project ? (
          <ProjectProgress project={project} today={world.date} />
        ) : (
          <div className="fac-actions">
            <button className="btn btn-go" disabled={blocker !== null} onClick={request} title={blocker ?? 'Yönetimden bu yatırımı iste'}>
              Yönetimden İste
            </button>
            {blocker && <span className="muted">{blocker}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Tesisler: stadyum, antrenman tesisi, altyapı tesisi, sağlık merkezi; yatırımlar yönetimden istenir. */
export function FacilitiesScreen() {
  const world = useWorld();
  const fin = world.finances[world.playerClubId]!;
  const needed = requiredConfidence(world);
  return (
    <div className="screen">
      <section className="panel">
        <h2 className="panel-title">Tesisler</h2>
        <div className="panel-body fac-summary">
          <div><span className="muted">Kasa</span><strong>{formatSignedMoney(fin.balance)}</strong></div>
          <div>
            <span className="muted">Yönetimin güveni</span>
            <strong className={world.board.confidence >= needed ? 'pos' : 'neg'}>{Math.round(world.board.confidence)}</strong>
            <span className="muted">yatırım için en az {Math.round(needed)}</span>
          </div>
          <div><span className="muted">Yıllık bakım gideri</span><strong>{formatMoney(maintenancePerYear(world, world.playerClubId))}</strong></div>
        </div>
        <div className="panel-note">
          Yatırımı yönetimden istersin: kulübün kasası bedelin 1,3 katı ve bir buçuk aylık maaş kadar olmalı, yönetim de sana yeterince
          güvenmeli (menajer itibarın yüksekse daha az güven yeter). Onaylanan yatırımın bedeli kasadan ödenir. Reddedilen talep 60 gün
          sonra yeniden istenebilir.
        </div>
      </section>
      <div className="fac-grid">
        {(['stadium', 'training', 'youth', 'medical'] as const).map((k) => <FacilityCard key={k} kind={k} />)}
      </div>
    </div>
  );
}
