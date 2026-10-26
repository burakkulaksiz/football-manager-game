import { fixtureLabel, getClub, nextFixtureFor, primaryPosition, seasonLabel, tournamentTitle, type GameWorld } from '../../engine';
import type { ScreenId } from '../../store/gameStore';
import { nationName, POSITION_NAMES } from '../labels';
import { screenInfo, UNEMPLOYED_SCREENS } from '../screens';

/** Lig ekranlarının başlık hapı rengi (Süper Lig kırmızısı). */
const LEAGUE_COLORS = { primary: '#B3122E', secondary: '#FFFFFF' };
/** Milli takımlar ekranı: ay yıldız kırmızısı. */
const NATIONAL_COLORS = { primary: '#E30A17', secondary: '#FFFFFF' };
/** İşsiz menajer: kulüp rengi yok. */
const NEUTRAL_COLORS = { primary: '#3A4C6B', secondary: '#FFFFFF' };

export interface PageHeading {
  title: string;
  subtitle: string;
  colors: { primary: string; secondary: string };
}

/** Üst başlıktaki büyük hap (FM'deki gibi) için sayfa bilgisi. */
export function pageHeading(
  world: GameWorld,
  screen: ScreenId,
  selectedPlayerId: number | null,
  viewedClubId: string | null,
  selectedFixtureId: number | null = null,
): PageHeading {
  // İşsizken kulüp ekranları açılmaz (GameShell İş Merkezi'ni gösterir): başlık da ona göre
  if (world.unemployed && !UNEMPLOYED_SCREENS.has(screen)) screen = 'jobs';
  // İşsizken kulübü yok: nötr renk, alt başlık "İşsiz"
  const ownClub = world.unemployed
    ? { id: '', name: 'İşsiz', colors: NEUTRAL_COLORS }
    : getClub(world, world.playerClubId);

  if (screen === 'report') {
    const fixture = world.season.fixtures.find((f) => f.id === selectedFixtureId);
    const title = fixture?.result
      ? `${getClub(world, fixture.homeId).name} ${fixture.result.homeGoals}-${fixture.result.awayGoals} ${getClub(world, fixture.awayId).name}`
      : 'Maç Raporu';
    return {
      title,
      subtitle: fixture ? `Maç Raporu · ${fixtureLabel(fixture)}` : 'Maç Raporu',
      colors: LEAGUE_COLORS,
    };
  }

  if (screen === 'player' && selectedPlayerId !== null) {
    const player = world.players[selectedPlayerId];
    if (player) {
      const club = player.clubId ? getClub(world, player.clubId) : ownClub;
      return {
        title: `${player.firstName} ${player.lastName}`,
        subtitle: `${POSITION_NAMES[primaryPosition(player)]} · ${nationName(player.nationality)}`,
        colors: club.colors,
      };
    }
  }

  if (screen === 'squad') {
    const club = getClub(world, viewedClubId ?? ownClub.id);
    return { title: club.name, subtitle: 'Kadro', colors: club.colors };
  }

  if (screen === 'match') {
    // Canlı maç sırasında kendi maçımız henüz sonuçlanmamış sıradaki maçtır.
    const fixture = nextFixtureFor(world, ownClub.id);
    const title = fixture
      ? `${getClub(world, fixture.homeId).name} – ${getClub(world, fixture.awayId).name}`
      : 'Maç';
    return {
      title,
      subtitle: fixture ? fixtureLabel(fixture) : 'Süper Lig',
      colors: LEAGUE_COLORS,
    };
  }

  const info = screen === 'player' ? { label: 'Oyuncu' } : screenInfo(screen);
  if (screen === 'international') {
    return {
      title: info.label,
      subtitle: `${tournamentTitle(world.international.year, world.international.kind)} döngüsü`,
      colors: NATIONAL_COLORS,
    };
  }
  if (screen === 'fixtures' || screen === 'table' || screen === 'stats') {
    return {
      title: info.label,
      subtitle: `Süper Lig ${seasonLabel(world.season.year)}`,
      colors: LEAGUE_COLORS,
    };
  }
  return {
    title: info.label,
    subtitle: ownClub.name,
    colors: ownClub.colors,
  };
}
