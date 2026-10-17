import type { Club } from '../../engine';

/** Kulüp renklerinde kalkan arma. Küçük boyutta yazı gösterilmez. */
export function ClubBadge({ club, size = 34 }: { club: Club; size?: number }) {
  const { primary, secondary } = club.colors;
  const showText = size >= 24;
  const fontSize = club.shortName.length <= 2 ? 15 : club.shortName.length === 3 ? 12 : 10;
  return (
    <svg
      className="club-badge"
      width={size}
      height={size * 1.15}
      viewBox="0 0 40 46"
      role="img"
      aria-label={club.name}
    >
      <path
        d="M20 1.5 L37.5 6.5 V22 C37.5 33.5 30 40.5 20 44.5 C10 40.5 2.5 33.5 2.5 22 V6.5 Z"
        fill={primary}
        stroke={secondary}
        strokeWidth="2.5"
      />
      {/* üstte ince ikinci renk bandı */}
      <path d="M6 9.5 L20 5.5 L34 9.5 V12.5 L20 8.5 L6 12.5 Z" fill={secondary} opacity="0.9" />
      {showText && (
        <text
          x="20"
          y="29"
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill={secondary}
          fontFamily="'Barlow Condensed', sans-serif"
        >
          {club.shortName}
        </text>
      )}
    </svg>
  );
}
