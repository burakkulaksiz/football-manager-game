/**
 * Veri denetimi (`npm run data:check`): data/ dosyalarını oyunun açılış doğrulamasından (validateGameData) geçirir, sonra
 * kadrolarda yapıca geçerli ama şüpheli kayıtları arar: imkânsız yaş / değer, ters mevki, yinelenen oyuncu, kadro büyüklüğü
 * ve mevki dengesi. Saf: dosya okumaz (betik scripts/data.mjs okur), sonuç listesini döner.
 */
import { validateGameData, type SquadData, type SquadPlayerData } from '../../engine/data';
import type { Position } from '../../engine/types';

export interface DataIssue {
  /** Hata: oyun açılmaz ya da veri kesin yanlış. Uyarı: bakılmalı, oyun yine çalışır. */
  level: 'error' | 'warning';
  /** "squads/galatasaray.json: Mauro Icardi" gibi. */
  where: string;
  text: string;
}

export interface RawData {
  clubs: unknown;
  lowerClubs: unknown;
  foreignClubs: unknown;
  nations: unknown;
  namePools: Record<string, unknown>;
  squads: Record<string, unknown>;
}

/** Gerçek A takımlar 25–38 kişi (NOTES > Gerçek kadrolar); bunun çok dışı çekimde bir şeyin eksik / fazla geldiğini gösterir. */
export const SQUAD_SIZE = { min: 20, max: 40 };
/** Asıl mevkiye göre en az oyuncu: kaleci, defans, orta saha, hücum. */
const LINE_MIN = { GK: 2, DEF: 5, MID: 5, ATT: 3 } as const;
const LINE_LABELS: Record<keyof typeof LINE_MIN, string> = { GK: 'kaleci', DEF: 'defans', MID: 'orta saha', ATT: 'hücum' };
const LINE_OF: Record<Position, keyof typeof LINE_MIN> = {
  GK: 'GK', DR: 'DEF', DC: 'DEF', DL: 'DEF', WBR: 'DEF', WBL: 'DEF',
  DM: 'MID', MR: 'MID', MC: 'MID', ML: 'MID', AMC: 'MID', AMR: 'ATT', AML: 'ATT', ST: 'ATT',
};
const AGE = { min: 15, warn: 41, max: 50 };
/** Transfermarkt'ın en pahalı oyuncusu ~200 M €; üstü ayrıştırma hatası. */
const MAX_VALUE = 300_000_000;

const fullName = (p: SquadPlayerData) => (p.firstName ? `${p.firstName} ${p.lastName}` : p.lastName);
const primary = (p: SquadPlayerData): Position =>
  (Array.isArray(p.positions) ? p.positions[0] : Object.keys(p.positions)[0]) as Position;
const positionList = (p: SquadPlayerData): Position[] =>
  (Array.isArray(p.positions) ? p.positions : Object.keys(p.positions)) as Position[];
/** Doğum ya da sözleşme alanı tarihe: yalnızca yıl verilmişse 1 Ocak (doğum) / 30 Haziran (sözleşme). */
const asDate = (v: string | number, monthDay: string) => (typeof v === 'number' ? `${v}-${monthDay}` : v);

/** 'YYYY-AA-GG' takvimde var mı (ör. 2001-02-30 yok). */
function realDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function ageOn(born: string, today: string): number {
  const age = Number(today.slice(0, 4)) - Number(born.slice(0, 4));
  return today.slice(5) < born.slice(5) ? age - 1 : age;
}

/** Bütün denetim: önce açılış doğrulaması (yapı hataları), geçerse kadroların ayrıntılı denetimi. */
export function checkData(raw: RawData, today: string): DataIssue[] {
  try {
    validateGameData(raw);
  } catch (e) {
    // Yapı hataları düzelmeden ayrıntılı denetim anlamsız (alanlar eksik / yanlış türde olabilir)
    return (e as Error).message.split('\n- ').slice(1).map((text) => ({ level: 'error', where: '', text }));
  }
  const issues = checkSquads(raw.squads as Record<string, SquadData>, today);
  // Dosyası olmayan Türkiye kulübünün kadrosu üretilir: gerçek veri eksik
  for (const club of [...(raw.clubs as { id: string }[]), ...(raw.lowerClubs as { id: string }[])]) {
    if (!raw.squads[club.id]) issues.push({ level: 'warning', where: `squads/${club.id}.json`, text: 'dosya yok; kadro rastgele üretilecek' });
  }
  return issues;
}

