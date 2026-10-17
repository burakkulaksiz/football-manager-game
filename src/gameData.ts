/**
 * data/ klasöründeki JSON dosyalarını yükler ve doğrular.
 * Motor saf kalsın diye dosya okuma burada; motor yalnızca GameData nesnesini alır.
 * data/names/ içine yeni bir <havuz>.json eklemek yeterli, burada değişiklik gerekmez.
 */
import clubs from '../data/clubs.json';
import lowerClubs from '../data/lower_league.json';
import nations from '../data/nations.json';
import { validateGameData, type GameData } from './engine/data';

const poolModules = import.meta.glob<unknown>('../data/names/*.json', {
  eager: true,
  import: 'default',
});

const namePools: Record<string, unknown> = {};
for (const [path, pool] of Object.entries(poolModules)) {
  const key = path.split('/').pop()!.replace(/\.json$/, '');
  namePools[key] = pool;
}

export const gameData: GameData = validateGameData({ clubs, lowerClubs, nations, namePools });
