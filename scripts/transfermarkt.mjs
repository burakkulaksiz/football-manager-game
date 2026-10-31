// Transfermarkt'tan gerçek kadroları data/squads/<kulüpId>.json dosyalarına aktarır (kişisel kullanım).
//
//   node scripts/transfermarkt.mjs              → tüm kulüpler (Süper Lig + 1. Lig)
//   node scripts/transfermarkt.mjs galatasaray  → yalnızca verilen kulüp(ler)
//   node scripts/transfermarkt.mjs --info       → yeni kulüpler için stadyum / kapasite / kadro değeri (clubs.json'a elle)
//   node scripts/transfermarkt.mjs --foreign    → yurtdışı ligleri (8 ülke): kadrolar + data/foreign_clubs.json
//   node scripts/transfermarkt.mjs --foreign arsenal → yalnızca o kulübün kadrosu (kulüp listesi yine yazılır)
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

/** Yurtdışı ligleri (Transfermarkt kodu → nations.json ülke kodu): `--foreign` ile çekilir. */
const FOREIGN_LEAGUES = { GB1: 'ENG', ES1: 'ESP', L1: 'GER', IT1: 'ITA', FR1: 'FRA', PO1: 'POR', NL1: 'NED', BE1: 'BEL' };

/**
 * Yurtdışı kulüpleri: Transfermarkt kimliği → [oyundaki kimlik, ad, kısa ad, şehir, birinci renk, ikinci renk].
 * Renkler ve şehirler Transfermarkt'ta yok, elle. data/foreign_clubs.json'da zaten olan kulübün adı, şehri, renkleri,
 * stadyumu, itibarı ve bütçeleri korunur (elle ayarlandı); yalnızca yeni kulüpler bu tablodan ve kadro değerinden kurulur.
 */
