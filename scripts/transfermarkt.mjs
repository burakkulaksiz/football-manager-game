// Transfermarkt'tan gerçek kadroları data/squads/<kulüpId>.json dosyalarına aktarır (kişisel kullanım).
//
//   node scripts/transfermarkt.mjs              → tüm kulüpler (Süper Lig + 1. Lig)
//   node scripts/transfermarkt.mjs galatasaray  → yalnızca verilen kulüp(ler)
//   node scripts/transfermarkt.mjs --info       → yeni kulüpler için stadyum / kapasite / kadro değeri (clubs.json'a elle)
//
// İndirilen sayfalar scripts/.cache/ altında saklanır (24 saat); istekler arasında birkaç saniye beklenir.
// Güç (ability, 1–20) piyasa değeri ve yaştan tahmin edilir: oyunun piyasa değeri formülünün tersi (player.ts marketValue).
// Dosyalar her çalıştırmada baştan yazılır; elle düzeltme yapacaksan betiği o kulüp için yeniden çalıştırma.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', '.cache');
const SEASON = 2026;
const HOST = 'https://www.transfermarkt.com.tr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DELAY_MS = 3500;

/** Transfermarkt kulüp kimliği → oyundaki kulüp kimliği. */
const CLUBS = {
  141: 'galatasaray', 36: 'fenerbahce', 114: 'besiktas', 449: 'trabzonspor', 6890: 'basaksehir',
  152: 'samsunspor', 1467: 'goztepe', 2293: 'konyaspor', 7160: 'eyupspor', 10484: 'kasimpasa',
  11282: 'alanyaspor', 2832: 'gaziantep', 126: 'rizespor', 120: 'kocaelispor', 820: 'genclerbirligi',
  37951: 'corum', 12382: 'amed', 39722: 'erzurumspor',
  589: 'antalyaspor', 3205: 'kayserispor', 6646: 'karagumruk', 20: 'bursaspor', 44006: 'bodrum',
  74664: 'igdir', 45269: 'erokspor', 924: 'istanbulspor', 3211: 'batman-petrolspor', 2381: 'sivasspor',
  48913: 'manisa', 3173: 'vanspor', 2378: 'muglaspor', 3209: 'pendikspor', 20760: 'bandirmaspor',
  24245: 'umraniyespor', 68377: 'mardin', 518: 'sariyer', 12388: 'keciorengucu', 3207: 'boluspor',
};

const POSITIONS = {
  'Kaleci': ['GK'], 'Stoper': ['DC'], 'Sol Bek': ['DL'], 'Sağ Bek': ['DR'],
  'Defansif Orta Saha': ['DM'], 'Merkez Orta Saha': ['MC'], 'Ofansif Orta Saha': ['AMC'],
  'Sol Orta Saha': ['ML'], 'Sağ Orta Saha': ['MR'], 'Sol Kanat': ['AML'], 'Sağ Kanat': ['AMR'],
  'Ön Libero': ['DM'], 'On Numara': ['AMC'], 'Santrfor': ['ST'], 'Santrafor': ['ST'], 'Forvet': ['ST'],
  'İkinci Forvet': ['ST', 'AMC'], 'Forvet Arkası': ['AMC', 'ST'], 'Orta Saha': ['MC'], 'Orta Saha Sağ': ['MR'], 'Orta Saha Sol': ['ML'],
  'Defans': ['DC'], 'Kanat': ['AMR'],
};
const FEET = { 'Sağ ayak': 'right', 'Sol ayak': 'left', 'İki ayaklı': 'both' };
const MONTHS = { Oca: 1, Şub: 2, Mar: 3, Nis: 4, May: 5, Haz: 6, Tem: 7, Ağu: 8, Eyl: 9, Eki: 10, Kas: 11, Ara: 12 };

