import { ageOn, clubPlayers, HOME_NATION, marketValue } from '../../engine';
import { useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { EXPECTATION_LABELS, formatMoney, formatNumber } from '../labels';

export function ClubInfoScreen() {
  const world = useWorld();
  const club = world.clubs.find((c) => c.id === world.playerClubId)!;
  const players = clubPlayers(world, club.id);

  const totalWages = players.reduce((s, p) => s + p.contract.wage, 0);
  const totalValue = players.reduce((s, p) => s + marketValue(p, world.date), 0);
  const avgAge = players.reduce((s, p) => s + ageOn(p.birthDate, world.date), 0) / players.length;
  const foreigners = players.filter((p) => p.nationality !== HOME_NATION).length;

  const clubRows: [string, string][] = [
    ['Şehir', club.city],
    ['Stadyum', `${club.stadium} (${formatNumber(club.capacity)} kişilik)`],
    ['İtibar', `${club.reputation} / 100`],
    ['Taraftar Beklentisi', EXPECTATION_LABELS[club.fanExpectation]],
    ['Transfer Bütçesi', formatMoney(club.budget)],
    ['Maaş Bütçesi', `${formatMoney(club.wageBudget)} / yıl`],
  ];
  const squadRows: [string, string][] = [
    ['Oyuncu Sayısı', String(players.length)],
    ['Yabancı Oyuncu', String(foreigners)],
    ['Yaş Ortalaması', avgAge.toLocaleString('tr-TR', { maximumFractionDigits: 1 })],
    ['Toplam Maaş', `${formatMoney(totalWages)} / yıl`],
    ['Maaş Bütçesi Kullanımı', `%${Math.round((totalWages / club.wageBudget) * 100)}`],
    ['Kadro Değeri', formatMoney(totalValue)],
  ];

  return (
    <div className="two-columns">
      <section className="panel">
        <h2 className="panel-title">Kulüp Bilgisi</h2>
        <div className="panel-body">
          <div className="club-header">
            <ClubBadge club={club} size={48} />
            <span className="club-header-name">{club.name}</span>
          </div>
          <table className="info-table">
            <tbody>
              {clubRows.map(([k, v]) => (
                <tr key={k}><th>{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2 className="panel-title">Kadro Özeti</h2>
        <div className="panel-body">
          <table className="info-table">
            <tbody>
              {squadRows.map(([k, v]) => (
                <tr key={k}><th>{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
