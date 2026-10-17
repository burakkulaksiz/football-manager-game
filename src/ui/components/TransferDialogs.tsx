import { useState } from 'react';
import {
  ageOn,
  askingPrice,
  getClub,
  loanFeeAsk,
  makeOffer,
  marketValue,
  negotiateFreeAgent,
  negotiateRenewal,
  negotiateTransfer,
  NEGOTIATION_PATIENCE,
  preferredYears,
  respondToIncoming,
  type NegotiationResult,
  type Player,
  type TransferOffer,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatMoney } from '../labels';
import { Modal } from './Modal';

/** Tutar girişi: "bin €" cinsinden yazılır, altında okunur hâli görünür. */
function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="money-input">
        <input
          type="number"
          min={0}
          step={50}
          value={Math.round(value / 1000)}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 1000)}
        />
        <span className="money-unit">bin €</span>
        <span className="money-preview">{formatMoney(value)}</span>
      </span>
    </label>
  );
}

/** Kulübe bonservis ya da kiralık teklifi. */
export function OfferDialog({ player, kind, onClose }: { player: Player; kind: TransferOffer['kind']; onClose: () => void }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const value = marketValue(player, world.date);
  const asking = kind === 'loan' ? loanFeeAsk(world, player) : askingPrice(world, player);
  const budget = world.finances[world.playerClubId]!.transferBudget;
  const [fee, setFee] = useState(Math.min(budget, kind === 'loan' ? asking : value));
  const [error, setError] = useState<string | null>(null);
  const club = player.clubId ? getClub(world, player.clubId).name : '';

  const submit = () => {
    const result = worldAction((w) => makeOffer(w, player.id, kind, fee));
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    showNotice(`${club} kulübüne teklif yapıldı; yanıt yarın gelecek.`);
    onClose();
  };

  return (
    <Modal
      title={kind === 'loan' ? 'Kiralık Teklifi' : 'Transfer Teklifi'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-continue" onClick={submit}>
            Teklif Yap <span className="btn-continue-arrow">›</span>
          </button>
        </>
      }
    >
      <p>
        <strong>{player.firstName} {player.lastName}</strong> için {club} kulübüne{' '}
        {kind === 'loan' ? 'sezon sonuna kadar kiralık' : 'bonservis'} teklifi.
      </p>
      <div className="kv"><span className="kv-label">Piyasa değeri</span><span className="kv-value">{formatMoney(value)}</span></div>
      <div className="kv"><span className="kv-label">Kulübün beklentisi (tahmini)</span><span className="kv-value">{formatMoney(asking)}</span></div>
      <div className="kv"><span className="kv-label">Transfer bütçen</span><span className="kv-value">{formatMoney(budget)}</span></div>
      {kind === 'loan' && (
        <div className="kv"><span className="kv-label">Maaşı (sen ödersin)</span><span className="kv-value">{formatMoney(player.contract.wage)} / yıl</span></div>
      )}
      <div className="dialog-gap" />
      <MoneyInput label={kind === 'loan' ? 'Kiralık bedeli' : 'Bonservis'} value={fee} onChange={setFee} />
      <div className="quick-amounts">
        <button className="btn btn-small" onClick={() => setFee(value)}>Değeri</button>
        <button className="btn btn-small" onClick={() => setFee(asking)}>Beklenti</button>
        <button className="btn btn-small" onClick={() => setFee(budget)}>Tüm bütçe</button>
      </div>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}

/**
 * Sözleşme görüşmesi: transfer (kabul edilmiş teklif) ya da kendi oyuncumuzla yenileme.
 * Oyuncu talebini ilk yanıtında söyler; transferde sabrı sınırlıdır.
 */
export function ContractDialog({ player, offer, onClose }: { player: Player; offer?: TransferOffer; onClose: () => void }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const age = ageOn(player.birthDate, world.date);
  const freeAgent = !offer && player.clubId === null;
  const [minYears, maxYears] = preferredYears(age);
  const [wage, setWage] = useState(player.contract.wage);
  const [years, setYears] = useState(minYears);
  const [bonus, setBonus] = useState(0);
  const [response, setResponse] = useState<NegotiationResult | null>(null);
  const done = response?.outcome === 'signed' || response?.outcome === 'collapsed';

  const submit = () => {
    const terms = { wage, years, signingBonus: bonus };
    const result = worldAction((w) =>
      offer ? negotiateTransfer(w, offer.id, terms) : freeAgent ? negotiateFreeAgent(w, player.id, terms) : negotiateRenewal(w, player.id, terms),
    );
    setResponse(result);
    if (result.demand) {
      // Talebi forma yansıt ki kullanıcı oradan pazarlık edebilsin.
      setYears(result.demand.years);
    }
    if (result.outcome === 'signed') showNotice(result.message);
  };

  const patience = offer ? world.offers.find((o) => o.id === offer.id)?.patience ?? 0 : null;

  return (
    <Modal
      title={offer || freeAgent ? 'Sözleşme Görüşmesi' : 'Sözleşme Yenileme'}
      onClose={onClose}
      footer={
        done ? (
          <button className="btn" onClick={onClose}>Kapat</button>
        ) : (
          <>
            <button className="btn" onClick={onClose}>Vazgeç</button>
            <button className="btn-continue" onClick={submit}>
              Teklif Et <span className="btn-continue-arrow">›</span>
            </button>
          </>
        )
      }
    >
      <p>
        <strong>{player.firstName} {player.lastName}</strong> ({age} yaşında) —{' '}
        {offer ? `bonservis ${formatMoney(offer.fee)} üzerinde anlaşıldı.` : freeAgent ? 'serbest oyuncu, bonservis yok.' : 'mevcut sözleşmesini yenile.'}
      </p>
      <div className="kv"><span className="kv-label">Şu anki maaşı</span><span className="kv-value">{formatMoney(player.contract.wage)} / yıl</span></div>
      <div className="kv"><span className="kv-label">Tercih ettiği süre</span><span className="kv-value">{minYears}–{maxYears} yıl</span></div>
      {patience !== null && (
        <div className="kv">
          <span className="kv-label">Oyuncunun sabrı</span>
          <span className="kv-value patience">
            {Array.from({ length: NEGOTIATION_PATIENCE }, (_, i) => <i key={i} className={i < patience ? 'on' : ''} />)}
          </span>
        </div>
      )}
      <div className="dialog-gap" />
      {!done && (
        <>
          <MoneyInput label="Yıllık maaş" value={wage} onChange={setWage} />
          <label className="field">
            <span>Süre</span>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} yıl</option>)}
            </select>
          </label>
          <MoneyInput label="İmza bonusu (tek seferlik)" value={bonus} onChange={setBonus} />
          {response?.demand && (
            <button className="btn btn-small" onClick={() => setWage(response.demand!.wage)}>
              Talebini yaz ({formatMoney(response.demand.wage)})
            </button>
          )}
        </>
      )}
      {response && (
        <div className={`negotiation ${response.outcome}`}>{response.message}</div>
      )}
    </Modal>
  );
}

/** Gelen teklife karşı teklif. */
export function CounterDialog({ offer, onClose }: { offer: TransferOffer; onClose: () => void }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const player = world.players[offer.playerId]!;
  const [fee, setFee] = useState(Math.round(offer.fee * 1.25));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const err = worldAction((w) => respondToIncoming(w, offer.id, 'counter', fee));
    if (err) setError(err);
    else onClose();
  };

  return (
    <Modal
      title="Karşı Teklif"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-continue" onClick={submit}>Gönder <span className="btn-continue-arrow">›</span></button>
        </>
      }
    >
      <p>
        {getClub(world, offer.buyerId).name}, <strong>{player.firstName} {player.lastName}</strong> için{' '}
        {formatMoney(offer.fee)} teklif etti. Piyasa değeri {formatMoney(marketValue(player, world.date))}.
        Fazla yüksek istersen alıcı vazgeçebilir.
      </p>
      <div className="dialog-gap" />
      <MoneyInput label="İstediğin bonservis" value={fee} onChange={setFee} />
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}
