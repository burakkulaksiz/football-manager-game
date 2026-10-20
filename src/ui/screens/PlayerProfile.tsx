import { useState, type ReactNode } from 'react';
import {
  ageOn,
  askingPrice,
  canSendToAcademy,
  getClub,
  growthRate,
  isActive,
  offerBlocker,
  type Player,
  YELLOW_LIMIT,
  GOALKEEPING_ATTRS,
  marketValue,
  playerSeasonStats,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  POSITIONS,
  primaryPosition,
  promoteToFirstTeam,
  sendToAcademy,
  TECHNICAL_ATTRS,
  toggleWatch,
  type AttributeKey,
  type Attributes,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { GrowthChart } from '../components/GrowthChart';
import { Shirt } from '../components/Shirt';
import { Stars } from '../components/Stars';
import { ContractDialog, OfferDialog } from '../components/TransferDialogs';
import {
  attrClass,
  ATTRIBUTE_LABELS,
  familiarityLabel,
  FOOT_LABELS,
  formatDateShort,
  formatMoney,
  GROWTH_LABELS,
  moraleLabel,
  nationName,
  abilityStars,
  POSITION_NAMES,
  potentialStarsFor,
  ratingClass,
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
  const [dialog, setDialog] = useState<'transfer' | 'loan' | 'contract' | null>(null);
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
        {dialog === 'contract' && <ContractDialog player={player} onClose={() => setDialog(null)} />}
      </section>
    );
  }

  if (!player.clubId) {
    return (
      <section className="panel action-panel">
        <div className="panel-body action-bar">
          <span className="muted">Serbest oyuncu — bonservis ödemeden, yalnızca sözleşmeyle imzalayabilirsin.</span>
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
          Kulübün beklentisi (tahmini): <strong className="value">{formatMoney(askingPrice(world, player))}</strong>
          {activeOffers.some((o) => o.buyerId === world.playerClubId) && ' · açık teklifin var'}
        </span>
        {watchButton}
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

function AttributeColumn({ title, keys, values }: {
  title: string;
  keys: readonly AttributeKey[];
  values: Attributes;
}) {
  return (
    <div className="profile-col">
      <div className="sub-head">{title}</div>
      {keys.map((k) => (
        <div key={k} className="kv">
          <span className="kv-label">{ATTRIBUTE_LABELS[k]}</span>
          <span className={attrClass(values[k])}>{values[k]}</span>
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
  const stats = playerSeasonStats(world.season.fixtures, player.id);
  const own = player.clubId === world.playerClubId;
  const growth = GROWTH_LABELS[growthRate(player)];
  const dash = (n: number) => (stats.apps === 0 ? '—' : n);

  return (
    <div className="screen">
      <TransferActions player={player} />
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
            <AttributeColumn title="Kalecilik" keys={GOALKEEPING_ATTRS} values={player.attributes} />
          ) : (
            <AttributeColumn title="Teknik" keys={TECHNICAL_ATTRS} values={player.attributes} />
          )}
          <AttributeColumn title="Zihinsel" keys={MENTAL_ATTRS} values={player.attributes} />
          <div className="profile-col">
            <AttributeColumn title="Fiziksel" keys={PHYSICAL_ATTRS} values={player.attributes} />
            <div className="sub-head sub-head-gap">Diğer</div>
            <Row label="Kondisyon">%{player.condition}</Row>
            <Row label="Form">{player.form.length > 0 ? player.form.join(' ') : '—'}</Row>
            <Row label="Moral">{moraleLabel(player.morale)}</Row>
            <Row label="Gelişim"><span className={trendSymbol(player.trend).className}>{trendSymbol(player.trend).text}</span></Row>
            <div className="sub-head sub-head-gap">Antrenör Raporu</div>
            <Row label="Yetenek"><Stars value={abilityStars(player.currentAbility)} /></Row>
            {own ? (
              <Row label="Potansiyel"><Stars value={potentialStarsFor(player, true)} /></Row>
            ) : (
              <Row label="Potansiyel (tahmin)"><Stars value={potentialStarsFor(player, false)} title="Gözlem tahmini" /></Row>
            )}
          </div>
        </div>
      </section>

      {player.growth && player.growth.ca.length >= 2 && (
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

        <section className="panel">
          <h2 className="panel-title">İstatistikler</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th className="num">Maç</th>
                <th className="num">Gol</th>
                <th className="num">Asist</th>
                <th className="num">MA</th>
                <th className="num">Sarı</th>
                <th className="num">Kırmızı</th>
                <th className="num">Ort. Puan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="strong">Süper Lig</td>
                <td className="num">
                  {stats.apps === 0 ? '—' : `${stats.starts}${stats.apps > stats.starts ? ` (${stats.apps - stats.starts})` : ''}`}
                </td>
                <td className="num">{dash(stats.goals)}</td>
                <td className="num">{dash(stats.assists)}</td>
                <td className="num">{dash(stats.manOfTheMatch)}</td>
                <td className="num">{dash(stats.yellow)}</td>
                <td className="num">{dash(stats.red)}</td>
                <td className="num">
                  {stats.avgRating === null ? '—' : (
                    <span className={ratingClass(stats.avgRating)}>{stats.avgRating.toFixed(2)}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="panel-note">Maç: ilk 11 (oyuna sonradan girdiği) · MA: maçın adamı</div>
        </section>
      </div>
    </div>
  );
}
