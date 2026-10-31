# Oyun modeli ve maç motoru kararları

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
  sakat/cezalı/ayrılmış oyuncuyu çıkarır. Boş mevkiye önce yedeklerden o mevkiyi bilen en iyisi, yoksa bütün kadrodan
  CA × uyum² × kondisyon en yüksek olan girer (uyumun karesi: bilmediği mevkideki iyi oyuncu mevkinin oyuncusunu geçmesin).
  Yedek boşsa otomatik seçilir; eksildiyse (yedek 11'e girdi / sakat) kalanlardan kullanıcının yedek sayısına tamamlanır
  (yedek kaleci yoksa önce kaleci, varsa ikincisi alınmaz).
- **Yapay zekâ** her maçta kadrosuna en uygun dizilişi seçer (`chooseFormation`), talimatları varsayılan,
  mentaliteyi skora göre değiştirir.
- **Maç içi taktik:** diziliş değişince sahadakiler yeni mevkilere dağıtılır (kaleci kalede). Başlama
  öncesi Taktik ekranında yapılan değişiklik maç ekranına dönünce aynı tohumla maça yansır (`refreshPreMatch`).
  Taktik panelinde saha düzeni (`ui/components/LiveLineup.tsx`): yedek → sahadaki oyuncu değişiklik, saha ↔ saha
  `swapPositions` (hak harcamaz, bireysel talimat mevkide kalır).
- **Maç içi geri alma:** store'daki `liveEdit` her kullanıcı değişikliğinden (oyuncu, yer, taktik, set) önce maçın
  `structuredClone` kopyasını `liveUndo.stack`'e koyar (en çok 20); `undoLiveChange` sonuncuyu geri yükler (RNG durumu ve
  anlatım satırı dahil). Yığın yalnızca `liveUndo.match === liveMatch` iken geçerli: maç adımı, devre arası konuşması,
  yeniden kurma ve yükleme yeni nesne verdiği için geri alma kendiliğinden düşer (ayrıca sıfırlamak gerekmez).
- **Puan (1–10):** 6.0'dan başlar; gol +1, asist +0.6, kurtarış +0.3, blok +0.15, sarı −0.3, kırmızı −1.5,
  yenilen gol (kaleci −0.4, defans −0.15), maç sonu galibiyet ±0.3, gol yemeyen kaleci/defans bonus.
  Maç sonrası puan oyuncunun `form` listesine eklenir (son 5).
- **Devam akışı:** maç günü değilse sonraki maç gününe (gün gün; `advanceOneDay` ileride günlük işler için)
  gider. Maç günü kendi maçımız canlı oynanır (maç ekranı), bitince günün diğer maçları arka planda
  aynı motorla oynanır ve haftanın sonuçları açılır. Sezon bitince 1'er gün ilerler. Yalnızca izlenen maçlarda durur
  (followedFixture: kullanıcının liginin maçı, kupa, Avrupa); başka bir yurtdışı liginin günü sessizce oynanıp geçilir (world.md).
- **GameWorld.season** = { year, fixtures[] }; Fixture.result = MatchResult { skor, goals[{minute, extra,
  clubId, playerId, assistId, kind}], cards, injuries, stats {home, away}, players[{rating, minutes,
  goals, assists, started}], manOfTheMatch }. Anlatım metni saklanmaz (yalnızca canlı maçta).
- **Maç içi sakatlık ve kartlar** şimdilik sadece o maçı etkiler; kalıcı sakatlık/ceza 8. aşamada.
  Sakatlanan oyuncu (kullanıcı takımında da) otomatik değiştirilir.

