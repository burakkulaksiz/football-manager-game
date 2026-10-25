/**
 * Ham sezon verisinden denge ölçüleri. Hedef aralıkları üç kaynaktan gelir:
 *  - engine.test.ts ve NOTES.md'deki ölçülmüş / kabul edilmiş hedefler,
 *  - "referans": gerçek Süper Lig'in yaklaşık değerleri (kesin değil, yön göstermek için),
 *  - "sınır": uzun vadeli kaymayı yakalamak için kendi koyduğumuz koruma sınırları.
 * Hedef tutmayan bir ölçünün `tune` alanı nereye bakılacağını söyler.
 */
import { judge, mean, median, seMean, seProportion, slope, spearman } from './stats';
import type { MetricResult, RawData, Report, SeasonSnapshot } from './types';

type Range = readonly [number, number];

const M = 1_000_000;
/** Bir ölçüyü "hedef dışı" ilan etmek için gereken en az gözlem sayısı. */
const MIN_SAMPLES = 5;

function metric(
  group: string,
  id: string,
  label: string,
  unit: string,
  value: number,
  n: number,
  target: Range | null,
  opts: { se?: number; tune?: string; note?: string } = {},
): MetricResult {
  // Çok az örnekle "hedef dışı" demek yanıltıcı: en az MIN_SAMPLES gözlem yoksa en çok "belirsiz" denir
  const raw = judge(value, target, opts.se);
  const status = raw === 'off' && n < MIN_SAMPLES ? 'uncertain' : raw;
  return { id, group, label, value, n, unit, target, se: n < 2 ? undefined : opts.se, tune: opts.tune, note: opts.note, status };
}

/** Ortalama ölçü: değerler listesinden ortalama ve standart hata. */
function meanMetric(group: string, id: string, label: string, unit: string, values: number[], target: Range | null, opts: { tune?: string; note?: string } = {}): MetricResult {
  return metric(group, id, label, unit, mean(values), values.length, target, { ...opts, se: seMean(values) });
}

/** Oran ölçüsü (% olarak): doğru / yanlış değerlerden. */
function shareMetric(group: string, id: string, label: string, flags: boolean[], target: Range | null, opts: { tune?: string; note?: string } = {}): MetricResult {
  const k = flags.filter(Boolean).length;
  const p = flags.length === 0 ? NaN : k / flags.length;
  // Standart hata Agresti–Coull düzeltmesiyle: 0 ya da 1 oranında bile sıfır belirsizlik göstermez
  const adjusted = (k + 2) / (flags.length + 4);
  return metric(group, id, label, '%', p * 100, flags.length, target, { ...opts, se: seProportion(adjusted, flags.length + 4) * 100 });
}

const MATCH_TUNE = 'src/engine/match/engine.ts → TUNING (goalBase, homeAttack, attackChance, shotChance)';

