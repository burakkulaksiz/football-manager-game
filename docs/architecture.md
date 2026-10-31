# Mimari: komutlar, yığın, dosya haritası

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
data/                  Elle düzenlenebilir JSON (bkz. data-and-saves.md > "Veri formatları")
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
  league/leagues.ts    Ligler: lig adı, kullanıcının ligi, ligin kulüpleri / maçları / tablosu, yurtdışı fikstürü ve takvimi,
                       sıkıştırılmış sonuç + oyuncu sayaçları, sezon sonu tabloları (bkz. world.md > "Yurtdışı ligleri").
  league/europe.ts     Avrupa kupaları (ŞL / AL): katılım (turkishQualifiers, foreignQualifiers), kuralar (europeDay), grup tablosu
                       (groupTable → standings.tableFrom), iki maçlı eşleşme (aggregateScore, tieWinner), ödüller.
  league/competitions.ts Organizasyon etiketleri: competitionName, stageLabel, fixtureLabel, shortFixtureLabel.
  league/international.ts Milli takımlar: döngü (createInternational), sanal oyuncular (virtualPool), kadro (selectSquad),
                       milli maçlar ve kamp (internationalDay), elemeler / turnuva tabloları (bkz. world.md > "Milli takımlar").
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
  layout/              GameShell, Header, NavBar, Sidebar, pageHeading (başlık hapı; alt çubuk kaldırıldı)
  screens/             MainMenu, NewGameScreen, SquadScreen, PlayerProfile, ClubInfoScreen,
                       FixturesScreen, TableScreen, StatsScreen, MatchScreen, TacticsScreen, TransferScreen
                       (ara / teklifler / haberler), FinanceScreen, TrainingScreen, InboxScreen, LoadGameScreen
  components/          ClubBadge, Shirt, OutcomeBox, InstructionsPanel (FormationPicker + talimatlar; taktik
                       ekranı ve maç içinde ortak), Modal (portal ile body'ye), NoticeToast, SaveDialogs,
                       TransferDialogs (OfferDialog, ContractDialog, CounterDialog), Stars, StatusTags,
                       GameOverOverlay
  styles.css           Tema; renkler CSS değişkenleri olarak (bkz. ui.md > "Görünüm")
```
Testler kaynak dosyaların yanında: `src/**/*.test.ts` (node ortamı).