const nations = JSON.parse(readFileSync(join(ROOT, 'data', 'nations.json'), 'utf8'));
const nationByName = new Map(nations.map((n) => [n.name, n.code]));
/** Transfermarkt'ın Türkçe adı nations.json'dakinden farklı olanlar. */
const NATION_ALIASES = {
  'Çek Cumhuriyeti': 'CZE', 'Birlesik Arap Emirlikleri': 'UAE', 'Curacao': 'CUW', 'Martinique': 'MTQ',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

/** Sayfa (önbellekten ya da curl ile; Node fetch'i bazen engelleniyor). */
async function page(path) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, path.replace(/[^a-z0-9]+/gi, '_') + '.html');
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 24 * 3600 * 1000) return readFileSync(file, 'utf8');
  const wait = lastRequest + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const html = execFileSync('curl', ['-s', '--fail', '-A', UA, '-H', 'Accept-Language: tr-TR,tr;q=0.9', HOST + path], { encoding: 'utf8', maxBuffer: 20e6 });
  writeFileSync(file, html);
  return html;
}

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function parseDate(s) {
  const m = /(\d{1,2}) (\S+) (\d{4})/.exec(s);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** "13.00 mil. €" / "850 bin €" → €. */
function parseValue(s) {
  const m = /([\d.,]+)\s*(mil\.|bin)?/.exec(s.replace(/\s+/g, ' '));
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return m[2] === 'mil.' ? n * 1e6 : m[2] === 'bin' ? n * 1e3 : n;
}

function ageOn(birth, date) {
  const age = Number(date.slice(0, 4)) - Number(birth.slice(0, 4));
  return date.slice(5) < birth.slice(5) ? age - 1 : age;
}

/**
 * Piyasa değeri hücumcuları pahalı, kaleci ve defansı ucuz gösterir: aynı düzeydeki oyuncular için mevki payı
 * (Süper Lig ilk 11'lerinde ölçüldü: kaleci 12,5 / defans 12,8 / orta saha 13,0 / hücum 13,7).
 */
const POSITION_OFFSET = { GK: 1.4, DC: 0.6, DL: 0.45, DR: 0.45, DM: 0.2, MC: 0.2, ML: 0.2, MR: 0.2, AMC: 0.3, AML: -0.25, AMR: -0.25, ST: -0.25 };
/**
 * Transfermarkt'ta büyüklerle küçükler arasındaki değer farkı oyunun ölçeğinden geniş: seviyeler bu noktanın
 * çevresinde sıkıştırılır (maç istatistikleri — gol ortalaması, beraberlik, gol kralı — üretilen kadrolarla benzer kalsın).
 */
const LEVEL_PIVOT = 12.5;
const LEVEL_SPREAD = 0.72;

/**
 * Piyasa değerinden güç (1–20): oyunda değer = 1500 × e^(etkin yetenek / 17), 29 yaştan sonra yılda ×0.82,
 * gençlerde potansiyelin bir kısmı etkin yeteneğe eklenir. Bunun tersi → yetenek (CA) → seviye; sonra mevki payı ve
 * sıkıştırma.
 */
export function abilityFromValue(value, age, position = 'MC') {
  // Değeri olmayan (genelde altyapıdan yeni çıkmış) oyuncu 150 bin € sayılır
  let ca = 17 * Math.log(Math.max(value ?? 150_000, 10_000) / 1500);
  if (age > 29) ca += 17 * (age - 29) * -Math.log(0.82);
  const youth = Math.max(0, Math.min(1, (24 - age) / 7)) * 0.6;
  ca -= Math.max(0, 27 - age) * 3 * youth;
  const raw = 1 + ((ca - 1) * 19) / 199 - 0.3 + (POSITION_OFFSET[position] ?? 0);
  const level = LEVEL_PIVOT + (raw - LEVEL_PIVOT) * LEVEL_SPREAD;
  return Math.round(Math.max(4, Math.min(19.5, level)) * 10) / 10;
}

function parseSquad(html, today) {
  const start = html.indexOf('<table class="items">');
  if (start < 0) throw new Error('Kadro tablosu bulunamadı');
  const body = html.slice(start, html.indexOf('</table>', html.indexOf('</tbody>', start)) + 8);
  const rows = body.split(/<tr class="(?:odd|even)">/).slice(1);
  const unknown = { nations: new Set(), positions: new Set() };
  const players = [];
  for (const row of rows) {
    const number = Number(text(/rn_nummer>([^<]*)</.exec(row)?.[1] ?? '')) || undefined;
    const name = text(/<td class="hauptlink">\s*<a [^>]*>([\s\S]*?)<\/a>/.exec(row)?.[1] ?? '').replace(/\s*$/, '');
    const position = text(/<\/tr>\s*<tr>\s*<td>\s*([^<]+?)\s*<\/td>/.exec(row)?.[1] ?? '');
    const centred = [...row.matchAll(/<td class="zentriert">([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    const born = parseDate(text(centred[0] ?? ''));
    const nationalities = [...(centred[1] ?? '').matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
    const foot = FEET[text(centred[3] ?? '')];
    const joined = parseDate(text(centred[4] ?? ''));
    const contract = parseDate(text(centred[6] ?? ''));
    const value = parseValue(text(/<td class="rechts hauptlink">([\s\S]*?)<\/td>/.exec(row)?.[1] ?? ''));
    if (!name || !born) continue;

    // İlk uyruk (Transfermarkt'ta milli takımı) esas; bilinmiyorsa ikinciye geçilmez, raporlanır
    const nationality = NATION_ALIASES[nationalities[0]] ?? nationByName.get(nationalities[0]);
    if (!nationality) unknown.nations.add(nationalities[0] ?? '?');
    const positions = POSITIONS[position];
    if (!positions) unknown.positions.add(position);
    const parts = name.split(' ');
    const player = {
      firstName: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
      lastName: parts[parts.length - 1],
      born,
      nationality: nationality ?? `?${nationalities[0] ?? ''}`,
      positions: positions ?? ['MC'],
      ability: abilityFromValue(value, ageOn(born, today), positions?.[0]),
    };
    if (number) player.number = number;
    if (foot) player.foot = foot;
    if (joined) player.joined = joined;
    if (contract) player.contractExpires = contract;
    if (value) player.marketValue = value;
    players.push(player);
  }
  // Aynı forma numarası iki oyuncuda olmasın (kiralıktan dönenler); ikincisinin numarası düşer
  const used = new Set();
  for (const p of players) {
    if (p.number === undefined) continue;
    if (used.has(p.number)) delete p.number;
    else used.add(p.number);
  }
  return { players, unknown };
}

async function main() {
  const args = process.argv.slice(2);
  const info = args.includes('--info');
  const only = args.filter((a) => !a.startsWith('--'));
  const today = `${SEASON}-07-01`;
  const clubs = [];
  for (const league of ['TR1', 'TR2']) {
    const html = await page(`/x/startseite/wettbewerb/${league}/saison_id/${SEASON}`);
    for (const m of html.matchAll(/<td class="hauptlink no-border-links"><a title="([^"]+)" href="\/([^/]+)\/startseite\/verein\/(\d+)/g)) {
      clubs.push({ tmName: m[1].trim(), slug: m[2], tmId: Number(m[3]), id: CLUBS[m[3]], league });
    }
  }
  const missingNations = new Map();
  for (const club of clubs) {
    if (!club.id) {
      console.warn(`Eşleşmeyen kulüp: ${club.tmName} (${club.tmId}) — CLUBS tablosuna ekle`);
      continue;
    }
    if (only.length > 0 && !only.includes(club.id)) continue;
    if (info) {
      const html = await page(`/${club.slug}/startseite/verein/${club.tmId}/saison_id/${SEASON}`);
      const stadium = text(/Stadyum:[\s\S]*?<a[^>]*>([^<]+)<\/a>/.exec(html)?.[1] ?? '?');
      const seats = text(/Stadyum:[\s\S]*?<span class="tabellenplatz">([^<]+)<\/span>/.exec(html)?.[1] ?? '?');
      const total = text(/data-header__market-value-wrapper">([\s\S]*?)<\/a>/.exec(html)?.[1] ?? '?');
      console.log(`${club.id} | ${club.tmName} | ${club.league} | ${stadium} | ${seats} | ${total}`);
      continue;
    }
    const html = await page(`/${club.slug}/kader/verein/${club.tmId}/saison_id/${SEASON}/plus/1`);
    const { players, unknown } = parseSquad(html, today);
    for (const n of unknown.nations) missingNations.set(n, [...(missingNations.get(n) ?? []), club.id]);
    if (unknown.positions.size > 0) console.warn(`${club.id}: bilinmeyen mevki ${[...unknown.positions].join(', ')}`);
    const file = join(ROOT, 'data', 'squads', `${club.id}.json`);
    mkdirSync(dirname(file), { recursive: true });
    // Oyuncu başına bir satır: elle düzenlemesi kolay olsun
    const source = JSON.stringify(`Transfermarkt ${SEASON}/${String(SEASON + 1).slice(2)}`);
    writeFileSync(file, `{\n  "source": ${source},\n  "players": [\n${players.map((p) => '    ' + JSON.stringify(p)).join(',\n')}\n  ]\n}\n`);
    console.log(`${club.id}: ${players.length} oyuncu`);
  }
  if (missingNations.size > 0) {
    console.warn('\nnations.json\'da olmayan uyruklar (oyuncularda "?Ad" yazıldı; ülkeyi ekleyip betiği yeniden çalıştır):');
    for (const [n, ids] of missingNations) console.warn(`  ${n}: ${[...new Set(ids)].join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
