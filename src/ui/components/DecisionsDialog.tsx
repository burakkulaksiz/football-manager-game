import {
  getClub,
  isOverAge,
  letContractExpire,
  pendingDecisions,
  promoteToFirstTeam,
  releasePlayer,
  type Decision,
  type GameWorld,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatMoney } from '../labels';
import { Modal } from './Modal';

const TOPICS: Record<string, string> = {
  playingTime: 'forma şansı',
  contract: 'sözleşme',
  transfer: 'ayrılık',
};

/** Kararın açıklaması. */
function describe(world: GameWorld, d: Decision): string {
  const p = world.players[d.playerId];
  const name = p ? `${p.firstName} ${p.lastName}` : 'Oyuncu';
  const offer = d.offerId !== undefined ? world.offers.find((o) => o.id === d.offerId) : undefined;
  const club = (id: string) => getClub(world, id).name;
  switch (d.kind) {
    case 'offer':
      return `${club(offer!.buyerId)}, ${name} için ${formatMoney(offer!.fee)} ${offer!.kind === 'loan' ? 'kiralık ' : ''}teklif yaptı; yanıt bekliyor.`;
    case 'counter':
      return `${club(offer!.sellerId)}, ${name} için karşı teklif yaptı: ${formatMoney(offer!.counterFee ?? offer!.fee)}.`;
    case 'contract':
      return `${club(offer!.sellerId)} teklifini kabul etti; ${name} ile sözleşme görüşmesi bekliyor.`;
    case 'request': {
      const r = world.requests.find((x) => x.id === d.requestId);
      return `${name} seninle görüşmek istiyor (${TOPICS[r?.topic ?? ''] ?? 'görüşme'}).`;
    }
    case 'overAge':
      return `${name} U19 yaş sınırını geçti: A takıma al ya da serbest bırak.`;
    case 'expiring':
      return `${name}'in sözleşmesi 30 Haziran'da bitiyor: yenile ya da gitmesine izin ver.`;
  }
}

const TITLES: Record<Decision['kind'], string> = {
  offer: 'Gelen teklif',
  counter: 'Karşı teklif',
  contract: 'Sözleşme görüşmesi',
  request: 'Oyuncu görüşmesi',
  overAge: 'U19',
  expiring: 'Sözleşmesi bitiyor',
};

/**
 * Karar bekleyen konular: Devam bunlar yüzünden ilerlemedi. Her konudan ilgili yere gidilir; U19 ve sözleşmesi biten
 * oyuncu için kararı burada da verebilirsin.
 */
export function DecisionsDialog() {
  const world = useWorld();
  const open = useGameStore((s) => s.decisionsOpen);
  const setOpen = useGameStore((s) => s.setDecisionsOpen);
  const setScreen = useGameStore((s) => s.setScreen);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const worldAction = useGameStore((s) => s.worldAction);
  if (!open) return null;
  const decisions = pendingDecisions(world);
  const close = () => setOpen(false);
  const go = (d: Decision) => {
    close();
    if (d.kind === 'offer' || d.kind === 'counter' || d.kind === 'contract') setScreen('transfers', { 'transfers.tab': 'offers' });
    else if (d.kind === 'overAge') setScreen('academy', { 'academy.tab': 'u19' });
    else openPlayer(d.playerId);
  };

  return (
    <Modal title="Karar bekleyen konular" onClose={close} footer={<button className="btn" onClick={close}>Kapat</button>}>
      {decisions.length === 0 ? (
        <p>Karar bekleyen konu kalmadı; Devam edebilirsin.</p>
      ) : (
        <>
          <p className="muted decisions-intro">Bunlara karar vermeden tarih ilerlemez.</p>
          <ul className="decisions">
            {decisions.map((d) => (
              <li key={d.id}>
                <span className="tag">{TITLES[d.kind]}</span>
                <span className="decision-text">{describe(world, d)}</span>
                <span className="decision-actions">
                  <button className="btn btn-small btn-go" onClick={() => go(d)}>
                    {d.kind === 'request' || d.kind === 'expiring' ? 'Oyuncuya git' : d.kind === 'overAge' ? 'Altyapıya git' : 'Teklife git'}
                  </button>
                  {d.kind === 'overAge' && (
                    <>
                      <button className="btn btn-small" onClick={() => worldAction((w) => promoteToFirstTeam(w, w.players[d.playerId]!))}>A takıma al</button>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => worldAction((w) => {
                          const p = w.players[d.playerId]!;
                          if (isOverAge(p, w.date)) releasePlayer(w, p);
                        })}
                      >
                        Serbest bırak
                      </button>
                    </>
                  )}
                  {d.kind === 'expiring' && (
                    <button className="btn btn-small" onClick={() => worldAction((w) => letContractExpire(w, d.id))}>Gitmesine izin ver</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
