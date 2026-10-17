import type { Club } from '../../engine';

/** Kulüp renkleriyle küçük arma yerine geçen kutu. */
export function ClubBadge({ club, size = 34 }: { club: Club; size?: number }) {
  return (
    <div
      className="club-badge"
      style={{
        width: size,
        height: size,
        background: club.colors.primary,
        color: club.colors.secondary,
        borderColor: club.colors.secondary,
        fontSize: size / 3,
      }}
    >
      {club.shortName}
    </div>
  );
}
