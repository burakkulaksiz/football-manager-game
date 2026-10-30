import { useState } from 'react';
import {
  AGENT_PROFILES,
  agentOf,
  ageOn,
  askingPrice,
  getClub,
  listPlayer,
  loanFeeAsk,
  makeOffer,
  marketValue,
  negotiateFreeAgent,
  negotiateRenewal,
  negotiateTransfer,
  preferredYears,
  respondToIncoming,
  expectedRole,
  ROLE_ORDER,
  suggestedListPrice,
  transferWindow,
  type ContractDemand,
  type ListingKind,
  type NegotiationResult,
  type Player,
  type SquadRole,
  type TransferOffer,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { AGENT_STYLE_HINTS, AGENT_STYLE_LABELS, formatMoney, ROLE_LABELS } from '../labels';
import { Modal } from './Modal';

/** Tutar girişi: "bin €" cinsinden yazılır, altında okunur hâli görünür. */
function MoneyInput({ label, value, onChange, step = 50 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="money-input">
        <input
          type="number"
          min={0}
          step={step}
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
  const [sellOn, setSellOn] = useState(0);
  const [optionFee, setOptionFee] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const club = player.clubId ? getClub(world, player.clubId).name : '';

  const submit = () => {
    const result = worldAction((w) => makeOffer(w, player.id, kind, fee, { sellOn, optionFee }));
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
      {kind === 'transfer' ? (
        <>
          <label className="field">
            <span>Sonradan satış payı</span>
            <select value={sellOn} onChange={(e) => setSellOn(Number(e.target.value))}>
              {[0, 10, 15, 20, 25, 30, 40, 50].map((p) => <option key={p} value={p}>{p === 0 ? 'Yok' : `%${p}`}</option>)}
            </select>
          </label>
          <div className="field-note">Oyuncuyu ileride satarsan bonservisin bu payı {club} kulübüne gider; karşılığında kulüp daha az bonservis ister.</div>
        </>
      ) : (
        <>
          <MoneyInput label="Satın alma opsiyonu (0 = yok)" value={optionFee} onChange={setOptionFee} />
          <div className="field-note">Kiralık sürerken bu bedeli ödeyip oyuncuyu mevcut sözleşmesiyle kalıcı alabilirsin. Kulüp en az bonservis beklentisini ister (≈ {formatMoney(askingPrice(world, player))}).</div>
        </>
      )}
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}

/**
 * Sözleşme görüşmesi: transfer (kabul edilmiş teklif), serbest oyuncu ya da kendi oyuncumuzla yenileme.
 * Karşıda oyuncunun menajeri vardır: tavrı talebi ve sabrı belirler; talebini ilk yanıtında söyler.
 */
export function ContractDialog({ player, offer, onClose }: { player: Player; offer?: TransferOffer; onClose: () => void }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const age = ageOn(player.birthDate, world.date);
  const freeAgent = !offer && player.clubId === null;
  const [minYears, maxYears] = preferredYears(age);
  const agent = agentOf(world, player);
  const expected = expectedRole(world, player, world.playerClubId);
  const [wage, setWage] = useState(player.contract.wage);
  const [years, setYears] = useState(minYears);
  const [bonus, setBonus] = useState(0);
  const [agentFee, setAgentFee] = useState(0);
  const [role, setRole] = useState<SquadRole>(player.contract.role ?? expected);
  const [clause, setClause] = useState(player.contract.releaseClause ?? 0);
  const [appearanceBonus, setAppearanceBonus] = useState(player.contract.appearanceBonus ?? 0);
  const [goalBonus, setGoalBonus] = useState(player.contract.goalBonus ?? 0);
  const [response, setResponse] = useState<NegotiationResult | null>(null);
  const done = response?.outcome === 'signed' || response?.outcome === 'collapsed';

  const submit = () => {
    const terms = { wage, years, signingBonus: bonus, agentFee, role, releaseClause: clause, appearanceBonus, goalBonus };
    const result = worldAction((w) =>
      offer ? negotiateTransfer(w, offer.id, terms) : freeAgent ? negotiateFreeAgent(w, player.id, terms) : negotiateRenewal(w, player.id, terms),
    );
    setResponse(result);
    if (result.outcome === 'signed') showNotice(result.message);
  };

  /** Menajerin talebini forma yaz (pazarlık oradan sürer). */
  const fillDemand = (d: ContractDemand) => {
    setWage(d.wage);
    setYears(d.years);
    setAgentFee(d.agentFee);
    setRole(d.role);
    if (d.releaseClause !== null) setClause(d.releaseClause);
  };

  const patience = offer ? world.offers.find((o) => o.id === offer.id)?.patience ?? 0 : null;
  const maxPatience = AGENT_PROFILES[agent.style].patience;
  // Bugün ödenecek: bonservis (transferde) + imza bonusu + menajer ücreti
  const upfront = (offer?.fee ?? 0) + bonus + agentFee;

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
      <div className="kv">
        <span className="kv-label">Menajeri</span>
        <span className="kv-value">
          {agent.name} <span className={`agent-style ${agent.style}`}>{AGENT_STYLE_LABELS[agent.style]}</span>
        </span>
      </div>
      <div className="agent-hint">{AGENT_STYLE_HINTS[agent.style]}</div>
      <div className="kv"><span className="kv-label">Şu anki maaşı</span><span className="kv-value">{formatMoney(player.contract.wage)} / yıl</span></div>
      <div className="kv"><span className="kv-label">Tercih ettiği süre</span><span className="kv-value">{minYears}–{maxYears} yıl</span></div>
      <div className="kv"><span className="kv-label">Beklediği rol</span><span className="kv-value">{ROLE_LABELS[expected]}</span></div>
      {patience !== null && (
        <div className="kv">
          <span className="kv-label">Menajerin sabrı</span>
          <span className="kv-value patience">
            {Array.from({ length: Math.max(maxPatience, patience) }, (_, i) => <i key={i} className={i < patience ? 'on' : ''} />)}
          </span>
        </div>
      )}
      <div className="dialog-gap" />
      {!done && (
        <div className="contract-form">
          <fieldset>
            <legend>Maaş ve süre</legend>
            <MoneyInput label="Yıllık maaş" value={wage} onChange={setWage} />
            <label className="field">
              <span>Süre</span>
              <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} yıl</option>)}
              </select>
            </label>
            <MoneyInput label="İmza bonusu (tek seferlik)" value={bonus} onChange={setBonus} />
            <MoneyInput label="Menajer ücreti (tek seferlik)" value={agentFee} onChange={setAgentFee} />
          </fieldset>
          <fieldset>
            <legend>Sözleşme maddeleri</legend>
            <label className="field">
              <span>Rol</span>
              <select value={role} onChange={(e) => setRole(e.target.value as SquadRole)}>
                {[...ROLE_ORDER].reverse().map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            {role === 'star' && <div className="field-note">Önemli oyuncu rolü forma sözü sayılır: ilk 11'de oynamazsa morali bozulur.</div>}
            <MoneyInput label="Serbest kalma bedeli (0 = yok)" value={clause} onChange={setClause} />
            <MoneyInput label="Maç başına prim" value={appearanceBonus} onChange={setAppearanceBonus} step={1} />
            <MoneyInput label="Gol primi" value={goalBonus} onChange={setGoalBonus} step={1} />
          </fieldset>
          <div className="kv"><span className="kv-label">Bugün ödenecek</span><span className="kv-value">{formatMoney(upfront)}</span></div>
          {response?.demand && (
            <button className="btn btn-small" onClick={() => fillDemand(response.demand!)}>
              Talebini yaz
            </button>
          )}
        </div>
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
        {offer.kind === 'loan' ? 'kiralık bedeli olarak ' : ''}{formatMoney(offer.fee)} teklif etti. Piyasa değeri {formatMoney(marketValue(player, world.date))}.
        Fazla yüksek istersen alıcı vazgeçebilir.
      </p>
      <div className="dialog-gap" />
      <MoneyInput label={offer.kind === 'loan' ? 'İstediğin kiralık bedeli' : 'İstediğin bonservis'} value={fee} onChange={setFee} />
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}

/** Kendi oyuncunu transfer / kiralık listesine koyma (ya da bedeli değiştirme). */
export function ListDialog({ player, kind, onClose }: { player: Player; kind: ListingKind; onClose: () => void }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const suggested = suggestedListPrice(world, player, kind);
  const current = player.listing?.kind === kind ? player.listing.price : null;
  const [auto, setAuto] = useState(player.listing?.kind === kind ? current === null : false);
  const [price, setPrice] = useState(current ?? suggested);
  const [error, setError] = useState<string | null>(null);
  const window = transferWindow(world.date);
  const name = `${player.firstName} ${player.lastName}`;
  const changing = player.listing !== undefined;

  const submit = () => {
    const err = worldAction((w) => listPlayer(w, w.players[player.id]!, kind, auto ? null : price));
    if (err) {
      setError(err);
      return;
    }
    showNotice(`${name} ${kind === 'loan' ? 'kiralık' : 'transfer'} listesine kondu.`);
    onClose();
  };

  return (
    <Modal
      title={kind === 'loan' ? 'Kiralık Listesi' : 'Transfer Listesi'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-continue" onClick={submit}>
            {changing ? 'Kaydet' : 'Listeye Koy'} <span className="btn-continue-arrow">›</span>
          </button>
        </>
      }
    >
      <p>
        <strong>{name}</strong> {kind === 'loan' ? 'kiralık' : 'transfer'} listesine konacak. Transfer döneminde ilgilenen
        kulüplerden {kind === 'loan' ? 'kiralık ' : ''}teklifler gelir; Transfer Merkezi'nden yanıtlarsın. Piyasa değeri{' '}
        {formatMoney(marketValue(player, world.date))}.
      </p>
      {kind === 'transfer' && player.listing?.kind !== 'transfer' && (
        <p className="muted">Satılık olduğunu öğrenen oyuncunun morali düşer.</p>
      )}
      {!window.open && <p className="muted">Transfer dönemi kapalı: teklifler dönem açılınca gelmeye başlar.</p>}
      <div className="dialog-gap" />
      <label className="field check-field">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        <span>Bedeli kulüp değerlendirsin (önerilen: {formatMoney(suggested)})</span>
      </label>
      {!auto && <MoneyInput label={kind === 'loan' ? 'İstediğin kiralık bedeli' : 'İstediğin bonservis'} value={price} onChange={setPrice} />}
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}
