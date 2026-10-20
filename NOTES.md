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
  match/state.ts       Canlı maç durumu tipleri (düz veri, serileştirilebilir), dakika gösterimi.
  match/formation.ts   6 diziliş + saha yerleşimi (FORMATION_LAYOUT), mevki uyumu (slotFit = yanlış mevki cezası),
                       otomatik ilk 11 + 9 yedek, chooseFormation (yapay zekâ), assignToFormation.
  match/tactics.ts     Takım talimatları + motora etkileri (instructionEffects), kullanıcı taktiği (Tactics),
                       kadro düzenleme yardımcıları (placePlayer, removePlayer, changeFormation, resolveLineup).
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
  migrate.ts           Eski kayıt dönüşümü (CURRENT_WORLD_VERSION = 5; migrateWorld GameData de alır).
  squad/training.ts    Antrenman odağı/yoğunluğu ve etkileri (INTENSITY_EFFECTS, FOCUS_ATTRS).
  squad/injuries.ts    Sakatlık türleri, maç/antrenman sakatlığı, günlük iyileşme.
  squad/discipline.ts  Kart cezaları (maç sonrası).
  squad/morale.ts      Maç sonrası moral, günlük ortalamaya dönüş, şikâyetler.
  squad/development.ts Haftalık gelişim/gerileme (pazartesi).
  squad/condition.ts   Günlük kondisyon toparlanması.
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
- **Taktik:** 6 diziliş (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-5-1) + talimatlar: mentalite (−2…+2),
  pas (kısa/karışık/uzun), tempo, pres, savunma hattı. Etkiler çarpan olarak (`instructionEffects`):
  hücum → atak/şut ↑ ama rakibe açık; kısa pas → top hakimiyeti (pas kalitesine bağlı) + kaliteli şut;
  uzun → atak ↑, kafa payı ↑, top kaybı; hızlı tempo → atak ↑, yorgunluk ↑; yoğun pres → rakip
  top hakimiyeti ↓, faul ve yorgunluk ↑; yüksek hat → rakip forvetler hızlıysa gol riski ↑; derin hat →
  rakip daha çok ama daha kötü şut. Varsayılan talimatlar etkisiz (denge testleri bununla).
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
- `data/lower_league.json` — kurgusal 1. Lig kulüpleri (clubs.json ile aynı biçim, en az 3). Oyunda
  `division: 2`; kadroları oyun başında üretilir. Küme düşen Süper Lig kulübü de buraya iner.
- **Kayıt** (IndexedDB, Dexie şema sürümü 2): `saves` = SaveSlot `{ id, name, careerId, clubId, clubName,
  gameDate, season, isAutosave, createdAt, updatedAt, formatVersion, managerName? }`; `saveData` = `{ id, world: GameWorld }`
  (aynı id). GameWorld olduğu gibi yazılır (düz veri), kayıt anında `structuredClone` ile kopyalanır.
  `SAVE_FORMAT_VERSION = CURRENT_WORLD_VERSION` (şu an 5). GameWorld yapısı değişince sürümü artır ve
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
  - [ ] Sıradaki: FIKIRLER.md'den seçilecek.

## Açık konular / ileride
- Elle gerçek kadro girişi (ör. `data/squads/<kulüpId>.json`) yok; kullanıcı "şimdilik gerek yok" dedi.
- Duran top özellikleri (penaltı, korner) mevkiyle ilgisizse düşük çıkabiliyor — 10. aşamada denge.
- Beraberlik %25.4 (hedef %27; Süper Lig gerçeği ~%25). Daha fazlası gol ortalamasını düşürüyor.
- Belki ileride (kullanıcı "sonra ekleriz belki" dedi): maç ortasında kayıt (liveMatch'i de yazmak).

- Oyuncu "transfer listesine koyma" yok; yapay zekâ ilgisi kendiliğinden geliyor.

## Sıradaki adım
10. aşama devam: kullanıcı FIKIRLER.md listesinden sıradaki maddeyi seçer (yapılanlar orada [x] işaretlenir).
