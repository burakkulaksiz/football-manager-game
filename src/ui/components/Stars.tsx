/** 0–5 arası (yarım dahil) yıldız gösterimi. */
export function Stars({ value, title }: { value: number; title?: string }) {
  return (
    <span className="stars" title={title ?? `${value} / 5`}>
      <span className="stars-empty">★★★★★</span>
      <span className="stars-full" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span>
    </span>
  );
}
