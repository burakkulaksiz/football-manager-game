/**
 * data/ klasöründeki JSON'ların tipleri ve doğrulaması.
 * Dosyalar elle düzenleneceği için hatalar Türkçe ve anlaşılır olmalı.
 */
import { ALL_ATTRS, HIDDEN_ATTRS, type AttributeKey, type HiddenAttr } from './attributes';
import { POSITIONS } from './positions';
import type { Club, FanExpectation, Foot, Position } from './types';

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
  /** false: milli takımı oyunda yok (küçük ülkeler; oyuncuları milli takıma çağrılmaz). Yoksa var. */
  nationalTeam?: boolean;
}

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC';
export const CONFEDERATIONS: readonly Confederation[] = ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'];

export interface NamePool {
  firstNames: string[];
  lastNames: string[];
}

/**
 * data/squads/<kulüpId>.json içindeki gerçek oyuncu. Zorunlu alanlar kısa; isteğe bağlı alanlar üretilen değeri ezer.
 * Güç (ability) oyuncu üretimindeki seviye ölçeğindedir (1–20): özellikler buna ve mevkiye göre üretilir.
 */
export interface SquadPlayerData {
  firstName: string;
  lastName: string;
  /** 'YYYY-AA-GG' ya da yalnızca yıl. */
  born: string | number;
  /** nations.json ülke kodu. */
  nationality: string;
  /** İlki asıl mevki. Dizi: tek mevkide yakın mevkiler üretilir, birden çoksa hepsi doğal (18). Nesne: yatkınlıklar (1–20). */
  positions: Position[] | Partial<Record<Position, number>>;
  ability: number;
  /** Ulaşabileceği güç (1–20); yoksa yaşa göre üretilir. */
  potential?: number;
  number?: number;
  foot?: Foot;
  /** Kulübe katılış (takım içi hiyerarşide kulüpteki süre). */
  joined?: string;
  /** Sözleşme bitişi: 'YYYY-AA-GG' ya da yıl (30 Haziran). */
  contractExpires?: string | number;
  /** Yıllık maaş (€); yoksa kulübün maaş bütçesine göre. */
  wage?: number;
  attributes?: Partial<Record<AttributeKey, number>>;
  hidden?: Partial<Record<HiddenAttr, number>>;
  /** Bilgi amaçlı (Transfermarkt); oyunda kullanılmaz. */
  marketValue?: number;
}

export interface SquadData {
  /** Bilgi amaçlı (verinin kaynağı). */
  source?: string;
  players: SquadPlayerData[];
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
  /** Gerçek kadrolar (data/squads/<kulüpId>.json); dosyası olmayan kulübün kadrosu üretilir. */
  squads: Record<string, SquadData>;
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
  squads?: Record<string, unknown>;
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
      if (n.nationalTeam !== undefined && typeof n.nationalTeam !== 'boolean') errors.push(`${where}: 'nationalTeam' true / false olmalı`);
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
    const uefaTeams = raw.nations.filter((n) => isObj(n) && n.confederation === 'UEFA' && n.nationalTeam !== false).length;
    if (uefaTeams < 8) errors.push(`nations.json: eleme grupları için milli takımı olan en az 8 UEFA ülkesi olmalı (${uefaTeams} var)`);
    if (!raw.nations.some((n) => isObj(n) && n.code === HOME_NATION)) {
      errors.push(`nations.json: '${HOME_NATION}' (Türkiye) bulunmalı`);
    }
  }

  validateSquads(raw.squads ?? {}, ids, nationCodes, errors);

  if (errors.length > 0) {
    throw new Error(`Oyun verisi hatalı:\n- ${errors.join('\n- ')}`);
  }
  return { ...raw, lowerClubs: raw.lowerClubs ?? [], foreignClubs: raw.foreignClubs ?? [], squads: raw.squads ?? {} } as unknown as GameData;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDateOrYear = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v)) || (typeof v === 'number' && Number.isInteger(v) && v > 1900 && v < 2100);

