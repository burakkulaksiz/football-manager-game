/** Maçın hangi organizasyona ait olduğu: etiketler (lig, Türkiye Kupası, Avrupa kupaları). */
import type { Fixture } from '../types';
import { CUP_NAME, cupRoundName } from './cup';
import { EUROPE, isEuropeCompetition, stageName } from './europe';
import { leagueName } from './leagues';

export const LEAGUE_NAME = 'Süper Lig';

/** Organizasyonun adı. */
export function competitionName(f: Fixture): string {
  if (f.competition === 'cup') return CUP_NAME;
  if (isEuropeCompetition(f.competition)) return EUROPE[f.competition].name;
  return leagueName(f.league);
}

/** Aşama: "5. Hafta", "Son 16", "A Grubu, 3. Maç", "Çeyrek Final rövanş". */
export function stageLabel(f: Fixture): string {
  if (f.competition === 'cup') return cupRoundName(f.round);
  if (isEuropeCompetition(f.competition)) return stageName(f.round, f.group);
  return `${f.round}. Hafta`;
}

/** "Süper Lig · 5. Hafta" / "Premier League · 5. Hafta" / "Türkiye Kupası · Son 16" / "Şampiyonlar Ligi · A Grubu, 3. Maç". */
export function fixtureLabel(f: Fixture): string {
  return `${competitionName(f)} · ${stageLabel(f)}`;
}

/** Kısa etiket (listeler, yan menü): "5. Hafta", "Kupa · Son 16", "ŞL · A Grubu, 3. Maç". */
export function shortFixtureLabel(f: Fixture): string {
  if (f.competition === 'cup') return `Kupa · ${stageLabel(f)}`;
  if (isEuropeCompetition(f.competition)) return `${EUROPE[f.competition].short} · ${stageLabel(f)}`;
  return stageLabel(f);
}
