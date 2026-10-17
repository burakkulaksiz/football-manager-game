import { useMemo, useState } from 'react';
import {
  acceptCounter,
  ageOn,
  ALL_ATTRS,
  askingPrice,
  formatDateTR,
  getClub,
  isActive,
  marketValue,
  naturalPositions,
  POSITIONS,
  respondToIncoming,
  transferWindow,
  withdrawOffer,
  type AttributeKey,
  type Player,
  type Position,
  type TransferOffer,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { ContractDialog, CounterDialog } from '../components/TransferDialogs';
import {
  ATTRIBUTE_LABELS,
  formatDateShort,
  formatMoney,
  NEWS_CATEGORY_LABELS,
  OFFER_STATUS_LABELS,
  POSITION_LABELS,
  POSITION_NAMES,
  positionGroup,
} from '../labels';

type Tab = 'search' | 'offers' | 'news';

/** Kulüp filtresinde serbest oyuncuları seçen değer. */
const FREE_AGENTS = '__free';

/** Kullanıcının harekete geçmesi gereken teklif sayısı (menü rozeti için). */
export function actionableOffers(offers: readonly TransferOffer[], userId: string): number {
  return offers.filter(
    (o) =>
      (o.sellerId === userId && o.status === 'pending') ||
      (o.buyerId === userId && (o.status === 'countered' || o.status === 'accepted')),
  ).length;
}

function WindowBanner() {
  const world = useWorld();
  const w = transferWindow(world.date);
  const budget = world.finances[world.playerClubId]!.transferBudget;
  return (
    <div className={`window-banner${w.open ? ' open' : ''}`}>
      <span>
        {w.open
          ? `${w.name} transfer dönemi açık — ${formatDateTR(w.closes!)} tarihine kadar`
          : `Transfer dönemi kapalı — bir sonraki dönem ${formatDateTR(w.nextOpens!)}`}
      </span>
      <span>Transfer bütçesi: <strong>{formatMoney(budget)}</strong></span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Oyuncu arama                                                         */
/* ------------------------------------------------------------------ */

const VALUE_LIMITS = [0, 500_000, 1_000_000, 3_000_000, 5_000_000, 10_000_000, 20_000_000];

function PositionChips({ player }: { player: Player }) {
  return (
    <span className="pos-boxes">
      {naturalPositions(player).map((p) => (
        <span key={p} className={`pos-box pos-${positionGroup(p)}`}>{POSITION_LABELS[p]}</span>
      ))}
    </span>
  );
}

function SearchTab() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const [position, setPosition] = useState<Position | ''>('');
  const [minAge, setMinAge] = useState(16);
  const [maxAge, setMaxAge] = useState(40);
  const [maxValue, setMaxValue] = useState(0);
  const [attr, setAttr] = useState<AttributeKey | ''>('');
  const [attrMin, setAttrMin] = useState(12);
  const [clubId, setClubId] = useState('');
  const [affordable, setAffordable] = useState(false);
  const budget = world.finances[world.playerClubId]!.transferBudget;

  const results = useMemo(() => {
    const rows = Object.values(world.players)
      .filter((p) => p.clubId !== world.playerClubId)
      .filter((p) => !position || (p.positions[position] ?? 0) >= 13)
      .filter((p) => {
        const age = ageOn(p.birthDate, world.date);
        return age >= minAge && age <= maxAge;
      })
      // '__free' = serbest oyuncular
      .filter((p) => !clubId || (clubId === FREE_AGENTS ? p.clubId === null : p.clubId === clubId))
      .filter((p) => !attr || p.attributes[attr] >= attrMin)
      .map((p) => ({ p, value: marketValue(p, world.date), asking: p.clubId ? askingPrice(world, p) : 0 }))
      .filter((r) => !maxValue || r.value <= maxValue)
      .filter((r) => !affordable || r.asking <= budget)
      .sort((a, b) => b.value - a.value);
    return rows;
  }, [world, position, minAge, maxAge, maxValue, attr, attrMin, clubId, affordable, budget]);

  return (
    <>
      <div className="filters">
        <label>
          <span>Mevki</span>
          <select value={position} onChange={(e) => setPosition(e.target.value as Position | '')}>
            <option value="">Tümü</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_NAMES[p]}</option>)}
          </select>
        </label>
        <label>
          <span>Yaş</span>
          <span className="range">
            <input type="number" min={16} max={40} value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} />
            –
            <input type="number" min={16} max={40} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} />
          </span>
        </label>
        <label>
          <span>En fazla değer</span>
          <select value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))}>
            {VALUE_LIMITS.map((v) => <option key={v} value={v}>{v === 0 ? 'Sınırsız' : formatMoney(v)}</option>)}
          </select>
        </label>
        <label>
          <span>Özellik</span>
          <span className="range">
            <select value={attr} onChange={(e) => setAttr(e.target.value as AttributeKey | '')}>
              <option value="">—</option>
              {ALL_ATTRS.map((a) => <option key={a} value={a}>{ATTRIBUTE_LABELS[a]}</option>)}
            </select>
            ≥
            <input type="number" min={1} max={20} value={attrMin} disabled={!attr} onChange={(e) => setAttrMin(Number(e.target.value))} />
          </span>
        </label>
        <label>
          <span>Kulüp</span>
          <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">Tümü</option>
            <option value={FREE_AGENTS}>Serbest oyuncular</option>
            {world.clubs.filter((c) => c.id !== world.playerClubId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={affordable} onChange={(e) => setAffordable(e.target.checked)} />
          <span>Sadece bütçeme uygun</span>
        </label>
      </div>
      <div className="panel-note">{results.length} oyuncu bulundu{results.length > 150 ? ' (ilk 150 gösteriliyor)' : ''}. Satıra tıklayınca profil açılır; teklifi profilden yaparsın.</div>
      <table className="data-table clickable">
        <thead>
          <tr>
            <th>İsim</th>
            <th>Kulüp</th>
            <th>Mevki</th>
            <th className="num">Yaş</th>
            <th className="num">Değer</th>
            <th className="num">Beklenti</th>
            <th className="num">Maaş</th>
            <th>Sözleşme</th>
          </tr>
        </thead>
        <tbody>
          {results.slice(0, 150).map(({ p, value, asking }) => {
            const club = p.clubId ? getClub(world, p.clubId) : null;
            return (
              <tr key={p.id} onClick={() => openPlayer(p.id)}>
                <td className="strong">
                  {p.firstName} {p.lastName}
                  {p.loan && <span className="tag">Kiralık</span>}
                </td>
                <td>{club ? <span className="club-cell"><ClubBadge club={club} size={16} /> {club.name}</span> : <span className="tag tag-free">Serbest</span>}</td>
                <td><PositionChips player={p} /></td>
                <td className="num">{ageOn(p.birthDate, world.date)}</td>
                <td className="num value">{formatMoney(value)}</td>
                <td className={`num${asking > budget ? ' muted' : ''}`}>{p.clubId ? formatMoney(asking) : 'Bonservissiz'}</td>
                <td className="num">{formatMoney(p.contract.wage)}</td>
                <td>{formatDateShort(p.contract.expires)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Teklifler                                                            */
/* ------------------------------------------------------------------ */

function StatusBadge({ offer }: { offer: TransferOffer }) {
  return <span className={`status-badge status-${offer.status}`}>{OFFER_STATUS_LABELS[offer.status]}</span>;
}

function OffersTab() {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const showNotice = useGameStore((s) => s.showNotice);
  const [contractFor, setContractFor] = useState<TransferOffer | null>(null);
  const [counterFor, setCounterFor] = useState<TransferOffer | null>(null);
  const userId = world.playerClubId;

  // Açık olanlar önce, sonra en yeniler
  const sorted = (list: TransferOffer[]) =>
    [...list].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.id - a.id).slice(0, 30);
  const outgoing = sorted(world.offers.filter((o) => o.buyerId === userId));
  const incoming = sorted(world.offers.filter((o) => o.sellerId === userId));

  const playerCell = (o: TransferOffer) => {
    const p = world.players[o.playerId]!;
    return <td className="strong link" onClick={() => openPlayer(p.id)}>{p.firstName} {p.lastName}</td>;
  };

  const run = (fn: () => string | null) => {
    const err = fn();
    if (err) showNotice(err, 'error');
  };

  return (
    <>
      <div className="sub-head">Yaptığın Teklifler</div>
      {outgoing.length === 0 ? (
        <div className="panel-body muted">Henüz teklif yapmadın. Oyuncu profilinden teklif yapabilirsin.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Oyuncu</th><th>Kulüp</th><th>Tür</th><th className="num">Teklif</th><th>Durum</th><th>Not</th><th></th></tr>
          </thead>
          <tbody>
            {outgoing.map((o) => (
              <tr key={o.id}>
                {playerCell(o)}
                <td>{getClub(world, o.sellerId).name}</td>
                <td>{o.kind === 'loan' ? 'Kiralık' : 'Bonservis'}</td>
                <td className="num value">{formatMoney(o.fee)}</td>
                <td><StatusBadge offer={o} /></td>
                <td className="note-cell">{o.note}</td>
                <td className="actions">
                  {o.status === 'countered' && (
                    <button className="btn btn-small" onClick={() => run(() => worldAction((w) => acceptCounter(w, o.id)))}>
                      Kabul ({formatMoney(o.counterFee ?? 0)})
                    </button>
                  )}
                  {o.status === 'accepted' && o.kind === 'transfer' && (
                    <button className="btn btn-small btn-go" onClick={() => setContractFor(o)}>Sözleşme Görüş</button>
                  )}
                  {isActive(o) && (
                    <button className="btn btn-small" onClick={() => worldAction((w) => withdrawOffer(w, o.id))}>Geri Çek</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="sub-head sub-head-gap">Gelen Teklifler</div>
      {incoming.length === 0 ? (
        <div className="panel-body muted">Oyuncuların için henüz teklif gelmedi.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Oyuncu</th><th>Alıcı</th><th className="num">Teklif</th><th className="num">Değeri</th><th>Durum</th><th>Not</th><th></th></tr>
          </thead>
          <tbody>
            {incoming.map((o) => {
              const p = world.players[o.playerId]!;
              return (
                <tr key={o.id}>
                  {playerCell(o)}
                  <td>{getClub(world, o.buyerId).name}</td>
                  <td className="num value">{formatMoney(o.counterFee ?? o.fee)}</td>
                  <td className="num">{formatMoney(marketValue(p, world.date))}</td>
                  <td><StatusBadge offer={o} /></td>
                  <td className="note-cell">{o.note}</td>
                  <td className="actions">
                    {o.status === 'pending' && (
                      <>
                        <button className="btn btn-small btn-go" onClick={() => run(() => worldAction((w) => respondToIncoming(w, o.id, 'accept')))}>Kabul</button>
                        <button className="btn btn-small" onClick={() => setCounterFor(o)}>Karşı Teklif</button>
                        <button className="btn btn-small" onClick={() => run(() => worldAction((w) => respondToIncoming(w, o.id, 'reject')))}>Reddet</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {contractFor && (
        <ContractDialog player={world.players[contractFor.playerId]!} offer={contractFor} onClose={() => setContractFor(null)} />
      )}
      {counterFor && <CounterDialog offer={counterFor} onClose={() => setCounterFor(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Haberler                                                             */
/* ------------------------------------------------------------------ */

function NewsTab() {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const news = [...world.news].reverse().slice(0, 100);
  if (news.length === 0) return <div className="panel-body muted">Henüz haber yok.</div>;
  return (
    <div className="news-list">
      {news.map((n) => (
        <div key={n.id} className={`news-item${n.important ? ' important' : ''}`}>
          <div className="news-meta">
            <span className="tag">{NEWS_CATEGORY_LABELS[n.category]}</span>
            <span className="muted">{formatDateShort(n.date)}</span>
          </div>
          <div
            className={`news-title${n.playerId !== undefined ? ' link' : ''}`}
            onClick={() => n.playerId !== undefined && openPlayer(n.playerId)}
          >
            {n.title}
          </div>
          <div className="news-body">{n.body}</div>
        </div>
      ))}
    </div>
  );
}

export function TransferScreen() {
  const world = useWorld();
  const [tab, setTab] = useState<Tab>('search');
  const actionable = actionableOffers(world.offers, world.playerClubId);
  const active = world.offers.filter((o) => isActive(o) && (o.buyerId === world.playerClubId || o.sellerId === world.playerClubId)).length;

  return (
    <div className="screen">
      <WindowBanner />
      <section className="panel">
        <div className="panel-title panel-title-row">
          <span>Transfer Merkezi</span>
          <span className="tabs">
            <button className={`tab${tab === 'search' ? ' active' : ''}`} onClick={() => setTab('search')}>Oyuncu Ara</button>
            <button className={`tab${tab === 'offers' ? ' active' : ''}`} onClick={() => setTab('offers')}>
              Teklifler{active > 0 ? ` (${active})` : ''}{actionable > 0 && <i className="tab-dot" />}
            </button>
            <button className={`tab${tab === 'news' ? ' active' : ''}`} onClick={() => setTab('news')}>Haberler</button>
          </span>
        </div>
        {tab === 'search' && <SearchTab />}
        {tab === 'offers' && <OffersTab />}
        {tab === 'news' && <NewsTab />}
      </section>
    </div>
  );
}
