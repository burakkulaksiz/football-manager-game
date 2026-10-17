import { getClub, type GameWorld } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDayMonth } from '../labels';
import { pageHeading } from './pageHeading';

/** Haber bandı: son oynanan haftanın sonuçları (FM'deki "+++" bandı). */
function tickerItems(world: GameWorld): string[] {
  const played = world.season.fixtures.filter((f) => f.result);
  if (played.length === 0) {
    const first = world.season.fixtures[0];
    return [
      'Hazırlık dönemi',
      first ? `Süper Lig ${formatDayMonth(first.date)} tarihinde başlıyor` : 'Yeni sezon yakında',
    ];
  }
  const lastRound = Math.max(...played.map((f) => f.round));
  return played
    .filter((f) => f.round === lastRound)
    .map((f) => `${getClub(world, f.homeId).name} ${f.result!.homeGoals}-${f.result!.awayGoals} ${getClub(world, f.awayId).name}`);
}

export function StatusBar() {
  const world = useWorld();
  const screen = useGameStore((s) => s.screen);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const viewedClubId = useGameStore((s) => s.viewedClubId);
  const { breadcrumb } = pageHeading(world, screen, selectedPlayerId, viewedClubId);
  const items = tickerItems(world);
  // Az haber varsa bant boş kalmasın diye metin tekrarlanır.
  const once = items.map((t) => `+++ ${t} `).join('');
  const text = once.repeat(items.length < 5 ? 4 : 1) + '+++';

  return (
    <footer className="statusbar">
      <div className="breadcrumb">
        {breadcrumb.map((part, i) => (
          <span key={i} className={i === breadcrumb.length - 1 ? 'current' : ''}>
            {part}
          </span>
        ))}
      </div>
      <div className="ticker" aria-label="Son sonuçlar">
        {/* Metin iki kez yazılır ki kayan bant kesintisiz dönsün. */}
        <div className="ticker-track" key={text}>
          <span>{text}</span>
          <span aria-hidden="true">{text}</span>
        </div>
      </div>
    </footer>
  );
}