function matchMetrics(seasons: SeasonSnapshot[]): MetricResult[] {
  const matches = seasons.flatMap((s) => s.matches);
  const g = 'Maç (Süper Lig)';
  const per = (fn: (m: (typeof matches)[number]) => number) => matches.map(fn);
  const goals = per((m) => m.homeGoals + m.awayGoals);
  return [
    meanMetric(g, 'goals', 'Maç başına gol', 'gol', goals, [2.45, 2.75], { tune: MATCH_TUNE }),
    shareMetric(g, 'homeWin', 'Ev sahibi galibiyeti', matches.map((m) => m.homeGoals > m.awayGoals), [41, 49], { tune: 'TUNING.homeAttack, homeMidfield' }),
    shareMetric(g, 'draw', 'Beraberlik', matches.map((m) => m.homeGoals === m.awayGoals), [24, 30], {
      tune: 'TUNING.goalBase (düşük gol → daha çok beraberlik); gol ortalamasını bozmadan ayarlanmalı',
      note: 'Hedef ~%27; NOTES: daha fazlası gol ortalamasını düşürüyor.',
    }),
    shareMetric(g, 'awayWin', 'Deplasman galibiyeti', matches.map((m) => m.homeGoals < m.awayGoals), [25, 33], { note: 'Referans (ev + beraberlik hedeflerinden türetildi).' }),
    meanMetric(g, 'homeAdvantage', 'Ev sahibi gol avantajı (ev − deplasman)', 'gol', per((m) => m.homeGoals - m.awayGoals), [0.2, 0.5], { tune: 'TUNING.homeAttack', note: 'Referans.' }),
    meanMetric(g, 'shots', 'Takım başına şut', 'şut', per((m) => m.shots / 2), [9, 16], { tune: 'TUNING.shotChance, attackChance' }),
    meanMetric(g, 'onTarget', 'Takım başına isabetli şut', 'şut', per((m) => m.shotsOnTarget / 2), [3, 6.5], { tune: 'TUNING.onTargetBase, blockChance' }),
    meanMetric(g, 'corners', 'Takım başına korner', 'korner', per((m) => m.corners / 2), [3.5, 7], { tune: 'TUNING.cornerShotChance, cornerFromAttack' }),
    meanMetric(g, 'fouls', 'Maç başına faul', 'faul', per((m) => m.fouls), null, { tune: 'TUNING.foulChance', note: 'Hedef yok; kart ve penaltı oranlarını etkiler.' }),
    meanMetric(g, 'yellows', 'Maç başına sarı kart', 'kart', per((m) => m.yellows), [2.5, 6], { tune: 'src/engine/squad/discipline.ts ve TUNING.foulChance' }),
    meanMetric(g, 'reds', 'Maç başına kırmızı kart', 'kart', per((m) => m.reds), [0, 0.3], { tune: 'TUNING.directRedChance' }),
    meanMetric(g, 'penalties', 'Maç başına penaltı golü', 'gol', per((m) => m.penaltyGoals), [0.15, 0.35], { tune: 'TUNING.penaltyChance', note: 'Referans (NOTES: 0,26 ölçülmüştü).' }),
    shareMetric(g, 'goalless', '0-0 biten maçlar', matches.map((m) => m.homeGoals + m.awayGoals === 0), [5, 12], { note: 'Referans.' }),
    shareMetric(g, 'highScoring', '4+ gollü maçlar', matches.map((m) => m.homeGoals + m.awayGoals >= 4), [15, 32], { note: 'Referans.' }),
  ];
}

function seasonMetrics(seasons: SeasonSnapshot[]): MetricResult[] {
  const g = 'Sezon (lig tablosu)';
  const byPos = (s: SeasonSnapshot, pos: number) => s.clubs.find((c) => c.position === pos)!;
  const champion = seasons.map((s) => byPos(s, 1).points);
  // Kullanıcı kulübü ihmal edilip çöktüğü için sık sonuncu bitiyor: sonuncu yalnızca yapay zekâ kulüpleri arasından alınır
  const last = seasons.map((s) => Math.min(...s.clubs.filter((c) => c.clubId !== s.userClubId).map((c) => c.points)));
  const margin = seasons.map((s) => byPos(s, 1).points - byPos(s, 2).points);
  // Kadro gücü ile final sırası: güçlü kadro üst sıralarda mı bitiriyor (Spearman; −sıra ile)
  const corr = seasons.map((s) => spearman(s.clubs.map((c) => c.strength), s.clubs.map((c) => -c.position)));
  const strongestWins = seasons.map((s) => {
    const best = [...s.clubs].sort((a, b) => b.strength - a.strength)[0]!;
    return best.position === 1;
  });
  const distinct = new Set(seasons.map((s) => s.championId)).size;
  return [
    meanMetric(g, 'champPoints', 'Şampiyonun puanı', 'puan', champion, [72, 95], { tune: 'Takım güç farkları: src/engine/match/engine.ts (güç oranı üsleri); NOTES: şampiyon 72–95' }),
    meanMetric(g, 'lastPoints', 'Sonuncunun puanı (yapay zekâ kulüpleri)', 'puan', last, [18, 32], { note: 'Referans. Kullanıcı kulübü (ihmal edildiği için sık sonuncu) hariç.' }),
    meanMetric(g, 'titleMargin', 'Şampiyon ile ikinci arası puan farkı', 'puan', margin, null),
    meanMetric(g, 'strengthCorr', 'Kadro gücü ↔ final sırası korelasyonu (Spearman)', 'r', corr.filter((x) => !Number.isNaN(x)), [0.6, 0.92], {
      tune: 'Çok düşükse sonuçlar fazla şansa bağlı (güç farkı etkisi artırılmalı); çok yüksekse lig öngörülebilir (rastgelelik artırılmalı)',
      note: 'Güç = ilk lig maçından sonra ilk 11\'in ortalama CA\'sı.',
    }),
    shareMetric(g, 'strongestWins', 'En güçlü kadroya sahip takım şampiyon oluyor', strongestWins, [25, 75], { note: 'Referans.' }),
    metric(g, 'distinctChamps', 'Farklı şampiyon sayısı / sezon', 'oran', distinct / seasons.length, seasons.length, null, {
      note: `${distinct} farklı şampiyon, ${seasons.length} sezonda (tüm kariyerler birlikte).`,
    }),
    meanMetric(g, 'king', 'Gol kralının golü', 'gol', seasons.map((s) => s.topScorerGoals), [19, 29], { tune: 'TUNING.finishingExponent; mevki payı: POSITION_OFFSET' }),
    shareMetric(g, 'king38', 'Gol kralı 38+ gol attığı sezonlar', seasons.map((s) => s.topScorerGoals >= 38), [0, 13], { note: 'engine.test: 15 sezonda en fazla 2.' }),
    meanMetric(g, 'assistKing', 'Asist kralının asisti', 'asist', seasons.map((s) => s.topAssists), [9, 16], { note: 'NOTES: 10–15.' }),
  ];
}

