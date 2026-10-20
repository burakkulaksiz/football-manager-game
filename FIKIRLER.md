# Fikir Listesi

Ara ara buradan seçip devam ediyoruz. Yapılanlar `[x]` ile işaretlenir; ayrıntılar NOTES.md'de.

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
  - [ ] **Taktiğe göre şekil:** mentalite (hücum/defans), savunma çizgisi, genişlik ve pres talimatları blok derinliğini
        ve genişliği değiştirir; kullanıcı taktiğinin etkisi sahada görünür.
  - [ ] **Kart / sakatlık / değişiklik görselleri:** oyuncunun üstünde sarı/kırmızı kart simgesi, atılan oyuncu sahadan
        çıkar, sakat oyuncu yerde, değişiklikte yeni numara kenardan girer.
  - [ ] **Oyuncu üzerine gelince bilgi:** isim, mevki, kondisyon ve maç puanı; tıklayınca değişiklik seçimi.
  - [ ] **Isı haritası / şut haritası:** maç içinde ve maç raporunda, takımın şutları (gol/isabet/aut) ve top hakimiyeti bölgeleri.
  - [x] **Kamera seçenekleri:** tam saha / topu takip eden yakın görünüm; tam ekran saha modu.
        (Büyük saha yapıldı: maç ekranında tam genişlik, ekrana sığan yükseklik.)
  - [ ] **Görsel cila:** forma renginde iki renkli nokta (forma + şort), kale fileleri, top gölgesi, gol anında ağ sallanması,
        çim desenine güneş/gölge.
  - [x] **Sadece önemli anlar modu:** FM'deki gibi sakin dakikaları atlayıp atak, şut ve duran topları sahada göstermek.
  - [ ] **Performans:** oyuncuları HTML katmanında (GPU'da hareket eden) çizmek; yavaş makinede bile akıcı geçiş.
- [ ] Ses (kodla üretilen + gerçek kayıtlar; düdük, gol, uğultu, açma/kapama)
- [ ] Maç ortasında kayıt
- [ ] Devre arası konuşması (moral etkisi)
- [ ] Duran top talimatları (korner ve serbest vuruşta kim nereye)
- [ ] Oyuncuya bireysel talimat ("sadece pas ver", "yükleniş yap")

## Kadro ve oyuncu
- [ ] Oyuncuyu transfer listesine / kiralık listesine koyma
- [ ] Altyapı ekranı ve genç oyuncu takibi
- [ ] Yardımcı antrenör tavsiyeleri ("şu mevkide eksiğin var")
- [ ] Oyuncu görüşmeleri (moral, şikâyet, kontrat isteği)
- [ ] Kaptanlık ve takım içi hiyerarşi
- [ ] Oyuncu geçmişi (sezon sezon maç/gol, eski kulüpler)

## Transfer
- [ ] Gözlemci sistemi (bilinmeyen oyuncuların özellikleri gizli, gözlemciyle açılır)
- [ ] Yurtdışı ligleri ve yabancı kulüplerden transfer
- [ ] Satın alma opsiyonlu kiralık, sonradan satış payı gibi sözleşme maddeleri
- [ ] Menajer pazarlığı / oyuncu ajanları

## Lig ve rekabet
- [ ] Türkiye Kupası
- [ ] Avrupa kupaları (Şampiyonlar Ligi, Avrupa Ligi)
- [ ] Milli takım ve milli maç arası
- [ ] 1. Lig'in gerçekten oynanması (şu an çıkanlar rastgele seçiliyor)
- [ ] Gerçek kadrolar (`data/squads/`)

## Kulüp ve menajer
- [ ] Başka kulüplerden iş teklifi, istifa, işsiz kalıp yeni iş arama
- [ ] Menajer itibarı ve kariyer geçmişi ekranı
- [ ] Tesis yatırımı (stadyum, antrenman tesisi, altyapı)
- [ ] Taraftar memnuniyeti
- [ ] Basın toplantısı ve medya

## Arayüz ve konfor
- [ ] Ayarlar ekranı (hız, otomatik kayıt sıklığı, tema)
- [ ] Klavye kısayolları (Devam için boşluk tuşu vb.)
- [ ] Grafikler (form eğrisi, puan durumu sıralaması zamanla)
- [ ] Haber ve mesajlarda arama
- [ ] Mobil / dar ekran uyumu

## Teknik
- [ ] Kayıt dosyasını dışa/içe aktarma (.json yedek)
- [ ] PWA: internetsiz, uygulama gibi açılan sürüm
- [ ] Hata günlüğü ve yedek otomatik kayıt slotları

## Önerilen sıra (en çok oyun keyfi katanlar)
Türkiye Kupası, transfer listesine koyma, iş teklifi/istifa, kayıt dışa aktarma, Avrupa kupaları.
