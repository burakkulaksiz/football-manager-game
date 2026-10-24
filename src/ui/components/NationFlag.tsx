import { nationInfo } from '../../engine';
import { gameData } from '../../gameData';

/** Ülke renklerinde küçük iki şeritli bayrak (nations.json `colors`). */
export function NationFlag({ code, size = 16 }: { code: string; size?: number }) {
  const { name, colors } = nationInfo(gameData, code);
  return (
    <svg className="nation-flag" width={size} height={size * 0.7} viewBox="0 0 20 14" role="img" aria-label={name}>
      <rect x="0.5" y="0.5" width="19" height="13" rx="2" fill={colors.primary} stroke="rgba(0,0,0,0.45)" />
      <rect x="0.5" y="8.5" width="19" height="5" rx="0" fill={colors.secondary} />
      <rect x="0.5" y="0.5" width="19" height="13" rx="2" fill="none" stroke="rgba(0,0,0,0.45)" />
    </svg>
  );
}
