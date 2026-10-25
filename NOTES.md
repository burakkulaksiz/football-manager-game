# Futbol Menajeri (FM 2005 tarzı) — Geliştirme Notları

Yeni bir oturumda buradan devam et. Asıl istek/kapsam: `FM_Agent_Prompt.md`.
Çalışma şekli: her aşama sonunda test + commit, kullanıcıya nasıl deneyeceğini yaz, onay bekle.

## Komutlar
- `npm run dev` — geliştirme sunucusu (http://localhost:5173)
- `npm test` — Vitest birim testleri
- `npm run typecheck` — TypeScript kontrolü
- `npm run build` — tip kontrolü + üretim derlemesi

## Yığın
TypeScript 7 (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), React 19, Vite 8,
Zustand 5, Dexie 4, Vitest 5. Router yok; ekran geçişi Zustand'daki `screen` alanıyla.

## Mimari
```
data/                  Elle düzenlenebilir JSON (bkz. "Veri formatları")
src/gameData.ts        data/ JSON'larını içe aktarır + doğrular → GameData. (names/*.json otomatik bulunur)
src/engine/            SAF TypeScript oyun motoru. React/DOM/IndexedDB'ye bağımlı OLAMAZ.
  rng.ts               Seed'li RNG (mulberry32). Tüm rastgelelik buradan; Math.random yasak.
                       Durumu tek sayı → getState()/Rng.fromState() ile kayda yazılır.
  date.ts              GameDate = 'YYYY-MM-DD' metni; UTC ile hesap; Türkçe biçimleme.
  attributes.ts        Özellik anahtarları (teknik/zihinsel/fiziksel/kaleci/gizli), 1–20.
  types.ts             Club, Player, Contract, GameWorld…
  positions.ts         14 mevki, yakın mevkiler, mevki başına özellik ağırlıkları (1–3).
  player.ts            Yaş, doğal mevkiler, CA hesabı, maaş tabanı, piyasa değeri.
  data.ts              GameData tipleri + doğrulama (Türkçe hata mesajları).
  generation/          playerGenerator (tek oyuncu), worldGenerator (tüm lig + fikstür, createWorld).
  league/schedule.ts   Çift devreli fikstür (çember yöntemi + açgözlü ev/dep), hafta tarihleri.
  league/standings.ts  Puan durumu + eşitlik kuralları.
  league/stats.ts      Gol/asist/puan sıralamaları, oyuncu sezon istatistikleri (maç kayıtlarından türetilir).
  league/cup.ts        Türkiye Kupası: turlar (CUP_ROUNDS), kura (cupDay), kazanan (fixtureWinner, penaltılar),
                       tur sonrası ödül/haber (cupAfterMatch), scoreLine, leagueFixtures (yalnızca lig: competition yok).
  league/europe.ts     Avrupa kupaları (ŞL / AL): katılım (turkishQualifiers), kuralar (europeDay), grup tablosu
                       (groupTable → standings.tableFrom), iki maçlı eşleşme (aggregateScore, tieWinner), ödüller.
  league/competitions.ts Organizasyon etiketleri: competitionName, stageLabel, fixtureLabel, shortFixtureLabel.
  league/international.ts Milli takımlar: döngü (createInternational), sanal oyuncular (virtualPool), kadro (selectSquad),
                       milli maçlar ve kamp (internationalDay), elemeler / turnuva tabloları (bkz. "Milli takımlar").
  match/state.ts       Canlı maç durumu tipleri (düz veri, serileştirilebilir), dakika gösterimi.
  match/formation.ts   10 diziliş + saha yerleşimi (FORMATION_LAYOUT), özel diziliş (slotsOf, positionAt), mevki uyumu (slotFit = yanlış mevki cezası),
                       otomatik ilk 11 + 9 yedek, chooseFormation (yapay zekâ), assignToFormation.
  match/tactics.ts     Takım talimatları + motora etkileri (instructionEffects), kullanıcı taktiği (Tactics),
                       kadro düzenleme yardımcıları (placePlayer, removePlayer, changeFormation, resolveLineup), bireysel talimat, taktik setleri.
  match/engine.ts      Dakika dakika motor: createMatch, stepMatch, substitute, setMentality, simulateToEnd,
                       buildResult. Denge sabitleri TUNING içinde.
  match/commentary.ts  Türkçe anlatım şablonları (isimden sonra ek gelmeyecek şekilde yazıldı).
  match/simulate.ts    Dünya bağlantısı: fikstür kurulumu, arka plan maçı, sonucu işleme (form güncelleme).
  match/report.ts      Maç raporu: matchTimeline (gol/kart/sakatlık sıralı), teamAppearances (giriş/çıkış dk
                       oynanan süreden türetilir; sonuçta değişiklik olayı saklanmıyor).
  gameFlow.ts          Devam: kendi maçımız varsa 'userMatch' döner (canlı), yoksa günün maçlarını oynatır
                       ya da gün gün ilerler; önemli haber çıkan günde ya da maç gününde durur.
  daily.ts             Günlük işler (processDay): ay başı finans, transfer dönemi haberleri, kiralık dönüşleri,
                       teklif yanıtları, yapay zekâ transferleri.
  news.ts              Haberler (world.news, en fazla 400). `important` = Devam'ı durdurur. 9. aşamada gelen kutusu.
  finance/finance.ts   Kulüp finansı: ay başı (maaş, yayın, sponsor), maç günü (bilet, prim), aylık raporlar.
  transfer/window.ts   Transfer dönemleri.
  transfer/market.ts   Değerleme (askingPrice, importance), maaş talebi (wageDemand, kulüp maaş ölçeği),
                       istekli mi (willingToJoin), transferPlayer, loanPlayer, returnLoans.
  transfer/offers.ts   Kullanıcı teklifleri, karşı teklif, sözleşme görüşmesi (negotiateTransfer/Renewal),
                       gelen tekliflere yanıt, günlük teklif işleme (processOffers).
  transfer/ai.ts       Yapay zekâ alımları ve kullanıcıya teklifler (aiTransferDay).
  transfer/listing.ts  Transfer / kiralık listesi: listPlayer, unlistPlayer, listedOffersDay, refreshAiListings.
  migrate.ts           Eski kayıt dönüşümü (CURRENT_WORLD_VERSION = 16; migrateWorld GameData de alır).
  squad/training.ts    Antrenman odağı/yoğunluğu ve etkileri (INTENSITY_EFFECTS, FOCUS_ATTRS).
  squad/injuries.ts    Sakatlık türleri, maç/antrenman sakatlığı, günlük iyileşme.
  squad/discipline.ts  Kart cezaları (maç sonrası).
  squad/morale.ts      Maç sonrası moral, günlük ortalamaya dönüş.
  generation/foreign.ts Yurtdışı kulüpleri: ekleme (ayrı rng), yaz genç katılımı, finans payları, bölge filtresi.
  transfer/scouting.ts Gözlemciler: oyuncu bilgisi (0–100), özellik aralıkları, görevler, raporlar, gözlemci görüşü.
  transfer/agents.ts   Oyuncu menajerleri (world.agents, agentOf), sözleşme talebi (contractDemand), oyuncunun şartlara
                       bakışı (evaluateTerms), sözleşme maddeleri (contractFromTerms), maç/gol primi ödemesi.
  squad/career.ts      Oyuncu kariyeri: sezon satırları (kulüp başına), kulüp hareketleri, toplamlar.
  squad/hierarchy.ts   Takım hiyerarşisi (etki, seviyeler), kaptan değişikliği etkileri, liderlerin havası.
  squad/talks.ts       Oyuncu görüşmeleri: talepler (playerRequests), yanıtlar, menajer görüşmeleri, forma sözü takibi.
  squad/development.ts Haftalık gelişim/gerileme (pazartesi).
  squad/condition.ts   Günlük kondisyon toparlanması.
  squad/academy.ts     Altyapı (U19): academyPlayers, promoteToFirstTeam, sendToAcademy, manageAcademies,
                       academyIntake, renewAcademyContracts, toggleWatch (takip listesi).
  squad/assistant.ts   Yardımcı antrenör: assistantAdvice (saf, yapılandırılmış öneriler; metni arayüz kurar).
  squad/growth.ts      Gelişim geçmişi (≤ 23 yaş, aylık CA; start + ca[] sıkı biçim, en fazla 36 ay), growthRate.
  season/expectation.ts Beklenti → hedef sıra, lig (division), yeni sezonda beklenti hesabı.
  season/board.ts      Yönetim güveni: maç sonrası, aylık değerlendirme, görevden alma (gameOver).
                       boardAfterMatch menajer kartının G/B/M kaydını da tutar (world.manager).
  season/seasonEnd.ts  Sezon sonu: tablo, ödüller, sıralama primi, küme düşen/çıkan seçimi, arşiv.
  season/rollover.ts   1 Mayıs uyarı, 30 Haziran sözleşmeler, 1 Temmuz yeni sezon (lig değişimi, itibar,
                       emeklilik, altyapı, kadro budama, bütçeler, fikstür).
  testing.ts           Yalnızca testler: makeResult, playSeason.
  index.ts             Motorun dışa açık yüzü + SEASON_START_DATE (2026-07-01).
src/store/gameStore.ts Zustand: phase (menu/newGame/load/game), screen + geçmiş, world, liveMatch (canlı maç),
                       maç eylemleri, taktik düzenleme (updateTactics), kayıt (saveCurrent, loadSave, otomatik kayıt),
                       revision/savedRevision (kaydedilmemiş ilerleme), notice (bildirim), worldAction (motor
                       işlemini çalıştırıp arayüzü günceller; transfer eylemleri bununla).
src/persistence/db.ts  Dexie (IndexedDB) — 'fm-super-lig' veritabanı: `saves` (liste bilgisi), `saveData` (oyun).
src/persistence/saves.ts  saveGame, autosave, loadGame, listSaves, deleteSave (testler: fake-indexeddb).
src/ui/                React. Motoru sadece çağırır, oyun mantığı içermez.
  labels.ts            Türkçe etiketler (özellik, mevki, beklenti), para/tarih biçimleri.
  squadFilters.ts      Kadro ekranı filtreleri/görünümleri (saf, testli: squadFilters.test.ts).
  layout/              GameShell, Header, NavBar, Sidebar, StatusBar, pageHeading (başlık hapı + konum yolu)
  screens/             MainMenu, NewGameScreen, SquadScreen, PlayerProfile, ClubInfoScreen,
                       FixturesScreen, TableScreen, StatsScreen, MatchScreen, TacticsScreen, TransferScreen
                       (ara / teklifler / haberler), FinanceScreen, TrainingScreen, InboxScreen, LoadGameScreen
  components/          ClubBadge, Shirt, OutcomeBox, InstructionsPanel (FormationPicker + talimatlar; taktik
                       ekranı ve maç içinde ortak), Modal (portal ile body'ye), NoticeToast, SaveDialogs,
                       TransferDialogs (OfferDialog, ContractDialog, CounterDialog), Stars, StatusTags,
                       GameOverOverlay
  styles.css           Tema; renkler CSS değişkenleri olarak (bkz. "Görünüm")
```
Testler kaynak dosyaların yanında: `src/**/*.test.ts` (node ortamı).

## Oyun modeli kararları
- **Para birimi €.** Maaşlar **yıllık** brüt tutulur ve gösterilir.
- **CA/PA 1–200 (gizli).** CA, oyuncunun asıl mevkiinin ağırlıklı özellik ortalamasından hesaplanır
  (ortalama 1 → 1, 20 → 200). PA ≥ CA; gençlerde daha fazla gelişim payı.
- **Kulüp gücü:** itibar (1–100) → taban seviye `7.5 + itibar/100*8` (1–20 ölçeğinde).
  Şablon: 25 kişi (12 "starter", 10 "backup", 3 "youth"). Bkz. `SQUAD_TEMPLATE`.
- **Mevki yatkınlığı** 1–20; 18+ doğal, 13–17 becerikli, 9–12 yeterli. Ana mevki 20.
- **Maaşlar** kulüp toplamı maaş bütçesinin %85–95'i olacak şekilde ölçeklenir.
- **Piyasa değeri saklanmaz**, `marketValue(player, date)` ile hesaplanır.
- Yerli oran ~%65–70 (büyük kulüplerin ilk 11'inde yabancı daha çok).
- **Takvim:** 34 hafta, hepsi cumartesi. 8 Ağustos sonrası ilk cumartesi başlar. Boş haftalar:
  Eylül 1. hafta, Ekim/Kasım 2. hafta, Mart son hafta, kış arası (24 Ara–15 Oca). 2026/27 için
  son hafta 15 Mayıs 2027.
- **Fikstür:** 2. devre 1. devrenin ev/deplasman tersi. Hiçbir takım üst üste 4 iç saha/deplasman yapmaz.
- **Puan eşitliği:** eşit takımlar arası maçlar tamamen oynandıysa ikili puan → ikili averaj;
  sonra genel averaj → atılan gol → kulüp id.
- **Maç motoru (dakika dakika):** her dakika orta saha gücüne göre top kimde → atak olasılığı →
  (hücum / rakip savunma)^1.35 ile şut olasılığı → şutçu (mevki × bitiricilik), şut türü (normal/kafa/
  uzaktan), engelleme, isabet, kaleciye karşı gol. Ayrıca faul (→ kart, penaltı, serbest vuruş), korner
  (→ kafa şansı), sakatlık, yorgunluk. Verim = mevki uyumu × kondisyon × moral × form × günlük form.
  Yapay zekâ: geride kalan 60'tan sonra yüklenir, önde olan 55'ten sonra skoru korur; 58'den sonra
  yorgun/kötü oynayanı değiştirir (en fazla 4). 5 değişiklik hakkı. İç saha: hücum ×1.18, orta saha ×1.05.
  ~4600 maçta ölçülen (5. aşama sonrası): **2.56 gol/maç, %44.6 ev galibiyeti, %25.0 beraberlik**,
  takım başına 13.1 şut / 4.9 isabet / 4.8 korner, maç başına 3.3 sarı / 0.2 kırmızı.
- **Taktik:** 10 diziliş (yapay zekâ: 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-5-1) + özel diziliş + talimatlar: mentalite (−2…+2),
  pas (kısa/karışık/uzun), tempo, pres, savunma hattı, genişlik. Etkiler çarpan olarak (`instructionEffects`):
  hücum → atak/şut ↑ ama rakibe açık; kısa pas → top hakimiyeti (pas kalitesine bağlı) + kaliteli şut;
  uzun → atak ↑, kafa payı ↑, top kaybı; hızlı tempo → atak ↑, yorgunluk ↑; yoğun pres → rakip
  top hakimiyeti ↓, faul ve yorgunluk ↑; yüksek hat → rakip forvetler hızlıysa gol riski ↑; derin hat →
  rakip daha çok ama daha kötü şut; geniş → atak, kafa payı ve korner (`corners` çarpanı) ↑, orta saha ↓,
  rakibe ortada açık; dar → orta saha ↑, atak/korner/kafa ↓. Varsayılan talimatlar etkisiz (denge testleri bununla).
- **Kaptan:** sahadaysa liderliğine göre takıma ±%3. Penaltı/serbest vuruşçu seçiliyse ve sahadaysa o kullanır.
- **Kullanıcı taktiği** `world.tactics[clubId]` içinde (yalnızca kendi kulübümüz). Maçta `resolveLineup`
  sakat/ayrılmış oyuncuyu çıkarır, boş mevkiyi otomatik doldurur, yedek boşsa otomatik seçer.
- **Yapay zekâ** her maçta kadrosuna en uygun dizilişi seçer (`chooseFormation`), talimatları varsayılan,
  mentaliteyi skora göre değiştirir.
- **Maç içi taktik:** diziliş değişince sahadakiler yeni mevkilere dağıtılır (kaleci kalede). Başlama
  öncesi Taktik ekranında yapılan değişiklik maç ekranına dönünce aynı tohumla maça yansır (`refreshPreMatch`).
- **Puan (1–10):** 6.0'dan başlar; gol +1, asist +0.6, kurtarış +0.3, blok +0.15, sarı −0.3, kırmızı −1.5,
  yenilen gol (kaleci −0.4, defans −0.15), maç sonu galibiyet ±0.3, gol yemeyen kaleci/defans bonus.
  Maç sonrası puan oyuncunun `form` listesine eklenir (son 5).
- **Devam akışı:** maç günü değilse sonraki maç gününe (gün gün; `advanceOneDay` ileride günlük işler için)
  gider. Maç günü kendi maçımız canlı oynanır (maç ekranı), bitince günün diğer maçları arka planda
  aynı motorla oynanır ve haftanın sonuçları açılır. Sezon bitince 1'er gün ilerler.
- **GameWorld.season** = { year, fixtures[] }; Fixture.result = MatchResult { skor, goals[{minute, extra,
  clubId, playerId, assistId, kind}], cards, injuries, stats {home, away}, players[{rating, minutes,
  goals, assists, started}], manOfTheMatch }. Anlatım metni saklanmaz (yalnızca canlı maçta).
- **Maç içi sakatlık ve kartlar** şimdilik sadece o maçı etkiler; kalıcı sakatlık/ceza 8. aşamada.
  Sakatlanan oyuncu (kullanıcı takımında da) otomatik değiştirilir.

## Veri formatları
- `data/clubs.json` — `[{ id, name, shortName, city, stadium, capacity, reputation (1–100),
  budget (€), wageBudget (€/yıl), fanExpectation, colors: { primary, secondary } }]`.
  fanExpectation: `title | europe | top_half | mid_table | avoid_relegation`.
  Stadyum/bütçe değerleri yaklaşık, elle düzeltilebilir.
- `data/nations.json` — `[{ code, name, namePool, weight }]`. `TUR` zorunlu (weight 0: yerli ayrı seçilir).
  weight = yabancı oyuncu üretiminde seçilme ağırlığı.
- `data/names/<havuz>.json` — `{ firstNames: [], lastNames: [] }`. Yeni dosya eklemek yeterli.
- `data/lower_league.json` — 1. Lig kulüpleri (gerçek 2026/27; clubs.json ile aynı biçim, en az 3). Oyunda
  `division: 2`; kadroları oyun başında üretilir. Küme düşen Süper Lig kulübü de buraya iner.
- **Kayıt** (IndexedDB, Dexie şema sürümü 2): `saves` = SaveSlot `{ id, name, careerId, clubId, clubName,
  gameDate, season, isAutosave, createdAt, updatedAt, formatVersion, managerName? }`; `saveData` = `{ id, world: GameWorld }`
  (aynı id). GameWorld olduğu gibi yazılır (düz veri), kayıt anında `structuredClone` ile kopyalanır.
  `SAVE_FORMAT_VERSION = CURRENT_WORLD_VERSION` (şu an 11). GameWorld yapısı değişince sürümü artır ve
  `engine/migrate.ts`'e dönüşüm ekle; `loadGame` eski kayıtları otomatik dönüştürür, daha yeni sürümü reddeder.
  Sezon sonu kaydı ~1.7 MB (+ haberler/teklifler).
- **careerId** = `${seed}-${playerClubId}`. Otomatik kayıt kariyer başına tek slot; elle kayıt sınırsız.

## Transfer ve finans kuralları (aşama 7)
- **Dönemler:** yaz 1 Tem – 8 Eyl, devre arası 2 Oca – 1 Şub. Dönem kapanınca açık teklifler iptal.
- **Kullanıcı alıcı:** teklif → satıcı ertesi gün karar: ≥ beklentinin %92'si kabul, ≥ %60 karşı teklif
  (= beklenti), altı ret; kadrosu ≤ 20 olan satmaz. Beklenti = piyasa değeri × (1.15 + 0.35 × önem);
  önem: ilk 11 = 1, rotasyon (12–16) = 0.5; sözleşmesine ≤ 1 yıl kalana ×0.8.
- **Sözleşme:** oyuncu talebi = max(kulübün maaş ölçeğine göre adil maaş, mevcut maaş × 1.1);
  istediği süre dışında +%10; (maaş + imza bonusu / yıl) ≥ talep → imzalar; %80'ine yakınsa talebini
  söyler; 3 ret → anlaşma bozulur. Maaş bütçesi ve transfer bütçesi kontrol edilir.
- **İsteklilik:** oyuncu, kulübünden 20 itibar puanından daha düşük kulübe gitmez (30+ yaş: 30 puan).
- **Kiralık:** sezon sonuna (30 Haz) kadar; maaşı kiralayan öder; ilk 11 oyuncusu kiralık verilmez;
  bedel beklentisi değerin %8'i.
- **Kullanıcı satıcı:** yapay zekâ teklifi 7 gün bekler; kabul → hemen satış; karşı teklif → alıcı ertesi
  gün, gizli üst sınırı (`maxFee`, değerin 1.1–1.4 katı) içindeyse kabul eder.
- **Yapay zekâ alımları:** dönem içinde her kulüp günlük %5 (yaz) / %3 (kış) olasılıkla en eksik mevki
  grubuna, bütçesine ve itibarına uygun oyuncu alır; kadro ≥ 28 ise almaz. Sezonda ~30–40 transfer.
- **Finans:** başlangıç kasası = transfer bütçesi + maaş bütçesinin 1/4'ü. Yıllık yayın = maaş bütçesinin
  %45'i, sponsor %30'u (aylık 1/12). Bilet = seyirci × bilet fiyatı (8 + itibar × 0.3 €); seyirci =
  min(kapasite, taraftar × rakip çekiciliği), taraftar = 2000 + (itibar/100)³ × 60000. Galibiyet primi
  maaş bütçesinin %0.3'ü (beraberlik 1/3). Satışın %50'si transfer bütçesine eklenir.
- Lig sıralaması ödülü / yayın payının performansa bağlanması 9. aşamada (sezon sonu).

## Oyuncu durumu kuralları (aşama 8)
- **Uygunluk:** `isAvailable(p)` = sakat değil ve cezalı değil. Otomatik kadro, taktik çözümü (resolveLineup)
  ve yapay zekâ bunu kullanır. Otomatik kadro yorgun oyuncuyu cezalandırır (kondisyon < 85 → puan düşer).
- **Sakatlık:** maç içi sakatlık kalıcı olur (10 tür, 2 gün – 8 ay, ağırlar nadir); antrenmanda günlük
  0.0005 × (sakatlık eğilimi/10) × yoğunluk çarpanı. Gün gün iyileşir; dönüşte kondisyon ≥ 70.
  Sezonda kulüp başına ~5–15 maç sakatlığı + antrenman sakatlıkları.
- **Ceza:** 4 sarı → 1 maç (sayaç 4 düşer); ikinci sarıdan kırmızı → 1 maç (o maçın sarısı sayılmaz);
  direkt kırmızı → 1 (%60) / 2 (%30) / 3 (%10) maç. Ceza, kulübün sonraki lig maçlarında çekilir.
- **Kondisyon:** maç sonu kondisyonu oyuncuya yazılır; günlük +6 + doğal kondisyon × 0.25; tavan yoğunluğa
  göre (hafif 100, normal 98, yoğun 94). Sakat oyuncu 60'ı geçmez.
- **Moral:** galibiyet +5, yenilgi −5, puan ≥ 7.5 +3, ≤ 5.5 −3, ilk 11 +1; kadro sırası ilk 14'te olup
  oynamayan sağlam oyuncu −3; diğerleri sonucun yarısı. Günlük ortalamaya (60) dönüş (%3, en az 1 puan).
  Kullanıcının oyuncusu < 30 ise haftalık şikâyet haberi (45 gün arayla). Transfer → en az 72, yenileme +8.
- **Gelişim (pazartesi):** yaşa göre haftalık özellik puanı (≤18: 0.5 … 28–29: 0 … 34+: −0.28).
  Artı: × (PA − CA)/25 (0–1) × (0.6 + profesyonellik × 0.8) × yoğunluk; sakat gelişemez.
  Eksi: × (1.2 − prof × 0.4) × (1.15 − doğal kondisyon × 0.3). Birikim ±1 → bir özellik ±1, CA yeniden
  hesaplanır. Artışta özellik seçimi: mevki ağırlığı × odak (×3) × (20 − değer)/10; düşüşte fiziksel ×3.
  `trend` gelişim eğilimi (UI ▲/▼). Antrenör raporu yıldızları = (yetenek − 45) / 25, 0.5–5.
- Denge (aşama 8 sonrası, ~4600 maç): 2.55 gol, %44.9 ev, %25.0 beraberlik (goalBase 0.27, homeAttack 1.2).

## Sezon döngüsü ve yönetim kuralları (aşama 9)
- **Lig yapısı:** world.clubs = Süper Lig (division 1) + 1. Lig (division 2). Fikstür ve puan durumu yalnızca
  `leagueClubs(world)`. 1. Lig maçları oynanmaz; çıkan 3 kulüp itibar² ağırlıklı rastgele seçilir.
- **Yönetim:** hedef sıra = beklentiden (title 1, europe 4, top_half 8, mid_table 12, avoid_relegation 15).
  Güven 60'tan başlar. Maç: galibiyet +1.5, beraberlik +0.3 (büyük kulüpte −0.5), yenilgi −2.5 (büyük kulüpte −3.5).
  Aylık (5. haftadan sonra): (hedef − sıra) × 0.8 (−5…+3); kasa eksi → −3. < 30 uyarı, < 10 ve 8+ hafta oynanmışsa
  görevden alma. Sezon sonu: şampiyon +30, hedef tuttu +15, 3 sıraya kadar geride −5, daha kötü −20; < 15 → görevden
  alma; küme düşme → görevden alma. Görevden alınınca `world.gameOver`: Devam kapalı, otomatik kayıt alınmaz.
- **Sezon sonu (son maçın ertesi günü):** ödüller (Gol Kralı, Asist Kralı, Sezonun Oyuncusu [≥ hafta×0.55 maç],
  Genç Oyuncusu [≤21 yaş, ≥10 maç], Kalecisi), sıralama primi (15 / 10 / 7 / 5 Mn, sonra 3.5 → 0.8 Mn),
  world.history'ye SeasonSummary (isimler saklanır), seasonState = 'ended'.
- **Devam sezon arasında** bir sonraki maç günü yerine 1 Temmuz'a kadar ilerler (haberlerde durur).
- **1 Mayıs:** sözleşmesi bitecek oyuncularımız için uyarı. **30 Haziran:** kullanıcının sözleşmesi biten oyuncuları
  serbest kalır; yapay zekâ kadro sırası < 18 ve ≤ 32 yaş olanı yeniler, diğerlerini bırakır.
- **1 Temmuz (yeni sezon):** küme düşen → division 2, itibar −5, maaş bütçesi ×0.6, temel bütçe ×0.5; çıkan →
  division 1, itibar +3, ×1.4 / ×1.5. İtibar: şampiyon +3, ilk 4 +1, itibar sırasından 3+ iyi +1 / 3+ kötü −1.
  Emeklilik: 34+ yaşta 0.25 + (yaş−34)×0.18 (+0.15 CA<90), 38'de kesin; serbest 31+ → +0.4. Emekliler silinir.
  Altyapı: her kulübe 3–4 genç (16–17 yaş, seviye taban−4.5, ek potansiyel 10–45). Yapay zekâ kadrosu > 30 ise en
  zayıflar bırakılır. Bütçeler: yayın = maaş bütçesi × (0.45 / 1. Lig 0.3), sponsor 0.3, transfer bütçesi = temel
  bütçe + (kasa − maaş bütçesi/4) fazlasının %30'u. Beklenti itibar sırasından. Sarı kartlar sıfırlanır.
- **Serbest oyuncular:** clubId = null. Kullanıcı bonservissiz imzalar (negotiateFreeAgent, dönem şartı yok);
  yapay zekâ transfer döneminde bedelsiz alabilir.
- **Gelen Kutusu:** world.news içinden `important` ya da kulübümüzle ilgili olanlar; okundu bilgisi haberde.
- Denge (aşama 9 sonrası): deplasman takımı 75'ten sonra beraberliğe razı (mentalite −1); goalBase 0.275,
  injuryChance 0.0018. ~4600 maç: 2.52 gol, %44.1 ev, %25.9 beraberlik.
- Denge (aşama 10, gol dağılımı): gol kralı 29–42 ve takım golleri 14–103 idi (güç farkı üç yerde çarpılıyordu).
  Değişenler: threatExponent 1.35 → 1.2; top hakimiyeti üssü 2 → 1.5 (possessionExponent); vuruş yeteneğinin
  etkisi: isabet × (0.5 + yetenek/24) (önce yetenek/12), gol × (yetenek/kaleci)^0.8 (finishingExponent, önce 1.2);
  SHOOTER_WEIGHT ST 6 → 3.5; penaltı (penaltyChance) 0.017 → 0.024; goalBase 0.275 → 0.31.
  12 sezon: gol kralı ort. 24 (19–32), kulübün en golcüsü takım gollerinin %28'i, santrforlar tüm gollerin
  %32'si, en golcü takım 72–93 gol, en az golcü 24–32, şampiyon 72–95 puan, penaltı golü 0.26/maç,
  asist kralı 10–15. ~4600 maç: 2.69 gol, %44.2 ev, %26.3 beraberlik. engine.test.ts gol kralını da denetler.
  testing.ts playSeason yönetim güvenini tazeler (görevden alınma test sezonunu yarıda kesmesin).

## Kayıt kuralları (kullanıcıyla kararlaştırıldı)
- Canlı maç sürerken (başlama öncesi dahil) kayıt **yapılamaz**; liveMatch kaydedilmez.
- **Otomatik kayıt** her maç gününden sonra (haftanın maçları oynanınca) arka planda alınır.
- Maç ortasında çıkılırsa son kayıt yüklenince o maç baştan oynanır (aynı tohum → yine deterministik).
- Ana menüye dönüşte kaydedilmemiş ilerleme varsa uyarı (Kaydet ve Çık / Kaydetmeden Çık); sekme
  kapatılırken tarayıcı uyarısı (beforeunload). Ana menüde en son kayıttan "Devam Et" kısayolu.

## Görünüm
FM 2005 ekranlarından esinlenen **modern tema** (kullanıcı CM 01/02 paletinden vazgeçti, FM 2005 görüntüleri
verdi; "esinlen ama modern olsun"). Tüm renkler `styles.css` başındaki CSS değişkenlerinde.
- Yerleşim: üstte başlık (solda tarih, ortada sayfanın kulüp renklerinde büyük **başlık hapı**, sağda kulüp),
  altında gezinme çubuğu (◀ ▶ geçmiş, durum, sarı **Devam**), solda gri-mavi yuvarlak menü + yeşil
  "sıradaki maç" kartı, ortada **çim şeritli** içerik alanı, altta konum yolu + son sonuçlar haber bandı.
- Paneller yarı saydam koyu yeşil, başlıklar sarı (Barlow Condensed), alt başlıklar koyu yeşil şerit.
- Değer renkleri: 16+ yeşil, 13–15 sarı, ≤5 kırmızımsı. Mevki kutuları: KL sarı, defans mavi, orta yeşil, hücum kırmızı.
- Yazı tipleri npm ile (yerel): @fontsource-variable/inter (arayüz), @fontsource/barlow-condensed (başlıklar).
- Bileşenler: ClubBadge (kalkan SVG), Shirt (forma SVG, numaralı — taktik sahasında da kullanılacak).
- Gezinme geçmişi store'da (`history`, `navigate` / `back` / `forward`), en fazla 50 sayfa.

## Aşamalar
- [x] **1. Kurulum ve iskelet** — proje, klasörler, Vitest, Zustand, Dexie; ana menü, sol menü,
      üst bar (tarih + Devam).
- [x] **2. Veri üretimi** — kulüp JSON (18 kulüp), ülkeler, 11 isim havuzu, seed'li oyuncu/dünya
      üretici; Yeni Oyun (kulüp seçimi), Kadro (sıralanabilir, kulüp seçilebilir), Oyuncu Profili,
      Kulüp Bilgisi ekranları; CM 01/02 paleti.
- [x] **3. Lig ve takvim** — fikstür, puan durumu (bölgeler, form), Devam ile maç gününe ilerleme,
      anında maç sonucu + golcüler, Fikstür (Kulübüm/Haftalar), Puan Durumu, Lig İstatistikleri
      (gol krallığı, takım istatistikleri); üst barda sıradaki maç.
- [x] **Tasarım yenilemesi** (3 ile 4 arası, kullanıcı isteği) — FM 2005 esinli modern tema, yeni profil düzeni.
- [x] **4. Maç motoru** — dakika dakika motor, Türkçe anlatım, canlı maç ekranı (tabela, son 10 dk
      baskı çubuğu, istatistikler, canlı puan/kondisyon, değişiklik, mentalite, 4 hız, anında sonuç,
      maçın adamı), diğer maçlar arka planda; istatistik doğrulama testi; profil ve lig istatistikleri
      (maç, gol, asist, kart, ortalama puan, asist krallığı, puan sıralaması). 2D saha istenmedi.
- [x] **5. Taktik** — taktik ekranı (kadro listesi, formalı saha, yedek kulübesi, iki tıkla yerleştirme/takas,
      uyum noktaları, uyarılar, otomatik seç), 6 diziliş, talimatlar, kaptan/penaltıcı/serbest vuruşçu,
      motora etkileri (istatistiksel testlerle), yapay zekâ diziliş seçimi, maç içi taktik paneli.
- [x] **6. Kayıt sistemi** — çoklu kayıt slotu, kaydet (yeni / üzerine), yükle, sil, kariyer başına otomatik
      kayıt (maç günü sonrası), ana menüde Devam Et + Kayıt Yükle ekranı, çıkış uyarısı, bildirimler.
- [x] **7. Transfer, sözleşme, finans** — Transfer Merkezi (oyuncu arama + filtreler, teklifler, haberler),
      teklif / karşı teklif / kiralık, sözleşme görüşmesi ve yenileme, gelen teklifler, yapay zekâ transferleri,
      transfer dönemleri, finans (kasa, bütçeler, aylık raporlar, bilet/yayın/sponsor/prim), Devam haberlerde
      durur, menüde bekleyen teklif rozeti, eski kayıt dönüşümü (biçim 1 → 2).
- [x] **8. Oyuncu durumu** — kalıcı sakatlıklar, kart cezaları, kondisyon toparlanması, moral (sonuç, forma şansı,
      şikâyet), antrenman (6 odak, 3 yoğunluk), haftalık gelişim/gerileme, antrenör raporu yıldızları, Antrenman
      ekranı, durum etiketleri (kadro/taktik/profil), eski kayıt dönüşümü (biçim 2 → 3).
- [x] **9. Yönetim ve sezon döngüsü** — yönetim güveni ve görevden alma, Gelen Kutusu (filtreler, okundu, bağlantılar),
      sezon sonu (ödüller, primler, küme düşme/çıkma, arşiv), sözleşme bitişleri ve serbest oyuncular, emeklilik,
      altyapı, yeni sezon; kurgusal 1. Lig (data/lower_league.json); eski kayıt dönüşümü (biçim 3 → 4).
- [ ] **10. Cila** (kullanıcı parça parça seçiyor)
  - [x] Kadro ekranı: hızlı filtreler (mevki grubu; sakat/cezalı, sözleşmesi bitiyor, kiralık, gençler, ilk 11),
        isim arama, 4 görünüm (Genel, İstatistik, Sözleşme, Antrenör Raporu), sıralanabilir sütunlar, özet şeridi,
        2 oyuncu karşılaştırma (başka kulüpten de; seçim ve tercihler store'da korunur).
  - [x] Maç sonrası rapor (ekran 'report', Route.fixtureId): tabela, tarih/stadyum/seyirci, maçın adamı, olay
        zaman çizelgesi, istatistikler, iki takımın oyuncu puanları (giriş ▲ / çıkış ▼ dk). Canlı maç bitince açılır;
        Fikstür'de oynanmış maça tıklayınca da. Yalnızca bu sezonun maçları (geçmiş sezon fikstürü saklanmıyor).
  - [x] Menajer adı ve kartı (world.manager: ad, göreve başlama, G/B/M, şampiyonluk). Yeni oyunda ad zorunlu;
        Kulüp Bilgisi'nden değiştirilebilir; başlıkta, ana menüde ve kayıt listesinde görünür. Biçim 4 → 5 dönüşümü
        adı "Menajer" yapar, kaydı bu sezonun sonuçlarından ve arşivdeki şampiyonluklardan çıkarır.
  - [x] Denge: gol dağılımı (gol kralı, takımlar arası fark, penaltı) — ayrıntı "Sezon döngüsü" bölümünün sonunda.
  - [x] Performans (ölçüm: puppeteer + CPU 4× yavaşlatma, orta sınıf makine taklidi):
        - Motor hızlıydı (sezon ~1.6 sn, maç günü ~35 ms). Sıcak nokta: askingPrice → playerImportance her oyuncu için
          kadroyu yeniden filtreleyip sıralıyordu (yapay zekâ alımı ve Transfer Merkezi'nde O(n²)). Artık
          `squadRanks(world)` bir kez hesaplanıp `askingPrice(world, p, ranks)`'a verilir (önbellek değil; sonuç aynı).
        - ageOn Date/split yerine sabit konumlardan okur. Transfer Merkezi araması 50'şer satır çizer ("Daha fazla göster").
        - Otomatik kayıt 150 ms gecikmeyle başlar (sonuç ekranı önce çizilir); arada canlı maç başladıysa atlanır.
        - Sonuç (4× yavaş CPU): Transfer Merkezi 835 → ~430 ms, maç sonu rapor 839 → ~480 ms, Devam ~150–190 ms.
          Canlı maç "Çok Hızlı" hedefi (25 dk/sn) 4× yavaşta da tutuyor. Kalan maliyet ilk açılan ekranda yazı tipi
          şekillendirme (layout ~45 ms, ikinci açılışta ~8 ms). Paket 541 KB (gzip 166 KB), bölmeye gerek görülmedi.
  - [x] 2D saha (maç ekranı orta sütun, "Gizle/Göster" localStorage 'fm.showPitch'). Motor koordinat tutmaz:
        stepMatch her dakika `MatchState.lastPlay` yazar (side, kind: hold/foul/attack/corner/freekick/blocked/miss/
        save/penalty/goal, playerId, fromPenalty) — öncelikli olan kalır (recordPlay), rng kullanmaz, sonucu etkilemez.
        ui/pitch.ts (saf, testli): ballSpot (anın yeri; dakikaya bağlı sabit hash), shotOrigin, teamSpots (dizilişten,
        topa göre blok çizgisi; ceza sahası yakınında doluşma; ızgara görünmesin diye küçük kayma), colorsClash
        (renkler yakınsa deplasman ikinci rengini giyer). PitchView SVG; geçiş süresi maç hızına göre, < 100 ms ise kapalı
        (SVG geçişleri ana iş parçacığında boyanır). "Çok Hızlı" 4× yavaş CPU'da 22 dk/sn (hedef 25).
  - [x] 2D saha sahneleri: lastPlay'e gerçek oyuncular eklendi (assistId, keeperId, defenderId = bloke eden / topu
        kapan / faul yapan, card = dakikanın kartı; recordPlay öncelikli olanı tutar, kartı korur).
        ui/pitchScene.ts (saf, testli): buildScene dakikayı 2–5 kareye çevirir (oyun kurma pasları → asist → şut → sonuç;
        korner, faul/serbest vuruş, penaltı [ceza sahası boşaltılır], top kapma). Pas hedefine en yakın takım arkadaşı
        topla buluşur; son kare her zaman ballSpot ile aynı. frameSpots: yerleşim + topu taşıyan + özel yerleşimler.
        framesForDuration: dakika < 300 ms ise yalnızca son kare, yoksa en fazla ⌊ms/110⌋ (2–5) kare.
        PitchView kareleri dakika süresinin %90'ına yayar; pas izi kesik, şut izi düz çizgi; kart oyuncunun üstünde.
        Duraklatılmışken sahne Normal hız süresiyle oynar. "Çok Hızlı" 4× yavaş CPU'da 24 dk/sn.
  - [x] Duran top sahneleri + büyük saha. Motor: lastPlay.fromCorner / fromFreeKick (resolveShot'a korner bayrağı);
        penaltı/serbest vuruş şutunda faulü yapan önceki andan taşınır. pitch.ts: freeKickSpot (kazanılan serbest vuruş
        ile şutu aynı yer), shotOrigin korner kafası için altıpas önü; formationRoles (dizilişteki yer, roller için).
        pitchScene.ts: SceneFrame.setPiece {kind, side, spot} — diziliş `spot`a göre kurulur, şuttan sonra bozulmaz.
        setPieceSpots: korner (hücumcular CORNER_TARGETS'a, savunanlar markaja, biri yakın direğe), serbest vuruş
        (topa 9.15 m'de 4 kişilik baraj, hücumcular ceza sahası çizgisinde), penaltı (çizgi/yay çevresinde iki sıra).
        Her iki takımdan geride kalanlar: hücum edenin en geri 2'si, savunanın en ileri 1'i.
        Saha maç ekranında tam genişlikte (kadroların üstünde); yüksekliği main.content'in görünür alanına göre
        ölçülür (useFitHeight, en az 320 px), saha açıkken "Son 10 dk" çubuğu gizli; altında son olay şeridi (EventBar);
        topu taşıyanın ve kart görenin soyadı noktanın altında. Performans: çim/çizgiler ayrı, memo'lu SVG
        (PitchBackground); her dakika yalnızca oyuncu katmanı boyanır; .match-grid content-visibility: auto.
        ui/colors.ts readableText: ikinci renk zeminde okunmuyorsa beyaz/siyah (tabela, başlık hapı, saha numaraları).
        DİKKAT: `.pitch-bg` uygulamanın çim zemin sınıfı; saha SVG'si `.pitch-grass`.
  - [x] Maç hızı seçenekleri kaldırıldı; "önemli anlar" modu (kullanıcı isteği). Sakin dakika QUIET_MINUTE_MS = 1000;
        önemli an (pitchScene.isHighlight: şutlar, gol, penaltı, korner, serbest vuruş, kart, sakatlık — kartsız faul ve
        şutsuz atak değil) sahada SCENE_FRAME_MS = 750 ms/kare oynar, son kare SCENE_HOLD_MS = 1500 ms kalır; saat o sürece
        bekler (MatchScreen setTimeout zinciri). Sakin dakikalarda saha boş; maç/ikinci yarı başında başlama dizilişi.
        Saha gizliyse her dakika 1 sn. Sonuç gizleme: saatin adımından önceki skor/olay sayısı (Held) önemli an sürerken
        tabela, golcüler, olay şeridi ("X atakta…") ve anlatımda gösterilir; sahne son karesine gelince açıklanır.
        Motor: lastPlay.injuredId; devre arası/maç sonunda lastPlay silinmez (son dakikanın golü de gösterilsin),
        ikinci yarı başında silinir. Bir maç ~3,5–4 dk sürer.
  - [x] Gol sevinci: sahnede sonuç karesi (SceneFrame.result; revealIndex) — etiket, kart ve skor burada açıklanır.
        Golde ardından 3 kare (celebration): golcü yakın köşe bayrağına (hücum yönünde 101 m, kenara 5 m) koşar,
        takım arkadaşları yolu yarılar → golcünün çevresinde halka, rakip kaleci topu ağlardan alır → santra
        (SceneFrame.kickoff, gol yiyen takımın forveti topun başında). focusId: adı gösterilen, yeri değişmeyen oyuncu;
        vurgulananlar en son çizilir (ad kalabalıkta üstte). Gol sahnesi ~6–7 sn.
  - [x] Kamera: "Tam saha" / "Yakın" (localStorage 'fm.pitchCamera') ve tam ekran. Araçlar maç kontrol satırının
        sağında (PitchTools). pitch.ts cameraTransform (saf, testli): hedefi (top; sevinçte golcü) ortalar, kenarda durur;
        CAMERA_ZOOM 1.9; santra ve sakin dakikada tam saha. Yalnızca CSS dönüşümü (.pitch-camera: translate % + scale,
        transform-origin 0 0) — saha yeniden çizilmez. Bunun için .pitch-stage genişliği = yükseklik × en-boy oranı
        (boşluksuz). Tam ekran: Fullscreen API saha panelinde (useFullscreen); üstte FullscreenBar (skor [gizli sonuçla],
        saat, Duraklat/Devam, Küçült); yükseklik window.innerHeight − 120.
  - [x] Görsel cila: iki renkli oyuncu (forma = birinci renk, şort = ikinci; renk çakışmasında ters), oyuncu ve top
        gölgesi, kale fileleri (çapraz örgü deseni, direkler; oyuncu katmanında) ve golde file sallanması (.pitch-net.ripple,
        golün girdiği kale), köşe yayları, çimde tribün gölgesi ve hafif güneş (sabit arka plan katmanında).
  - [x] Performans: oyuncular ve top HTML katmanında (.pitch-dots > .pdot / .pball), kayma transform geçişiyle
        ekran kartında (SVG transform geçişleri ana iş parçacığında çalışıyordu). Katman büyütülmez: konum ve birim
        (--u, metre başına px) kamerayı içerir (pitch.ts toScreen / screenUnit, testli) — yakın kamerada yazılar net.
        Sahne kutusu genişliği ResizeObserver ile (useElementWidth). Çim, çizgiler, fileler, pas izleri SVG'de kalır.
        Ölçüm (önemli an sırasında): CPU 6× yavaşta ana iş parçacığı kare hızı 42–52 → 52–58, yük 430–550 → 300–450 ms/sn.
  - [x] Taktiğe göre şekil: yeni talimat **genişlik** (dar/normal/geniş; kayıt sürümü 12, eski taktiklere 'normal').
        pitch.ts teamShape (saf, testli): mentalite bloğu ±3 m/kademe kaydırır, savunma hattı arka hattı ±7 m,
        pres yalnızca top rakipteyken önü +8 / −6 m (defansı %35'i kadar), genişlik yan yayılma ×1.18 / ×0.8;
        stayBackLy: tam hücumda bekler de rakip ceza sahasına girer, savunmacı mentalitede ön libero geride kalır.
        teamSpots'a `possession` (frameSpots'ta karenin carrierSide'ı): top rakipteyken takım daralır (yayılma ×0.88)
        ve topa daha çok kayar (yoğun preste daha da çok). Varsayılan talimatlarda top bizdeyken yerleşim eskisi gibi.
        pitchScene: oyun kurma ve asistsiz son pasın koridoru genişliğe göre (lane). Yapay zekâ mentaliteyi skora göre
        değiştirdiği için onun şekli de maç içinde değişir. Taktik ekranındaki formalı saha (kadro yerleştirme) sabit.
  - [x] Kart / sakatlık / değişiklik görselleri. Motor: MatchPlay.subs (PlaySub {side, outId, inId, early?}); dakika
        içindeki değişiklik (yapay zekâ, sakatlık, kaleci atılınca) o dakikanın anına, dakikalar arasındaki (kullanıcı)
        MatchState.pendingSubs'a yazılır ve sıradaki oynanan dakikanın anına taşınır (early). recordPlay subs'ı korur.
        pitchScene: isHighlight değişikliği de sayar (etiket "Oyuncu değişikliği"). Değişiklik 3 kare (substitutionFrames):
        çıkan yerinden kenara yürür / giren orta çizgi hizasında alt kenarın dışında (BENCH_Y) bekler → kenarda buluşurlar,
        giren sahaya koşar → giren yerinde, çıkan yok. early: sahnenin başında; diğerleri sonunda (gol sevincinden de sonra)
        ve o ana kadarki karelerde girenin yerinde çıkan görünür (SceneFrame.standIns, frameSpots duran top dizilişinden
        sonra uygular). Kartsız faul gibi sakin bir dakikada yalnızca değişiklik kareleri (sonuç = ilk kare).
        Kırmızı kart: sonuç karesinden sonra atılan oyuncu kenara yürür (sendOff). PitchView: sarı kartı olanın üstünde
        küçük kart (bu dakikanın kartı sonuç karesine kadar gizli), sakatlanan sonuç karesinde yerde (.pdot-body.down),
        değişiklikte yeşil ▲ / kırmızı ▼ ve adlar; alt kenardaki oyuncunun adı noktanın üstünde (.pdot-name.above,
        sahne kutusu taşanı keser). Değişiklik başına sahne ~3,75 sn.
  - [x] Menajer pazarlığı (kullanıcı seçti: menajer kişiliği + menajer ücreti + sözleşme maddeleri; menajerlerin oyuncu
        önermesi istenmedi). Kayıt sürümü 13: world.agents (30 menajer, ayrı rng AGENT_SEED_SALT, tr isim havuzu; %50 makul,
        %30 açgözlü, %20 sert). Oyuncuda alan yok: agentOf kimliği karıştırıp menajer seçer. AGENT_PROFILES:
        makul (ücret toplam maaşın %4'ü, sabır 4), açgözlü (%10, ücretin %60'ı verilmezse imza yok, ücret maaşla 1:1
        takas, sabır 3), sert (maaş ×1.08, sabır 2, piyasa değerinin ≤ 2.5 katı serbest kalma bedeli şart).
        evaluateTerms "yıllık maaş karşılığı": maaş + imza bonusu/yıl + primler (rolün beklenen maçı × %60) +
        feeWeight × (ücret − istenen)/yıl ≥ talep × süre (×1.1 tercih dışı) × rol (beklenenin altı kademe başına ×1.15,
        üstü ×0.97) × serbest kalma bedeli (≤ 1.5×değer ×0.95, ≤ 3× ×0.98). expectedRole: kulüpte kendisinden iyi
        oyuncu sayısı (<9 önemli, <16 rotasyon), 21 yaş altı bir kademe aşağı. Verilmeyen ücret istenen kadar, rol beklenen
        sayılır (completeTerms). Teklifin sabrı menajerden. "Önemli oyuncu" rolü imzada forma sözü olur
        (promisePlayingTime). Contract: role, releaseClause, appearanceBonus, goalBonus (yalnızca kullanıcının imzaladığı
        sözleşmelerde). Menajer ücreti transferde transfer bütçesinden, yenilemede kasadan; gider kalemi agentFees.
        Primler applyResult → payContractBonuses ("Primler"). Serbest kalma bedeli: yapay zekâ kullanıcıya teklif
        ederken bedel ≤ 1.6×değer ve bütçesi yetiyorsa triggerReleaseClause (satış reddedilemez); ucuz bedelli
        oyuncu 3× daha çok seçilir. Arayüz: ContractDialog (menajer ve tavrı, sabır, iki bölüm: maaş/süre/imza/ücret ve
        rol/bedel/primler, "Talebini yaz" tüm talebi doldurur), profilde rol, bedel, primler, menajer.
  - [x] Türkiye Kupası. Kupa maçları sezon fikstüründe (`Fixture.competition: 'cup'`, round = tur 1–5); ayrı durum
        saklanmaz, kayıt dönüşümü gerekmez (eski kayıtta kura sıradaki gün çekilir, tarihler gerekirse ileri kayar).
        26 kulüp (Süper Lig + 1. Lig): 32'ye eksik kadar (6) en yüksek itibarlı Süper Lig kulübü 1. Turu bay geçer →
        1. Tur 10 maç, Son 16, Çeyrek Final, Yarı Final, Final (tarafsız saha: MatchState.neutral, iç saha avantajı yok).
        Tarihler çarşamba (cupRoundDate: 23 Eyl, 28 Eki, 27 Oca, 3 Mar, 5 May sonrası ilk çarşamba; final ligin son
        haftasından önce). Kura: 1. Tur maçtan 14 gün önce, sonrakiler önceki tur bitince (processDay → cupDay), ayrı
        tohumlu rng (ana rastgeleliği değiştirmez); farklı ligdekilerden alt ligdeki evinde. Eleme: MatchState.knockout,
        beraberlikte 90 dakikadan sonra doğrudan penaltı atışları (uzatma yok): 5'er atış + tek tek; vurucu sırası
        seçilen penaltıcı, sonra penaltı becerisi, kaleci en son; olasılık penaltı/soğukkanlılık − kalecinin refleks/
        bire bir. MatchResult.penalties. Turu geçene ödül (100 bin → 3 Mn €, 'prize'); kullanıcıya kura/tur/veda
        haberleri ('cup'); alt lig takımına elenmek güven −4, kupayı kazanmak +15 ve manager.cups. Puan durumu
        (computeStandings), yönetimin hafta sayısı, lig istatistikleri ve sezon ödülleri yalnızca lig maçları;
        oyuncu sezon istatistikleri, kariyer, form, ceza ve menajer G/B/M kaydı kupayı da sayar. SeasonSummary.cupWinner*.
        Arayüz: Fikstür'de "Türkiye Kupası" sekmesi (turlar, bay geçenler, durumumuz), Kulübüm listesi tarih sırasında
        kupa etiketiyle, skorlar "2 - 2 (P 4-3)", maç ve rapor başlığında fixtureLabel, tabelada penaltılar, haber
        bandı son maç gününün sonuçları, geçmiş sezonlarda kupa şampiyonu, menajer kartında kupa sayısı.
  - [x] Avrupa kupaları. Fixture.competition: 'cup' | 'cl' | 'el' (Competition), Avrupa grup maçında Fixture.group;
        round: 1–6 grup maçları, 7/8 çeyrek final ilk maç/rövanş, 9/10 yarı final, 11 final. computeStandings artık
        yalnızca lig maçları (competition yok); mini lig için tableFrom. 16'şar kulüp: ŞL = Türkiye'den geçen sezonun
        ilk 2'si + en güçlü 14 yabancı; AL = kupa şampiyonu (ŞL'de değilse) + 3./4. (gerekirse 5.) + ŞL dışındaki en
        ZAYIF 13 yabancı (ilk denemede en güçlüler konunca Türk kulüpleri neredeyse hiç kazanamıyordu). İlk sezon
        itibar sırası. Bir ülkeden en çok 4 kulüp; grup kurası 4 torba (itibar), geri izlemeyle aynı ülke aynı grupta
        olmaz. Kura 25 Ağustos (ilk maça 3 günden az kaldıysa o sezon Avrupa yok: eski kayıt), sonraki aşamalar önceki
        bitince (processDay → europeDay); ayrı tohumlu rng. ŞL salı, AL perşembe (STAGE_DATES: 14 Eyl … 7 Ara grup,
        8/15 Mar çeyrek, 12/19 Nis yarı, 18 May final — ligin bitiminden sonra; sezon ŞL finalinin ertesi günü kapanır).
        Çeyrek final: grup birincisi başka grubun ikincisiyle, rövanş birincinin evinde; yarı final serbest kura; final
        tarafsız. Rövanş: MatchSetup/MatchState.aggregate (ilk maçın golleri, bu maçın ev/deplasmanı açısından);
        toplamda eşitlikte penaltılar (deplasman golü yok). Ödüller ('prize'; EUROPE[comp].prizes): katılım, grup
        galibiyeti/beraberliği, çeyrek, yarı, final, şampiyonluk (ŞL 8 Mn katılım … 10 Mn şampiyonluk; AL daha az).
        Kullanıcı: gruptan çıkmak / tur atlamak güven +5 ve itibar +1, şampiyonluk ŞL +25 / AL +15, itibar +3
        (Türk kulübü, en çok 100), manager.europeTitles; haberler ('europe'). SeasonSummary.clWinnerName/elWinnerName.
        Motor istatistik testi artık yalnızca lig maçlarını ölçer. Arayüz: Fikstür'de "Avrupa" sekmesi (ŞL / AL
        seçimi; grup tabloları, eleme turları ilk maç + rövanş + toplam), Kulübüm listesinde ŞL/AL etiketi, tabelada
        ve raporda "Toplam X-Y", puan durumu bölgeleri 1–2 ŞL, 3–4 AL (Konferans Ligi kalktı), geçmişte şampiyonlar,
        menajer kartında Avrupa kupası. Ölçüm (5 sezon): Türk kulüpleri ŞL'de çoğunlukla 3.–4., AL'de ara sıra gruptan çıkar.
  - [x] Milli takımlar (kullanıcı seçti: yalnızca kulüp tarafı, eleme + yaz turnuvası, dünyadaki oyuncular + sanal
        tamamlama). Ayrıntı "Milli takımlar" bölümünde.
  - [ ] Sıradaki: IDEAS.md'den seçilecek.

## Arayüz ve konfor (10. aşama devam)
- Ayarlar (src/store/settings.ts, ui/appearance.ts, components/SettingsPanel.tsx): tarayıcıda saklanır (`fm.settings`), kayıt dosyasına girmez.
  Otomatik kayıt sıklığı, Devam'ı durduran haber türleri, maç hızı / kamera / anlatım, zemin ve vurgu rengi (`--accent`, `--accent-rgb`;
  stil dosyasındaki sarılar bu değişkene bağlı), yazı boyutu (CSS zoom), onaylar, bildirim süresi, kısayollar. Ana menüden de açılır.
- Klavye kısayolları (ui/hotkeys.ts): Boşluk = Devam (maçta başlat/duraklat), Alt+←/→, Ctrl+S, ekranlar için tek harf (SCREEN_KEYS), ? / F1 yardım,
  maçta +/-. Metin kutusunda ve pencere açıkken çalışmaz; Ayarlar'dan kapatılır.
- Grafikler (Puan Durumu > Grafikler): sıralama haftalara göre (rakip karşılaştırma) ve form eğrisi. Veri ui/chartData.ts, çizim components/LineChart.tsx.
- Maç ortasında kayıt: kayda canlı maç (MatchState) da yazılır (SaveData.liveMatch, SaveSlot.liveMatch etiketi); yüklenince maç ekranından kaldığı
  dakikadan sürer. Kayıttan sonra maç ilerlerse "kaydedilmemiş" sayılır (matchSignature). Kayıt biçimi sürümü değişmedi (alan isteğe bağlı).
- Denge raporu (`npm run balance`, src/tools/balance/): çok kariyer × çok sezon oynatıp maç, sezon, ekonomi, oyuncu yeteneği (uzun vade eğilim),
  Avrupa ve yönetim ölçülerini hedef aralıklarla karşılaştırır. Çıktı reports/balance/latest.md (+ latest.json, tarihli kopya; git'e girmez);
  bir sonraki koşu önceki latest.json ile kıyaslanır (fark sütunu, "gürültü" işareti). Hedefler metrics.ts'te: engine.test.ts / NOTES hedefleri,
  "referans" (gerçek lig, yaklaşık) ve "sınır" (kendi koruma sınırlarımız) olarak işaretli. Ayarlar: BALANCE_CAREERS (6), BALANCE_SEASONS (4),
  BALANCE_SEED (9000), BALANCE_CLUBS, BALANCE_OUT. 1 sezon ≈ 5–6 sn. Kullanıcı kulübü varsayılan taktikle otomatik oynar; kovulma kaydedilip kariyer
  yapay sürdürülür. Az gözlemde (n < 5) "hedef dışı" yerine "belirsiz" denir. Motor değişince: koşu → rapor → hedef dışı ölçülerin "bak:" ipucu.
- Bilinen: tam sezon testleri yavaş (FINDINGS.md > Testler).

## Denge düzeltmeleri (denge raporu bulguları)
- Kadro tamamlama (transfer/ai.ts `fillAiDepth`, `MIN_AI_SQUAD` = 24): kadrosu altına inen yapay zekâ kulübü (yurtdışı dahil, kullanıcı hariç) transfer
  döneminde serbest oyunculardan, kulübün ilk 11 ortalamasının 30 altı / 6 üstü aralığında, en çok ihtiyaç duyulan mevki grubundan ve maaş bütçesine sığan en iyi
  oyuncuyu bedelsiz alır; gün başına %35 (yurtdışı %17,5). Kendi rastgelelik akışı vardır (`DEPTH_SEED_SALT` + gün): mevcut akışı değiştirmez. Nedeni: alım kuralı yalnızca
  ilk 11 seviyesine yakın oyuncuları alıyor, sözleşme yenileme yalnızca sıra < `AI_RENEW_RANK` (22) olanlara; yedekler gidince kadrolar 28 → 20'ye küçülüyor, serbest
  havuz şişiyor, ligin ortalama CA'sı yapay yükseliyordu (FINDINGS.md > Denge).
- İşsiz oyuncuların emekliliği (season/rollover.ts `retirementChance`): 31+ yaş +%40; 24–30 yaş CA < 100 → +%25, değilse +%10 (24 altı yok). Serbest havuz ~250'de doyar.
- Maaş disiplini (transfer/market.ts, season/rollover.ts, transfer/ai.ts): yapay zekâ sözleşme yenilemesi zamsız (`aiRenewalWage` = max(adil, eski maaş)), yeni imza adil maaşla
  (`aiSigningWage`; `wageDemand`'ın eski maaş × 1,1 / × 1,05 zammı yalnızca kullanıcıyla pazarlıkta kalır). 30 Haziran'da yapay zekâ kulübü en iyiden başlayarak yeniler; maaş toplamı
  `wageBudget × WAGE_BUDGET_SLACK` (1,05) aşılırsa kadro sırası `CORE_RENEW_RANK` (11) ve üstündekiler gider. Alımlarda aday maaşı bütçeye sığmıyorsa elenir. Nedeni: zam sarmalı + üstel
  maaş formülü + bütçe kontrolsüzlüğü maaş gideri 10 sezonda ×2,6 yapıp kasaları eksiye indiriyordu (FINDINGS.md > Denge). Rapor "Ekonomi: nakit akışı" ölçüleriyle izler.
- Denge raporu bu iki sorunu kalıcı ölçülerle izler ("Oyuncu havuzu": kadro büyüklüğü, serbest havuz, havuz eğimi). Kullanıcı kulübü kadro ölçülerine girmez (ihmal ediliyor).

## Açık konular / ileride
- Duran top özellikleri (penaltı, korner) mevkiyle ilgisizse düşük çıkabiliyor — 10. aşamada denge.
- Beraberlik %25.4 (hedef %27; Süper Lig gerçeği ~%25). Daha fazlası gol ortalamasını düşürüyor.

- Oyuncu "transfer listesine koyma" yok; yapay zekâ ilgisi kendiliğinden geliyor.

## Sıradaki adım
10. aşama devam: kullanıcı IDEAS.md listesinden sıradaki maddeyi seçer (yapılanlar orada [x] işaretlenir).

## Altyapı kuralları (aşama 10, kullanıcı seçti: ayrı U19 takımı)
- Player.academy = U19 oyuncusu. clubPlayers() A takımı döndürür (U19 hariç): maç kadrosu, kadro ekranı, taktik,
  moral, transfer sıralamaları (squadRanks) U19'u saymaz. U19 haftalık gelişime katılır (DEFAULT_TRAINING).
- Başlangıç: her kulübe 7–9 kişilik U19 (15–18 yaş), ayrı rng (seed ^ ACADEMY_SEED_SALT) — ana dünya aynı kalır.
- 30 Haziran: U19 sözleşmeleri 1 yıl uzar. 1 Temmuz: manageAcademies (yapay zekâ: 19+ yaştakini A takımın
  22. oyuncusundan iyiyse alır, değilse oyuncu silinir; 17+ yaşta 16. oyuncudan iyiyse erken alır; A takım ≤ 28),
  kullanıcıya 19+ için haber; sonra academyIntake (her kulübe 4–6 kişi, 15–16 yaş; haber kategorisi 'academy').
- Genç potansiyeli: generatePotential yaşa bağlı pay + ek: %6 cevher (+20…45), diğerleri −5…+18.
  U19 PA medyanı ~109, %90'ı ≤ 137, 5 yıldız (≥ 158) ~%1 (academy.test denetler).
- U19'a gönderme: A takımdaki, kiralık olmayan, 19 yaşından küçük oyuncu. Transfer/kiralık/serbest bırakma
  oyuncuyu U19'dan çıkarır. Yapay zekâ başka kulübün U19'undan oyuncu almaz; kullanıcı teklif yapabilir.
- world.youthWatch: takip listesi (oyuncu silinince temizlenir). Biçim 6 dönüşümü: U19 kadroları, youthWatch,
  ilk gelişim kaydı.
- Arayüz: Altyapı ekranı (U19 Kadrosu / Gelişim / Ligdeki Gençler). Yetenek puanı gizli: grafiklerde sayı yok,
  "Son 6 ay" etiketi (Hızlı ≥ +10, İyi ≥ +4, Yavaş ≥ 0, Geriliyor). Başka kulübün oyuncusunda potansiyel gözlem
  tahmini (potentialStarsFor: oyuncuya sabit ±0.5 yıldız sapma) — kadro ekranı ve profilde de.

## Transfer / kiralık listesi kuralları
- Player.listing = { kind: 'transfer' | 'loan', price: number | null (null = önerilen), since }.
- Kullanıcı: kendi (kiralık olmayan) oyuncusunu listeler; transfer listesi moral −8 (bir kez). Önerilen bedel:
  transferde piyasa değerinin %90'ı, kiralıkta loanFeeAsk. Dönem açıkken listedeki oyuncu başına günlük %8 (yaz) /
  %6 (devre arası) teklif olasılığı, aynı anda tek açık teklif. Alıcı: kadrosu < 28, oyuncu ilk 11 ortalamasının
  −22…+12 aralığında, transferde bütçe ≥ bedelin %70'i. Teklif istenen bedelin %65–100'ü, gizli üst sınır %100–115.
  Gelen kiralık teklifi: completeAiDeal (kabul / karşı teklif kiralık olarak tamamlanır).
- Yapay zekâ: dönem açıldığı gün (ve yeni oyunda) refreshAiListings: kadro sırası 22+ ve 22+ yaş → satılık (≤ 3),
  21 yaş altı ve kadro sırası 16+ → kiralık (≤ 2). Satılıkta askingPrice ×0.8, kiralıkta loanFeeAsk ×0.6.
- Transfer / kiralık / serbest bırakma listeyi siler. Biçim 7 dönüşümü: dönem açıksa yapay zekâ listeleri.
- Arayüz: profilde liste düğmeleri ve ListDialog; Transfer Merkezi "Listem" sekmesi, aramada "Liste" filtresi,
  gelen tekliflerde tür; kadro ekranında etiket ve "Listede" filtresi.

## Yardımcı antrenör
- assistantAdvice(world): önem sırasıyla (Acil / Önemli / Öneri) öneriler. Türler: ilk 11'de sakat / cezalı /
  ayrılmış oyuncu (acil), mevkisinin yabancısı (verim < %85), yedekte yetenek × verimi 10+ iyi seçenek, maça ≤ 3 gün
  kala yorgun (< %80), mutsuz (moral < 30); dizilişteki mevkide yatkınlığı ≥ 15 oyuncu sayısı < gereken + 1
  (hiç yoksa acil); ilk 11'de bölge ortalaması takımın 8+ gerisinde (en zayıf bölge); en iyi 14 oyuncudan sözleşmesi
  sezon sonu bitenler (tek öneri; ocaktan önemli, nisandan acil); U19 yaş sınırı, A takım 18. oyuncusu seviyesindeki
  U19'lu; 6+ maçtır hiç oynamayan ≤ 21 yaş gençler (tek öneri); kadro > 30 / < 20; maaş bütçesi aşımı.
- Arayüz: AssistantPanel — Gelen Kutusu üstünde (ilk 4, "Tümünü göster"), Taktik ekranında ilk 11 ve mevki derinliği
  (yoksa gizli), maç öncesinde acil / önemli ilk 11 uyarıları. Bulunulan ekrana giden düğme gizlenir.

## Oyuncu görüşmeleri
- Talepler (pazartesi, playerRequests; eski şikâyet haberinin yerine): ayrılık (30+ gün moral < 25; unhappySince),
  forma şansı (moral < 30, sağlam, sözü yok), sözleşme (ilk 11 seviyesi; ekimden itibaren sözleşmesi sezon sonu
  bitiyor ya da maaşı talebinin %60'ından az). Oyuncu başına tek açık talep, talepler arası 45 gün (lastComplaint),
  haftada en fazla 1 yeni talep (ayrılık > forma > sözleşme, aynı türde en iyi oyuncu). Yanıt süresi 7 gün;
  yanıtsız kalırsa düşer, moral −8.
- Yanıtlar (respondToRequest): forma → söz ver (+12, söz takibe), yerini kazanmalı (profesyonellik ≥ 14: +3, değilse
  −6), kiralık listesi (+6); sözleşme → görüşelim (+4, yenileme penceresi), şimdi değil (−8), sözleşmesine uymalı (−12);
  ayrılık → transfer listesi (moral kaybı yok, +10), ayrılamaz (−15).
- Menajer görüşmeleri (talkToPlayer, oyuncu başına 14 günde bir): öv (form ≥ 7: +8, ≥ 6.5: +4, altı: −3, oynamadı: +1),
  eleştir (form ≥ 7: −12 haksız; profesyonellik ≥ 14: −2, < 10: −10, diğer −5), moral ver (moral < 50: +6, değilse +2),
  forma sözü (+10).
- Forma sözü (trackPromises, maç sonrası): oynayabildiği 5 maçın ≥ 3'ünde ilk 11 → +8; değilse −20 ve mutsuz sayılır.
  Sakat/cezalıyken oynanan maç sayılmaz. Yardımcı antrenör: bekleyen talep (acil), tehlikedeki söz (önemli).
- Arayüz: profilde Görüşme paneli (TalkPanel), kadroda "Görüşmek istiyor" etiketi. Biçim 8: requests, promises.

## Kaptanlık ve hiyerarşi
- Etki = liderlik ×1.5 + tecrübe (18 yaş sonrası yıllar, en fazla 14) ×0.8 + kadrodaki önem (yetenekte ilk 12) ×0.8 +
  kulüpte süre (en fazla 6 yıl) ×1.2 + kaptan 6 / yardımcı kaptan 3. Sıralama: ilk 2 takım lideri, 3 etkili, 5 saygın.
- Kulüpte süre: Player.joined (transfer / altyapıya katılış); oyun başından beri kulüpte olanlar oyuncuya göre sabit
  1–6 yıl (17 yaşından önceye gitmez) + oyun başından beri geçen süre (oyun başı = world.manager.joined).
- Tactics.viceCaptainId (biçim 9). Maçta kaptan sahada değilse yardımcı kaptanın liderliği (±%3); kaptan / yardımcı
  boşsa (otomatik, yapay zekâ dahil) ilk 11'in en yüksek liderlikli iki oyuncusu.
- Kaptan değişikliği (store.updateTactics → applyCaptainChange): eski kaptan −6 (lider/etkiliyse −12) ve haber; yeni
  kaptan +8; liderler varken saygın / diğer seviyesinden kaptan → her lider −4. Yardımcı kaptanda yarısı.
  Taktik ekranındaki "En iyi 11" kaptanları korur.
- Haftalık leadersInfluence: liderlerin moral ortalaması ≥ 70 → diğerleri +1; ≤ 35 → −2.
- Yardımcı antrenör: kaptan lider değil (öneri), liderler mutsuz (önemli). Arayüz: Takım Dinamikleri ekranı
  (kaptan / yardımcı seçimi, takımın havası, hiyerarşi tablosu); Taktik ekranında yardımcı kaptan seçimi.
- Not: kaptan değişikliği gol dağılımını değiştirmedi (40 sezon: gol kralı ort. 25.8, önce 25.6); istatistik testi
  15 sezonda en fazla bir 38+ uç sezona izin verir.

## Oyuncu geçmişi
- Player.career: sezon sonu (endSeason → recordSeasonCareers) her oyuncunun o sezon forma giydiği her kulüp için bir
  satır (maç, ilk 11, gol, asist, MA, kartlar, ort. puan; kiralıksa loan). Bu sezon canlı (currentSeasonRows).
  seasonStatsByClub fikstürü tek geçişte toplar. Oyun başından önceki kariyer yok (kurgusal dünya).
- Player.moves (en fazla 30): transfer (bedel) / serbest imza / kiralık (bedel) / kiralık dönüşü / serbest bırakılma /
  U19'dan A takıma — market.ts (transferPlayer, loanPlayer, returnLoans, releasePlayer) ve promoteToFirstTeam yazar.
- Profil: "İstatistikler" yerine tam genişlikte "Kariyer" (sezonlar + toplam) ve "Kulüp Geçmişi" paneli; kulüp adına
  tıklayınca o kulübün kadrosu. Biçim değişmedi (alanlar isteğe bağlı). Kayıt sezon başına ~50 KB büyür.
- Not: git stash / checkout core.autocrlf=true ile dosyaları CRLF yazabiliyor; düzenleme betikleri LF bekler.

## Gözlemci sistemi (kullanıcı seçti: aralık gösterimi, kendi kadro + maç bilgisi, görev listesi)
- Bilgi 0–100 yalnızca kullanıcı için (world.scouting.knowledge); yapay zekâ her şeyi bilir, motoru etkilemez.
  knowledgeOf: kendi oyuncumuz (U19, kiralık gelen dahil) ve bizde oynamış olan (moves/career) = 100; diğerleri
  max(ün, kayıtlı bilgi). Ün = (CA − 90) × 0.45 + (itibar − 30) × 0.25, 0–60; başka kulübün U19'u 0.
  Başlangıçta ligin çoğu 1–39, en iyiler ~50.
- Maç: kulübümüzün maçında forma giyen rakipler +20 (en fazla 75; tam bilgi yalnızca raporla) — applyResult.
- Görünüm: özellik aralığı genişliği 2 + (1 − k/100) × 8 (bilgi 0 → 10, tam → tek sayı); gerçek değer hep içinde,
  kayma oyuncu+özelliğe bağlı sabit oran. Yetenek tahmini ±20 × (1 − k/100), potansiyel ±(5 + 15 × (1 − k/100))
  (tam bilgide bile ±5). Tahminler "?" ile; kendi oyuncumuzda antrenör raporu kesin. Transfer aramasında özellik
  filtresi aralığın ortasıyla; başka oyuncunun gelişim grafiği yalnızca tam bilgiyle.
- Görevler (aynı anda 3; ücret transfer bütçesinden ve kasadan, finans dökümünde "Gözlemcilik"):
  oyuncu 7 gün €10 bin → 100; arama (mevki, en fazla yaş, en fazla değer) 14 gün €25 bin → en iyi 5 aday
  (CA + gençte (PA − CA)/2 ± 12 yanılgı) 100; kulüp taraması 21 gün €40 bin → A takım 80. İptalde ücret dönmez.
  Rapor günü önemli haber; en fazla 30 rapor. Emekli olanların bilgisi yeni sezonda silinir.
- Gözlemci görüşü (scoutVerdict): görünen yetenek, kadromuzda aynı mevki grubunun ilk 11 düzeyi (GK 1, DEF 4,
  MID 4, ATT 2. en iyi) ve yedek düzeyiyle (2 katı) karşılaştırılır → İlk 11'e girer / Rotasyon / Geleceğin
  oyuncusu (≤ 21 yaş, potansiyeli ilk 11 düzeyinde) / Kadroya katkı sağlamaz. Profilde bilgi ≥ 80 ise görünür.
- Arayüz: Transfer Merkezi → Gözlemciler (süren görevler, yeni görev, açılır raporlar); profilde "Gözlemci gönder",
  Gözlemci Raporu (bilgi çubuğu, tahminler, görüş); aramada Yetenek ve Bilgi sütunları.

## Yurtdışı kulüpleri (kullanıcı seçti: maç oynanmayan kulüpler, 8 ülke ~40 kulüp, gerçek adlar)
- data/foreign_clubs.json (clubs.json biçimi + `country`; itibar 1–130). İngiltere, İspanya, Almanya, İtalya,
  Fransa, Portekiz, Hollanda, Belçika; 40 kulüp. nations.json'a ENG / ITA (ağırlık 0: Süper Lig üretimi değişmez),
  names/en.json, names/it.json eklendi.
- Club.country varsa yurtdışı: divisionOf = 0 (Süper Lig / 1. Lig sorguları onları görmez), fikstür, tablo,
  küme yok. İtibar 100'ü geçebilir: devler ~120 → kadro seviyesi ~17 (ilk 11 ort. ~170; Galatasaray ~150).
- Kadrolar ayrı rng ile (FOREIGN_SEED_SALT) Türkiye dünyasından sonra üretilir: aynı tohumla Türkiye kadroları ve
  fikstür değişmez. Uyruk: kendi ülkesi ağırlıklı (ilk 11 %30–55, yedek %60, genç %85), yabancılar her ülkeden.
- U19 yok; her yaz A takıma 2–3 genç (17–18). Finans: maç geliri olmadığından yayın payı maaş bütçesinin %75'i.
- Pazar: istekliliği itibar belirler (oyuncu kendinden 20 puan, 30+ yaşta 30 puan düşük kulübe gitmez); devlerin
  yıldızları Türkiye'ye gelmez, 30+ yaşlılar gelebilir. Yurtdışı kulüplerinin günlük alım şansı Türk kulüplerinin
  %40'ı (FOREIGN_BUY_FACTOR). Ölçüm (bir sezon + yaz): Türkiye → yurtdışı ~8 transfer (€170–210 Mn), yurtdışı →
  Türkiye 6–12, yurtdışı kendi arasında 55–75. Yurtdışı kulüpleri arasındaki transferler habere düşmez.
- Hız: getClub önbellekli (WeakMap); yapay zekâ alımları kadro büyüklüklerini ve sıraları günde bir kez hesaplar.
  Oyuncu sayısı ~930 → ~2000; bir sezonun simülasyonu ~2 sn → ~3,3 sn (gün başına ~10 ms).
- Arayüz: kulüp seçicileri ülke ülke gruplu (ClubOptions); transfer araması ve gözlemci aramasında Bölge filtresi
  (Tümü / Türkiye / Yurtdışı / ülke); kulüp adının yanında ülke kodu; Altyapı → ligdeki gençler yalnızca Türkiye.
- Gol kralı uç değer testi: 15 sezonda en fazla iki 38+ (30 sezon ölçüm: yurtdışıyla ort. 26.9, yurtdışısız 25.3).

## Milli takımlar (kullanıcı seçti: yalnızca kulüp tarafı, eleme + yaz turnuvası, sanal oyuncularla tamamlama)
- Kayıt sürümü 14: world.international (InternationalState) + Player.intl { caps, goals }. Milli maçlar sezon fikstüründen
  AYRI (NationalFixture, ülke kodlarıyla); kulüp fonksiyonları (getClub, finans, yönetim) onları görmez.
- nations.json'a confederation, strength (1–100), colors; yeni ülkeler İsviçre, İskoçya, Çekya (ağırlık 0; names/cz.json).
  Ağırlığı 0 olan ülkeler de yurtdışı kulüplerinde ağırlık 3 sayılır, bu yüzden yeni ülkelerin dünyada oyuncusu olur.
  DİKKAT: yeni isim havuzu eklenince testler eski glob sonucunu önbellekten okuyabilir → node_modules/.vitest-cache silinir.
- Takvim: milli ara cumartesileri (breakSaturdays = isBreakWeekend: Eylül 1., Ekim/Kasım 2., Mart son hafta); maç günleri
  cuma (C−1) ve salı (C+3) — test 2026–2034 için kulüp maçı (lig, kupa turu, Avrupa aşaması) olmadığını denetler.
- Döngü: turnuva çift yıllarda (4'e bölünen Avrupa Şampiyonası, diğerleri Dünya Kupası), haziranda; turnuvadan sonraki
  1 Temmuz'da createInternational (internationalDay içinde) yenisini kurar, history taşınır. Turnuva yılı: elemelere yetecek
  milli gün kalan ilk çift yıl (yeni oyun 2028; Nisan 2027'de dönüştürülen kayıt 2030). Eleme kurası hemen: UEFA ülkeleri
  güce göre torbalarla en çok 5'li gruplara (34 ülke → 7 grup; bkz. Gerçek kadrolar), çember yöntemi + bay, çift devre = 10 maç günü = turnuva kurasından (1 Aralık,
  turnuvadan önceki yıl) önceki son 10 milli gün (yeni oyunda Kasım 2026 – Kasım 2027). Diğer milli günler ve elemede bay
  geçenler / UEFA dışı için hazırlık maçı (ayrı tohumlu rng ile eşleşme; Türkiye her milli günde oynar). Tüm fikstür
  döngü başında üretilir, yalnızca turnuva eleme turları sonradan.
- Turnuva: Avrupa 8 (8 UEFA ülkesi, qualifierRanking; 2 grup → yarı final → final), Dünya Kupası 16 (UEFA 8 + UEFA dışından güç + gürültü
  ile en iyi 8; 4 grup → çeyrek → yarı → final). Kura 1 Aralık; maçlar 10/14/18 Haziran (grup), 22 (çeyrek), 25 (yarı),
  29 (final), hepsi tarafsız; eleme turunda beraberlikte penaltılar (motorun knockout'u). Çeyrek: A1–B2, B1–A2, C1–D2, D1–C2.
- Güç (torbalar, Dünya Kupası seçimi): nationRating = kadronun en iyi 11'inin ortalama yeteneği (yurtdışı kulüplerindeki
  yıldızlar yüzünden ülkeler 156–183 arasında; Türkiye ~163–167).
- Sanal oyuncular: virtualPool — kulüp şablonu (25), seviye clubBaseLevel(strength × 1.25), döngü yılına göre tohumdan
  (kayda yazılmaz, önbellekte), id = −(kod karması × 100 + sıra + 1), clubId null. nationalPlayer pozitif/negatif id çözer.
- Kadro (selectSquad): ülkenin kulübü olan, sakat olmayan oyuncuları + sanal oyuncular; puan = yetenek + son 3 maç formu
  (±6); kota 3 KL / 8 defans / 8 orta saha / 4 hücum, eksik kalırsa kaleci dışı en iyiler. Türkiye kadrosunun çoğu dünyadaki
  oyunculardan (strength 64 bu yüzden düşük). Kulüp cezası milli maçı etkilemez (maçta kopya, suspension 0).
- Kamp: ilk maçtan 4 gün önce (pazartesi) kadrolar açıklanır (campAnnounced; çağrılana moral +3; oyuncumuz çağrıldıysa önemli
  haber, yoksa Türkiye kadrosu haberi). Oyuncu ülkesinin maç gününde onDuty'ye girer; ülkesinin 8 gün içinde maçı kalmayınca
  döner (turnuvada elenen erken döner); kamp bitince "Milli takımdan dönen oyuncularımız" haberi. Maç günü sakatlanan
  kadrodan çıkar (yerine sıradaki). onDuty yalnızca gösterim (MİLLİ etiketi): o günlerde kulüp maçı yok.
- Maç: motorla (arka planda, günün rng'si), ev sahibi avantajı elemede/hazırlıkta var, turnuvada yok. Etkiler: kondisyon,
  caps/goals, 7.5+ puana moral +2, sakatlık (injurePlayer 'international' → "milli maçta sakatlandı", önemli). Kart / form /
  ceza yok. Sonuçta goller ad ile (sanal oyuncu kayıtta yok) ve yalnızca kulübümüzün oyuncularının kaydı saklanır (kayıt boyutu).
  Bir milli gün ~14 maç, ~110 ms; sezon başına ~120 milli maç (+~1 sn simülasyon).
- Haberler ('international', clubId kullanıcı → gelen kutusunda): eleme kurası, kadro çağrısı, Türkiye maç sonuçları (Devam'ı
  durdurmaz), dönüş özeti, eleme sonucu (önemli), turnuva kurası, şampiyon (Türkiye finaldeyse önemli).
- Arayüz: sol menüde "Uluslararası → Milli Takımlar" (InternationalScreen): Takım (ülke seçimi, son kadro — sanal oyuncular
  soluk, kulüpsüz; maçlar, golcüler satırın üstünde), Elemeler (4 grup tablosu), Turnuva (gruplar + eleme turları), Oyuncularımız,
  Geçmiş. Profilde "Milli Takım: X maç, Y gol · şu an milli takımda", kadro/taktik durum etiketinde MİLLİ, gelen kutusunda
  "Milli Takımlar ›" bağlantısı. NationFlag: ülke renklerinde iki şeritli küçük bayrak.

## Gerçek kadrolar (kullanıcı seçti: Transfermarkt, kısa + isteğe bağlı ayrıntı, eksikler rastgele)
- data/squads/<kulüpId>.json (biçim data/README.md'de; tipler data.ts SquadPlayerData, doğrulama validateSquads).
  gameData.ts glob ile yükler. generateClubSquad dosya varsa realClubSquad'a gider (createWorld, yurtdışı kulüpleri ve
  eski kayıt dönüşümleri aynı yoldan) — yalnızca yeni oyunu etkiler, kayıt biçimi değişmedi.
- realPlayer: generatePlayer (seviye = ability, yaş doğumdan) + dosyadakiler (ad, doğum, mevkiler, ayak, özellikler,
  gizli özellikler, sözleşme 30 Haziran'a yuvarlanır, maaş, forma no, joined → hiyerarşide kulüpteki süre; oyun başından
  sonraki katılış oyun başı sayılır). CA özelliklerden yeniden hesaplanır; potential verilirse PA = CA + (pot − güç) × 10,5.
  Türkiye kulübünde ≤ 18 yaş ve güç < kulüp seviyesi − 3 → U19. A takım < 25 ise şablonun eksik mevki gruplarından
  (genç → yedek → ilk 11 rolleri) rastgele tamamlanır. Maaşı yazılanlar bütçeden düşülür, kalanı diğerlerine ölçeklenir.
- scripts/transfermarkt.mjs: TR1 + TR2 lig sayfalarından kulüpler (CLUBS: TM kimliği → oyun kimliği), kadro sayfası
  (kader/plus/1) curl ile (Node fetch engelleniyor), scripts/.cache'te 24 saat, istekler arası 3,5 sn. Güç = oyunun piyasa
  değeri formülünün tersi: CA = 17·ln(değer/1500), 29 yaş üstüne yıl başına +17·ln(1/0,82), gençte potansiyel payı düşülür;
  seviye = 1 + (CA − 1)·19/199 − 0,3. Değeri olmayan 150 bin € sayılır. İlk uyruk esas (bilinmiyorsa raporlanır).
  --info yeni kulüp için stadyum / kapasite / toplam değer yazdırır.
  Denge düzeltmesi (ilk sürümde 3,25 gol/maç, %21,8 beraberlik, gol kralı ort. 34 çıktı): mevki payı POSITION_OFFSET
  (KL +1,4, STP +0,6, bek +0,45, orta saha +0,2, 10 numara +0,3, kanat/forvet −0,25 — piyasa değeri hücumcuyu pahalı gösterir)
  ve 12,5 çevresinde ×0,72 sıkıştırma (TM'de büyük-küçük farkı oyunun ölçeğinden geniş). Sonuç (~4600 maç): 2,70 gol,
  %43,7 ev, %26,7 beraberlik, gol kralı ort. 25,1 (en çok 30).
- Kupa: Süper Lig + itibarı en yüksek 8 1. Lig kulübü (CUP_LOWER_CLUBS; 26 kulüp, 6 bay — eskisi gibi).
  fillAcademies gerçek kadrodan U19'a inenleri sayar (U19 yine 7–9). Gerçek A takımlar 25–38 kişi (yapay zekâ yeni sezonda 30'a indirir).
- Lig 2026/27'ye güncellendi: Çorum FK, Amed SK, Erzurumspor çıktı; Antalyaspor, Kayserispor, Karagümrük 1. Lig'e
  (itibar −5, bütçe ×0,5, maaş bütçesi ×0,6). 1. Lig artık gerçek 20 kulüp (kurgusallar silindi). Yeni kulüplerin itibarı
  kadro değerinden (log ölçek, mevcut kulüplere göre) tahmin, bütçeler benzer itibarlı kulüplerden.
- nations.json 29 → 85 ülke (Transfermarkt uyrukları). Yeni Nation.nationalTeam (false: milli takımı yok — küçük ülkeler,
  Rusya); milli takım sistemi nationalTeams(data) ile. Yeni havuzlar: hu, ro, gr, ar, al, ka, ru, ua, ko. Eleme grupları
  artık ülke sayısına göre (en çok 5'li; 34 UEFA → 7 grup); turnuvaya 8 UEFA ülkesi: qualifierRanking (önce grup
  birincileri, sonra en iyi ikinciler; puan, averaj, gol), metin qualifierRuleText.
- DİKKAT: yeni isim havuzu / kadro dosyası eklenince testler glob sonucunu önbellekten okuyabilir → node_modules/.vitest-cache sil.

## 2D saha akışı (kullanıcı istekleri: akıcılık, falso / yüksek top, top sürme, genişlik, baskı çubuğu, belirgin gol)
- Animasyon CSS geçişlerinden requestAnimationFrame döngüsüne taşındı (PitchView): oyuncu, top, gölge ve kamera her karede
  DOM'a doğrudan yazılır; React yalnızca gösterilen kare değişince (adlar, kartlar, etiketler) çizer. Hareket hesabı saf ve
  testli: ui/pitchMotion.ts — sampleScene (kareler arası easeInOut; girişte oyuncular önceki sahnenin son yerinden süzülür,
  önceki yoksa belirir), ballPath (ikinci dereceden Bézier: kontrol noktası yolun ortasından curl×2 yana; yükseklik parabol),
  ballTrack (kavisli iz), dominance. Yakın kamera topu üstel yumuşatmayla izler (CAMERA_LAG_MS 220). Ölçüm: ~60 fps (16,8 ms).
- pitchScene: FrameMove pass / lob / cross / dribble / shot; SceneFrame.curl, height (shapeBallPaths: korner ortası 6,5–8,5 m,
  kanattan ceza sahasına orta, 30 m+ pas havadan, serbest vuruş falsolu 3,5–6 m ve 2,2+ m yüksek, uzaktan şut biraz havadan,
  bazen üstten aut). Top sürme: oyun kurmada ve asistten önce (yarı yarıya), golcü bazen topu geride alıp şut yerine sürer.
  Bir anın en çok 8 karesi (MAX_PLAY_FRAMES). Süreler harekete göre (frameDurationMs: şut 520, pas 750, havadan/orta/sürme
  950–1000, sevinç 900 ms); LEAD_IN_MS 400; revealDelayMs (MatchScreen skoru bununla açıklar), sceneDurationMs.
- Sakin dakika: boş saha yerine soluk saha + baskı çubuğu (DominanceBar): iki takım renginde birbirini iten çubuk, sınırda top;
  dominance = son 10 dk, yeni dakikalar ağır (0,82^yaş), ataklar %60 + topa sahip olma (timeline harfi) %40.
- Büyük bant (bannerKind): GOL! (golcü, sevinç boyunca), PENALTI! (penaltı dizilişinden sonuca), PENALTI KAÇTI!, KIRMIZI KART;
  golde sahada beyaz parlama ve file sallanır; skor tabelası (ve tam ekran şeridi) gol olunca parlar (useGoalFlash).
- Genişlik: saha boyuna uzatılabilir (pitch.ts makeView(k), stretchFor; en çok MAX_STRETCH 1,4): x koordinatları k ile çarpılır,
  daire / yay / kale ölçüleri değişmez (uzun saha görünümü). cameraTransform / toScreen / screenUnit view alır. Tam ekranda skor
  ve olay şeritleri sahanın üstüne biner, saha ekranın tamamını kullanır.

## Taktik ekranı ve karşılaştırma (kullanıcı istekleri)
- Taktik: HTML5 sürükle-bırak (listeden oyuncu, dolu saha yeri, dolu yedek hücresi → saha yeri / yedek hücresi; hedefte oyuncu
  varsa yer değiştirir; sahadan / yedekten kadro listesine bırakılan kadro dışı — removePlayer). Tıkla-seç-tıkla da duruyor.
  Saha yerinde ve yedekte çift tık profili açar. Düzen: sol sütun (tactics-main) kadro + talimatlar + kaptan + uyarılar,
  sağ sütun saha + yedekler position: sticky (main.content kaydırılırken ekranda kalır). Yedekler sahanın sağında dikey liste
  (bench-side, kullanıcı isteği: sahaya yer kalsın); saha 100vh − 290px yüksekliğe sığar, en çok 560 px genişlik. Seçili oyuncunun
  düğmeleri (karşılaştır, kadro dışı) panel başlığında.
- Karşılaştırma en çok 4 oyuncu (engine/squad/compare.ts MAX_COMPARE; store toggleCompare son 4). Bileşenler
  ui/components/CompareDialog.tsx: CompareBar (seçilenler, Karşılaştır, Temizle; pencereyi açar) — Kadro ve Taktik ekranında
  (taktikte ⇆ sütunu ve seçili oyuncu için “Karşılaştırmaya Ekle”); CompareDialog 2–4 sütun (satırda tek başına en iyi değer
  vurgulu, pencere genişliği oyuncu sayısına göre), başlıkta çıkar düğmesi.
- Yardımcı antrenör notu: compareAdvice (saf, yapılandırılmış; metni arayüz kurar): pick (aynı mevki grubunda; yetenek + son
  3 maç formu, sakat seçilmez, yorgun geri düşer), best / close (fark < 4), future (≤ 23 yaş, potansiyeli en iyinin bugününü 8+
  geçen), inXI (kendi oyuncumuz ilk 11'de), fitsXI / rotation / prospect / notNeeded (başka kulübün oyuncusu, scoutVerdict),
  value (en iyiye 6 puan yakın, değeri en iyinin %60'ından az), injured, tired (< %75), unknown (bilgi < 45: gözlemci gönder),
  mixedPositions (farklı mevki grupları; öneri yok). Yetenek / potansiyel gözlemci tahmini (abilityEstimate).

## Menajer itibarı ve kariyer (kullanıcı seçti: geçmiş seçimi; itibar transferi ve yönetimi etkiler)
- Kayıt sürümü 15: ManagerInfo.background, reputation (1–100), reputationHistory ({ month, value }, ay başı; en çok 360),
  seasons (ManagerSeason: kulüp, sıra / hedef, G-B-M ve goller tüm maçlardan, kupalar, sezon sonu itibarı, sacked), bestWin /
  worstDefeat. engine/season/manager.ts. Dönüşüm: itibar = geçmiş (eski futbolcu 35) + şampiyonluk ×8 + kupa ×4 + Avrupa ×10;
  sezonlar arşivden (maç istatistikleri yok, “—”).
- Geçmiş (yeni oyunda seçilir): amatör 15, eski futbolcu 35, eski milli futbolcu 50, tecrübeli teknik direktör 65.
- Değişim: maç (reputationAfterMatch, applyResult'ta) — rakibin itibarı 5+ yüksek / denk / 5+ düşük: galibiyet +0.6 / +0.3 / +0.15,
  yenilgi −0.1 / −0.3 / −0.6, beraberlik +0.15 / 0 / −0.15 (penaltıyla kazanılan / kaybedilen eleme maçı galibiyet / yenilgi);
  Avrupa ×1.5, kupa ×0.8. Sezon sonu (managerSeasonEnd, endSeason'da görevden alma kararından önce): (hedef − sıra) × 1.5
  (±10), şampiyonluk +8, kupa +4, ŞL +12, AL +7, küme düşme −12. Görevden alınma −8 (managerSacked; sezon kariyere sacked).
  Ölçüm (tek sezon): hedefin 3 sıra gerisi ~−5, hedefin 1 sıra üstü ~+6.
- Etkiler: willingToJoin — alıcı kulübümüzse kulüp itibarına (itibar − 50) × 0.2 (±10). Yönetim: görevden alma eşiği
  sackThreshold = taban − (itibar − 50) × 0.1 (maç içi 10, sezon sonu 15 tabanı; itibar 100 → 5), yenilgide güven kaybı ×
  lossPenaltyFactor (itibar 100 → 0.8, 1 → 1.2).
- Arayüz: Yeni oyunda geçmiş kartları; sol menüde Kulüp → Menajer Kariyeri (ManagerScreen): itibar ve etiketi (Yerel < 30 ≤
  Bölgesel < 50 ≤ Ulusal < 70 ≤ Avrupa çapında < 85 ≤ Dünyaca ünlü), son 12 ay değişimi, aylık itibar grafiği (tek seri,
  üstüne gelince değer), kupa dolabı, rekorlar, sezon sezon kariyer tablosu. Kulüp Bilgisi'ndeki menajer kartında itibar ve “Kariyer ›”.

## Tesisler (kullanıcı seçti: dört tesis, yönetimden talep, seviye + inşaat süresi + bakım)
- Kayıt sürümü 16: world.facilities (FacilitiesState: Türkiye kulüplerinin seviyeleri training / youth / medical 1–10, kullanıcının
  inşaatları, reddedilen taleplerin günü); ExpenseCategory facilities ("Tesisler"). engine/finance/facilities.ts.
- Başlangıç: levelForReputation = 1 + itibar/100 × 8 (± kulübe bağlı sabit 1 sapma); yurtdışı kulübünde saklanmaz, itibardan (devler 10).
  Stadyum seviye değil kapasite: genişletme +5.000 koltuk (en çok 80.000), €1.200 / koltuk, en erken 5 ay sonraki 1 Temmuz'da biter.
- Tesis bedeli 200 bin × seviye^1.6 (5→6 ~€2,6 Mn, 9→10 ~€6,7 Mn), inşaat 3 + seviye/3 ay. Bakım (ay başı, tüm Türkiye kulüpleri):
  seviye başına €40 bin / yıl + 1000 koltuk başına €6 bin / yıl.
- Talep (requestFacility): kasa ≥ bedel × 1,3 + maaş bütçesi / 8 ve yönetim güveni ≥ 50 − (menajer itibarı − 50) × 0,3; onayda bedel
  kasadan, reddedilirse 60 gün bekleme; tür başına tek inşaat. Haber (board). facilitiesDay tamamlanınca seviye / kapasite + önemli haber.
- Etkiler: antrenman tesisi gelişim × (0,85 + 0,035 × seviye) (U19'da altyapı tesisi), antrenman sakatlığı × (1,15 − 0,03 × antrenman)
  × (1,15 − 0,03 × sağlık); sağlık merkezi sakatlık süresi × (1,2 − 0,04 × seviye), maç sakatlığı × (1,12 − 0,025 × seviye)
  (TeamSetup / TeamState.injuryRisk, checkInjury); altyapı tesisi U19 alımında seviye + (L−5)×0,25, ek potansiyel + (L−5)×2, cevher
  olasılığı × (0,6 + 0,08 L) (generateYouthPlayer bonus). Yapay zekâ kulüplerinin tesisleri sabit (yatırım yapmazlar).
- Arayüz: Kulüp → Tesisler (FacilitiesScreen): kasa, gereken güven, yıllık bakım; kart başına seviye çubuğu, ligdeki sıra, şu anki
  etki (oyundaki çarpanlardan), bir üst seviyenin bedeli / süresi / etkisi, "Yönetimden İste" ve süren inşaatın ilerlemesi;
  stadyumda ortalama seyirci ve doluluk.

## Kararlar, bildirimler, gezinme durumu (kullanıcı istekleri)
- Karar bekleyen konular (engine/decisions.ts pendingDecisions): oyuncumuza gelen teklif (pending), verdiğimiz teklife karşı
  teklif (countered), kabul edilen teklifte sözleşme görüşmesi (accepted), oyuncu görüşme talebi, yazın (Temmuz–Ağustos) U19 yaş
  sınırını geçen genç, sezonun son 14 gününde sözleşmesi 30 Haziran'da bitecek kadronun ilk 18'i (letContractExpire:
  world.dismissedDecisions, “gitmesine izin ver”). Store.advance: karar varken (ve bugün maçımız yokken) tarih ilerlemez,
  DecisionsDialog açılır (ilgili yere git; U19 ve sözleşme için kararı orada da ver). Motorun advance'ı engellemez (testler, otomatik oynatma).
- Devam'ı durduran haberler: store.newsAlert (haber id'leri) → NewsAlert (üstte ortada, vurgu çerçeveli; haber satırına tıklayınca
  gelen kutusunda o haber açılır, teklif haberinde Transfer Merkezi teklifler sekmesi; sonraki Devam'da kapanır). Toast üst ortada, büyük.
- Gezinme durumu: store.ui (anahtar "<ekran>.<ad>") + useUiState(key, initial). setScreen(screen, preset?) bölüm değiştirirse ui
  sıfırlanır (area); openPlayer / openReport / geri-ileri sıfırlamaz. Transfer Merkezi (sekme, arama filtreleri), Gelen Kutusu (filtre,
  seçili haber), Altyapı, Milli Takımlar, Kadro sıralaması, Avrupa sekmesi bununla. GameShell geri / ileri dönüşte kaydırma konumunu
  geri yükler (geçmiş sırası + sayfa anahtarına göre).
- 2D saha baskı çubuğu: maç bitince “Maç sona erdi / Son düdük: skor”, devre arasında “Devre arası”.
- Taktik sayfası: yardımcı antrenör ve “Taktik” başlık paneli (diziliş, Otomatik Seç, karşılaştırma) sol sütunda talimatların üstünde.

## Taktik özelleştirme (kayıt sürümü 17)
- Yeni takım talimatları (TeamInstructions): tackling (yumuşak/normal/sert), crossing (alçak/karışık/yüksek), freedom
  (disiplinli/normal/özgür), counterAttack, offsideTrap, playOutOfDefence, timeWasting, cornerStyle (ön direk/karışık/arka
  direk/kısa), freeKickStyle (kaleye/karışık/orta). Varsayılanlar motorda etkisiz; göç eski taktiklere varsayılanları ekler, motor
  da eksik alanları varsayılanla doldurur (newTeam). Etkiler instructionEffects'te (rakibin talimatları da girer: karşı atak hücuma
  kalkan rakibe, geriden oyun kurma yoğun prese karşı); yeni etki oppAttackChance (zaman geçirme iki tarafın atağını azaltır).
  TeamProfile'a hücumcuların hava topu, yaratıcılık, defansın pası / dikkati, sıkı markaj sayısı eklendi. 600 maçlık ölçümde
  tek talimatın gol farkına etkisi ±0,2 içinde, hepsinin bedeli var.
- Bireysel talimat (PlayerOrders: duty, channel, longShots, dribble, tightMarking, freeRole) mevkiye verilir: Tactics.orders
  (mevki sırası; varsayılan = null, hepsi varsayılansa []). resolveLineup → Lineup.starters[].orders → PlayerMatchState.orders;
  oyuna giren yedek çıkanınkini devralır. Motor: orderWeights (hücum/orta/savunma katkısı), orderShooting (şutçu seçimi; uzaktan
  şut talimatında uzaktan şut payı +0,2), orderCreating (asist). 2D saha: ordersShift (ileri/geri, kenar/orta kayma).
- Diziliş şekli artık önemli: fullWeights = dizilişin ağırlığı^0,7 × yapay zekâ dizilişlerinin ortalaması^0,3 (SHAPE_EXPONENT);
  çok forvetli diziliş hücumda biraz güçlü, savunmada zayıf. Yapay zekâ yalnızca eski 6 dizilişten seçer (AI_FORMATION_IDS);
  kullanıcıya 4-1-4-1, 4-4-1-1, 3-4-3, 4-3-1-2 eklendi.
- Özel diziliş: CustomFormation {slots, layout} (Tactics.custom, TeamSetup/TeamState.custom). slotsOf / layoutOf / formationName
  (satırlar yüksekliğe göre) her yerde FORMATIONS[...] yerine; positionAt(x, y) konumdan mevki (FV < 27 ≤ OOS < 42 ≤ OS < 57 ≤
  ÖL/KB < 67 ≤ DEF; kenar %28–32). Taktik ekranında “Dizilişi Düzenle”: yerler pointer olaylarıyla sürüklenir (kaleci sabit),
  sahada mevki bölgeleri görünür; moveFormationSpot oyuncuyu ve talimatı yerinde bırakır. Hazır dizilişe geçince özel bırakılır,
  bireysel talimatlar aynı mevkiye taşınır (carryOrders).
- Taktik setleri: Tactics.plans (3 set, TacticPlan {formation, custom, instructions, orders}) + activePlan; etkin set üstteki
  alanlardadır. switchPlan şimdikini kaydeder, seçileni yükler, ilk 11'i yeni mevkilere dağıtır; copyPlan. Maçta
  store.liveSwitchPlan → changeTactics({formation, custom, instructions, orders, plan}); TeamState.plan gösterim için.
  changeTactics artık özel diziliş ve bireysel talimat alır; slotHolders (mevki sırasına göre sahadakiler) 2D sahayla ortak.
- Duran top: Tactics.cornerTakerId, targetManId (TeamSetup / TeamState). Korner tarzı şut olasılığı / kalitesi (CORNER_STYLE),
  kısa kornerde yerden şut; kornerci varsa gol asistinin %80'i onun; hedef adam kafa vuruşlarının üçte birinden fazlasını alır;
  serbest vuruşta “orta” kafa vuruşuna çevirir. Varsayılan korner (karışık, kornerci seçilmemiş) eskisi gibi.
- Arayüz: InstructionsPanel (Hücum / Savunma grupları, aç-kapa talimatlar çip), SetPieceStyles, OrdersEditor, PlanPicker,
  FormationPicker (özel sekmesi). Taktik ekranı: set seçici + “Seti kopyala”, Oyuncu Talimatları paneli (sahada tıklanan
  oyuncu; ▲ ▼ • rozetleri), Kaptan ve Duran Toplar'a kornerci / hedef adam / tarzlar. Maç ekranı taktik paneli: set (A/B/C),
  diziliş, talimatlar, duran top.

## Şut ve ısı haritası
- Motor kaydı (yalnızca gösterim, rng kullanmaz): MatchState.shots / MatchResult.shots — her şut (dakika sayacı,
  ikinci yarı işareti, taraf, oyuncu, sonuç gol / kurtarıldı / aut / engellendi, tür kafa / uzaktan / serbest vuruş /
  penaltı, korner). Varsayılanlar (ilk yarı, normal şut) yazılmaz. Sayılar maç istatistiğiyle birebir (testli).
- MatchState.timeline / MatchResult.timeline: dakika başına bir harf (PLAY_CODES; küçük = ev sahibi, büyük =
  deplasman), devreler '|' ile ayrılır; decodeTimeline açar. Eski kayıtlardaki maçlarda ikisi de yok
  (harita "veri yok" der).
- Yer saklanmaz: ui/matchMaps.ts şutun çıktığı / gittiği yeri ve dakikanın top yerini 2D sahanın fonksiyonlarıyla
  (shotOrigin, ballSpot) türetir; haritadaki yer canlı sahada görülenle aynı. Aynı dakikadaki ikinci şut biraz kayar.
- Bileşen MatchMaps: Şut haritası (gol büyük dolu + çizgi, kurtarıldı dolu, aut halka, engellendi çarpı; üstüne
  gelince dakika, oyuncu, sonuç) / Isı haritası (dakika başına bulanık nokta, topa sahip takımın renginde; bölge payı:
  ev kalesi önü / orta / deplasman kalesi önü). Takım filtresi. Renk: çimde okunan ilk kulüp rengi, iki takım
  benzerse deplasmanın diğer rengi.
- Yerleri: maç raporunda İstatistikler'in altında; canlı maçta orta sütunda "Haritalar" (önemli an oynarken o anın
  şutu ve dakikası skor gibi gizli). Motor şut listesini yerinde büyüttüğünden canlı ekran her çizimde kopya verir.
- Kayıt: sezon sonunda ~4,55 MB'ın ~630 KB'ı şutlar, ~30 KB zaman çizelgesi (yalnızca bu sezonun fikstürü tutulur).
