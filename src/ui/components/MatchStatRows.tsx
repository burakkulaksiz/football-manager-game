import type { TeamMatchStats } from '../../engine';

/** İki takımın istatistikleri karşılıklı çubuklarla (canlı maç ve maç raporu). */
export function MatchStatRows({ home, away }: { home: TeamMatchStats; away: TeamMatchStats }) {
  const rows: [string, number, number, string?][] = [
    ['Topla Oynama', home.possession, away.possession, '%'],
    ['Şut', home.shots, away.shots],
    ['İsabetli Şut', home.shotsOnTarget, away.shotsOnTarget],
    ['Korner', home.corners, away.corners],
    ['Faul', home.fouls, away.fouls],
    ['Sarı Kart', home.yellowCards, away.yellowCards],
    ['Kırmızı Kart', home.redCards, away.redCards],
  ];
  return (
    <div className="panel-body match-stats">
      {rows.map(([label, hv, av, suffix = '']) => {
        const total = hv + av;
        const hp = total === 0 ? 50 : (hv / total) * 100;
        return (
          <div key={label} className="ms-row">
            <div className="ms-values">
              <span>{suffix === '%' ? `%${hv}` : hv}</span>
              <span className="ms-label">{label}</span>
              <span>{suffix === '%' ? `%${av}` : av}</span>
            </div>
            <div className="ms-bar">
              <i className="home" style={{ width: `${hp}%` }} />
              <i className="away" style={{ width: `${100 - hp}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
