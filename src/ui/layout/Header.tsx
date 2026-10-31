import { formatDateTR, getClub, leagueName, seasonLabel, userLeague } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { readableText } from '../colors';
import { splitDateTR } from '../labels';
import { pageHeading } from './pageHeading';

/** Üst başlık: solda tarih, ortada sayfa başlığı hapı, sağda kulüp. */
export function Header() {
  const world = useWorld();
  const screen = useGameStore((s) => s.screen);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const viewedClubId = useGameStore((s) => s.viewedClubId);
  const selectedFixtureId = useGameStore((s) => s.selectedFixtureId);
  const heading = pageHeading(world, screen, selectedPlayerId, viewedClubId, selectedFixtureId);
  const club = world.unemployed ? null : getClub(world, world.playerClubId);
  const { day, date } = splitDateTR(formatDateTR(world.date));

  return (
    <header className="header">
      <div className="header-date">
        <div className="header-day">{day}</div>
        <div className="header-fulldate">{date}</div>
      </div>

      <div
        className="title-pill"
        style={{ background: heading.colors.primary, color: readableText(heading.colors.primary, heading.colors.secondary) }}
      >
        <div className="title-pill-title">{heading.title}</div>
        <div className="title-pill-sub">{heading.subtitle}</div>
      </div>

      <div className="header-club">
        <div className="header-club-text">
          <div className="header-club-name">{club ? club.name : 'İşsiz'}</div>
          <div className="header-club-season">{world.manager.name} · {leagueName(userLeague(world))} {seasonLabel(world.season.year)}</div>
        </div>
        {club && <ClubBadge club={club} size={34} />}
      </div>
    </header>
  );
}