function economyMetrics(seasons: SeasonSnapshot[]): MetricResult[] {
  const g = 'Ekonomi';
  const clubs = seasons.flatMap((s) => s.clubs);
  const wageShare = clubs.filter((c) => c.income12 > 0).map((c) => c.wageBudget / c.income12);
  const firstYear = Math.min(...seasons.map((x) => x.year));
  const lastYear = Math.max(...seasons.map((x) => x.year));
  const first = seasons.filter((s) => s.year === firstYear);
  const lastY = seasons.filter((s) => s.year === lastYear);
  const medBalance = (list: SeasonSnapshot[]) => median(list.flatMap((s) => s.clubs.map((c) => c.balance))) / M;
  const feePerTransfer = (list: SeasonSnapshot[]) => {
    const t = list.reduce((a, s) => a + s.transfers.count, 0);
    return t === 0 ? NaN : list.reduce((a, s) => a + s.transfers.fee, 0) / t / M;
  };
  const counts = seasons.map((s) => s.transfers.count);
  const volumes = seasons.map((s) => s.transfers.fee / M);
  return [
    shareMetric(g, 'negativeBalance', 'Sezon sonunda kasası eksi olan kulüpler', clubs.map((c) => c.balance < 0), [0, 35], {
      tune: 'src/engine/finance/finance.ts (gelir / gider oranları, yönetim harcama kuralları)',
      note: 'Sınır (kendi koruma sınırımız).',
    }),
    metric(g, 'medianBalance', 'Kulüp kasası (medyan)', '€ Mn', median(clubs.map((c) => c.balance)) / M, clubs.length, null),
    metric(g, 'wageShare', 'Maaş bütçesi / yıllık gelir (medyan)', 'oran', median(wageShare), wageShare.length, [0.4, 0.95], {
      tune: 'finance.ts: gelir kalemleri; maaş bütçesi ölçeği (worldGenerator.ts)',
      note: 'Referans: gerçek kulüplerde ~%60–80.',
    }),
    meanMetric(g, 'transferCount', 'Sezon başına transfer (bonservisli)', 'adet', counts, null),
    meanMetric(g, 'transferVolume', 'Sezon başına transfer hacmi', '€ Mn', volumes, null),
    meanMetric(g, 'transferMax', 'En pahalı transfer (sezon ortalaması)', '€ Mn', seasons.map((s) => s.transfers.maxFee / M), null),
    meanMetric(g, 'freeAndLoans', 'Sezon başına bedelsiz + kiralık hareket', 'adet', seasons.map((s) => s.transfers.free + s.transfers.loans), null),
    metric(g, 'balanceDrift', 'Kasa medyanı: son sezon / ilk sezon', 'oran', medBalance(lastY) / (medBalance(first) || NaN), lastY.length, null, {
      note: 'Para şişmesi / kuruması için: tek başına hedefi yok, "Eğilimler" tablosuna bak.',
    }),
    metric(g, 'feeDrift', 'Transfer başına bedel: son sezon / ilk sezon', 'oran', feePerTransfer(lastY) / feePerTransfer(first), lastY.length, [0.6, 1.8], {
      tune: 'Piyasa değeri ve bonservis formülleri: src/engine/transfer/market.ts',
      note: 'Sınır: uzun vadede transfer enflasyonu / deflasyonu.',
    }),
  ];
}

