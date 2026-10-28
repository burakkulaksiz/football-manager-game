# 2D saha ve maç haritaları

Ayrıca: 2D sahanın ilk sürümleri, sahneler, duran toplar, önemli anlar, gol sevinci, kamera, görsel cila, taktiğe göre şekil ve
kart / sakatlık / değişiklik görselleri history.md > "Aşamalar" > 10. Cila maddelerinde (ayrıntılı kurallar orada).

## 2D saha akışı (kullanıcı istekleri: akıcılık, falso / yüksek top, top sürme, genişlik, baskı çubuğu, belirgin gol)
- Animasyon CSS geçişlerinden requestAnimationFrame döngüsüne taşındı (PitchView): oyuncu, top, gölge ve kamera her karede
  DOM'a doğrudan yazılır; React yalnızca gösterilen kare değişince (adlar, kartlar, etiketler) çizer. Hareket hesabı saf ve
  testli: ui/pitchMotion.ts — sampleScene (kareler arası easeInOut; girişte oyuncular önceki sahnenin son yerinden süzülür,
  önceki yoksa belirir), ballPath (ikinci dereceden Bézier: kontrol noktası yolun ortasından curl×2 yana; yükseklik parabol),
  ballTrack (kavisli iz), dominance. Yakın kamera topu üstel yumuşatmayla izler (CAMERA_LAG_MS 220). Ölçüm: ~60 fps (16,8 ms).
- pitchScene: FrameMove pass / lob / cross / dribble / shot; SceneFrame.curl, height (shapeBallPaths: korner ortası 6,5–8,5 m,
  kanattan ceza sahasına orta, 30 m+ pas havadan, serbest vuruş falsolu 3,5–6 m ve 2,2+ m yüksek, uzaktan şut biraz havadan,
  bazen üstten aut). Top sürme: oyun kurmada ve asistten önce (yarı yarıya), golcü bazen topu geride alıp şut yerine sürer.
  Bir anın en çok 8 karesi (MAX_PLAY_FRAMES). Süreler harekete göre (frameDurationMs: şut 520, pas 750, havadan/orta/sürme
  950–1000, sevinç 900 ms); LEAD_IN_MS 400; revealDelayMs (MatchScreen skoru bununla açıklar), sceneDurationMs.
- Işınlanma yok (ölçülü kural, pitchFlow.test.ts): gerçek motorla 6 maç baştan sona 16 ms adımlarla oynatılır; görünen
  oyuncu / top bir ekran karesinde en çok 1,5 m gider, görünürlük en çok 0,1 değişir. Hız sınırı MAX_GLIDE_SPEED
  (0,045 m/ms, pitchScene): sampleScene bunu aşan yolu süzmez, kesme yapar (eski yerinde solar, yenisinde belirir; top
  da). Sahne sınırı aşmayacak biçimde kurulur (paceRuns): vuruşlu karede uzaktaki oyuncu (topu alan, faulü yapan)
  önceki karelerde koşuya başlar; vuruşsuz kare (duran top kurulumu, sevinç, değişiklik, kırmızı kart) herkes yürüyerek
  yetişecek kadar uzar (SceneFrame.durationMs, en çok 2,5 sn). Bilerek kesme: gol sonrası santra, başka dakikanın
  sahnesine giriş (uzaktakiler), devre arası yer değişimi. Kök neden (eski): giriş 400 ms'de 80 m'ye kadar süzülüyordu,
  top girişte anında sıçrıyordu, sevinçten santraya 90 m / 900 ms koşuluyordu.
- Devre arası yer değişimi: sahne mantıksal sahada kurulur (ev sahibi sağa hücum eder); ikinci yarıda ve maç sonunda
  (sidesSwapped) viewScene ekrana 180° döndürür (oyuncunun sağı / solu korunur). Yedek kulübesi mantıksal sahada karşı
  kenarda kurulur ki ekranda hep altta kalsın. Gol filesi, baskı çubuğu da çevrilir. Uzatma devresi yok (eşitlikte
  doğrudan penaltılar); uzatma dakikaları devrenin yönünde. Şut / ısı haritası maçın tamamını gösterdiğinden çevrilmez:
  ev sahibi hep sağa hücum eder (haritada not yazar).
