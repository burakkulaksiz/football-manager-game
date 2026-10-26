# Bulgular

Oynarken fark edilen eksikler ve düzeltilecekler. Çözülenler `[x]` ile işaretlenir; "Kanıt" satırı neye dayanıldığını gösterir.
Fikirler (yeni özellikler) için IDEAS.md'ye bak; ayrıntılar NOTES.md'de.

Son gözden geçirme: 2026-10-25 (kod ve git geçmişi okunarak; tarayıcıda elle denenmedi). Otomatik denge bulguları en altta.

## Karar ve bildirimler
- [x] Bir karar bekleyen konu varken (oyuncu teklifi, sözleşme yenileme, U19'dan A takıma alma, vb.) tarih ilerletilmez.
  - Kanıt: `advance` karar bekleyen konu varken ilerlemez ve karar penceresini açar (gameStore.ts); commit aca73d5.
- [x] Haber bildirimi daha belirgin olmalı.
  - Kanıt: Devam'ı durduran haberler için üstte haber kutusu (NewsAlert.tsx), tıklanınca habere ya da teklife gider; Ayarlar'dan kapatılabilir.
- [x] 2D saha tam ekrandayken üstte çıkan bildirim skorun arkasında kalıyor.
  - Neden: tam ekranda skor şeridi (`.fs-bar`, top 10px, z-index 5) sahanın üstüne biniyor; sahadaki olay etiketi ("Korner", "Kurtarış"…, `.pitch-label`) de ortada top 16px'te
    duruyordu, geniş ekranda saha ekranı doldurduğu için tam şeridin arkasına düşüyordu. Ayrıca kısa bildirim (`NoticeToast`) tam ekran öğesinin dışında çizildiği için tam ekranda hiç görünmüyordu.
  - Düzeltme: tam ekranda olay etiketi şeridin altına (top 62px); bildirim tam ekran öğesinin içine (portal) çiziliyor ve etiketin altında (top 116px).
  - Doğrulama: gerçek CSS ve aynı işaretlemeyle 1920×1080 tam ekran düzeni ekran görüntüsünde üçü ayrı. Gerçek tarayıcı tam ekranında elle denenmedi (başsız tarayıcı tam ekrana giremiyor).

## 2D maç sahası
- [x] Akıcılık düşük, atlamalar var.
  - Kanıt: dakika içi sahne akışı ve GPU'da hareket eden oyuncular; commit 516d2b5.
- [x] Top falso almıyor, yüksekten gitmiyor.
  - Kanıt: pitchScene.ts top yüksekliği (uzun pas, orta, korner ortası havadan; `height`, 'lob' / 'cross').
- [x] Top sürme ve paslaşmalar daha iyi / gerçekçi olmalı.
  - Kanıt: 'dribble' hamlesi ve top taşıyıcı mantığı; commit 516d2b5.
- [x] Maç ekranı küçükken de büyükken de genişliği daha çok kaplamalı.
  - Kanıt: geniş saha; commit 516d2b5.
- [x] Önemli anlar gösterilmezken boş saha yerine baskı çubuğu (sağlı sollu birbirini iten çubuklar).
  - Kanıt: MomentumBar (MatchScreen.tsx); saha açıkken gizlenir, kapalıyken görünür.
- [x] Gol ve penaltı daha belirgin olmalı.
  - Kanıt: sahanın ortasında büyük gol / penaltı / kaçan penaltı / kırmızı kart bandı (PitchView.tsx, `bannerKind`).
- [x] Kornerin kullanıldığı gösterilmiyor.
  - Kanıt: korner sahnesinde kullanan oyuncu bayrağa gider, ceza sahası dolar ve sahada etiket çıkar (pitchScene.ts, `playLabel`).
    Kod okunarak doğrulandı, elle denenmedi.
- [x] 2D saha futbol topu siyah beyaz olsun.
  - Düzeltme: `.pball-body` (styles.css) beyaz zemin üstünde ortada bir, kenarlarda yarısı görünen beş siyah yama (CSS radial-gradient; ek görsel yok).
  - Doğrulama: --u = 6 / 9 / 14 / 20 / 40 px boyutlarında ekran görüntüsü; 9 px ve üstünde futbol topu olarak okunuyor. Yamalar yuvarlak (beşgen değil); topun sahadaki boyutunda fark edilmiyor.
- [x] Maç bittikten sonra denge çubuğunda "Galatasaray atakta" gibi yazılar çıkmasın; maçın bittiğini ifade etsin.
  - Kanıt: "maç sonu baskı çubuğu"; commit aca73d5.

## Taktik
- [x] Taktik saha görünümünde sürükle-bırak.
- [x] Taktik sayfasında saha görünümü sabit durmalı, scroll ile kaymamamalı.
  - Kanıt: `.tactics-pitch` `position: sticky`; commit 0663997 ve e5e19a8.
- [x] Saha görünümünde çift tık oyuncu profiline gitmeli.
  - Kanıt: `onDoubleClick={() => openPlayer(...)}` (TacticsScreen.tsx).
- [x] 2'den fazla oyuncu karşılaştırılabilmeli (en çok 4); taktik sayfasında da karşılaştırma olmalı; karşılaştırmada yardımcı antrenör notu.
  - Kanıt: `MAX_COMPARE = 4` (squad/compare.ts), Taktik ekranında `CompareBar`, "Yardımcı Antrenör" kutusu (CompareDialog.tsx); commit 0663997.

## Genel arayüz
- [x] Alt çubuk (footer) kalkmalı.
  - Düzeltme: `layout/StatusBar.tsx` silindi; konum yolu (yalnızca alt çubukta kullanılıyordu, `pageHeading.breadcrumb`) ve kayan sonuç / transfer bandı da kalktı.
    Sayfa başlığı üstteki haptan, sıradaki maç gezinme çubuğundan, sonuçlar Fikstür ekranından okunur. Sayfa düzeni esnek sütun: içerik alanı kendiliğinden alta uzar.
  - Doğrulama: oyun kabuğu sunucu tarafında çizilip 1400×820 ekran görüntüsünde alt boşluk yok.
- [x] Sol menü küçük ekranda sığmıyordu: 820 px yükseklikte "Milli Takımlar" ve "Ayarlar" görünür alanın dışındaydı.
  - Düzeltme (styles.css, ekran yüksekliği kuralları): ≤ 900 px'te menü satırları sıkılaşır, sıradaki maç kartında rozetler gizlenir (isimler yazıyor);
    ≤ 720 px'te kart tamamen gizlenir (sıradaki maç üst çubukta da yazıyor), menü biraz daha sıkılaşır. Kaydet / Ana Menü her zaman görünür.
  - Doğrulama: oyun kabuğunun sunucu tarafı çizimi 1400 × 820 / 700 / 660 px ekran görüntülerinde bütün menü maddeleri kaydırmadan görünüyor.

## Testler
- [x] **Tam test koşusu yavaştı (~3 dk): düzeltildi, 84 sn.** Yük altında tam sezon testleri 30 sn'lik zaman aşımına takılıyordu.
  - Motor (sonucu değiştirmeyen performans): `primaryPosition` hızlı yol, şutta `keeperUnit`, `teamUnits` ortalamaları toplam + sayıyla. Bir sezonun parmak izi (skorlar, oyuncu CA / kulüp,
    RNG durumu) önce / sonra birebir aynı; tek sezon 8,9 → 5,4 sn.
  - Gizli darboğaz: `match/engine.test.ts` istatistik doğrulaması için 15 tam sezonu `describe` gövdesinde (dosya toplanırken) oynatıyordu; tek başına 110 sn, ama süresi test raporunda
    görünmüyordu ve Vitest en uzun dosyayı en sona bırakabiliyordu. Simülasyon `beforeAll`'a taşındı, sezon sayısı 15 → 10 (3060 maç). Önce sezon sayısının etkisi ölçüldü:
    gol ortalaması 15 sezonda 2,732, 10 sezonda 2,739, 6 sezonda 2,755 (eşik 2,75 → 6 sezon testi kırardı); 10 sezonda bütün ölçüler eşiklerin içinde. Daha büyük örnek: `npm run balance`.
  - Tekrarlanan simülasyon kaldırıldı: gameFlow.test ("aynı seed ile aynı sezon sonuçları", iki tam sezon) ve season.test ("sezon geçişinde tekrarlanabilirlik", iki sezon + hafta) tek testte
    birleşti (`season/seasonDeterminism.test.ts`): önce sezon sonunda tüm fikstür ve milli maçlar, sonra yeni sezonun ilk haftaları karşılaştırılır (kapsam aynı, iki tam sezonluk iş eksik).
    Menajer kayıt dönüşümü testi ayrı dosyada (`managerMigration.test.ts`). `playUntil` artık `engine/testing.ts`'te.
  - Sonuç: tam koşu duvar saati 164–201 sn → 84 sn (iki ölçüm), 397 test. Dosya bölmek tek başına yardımcı olmadı (makine zaten dolu; toplam CPU işini azaltmak gerekti).
  - Kalan: `engine.test.ts` (~80 sn) artık duvar saatini belirliyor; milli maçlar sezon simülasyonunun ~%25'i. İki teste verilen 120 sn zaman aşımları güvenlik payı olarak kaldı.

## Denge (otomatik rapor)
Kaynak: `npm run balance`, 6 kariyer × 4 sezon = 24 sezon (7344 lig maçı), tohum 9000, 2026-10-25. Aynı ayarla tekrar koşunca sonuçlar birebir aynı çıktı
(motor deterministik). Aşağıdakiler küçük örnekle bulunan ilk sinyallerdir; kesinleştirmek için daha çok kariyer / sezonla (ör. 12 × 10) yeniden ölç.
Maç düzeyindeki ölçülerin tamamı hedef aralıkta: gol 2,74, ev galibiyeti %43,4, beraberlik %25,8, şut, korner, kart, penaltı, gol kralı 25,6.

- [x] **Yetenek enflasyonu (kadro büyüklüğü ve serbest havuz kaynaklı kısmı düzeltildi):** ilk 11 ortalama CA'sı sezon başına +1,66 (±0,17) artıyordu (sınırımız ±0,8).
  - Tanı (geçici tanı betiğiyle, 6 sezon): bireysel gelişim makuldü (aynı oyuncular 20–22 yaş +9, 26–28 yaş −2,4, 29–31 yaş −7 CA / 5 sezon). Dünya genelinde yetenek sabitti
    (yetişkin ortalama CA 131 → 135, ilk 500 oyuncu 165 → 166). Asıl neden kadro bileşimiydi: Süper Lig kadroları 28 → 20 oyuncuya küçülüyordu
    (yapay zekâ yalnızca sözleşme sırası < 18 olanları yeniliyor, alım kuralı yalnızca ilk 11 seviyesine yakın oyuncuları alıyordu; yedekler serbest kalıp geri alınmıyordu)
    ve serbest oyuncu havuzu 0 → 519'a şişiyordu. Yedekler gidince ligin ortalama CA'sı yapay yükseliyordu.
  - Düzeltme (`src/engine`): (1) `transfer/ai.ts` → `fillAiDepth`: kadrosu `MIN_AI_SQUAD` (24) altına inen yapay zekâ kulübü, transfer döneminde serbest oyunculardan
    kulübün seviyesine ve maaş bütçesine uygun yedek alır (kendi rastgelelik akışı, `DEPTH_SEED_SALT`; mevcut akışı bozmaz); (2) `season/rollover.ts`: yapay zekâ
    sözleşme yenileme sırası 18 → 22; (3) işsiz oyuncuların emeklilik olasılığı yaşa ve seviyeye göre artırıldı (`retirementChance`).
  - Sonuç (aynı tohumlar, 6 × 4): ilk 11 CA eğimi +1,66 → +0,65 CA/sezon (sınır içinde); Süper Lig kadro ortalaması 25,4; serbest havuz 10 sezonda ~250'de doyuyor
    (önceden 519'a sürekli büyüyordu). 3 × 10 sezonluk koşuda ilk 11 CA eğimi +0,78 (sınır içinde).
  - Raporda artık kalıcı ölçüler var: kadro büyüklüğü, serbest havuz, havuz eğimi, altyapı havuzu, dünya büyüklüğü eğimi ("Oyuncu havuzu").
  - Kalan: yetenek hâlâ yavaş yükseliyor (ligdeki en yüksek CA 171 → 187, 10 sezonda +2/sezon; 22–28 yaş ortalaması +1,3/sezon). Aşağıdaki fiyat enflasyonu bunu büyütüyor.
- [x] **Transfer hacmi hızla büyüyor:** aşağıdaki "Transfer fiyat enflasyonu" maddesiyle aynı kök (hacim = sayı × bedel; sayı sabit, bedel artıyor); orada izleniyor.
- [x] **Ekonomi uzun vadede bozuluyordu (maaş enflasyonu): düzeltildi.** 3 × 10 sezonda kasa medyanı +20 Mn €'dan −14,9 Mn €'ya iniyor, eksi kasalı kulüp oranı %30,7'ydi.
  - Tanı: nakit akışı kalemlerine bakınca net transfer harcaması medyanda ~0, diğer giderler sabitti; sızıntı **maaştı**: medyan maaş gideri 8,4 → 21,6 Mn € (×2,6), gelir ise sabit/düşüyordu.
    Nedenler: (1) `clubWageScale` (ödenen / ham maaş) ile `fairWage` birbirini besliyordu; yenilemede talep `max(adil, eski maaş × 1,05)`, yeni imzada `× 1,1` olduğundan maaş hiç düşmüyor,
    ölçek her yenilemede yukarı kayıyordu; (2) maaş formülü CA'ya üstel (`exp(CA/25)`): yavaş CA kayması bile maaşı büyütüyor; (3) yapay zekâ yenileme ve alımlarında maaş bütçesi hiç kontrol edilmiyordu.
  - Düzeltme: `transfer/market.ts` → `aiRenewalWage` (zam yok) ve `aiSigningWage` (adil maaş; eski maaşın ×1,1'i değil), `WAGE_BUDGET_SLACK` (1,05) ve `CORE_RENEW_RANK` (11);
    `season/rollover.ts` → sözleşme bitişlerinde yapay zekâ kulübü en iyiden başlayarak yeniler, maaş toplamı bütçenin 1,05 katını aşarsa çekirdek (ilk 11) dışındakileri bırakır; `transfer/ai.ts` → alımlarda maaş bütçesi kontrolü.
  - Sonuç (3 × 10 sezon): medyan maaş gideri 8,2–9,4 Mn € arasında sabit; net nakit akışı her sezon pozitif (+1,2…+4,9); kasa medyanı +43 Mn €'ya çıkıyor; kadro 23–25 oyuncu; serbest havuz ~240'ta doygun.
    6 × 4 sezon: eksi kasalı kulüp %11,8 → %2,1; net nakit akışı +3,8 Mn €; maaş/gelir 0,53.
  - Yan etki düzeltildi: ilk denemede (yalnızca bütçe sınırı) `wageDemand`'ın eski maaşın ×1,1'i serbest oyuncuları bütçeye sığdırmıyor, kadrolar 19'a iniyordu; imzada adil maaşa geçilince çözüldü.
  - Transfer fiyatları için bir sonraki maddeye bak.
- [ ] **Transfer fiyat enflasyonu (kısmen düzeltildi):** 3 × 10 sezonda transfer bedeli ortalaması 8,3 → 27,5 Mn €, medyan 4,8 → 16 Mn € (×3,3), hacim 159 → 1078 Mn €/sezon; transfer sayısı sabit (19–38).
  - Tanı: bedel / piyasa değeri formülü oranı neredeyse sabit (0,88 → 1,09), yani fiyat formülü değil, **transfer edilen oyuncuların kalitesi** artıyor: ortalama CA 139 → 157 (exp(18/17) ≈ ×2,9 bedel artışını açıklıyor).
    İki itici güç: (1) kasa birikip transfer bütçesine (`club.budget + fazla × 0,3`) sınırsız akıyordu (medyan kalan bütçe 1 → 7 Mn €); (2) ligin üst seviyesinin yavaş yükselmesi (ilk 11 CA 137 → 146, en yüksek CA 171 → 184).
  - Düzeltme: `season/rollover.ts` → `seasonTransferBudget`: yıllık transfer bütçesi, transfer dışı yıllık gelirin yarısını (`TRANSFER_BUDGET_INCOME_CAP`) aşamaz, temel bütçenin altına da inmez (`finance.ts` → `trailingIncome`).
  - Sonuç (3 × 10): ortalama bedel 27,5 → 19,9 Mn €, hacim 1078 → 578 Mn €; kadro, nakit akışı, serbest havuz değişmedi. Transfer edilenlerin CA'sı hâlâ yükseliyor (139 → 154): asıl itici güç üst seviye yetenek kayması, ayrı iş.
  - Dünya geneli (2026-10-25): elit katman ilk 6 sezonda şişiyordu (CA ≥ 170 oyuncu 127 → 171, CA ≥ 160 328 → 394). Neden: başlangıçta yurtdışı kadroları üretilirken
    "genç" rolü yıllık genç alımından (`generateYouthPlayer`) cömertti: seviye kulüp seviyesi − 3 (alımda − 4,5) ve sabit +5…+30 ek potansiyel. Başlangıçtaki yurtdışı gençlerin
    PA ortalaması 167,6 (%45'i ≥ 170), yıllık alımda 145,4 (%12). Bu ~100 "süper genç" ilk yıllarda potansiyeline ulaşıp elit katmanı şişiriyordu.
    Düzeltme: `worldGenerator.ts` → kadro şablonundaki gençler alımla aynı model (`YOUTH_LEVEL_GAP`, `youthExtraPotential`; tek çekiliş, rastgelelik akışının uzunluğu aynı;
    şablonu pratikte yalnızca yurtdışı kulüpler kullanıyor, 38 yurtiçi kulübün gerçek kadrosu var). Sonuç: dünya elit katmanı sabit (CA ≥ 170: 127 → 122, CA ≥ 160: 327 → 320, ilk 50 ort. 182,6 → 182,1).
  - Süper Lig eğilimi (ilk 11 CA +1/sezon, transfer edilenlerin CA'sı ve bedeller artıyor) için dört hipotez veriyle elendi (2026-10-25, 3 × 10 sezon, aynı tohumlar):
    (1) yurtdışı kulüpleri aynı itibarda daha güçlü → hayır, Türk kulüpleri eşit ya da güçlü (Galatasaray itibar 92 / ilk 11 160, Club Brugge 90 / 154);
    (2) lig yurtdışından net yetenek çekiyor → hayır, yeni "net yetenek akışı" ölçüsü sıfıra yakın ya da eksi (gelen 3–10, giden 4–16 oyuncu / sezon); yurtdışı alım hızını 0,4 → 1,0
    yapmak eğimi değiştirmedi (1,00 → 0,92, gürültü), uygulanmadı; (3) başlangıç altyapısı dengenin yarısı → altyapıyı denge büyüklüğünde başlatmak eğimi düzeltmedi (1,00 → 1,18), geri alındı;
    (4) gençlerin potansiyeli bugünkü yıldızlardan yüksek → hayır (17–21 yaş PA ort. 125,7 / ilk 30'u 151,8; 25–29 yaş CA ort. 128,3 / ilk 30'u 153,4).
  - **Sonuç: sarmal değil, tek seferlik yakınsama.** 2 × 20 sezonluk koşuda ilk 11 ortalaması 137 → 145 (S9) sonra S10–S20 boyunca ~141–149'da yatay; en yüksek CA S12'den sonra 190–191,
    22 yaş altı ~142–148'de sabit. Başlangıçtaki gerçek kadrolar simülasyonun dengesinin ~8 CA altında başlıyor, ilk ~9 sezonda dengeye çıkıyor. Motor değişikliği gerekmiyor; istenirse
    başlangıç gücü ayarlanabilir (gerçek kadroların yetenek eşlemesi). Bu madde fiyat / hacim açısından da kapanabilir: bedeller yakınsamayla birlikte artıyor (yine de uzun koşuda 20–27 Mn €'da dalgalanıyor).
- [ ] **Gol ortalaması uzun vadede yükseliyor (kısmen düzeltildi, neden tam bulunmadı):** 3 × 10 sezonda maç başına gol 2,7 (S1) → ~3,0 (S9–S10), 10 sezon ortalaması 2,85 (hedef 2,45–2,75).
  - Ölçüm: forvetlerin üst seviyesi kaleci ve savunmadan hızlı yükseliyor (her kulübün en iyi 3 forveti 137 → 149, en iyi kalecisi 136 → 142, en iyi 4 defansı 138 → 144);
    şut ve isabetli şut +%5, gol / isabetli şut dönüşümü sabit (~%28).
  - Elenen açıklamalar (geçici tanı betikleriyle): (1) gelişim formülü mevkiye göre dengeli: bir özellik puanı başına beklenen CA kazancı 0,55 (kaleci) – 0,62 (forvet);
    yalnızca gelişim kuralı 5 yıl işletilince ≤21 yaşta kaleci +19, forvet +16 CA; (2) başlangıçtaki yaş / potansiyel yapısı da açıklamıyor (kaleciler en genç grup, PA−CA farkı en büyük).
  - Bulunan ve düzeltilen bir asimetri: yapay zekâ alım eşiği tüm mevkiler için tek "ilk 11 ortalaması − 8" idi; CA ölçeği mevkiye göre farklı (başlangıçta kaleci ~115, defans ~124, orta saha ~125,
    forvet ~122) olduğundan kaleciler eşiğe zor ulaşıyordu. `transfer/ai.ts` → `groupLevel`: eşik artık alınacak mevki grubunun kendi seviyesi (kaleci en iyi 1, defans 4, orta saha 3, forvet 3).
  - Sonuç (3 × 10, aynı tohumlar): 10 sezon gol ortalaması 2,85 → 2,72 (hedefte; fark ~5 standart hata). **Ama** forvet üst seviyesi hâlâ kaleciden hızlı yükseliyor (137 → 150 vs. 138 → 141)
    ve son iki sezonda gol yine 2,85–2,93. Yani asimetri gerçekti ama tek neden değil. Sonraki adım: maç motorunda şut olasılığının hücum / savunma oranına duyarlılığı (`TUNING.threatExponent`)
    ve forvetlerin hangi yoldan (transfer mi, altyapı mı) üst seviyeye girdiği; ya da şut olasılığını lig ortalamasına göre normalize etmek.
- [ ] **Uzun vadede (10+ sezon) gol ortalaması sürekli tırmanıyor (yeni, 2 × 20 sezon):** 2,83 (S1) → S8–S11'de 2,9–3,15 → S16–S20'de 3,3–3,7. Lig yeteneği S10'dan sonra
  yatayken gol artmaya devam ediyor: yetenekten bağımsız bir mekanizma. Aynı dönemde kadrolar inceliyor (aşağıdaki madde); ince kadro → yorgunluk, rotasyon ve savunma zayıflaması olası bağlantı (doğrulanmadı).
- [ ] **Uzun vadede kadrolar yine küçülüyor (yeni, 2 × 20 sezon):** Süper Lig kadro ortalaması 27,5 → S10'da 24,1 → S20'de 21,6 (hedef `MIN_AI_SQUAD` 24); serbest havuz S12'den sonra yeniden
  büyüyor (232 → 354). Yedek tamamlama (`fillAiDepth`) 10 sezona kadar yetiyor, sonrasında yetmiyor; olası neden maaş bütçesi sınırı (kasa birikiyor ama maaş bütçesi sabit) ya da aday aralığı (seviye −30 / +6). İncelenecek.
- [ ] **Sonuncunun puanı düşük (belirsiz):** ilk ölçümde 16,5 (referans 18–32). Kullanıcı kulübü hariç yapay zekâ kulüplerinde 17,5 ±2,0 (düzeltme sonrası, 24 sezon): düşüklüğün bir kısmı
  ihmal edilen kullanıcı kulübünün sık sonuncu bitmesinden geliyordu. Hâlâ referansın biraz altında; daha çok sezonla doğrula (zayıf takımlar biraz fazla zayıf olabilir).
- [ ] **Şampiyon çeşitliliği az:** 24 sezonda yalnızca 3 farklı şampiyon, şampiyon–ikinci farkı ortalama 5,75 puan. Hedef tanımlı değil; gerçek Süper Lig'de de büyük 3–4 kulüp baskın, ama 3 çok az olabilir.
  Daha çok sezonla ölç (`BALANCE_SEASONS=10`).
- [ ] **İhmal edilen kulüp çöküyor (bilgi, hata olmayabilir):** kullanıcı kulübü otomatik oynarken sözleşme yenilemiyor, transfer yapmıyor; 6 kariyerin 6'sında görevden alındı
  (ilk kovulma çoğunlukla 3. yıl), Galatasaray örneğinde 4. yılda küme düştü. Bu, gerçek oyunda insan yönettiği için sorun değil; ama "yönetim sabrı" ve kulüp çöküş hızı için
  referans noktası. Rapor bunu "En az bir kez görevden alınılan sezonlar" olarak gösterir.
- [ ] **Raporun kendi eksikleri:**
  - Kullanıcı kulübü yapay zekâ gibi yönetilmiyor; talent / ekonomi ölçüleri bu kulüp yüzünden biraz bozuluyor (18 kulüpten biri). İstenirse kulüp, yapay zekâ kulübü gibi
    oynatılabilir (motorda böyle bir mod yok) ya da ölçülerden dışlanabilir.
  - Hedeflerin çoğu "referans" ya da "sınır"; kesin değil (bkz. `src/tools/balance/metrics.ts`).
  - Koşu sıralı (6 × 4 sezon ≈ 2 dk). Çok büyük örnek için kariyerleri paralel çalıştırmak gerekecek.

## Elle eklenenler (oynarken)

- [ ] Pozisyon gol olmadan, ekranda gol olduğu yazıyor.
- [ ] Top kornere çıkmadan korner kararı çıkıyor.
- [x] Penaltılar çok hızlı kullanılıyor: penaltı kararı ve kullanılması anlık oluyor.
  - Neden: pitchScene.ts'de faulden sonra tek kurulum karesi (700 ms, ortak 'none' süresi) ve hemen şut (520 ms) vardı;
    karar ile vuruş arası ~0.7 sn.
  - Düzeltme: kurulumdan sonra vurucunun topu yerleştirip 4 m geri çekildiği bekleme karesi eklendi; penaltının iki
    kurulum karesi `PENALTY_SETUP_MS` (1.3 sn) sürer. Karardan vuruşa ~2.6 sn; süreler sahne zamanıyla birlikte maç hızına
    göre ölçeklenir, anında bitirme sahne kullanmadığı için etkilenmez.
  - Kanıt: pitchScene.test.ts "penaltı anlık değil" testi (yazıldı, koşulmadı: doğrulanmadı). Tarayıcıda elle denenmedi.
- [ ] "Maça git"e tıkladığımda fikstüre mi gidiyor, ne oluyor; sonra "Devam" yazıyor, sonra bir daha "Maça git" yazıyor. Bu "Maça git" olayında bir sorun var gibi.
- [x] Maç esnasında bazen herkes sabitken bir oyuncu çok uzaktan başka bir yere geçiş yapıyor.
  - Neden (pitchScene.ts, 40 maçlık tarama): şutun sonuç karesinde topu taşıyan kalmadığı için şutu çeken dizilişteki yerine
    dönüyordu (20–35 m, 0.5 sn; maç başına ~2 kez). Ayrıca kart dakikanın faulünden şuta taşınınca kartı gören topun yanına
    koşuyordu, kornerde kullanan kafayı vuranla aynı oyuncu olabiliyordu, duran topta dizilişten çıkarılan "kullanan" kareden
    kareye değiştiği için diziliş karışıyordu (penaltı şutunda ~16 oyuncu yer değiştiriyordu).
  - Düzeltme: şutu çeken vurduğu yerde kalır; sahadaki kartı gören kendi yerinde kalır (yalnızca atılan topun yanına gelir);
    korneri kafayı vuran kullanmaz; duran topun kullanıcısı `SetPiece.takerId` ile sabit.
  - Kanıt: pitchScene.test.ts "ışınlanma yok" testi (eski kodda kırılıyor). Değişiklikte giren / kırmızı kartla çıkan
    oyuncunun kenara yürümesi bilinçli, değişmedi. Tarayıcıda elle denenmedi.
- [ ] Oyuncu ve taktik değişikliği tam ekrandan çıkmadan da yapılabilmeli.
- [ ] Maçtan sonra puan durumuna tıklayınca, maç Şampiyonlar Ligi ya da Türkiye Kupası maçı da olsa Süper Lig'e gidiyor.
- [ ] Beşiktaş gibi takımların isimlerini siyah yazdığımız zaman bazı yerlerde okunurluk düşük oluyor (örneğin maç durumu baskı çubuğunda).