function talentMetrics(seasons: SeasonSnapshot[], careers: RawData['careers']): MetricResult[] {
  const g = 'Oyuncu yeteneği (uzun vade)';
  // Kariyer içi eğim (sezon başına); kariyerler arası ortalaması
  const slopes = (pick: (s: SeasonSnapshot) => number) => careers.map((c) => slope(c.seasons.map(pick))).filter((x) => !Number.isNaN(x));
  return [
    meanMetric(g, 'eliteCA', 'Kulüplerin ilk 11 ortalama CA\'sı', 'CA', seasons.map((s) => s.talent.eliteMeanCA), null),
    meanMetric(g, 'eliteSlope', 'İlk 11 ortalama CA eğimi', 'CA / sezon', slopes((s) => s.talent.eliteMeanCA), [-0.8, 0.8], {
      tune: 'src/engine/squad/development.ts, growth.ts (gelişim ve yaşlanma), academy.ts (genç akışı)',
      note: 'Sınır: güçler sezonlar boyunca şişmemeli / erimemeli.',
    }),
    meanMetric(g, 'caU22', '22 yaş altı ortalama CA', 'CA', seasons.map((s) => s.talent.caByAge.u22).filter((x) => !Number.isNaN(x)), null),
    meanMetric(g, 'caU22Slope', '22 yaş altı ortalama CA eğimi', 'CA / sezon', slopes((s) => s.talent.caByAge.u22), null, { note: 'Enflasyonun kaynağını ayırmak için: eğim hangi yaş grubunda?' }),
    meanMetric(g, 'caMidSlope', '22–28 yaş ortalama CA eğimi', 'CA / sezon', slopes((s) => s.talent.caByAge.mid), null),
    meanMetric(g, 'caO29Slope', '29+ yaş ortalama CA eğimi', 'CA / sezon', slopes((s) => s.talent.caByAge.o29), null),
    meanMetric(g, 'cohortSlope', 'Aynı oyuncular: ortalama CA eğimi (ilk sezon sonundaki lig oyuncuları)', 'CA / sezon', slopes((s) => s.cohort.meanCA), null, {
      tune: 'Eğim yukarıdaysa bireysel gelişim fazla (development.ts, growth.ts, training.ts); sıfıra yakınsa enflasyon kadro değişiminden (transfer, genç akışı, yurtdışı alımları)',
      note: 'Aynı oyuncu grubu izlenir (hangi kulüpte olursa olsun); yaşlanma etkisi dahil. Yaş eğimi ile birlikte oku.',
    }),
    meanMetric(g, 'cohortAge', 'Aynı oyuncular: ortalama yaş eğimi', 'yaş / sezon', slopes((s) => s.cohort.meanAge), null, {
      note: 'Gruba yeni oyuncu girmediği için ~+1 olmalı (emeklilik ayıklaması biraz düşürür).',
    }),
    meanMetric(g, 'maxCA', 'Ligdeki en yüksek CA', 'CA', seasons.map((s) => s.talent.maxCA), null),
    meanMetric(g, 'maxSlope', 'En yüksek CA eğimi', 'CA / sezon', slopes((s) => s.talent.maxCA), null),
    meanMetric(g, 'over150', 'CA ≥ 150 oyuncu sayısı (lig)', 'oyuncu', seasons.map((s) => s.talent.over150), null),
    meanMetric(g, 'over150Slope', 'CA ≥ 150 oyuncu sayısı eğimi', 'oyuncu / sezon', slopes((s) => s.talent.over150), null),
    meanMetric(g, 'meanAge', 'Ligde ortalama yaş', 'yaş', seasons.map((s) => s.talent.meanAge), [24, 29], { note: 'Referans.' }),
    meanMetric(g, 'ageSlope', 'Ortalama yaş eğimi', 'yaş / sezon', slopes((s) => s.talent.meanAge), [-0.3, 0.3], {
      tune: 'Emeklilik ve genç akışı: academy.ts, rollover.ts',
      note: 'Sınır.',
    }),
  ];
}

