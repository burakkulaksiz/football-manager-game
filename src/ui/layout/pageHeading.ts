import { getClub, primaryPosition, seasonLabel, type GameWorld } from '../../engine';
import type { ScreenId } from '../../store/gameStore';
import { nationName, POSITION_NAMES } from '../labels';
import { screenInfo } from '../screens';

/** Lig ekranlarının başlık hapı rengi (Süper Lig kırmızısı). */
const LEAGUE_COLORS = { primary: '#B3122E', secondary: '#FFFFFF' };

export interface PageHeading {
  title: string;
  subtitle: string;
  colors: { primary: string; secondary: string };
  /** Alt çubuktaki konum yolu. */
  breadcrumb: string[];
}

/** Üst başlıktaki büyük hap (FM'deki gibi) ve alt çubuk için sayfa bilgisi. */
export function pageHeading(
  world: GameWorld,
  screen: ScreenId,
  selectedPlayerId: number | null,
  viewedClubId: string | null,
): PageHeading {
  const ownClub = getClub(world, world.playerClubId);

  if (screen === 'player' && selectedPlayerId !== null) {
    const player = world.players[selectedPlayerId];
    if (player) {
      const club = player.clubId ? getClub(world, player.clubId) : ownClub;
      return {
        title: `${player.firstName} ${player.lastName}`,
        subtitle: `${POSITION_NAMES[primaryPosition(player)]} · ${nationName(player.nationality)}`,
        colors: club.colors,
        breadcrumb: ['Süper Lig', club.name, 'Kadro', `${player.firstName} ${player.lastName}`],
      };
    }
  }

  if (screen === 'squad') {
    const club = getClub(world, viewedClubId ?? ownClub.id);
    return { title: club.name, subtitle: 'Kadro', colors: club.colors, breadcrumb: ['Süper Lig', club.name, 'Kadro'] };
  }

  const info = screen === 'player' ? { label: 'Oyuncu' } : screenInfo(screen);
  if (screen === 'fixtures' || screen === 'table' || screen === 'stats') {
    return {
      title: info.label,
      subtitle: `Süper Lig ${seasonLabel(world.season.year)}`,
      colors: LEAGUE_COLORS,
      breadcrumb: ['Süper Lig', info.label],
    };
  }
  return {
    title: info.label,
    subtitle: ownClub.name,
    colors: ownClub.colors,
    breadcrumb: ['Süper Lig', ownClub.name, info.label],
  };
}
