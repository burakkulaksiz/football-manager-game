# Bulgular

Oynarken fark edilen eksikler ve düzeltilecekler. Çözülenler `[x]` ile işaretlenir; "Kanıt" satırı neye dayanıldığını gösterir.
Fikirler (yeni özellikler) için IDEAS.md'ye bak; ayrıntılar NOTES.md'de.

Son gözden geçirme: 2026-10-25 (kod ve git geçmişi okunarak; tarayıcıda elle denenmedi). Otomatik denge bulguları en altta.

## Karar ve bildirimler
- [x] Bir karar bekleyen konu varken (oyuncu teklifi, sözleşme yenileme, U19'dan A takıma alma, vb.) tarih ilerletilmez.
  - Kanıt: `advance` karar bekleyen konu varken ilerlemez ve karar penceresini açar (gameStore.ts); commit aca73d5.
- [x] Haber bildirimi daha belirgin olmalı.
  - Kanıt: Devam'ı durduran haberler için üstte haber kutusu (NewsAlert.tsx), tıklanınca habere ya da teklife gider; Ayarlar'dan kapatılabilir.
- [ ] 2D saha tam ekrandayken üstte çıkan bildirim skorun arkasında kalıyor.
  - Not: bildirim (NoticeToast) tam ekran öğesinin dışında çiziliyor; tam ekranda büyük olasılıkla hiç görünmüyor. Çözüm: tam ekran saha
    paneli içinde de bildirim göstermek ya da bildirimi fullscreen öğesine taşımak. Doğrulanmadı.

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
- [ ] 2D saha futbol topu siyah beyaz olsun.
  - Not: top şu an düz beyaz, 1 px siyah halka (`.pball-body`, styles.css). Siyah beyaz futbol topu deseni yok.
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
- [ ] Alt çubuk (footer) kalkmalı.
  - Not: StatusBar hâlâ GameShell'de çiziliyor (ekmek kırıntısı + haber bandı). Kaldırılırsa ekmek kırıntısı ve haber bandı için yer kararı gerekir.

## Testler
- [ ] Tam sezon simülasyonu testleri yük altında 30 sn'lik varsayılan zaman aşımına takılıyor; sonradan ele alınacak.
  - Gözlem (2026-10-25): tam test koşusunda `season.test.ts` "ikinci sezon da sonuna kadar oynanır" ve `career.test.ts`
    "sezon sonunda forma giyen herkesin sezonu yazılır…" zaman aşımına düştü. İkisi tek başına geçti, birlikte 38 sn sürdü.
    Aynı gün farklı koşularda bir seferinde 1, bir seferinde 2 test düştü.
  - Geçici çözüm: bu iki teste test başına 120 sn zaman aşımı verildi.
  - Yapılacak: testlerin neden bu kadar yavaş olduğuna bakmak (tam sezon simülasyonunu paylaşmak, daha küçük sezon / az kulüp
    ile aynı kuralı sınamak, ya da `playSeason`'u hızlandırmak). Kök neden henüz bilinmiyor; "yük" yalnızca olası açıklama.

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
- [ ] **Transfer hacmi hızla büyüyor:** Süper Lig kulüplerini ilgilendiren bonservisli transfer toplamı 181 → 272 → 365 → 477 Mn € (4 sezonda ×2,6), kulüp kasası medyanı sabit (~13 Mn €).
  - Transfer başına ortalama bedel son/ilk sezon oranı 1,49 (sınırımız 0,6–1,8 içinde, ama eğilim yukarı). Enflasyonla ilişkili olabilir (CA yükselince piyasa değeri yükselir).
  - Yapılacak: `transfer/market.ts` (piyasa değeri, bonservis formülü) ve `ai.ts` (yapay zekâ alım sıklığı) incele; kasa büyümediği hâlde hacmin büyümesi tutarsız.
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
  - Açık: ilk 11 CA eğimi 10 sezonda +1,1/sezon (sınır ±0,8; S8'den sonra düzleşiyor), en yüksek CA 171 → 184. Neden büyük olasılıkla "ligin dünyadan yetenek çekmesi" (Süper Lig başlangıçta 123, yurtdışı 151 ortalama CA);
    gerçekten sorun mu, yoksa yeni bir dengeye yaklaşma mı olduğu belirsiz.
- [ ] **Gol ortalaması uzun vadede yükseliyor (yeni, 3 × 10 sezon):** maç başına gol 2,7 (S1) → ~3,0 (S9–S10); hedef 2,45–2,75, en son koşuda ❌ (2,84 ±). Yetenek kaymasıyla birlikte; muhtemelen hücum yeteneği kaleci / savunmadan hızlı artıyor
  (`TUNING.goalBase`, `finishingExponent`; kaleci ve savunma ağırlıkları `engine.ts`).
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
