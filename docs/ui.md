# Arayüz: görünüm, konfor, kararlar ve gezinme

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
  bir sonraki koşu önceki latest.json ile kıyaslanır (fark sütunu, "gürültü" işareti). Hedefler metrics.ts'te: engine.test.ts / docs/ notlarındaki hedefler,
  "referans" (gerçek lig, yaklaşık) ve "sınır" (kendi koruma sınırlarımız) olarak işaretli. Ayarlar: BALANCE_CAREERS (6), BALANCE_SEASONS (4),
  BALANCE_SEED (9000), BALANCE_CLUBS, BALANCE_OUT. 1 sezon ≈ 5–6 sn. Kullanıcı kulübü varsayılan taktikle otomatik oynar; kovulma kaydedilip kariyer
  yapay sürdürülür. Az gözlemde (n < 5) "hedef dışı" yerine "belirsiz" denir. Motor değişince: koşu → rapor → hedef dışı ölçülerin "bak:" ipucu.
- Bilinen: tam sezon testleri yavaş (FINDINGS.md > Testler).

## Ses (ui/sound.ts, kayıtlar public/sounds/, kaynaklar public/sounds/KAYNAKLAR.md)
- Gerçek kayıtlar (freesound önizlemeleri, mp3). Motor sese dokunmaz; ses yalnızca ui katmanında. Hangi olayda hangi ses
  (`matchSounds`, `careerSound`), ayar süzgeci (`soundAllowed`) ve çakışma kuralı (`admitSound`) saf, `sound.test.ts`'te.
- Ayarlar: Ses (ana anahtar; maçta V), Ses Düzeyi (ana kazanç + sınırlayıcı), Maç Dışı Sesler (Kapalı / Önemli olaylar /
  + Tıklamalar; varsayılan Önemli olaylar). Çok hızlı maçta ve Anında Sonuçlandır'da maç sesi yok.
- Maç: başlama / 2. yarı / penaltı uzun düdük, faul / sarı kısa düdük, devre iki kısa, maç sonu kısa-kısa-uzun; ev sahibi
  golü tribün coşkusu, deplasman golü "ah" + uzak sevinç; kaçan / kurtarılan / bloklanan şut "ah"; kırmızı düdük + yuha;
  saat akarken stadyum uğultusu döngüsü (kayıt yüklenmeden istenirse yüklenince başlar). Aynı adımda tek düdük ve tek
  tribün tepkisi (en önemlisi), aynı ses `gap` saniyeden sık başlamaz, aynı anda en çok MAX_VOICES (6) ses.
- Maç dışı (App.useSounds): dünya her değiştiğinde önceki `CareerMark` ile kıyas; en büyük olay çalar: kovulma / kariyer
  sonu (yuha) > kupa sayacı arttı (fanfar + tribün) > yeni iş teklifi > kulübümüze transfer / kiralık (imza) > susturulmamış
  önemli haber (bildirim). Başka kariyere geçişte (tohum farklı / haber sayacı geride) ve ilk bakışta sessiz.
- Yükleme: ses bağlamı ilk tıklama / tuşta kurulur (oto-oynatma kuralı), kayıtlar o an bir kez indirilip çözülür ve tepe
  değeri 1'e normalize edilir; FILES'taki `gain` göreli düzey, `duration` uzun kaydı keser (son 0,4 sn sönüm). İnmeyen /
  çözülemeyen kayıt sessizce atlanır; Sesi dene o zaman uyarı gösterir. Düzeyler kulakla değil dalga biçimine bakılarak seçildi.

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

