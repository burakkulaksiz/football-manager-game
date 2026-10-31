import { divisionOf, foreignCountries, leagueName, type GameWorld } from '../../engine';
import { nationName } from '../labels';

/** Kulüp seçicisinin seçenekleri: Süper Lig, 1. Lig, sonra yurtdışı ligleri (ülke · lig). */
export function ClubOptions({ world, exclude }: { world: GameWorld; exclude?: string }) {
  const clubs = world.clubs.filter((c) => c.id !== exclude);
  const byName = (list: typeof clubs) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const group = (label: string, list: typeof clubs) =>
    list.length > 0 && (
      <optgroup key={label} label={label}>
        {byName(list).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
    );
  return (
    <>
      {group('Süper Lig', clubs.filter((c) => divisionOf(c) === 1))}
      {group('1. Lig', clubs.filter((c) => divisionOf(c) === 2))}
      {foreignCountries(world).map((code) => group(`${nationName(code)} · ${leagueName(code)}`, clubs.filter((c) => c.country === code)))}
    </>
  );
}

/** Bölge seçenekleri (transfer / gözlemci araması): Tümü, Türkiye, Yurtdışı, ülkeler. */
export function RegionOptions({ world }: { world: GameWorld }) {
  return (
    <>
      <option value="">Tümü</option>
      <option value="TUR">Türkiye</option>
      <option value="abroad">Yurtdışı (tümü)</option>
      {foreignCountries(world).map((code) => <option key={code} value={code}>{nationName(code)}</option>)}
    </>
  );
}
