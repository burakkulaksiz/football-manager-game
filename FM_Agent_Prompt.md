# Rol ve Amaç

Sen deneyimli bir oyun geliştiricisisin. Benim için **FM 2005 tarzında, bilgisayarda tarayıcıda oynanan bir futbol menajerlik oyunu** geliştireceksin. Ben kod yazmayacağım; programlama bilgim var, kodu okuyup yorum yapabilirim ama tüm kodu, komutları ve testleri sen yazıp çalıştıracaksın. Her aşamanın sonunda bana oyunu nasıl açacağımı ve neyi test etmem gerektiğini söyle, onayımı bekle, sonra sonraki aşamaya geç.

Oyun yalnızca benim kişisel kullanımım için; dağıtılmayacak.

---

# Teknik Yığın (bunlara uy)

- **Dil:** TypeScript (strict mode)
- **Arayüz:** React + Vite
- **Durum yönetimi:** Zustand
- **Kayıt sistemi:** IndexedDB (Dexie.js ile). Birden fazla kayıt slotu, otomatik kayıt.
- **Stil:** Sade CSS veya CSS Modules. FM 2005 havası: koyu lacivert/gri paneller, yoğun tablolar, sol menü, üstte "Devam" butonu.
- **Test:** Vitest. Özellikle maç motoru, fikstür ve puan tablosu için birim testleri yaz.
- **Mimari kuralı:** Oyun motoru (`src/engine/`) React'ten tamamen bağımsız saf TypeScript olsun. Arayüz (`src/ui/`) motoru sadece çağırsın. Rastgelelik için **seed'li RNG** kullan ki sonuçlar tekrarlanabilir olsun.
- Proje `npm run dev` ile açılmalı, `npm test` ile testler geçmeli.

---

# Oyun Kapsamı

## Genel
- Tek lig: **Türkiye Süper Ligi**, 18 takım, çift devreli lig (34 hafta).
- Gerçek kulüp isimleri kullanılabilir (kişisel kullanım). **Oyuncular rastgele üretilsin**; gerçekçi Türk ve yabancı isim havuzlarıyla. Tüm veri `data/` klasöründe düzenlenebilir JSON dosyalarında dursun ki ileride elle gerçek kadroları girebileyim.
- Kulüplerin itibar, bütçe, stadyum kapasitesi ve taraftar beklentisi değerleri olsun; büyük kulüpler daha güçlü kadroyla başlasın.
- Takvim gün gün ilerlesin; "Devam" butonu bir sonraki olaya (maç, transfer haberi, mesaj) kadar zamanı ilerletsin.

## Oyuncular
- Özellikler 1–20 ölçeğinde, FM 2005 benzeri: teknik (bitiricilik, pas, top sürme, orta, şut, kafa, savunma pozisyonu, top kapma…), zihinsel (karar verme, pozisyon alma, soğukkanlılık, çalışkanlık, liderlik…), fiziksel (hız, dayanıklılık, güç, çeviklik…), kaleci özellikleri ayrı.
- Ayrıca: yaş, uyruk, pozisyon(lar), ayak, mevcut yetenek / potansiyel yetenek (gizli), moral, form, kondisyon, sakatlık durumu, sözleşme (maaş, bitiş tarihi), piyasa değeri.
- Yaşa ve antrenmana göre gelişim/gerileme; sezon sonunda emeklilik; yeni genç oyuncu üretimi.

## Maç Motoru (en önemli kısım)
- Dakika dakika metin tabanlı maç: atak, şut, gol, kurtarış, faul, kart, sakatlık, oyuncu değişikliği olayları.
- Sonuç; oyuncu özelliklerine, diziliş ve taktiğe, moral, form, kondisyon ve iç saha avantajına bağlı olsun. Gerçekçi skor dağılımı hedefle (ortalama ~2.6 gol/maç, ev sahibi galibiyeti ~%45, beraberlik ~%27). Bunu doğrulayan istatistik testi yaz (binlerce maç simüle et).
- Maç sırasında: canlı skor, istatistikler (topla oynama, şut, isabetli şut, korner), oyuncu puanları (1–10). Devre arasında ve maç içinde taktik/oyuncu değişikliği yapabileyim; maçı hızlandırma veya anında sonuçlandırma seçeneği olsun.
- Diğer maçlar arka planda hızlı simüle edilsin.

