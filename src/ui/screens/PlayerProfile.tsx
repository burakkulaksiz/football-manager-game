import {
  ageOn,
  GOALKEEPING_ATTRS,
  marketValue,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  POSITIONS,
  primaryPosition,
  TECHNICAL_ATTRS,
  type AttributeKey,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import {
  attrClass,
  ATTRIBUTE_LABELS,
  familiarityLabel,
  FOOT_LABELS,
  formatDateShort,
  formatMoney,
  moraleLabel,
  nationName,
  POSITION_NAMES,
} from '../labels';
import { PositionBoxes } from './SquadScreen';

function AttributeColumn({ title, keys, values }: {
  title: string;
  keys: readonly AttributeKey[];
  values: Record<AttributeKey, number>;
}) {
  return (
    <div className="attr-column">
      <div className="attr-column-title">{title}</div>
      <table className="attr-table">
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td>{ATTRIBUTE_LABELS[k]}</td>
              <td className={attrClass(values[k])}>{values[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlayerProfile() {
  const world = useWorld();
  const playerId = useGameStore((s) => s.selectedPlayerId);
  const goBack = useGameStore((s) => s.goBack);
  const player = playerId !== null ? world.players[playerId] : undefined;

  if (!player) {
    return <p>Oyuncu bulunamadı.</p>;
  }

  const club = world.clubs.find((c) => c.id === player.clubId);
  const isGK = primaryPosition(player) === 'GK';
  const knownPositions = POSITIONS.filter((p) => player.positions[p] !== undefined).sort(
    (a, b) => (player.positions[b] ?? 0) - (player.positions[a] ?? 0),
  );

  const info: [string, string][] = [
    ['Yaş', `${ageOn(player.birthDate, world.date)} (${formatDateShort(player.birthDate)})`],
    ['Uyruk', nationName(player.nationality)],
    ['Kulüp', club?.name ?? 'Serbest'],
    ['Ayak', FOOT_LABELS[player.foot]],
    ['Piyasa Değeri', formatMoney(marketValue(player, world.date))],
    ['Maaş', `${formatMoney(player.contract.wage)} / yıl`],
    ['Sözleşme Bitişi', formatDateShort(player.contract.expires)],
    ['Kondisyon', `%${player.condition}`],
    ['Moral', moraleLabel(player.morale)],
    ['Durum', player.injury ? `Sakat: ${player.injury.name} (${player.injury.daysOut} gün)` : 'Sağlıklı'],
    ['Form', player.form.length > 0 ? player.form.join(' ') : '—'],
  ];

  return (
    <div className="profile">
      <div className="button-row">
        <button className="btn" onClick={goBack}>
          ◀ Geri
        </button>
      </div>

      <section className="panel">
        <h2 className="panel-title">
          {player.squadNumber}. {player.firstName} {player.lastName}
          <span className="title-extra"> — {POSITION_NAMES[primaryPosition(player)]}</span>
        </h2>
        <div className="panel-body profile-top">
          <table className="info-table">
            <tbody>
              {info.map(([label, value]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="profile-positions">
            <div className="attr-column-title">Mevkiler</div>
            <PositionBoxes player={player} />
            <table className="info-table">
              <tbody>
                {knownPositions.map((p) => (
                  <tr key={p}>
                    <th>{POSITION_NAMES[p]}</th>
                    <td>{familiarityLabel(player.positions[p] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Özellikler</h2>
        <div className="panel-body attr-grid">
          {isGK ? (
            <AttributeColumn title="Kalecilik" keys={GOALKEEPING_ATTRS} values={player.attributes} />
          ) : (
            <AttributeColumn title="Teknik" keys={TECHNICAL_ATTRS} values={player.attributes} />
          )}
          <AttributeColumn title="Zihinsel" keys={MENTAL_ATTRS} values={player.attributes} />
          <AttributeColumn title="Fiziksel" keys={PHYSICAL_ATTRS} values={player.attributes} />
        </div>
      </section>
    </div>
  );
}
