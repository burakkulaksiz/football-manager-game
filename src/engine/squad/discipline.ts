/**
 * Cezalar: 4 sarı kart → 1 maç (sayaç sıfırlanır), ikinci sarıdan kırmızı → 1 maç,
 * direkt kırmızı → 1–3 maç. Ceza, kulübün bir sonraki lig maç(lar)ında çekilir.
 */
import { addNews } from '../news';
import type { Rng } from '../rng';
import type { Fixture, GameWorld, MatchResult, Player } from '../types';

export const YELLOW_LIMIT = 4;

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

function banNews(world: GameWorld, player: Player, matches: number, reason: string): void {
  if (player.clubId !== world.playerClubId) return;
  addNews(world, {
    category: 'discipline',
    title: `${fullName(player)} cezalı`,
    body: `${fullName(player)} ${reason} nedeniyle ${matches} maç ceza aldı.`,
    important: true,
    playerId: player.id,
    clubId: player.clubId,
  });
}

/** Maç sonrası: önce eski cezalar çekilir, sonra bu maçın kartları işlenir. */
export function processDiscipline(world: GameWorld, fixture: Fixture, result: MatchResult, rng: Rng): void {
  const played = new Set(result.players.map((r) => r.playerId));

  // 1) Bu maçta cezalı olanlar cezalarının bir maçını çekti.
  for (const p of Object.values(world.players)) {
    if (p.suspension > 0 && (p.clubId === fixture.homeId || p.clubId === fixture.awayId) && !played.has(p.id)) {
      p.suspension--;
    }
  }

  // 2) Bu maçın kartları
  const byPlayer = new Map<number, MatchResult['cards']>();
  for (const c of result.cards) byPlayer.set(c.playerId, [...(byPlayer.get(c.playerId) ?? []), c]);
  for (const [playerId, cards] of byPlayer) {
    const player = world.players[playerId];
    if (!player) continue;
    const red = cards.find((c) => c.type === 'red');
    if (red?.secondYellow) {
      // İkinci sarıdan kırmızı: 1 maç; bu maçın sarıları birikime sayılmaz.
      player.suspension += 1;
      banNews(world, player, 1, 'ikinci sarı karttan gördüğü kırmızı kart');
    } else if (red) {
      const matches = [1, 2, 3][rng.weightedIndex([60, 30, 10])]!;
      player.suspension += matches;
      banNews(world, player, matches, 'direkt kırmızı kart');
    } else {
      player.yellowCards += cards.length;
      if (player.yellowCards >= YELLOW_LIMIT) {
        player.yellowCards -= YELLOW_LIMIT;
        player.suspension += 1;
        banNews(world, player, 1, `${YELLOW_LIMIT}. sarı kart`);
      }
    }
  }
}
