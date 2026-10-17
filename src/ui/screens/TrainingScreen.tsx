import {
  ageOn,
  clubPlayers,
  INTENSITY_EFFECTS,
  POSITIONS,
  primaryPosition,
  trainingOf,
  YELLOW_LIMIT,
  type Training,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { Stars } from '../components/Stars';
import { StatusTags } from '../components/StatusTags';
import {
  abilityStars,
  moraleLabel,
  POSITION_LABELS,
  positionGroup,
  TRAINING_FOCUS_OPTIONS,
  TRAINING_INTENSITY_OPTIONS,
  trendSymbol,
} from '../labels';

export function TrainingScreen() {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const clubId = world.playerClubId;
  const training = trainingOf(world, clubId);
  const effects = INTENSITY_EFFECTS[training.intensity];
  const squad = clubPlayers(world, clubId).sort(
    (a, b) => POSITIONS.indexOf(primaryPosition(a)) - POSITIONS.indexOf(primaryPosition(b)) || (a.squadNumber ?? 99) - (b.squadNumber ?? 99),
  );

  const set = (change: Partial<Training>) =>
    worldAction((w) => {
      w.training = { ...w.training, [clubId]: { ...trainingOf(w, clubId), ...change } };
    });

  const injured = squad.filter((p) => p.injury);
  const banned = squad.filter((p) => p.suspension > 0);
  const atRisk = squad.filter((p) => p.suspension === 0 && p.yellowCards === YELLOW_LIMIT - 1);

  return (
    <div className="screen">
      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">Antrenman Odağı</h2>
          <div className="panel-body focus-grid">
            {TRAINING_FOCUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`focus-card${training.focus === o.value ? ' active' : ''}`}
                onClick={() => set({ focus: o.value })}
              >
                <span className="focus-title">{o.label}</span>
                <span className="focus-hint">{o.hint}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel-title">Yoğunluk</h2>
          <div className="panel-body">
            <div className="tabs intensity-tabs">
              {TRAINING_INTENSITY_OPTIONS.map((o) => (
                <button key={o.value} className={`tab${training.intensity === o.value ? ' active' : ''}`} onClick={() => set({ intensity: o.value })}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="instr-hint">{TRAINING_INTENSITY_OPTIONS.find((o) => o.value === training.intensity)?.hint}</div>
            <div className="sub-head sub-head-gap">Etkileri</div>
            <div className="kv"><span className="kv-label">Gelişim hızı</span><span className="kv-value">%{Math.round(effects.development * 100)}</span></div>
            <div className="kv"><span className="kv-label">Maçlar arası en yüksek kondisyon</span><span className="kv-value">%{effects.conditionCap}</span></div>
            <div className="kv"><span className="kv-label">Antrenman sakatlığı riski</span><span className="kv-value">×{effects.injury}</span></div>
            <div className="panel-note">
              Gelişim haftada bir (pazartesi) işlenir. Gençler potansiyellerine doğru gelişir; 30 yaş sonrası önce fiziksel
              özellikler geriler. Profesyonellik gelişimi hızlandırır, gerilemeyi yavaşlatır.
            </div>
          </div>
        </section>
      </div>

      {(injured.length > 0 || banned.length > 0 || atRisk.length > 0) && (
        <section className="panel">
          <h2 className="panel-title">Sağlık ve Disiplin</h2>
          <div className="panel-body health-list">
            {injured.map((p) => (
              <div key={p.id} className="kv link" onClick={() => openPlayer(p.id)}>
                <span className="kv-label">{p.firstName} {p.lastName}</span>
                <span className="kv-value neg">{p.injury!.name} · {p.injury!.daysOut} gün</span>
              </div>
            ))}
            {banned.map((p) => (
              <div key={p.id} className="kv link" onClick={() => openPlayer(p.id)}>
                <span className="kv-label">{p.firstName} {p.lastName}</span>
                <span className="kv-value neg">{p.suspension} maç cezalı</span>
              </div>
            ))}
            {atRisk.map((p) => (
              <div key={p.id} className="kv link" onClick={() => openPlayer(p.id)}>
                <span className="kv-label">{p.firstName} {p.lastName}</span>
                <span className="kv-value">{p.yellowCards} sarı kart — bir sarıda cezalı</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Oyuncu Gelişimi</h2>
        <table className="data-table clickable">
          <thead>
            <tr>
              <th className="num">No</th>
              <th>İsim</th>
              <th>Mevki</th>
              <th className="num">Yaş</th>
              <th>Yetenek</th>
              <th>Potansiyel</th>
              <th>Gelişim</th>
              <th className="num">Kond.</th>
              <th>Moral</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((p) => {
              const pos = primaryPosition(p);
              const trend = trendSymbol(p.trend);
              return (
                <tr key={p.id} onClick={() => openPlayer(p.id)}>
                  <td className="num">{p.squadNumber}</td>
                  <td className="strong">{p.firstName} {p.lastName}</td>
                  <td><span className={`pos-box pos-${positionGroup(pos)}`}>{POSITION_LABELS[pos]}</span></td>
                  <td className="num">{ageOn(p.birthDate, world.date)}</td>
                  <td><Stars value={abilityStars(p.currentAbility)} /></td>
                  <td><Stars value={abilityStars(p.potentialAbility)} /></td>
                  <td className={trend.className}>{trend.text}</td>
                  <td className={`num${p.condition < 75 ? ' neg' : ''}`}>%{p.condition}</td>
                  <td>{moraleLabel(p.morale)}</td>
                  <td><StatusTags player={p} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="panel-note">Yetenek ve potansiyel yıldızları antrenörlerin değerlendirmesidir (lig ölçeğinde).</div>
      </section>
    </div>
  );
}