function poolMetrics(seasons: SeasonSnapshot[], careers: RawData['careers']): MetricResult[] {
  const g = 'Oyuncu havuzu (dünya büyüklüğü)';
  const slopes = (pick: (s: SeasonSnapshot) => number) => careers.map((c) => slope(c.seasons.map(pick))).filter((x) => !Number.isNaN(x));
  return [
    meanMetric(g, 'squadMean', 'Süper Lig kulübü A takım büyüklüğü (ortalama)', 'oyuncu', seasons.map((s) => s.pool.squadMean), [23, 29], {
      tune: 'src/engine/transfer/ai.ts (MIN_AI_SQUAD, fillAiDepth), season/rollover.ts (AI_RENEW_RANK, AI_SQUAD_LIMIT)',
      note: 'Kadrolar küçülürse yedek oyuncular gider ve ligin ortalama yeteneği yapay yükselir.',
    }),
    meanMetric(g, 'squadMin', 'En küçük Süper Lig kadrosu', 'oyuncu', seasons.map((s) => s.pool.squadMin), [20, 99], { note: 'Sınır: MIN_SQUAD_TO_SELL = 20; altına inen kadro maç kadrosu kuramayabilir.' }),
    meanMetric(g, 'freeAgents', 'Serbest oyuncu havuzu (sezon sonu)', 'oyuncu', seasons.map((s) => s.pool.freeAgents), [0, 350], {
      tune: 'ai.ts: fillAiDepth (yedek tamamlama), rollover.ts: retirementChance (serbest yaşlılar)',
      note: 'Sınır. Havuz sürekli büyürse işsiz oyuncular birikiyor demektir.',
    }),
    // Havuz sıfırdan başlar; ilk sezonlar geçiş dönemidir. Eğim yalnızca uzun koşularda (≥ 6 sezon) ve son 4 sezondan yargılanır
    meanMetric(g, 'freeAgentsSlope', 'Serbest oyuncu havuzu eğimi (son 4 sezon)', 'oyuncu / sezon',
      careers.map((c) => slope(c.seasons.slice(-4).map((s) => s.pool.freeAgents))).filter((x) => !Number.isNaN(x)),
      careers.every((c) => c.seasons.length >= 6) ? [-20, 25] : null,
      { note: 'Sınır: havuz doymalı. 6 sezondan kısa koşularda hedefsiz (başlangıçtaki yükseliş geçiş dönemidir; 10 sezonda yaklaşık 250 oyuncuda doyar).' }),
    meanMetric(g, 'academyPool', 'Altyapı havuzu (sezon sonu)', 'oyuncu', seasons.map((s) => s.pool.academy), null),
    meanMetric(g, 'worldSlope', 'Dünyadaki toplam oyuncu sayısı eğimi', 'oyuncu / sezon', slopes((s) => s.pool.total), null, { note: 'Süregelen büyüme hem yavaşlık hem bellek demektir.' }),
  ];
}

