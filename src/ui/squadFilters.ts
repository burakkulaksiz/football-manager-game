/** Kadro ekranı filtreleri (saf fonksiyonlar; test edilebilir). */
import { ageOn, makeDate, primaryPosition, seasonEndYear, type GameDate, type Player } from '../engine';
import { positionGroup, type PositionGroup } from './labels';

export type GroupFilter = 'all' | PositionGroup;
export type StatusFilter = 'all' | 'unavailable' | 'expiring' | 'loan' | 'listed' | 'young' | 'xi';
export type SquadView = 'general' | 'stats' | 'contract' | 'report';

export interface SquadFilters {
  group: GroupFilter;
  status: StatusFilter;
  search: string;
}

export const DEFAULT_SQUAD_FILTERS: SquadFilters = { group: 'all', status: 'all', search: '' };

export const GROUP_FILTERS: { id: GroupFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'gk', label: 'Kaleci' },
  { id: 'def', label: 'Defans' },
  { id: 'mid', label: 'Orta Saha' },
  { id: 'att', label: 'Hücum' },
];

export const STATUS_FILTERS: { id: StatusFilter; label: string; ownOnly?: boolean }[] = [
  { id: 'all', label: 'Hepsi' },
  { id: 'unavailable', label: 'Sakat / Cezalı' },
  { id: 'expiring', label: 'Sözleşmesi Bitiyor' },
  { id: 'loan', label: 'Kiralık' },
  { id: 'listed', label: 'Listede' },
  { id: 'young', label: 'Gençler (≤21)' },
  { id: 'xi', label: 'İlk 11', ownOnly: true },
];

export const SQUAD_VIEWS: { id: SquadView; label: string }[] = [
  { id: 'general', label: 'Genel' },
  { id: 'stats', label: 'İstatistik' },
  { id: 'contract', label: 'Sözleşme' },
  { id: 'report', label: 'Antrenör Raporu' },
];

/** Sözleşmesi bu sezonun sonunda (30 Haziran) bitiyor mu? */
export function isExpiring(p: Player, date: GameDate): boolean {
  return p.contract.expires <= makeDate(seasonEndYear(date), 6, 30);
}

/** Türkçe büyük/küçük harf duyarsız arama için. */
function normalize(text: string): string {
  return text.toLocaleLowerCase('tr').trim();
}

export function filterSquad(
  players: readonly Player[],
  filters: SquadFilters,
  ctx: { date: GameDate; lineup: readonly (number | null)[] | null },
): Player[] {
  const query = normalize(filters.search);
  return players.filter((p) => {
    if (filters.group !== 'all' && positionGroup(primaryPosition(p)) !== filters.group) return false;
    if (query && !normalize(`${p.firstName} ${p.lastName}`).includes(query)) return false;
    switch (filters.status) {
      case 'unavailable': return p.injury !== null || p.suspension > 0;
      case 'expiring': return !p.loan && isExpiring(p, ctx.date);
      case 'loan': return p.loan !== null;
      case 'listed': return p.listing !== undefined;
      case 'young': return ageOn(p.birthDate, ctx.date) <= 21;
      case 'xi': return ctx.lineup?.includes(p.id) ?? false;
      default: return true;
    }
  });
}