const FOREIGN = {
  // İngiltere
  281: ['man-city', 'Manchester City', 'MCI', 'Manchester', '#6CABDD', '#FFFFFF'],
  11: ['arsenal', 'Arsenal', 'ARS', 'Londra', '#EF0107', '#FFFFFF'],
  631: ['chelsea', 'Chelsea', 'CHE', 'Londra', '#034694', '#FFFFFF'],
  31: ['liverpool', 'Liverpool', 'LIV', 'Liverpool', '#C8102E', '#FFFFFF'],
  985: ['man-utd', 'Manchester United', 'MUN', 'Manchester', '#DA291C', '#000000'],
  148: ['tottenham', 'Tottenham Hotspur', 'TOT', 'Londra', '#FFFFFF', '#132257'],
  762: ['newcastle', 'Newcastle United', 'NEW', 'Newcastle', '#241F20', '#FFFFFF'],
  1237: ['brighton', 'Brighton & Hove Albion', 'BHA', 'Brighton', '#0057B8', '#FFFFFF'],
  1148: ['brentford', 'Brentford', 'BRE', 'Londra', '#E30613', '#FFFFFF'],
  405: ['aston-villa', 'Aston Villa', 'AVL', 'Birmingham', '#670E36', '#95BFE5'],
  989: ['bournemouth', 'Bournemouth', 'BOU', 'Bournemouth', '#DA291C', '#000000'],
  873: ['crystal-palace', 'Crystal Palace', 'CRY', 'Londra', '#1B458F', '#C4122E'],
  703: ['nottingham-forest', 'Nottingham Forest', 'NFO', 'Nottingham', '#DD0000', '#FFFFFF'],
  289: ['sunderland', 'Sunderland', 'SUN', 'Sunderland', '#EB172B', '#FFFFFF'],
  399: ['leeds', 'Leeds United', 'LEE', 'Leeds', '#FFFFFF', '#1D428A'],
  29: ['everton', 'Everton', 'EVE', 'Liverpool', '#003399', '#FFFFFF'],
  931: ['fulham', 'Fulham', 'FUL', 'Londra', '#FFFFFF', '#000000'],
  677: ['ipswich', 'Ipswich Town', 'IPS', 'Ipswich', '#3A64A3', '#FFFFFF'],
  990: ['coventry', 'Coventry City', 'COV', 'Coventry', '#59CBE8', '#FFFFFF'],
  3008: ['hull', 'Hull City', 'HUL', 'Hull', '#F5A12D', '#000000'],
  // İspanya
  418: ['real-madrid', 'Real Madrid', 'RMA', 'Madrid', '#FFFFFF', '#FEBE10'],
  131: ['barcelona', 'Barcelona', 'BAR', 'Barselona', '#A50044', '#004D98'],
  13: ['atletico-madrid', 'Atlético Madrid', 'ATM', 'Madrid', '#CB3524', '#FFFFFF'],
  1050: ['villarreal', 'Villarreal', 'VIL', 'Villarreal', '#FFE667', '#005187'],
  681: ['real-sociedad', 'Real Sociedad', 'RSO', 'San Sebastián', '#0067B1', '#FFFFFF'],
  150: ['real-betis', 'Real Betis', 'BET', 'Sevilla', '#00954C', '#FFFFFF'],
  621: ['athletic-bilbao', 'Athletic Bilbao', 'ATH', 'Bilbao', '#EE2523', '#FFFFFF'],
  940: ['celta-vigo', 'Celta Vigo', 'CEL', 'Vigo', '#8AC3EE', '#FFFFFF'],
  368: ['sevilla', 'Sevilla', 'SEV', 'Sevilla', '#FFFFFF', '#D81E05'],
  1049: ['valencia', 'Valencia', 'VAL', 'Valencia', '#FFFFFF', '#000000'],
  714: ['espanyol', 'Espanyol', 'ESP', 'Barselona', '#007FC8', '#FFFFFF'],
  897: ['deportivo', 'Deportivo La Coruña', 'DEP', 'A Coruña', '#1B5BA6', '#FFFFFF'],
  630: ['racing-santander', 'Racing Santander', 'RAC', 'Santander', '#FFFFFF', '#00843D'],
  367: ['rayo-vallecano', 'Rayo Vallecano', 'RAY', 'Madrid', '#FFFFFF', '#E53027'],
  3709: ['getafe', 'Getafe', 'GET', 'Getafe', '#005999', '#FFFFFF'],
  3368: ['levante', 'Levante', 'LEV', 'Valencia', '#004D98', '#B4053F'],
  331: ['osasuna', 'Osasuna', 'OSA', 'Pamplona', '#D91A21', '#0A346F'],
  1531: ['elche', 'Elche', 'ELC', 'Elche', '#FFFFFF', '#05642C'],
  1108: ['alaves', 'Alavés', 'ALA', 'Vitoria-Gasteiz', '#0761AF', '#FFFFFF'],
  1084: ['malaga', 'Málaga', 'MAL', 'Málaga', '#0B5CAA', '#FFFFFF'],
  // Almanya
  27: ['bayern', 'Bayern Münih', 'FCB', 'Münih', '#DC052D', '#FFFFFF'],
  16: ['dortmund', 'Borussia Dortmund', 'BVB', 'Dortmund', '#FDE100', '#000000'],
  15: ['leverkusen', 'Bayer Leverkusen', 'B04', 'Leverkusen', '#E32221', '#000000'],
  23826: ['leipzig', 'RB Leipzig', 'RBL', 'Leipzig', '#FFFFFF', '#DD0741'],
  79: ['stuttgart', 'VfB Stuttgart', 'VFB', 'Stuttgart', '#FFFFFF', '#E32219'],
  24: ['frankfurt', 'Eintracht Frankfurt', 'SGE', 'Frankfurt', '#E1000F', '#000000'],
  533: ['hoffenheim', 'Hoffenheim', 'TSG', 'Sinsheim', '#1C63B7', '#FFFFFF'],
  60: ['freiburg', 'SC Freiburg', 'SCF', 'Freiburg', '#E2001A', '#000000'],
  167: ['augsburg', 'Augsburg', 'FCA', 'Augsburg', '#BA3733', '#FFFFFF'],
  39: ['mainz', 'Mainz 05', 'M05', 'Mainz', '#C3141E', '#FFFFFF'],
  3: ['koln', 'Köln', 'KOE', 'Köln', '#FFFFFF', '#ED1C24'],
  41: ['hamburg', 'Hamburger SV', 'HSV', 'Hamburg', '#FFFFFF', '#0A3F86'],
  18: ['gladbach', 'Borussia Mönchengladbach', 'BMG', 'Mönchengladbach', '#FFFFFF', '#00B140'],
  86: ['werder-bremen', 'Werder Bremen', 'SVW', 'Bremen', '#1D9053', '#FFFFFF'],
  89: ['union-berlin', 'Union Berlin', 'FCU', 'Berlin', '#EB1923', '#FFFFFF'],
  33: ['schalke', 'Schalke 04', 'S04', 'Gelsenkirchen', '#004D9D', '#FFFFFF'],
  64: ['elversberg', 'Elversberg', 'SVE', 'Spiesen-Elversberg', '#000000', '#FFFFFF'],
  127: ['paderborn', 'Paderborn', 'SCP', 'Paderborn', '#005CA9', '#000000'],
  // İtalya
  46: ['inter', 'Inter', 'INT', 'Milano', '#0068A8', '#000000'],
  506: ['juventus', 'Juventus', 'JUV', 'Torino', '#000000', '#FFFFFF'],
  1047: ['como', 'Como', 'COM', 'Como', '#1E3D7B', '#FFFFFF'],
  5: ['milan', 'Milan', 'MIL', 'Milano', '#FB090B', '#000000'],
  12: ['roma', 'Roma', 'ROM', 'Roma', '#8E1F2F', '#F0BC42'],
  800: ['atalanta', 'Atalanta', 'ATA', 'Bergamo', '#1E71B8', '#000000'],
  6195: ['napoli', 'Napoli', 'NAP', 'Napoli', '#12A0D7', '#FFFFFF'],
  430: ['fiorentina', 'Fiorentina', 'FIO', 'Floransa', '#482E92', '#FFFFFF'],
  398: ['lazio', 'Lazio', 'LAZ', 'Roma', '#87D8F7', '#FFFFFF'],
  1025: ['bologna', 'Bologna', 'BOL', 'Bologna', '#1A2F48', '#A21C26'],
  6574: ['sassuolo', 'Sassuolo', 'SAS', 'Sassuolo', '#00A752', '#000000'],
  416: ['torino', 'Torino', 'TOR', 'Torino', '#881F19', '#FFFFFF'],
  252: ['genoa', 'Genoa', 'GEN', 'Cenova', '#A31F28', '#002856'],
  410: ['udinese', 'Udinese', 'UDI', 'Udine', '#000000', '#FFFFFF'],
  130: ['parma', 'Parma', 'PAR', 'Parma', '#FFD200', '#1C4B9C'],
  1390: ['cagliari', 'Cagliari', 'CAG', 'Cagliari', '#A01F31', '#00305C'],
  607: ['venezia', 'Venezia', 'VEN', 'Venedik', '#000000', '#F47920'],
  8970: ['frosinone', 'Frosinone', 'FRO', 'Frosinone', '#FFE200', '#0047AB'],
  2919: ['monza', 'Monza', 'MON', 'Monza', '#E30613', '#FFFFFF'],
  1005: ['lecce', 'Lecce', 'LEC', 'Lecce', '#FFED00', '#E30613'],
  // Fransa
  583: ['psg', 'Paris Saint-Germain', 'PSG', 'Paris', '#004170', '#DA291C'],
  162: ['monaco', 'Monaco', 'ASM', 'Monaco', '#E7192F', '#FFFFFF'],
  667: ['strasbourg', 'Strasbourg', 'RCS', 'Strazburg', '#009FE3', '#FFFFFF'],
  1041: ['lyon', 'Lyon', 'OL', 'Lyon', '#FFFFFF', '#1F3E8C'],
  273: ['rennes', 'Rennes', 'REN', 'Rennes', '#E13327', '#000000'],
  1082: ['lille', 'Lille', 'LIL', 'Lille', '#E01E13', '#20325F'],
  826: ['lens', 'Lens', 'RCL', 'Lens', '#FFE600', '#E2001A'],
  10004: ['paris-fc', 'Paris FC', 'PFC', 'Paris', '#1B2D5B', '#8BB8E8'],
  244: ['marseille', 'Marsilya', 'OM', 'Marsilya', '#FFFFFF', '#2FAEE0'],
  417: ['nice', 'Nice', 'NIC', 'Nice', '#E30613', '#000000'],
  415: ['toulouse', 'Toulouse', 'TFC', 'Toulouse', '#6A2C91', '#FFFFFF'],
  1158: ['lorient', 'Lorient', 'FCL', 'Lorient', '#F58113', '#000000'],
  290: ['auxerre', 'Auxerre', 'AJA', 'Auxerre', '#FFFFFF', '#004C97'],
  3911: ['brest', 'Brest', 'SB29', 'Brest', '#E30613', '#FFFFFF'],
  1420: ['angers', 'Angers', 'SCO', 'Angers', '#000000', '#FFFFFF'],
  738: ['le-havre', 'Le Havre', 'HAC', 'Le Havre', '#87CEEB', '#1D3557'],
  1095: ['troyes', 'Troyes', 'EST', 'Troyes', '#005BAC', '#FFFFFF'],
  1164: ['le-mans', 'Le Mans', 'LMF', 'Le Mans', '#E2001A', '#FFD700'],
  // Portekiz
  720: ['porto', 'Porto', 'FCP', 'Porto', '#003893', '#FFFFFF'],
  294: ['benfica', 'Benfica', 'SLB', 'Lizbon', '#E10E1A', '#FFFFFF'],
  336: ['sporting', 'Sporting', 'SCP', 'Lizbon', '#008057', '#FFFFFF'],
  1075: ['braga', 'Braga', 'SCB', 'Braga', '#E3001B', '#FFFFFF'],
  3329: ['famalicao', 'Famalicão', 'FAM', 'Vila Nova de Famalicão', '#003D7C', '#FFFFFF'],
  2420: ['vitoria-guimaraes', 'Vitória Guimarães', 'VSC', 'Guimarães', '#FFFFFF', '#000000'],
  2521: ['alverca', 'Alverca', 'ALV', 'Alverca do Ribatejo', '#E30613', '#003DA5'],
  2431: ['estrela-amadora', 'Estrela Amadora', 'EAM', 'Amadora', '#E30613', '#00A651'],
  1465: ['estoril', 'Estoril', 'EST', 'Estoril', '#FFE600', '#0055A4'],
  2425: ['rio-ave', 'Rio Ave', 'RAV', 'Vila do Conde', '#00843D', '#FFFFFF'],
  8024: ['arouca', 'Arouca', 'ARO', 'Arouca', '#FFE600', '#003DA5'],
  3268: ['casa-pia', 'Casa Pia', 'CPI', 'Lizbon', '#000000', '#FFFFFF'],
  979: ['moreirense', 'Moreirense', 'MOR', 'Moreira de Cónegos', '#00843D', '#FFFFFF'],
  2424: ['gil-vicente', 'Gil Vicente', 'GIL', 'Barcelos', '#E30613', '#003DA5'],
  2423: ['santa-clara', 'Santa Clara', 'SCL', 'Ponta Delgada', '#E30613', '#FFFFFF'],
  982: ['nacional', 'Nacional', 'NAC', 'Funchal', '#000000', '#FFFFFF'],
  7788: ['academico-viseu', 'Académico Viseu', 'AVI', 'Viseu', '#000000', '#FFFFFF'],
  1301: ['maritimo', 'Marítimo', 'MAR', 'Funchal', '#E30613', '#00843D'],
  // Hollanda
  383: ['psv', 'PSV', 'PSV', 'Eindhoven', '#ED1C24', '#FFFFFF'],
  234: ['feyenoord', 'Feyenoord', 'FEY', 'Rotterdam', '#E10600', '#FFFFFF'],
  610: ['ajax', 'Ajax', 'AJA', 'Amsterdam', '#FFFFFF', '#D2122E'],
  1090: ['az', 'AZ Alkmaar', 'AZ', 'Alkmaar', '#E30613', '#FFFFFF'],
  317: ['twente', 'Twente', 'TWE', 'Enschede', '#E30613', '#FFFFFF'],
  200: ['utrecht', 'Utrecht', 'UTR', 'Utrecht', '#E30613', '#FFFFFF'],
  467: ['nec', 'NEC Nijmegen', 'NEC', 'Nijmegen', '#E30613', '#00843D'],
  306: ['heerenveen', 'Heerenveen', 'HEE', 'Heerenveen', '#0057A8', '#FFFFFF'],
  202: ['groningen', 'Groningen', 'GRO', 'Groningen', '#00843D', '#FFFFFF'],
  468: ['sparta-rotterdam', 'Sparta Rotterdam', 'SPA', 'Rotterdam', '#E30613', '#FFFFFF'],
  1269: ['pec-zwolle', 'PEC Zwolle', 'PEC', 'Zwolle', '#005CA9', '#FFFFFF'],
  1435: ['go-ahead-eagles', 'Go Ahead Eagles', 'GAE', 'Deventer', '#E30613', '#FFE600'],
  403: ['willem-ii', 'Willem II', 'WIL', 'Tilburg', '#E30613', '#003DA5'],
  798: ['excelsior', 'Excelsior', 'EXC', 'Rotterdam', '#E30613', '#000000'],
  1268: ['ado-den-haag', 'ADO Den Haag', 'ADO', 'Lahey', '#FFE600', '#00843D'],
  385: ['fortuna-sittard', 'Fortuna Sittard', 'FOR', 'Sittard', '#FFE600', '#00843D'],
  133: ['cambuur', 'Cambuur', 'CAM', 'Leeuwarden', '#FFE600', '#005CA9'],
  1434: ['telstar', 'Telstar', 'TEL', 'Velsen', '#FFFFFF', '#003DA5'],
  // Belçika
  2282: ['club-brugge', 'Club Brugge', 'CLU', 'Brugge', '#005BAB', '#000000'],
  1184: ['genk', 'Genk', 'GNK', 'Genk', '#005BAB', '#FFFFFF'],
  3948: ['union-sg', 'Union Saint-Gilloise', 'USG', 'Brüksel', '#FFE600', '#003DA5'],
  58: ['anderlecht', 'Anderlecht', 'AND', 'Brüksel', '#4C2683', '#FFFFFF'],
  157: ['gent', 'Gent', 'GNT', 'Gent', '#005BAB', '#FFFFFF'],
  3057: ['standard-liege', 'Standard Liège', 'STA', 'Liège', '#E30613', '#FFFFFF'],
  1096: ['antwerp', 'Antwerp', 'ANT', 'Anvers', '#E30613', '#FFFFFF'],
  968: ['westerlo', 'Westerlo', 'WES', 'Westerlo', '#FFE600', '#005BAB'],
  475: ['st-truiden', 'Sint-Truiden', 'STV', 'Sint-Truiden', '#FFE600', '#003DA5'],
  354: ['mechelen', 'Mechelen', 'KVM', 'Mechelen', '#FFE600', '#E30613'],
  520: ['cercle-brugge', 'Cercle Brugge', 'CER', 'Brugge', '#00843D', '#000000'],
  172: ['charleroi', 'Charleroi', 'CHA', 'Charleroi', '#000000', '#FFFFFF'],
  2727: ['oh-leuven', 'OH Leuven', 'OHL', 'Leuven', '#00843D', '#FFFFFF'],
  3508: ['zulte-waregem', 'Zulte Waregem', 'ZWA', 'Waregem', '#E30613', '#00843D'],
  5026: ['lommel', 'Lommel', 'LOM', 'Lommel', '#00843D', '#FFFFFF'],
  3901: ['la-louviere', 'La Louvière', 'RAL', 'La Louvière', '#00843D', '#FFFFFF'],
  601: ['kortrijk', 'Kortrijk', 'KVK', 'Kortrijk', '#E30613', '#FFFFFF'],
  28643: ['beveren', 'Beveren', 'BEV', 'Beveren', '#FFE600', '#003DA5'],
};

