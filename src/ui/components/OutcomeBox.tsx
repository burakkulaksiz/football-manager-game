import type { Outcome } from '../../engine';
import { OUTCOME_LABELS } from '../labels';

/** Form/sonuç kutusu: G (yeşil), B (gri), M (koyu kırmızı). */
export function OutcomeBox({ outcome }: { outcome: Outcome }) {
  return <span className={`outcome outcome-${outcome}`}>{OUTCOME_LABELS[outcome]}</span>;
}
