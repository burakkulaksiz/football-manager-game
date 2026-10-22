import { EUROPE, getClub, scoreLine, type GameWorld } from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDayMonth } from '../labels';
import { pageHeading } from './pageHeading';

/** Haber bandı: son haftanın sonuçları + son transfer haberleri (FM'deki "+++" bandı). */
function tickerItems(world: GameWorld): string[] {
  const transfers = world.news
    .filter((n) => n.category === 'transfer' || n.category === 'loan')
    .slice(-4)
    .map((n) => n.title);
  return [...resultItems(world), ...transfers];
}

function resultItems(world: GameWorld): string[] {
  const played = world.season.fixtures.filter((f) => f.result);
  if (played.length === 0) {
    const first = world.season.fixtures[0];
    return [
      'Hazırlık dönemi',
      first ? `Süper Lig ${formatDayMonth(first.date)} tarihinde başlıyor` : 'Yeni sezon yakında',
    ];
  }
  // Son maç gününün sonuçları (lig haftası ya da kupa turu)
  const lastDate = played.reduce((max, f) => (f.date > max ? f.date : max), played[0]!.date);
  return played
    .filter((f) => f.date === lastDate)
    .map((f) => `${f.competition === 'cup' ? 'Kupa: ' : f.competition ? `${EUROPE[f.competition].short}: ` : ''}${getClub(world, f.homeId).name} ${scoreLine(f).replace(' - ', '-')} ${getClub(world, f.awayId).name}`);
}

export function StatusBar() {
  const world = useWorld();
  const screen = useGameStore((s) => s.screen);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const viewedClubId = useGameStore((s) => s.viewedClubId);
  const selectedFixtureId = useGameStore((s) => s.selectedFixtureId);
  const { breadcrumb } = pageHeading(world, screen, selectedPlayerId, viewedClubId, selectedFixtureId);
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
