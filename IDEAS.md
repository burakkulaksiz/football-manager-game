# Fikir Listesi (IDEAS)

Ara ara buradan seçip devam ediyoruz. Yapılanlar `[x]` ile işaretlenir; ayrıntılar NOTES.md'de, oynarken bulunan eksikler FINDINGS.md'de.

## Maç
- [x] 2D saha görünümü (top ve oyuncu noktaları)
  - [x] **Dakika içi akış:** her dakikayı tek karede değil, 3–5 adımlık kısa bir sahne olarak oynatmak
        (pas → pas → orta → şut). Topun izlediği yol görünür, oyun "akıyor" hissi verir.
  - [x] **Top taşıyıcı:** topun her an bir oyuncuda olması; top o oyuncunun ayağında durur, pas çizgisiyle diğerine geçer.
  - [x] **Olay oyuncuları gerçek:** faul yapan, kart gören, asist yapan, kurtarış yapan kaleci sahada vurgulanır
        (motordan oyuncu kimlikleri de `lastPlay`'e eklenir).
  - [x] **Duran top sahneleri:** korner ve serbest vuruşta oyuncular kurulu pozisyona geçer (baraj, kale önü kalabalığı),
        penaltıda herkes ceza sahası dışında bekler.
  - [x] **Gol sonrası:** golü atan oyuncu köşe bayrağına koşar, takım arkadaşları toplanır; ardından santra dizilişi.
  - [x] **Taktiğe göre şekil:** mentalite (hücum/defans), savunma çizgisi, genişlik ve pres talimatları blok derinliğini
        ve genişliği değiştirir; kullanıcı taktiğinin etkisi sahada görünür.
  - [x] **Kart / sakatlık / değişiklik görselleri:** oyuncunun üstünde sarı/kırmızı kart simgesi, atılan oyuncu sahadan
        çıkar, sakat oyuncu yerde, değişiklikte yeni numara kenardan girer.
  - [ ] **Oyuncu üzerine gelince bilgi:** isim, mevki, kondisyon ve maç puanı; tıklayınca değişiklik seçimi.
  - [x] **Isı haritası / şut haritası:** maç içinde ve maç raporunda, takımın şutları (gol/isabet/aut) ve top hakimiyeti bölgeleri.
  - [x] **Kamera seçenekleri:** tam saha / topu takip eden yakın görünüm; tam ekran saha modu.
        (Büyük saha yapıldı: maç ekranında tam genişlik, ekrana sığan yükseklik.)
  - [x] **Görsel cila:** forma renginde iki renkli nokta (forma + şort), kale fileleri, top gölgesi, gol anında ağ sallanması,
        çim desenine güneş/gölge.
  - [x] **Sadece önemli anlar modu:** FM'deki gibi sakin dakikaları atlayıp atak, şut ve duran topları sahada göstermek.
  - [x] **Performans:** oyuncuları HTML katmanında (GPU'da hareket eden) çizmek; yavaş makinede bile akıcı geçiş.
- [ ] Ses (kodla üretilen + gerçek kayıtlar; düdük, gol, uğultu, açma/kapama)
- [x] Maç ortasında kayıt (maçın o anki durumu kayda girer; yüklenince maç kaldığı dakikadan devam eder)
- [ ] Devre arası konuşması (moral etkisi)
- [x] Duran top talimatları (kornerci, hedef adam; korner ön/arka direk/kısa, serbest vuruş kaleye/orta)
- [x] Oyuncuya bireysel talimat (görev: geride kal / destek / ileri çık; içe kat / kanada aç, uzaktan şut, top sür, sıkı markaj, serbest rol)
- [x] Yeni takım talimatları (karşı atak, ofsayt taktiği, geriden oyun kurma, zaman geçirme, müdahale sertliği, orta tercihi, yaratıcılık)
- [x] Kendi dizilişini oluşturma (sahada yerleri sürükleyerek) + 4 yeni hazır diziliş
- [x] Taktik setleri (A/B/C; maç içinde setler arası geçiş)

## Kadro ve oyuncu
- [x] Oyuncuyu transfer listesine / kiralık listesine koyma (yapay zekâ kulüpleri de fazlalıklarını listeler)
- [x] Altyapı ekranı ve genç oyuncu takibi (ayrı U19 takımı, gelişim grafikleri, ligdeki gençler + takip listesi)
- [x] Yardımcı antrenör tavsiyeleri ("şu mevkide eksiğin var")
- [x] Oyuncu görüşmeleri (moral, şikâyet, kontrat isteği; ayrılık talebi, forma sözü takibi)
- [x] Kaptanlık ve takım içi hiyerarşi (yardımcı kaptan, Takım Dinamikleri ekranı)
- [x] Oyuncu geçmişi (sezon sezon maç/gol, eski kulüpler)

## Transfer
- [x] Gözlemci sistemi (bilinmeyen oyuncuların özellikleri gizli, gözlemciyle açılır)
- [x] Yurtdışı ligleri ve yabancı kulüplerden transfer (maç oynanmayan 40 kulüp, 8 ülke)
- [ ] Satın alma opsiyonlu kiralık, sonradan satış payı gibi sözleşme maddeleri
- [x] Menajer pazarlığı / oyuncu ajanları (menajerlerin oyuncu önermesi hariç)

## Lig ve rekabet
- [x] Türkiye Kupası (tek maç eleme, beraberlikte penaltılar; uzatma yok)
- [x] Avrupa kupaları (Şampiyonlar Ligi, Avrupa Ligi; 4'lü gruplar, iki maçlı eleme, tek maç final)
- [x] Milli takım ve milli maç arası (yalnızca kulüp tarafı: çağrılar, elemeler, iki yılda bir yaz turnuvası)
- [ ] 1. Lig'in gerçekten oynanması (şu an çıkanlar rastgele seçiliyor)
- [x] Gerçek kadrolar (`data/squads/`; Transfermarkt 2026/27, gerçek Süper Lig ve 1. Lig)

## Kulüp ve menajer
- [ ] Başka kulüplerden iş teklifi, istifa, işsiz kalıp yeni iş arama
- [x] Menajer itibarı ve kariyer geçmişi ekranı (geçmiş seçimi, transfer ve yönetime etkisi)
- [x] Tesis yatırımı (stadyum, antrenman tesisi, altyapı, sağlık merkezi; yönetimden talep, inşaat süresi, bakım)
- [ ] Taraftar memnuniyeti
- [ ] Basın toplantısı ve medya

## Arayüz ve konfor
- [x] Ayarlar ekranı (maç hızı, otomatik kayıt sıklığı, zemin ve vurgu rengi, yazı boyutu, onay ve uyarılar)
- [x] Klavye kısayolları (Boşluk = Devam, Alt+←/→ geri-ileri, Ctrl+S kaydet, harfle ekranlar, maçta Boşluk ve +/-, ? yardım; Ayarlar'dan kapatılır)
- [x] Grafikler (Puan Durumu > Grafikler: sıralamanın haftalara göre seyri, rakip karşılaştırma; form eğrisi)
- [ ] Haber ve mesajlarda arama
- [ ] Mobil / dar ekran uyumu

## Teknik
- [ ] Kayıt dosyasını dışa/içe aktarma (.json yedek)
- [ ] PWA: internetsiz, uygulama gibi açılan sürüm
- [ ] Hata günlüğü ve yedek otomatik kayıt slotları

## Mimari ve backend (beyin fırtınası, 2026-10-25)

Bağlam: oyun bugün tamamen tarayıcıda çalışıyor (React + Zustand arayüz, saf TypeScript motor, kayıtlar IndexedDB'de Dexie ile).
Motor `src/engine` altında ve arayüz, store ya da depolamaya hiç bağımlı değil; veriyi `GameData` nesnesi olarak dışarıdan alıyor
(dosya okuma `src/gameData.ts` içinde, Vite'a özgü `import.meta.glob` ile). Rastgelelik tek yerden geçiyor (`Rng`, `seed` + `rngState`),
yani motor deterministik: aynı tohum ve aynı kararlar aynı sonucu verir. Bu iki özellik aşağıdaki fikirlerin çoğunu mümkün kılıyor.

**Önce verilecek karar:** proje kişisel mi kalacak, yoksa başkalarına da açılacak mı? Hesap, liderlik tablosu ve hile önleme
yalnızca yayınlanacaksa anlamlı. Bulut kayıt ve mimari düzenleme her iki durumda da işe yarar.

**Neden hemen backend değil:** tek oyunculu bir oyunda sunucu, çözdüğü somut bir sorun yoksa yalnızca bakım yükü getirir.
Aşağıdaki sıralama, önce sunucusuz kazançları, sonra sunucu gerektirenleri alıyor.

- [ ] **Motoru ayrı pakete çıkarmak (monorepo)**
  - Ne: `packages/engine` (motor + veri doğrulama), `apps/web` (şimdiki arayüz). İleride `apps/server` aynı motoru import eder.
  - Neden: motor zaten bağımsız, ayrım ucuz; sunucu ve istemci birebir aynı simülasyon kodunu paylaşır, sürüm kayması olmaz.
  - Dikkat: `gameData.ts` içindeki `import.meta.glob` yalnızca Vite'ta çalışır. Sunucu için dosya sistemi okuyan ikinci bir yükleyici gerekir;
    motorun kendisi değişmez (`GameData` nesnesini alıyor).
  - Boyut: küçük–orta. Testler ve import yolları taşınır.
- [ ] **Motoru Web Worker'da çalıştırmak**
  - Ne: Devam'a basınca günlük ilerleme ve maç simülasyonu arayüz iş parçacığında değil Worker'da çalışır.
  - Neden: sezon simülasyonu ağır (testlerde tam sezon ~20–40 sn); arayüz takılmaz, "Anında sonuçlandır" ve çoklu sezon simülasyonu rahatlar.
    Aynı soyutlama sunucu tarafı simülasyona da hazırlık olur.
  - Dikkat: motor `world` nesnesini yerinde değiştiriyor. Worker sınırında ya dünya kopyalanır (maliyetli) ya da tüm dünya Worker'da yaşar,
    arayüz yalnızca dilimlerini okur. Store tasarımı buna göre değişir; asıl iş burada.
  - Boyut: orta–büyük.
- [ ] **Bulut kayıt (minimal backend)**
  - Ne: hesap + kayıt başına bir JSON blob. Kayıtlar zaten düz veri (`GameWorld`, `structuredClone` ile kopyalanabiliyor); sunucu yalnızca saklar.
  - Neden: cihazlar arası devam, yedek, tarayıcı verisi silinince kayıp olmaması. Sunucu mantığı gerektirmez: Hono ya da Fastify + Postgres,
    hatta yalnızca nesne depolama (S3 / R2) ve basit bir kimlik doğrulama yeter.
  - Dikkat: kayıt boyutu büyük (tüm oyuncular, geçmiş). Sıkıştırma, sezon başına delta, sürüm alanı (`formatVersion`) ve çakışma kuralı
    (iki cihaz aynı anda kaydederse hangisi kazanır) baştan düşünülmeli. Maç ortasında kayıt (`liveMatch`) bu akışa girer.
  - Önce yerel adım: IDEAS > Teknik'teki "kayıt dışa/içe aktarma (.json yedek)" aynı biçimi sunucusuz kullanır; bulut kayıt onun üstüne gelir.
  - Boyut: orta.
- [ ] **Liderlik tablosu, hesap, "en iyi kariyerler"**
  - Ne: sezon sonu özetlerini (şampiyonluklar, itibar, süre) sunucuda topla ve sırala.
  - Dikkat: motor istemcide çalıştığı için gönderilen skor doğrulanamaz. Yöntemler: (a) güven ve eğlence amaçlı, doğrulama yok;
    (b) deterministik motor sayesinde sunucu, kayıtlı `seed` + karar günlüğünü yeniden oynatıp sonucu doğrular (karar günlüğü tutmayı gerektirir);
    (c) yalnızca aynı tohumla başlayan "günlük meydan okuma" kariyerleri. (b) ve (c) motorun deterministik olmasından yararlanır.
  - Boyut: orta (doğrulamasız) – büyük (yeniden oynatarak doğrulama).
- [ ] **Çok oyunculu (aynı ligde birkaç menajer)**
  - Ne: her menajer kendi kulübünü yönetir, maç günü herkes hazır olunca sunucu günü ilerletir.
  - Neden zor: şimdiki mimari tek menajer varsayıyor (`playerClubId`, tek canlı maç, tek karar kuyruğu). Dünya sunucuda yaşamalı,
    istemciler yalnızca komut gönderip durum alır; bu, store ve motor giriş noktalarının baştan düşünülmesi demek.
  - Not: önce Worker ayrımı ve monorepo yapılırsa bu yol açılır; tek başına bu fikir şimdilik en büyük ve en riskli olanı.
  - Boyut: çok büyük.
- [ ] **Gerçek veri hattı (kadro güncellemesi)**
  - Ne: `scripts/transfermarkt.mjs` zaten kadro verisini çekiyor. Bunu zamanlanmış bir işe çevirip doğrulama (eksik oyuncu, yanlış mevki, tutarsız değer)
    ve değişiklik raporu eklemek; istenirse sunucu güncel `data/` paketini API ile verir, oyun açılışta günceller.
  - Dikkat: kaynak sitenin kullanım koşulları ve çekme sıklığı; verinin lisansı. Oyunun içinde dağıtmadan önce bunlar netleşmeli.
  - Boyut: küçük (betik + doğrulama) – orta (API ile dağıtım).
- [ ] **Paketleme: PWA ya da masaüstü (Tauri)**
  - IDEAS > Teknik'teki PWA maddesiyle aynı hedef. Tauri, yerel dosya sistemine kayıt ve tek tıkla kurulum verir; PWA daha hafif ama
    depolama kotası ve tarayıcı veri silme riski kalır.

**Teknoloji yığını:** mevcut yığın (React 19, Zustand 5, Vite 8, Vitest 5, Dexie 4, TypeScript 7) güncel ve yeterli; değiştirmek için bir sebep yok.
Eklenebilecekler: monorepo aracı (npm workspaces yeter, ek araç şart değil), sunucu için Hono ya da Fastify, Playwright (ekran görüntüsü testleri).
Veritabanı gerekirse Postgres; yalnızca kayıt blob'ları için nesne depolama da yeterli.

## Geliştirmede AI'dan yararlanma (beyin fırtınası, 2026-10-25)

Bunlar oyunun içine AI koymak değil, projeyi geliştirirken AI'ı daha verimli kullanma fikirleri. Oyunun içindeki AI içeriği
(haber metni, basın toplantısı) ayrıca en altta.

- [x] **Otomatik denge ve simülasyon raporu** (`npm run balance`; src/tools/balance/, ayrıntı NOTES.md > Arayüz ve konfor)
  - Ne: tek komutla N sezon oynat (`playSeason` zaten var), ardından hedeflerle karşılaştıran bir rapor üret: gol ortalaması, beraberlik oranı
    (NOTES'ta hedef ~%27, şu an %25,4), ev sahibi avantajı, sezon başına transfer hacmi, kulüp bütçeleri, kovulma oranı, Avrupa'da Türk kulüplerinin sonuçları.
  - Neden: denge bugün elle ve dağınık takip ediliyor (NOTES "Açık konular"). Deterministik motor sayesinde sonuçlar tekrarlanabilir;
    AI raporu okuyup parametre değişikliği önerebilir, sonra aynı tohumlarla yeniden ölçer.
  - Dikkat: yavaş (testlerdeki gibi dakikalar sürer); Worker ya da ayrı bir betik olarak çalışmalı, test takımına girmemeli.
  - Boyut: küçük–orta. Backend gerektirmez; en çok değer katan ilk adım.
- [ ] **Gerçek veri doğrulama ve temizleme**
  - Ne: Transfermarkt çıktısındaki hataları (eksik oyuncu, ters mevki, imkânsız yaş/değer, yinelenen kayıt) bir ajanın tarayıp raporlaması;
    `data/README.md` kurallarına göre otomatik düzeltme önerisi.
- [ ] **Ekran görüntüsü testleri (görsel doğrulama)**
  - Ne: Playwright ile ana ekranları (Puan Durumu grafikleri, Taktik, Maç, Ayarlar) sabit tohumla açıp ekran görüntüsü al, değişikliklerde karşılaştır.
  - Neden: bu oturumda grafikleri geçici bir betikle ekran görüntüsü alarak kontrol ettik; bunu kalıcı yapmak arayüz gerilemelerini yakalar ve AI'ın
    kendi değişikliğini görerek doğrulamasını sağlar. Şu an `node_modules`'te Playwright paketi yok (tarayıcılar sistemde var).
- [ ] **Bulgular → test akışı**
  - Ne: FINDINGS.md'deki her madde için "kanıt" satırı zaten var; maddeyi çözerken önce başarısız bir test (ya da ekran görüntüsü) yazıp sonra düzeltmek.
    Çözülen madde `[x]` olur ve kanıt satırı testi gösterir.
- [x] **Yavaş testleri düzeltmek** (tam koşu ~3 dk → 84 sn; motor ~%40 hızlandı, sonuç birebir aynı; ayrıntı FINDINGS > Testler)
  - FINDINGS > Testler'e bak. Tam sezon testleri 30 sn sınırını aşıyor; AI ile geliştirme döngüsü hızlı test ister. Ortak sezon simülasyonunu paylaşmak,
    küçük lig ile aynı kuralı sınamak ya da Worker'da paralel koşmak.
- [ ] **Kısa proje belleği (CLAUDE.md) + konuya göre bölünmüş notlar**
  - Ne: NOTES.md şu an ~800 satır; her oturumda hepsini okumak pahalı ve yarısı tarihsel. Kısa bir `CLAUDE.md` (komutlar, yapı, kurallar, bilinen tuzaklar:
    örn. Windows'ta CRLF, motor yerinde değiştirir, `touch(world)` unutulmamalı) ve konu dosyaları (`docs/transfer.md`, `docs/match-engine.md`…).
  - Neden: AI'ın her seferinde doğru bağlamla başlaması; kurallar "kod okuyarak çıkarılamayan" şeyleri taşır.
- [ ] **Oyun içi AI içeriği (sonraya)**
  - Ne: haber metni, basın toplantısı ve medya, devre arası konuşması, oyuncu kişilikleri modelle üretilebilir; şablon metin çevrimdışı yedek olur.
  - Dikkat: API anahtarı istemciye konamaz (bir sunucu proxy'si gerekir, yani backend'e bağlı); maliyet, gecikme, tekrar eden içerik için önbellek;
    üretilen metnin oyun durumuyla tutarlılığı (skor, oyuncu adı) şablonla doğrulanmalı. Deterministik motoru bozmamak için metin yalnızca sunum katmanında olmalı,
    sonucu etkilememeli.

**Önerilen sıra (bu beyin fırtınasından):**
1. Otomatik denge ve simülasyon raporu (backend gerektirmez, hemen değer katar).
2. Yavaş testleri düzeltmek + ekran görüntüsü testleri (geliştirme hızı).
3. Kayıt dışa/içe aktarma (.json), ardından motoru ayrı pakete çıkarmak.
4. Motoru Worker'a taşımak.
5. Bulut kayıt için minimal backend. Hedef kitle kararı verildikten sonra: hesap, liderlik tablosu.
6. Çok oyunculu en sona; ancak 3–5 bittikten sonra düşünülür.

## Önerilen sıra (en çok oyun keyfi katanlar)
Türkiye Kupası, transfer listesine koyma, iş teklifi/istifa, kayıt dışa aktarma, Avrupa kupaları.
