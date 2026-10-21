import { useState, type ReactNode } from 'react';
import {
  ageOn,
  askingPrice,
  canSendToAcademy,
  listingPrice,
  loanFeeAsk,
  unlistPlayer,
  getClub,
  growthRate,
  isActive,
  offerBlocker,
  type Player,
  YELLOW_LIMIT,
  GOALKEEPING_ATTRS,
  marketValue,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  POSITIONS,
  primaryPosition,
  promoteToFirstTeam,
  sendToAcademy,
  TECHNICAL_ATTRS,
  toggleWatch,
  type AttributeKey,
  CLUB_SCAN_KNOWLEDGE,
  FULL_KNOWLEDGE,
  knowledgeOf,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { CareerPanel, MovesPanel } from '../components/CareerPanel';
import { GrowthChart } from '../components/GrowthChart';
import { Shirt } from '../components/Shirt';
import { TalkPanel } from '../components/TalkPanel';
import { AbilityStars, AttrValue, KnowledgeBar, PotentialStars, ScoutButton, VerdictTag } from '../components/ScoutViews';
import { Stars } from '../components/Stars';
import { ContractDialog, ListDialog, OfferDialog } from '../components/TransferDialogs';
import {
  ATTRIBUTE_LABELS,
  familiarityLabel,
  FOOT_LABELS,
  formatDateShort,
  formatMoney,
  GROWTH_LABELS,
  LISTING_LABELS,
  moraleLabel,
  nationName,
  abilityStars,
  POSITION_NAMES,
  trendSymbol,
} from '../labels';
import { PositionBoxes } from './SquadScreen';

function conditionLabel(condition: number): string {
  if (condition >= 95) return 'Maça hazır';
  if (condition >= 85) return 'İyi';
  if (condition >= 70) return 'Yorgun';
  return 'Çok yorgun';
}

/** Etiket solda, değer sağda (FM'deki satırlar gibi). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{children}</span>
    </div>
  );
}

/** Profilin üstündeki transfer / sözleşme işlemleri. */
function TransferActions({ player }: { player: Player }) {
  const world = useWorld();
  const setScreen = useGameStore((s) => s.setScreen);
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const watched = world.youthWatch.includes(player.id);
  const watchButton = (
    <button className="btn btn-small" onClick={() => worldAction((w) => toggleWatch(w, player.id))}>
      {watched ? '★ Takipte' : '☆ Takip et'}
    </button>
  );
  const moveSquad = () => {
    if (player.academy) {
      worldAction((w) => promoteToFirstTeam(w, w.players[player.id]!));
      showNotice(`${player.firstName} ${player.lastName} A takıma alındı.`);
    } else {
      worldAction((w) => sendToAcademy(w, w.players[player.id]!));
      showNotice(`${player.firstName} ${player.lastName} U19'a gönderildi.`);
    }
  };
  const [dialog, setDialog] = useState<'transfer' | 'loan' | 'contract' | 'list-transfer' | 'list-loan' | null>(null);
  const own = player.clubId === world.playerClubId;
  const activeOffers = world.offers.filter((o) => o.playerId === player.id && isActive(o));

  if (own) {
    return (
      <section className="panel action-panel">
        <div className="panel-body action-bar">
          <span className="muted">
            {player.academy
              ? `U19 oyuncusu · yıllık ${formatMoney(player.contract.wage)} (altyapı sözleşmesi her yaz kendiliğinden uzar)`
              : player.loan
                ? `${getClub(world, player.loan.fromClubId).name} kulübünden kiralık · dönüş ${formatDateShort(player.loan.until)}`
                : `Sözleşme bitişi ${formatDateShort(player.contract.expires)} · yıllık ${formatMoney(player.contract.wage)}`}
            {activeOffers.length > 0 && ` · ${activeOffers.length} açık teklif`}
          </span>
          {activeOffers.length > 0 && <button className="btn btn-small" onClick={() => setScreen('transfers')}>Teklifleri Gör</button>}
          {player.academy && <button className="btn btn-go" onClick={moveSquad}>A takıma al</button>}
          {canSendToAcademy(world, player) && <button className="btn" onClick={moveSquad}>U19&apos;a gönder</button>}
          {!player.loan && !player.academy && <button className="btn" onClick={() => setDialog('contract')}>Sözleşme Yenile</button>}
        </div>
        {!player.loan && (
          <div className="panel-body action-bar listing-bar">
            {player.listing ? (
              <>
                <span>
                  <span className={`tag tag-list-${player.listing.kind}`}>{LISTING_LABELS[player.listing.kind]}</span>{' '}
                  İstenen: <strong className="value">{player.listing.price === null ? `kulüp değerlendirsin (≈ ${formatMoney(listingPrice(world, player))})` : formatMoney(player.listing.price)}</strong>
                  <span className="muted"> · {formatDateShort(player.listing.since)} tarihinden beri</span>
                </span>
                <button className="btn btn-small" onClick={() => setDialog(player.listing!.kind === 'loan' ? 'list-loan' : 'list-transfer')}>Bedeli değiştir</button>
                <button className="btn btn-small" onClick={() => worldAction((w) => unlistPlayer(w.players[player.id]!))}>Listeden çıkar</button>
              </>
            ) : (
              <>
                <span className="muted">Satmak ya da kiraya vermek istersen listeye koy; teklifler transfer döneminde gelir.</span>
                <button className="btn btn-small" onClick={() => setDialog('list-transfer')}>Transfer listesine koy</button>
                <button className="btn btn-small" onClick={() => setDialog('list-loan')}>Kiralık listesine koy</button>
              </>
            )}
          </div>
        )}
        {dialog === 'contract' && <ContractDialog player={player} onClose={() => setDialog(null)} />}
        {dialog === 'list-transfer' && <ListDialog player={player} kind="transfer" onClose={() => setDialog(null)} />}
        {dialog === 'list-loan' && <ListDialog player={player} kind="loan" onClose={() => setDialog(null)} />}
      </section>
    );
  }

  if (!player.clubId) {
    return (
      <section className="panel action-panel">
        <div className="panel-body action-bar">
          <span className="muted">Serbest oyuncu — bonservis ödemeden, yalnızca sözleşmeyle imzalayabilirsin.</span>
          <ScoutButton player={player} />
          <button className="btn btn-go" onClick={() => setDialog('contract')}>Sözleşme Teklif Et</button>
        </div>
        {dialog === 'contract' && <ContractDialog player={player} onClose={() => setDialog(null)} />}
      </section>
    );
  }

  const transferBlock = offerBlocker(world, player, 'transfer');
  const loanBlock = offerBlocker(world, player, 'loan');
  return (
    <section className="panel action-panel">
      <div className="panel-body action-bar">
        <span className="muted">
          {player.listing && <><span className={`tag tag-list-${player.listing.kind}`}>{LISTING_LABELS[player.listing.kind]}</span>{' '}</>}
          {player.listing?.kind === 'loan'
            ? <>Kiralık bedeli beklentisi: <strong className="value">{formatMoney(loanFeeAsk(world, player))}</strong> · bonservis: {formatMoney(askingPrice(world, player))}</>
            : <>Kulübün beklentisi (tahmini): <strong className="value">{formatMoney(askingPrice(world, player))}</strong></>}
          {activeOffers.some((o) => o.buyerId === world.playerClubId) && ' · açık teklifin var'}
        </span>
        {watchButton}
        <ScoutButton player={player} />
        <button className="btn" disabled={transferBlock !== null} title={transferBlock ?? ''} onClick={() => setDialog('transfer')}>
          Transfer Teklifi
        </button>
        <button className="btn" disabled={loanBlock !== null} title={loanBlock ?? ''} onClick={() => setDialog('loan')}>
          Kiralık Teklifi
        </button>
      </div>
      {(transferBlock ?? loanBlock) && <div className="panel-note">{transferBlock ?? loanBlock}</div>}
      {(dialog === 'transfer' || dialog === 'loan') && <OfferDialog player={player} kind={dialog} onClose={() => setDialog(null)} />}
    </section>
  );
}

/** Özellik sütunu; tanımadığımız oyuncuda değerler aralık olarak (gözlemci sistemi). */
function AttributeColumn({ title, keys, player, knowledge }: {
  title: string;
  keys: readonly AttributeKey[];
  player: Player;
  knowledge: number;
}) {
  return (
    <div className="profile-col">
      <div className="sub-head">{title}</div>
      {keys.map((k) => (
        <div key={k} className="kv">
          <span className="kv-label">{ATTRIBUTE_LABELS[k]}</span>
          <AttrValue player={player} attr={k} knowledge={knowledge} />
        </div>
      ))}
    </div>
  );
}

export function PlayerProfile() {
  const world = useWorld();
  const playerId = useGameStore((s) => s.selectedPlayerId);
  const player = playerId !== null ? world.players[playerId] : undefined;

  if (!player) {
    return <section className="panel"><div className="panel-body">Oyuncu bulunamadı.</div></section>;
  }

  const club = player.clubId ? getClub(world, player.clubId) : null;
  const isGK = primaryPosition(player) === 'GK';
  const knownPositions = POSITIONS.filter((p) => player.positions[p] !== undefined).sort(
    (a, b) => (player.positions[b] ?? 0) - (player.positions[a] ?? 0),
  );
  const own = player.clubId === world.playerClubId;
  const growth = GROWTH_LABELS[growthRate(player)];
  const knowledge = knowledgeOf(world, player);
  const known = knowledge >= FULL_KNOWLEDGE;

  return (
    <div className="screen">
      <TransferActions player={player} />
      {own && <TalkPanel player={player} />}
      <section className="panel">
        <h2 className="panel-title">Oyuncu Profili</h2>
        <div className="profile-grid">
          <div className="profile-col">
            <div className="sub-head">Kişisel Bilgiler</div>
            <div className="profile-identity">
              <Shirt
                primary={club?.colors.primary ?? '#666'}
                secondary={club?.colors.secondary ?? '#fff'}
                number={player.squadNumber}
                size={84}
              />
              <div className="profile-identity-info">
                <div className="profile-nation">{nationName(player.nationality)}</div>
                <div>{ageOn(player.birthDate, world.date)} yaşında</div>
                <div className="muted">{formatDateShort(player.birthDate)}</div>
                <PositionBoxes player={player} />
              </div>
            </div>
            <Row label="Kulüp">{club ? `${club.name}${player.academy ? ' · U19' : ''}` : 'Serbest'}</Row>
            <Row label="Tercih Ettiği Ayak">{FOOT_LABELS[player.foot]}</Row>
            <Row label="Piyasa Değeri">{formatMoney(marketValue(player, world.date))}</Row>
            <Row label="Maaş">{formatMoney(player.contract.wage)} / yıl</Row>
            <Row label="Sözleşme Bitişi">{formatDateShort(player.contract.expires)}</Row>
          </div>

          {isGK ? (
            <AttributeColumn title="Kalecilik" keys={GOALKEEPING_ATTRS} player={player} knowledge={knowledge} />
          ) : (
            <AttributeColumn title="Teknik" keys={TECHNICAL_ATTRS} player={player} knowledge={knowledge} />
          )}
          <AttributeColumn title="Zihinsel" keys={MENTAL_ATTRS} player={player} knowledge={knowledge} />
          <div className="profile-col">
            <AttributeColumn title="Fiziksel" keys={PHYSICAL_ATTRS} player={player} knowledge={knowledge} />
            <div className="sub-head sub-head-gap">Diğer</div>
            <Row label="Kondisyon">%{player.condition}</Row>
            <Row label="Form">{player.form.length > 0 ? player.form.join(' ') : '—'}</Row>
            <Row label="Moral">{moraleLabel(player.morale)}</Row>
            <Row label="Gelişim"><span className={trendSymbol(player.trend).className}>{trendSymbol(player.trend).text}</span></Row>
            {own ? (
              <>
                <div className="sub-head sub-head-gap">Antrenör Raporu</div>
                <Row label="Yetenek"><Stars value={abilityStars(player.currentAbility)} /></Row>
                <Row label="Potansiyel"><PotentialStars player={player} /></Row>
              </>
            ) : (
              <>
                <div className="sub-head sub-head-gap">Gözlemci Raporu</div>
                <Row label="Bilgi"><KnowledgeBar knowledge={knowledge} /></Row>
                <Row label="Yetenek"><AbilityStars player={player} /></Row>
                <Row label="Potansiyel (tahmin)"><PotentialStars player={player} /></Row>
                <Row label="Görüş">{knowledge >= CLUB_SCAN_KNOWLEDGE ? <VerdictTag player={player} /> : <span className="muted">Rapor yok</span>}</Row>
              </>
            )}
          </div>
        </div>
      </section>

      {player.growth && player.growth.ca.length >= 2 && known && (
        <section className="panel">
          <h2 className="panel-title panel-title-row">
            <span>Gelişim</span>
            <span className={`title-extra ${growth.className}`}>Son 6 ay: {growth.text}</span>
          </h2>
          <div className="panel-body growth-panel">
            <GrowthChart player={player} large />
          </div>
        </section>
      )}

      <div className="two-columns">
        <section className="panel">
          <h2 className="panel-title">Seçim Detayları</h2>
          <div className="panel-body">
            <Row label="Sakatlık">
              {player.injury ? `${player.injury.name} (${player.injury.daysOut} gün)` : 'Yok'}
            </Row>
            <Row label="Ceza">{player.suspension > 0 ? player.suspension + ' maç' : 'Yok'}</Row>
            <Row label="Sarı kart birikimi">{player.yellowCards} / {YELLOW_LIMIT}</Row>
            <Row label="Kondisyon">{conditionLabel(player.condition)}</Row>
            <div className="sub-head sub-head-gap">Mevkiler</div>
            {knownPositions.map((p) => (
              <Row key={p} label={POSITION_NAMES[p]}>{familiarityLabel(player.positions[p] ?? 0)}</Row>
            ))}
          </div>
        </section>

        <MovesPanel player={player} />
      </div>

      <CareerPanel player={player} />
    </div>
  );
}