/**
 * Yeni yurtdışı kulübünün itibarı kadro değerinden: elle ayarlanmış 40 kulübe uydurulan doğru (sapma ±3,4 puan).
 * Bütçeler de değerden (Manchester City: değer 1,5 Mr → transfer 150 Mn, maaş 380 Mn).
 */
const reputationFromValue = (value) => Math.round(Math.max(40, Math.min(125, -156.6 + 13.008 * Math.log(value))));
const roundMillion = (n) => Math.round(n / 500_000) * 500_000;

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

/** "13.00 mil. €" / "45.0 Mn €" / "1.2 Mr €" / "850 bin €" / "300 Bin €" → € (site birimleri zamanla değişti). */
function parseValue(s) {
  const m = /([\d.,]+)\s*(mil\.|mn|mr|bin)?/i.exec(s.replace(/\s+/g, ' '));
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const unit = m[2]?.toLowerCase();
  return unit === 'mr' ? n * 1e9 : unit === 'mil.' || unit === 'mn' ? n * 1e6 : unit === 'bin' ? n * 1e3 : n;
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

/** Lig tablosundaki kadro değeri: "1.4 Mr €" / "57.3 Mn €" / "850 bin €" → €. */
function parseTotal(s) {
  const m = /([\d.,]+)\s*(Mr|Mn|bin)/.exec(s);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return m[2] === 'Mr' ? n * 1e9 : m[2] === 'Mn' ? n * 1e6 : n * 1e3;
}

/** Kadronun bitiminde nations.json'da olmayan uyrukları yazar. */
function reportNations(missingNations) {
  if (missingNations.size === 0) return;
  console.warn('\nnations.json\'da olmayan uyruklar (oyuncularda "?Ad" yazıldı; ülkeyi ekleyip betiği yeniden çalıştır):');
  for (const [n, ids] of missingNations) console.warn(`  ${n}: ${[...new Set(ids)].join(', ')}`);
}

function writeSquad(id, players) {
  const file = join(ROOT, 'data', 'squads', `${id}.json`);
  mkdirSync(dirname(file), { recursive: true });
  // Oyuncu başına bir satır: elle düzenlemesi kolay olsun
  const source = JSON.stringify(`Transfermarkt ${SEASON}/${String(SEASON + 1).slice(2)}`);
  writeFileSync(file, `{\n  "source": ${source},\n  "players": [\n${players.map((p) => '    ' + JSON.stringify(p)).join(',\n')}\n  ]\n}\n`);
}

/**
 * Yurtdışı ligleri: kadrolar data/squads/'a, kulüpler data/foreign_clubs.json'a. Dosyada zaten olan kulüp korunur
 * (elle ayarlandı), yeni kulüp FOREIGN tablosundan + kadro sayfasından (stadyum, kapasite) + kadro değerinden kurulur.
 */
async function foreignMain(only, today) {
  const file = join(ROOT, 'data', 'foreign_clubs.json');
  const existing = new Map(JSON.parse(readFileSync(file, 'utf8')).map((c) => [c.id, c]));
  const clubs = [];
  const missingNations = new Map();
  for (const [league, country] of Object.entries(FOREIGN_LEAGUES)) {
    const html = await page(`/x/startseite/wettbewerb/${league}/saison_id/${SEASON}`);
    const rows = [...html.matchAll(/hauptlink no-border-links"><a title="([^"]+)" href="\/([^/]+)\/startseite\/verein\/(\d+)[\s\S]*?<td class="rechts">[^<]*<\/td><td class="rechts"><a[^>]*>([^<]+)<\/a>/g)];
    const inLeague = [];
    for (const m of rows) {
      const def = FOREIGN[m[3]];
      if (!def) {
        console.warn(`Eşleşmeyen kulüp: ${m[1].trim()} (${m[3]}, ${league}) — FOREIGN tablosuna ekle`);
        continue;
      }
      inLeague.push({ tmId: Number(m[3]), slug: m[2], def, value: parseTotal(m[4]) ?? 10e6 });
    }
    // Beklenti lig içindeki değer sırasından: lider (ve ona yakın olanlar) şampiyonluk, ilk çeyrek Avrupa…
    inLeague.sort((a, b) => b.value - a.value);
    inLeague.forEach((c, rank) => {
      const share = rank / inLeague.length;
      c.expectation = rank === 0 || (rank <= 2 && c.value >= 0.6 * inLeague[0].value) ? 'title'
        : share < 0.25 ? 'europe' : share < 0.5 ? 'top_half' : share < 0.75 ? 'mid_table' : 'avoid_relegation';
    });
    for (const c of inLeague) {
      const [id, name, shortName, city, primary, secondary] = c.def;
      const kader = await page(`/${c.slug}/kader/verein/${c.tmId}/saison_id/${SEASON}/plus/1`);
      const old = existing.get(id);
      if (!old) {
        const stadium = text(/Stadyum:[\s\S]*?<a[^>]*>([^<]+)<\/a>/.exec(kader)?.[1] ?? '') || `${city} Stadyumu`;
        const seats = Number(text(/Stadyum:[\s\S]*?<span class="tabellenplatz">([^<]+)<\/span>/.exec(kader)?.[1] ?? '').replace(/\D/g, '')) || 15000;
        clubs.push({
          id, country, name, shortName, city, stadium, capacity: seats,
          reputation: reputationFromValue(c.value),
          budget: roundMillion(c.value * 0.1),
          wageBudget: roundMillion(c.value * 0.25),
          fanExpectation: c.expectation,
          colors: { primary, secondary },
        });
      } else clubs.push(old);
      if (only.length > 0 && !only.includes(id)) continue;
      const { players, unknown } = parseSquad(kader, today);
      for (const n of unknown.nations) missingNations.set(n, [...(missingNations.get(n) ?? []), id]);
      if (unknown.positions.size > 0) console.warn(`${id}: bilinmeyen mevki ${[...unknown.positions].join(', ')}`);
      writeSquad(id, players);
      console.log(`${country} ${id}: ${players.length} oyuncu${old ? '' : ` (yeni kulüp, itibar ${reputationFromValue(c.value)})`}`);
    }
  }
  // Ligden düşen (listede olmayan) eski kulüpler dosyadan çıkar; kadro dosyaları elle silinir
  for (const id of existing.keys()) if (!clubs.some((c) => c.id === id)) console.warn(`Listede olmayan eski kulüp çıkarıldı: ${id}`);
  writeFileSync(file, `[\n${clubs.map((c) => '  ' + JSON.stringify(c)).join(',\n')}\n]\n`);
  console.log(`\n${clubs.length} yurtdışı kulübü yazıldı.`);
  reportNations(missingNations);
}

async function main() {
  const args = process.argv.slice(2);
  const info = args.includes('--info');
  const only = args.filter((a) => !a.startsWith('--'));
  const today = `${SEASON}-07-01`;
  if (args.includes('--foreign')) return foreignMain(only, today);
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
    writeSquad(club.id, players);
    console.log(`${club.id}: ${players.length} oyuncu`);
  }
  reportNations(missingNations);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
