import {
  ageOn,
  leadersMorale,
  teamHierarchy,
  teamMood,
  type HierarchyLevel,
  type TeamMood,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { moraleLabel } from '../labels';

const LEVEL_LABELS: Record<HierarchyLevel, string> = {
  leader: 'Takım lideri',
  influential: 'Etkili oyuncu',
  respected: 'Saygın oyuncu',
  other: 'Diğer',
};

const MOOD_LABELS: Record<TeamMood, string> = {
  great: 'Harika',
  good: 'İyi',
  ok: 'İdare eder',
  poor: 'Gergin',
  bad: 'Kötü',
};

/** Takım dinamikleri: kaptanlar, hiyerarşi ve takımın havası. */
export function DynamicsScreen() {
  const world = useWorld();
  const updateTactics = useGameStore((s) => s.updateTactics);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const clubId = world.playerClubId;
  const tactics = world.tactics[clubId]!;
  const hierarchy = teamHierarchy(world, clubId);
  const mood = teamMood(world, clubId);
  const leadersMood = leadersMorale(world, clubId);
  const maxInfluence = Math.max(1, ...hierarchy.map((e) => e.influence));
  const unhappy = hierarchy.filter((e) => world.players[e.playerId]!.morale < 35).length;

  const select = (label: string, key: 'captainId' | 'viceCaptainId') => (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <select
        value={tactics[key] ?? ''}
        onChange={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value);
          updateTactics((t) => ({ ...t, [key]: v }));
        }}
      >
        <option value="">Otomatik (sahadaki en iyi lider)</option>
        {hierarchy.map((e) => {
          const p = world.players[e.playerId]!;
          return (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} — {LEVEL_LABELS[e.level]}
            </option>
          );
        })}
      </select>
    </div>
  );

  return (
    <div className="screen">
      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">Kaptanlar</h2>
          <div className="panel-body">
            {select('Kaptan', 'captainId')}
            {select('Yardımcı Kaptan', 'viceCaptainId')}
            <div className="panel-note">
              Kaptan sahadayken (değilse yardımcı kaptan) liderliğiyle takımı biraz etkiler. Kaptanlığı alınan oyuncu kırılır;
              takımın liderleri varken hiyerarşide alt sıradaki birini kaptan yapmak liderleri bozar.
            </div>
          </div>
        </section>
        <section className="panel">
          <h2 className="panel-title">Takımın Havası</h2>
          <div className="panel-body">
            <div className="kv"><span className="kv-label">Genel hava</span><span className="kv-value">{MOOD_LABELS[mood.mood]}</span></div>
            <div className="kv">
              <span className="kv-label">Liderlerin morali</span>
              <span className="kv-value">{leadersMood === null ? '—' : moraleLabel(leadersMood)}</span>
            </div>
            <div className="kv"><span className="kv-label">Mutsuz oyuncu</span><span className="kv-value">{unhappy}</span></div>
            <div className="kv"><span className="kv-label">Bekleyen görüşme talebi</span><span className="kv-value">{world.requests.length}</span></div>
            <div className="kv"><span className="kv-label">Verilen forma sözü</span><span className="kv-value">{world.promises.length}</span></div>
            <div className="panel-note">
              Liderlerin havası her hafta takıma yayılır: mutlularsa takımın morali hafifçe yükselir, mutsuzlarsa düşer.
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Hiyerarşi</h2>
        <table className="data-table clickable">
          <thead>
            <tr>
              <th>Seviye</th>
              <th>Oyuncu</th>
              <th className="num">Yaş</th>
              <th className="num">Liderlik</th>
              <th className="num">Kulüpte</th>
              <th>Moral</th>
              <th>Etki</th>
            </tr>
          </thead>
          <tbody>
            {hierarchy.map((e) => {
              const p = world.players[e.playerId]!;
              const role = tactics.captainId === p.id ? 'K' : tactics.viceCaptainId === p.id ? 'YK' : null;
              return (
                <tr key={p.id} onClick={() => openPlayer(p.id)} className={e.level === 'leader' ? 'row-leader' : ''}>
                  <td><span className={`level-badge level-${e.level}`}>{LEVEL_LABELS[e.level]}</span></td>
                  <td className="strong">
                    {p.firstName} {p.lastName}
                    {role && <span className="tag tag-role" title={role === 'K' ? 'Kaptan' : 'Yardımcı kaptan'}>{role}</span>}
                    {p.loan && <span className="tag">Kiralık</span>}
                  </td>
                  <td className="num">{ageOn(p.birthDate, world.date)}</td>
                  <td className="num">{p.attributes.leadership}</td>
                  <td className="num">{p.loan ? '—' : `${Math.floor(e.tenure)} yıl`}</td>
                  <td>{moraleLabel(p.morale)}</td>
                  <td>
                    <span className="influence-bar"><i style={{ width: `${(e.influence / maxInfluence) * 100}%` }} /></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="panel-note">
          Etki: liderlik, tecrübe, takımdaki önem ve kulüpte geçirilen süreden gelir; kaptanlık da ekler. İlk 2 takım lideri,
          sonraki 3 etkili, sonraki 5 saygın oyuncu sayılır.
        </div>
      </section>
    </div>
  );
}
