/**
 * data/ klasöründeki JSON'ların tipleri ve doğrulaması.
 * Dosyalar elle düzenleneceği için hatalar Türkçe ve anlaşılır olmalı.
 */
import type { Club, FanExpectation } from './types';

export interface Nation {
  /** Kısa kod, örn. 'TUR' */
  code: string;
  /** Türkçe ülke adı */
  name: string;
  /** data/names/<namePool>.json */
  namePool: string;
  /** Yabancı oyuncu üretirken seçilme ağırlığı (0 = hiç seçilmez). */
  weight: number;
  /** Konfederasyon: eleme grupları UEFA ülkeleriyle oynanır; diğerleri Dünya Kupası'na doğrudan seçilir. */
  confederation: Confederation;
  /**
   * 1–100: ülkenin oyun dünyasında olmayan oyuncularının (kayda yazılmayan "sanal" kadro) seviyesi.
   * Milli takım, dünyadaki oyuncularla bu kadronun en iyilerinden kurulur.
   */
  strength: number;
  colors: { primary: string; secondary: string };
}

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC';
export const CONFEDERATIONS: readonly Confederation[] = ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'];

export interface NamePool {
  firstNames: string[];
  lastNames: string[];
}

export interface GameData {
  /** Süper Lig kulüpleri (data/clubs.json). */
  clubs: Club[];
  /** Kurgusal 1. Lig kulüpleri (data/lower_league.json): küme düşen yerine çıkanlar buradan. */
  lowerClubs: Club[];
  /** Yurtdışı kulüpleri (data/foreign_clubs.json): maç oynamaz, transfer pazarında yer alır. */
  foreignClubs: Club[];
  nations: Nation[];
  namePools: Record<string, NamePool>;
}

/** Yerli oyuncuların ülke kodu. */
export const HOME_NATION = 'TUR';

const FAN_EXPECTATIONS: readonly FanExpectation[] = [
  'title', 'europe', 'top_half', 'mid_table', 'avoid_relegation',
];

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0);
}

export function validateGameData(raw: {
  clubs: unknown;
  lowerClubs?: unknown;
  foreignClubs?: unknown;
  nations: unknown;
  namePools: Record<string, unknown>;
}): GameData {
  const errors: string[] = [];
  const str = (o: Obj, k: string, where: string) => {
    if (typeof o[k] !== 'string' || o[k] === '') errors.push(`${where}: '${k}' metin olmalı`);
  };
  const num = (o: Obj, k: string, where: string, min: number, max: number) => {
    const v = o[k];
    if (typeof v !== 'number' || v < min || v > max) {
      errors.push(`${where}: '${k}' ${min}–${max} arasında sayı olmalı`);
    }
  };

  // --- Kulüpler (iki dosyada da kimlikler benzersiz olmalı) ---
  const ids = new Set<string>();
  const validateClubs = (list: unknown, file: string, maxReputation = 100) => {
    if (!Array.isArray(list)) {
      errors.push(`${file} bir dizi olmalı`);
      return;
    }
    list.forEach((c, i) => {
      const where = `${file}[${i}]`;
      if (!isObj(c)) {
        errors.push(`${where}: nesne olmalı`);
        return;
      }
      for (const k of ['id', 'name', 'shortName', 'city', 'stadium']) str(c, k, where);
      num(c, 'capacity', where, 1000, 200_000);
      num(c, 'reputation', where, 1, maxReputation);
      num(c, 'budget', where, 0, 1e10);
      num(c, 'wageBudget', where, 0, 1e10);
      if (!FAN_EXPECTATIONS.includes(c.fanExpectation as FanExpectation)) {
        errors.push(`${where}: 'fanExpectation' şunlardan biri olmalı: ${FAN_EXPECTATIONS.join(', ')}`);
      }
      if (!isObj(c.colors) || typeof c.colors.primary !== 'string' || typeof c.colors.secondary !== 'string') {
        errors.push(`${where}: 'colors' { primary, secondary } olmalı`);
      }
      if (typeof c.id === 'string') {
        if (ids.has(c.id)) errors.push(`${where}: '${c.id}' kimliği tekrar ediyor`);
        ids.add(c.id);
      }
    });
  };
  validateClubs(raw.clubs, 'clubs.json');
  validateClubs(raw.lowerClubs ?? [], 'lower_league.json');
  if (Array.isArray(raw.lowerClubs) && raw.lowerClubs.length < 3) {
    errors.push('lower_league.json: küme düşenlerin yerine çıkacak en az 3 kulüp olmalı');
  }
  validateClubs(raw.foreignClubs ?? [], 'foreign_clubs.json', 130);
  const nationCodes = new Set(Array.isArray(raw.nations) ? raw.nations.map((n) => (isObj(n) ? n.code : null)) : []);
  if (Array.isArray(raw.foreignClubs)) {
    raw.foreignClubs.forEach((c, i) => {
      if (!isObj(c)) return;
      if (typeof c.country !== 'string' || !nationCodes.has(c.country) || c.country === HOME_NATION) {
        errors.push(`foreign_clubs.json[${i}]: 'country' nations.json'daki bir ülke kodu olmalı (Türkiye hariç)`);
      }
    });
  }

  // --- İsim havuzları ---
  for (const [key, pool] of Object.entries(raw.namePools)) {
    if (!isObj(pool) || !isNonEmptyStringArray(pool.firstNames) || !isNonEmptyStringArray(pool.lastNames)) {
      errors.push(`names/${key}.json: boş olmayan 'firstNames' ve 'lastNames' dizileri olmalı`);
    }
  }

  // --- Ülkeler ---
  if (!Array.isArray(raw.nations)) {
    errors.push('nations.json bir dizi olmalı');
  } else {
    raw.nations.forEach((n, i) => {
      const where = `nations.json[${i}]`;
      if (!isObj(n)) {
        errors.push(`${where}: nesne olmalı`);
        return;
      }
      for (const k of ['code', 'name', 'namePool']) str(n, k, where);
      num(n, 'weight', where, 0, 1000);
      num(n, 'strength', where, 1, 100);
      if (!CONFEDERATIONS.includes(n.confederation as Confederation)) {
        errors.push(`${where}: 'confederation' şunlardan biri olmalı: ${CONFEDERATIONS.join(', ')}`);
      }
      if (!isObj(n.colors) || typeof n.colors.primary !== 'string' || typeof n.colors.secondary !== 'string') {
        errors.push(`${where}: 'colors' { primary, secondary } olmalı`);
      }
      if (typeof n.namePool === 'string' && !(n.namePool in raw.namePools)) {
        errors.push(`${where}: isim havuzu bulunamadı: names/${n.namePool}.json`);
      }
    });
    if (!raw.nations.some((n) => isObj(n) && n.code === HOME_NATION)) {
      errors.push(`nations.json: '${HOME_NATION}' (Türkiye) bulunmalı`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Oyun verisi hatalı:\n- ${errors.join('\n- ')}`);
  }
  return { ...raw, lowerClubs: raw.lowerClubs ?? [], foreignClubs: raw.foreignClubs ?? [] } as unknown as GameData;
}