- Top dışarı (testli): korner kazanılırken kale çizgisine inen hücumcunun ortası topa en yakın savunmacıya çarpar
  (son dokunan savunan takım; motor korner anına savunmacı yazmaz, sahne seçer), top çizgiyi geçer, korneri hücum eden
  kullanır. Aut (kale vuruşu) ve golde son dokunan şutu çeken hücumcu. Sahne topu yan çizgiden çıkarmaz (taç yok).
  Çizgiyi geçen sekme orta / havadan top sayılmaz (shapeBallPaths).
- Sakin dakika: boş saha yerine soluk saha + baskı çubuğu (DominanceBar): iki takım renginde birbirini iten çubuk, sınırda top;
  dominance = son 10 dk, yeni dakikalar ağır (0,82^yaş), ataklar %60 + topa sahip olma (timeline harfi) %40.
- Büyük bant (bannerKind): GOL! (golcü, sevinç boyunca), PENALTI! (penaltı dizilişinden sonuca), PENALTI KAÇTI!, KIRMIZI KART;
  golde sahada beyaz parlama ve file sallanır; skor tabelası (ve tam ekran şeridi) gol olunca parlar (useGoalFlash).
- Genişlik: saha boyuna uzatılabilir (pitch.ts makeView(k), stretchFor; en çok MAX_STRETCH 1,4): x koordinatları k ile çarpılır,
  daire / yay / kale ölçüleri değişmez (uzun saha görünümü). cameraTransform / toScreen / screenUnit view alır. Tam ekranda skor
  ve olay şeritleri sahanın üstüne biner, saha ekranın tamamını kullanır.

## Şut ve ısı haritası
- Motor kaydı (yalnızca gösterim, rng kullanmaz): MatchState.shots / MatchResult.shots — her şut (dakika sayacı,
  ikinci yarı işareti, taraf, oyuncu, sonuç gol / kurtarıldı / aut / engellendi, tür kafa / uzaktan / serbest vuruş /
  penaltı, korner). Varsayılanlar (ilk yarı, normal şut) yazılmaz. Sayılar maç istatistiğiyle birebir (testli).
- MatchState.timeline / MatchResult.timeline: dakika başına bir harf (PLAY_CODES; küçük = ev sahibi, büyük =
  deplasman), devreler '|' ile ayrılır; decodeTimeline açar. Eski kayıtlardaki maçlarda ikisi de yok
  (harita "veri yok" der).
- Yer saklanmaz: ui/matchMaps.ts şutun çıktığı / gittiği yeri ve dakikanın top yerini 2D sahanın fonksiyonlarıyla
  (shotOrigin, ballSpot) türetir; haritadaki yer canlı sahada görülenle aynı. Aynı dakikadaki ikinci şut biraz kayar.
- Bileşen MatchMaps: Şut haritası (gol büyük dolu + çizgi, kurtarıldı dolu, aut halka, engellendi çarpı; üstüne
  gelince dakika, oyuncu, sonuç) / Isı haritası (dakika başına bulanık nokta, topa sahip takımın renginde; bölge payı:
  ev kalesi önü / orta / deplasman kalesi önü). Takım filtresi. Renk: çimde okunan ilk kulüp rengi, iki takım
  benzerse deplasmanın diğer rengi.
- Yerleri: maç raporunda İstatistikler'in altında; canlı maçta orta sütunda "Haritalar" (önemli an oynarken o anın
  şutu ve dakikası skor gibi gizli). Motor şut listesini yerinde büyüttüğünden canlı ekran her çizimde kopya verir.
- Kayıt: sezon sonunda ~4,55 MB'ın ~630 KB'ı şutlar, ~30 KB zaman çizelgesi (yalnızca bu sezonun fikstürü tutulur).