function europeMetrics(seasons: SeasonSnapshot[]): MetricResult[] {
  const g = 'Avrupa (Türk kulüpleri)';
  const out: MetricResult[] = [];
  for (const comp of ['cl', 'el'] as const) {
    const rows = seasons.flatMap((s) => s.europe.filter((e) => e.comp === comp));
    const name = comp === 'cl' ? 'Şampiyonlar Ligi' : 'Avrupa Ligi';
    const clubs = rows.reduce((a, r) => a + r.turkishClubs, 0);
    const ko = rows.reduce((a, r) => a + r.turkishKnockout, 0);
    out.push(
      metric(g, `${comp}Knockout`, `${name}: gruptan çıkan Türk kulübü oranı`, '%', clubs === 0 ? NaN : (ko / clubs) * 100, clubs, null, {
        se: clubs === 0 ? undefined : seProportion(ko / clubs, clubs) * 100,
        note: 'Hedef yok; NOTES: ŞL\'de Türk kulüpleri çoğunlukla 3.–4., AL\'de ara sıra gruptan çıkar.',
      }),
      shareMetric(g, `${comp}Final`, `${name}: Türk finalisti olan sezonlar`, rows.map((r) => r.turkishFinalists > 0), null),
      shareMetric(g, `${comp}Win`, `${name}: Türk şampiyonu olan sezonlar`, rows.map((r) => r.turkishWinner), null),
    );
  }
  return out;
}

function boardMetrics(raw: RawData, seasons: SeasonSnapshot[]): MetricResult[] {
  const g = 'Yönetim (kullanıcı kulübü, varsayılan taktikle otomatik)';
  // Aynı sezonda birden çok kovulma tek sayılır (kariyer yapay sürdürüldüğü için art arda tekrarlanabiliyor)
  const sackedSeasons = new Set(raw.careers.flatMap((c) => c.sacks.map((s) => `${c.career}:${s.year}`)));
  const flags = raw.careers.flatMap((c) => c.seasons.map((s) => sackedSeasons.has(`${c.career}:${s.year}`)));
  return [
    shareMetric(g, 'sackedSeasons', 'En az bir kez görevden alınılan sezonlar', flags, null, {
      note: 'Kullanıcı kulübü İHMAL EDİLİYOR (sözleşme yenilemez, transfer yapmaz, varsayılan taktik): sezonlar ilerledikçe düşer. Bu ölçü kulübün ihmal altında ne kadar dayandığını gösterir, gerçek oyundaki oranı değil. Kovulma sonrası kariyer yapay sürdürülür.',
    }),
    shareMetric(g, 'sackedCareers', 'En az bir kez görevden alınan kariyerler', raw.careers.map((c) => c.sacks.length > 0), null),
    shareMetric(g, 'targetMet', 'Yönetim hedefi tutturuldu (sıra ≤ hedef)', seasons.map((s) => s.userPosition <= s.userTarget), [30, 75], {
      tune: 'src/engine/season/expectation.ts (beklenti → hedef sıra) ve takım güç dengesi',
      note: 'Sınır: otomatik oynayan kulüp için hedefler ne imkânsız ne bedava olmalı. Başlangıç kulüpleri çeşitli.',
    }),
    meanMetric(g, 'positionVsTarget', 'Final sırası − hedef sıra (negatif = hedefin üstünde)', 'sıra', seasons.map((s) => s.userPosition - s.userTarget), null),
  ];
}

export function computeMetrics(raw: RawData): MetricResult[] {
  const seasons = raw.careers.flatMap((c) => c.seasons);
  if (seasons.length === 0) return [];
  return [
    ...matchMetrics(seasons),
    ...seasonMetrics(seasons),
    ...economyMetrics(seasons),
    ...talentMetrics(seasons, raw.careers),
    ...poolMetrics(seasons, raw.careers),
    ...europeMetrics(seasons),
    ...boardMetrics(raw, seasons),
  ];
}