/** Kadro dosyaları: kulüp var mı, alanlar geçerli mi, forma numaraları tekrar ediyor mu. */
function validateSquads(squads: Record<string, unknown>, clubIds: ReadonlySet<string>, nationCodes: ReadonlySet<unknown>, errors: string[]): void {
  for (const [clubId, squad] of Object.entries(squads)) {
    const file = `squads/${clubId}.json`;
    if (!clubIds.has(clubId)) errors.push(`${file}: '${clubId}' adında kulüp yok (dosya adı kulüp kimliği olmalı)`);
    if (!isObj(squad) || !Array.isArray(squad.players)) {
      errors.push(`${file}: { "players": [...] } biçiminde olmalı`);
      continue;
    }
    const numbers = new Set<number>();
    squad.players.forEach((p, i) => {
      const where = `${file} oyuncu ${i + 1}${isObj(p) && typeof p.lastName === 'string' ? ` (${p.lastName})` : ''}`;
      if (!isObj(p)) {
        errors.push(`${where}: nesne olmalı`);
        return;
      }
      if (typeof p.firstName !== 'string') errors.push(`${where}: 'firstName' metin olmalı (tek adlı oyuncuda boş metin)`);
      if (typeof p.lastName !== 'string' || p.lastName === '') errors.push(`${where}: 'lastName' metin olmalı`);
      if (!isDateOrYear(p.born)) errors.push(`${where}: 'born' 'YYYY-AA-GG' ya da yıl olmalı`);
      if (!nationCodes.has(p.nationality)) errors.push(`${where}: uyruk '${String(p.nationality)}' nations.json'da yok`);
      const positions = Array.isArray(p.positions) ? p.positions : isObj(p.positions) ? Object.keys(p.positions) : [];
      if (positions.length === 0 || !positions.every((x) => POSITIONS.includes(x as Position))) {
        errors.push(`${where}: 'positions' geçerli mevki kodları olmalı (${POSITIONS.join(', ')})`);
      }
      if (isObj(p.positions) && !Object.values(p.positions).every((v) => typeof v === 'number' && v >= 1 && v <= 20)) {
        errors.push(`${where}: mevki yatkınlıkları 1–20 olmalı`);
      }
      const level = (k: string, required: boolean) => {
        if (p[k] === undefined && !required) return;
        if (typeof p[k] !== 'number' || (p[k] as number) < 1 || (p[k] as number) > 20) errors.push(`${where}: '${k}' 1–20 olmalı`);
      };
      level('ability', true);
      level('potential', false);
      if (p.number !== undefined) {
        if (typeof p.number !== 'number' || !Number.isInteger(p.number) || p.number < 1 || p.number > 99) errors.push(`${where}: 'number' 1–99 olmalı`);
        else if (numbers.has(p.number)) errors.push(`${where}: forma numarası ${p.number} tekrar ediyor`);
        else numbers.add(p.number);
      }
      if (p.foot !== undefined && !['right', 'left', 'both'].includes(p.foot as string)) errors.push(`${where}: 'foot' right / left / both olmalı`);
      if (p.joined !== undefined && !(typeof p.joined === 'string' && DATE_RE.test(p.joined))) errors.push(`${where}: 'joined' 'YYYY-AA-GG' olmalı`);
      if (p.contractExpires !== undefined && !isDateOrYear(p.contractExpires)) errors.push(`${where}: 'contractExpires' 'YYYY-AA-GG' ya da yıl olmalı`);
      if (p.wage !== undefined && (typeof p.wage !== 'number' || p.wage < 0)) errors.push(`${where}: 'wage' (yıllık €) sayı olmalı`);
      for (const [k, keys] of [['attributes', ALL_ATTRS], ['hidden', HIDDEN_ATTRS]] as const) {
        const v = p[k];
        if (v === undefined) continue;
        if (!isObj(v) || !Object.entries(v).every(([a, x]) => (keys as readonly string[]).includes(a) && typeof x === 'number' && x >= 1 && x <= 20)) {
          errors.push(`${where}: '${k}' bilinen özellik adları ve 1–20 değerler içermeli`);
        }
      }
    });
    const keepers = squad.players.filter((p) => isObj(p) && (Array.isArray(p.positions) ? p.positions[0] : isObj(p.positions) ? Object.keys(p.positions)[0] : null) === 'GK').length;
    if (squad.players.length >= 25 && keepers < 2) errors.push(`${file}: 25+ kişilik kadroda en az 2 kaleci olmalı`);
  }
}
