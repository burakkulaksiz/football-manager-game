# Yurtdışı kulüpleri ve milli takımlar

## Yurtdışı ligleri (2026-10-31: 8 ülkenin birinci ligi, gerçek 2026/27 kulüpleri ve kadroları, oynanır ve seçilebilir)
- data/foreign_clubs.json (clubs.json biçimi + `country`; itibar 1–130): İngiltere 20, İspanya 20, Almanya 18, İtalya 20,
  Fransa 18, Portekiz 18, Hollanda 18, Belçika 18 = 150 kulüp; hepsinin gerçek kadrosu data/squads/'ta
  (`node scripts/transfermarkt.mjs --foreign`; bkz. data-and-saves.md). Önceki 40 kulübün elle ayarlanan itibarı, bütçeleri
  ve beklentisi korundu; yeni 110 kulüp kadro değerinden: itibar = −156,6 + 13,0 × ln(değer) (40 kulübe uydurma, sapma ±3,4),
  transfer bütçesi değerin %10'u, maaş bütçesi %25'i, beklenti lig içindeki değer sırasından. Renk ve şehir betikte elle.
- **Ligler** (league/leagues.ts): Fixture.league = ülke kodu (lig maçında yoksa Süper Lig). Sezon fikstürüne Süper Lig'den
  sonra eklenir (generateForeignLeagues; createWorld ve 1 Temmuz rollover), çift devre, her ligin kendi tohumu
  (LEAGUES_SEED_SALT). Takvim pazar (Süper Lig cumartesi, kupa çarşamba, ŞL salı, AL perşembe, milli maçlar cuma / salı ile
  çakışmaz): 8 Ağustos'tan sonraki pazarlar, 24 Mayıs'a kadar, milli aralar atlanır; kış arası yalnızca gerekirse (20 takımlı
  ligler 38 hafta), o da yetmezse çarşambalar. Küme düşme yok (alt ligler oyunda değil). Tek sayıda kulüpte lig oynanmaz.
- **Oynatma** (gameFlow.playTodaysMatches): Süper Lig / kupa / Avrupa ana rng ile, yurtdışı lig maçları günün ayrı rng'siyle
  (leaguesRng: tohum ^ tuz ^ tarih) → Türkiye'nin sonuçları yurtdışı maçları yüzünden kaymaz. Tam motor ve tam etki (form,
  kondisyon, sakatlık, kart cezası, moral, finans). Kullanıcının liginde olmayan maçın sonucu etkiler işlendikten sonra
  sıkıştırılır (compactResult: skor, goller, takım istatistiği; oyuncu kayıtları, şut, ısı haritası yok). Sıkıştırmadan önce
  oyuncu kayıtları Season.tallies'e ("oyuncuId|kulüpId" → [maç, ilk 11, gol, asist, puan×10, MA, sarı, kırmızı]) eklenir:
  kariyer, oyuncu sezon istatistiği (seasonStatsByClub / playerSeasonStats `tallies` parametresi) ve o ligin krallık listeleri
  (tallyLeaders) buradan. Ölçüm: tam sonuç ~6,5 KB, sıkıştırılmış ~0,5 KB; dünya JSON'u başta 7,2 MB, bir sezon sonunda 12,7 MB.
- **Devam** yalnızca izlenen maç gününde durur (followedFixture: kullanıcının liginin maçı, kupa ya da Avrupa); başka liglerin
  oynadığı gün maçlar sessizce oynanıp geçilir (NavBar'da "Günün Maçları" da yalnızca izlenen maçta).
- **Sezon sonu**: SeasonSummary.leagues = yurtdışı final tabloları (şampiyon, puan); sıralama primi (prizeFor) yurtdışında da.
  Kullanıcının sırası, şampiyonluğu, yönetim ve menajer değerlendirmesi kendi liginde; küme düşme yalnızca Süper Lig'de.
  1 Temmuz: yurtdışı itibarı Süper Lig kuralıyla (şampiyon +3, ilk 4 +1, itibar sırasına göre ±1; 30–125), beklenti lig içindeki
  itibar sırasından (expectationForRank).
- **Avrupa** (europe.foreignQualifiers): ülke kontenjanı FOREIGN_EUROPE_SLOTS (ŞL / AL): İngiltere 3/2, İspanya 3/2, Almanya 2/2,
  İtalya 2/2, Fransa 2/2, Portekiz 1/1, Hollanda 1/1, Belçika 0/1 = 14 + 13 (Türkiye 2 + 3). Sıra geçen sezonun lig tablosundan,
  ilk sezonda itibardan; boş kalan yer itibar sırasıyla (ülke sınırıyla). Önceden AL'ye "ŞL dışındaki en zayıf yabancılar"
  alınıyordu (40 kulüpte); 150 kulüpte bu en küçük Belçika kulüplerini getirirdi.
- **Kullanıcı yurtdışı kulübünü yönetebilir** (yeni oyunda lig sekmeleri; İş Merkezi'nde yurtdışı koltukları da açılır):
  createWorld yurtdışı kulübünü kabul eder (taktik yurtdışı kulüpleri eklendikten sonra kurulur), kullanıcının yurtdışı
  kulübünün U19'u (fillAcademies ayrı akış, academyIntake) ve tesis kaydı (initialFacilityLevels; takeJob'da da) olur, yaz
  genç katılımı (foreignIntake) ona uygulanmaz. Yönetim güveni / sırası (board.userPosition) kullanıcının liginden.
  Türkiye Kupası'na yurtdışı kulübü katılmaz.
- Club.country varsa yurtdışı: divisionOf = 0 (Süper Lig / 1. Lig sorguları onları görmez). İtibar 100'ü geçebilir: devler
  ~118–120. Gerçek kadrolarla ilk 11 ortalaması: Real Madrid / Manchester City güç ~16,5, Brentford ~15, Málaga ~13,
  Marítimo / Telstar ~11 (Galatasaray 159 CA ≈ 16).
- Eksik kadro üretimi (25'ten az) ayrı rng ile (FOREIGN_SEED_SALT). Uyruk: gerçek kadrolarda kendi ülkesi ~%40. Eksik 42 uyruk
  nations.json'a eklendi (ağırlık 0, `nationalTeam: false`: milli turnuvalar değişmez; Japonya için names/jp.json).
- U19 yok (kullanıcınınki hariç); her yaz A takıma 2–3 genç (17–18). Finans: yayın payı maaş bütçesinin %55'i (FOREIGN_TV_SHARE;
  ligler oynanmadan önce bilet geliri yoktu, %75'ti). Ölçüm (bir sezon, %75'te): kasa maaş bütçesinin ort. +%72'si kadar arttı,
  Türkiye kulüplerinde +%52; lig başına İngiltere +%31 … Hollanda +%115 (küçük maaşlı ligde bilet ağır basıyor).
- Hız: maç günü kulüp → kadro dizini (withSquadIndex; clubPlayers 5600 oyuncuyu taramaz), chooseFormation yedekleri kurmaz
  (aynı sonuç). Oyuncu ~2400 → ~5600, sezonda ~450 → ~3100 maç (+1. Lig); bir sezon ~5,6 sn → ~16 sn (Node, Vitest'te ~18 sn).
  Maç başına ~3,3 ms: çoğu motorun kendisi (teamUnits, simulateMinute); kurulum ~1 ms.
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
  güce göre torbalarla en çok 5'li gruplara (34 ülke → 7 grup; bkz. data-and-saves.md > Gerçek kadrolar), çember yöntemi + bay, çift devre = 10 maç günü = turnuva kurasından (1 Aralık,
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