/** Yapıca geçerli kadrolarda şüpheli kayıtlar. */
export function checkSquads(squads: Record<string, SquadData>, today: string): DataIssue[] {
  const issues: DataIssue[] = [];
  const seen = new Map<string, string>(); // ad|doğum → ilk görüldüğü kulüp
  for (const [clubId, squad] of Object.entries(squads)) {
    const file = `squads/${clubId}.json`;
    const add = (level: DataIssue['level'], where: string, text: string) => issues.push({ level, where, text });
    const lines = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    for (const p of squad.players) {
      const where = `${file}: ${fullName(p)}`;
      if (p.lastName.trim() !== p.lastName || p.firstName.trim() !== p.firstName) add('warning', where, 'adın başında / sonunda boşluk var');

      const born = asDate(p.born, '01-01');
      if (!realDate(born)) add('error', where, `doğum tarihi takvimde yok (${born})`);
      else {
        const age = ageOn(born, today);
        if (age < AGE.min || age > AGE.max) add('error', where, `imkânsız yaş: ${age} (doğum ${born})`);
        else if (age > AGE.warn) add('warning', where, `yaşı çok büyük: ${age}`);
      }

      if (p.marketValue !== undefined && (p.marketValue <= 0 || p.marketValue > MAX_VALUE)) {
        add('error', where, `imkânsız piyasa değeri: €${p.marketValue}`);
      }
      if (p.potential !== undefined && p.potential < p.ability) add('warning', where, `potansiyel (${p.potential}) güçten (${p.ability}) düşük`);

      if (p.contractExpires !== undefined) {
        const expires = asDate(p.contractExpires, '06-30');
        if (expires < today) add('warning', where, `sözleşmesi sezon başından önce bitmiş (${expires})`);
        if (p.joined && p.joined > expires) add('error', where, `kulübe katılışı (${p.joined}) sözleşme bitişinden (${expires}) sonra`);
      }
      if (p.joined && p.joined < born) add('error', where, `kulübe katılışı (${p.joined}) doğumundan önce`);

      const positions = positionList(p);
      if (positions.length > 1 && positions.includes('GK')) add('warning', where, `ters mevki: kaleci ve oyuncu mevkisi birlikte (${positions.join(', ')})`);
      lines[LINE_OF[primary(p)]]++;

      const key = `${fullName(p).toLocaleLowerCase('tr')}|${born.slice(0, 4)}`;
      const first = seen.get(key);
      if (first === clubId) add('error', where, 'aynı kadroda iki kez');
      else if (first) add('warning', where, `squads/${first}.json kadrosunda da var (kiralık ya da eski kayıt?)`);
      else seen.set(key, clubId);
    }

    const size = squad.players.length;
    if (size < SQUAD_SIZE.min) add('warning', file, `kadro küçük: ${size} oyuncu (eksik mevkiler rastgele tamamlanır)`);
    if (size > SQUAD_SIZE.max) add('warning', file, `kadro büyük: ${size} oyuncu`);
    const missing = (Object.keys(LINE_MIN) as (keyof typeof LINE_MIN)[]).filter((l) => lines[l] < LINE_MIN[l]);
    if (missing.length > 0) {
      add('warning', file, `mevki dengesi: ${missing.map((l) => `${LINE_LABELS[l]} ${lines[l]} (en az ${LINE_MIN[l]})`).join(', ')}`);
    }
  }
  return issues;
}

/** Okunur rapor: önce hatalar, sonra uyarılar. */
export function formatIssues(issues: readonly DataIssue[], summary: string): string {
  const out = [summary];
  for (const level of ['error', 'warning'] as const) {
    const list = issues.filter((i) => i.level === level);
    out.push('', `${level === 'error' ? 'Hatalar' : 'Uyarılar'} (${list.length})`);
    for (const i of list) out.push(`  - ${i.where ? `${i.where}: ` : ''}${i.text}`);
  }
  return out.join('\n');
}
