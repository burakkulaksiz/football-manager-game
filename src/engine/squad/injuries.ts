/**
 * Kalıcı sakatlıklar: maçta ya da antrenmanda olur, gün gün iyileşir.
 * Sakat oyuncu kadroya alınmaz (isAvailable).
 */
import { addNews } from '../news';
import type { Rng } from '../rng';
import type { GameWorld, Injury, Player } from '../types';
import { INTENSITY_EFFECTS, trainingOf } from './training';

interface InjuryType {
  name: string;
  minDays: number;
  maxDays: number;
  /** Görülme sıklığı ağırlığı. */
  weight: number;
}

/** Hafiften ağıra sakatlık türleri. Ağır olanlar nadir. */
export const INJURY_TYPES: readonly InjuryType[] = [
  { name: 'Darbe', minDays: 2, maxDays: 5, weight: 22 },
  { name: 'Kas zorlanması', minDays: 5, maxDays: 12, weight: 20 },
  { name: 'Ayak bileği burkulması', minDays: 7, maxDays: 20, weight: 14 },
  { name: 'Hamstring zorlanması', minDays: 10, maxDays: 28, weight: 14 },
  { name: 'Kasık ağrısı', minDays: 7, maxDays: 21, weight: 8 },
  { name: 'Diz bağı zedelenmesi', minDays: 21, maxDays: 50, weight: 8 },
  { name: 'Kas yırtığı', minDays: 25, maxDays: 60, weight: 6 },
  { name: 'Kaburga çatlağı', minDays: 20, maxDays: 40, weight: 3 },
  { name: 'Menisküs yırtığı', minDays: 45, maxDays: 100, weight: 3 },
  { name: 'Çapraz bağ kopması', minDays: 150, maxDays: 240, weight: 2 },
];

/** Antrenmanda günlük sakatlanma olasılığı (oyuncu başına, ortalama sakatlık eğilimi için). */
export const TRAINING_INJURY_CHANCE = 0.0005;

export function createInjury(rng: Rng): Injury {
  const type = INJURY_TYPES[rng.weightedIndex(INJURY_TYPES.map((t) => t.weight))]!;
  return { name: type.name, daysOut: rng.int(type.minDays, type.maxDays) };
}

/** "3 hafta", "2 ay" gibi okunur süre. */
export function durationText(days: number): string {
  if (days <= 7) return '1 hafta';
  if (days <= 35) return `${Math.ceil(days / 7)} hafta`;
  return `${Math.round(days / 30)} ay`;
}

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

export function injurePlayer(world: GameWorld, player: Player, rng: Rng, cause: 'match' | 'training' | 'international'): void {
  if (player.injury) return;
  player.injury = createInjury(rng);
  player.condition = Math.min(player.condition, 60);
  if (player.clubId === world.playerClubId) {
    addNews(world, {
      category: 'injury',
      title: `${fullName(player)} sakatlandı`,
      body: `${fullName(player)} ${cause === 'match' ? 'maçta' : cause === 'international' ? 'milli maçta' : 'antrenmanda'} sakatlandı: ${player.injury.name}. Tahmini dönüş: ${durationText(player.injury.daysOut)}.`,
      important: true,
      playerId: player.id,
      clubId: player.clubId,
    });
  }
}

/** Her gün: iyileşme. */
export function healInjuries(world: GameWorld): void {
  for (const p of Object.values(world.players)) {
    if (!p.injury) continue;
    p.injury.daysOut--;
    if (p.injury.daysOut > 0) continue;
    const name = p.injury.name;
    p.injury = null;
    p.condition = Math.max(p.condition, 70);
    if (p.clubId === world.playerClubId) {
      addNews(world, {
        category: 'injury',
        title: `${fullName(p)} iyileşti`,
        body: `${fullName(p)} sakatlığını (${name}) atlattı ve takımla çalışmaya başladı.`,
        important: false,
        playerId: p.id,
        clubId: p.clubId,
      });
    }
  }
}

/** Her gün: antrenman sakatlıkları (yoğunluk ve sakatlık eğilimine bağlı). */
export function trainingInjuries(world: GameWorld, rng: Rng): void {
  for (const p of Object.values(world.players)) {
    if (p.injury || !p.clubId) continue;
    const risk = TRAINING_INJURY_CHANCE * (p.hidden.injuryProneness / 10) * INTENSITY_EFFECTS[trainingOf(world, p.clubId).intensity].injury;
    if (rng.chance(risk)) injurePlayer(world, p, rng, 'training');
  }
}
