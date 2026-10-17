/**
 * Anında maç sonucu (basit model). 4. aşamadaki dakika dakika motor gelene kadar
 * tüm maçlar, sonra da arka plandaki diğer maçlar için kullanılabilir.
 *
 * Model: her takımın gol sayısı Poisson dağılımından çekilir.
 *   beklenen gol = taban × e^(±k × güç farkı)
 * Taban değerler (ev 1.38, deplasman 1.07) maç başına ~2.6 gol ve iç saha avantajı verir.
 */
import { primaryPosition } from '../player';
import type { Rng } from '../rng';
import type { GoalEvent, MatchResult, Player, Position } from '../types';

const HOME_BASE_GOALS = 1.38;
const AWAY_BASE_GOALS = 1.07;
/** İlk 11 ortalama CA farkının her puanı için gol beklentisi çarpanı. */
const STRENGTH_FACTOR = 0.016;

/**
 * Otomatik ilk 11: sakat olmayanlardan en iyi kaleci + en iyi 10 saha oyuncusu (CA'ya göre).
 * 5. aşamada taktik/diziliş tabanlı seçimle değişecek.
 */
export function selectBestXI(squad: readonly Player[]): Player[] {
  const available = squad.filter((p) => p.injury === null);
  const byCA = (a: Player, b: Player) => b.currentAbility - a.currentAbility;
  const keepers = available.filter((p) => primaryPosition(p) === 'GK').sort(byCA);
  const outfield = available.filter((p) => primaryPosition(p) !== 'GK').sort(byCA);
  return [...keepers.slice(0, 1), ...outfield.slice(0, 10)];
}

export function teamStrength(xi: readonly Player[]): number {
  if (xi.length === 0) return 0;
  return xi.reduce((sum, p) => sum + p.currentAbility, 0) / xi.length;
}

/** Poisson dağılımlı rastgele sayı (Knuth yöntemi; küçük λ için yeterli). */
export function poisson(rng: Rng, lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > limit);
  return k - 1;
}

/** Golü atma olasılığı için mevki ağırlığı. */
const SCORER_WEIGHT: Record<Position, number> = {
  GK: 0, DR: 0.5, DL: 0.5, DC: 0.6, WBR: 0.8, WBL: 0.8, DM: 1, MR: 2, ML: 2, MC: 2,
  AMR: 4, AML: 4, AMC: 4, ST: 7,
};

function pickScorer(rng: Rng, xi: readonly Player[]): Player {
  const weights = xi.map(
    (p) => SCORER_WEIGHT[primaryPosition(p)] * (p.attributes.finishing + p.attributes.offTheBall),
  );
  return xi[rng.weightedIndex(weights)]!;
}

export function simulateQuickMatch(
  rng: Rng,
  home: { clubId: string; xi: readonly Player[] },
  away: { clubId: string; xi: readonly Player[] },
): MatchResult {
  const diff = teamStrength(home.xi) - teamStrength(away.xi);
  const homeGoals = poisson(rng, HOME_BASE_GOALS * Math.exp(STRENGTH_FACTOR * diff));
  const awayGoals = poisson(rng, AWAY_BASE_GOALS * Math.exp(-STRENGTH_FACTOR * diff));

  const goals: GoalEvent[] = [];
  for (let i = 0; i < homeGoals; i++) {
    goals.push({ minute: rng.int(1, 90), clubId: home.clubId, playerId: pickScorer(rng, home.xi).id });
  }
  for (let i = 0; i < awayGoals; i++) {
    goals.push({ minute: rng.int(1, 90), clubId: away.clubId, playerId: pickScorer(rng, away.xi).id });
  }
  goals.sort((a, b) => a.minute - b.minute);
  return { homeGoals, awayGoals, goals };
}
