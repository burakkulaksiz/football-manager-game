# Yurtdışı kulüpleri ve milli takımlar

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