/** Sezon sırasına göre (kariyerler arası ortalama) eğilimler: kayma gözle de görülsün. */
function computeTrends(raw: RawData): Report['trends'] {
  const maxLen = Math.max(0, ...raw.careers.map((c) => c.seasons.length));
  const seasonAt = (i: number) => raw.careers.map((c) => c.seasons[i]).filter((s): s is SeasonSnapshot => s !== undefined);
  const series = (id: string, label: string, unit: string, fn: (list: SeasonSnapshot[]) => number) => ({
    id,
    label,
    unit,
    values: Array.from({ length: maxLen }, (_, i) => fn(seasonAt(i))),
  });
  const matches = (list: SeasonSnapshot[]) => list.flatMap((s) => s.matches);
  return [
    series('goals', 'Maç başına gol', 'gol', (l) => mean(matches(l).map((m) => m.homeGoals + m.awayGoals))),
    series('draw', 'Beraberlik', '%', (l) => mean(matches(l).map((m) => (m.homeGoals === m.awayGoals ? 100 : 0)))),
    series('homeWin', 'Ev sahibi galibiyeti', '%', (l) => mean(matches(l).map((m) => (m.homeGoals > m.awayGoals ? 100 : 0)))),
    series('champ', 'Şampiyonun puanı', 'puan', (l) => mean(l.map((s) => s.clubs.find((c) => c.position === 1)!.points))),
    series('elite', 'İlk 11 ortalama CA', 'CA', (l) => mean(l.map((s) => s.talent.eliteMeanCA))),
    series('maxCA', 'En yüksek CA', 'CA', (l) => mean(l.map((s) => s.talent.maxCA))),
    series('caU22', '22 yaş altı ort. CA', 'CA', (l) => mean(l.map((s) => s.talent.caByAge.u22))),
    series('cohort', 'Aynı oyuncular ort. CA', 'CA', (l) => mean(l.map((s) => s.cohort.meanCA))),
    series('caMid', '22–28 yaş ort. CA', 'CA', (l) => mean(l.map((s) => s.talent.caByAge.mid))),
    series('caO29', '29+ yaş ort. CA', 'CA', (l) => mean(l.map((s) => s.talent.caByAge.o29))),
    series('age', 'Ortalama yaş', 'yaş', (l) => mean(l.map((s) => s.talent.meanAge))),
    series('balance', 'Kasa medyanı', '€ Mn', (l) => median(l.flatMap((s) => s.clubs.map((c) => c.balance))) / M),
    series('squad', 'Süper Lig kadro büyüklüğü', 'oyuncu', (l) => mean(l.map((s) => s.pool.squadMean))),
    series('free', 'Serbest oyuncu havuzu', 'oyuncu', (l) => mean(l.map((s) => s.pool.freeAgents))),
    series('transfers', 'Transfer hacmi', '€ Mn', (l) => mean(l.map((s) => s.transfers.fee)) / M),
  ];
}

export function buildReport(raw: RawData, generatedAt = new Date().toISOString()): Report {
  const notes: string[] = [];
  const sacks = raw.careers.flatMap((c) => c.sacks);
  if (sacks.length > 0) {
    notes.push(`${sacks.length} görevden alınma olayı (kariyer yapay sürdürüldü). İlk ${Math.min(12, sacks.length)}: ${sacks.slice(0, 12).map((s) => `${s.clubId} ${s.date} — ${s.reason}`).join(' | ')}`);
  }
  const seasons = raw.careers.reduce((a, c) => a + c.seasons.length, 0);
  const matchCount = raw.careers.reduce((a, c) => a + c.seasons.reduce((b, s) => b + s.matches.length, 0), 0);
  notes.push(`${raw.careers.length} kariyer × ${raw.config.seasons} sezon = ${seasons} sezon, ${matchCount} lig maçı.`);
  if (seasons < 20) notes.push('Örnek küçük (< 20 sezon): sezon düzeyindeki ölçüler (şampiyon puanı, gol kralı, kadro-sıra ilişkisi, ekonomi) gürültülü; maç düzeyindeki ölçüler daha güvenilir. Daha fazla kariyer için BALANCE_CAREERS / BALANCE_SEASONS.');
  return { generatedAt, config: raw.config, elapsedSec: raw.elapsedSec, metrics: computeMetrics(raw), trends: computeTrends(raw), notes };
}
