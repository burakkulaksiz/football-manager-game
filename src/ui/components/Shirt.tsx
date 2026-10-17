/** Kulüp renklerinde forma (FM'deki taktik ekranı formaları gibi), üzerinde numara. */
export function Shirt({
  primary,
  secondary,
  number,
  size = 48,
}: {
  primary: string;
  secondary: string;
  number?: number | null;
  size?: number;
}) {
  return (
    <svg className="shirt" width={size} height={size * 0.93} viewBox="0 0 60 56" aria-hidden="true">
      <path
        d="M18 2 L24 0.5 C26.5 5 33.5 5 36 0.5 L42 2 L58 12 L52 25 L46 22 L46 54 L14 54 L14 22 L8 25 L2 12 Z"
        fill={primary}
        stroke={secondary}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {number != null && (
        <text
          x="30"
          y="41"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill={secondary}
          fontFamily="'Barlow Condensed', sans-serif"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
