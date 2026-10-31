import { useState } from 'react';
import {
  acceptJobOffer,
  applyForJob,
  daysBetween,
  divisionOf,
  leagueName,
  fitsClub,
  formatDateTR,
  getClub,
  isUnemployed,
  managerReputation,
  rejectJobOffer,
  reputationLabel,
  requiredReputation,
  UNEMPLOYMENT_LIMIT_DAYS,
  type JobOffer,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { Modal } from '../components/Modal';
import { formatDayMonth } from '../labels';

/** Teklifi kabul (görevdeyken mevcut kulüpten ayrılacağın için onay istenir). */
function AcceptDialog({ offer, onClose }: { offer: JobOffer; onClose: () => void }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const setScreen = useGameStore((s) => s.setScreen);
  const club = getClub(world, offer.clubId);
  const current = isUnemployed(world) ? null : getClub(world, world.playerClubId);
  const accept = () => {
    const error = worldAction((w) => acceptJobOffer(w, offer.id));
    onClose();
    if (error) showNotice(error, 'error');
    else {
      showNotice(`${club.name}'ın teknik direktörü oldun.`);
      setScreen('squad');
    }
  };
  return (
    <Modal
      title={`${club.name} teklifi`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-continue" onClick={accept}>Kabul Et <span className="btn-continue-arrow">›</span></button>
        </>
      }
    >
      <p>
        {current
          ? `${current.name}'dan ayrılıp ${club.name}'a geçeceksin. Eski kulübünü yapay zekâ yönetecek; bu sezonki kaydın kariyerine "ayrıldı" olarak yazılır.`
          : `${club.name} ile anlaşacaksın. Yönetimin hedefi ve bütçe kulübe göre belirlenir.`}
      </p>
    </Modal>
  );
}

/** İş merkezi: durum, gelen teklifler, boş teknik direktörlük koltukları ve başvurular. */
export function JobsScreen() {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const [accepting, setAccepting] = useState<JobOffer | null>(null);
  const reputation = managerReputation(world);
  const unemployed = world.unemployed ?? null;
  const offers = world.jobOffers ?? [];
  const applications = world.jobApplications ?? [];
  const vacancies = [...(world.vacancies ?? [])]
    .map((v) => ({ v, club: getClub(world, v.clubId) }))
    .sort((a, b) => b.club.reputation - a.club.reputation);

  const apply = (clubId: string) => {
    const error = worldAction((w) => applyForJob(w, clubId));
    if (error) showNotice(error, 'error');
    else showNotice('Başvurun yapıldı; kulüp birkaç gün içinde yanıt verecek.');
  };

  return (
    <div className="screen">
      <section className="panel">
        <h2 className="panel-title">Durumun</h2>
        <div className="panel-body">
          {unemployed ? (
            <>
              <div className="jobs-status unemployed">
                İşsizsin · {formatDateTR(unemployed.since)} tarihinden beri ({daysBetween(unemployed.since, world.date)} gün)
              </div>
              <div className="panel-note">
                {Math.max(0, UNEMPLOYMENT_LIMIT_DAYS - daysBetween(unemployed.since, world.date))} gün içinde bir kulüple anlaşamazsan kariyerin sona erer.
                Boş koltuklara başvurabilir ya da kulüplerin teklif etmesini bekleyebilirsin; Devam ile zaman ilerler, ligler oynanmaya devam eder.
              </div>
            </>
          ) : (
            <div className="jobs-status">
              {getClub(world, world.playerClubId).name} teknik direktörüsün. Daha itibarlı bir kulüpte koltuk boşalırsa teklif gelebilir; sen de başvurabilirsin.
            </div>
          )}
          <div className="kv"><span className="kv-label">İtibarın</span><span className="kv-value">{Math.round(reputation)} ({reputationLabel(Math.round(reputation))})</span></div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Gelen Teklifler</h2>
        {offers.length === 0 ? (
          <div className="panel-body muted">Şu an teklif yok.</div>
        ) : (
          <table className="data-table">
            <tbody>
              {offers.map((o) => {
                const club = getClub(world, o.clubId);
                return (
                  <tr key={o.id}>
                    <td className="strong"><span className="club-cell"><ClubBadge club={club} size={18} /> {club.name}</span></td>
                    <td className="muted">{o.via === 'application' ? 'Başvuruna yanıt' : 'Kulübün teklifi'} · {formatDayMonth(o.expires)} tarihine kadar</td>
                    <td className="right">
                      <button className="btn btn-small" onClick={() => worldAction((w) => rejectJobOffer(w, o.id))}>Reddet</button>{' '}
                      <button className="btn-continue btn-small" onClick={() => setAccepting(o)}>Kabul Et</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Boş Teknik Direktörlük Koltukları</h2>
        {vacancies.length === 0 ? (
          <div className="panel-body muted">Şu an boş koltuk yok. Sonuçları kötü giden kulüpler sezon içinde hocasını değiştirebilir; sezon arasında da değişiklikler olur.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Kulüp</th>
                <th>Lig</th>
                <th className="num">İtibar</th>
                <th className="num">İstenen menajer itibarı</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map(({ v, club }) => {
                const applied = applications.find((a) => a.clubId === club.id);
                const offered = offers.some((o) => o.clubId === club.id);
                const fits = fitsClub(world, club);
                const own = club.id === world.playerClubId || club.id === unemployed?.lastClubId;
                return (
                  <tr key={v.clubId}>
                    <td className="strong"><span className="club-cell"><ClubBadge club={club} size={18} /> {club.name}</span></td>
                    <td>{divisionOf(club) === 2 ? '1. Lig' : leagueName(club.country)}</td>
                    <td className="num">{club.reputation}</td>
                    <td className={`num${fits ? ' pos' : ' neg'}`}>{requiredReputation(club)}</td>
                    <td className="muted">
                      {own ? 'Eski kulübün' : offered ? 'Teklif elinde' : applied ? `Başvurdun · yanıt ${formatDayMonth(applied.answerOn)}` : fits ? 'İtibarın yetiyor' : 'İtibarın yetmeyebilir'}
                    </td>
                    <td className="right">
                      {!own && !applied && !offered && <button className="btn btn-small" onClick={() => apply(club.id)}>Başvur</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="panel-note">Kulüp, menajerin itibarı istenen düzeydeyse başvuruyu kabul eder. Boş koltuklar 20–60 gün içinde başka bir adayla dolar.</div>
      </section>

      {accepting && <AcceptDialog offer={accepting} onClose={() => setAccepting(null)} />}
    </div>
  );
}
