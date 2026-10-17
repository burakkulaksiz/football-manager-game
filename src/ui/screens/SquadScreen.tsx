import { useState } from 'react';
import {
  ageOn,
  clubPlayers,
  marketValue,
  naturalPositions,
  POSITIONS,
  primaryPosition,
  type Player,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDateShort, formatMoney, moraleLabel, nationName, POSITION_LABELS, positionGroup } from '../labels';

type SortKey = 'number' | 'name' | 'position' | 'age' | 'nation' | 'condition' | 'morale' | 'value' | 'wage' | 'contract';

interface Column {
  key: SortKey;
  label: string;
  numeric?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'number', label: 'No', numeric: true },
  { key: 'name', label: 'İsim' },
  { key: 'position', label: 'Mevki' },
  { key: 'age', label: 'Yaş', numeric: true },
  { key: 'nation', label: 'Uyruk' },
  { key: 'condition', label: 'Kond.', numeric: true },
  { key: 'morale', label: 'Moral' },
  { key: 'value', label: 'Değer', numeric: true },
  { key: 'wage', label: 'Maaş (yıllık)', numeric: true },
  { key: 'contract', label: 'Sözleşme' },
];

export function PositionBoxes({ player }: { player: Player }) {
  return (
    <span className="pos-boxes">
      {naturalPositions(player).map((p) => (
        <span key={p} className={`pos-box pos-${positionGroup(p)}`}>
          {POSITION_LABELS[p]}
        </span>
      ))}
    </span>
  );
}

export function SquadScreen() {
  const world = useWorld();
  const viewedClubId = useGameStore((s) => s.viewedClubId) ?? world.playerClubId;
  const setViewedClub = useGameStore((s) => s.setViewedClub);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'position', asc: true });

  const date = world.date;
  const sortValue = (p: Player): number | string => {
    switch (sort.key) {
      case 'number': return p.squadNumber ?? 999;
      case 'name': return `${p.lastName} ${p.firstName}`;
      // Önce mevki, aynı mevkide forma numarası.
      case 'position': return POSITIONS.indexOf(primaryPosition(p)) * 1000 + (p.squadNumber ?? 999);
      case 'age': return ageOn(p.birthDate, date);
      case 'nation': return nationName(p.nationality);
      case 'condition': return p.condition;
      case 'morale': return p.morale;
      case 'value': return marketValue(p, date);
      case 'wage': return p.contract.wage;
      case 'contract': return p.contract.expires;
    }
  };

  const players = clubPlayers(world, viewedClubId).sort((a, b) => {
    const va = sortValue(a);
    const vb = sortValue(b);
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'tr') : va - (vb as number);
    return sort.asc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, asc: s.key === key ? !s.asc : key === 'name' || key === 'position' || key === 'number' }));

  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Oyuncular</span>
        <select value={viewedClubId} onChange={(e) => setViewedClub(e.target.value)}>
          {world.clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <table className="data-table clickable">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`sortable${c.numeric ? ' num' : ''}`}
                onClick={() => toggleSort(c.key)}
              >
                {c.label}
                {sort.key === c.key && (sort.asc ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} onClick={() => openPlayer(p.id)}>
              <td className="num">{p.squadNumber}</td>
              <td className="strong">
                {p.firstName} {p.lastName}
                {p.loan && <span className="tag" title={"Kiralık, dönüş " + formatDateShort(p.loan.until)}>Kiralık</span>}
              </td>
              <td><PositionBoxes player={p} /></td>
              <td className="num">{ageOn(p.birthDate, date)}</td>
              <td>{nationName(p.nationality)}</td>
              <td className="num">%{p.condition}</td>
              <td>{moraleLabel(p.morale)}</td>
              <td className="num value">{formatMoney(marketValue(p, date))}</td>
              <td className="num value">{formatMoney(p.contract.wage)}</td>
              <td>{formatDateShort(p.contract.expires)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