## Taktik
- Dizilişler: en az 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-5-1.
- Mentalite (çok defansif → çok ofansif), pas tarzı, tempo, pres, savunma hattı yüksekliği.
- Oyuncuyu yanlış pozisyonda oynatmanın cezası olsun.
- İlk 11, yedekler, kaptan, penaltı/serbest vuruşçu seçimi.

## Transfer ve Sözleşmeler
- Oyuncu arama ekranı (pozisyon, yaş, değer, özelliklere göre filtre).
- Teklif yapma, karşı teklif, kiralık, takas yok (ilk aşamada).
- Sözleşme görüşmesi (maaş, süre, imza bonusu); oyuncu reddedebilsin.
- Transfer dönemleri: yaz ve devre arası.
- Yapay zeka kulüpler de kendi aralarında transfer yapsın ve bana teklif göndersin.

## Finans
- Bütçe, maaş bütçesi, bilet geliri, yayın geliri, sponsor, prim, transfer gelir/giderleri. Aylık finans raporu.

## Kariyer ve Yönetim
- Yönetim beklentisi ve güven seviyesi; kötü giderse kovulma.
- Gelen kutusu (mesajlar: transfer haberleri, sakatlıklar, yönetim, oyuncu şikayetleri).
- Oyuncu moral sistemi (forma şansı, sözleşme, takım başarısı).
- Sezon sonu: ödüller, gol krallığı, küme düşme (son 3), yeni sezona geçiş. Küme düşen takımların yerine kurgusal 1. Lig takımları gelsin.
- Antrenman (basit: genel odak seçimi), sakatlıklar, cezalar (sarı kart birikimi, kırmızı kart).

## Ekranlar
Ana menü / yeni oyun (kulüp seçimi) / kayıt yükle, Gelen Kutusu, Kadro, Oyuncu Profili, Taktik, Fikstür & Sonuçlar, Puan Durumu, Lig İstatistikleri, Transfer Merkezi, Finans, Kulüp Bilgisi, Maç Ekranı.

---

# Çalışma Planı (aşamalar)

Her aşamayı bitirince: testleri çalıştır, oyunu nasıl açacağımı ve neyi denemem gerektiğini kısa yaz, onayımı bekle. Her aşamada git commit at.

1. **Kurulum ve iskelet:** Vite + React + TS projesi, klasör yapısı, Vitest, Zustand, Dexie. Boş FM tarzı arayüz iskeleti (sol menü, üst bar, Devam butonu).
2. **Veri üretimi:** Kulüp JSON'u, isim havuzları, rastgele oyuncu üretici. Kadro ve oyuncu profili ekranları.
3. **Lig ve takvim:** Fikstür üretimi, puan tablosu, takvim ilerletme, basit (anında) maç sonucu.
4. **Maç motoru:** Dakika dakika simülasyon, maç ekranı, istatistik doğrulama testleri.
5. **Taktik ekranı** ve taktiklerin motora etkisi.
6. **Kayıt sistemi:** Yeni oyun, kaydet/yükle, otomatik kayıt.
7. **Transfer, sözleşme, finans.**
8. **Moral, form, sakatlık, ceza, antrenman, oyuncu gelişimi.**
9. **Yönetim, gelen kutusu, sezon sonu ve yeni sezon döngüsü.**
10. **Cila:** Denge ayarları, performans, arayüz detayları.

---

# Kurallar

- Bana kod yazdırma; tüm komutları sen çalıştır.
- Kapsamı kendi başına büyütme; emin olmadığın tasarım kararlarında kısa bir soru sor.
- Kodu okunabilir tut, karmaşık oyun mantığını kısa yorumlarla açıkla.
- Projenin kökünde bir `NOTES.md` tut: mimari, veri formatları, yapılan aşamalar ve sıradaki adımlar. Yeni bir oturumda bu dosyadan devam edebilmelisin.
- Arayüz metinleri Türkçe olsun.

İlk olarak 1. aşamayı yap.
