# Aşamalar (geliştirme geçmişi) ve açık konular

## Aşamalar
- [x] **1. Kurulum ve iskelet** — proje, klasörler, Vitest, Zustand, Dexie; ana menü, sol menü,
      üst bar (tarih + Devam).
- [x] **2. Veri üretimi** — kulüp JSON (18 kulüp), ülkeler, 11 isim havuzu, seed'li oyuncu/dünya
      üretici; Yeni Oyun (kulüp seçimi), Kadro (sıralanabilir, kulüp seçilebilir), Oyuncu Profili,
      Kulüp Bilgisi ekranları; CM 01/02 paleti.
- [x] **3. Lig ve takvim** — fikstür, puan durumu (bölgeler, form), Devam ile maç gününe ilerleme,
      anında maç sonucu + golcüler, Fikstür (Kulübüm/Haftalar), Puan Durumu, Lig İstatistikleri
      (gol krallığı, takım istatistikleri); üst barda sıradaki maç.
- [x] **Tasarım yenilemesi** (3 ile 4 arası, kullanıcı isteği) — FM 2005 esinli modern tema, yeni profil düzeni.
- [x] **4. Maç motoru** — dakika dakika motor, Türkçe anlatım, canlı maç ekranı (tabela, son 10 dk
      baskı çubuğu, istatistikler, canlı puan/kondisyon, değişiklik, mentalite, 4 hız, anında sonuç,
      maçın adamı), diğer maçlar arka planda; istatistik doğrulama testi; profil ve lig istatistikleri
      (maç, gol, asist, kart, ortalama puan, asist krallığı, puan sıralaması). 2D saha istenmedi.
- [x] **5. Taktik** — taktik ekranı (kadro listesi, formalı saha, yedek kulübesi, iki tıkla yerleştirme/takas,
      uyum noktaları, uyarılar, otomatik seç), 6 diziliş, talimatlar, kaptan/penaltıcı/serbest vuruşçu,
      motora etkileri (istatistiksel testlerle), yapay zekâ diziliş seçimi, maç içi taktik paneli.
- [x] **6. Kayıt sistemi** — çoklu kayıt slotu, kaydet (yeni / üzerine), yükle, sil, kariyer başına otomatik
      kayıt (maç günü sonrası), ana menüde Devam Et + Kayıt Yükle ekranı, çıkış uyarısı, bildirimler.
- [x] **7. Transfer, sözleşme, finans** — Transfer Merkezi (oyuncu arama + filtreler, teklifler, haberler),
      teklif / karşı teklif / kiralık, sözleşme görüşmesi ve yenileme, gelen teklifler, yapay zekâ transferleri,
      transfer dönemleri, finans (kasa, bütçeler, aylık raporlar, bilet/yayın/sponsor/prim), Devam haberlerde
      durur, menüde bekleyen teklif rozeti, eski kayıt dönüşümü (biçim 1 → 2).
- [x] **8. Oyuncu durumu** — kalıcı sakatlıklar, kart cezaları, kondisyon toparlanması, moral (sonuç, forma şansı,
      şikâyet), antrenman (6 odak, 3 yoğunluk), haftalık gelişim/gerileme, antrenör raporu yıldızları, Antrenman
      ekranı, durum etiketleri (kadro/taktik/profil), eski kayıt dönüşümü (biçim 2 → 3).
- [x] **9. Yönetim ve sezon döngüsü** — yönetim güveni ve görevden alma, Gelen Kutusu (filtreler, okundu, bağlantılar),
      sezon sonu (ödüller, primler, küme düşme/çıkma, arşiv), sözleşme bitişleri ve serbest oyuncular, emeklilik,
      altyapı, yeni sezon; kurgusal 1. Lig (data/lower_league.json); eski kayıt dönüşümü (biçim 3 → 4).
- [ ] **10. Cila** (kullanıcı parça parça seçiyor)
  - [x] Kadro ekranı: hızlı filtreler (mevki grubu; sakat/cezalı, sözleşmesi bitiyor, kiralık, gençler, ilk 11),
        isim arama, 4 görünüm (Genel, İstatistik, Sözleşme, Antrenör Raporu), sıralanabilir sütunlar, özet şeridi,
        2 oyuncu karşılaştırma (başka kulüpten de; seçim ve tercihler store'da korunur).
  - [x] Maç sonrası rapor (ekran 'report', Route.fixtureId): tabela, tarih/stadyum/seyirci, maçın adamı, olay
        zaman çizelgesi, istatistikler, iki takımın oyuncu puanları (giriş ▲ / çıkış ▼ dk). Canlı maç bitince açılır;
        Fikstür'de oynanmış maça tıklayınca da. Yalnızca bu sezonun maçları (geçmiş sezon fikstürü saklanmıyor).
  - [x] Menajer adı ve kartı (world.manager: ad, göreve başlama, G/B/M, şampiyonluk). Yeni oyunda ad zorunlu;
        Kulüp Bilgisi'nden değiştirilebilir; başlıkta, ana menüde ve kayıt listesinde görünür. Biçim 4 → 5 dönüşümü
        adı "Menajer" yapar, kaydı bu sezonun sonuçlarından ve arşivdeki şampiyonluklardan çıkarır.
  - [x] Denge: gol dağılımı (gol kralı, takımlar arası fark, penaltı) — ayrıntı season-manager.md > "Sezon döngüsü" bölümünün sonunda.
  - [x] Performans (ölçüm: puppeteer + CPU 4× yavaşlatma, orta sınıf makine taklidi):
        - Motor hızlıydı (sezon ~1.6 sn, maç günü ~35 ms). Sıcak nokta: askingPrice → playerImportance her oyuncu için
          kadroyu yeniden filtreleyip sıralıyordu (yapay zekâ alımı ve Transfer Merkezi'nde O(n²)). Artık
          `squadRanks(world)` bir kez hesaplanıp `askingPrice(world, p, ranks)`'a verilir (önbellek değil; sonuç aynı).
        - ageOn Date/split yerine sabit konumlardan okur. Transfer Merkezi araması 50'şer satır çizer ("Daha fazla göster").
        - Otomatik kayıt 150 ms gecikmeyle başlar (sonuç ekranı önce çizilir); arada canlı maç başladıysa atlanır.
        - Sonuç (4× yavaş CPU): Transfer Merkezi 835 → ~430 ms, maç sonu rapor 839 → ~480 ms, Devam ~150–190 ms.
          Canlı maç "Çok Hızlı" hedefi (25 dk/sn) 4× yavaşta da tutuyor. Kalan maliyet ilk açılan ekranda yazı tipi
          şekillendirme (layout ~45 ms, ikinci açılışta ~8 ms). Paket 541 KB (gzip 166 KB), bölmeye gerek görülmedi.
  - [x] 2D saha (maç ekranı orta sütun, "Gizle/Göster" localStorage 'fm.showPitch'). Motor koordinat tutmaz:
        stepMatch her dakika `MatchState.lastPlay` yazar (side, kind: hold/foul/attack/corner/freekick/blocked/miss/
        save/penalty/goal, playerId, fromPenalty) — öncelikli olan kalır (recordPlay), rng kullanmaz, sonucu etkilemez.
        ui/pitch.ts (saf, testli): ballSpot (anın yeri; dakikaya bağlı sabit hash), shotOrigin, teamSpots (dizilişten,
        topa göre blok çizgisi; ceza sahası yakınında doluşma; ızgara görünmesin diye küçük kayma), colorsClash
        (renkler yakınsa deplasman ikinci rengini giyer). PitchView SVG; geçiş süresi maç hızına göre, < 100 ms ise kapalı
        (SVG geçişleri ana iş parçacığında boyanır). "Çok Hızlı" 4× yavaş CPU'da 22 dk/sn (hedef 25).
  - [x] 2D saha sahneleri: lastPlay'e gerçek oyuncular eklendi (assistId, keeperId, defenderId = bloke eden / topu
        kapan / faul yapan, card = dakikanın kartı; recordPlay öncelikli olanı tutar, kartı korur).
        ui/pitchScene.ts (saf, testli): buildScene dakikayı 2–5 kareye çevirir (oyun kurma pasları → asist → şut → sonuç;
        korner, faul/serbest vuruş, penaltı [ceza sahası boşaltılır], top kapma). Pas hedefine en yakın takım arkadaşı
        topla buluşur; son kare her zaman ballSpot ile aynı. frameSpots: yerleşim + topu taşıyan + özel yerleşimler.
        framesForDuration: dakika < 300 ms ise yalnızca son kare, yoksa en fazla ⌊ms/110⌋ (2–5) kare.
        PitchView kareleri dakika süresinin %90'ına yayar; pas izi kesik, şut izi düz çizgi; kart oyuncunun üstünde.
        Duraklatılmışken sahne Normal hız süresiyle oynar. "Çok Hızlı" 4× yavaş CPU'da 24 dk/sn.
  - [x] Duran top sahneleri + büyük saha. Motor: lastPlay.fromCorner / fromFreeKick (resolveShot'a korner bayrağı);
        penaltı/serbest vuruş şutunda faulü yapan önceki andan taşınır. pitch.ts: freeKickSpot (kazanılan serbest vuruş
        ile şutu aynı yer), shotOrigin korner kafası için altıpas önü; formationRoles (dizilişteki yer, roller için).
        pitchScene.ts: SceneFrame.setPiece {kind, side, spot} — diziliş `spot`a göre kurulur, şuttan sonra bozulmaz.
        setPieceSpots: korner (hücumcular CORNER_TARGETS'a, savunanlar markaja, biri yakın direğe), serbest vuruş
        (topa 9.15 m'de 4 kişilik baraj, hücumcular ceza sahası çizgisinde), penaltı (çizgi/yay çevresinde iki sıra).
        Her iki takımdan geride kalanlar: hücum edenin en geri 2'si, savunanın en ileri 1'i.
        Saha maç ekranında tam genişlikte (kadroların üstünde); yüksekliği main.content'in görünür alanına göre
        ölçülür (useFitHeight, en az 320 px), saha açıkken "Son 10 dk" çubuğu gizli; altında son olay şeridi (EventBar);
        topu taşıyanın ve kart görenin soyadı noktanın altında. Performans: çim/çizgiler ayrı, memo'lu SVG
        (PitchBackground); her dakika yalnızca oyuncu katmanı boyanır; .match-grid content-visibility: auto.
        ui/colors.ts readableText: ikinci renk zeminde okunmuyorsa beyaz/siyah (tabela, başlık hapı, saha numaraları).
        DİKKAT: `.pitch-bg` uygulamanın çim zemin sınıfı; saha SVG'si `.pitch-grass`.
  - [x] Maç hızı seçenekleri kaldırıldı; "önemli anlar" modu (kullanıcı isteği). Sakin dakika QUIET_MINUTE_MS = 1000;
        önemli an (pitchScene.isHighlight: şutlar, gol, penaltı, korner, serbest vuruş, kart, sakatlık — kartsız faul ve
        şutsuz atak değil) sahada SCENE_FRAME_MS = 750 ms/kare oynar, son kare SCENE_HOLD_MS = 1500 ms kalır; saat o sürece
        bekler (MatchScreen setTimeout zinciri). Sakin dakikalarda saha boş; maç/ikinci yarı başında başlama dizilişi.
        Saha gizliyse her dakika 1 sn. Sonuç gizleme: saatin adımından önceki skor/olay sayısı (Held) önemli an sürerken
        tabela, golcüler, olay şeridi ("X atakta…") ve anlatımda gösterilir; sahne son karesine gelince açıklanır.
        Motor: lastPlay.injuredId; devre arası/maç sonunda lastPlay silinmez (son dakikanın golü de gösterilsin),
        ikinci yarı başında silinir. Bir maç ~3,5–4 dk sürer.
  - [x] Gol sevinci: sahnede sonuç karesi (SceneFrame.result; revealIndex) — etiket, kart ve skor burada açıklanır.
        Golde ardından 3 kare (celebration): golcü yakın köşe bayrağına (hücum yönünde 101 m, kenara 5 m) koşar,
        takım arkadaşları yolu yarılar → golcünün çevresinde halka, rakip kaleci topu ağlardan alır → santra
        (SceneFrame.kickoff, gol yiyen takımın forveti topun başında). focusId: adı gösterilen, yeri değişmeyen oyuncu;
        vurgulananlar en son çizilir (ad kalabalıkta üstte). Gol sahnesi ~6–7 sn.
  - [x] Kamera: "Tam saha" / "Yakın" (localStorage 'fm.pitchCamera') ve tam ekran. Araçlar maç kontrol satırının
        sağında (PitchTools). pitch.ts cameraTransform (saf, testli): hedefi (top; sevinçte golcü) ortalar, kenarda durur;
        CAMERA_ZOOM 1.9; santra ve sakin dakikada tam saha. Yalnızca CSS dönüşümü (.pitch-camera: translate % + scale,
        transform-origin 0 0) — saha yeniden çizilmez. Bunun için .pitch-stage genişliği = yükseklik × en-boy oranı
        (boşluksuz). Tam ekran: Fullscreen API saha panelinde (useFullscreen); üstte FullscreenBar (skor [gizli sonuçla],
        saat, Duraklat/Devam, Küçült); yükseklik window.innerHeight − 120.
  - [x] Görsel cila: iki renkli oyuncu (forma = birinci renk, şort = ikinci; renk çakışmasında ters), oyuncu ve top
        gölgesi, kale fileleri (çapraz örgü deseni, direkler; oyuncu katmanında) ve golde file sallanması (.pitch-net.ripple,
        golün girdiği kale), köşe yayları, çimde tribün gölgesi ve hafif güneş (sabit arka plan katmanında).
  - [x] Performans: oyuncular ve top HTML katmanında (.pitch-dots > .pdot / .pball), kayma transform geçişiyle
        ekran kartında (SVG transform geçişleri ana iş parçacığında çalışıyordu). Katman büyütülmez: konum ve birim
        (--u, metre başına px) kamerayı içerir (pitch.ts toScreen / screenUnit, testli) — yakın kamerada yazılar net.
        Sahne kutusu genişliği ResizeObserver ile (useElementWidth). Çim, çizgiler, fileler, pas izleri SVG'de kalır.
        Ölçüm (önemli an sırasında): CPU 6× yavaşta ana iş parçacığı kare hızı 42–52 → 52–58, yük 430–550 → 300–450 ms/sn.
  - [x] Taktiğe göre şekil: yeni talimat **genişlik** (dar/normal/geniş; kayıt sürümü 12, eski taktiklere 'normal').
        pitch.ts teamShape (saf, testli): mentalite bloğu ±3 m/kademe kaydırır, savunma hattı arka hattı ±7 m,
        pres yalnızca top rakipteyken önü +8 / −6 m (defansı %35'i kadar), genişlik yan yayılma ×1.18 / ×0.8;
        stayBackLy: tam hücumda bekler de rakip ceza sahasına girer, savunmacı mentalitede ön libero geride kalır.
        teamSpots'a `possession` (frameSpots'ta karenin carrierSide'ı): top rakipteyken takım daralır (yayılma ×0.88)
        ve topa daha çok kayar (yoğun preste daha da çok). Varsayılan talimatlarda top bizdeyken yerleşim eskisi gibi.
        pitchScene: oyun kurma ve asistsiz son pasın koridoru genişliğe göre (lane). Yapay zekâ mentaliteyi skora göre
        değiştirdiği için onun şekli de maç içinde değişir. Taktik ekranındaki formalı saha (kadro yerleştirme) sabit.
  - [x] Kart / sakatlık / değişiklik görselleri. Motor: MatchPlay.subs (PlaySub {side, outId, inId, early?}); dakika
        içindeki değişiklik (yapay zekâ, sakatlık, kaleci atılınca) o dakikanın anına, dakikalar arasındaki (kullanıcı)
        MatchState.pendingSubs'a yazılır ve sıradaki oynanan dakikanın anına taşınır (early). recordPlay subs'ı korur.
        pitchScene: isHighlight değişikliği de sayar (etiket "Oyuncu değişikliği"). Değişiklik 3 kare (substitutionFrames):
        çıkan yerinden kenara yürür / giren orta çizgi hizasında alt kenarın dışında (BENCH_Y) bekler → kenarda buluşurlar,
        giren sahaya koşar → giren yerinde, çıkan yok. early: sahnenin başında; diğerleri sonunda (gol sevincinden de sonra)
        ve o ana kadarki karelerde girenin yerinde çıkan görünür (SceneFrame.standIns, frameSpots duran top dizilişinden
        sonra uygular). Kartsız faul gibi sakin bir dakikada yalnızca değişiklik kareleri (sonuç = ilk kare).
        Kırmızı kart: sonuç karesinden sonra atılan oyuncu kenara yürür (sendOff). PitchView: sarı kartı olanın üstünde
        küçük kart (bu dakikanın kartı sonuç karesine kadar gizli), sakatlanan sonuç karesinde yerde (.pdot-body.down),
        değişiklikte yeşil ▲ / kırmızı ▼ ve adlar; alt kenardaki oyuncunun adı noktanın üstünde (.pdot-name.above,
        sahne kutusu taşanı keser). Değişiklik başına sahne ~3,75 sn.
  - [x] Menajer pazarlığı (kullanıcı seçti: menajer kişiliği + menajer ücreti + sözleşme maddeleri; menajerlerin oyuncu
        önermesi istenmedi). Kayıt sürümü 13: world.agents (30 menajer, ayrı rng AGENT_SEED_SALT, tr isim havuzu; %50 makul,
        %30 açgözlü, %20 sert). Oyuncuda alan yok: agentOf kimliği karıştırıp menajer seçer. AGENT_PROFILES:
        makul (ücret toplam maaşın %4'ü, sabır 4), açgözlü (%10, ücretin %60'ı verilmezse imza yok, ücret maaşla 1:1
        takas, sabır 3), sert (maaş ×1.08, sabır 2, piyasa değerinin ≤ 2.5 katı serbest kalma bedeli şart).
        evaluateTerms "yıllık maaş karşılığı": maaş + imza bonusu/yıl + primler (rolün beklenen maçı × %60) +
        feeWeight × (ücret − istenen)/yıl ≥ talep × süre (×1.1 tercih dışı) × rol (beklenenin altı kademe başına ×1.15,
        üstü ×0.97) × serbest kalma bedeli (≤ 1.5×değer ×0.95, ≤ 3× ×0.98). expectedRole: kulüpte kendisinden iyi
        oyuncu sayısı (<9 önemli, <16 rotasyon), 21 yaş altı bir kademe aşağı. Verilmeyen ücret istenen kadar, rol beklenen
        sayılır (completeTerms). Teklifin sabrı menajerden. "Önemli oyuncu" rolü imzada forma sözü olur
        (promisePlayingTime). Contract: role, releaseClause, appearanceBonus, goalBonus (yalnızca kullanıcının imzaladığı
        sözleşmelerde). Menajer ücreti transferde transfer bütçesinden, yenilemede kasadan; gider kalemi agentFees.
        Primler applyResult → payContractBonuses ("Primler"). Serbest kalma bedeli: yapay zekâ kullanıcıya teklif
        ederken bedel ≤ 1.6×değer ve bütçesi yetiyorsa triggerReleaseClause (satış reddedilemez); ucuz bedelli
        oyuncu 3× daha çok seçilir. Arayüz: ContractDialog (menajer ve tavrı, sabır, iki bölüm: maaş/süre/imza/ücret ve
        rol/bedel/primler, "Talebini yaz" tüm talebi doldurur), profilde rol, bedel, primler, menajer.
  - [x] Türkiye Kupası. Kupa maçları sezon fikstüründe (`Fixture.competition: 'cup'`, round = tur 1–5); ayrı durum
        saklanmaz, kayıt dönüşümü gerekmez (eski kayıtta kura sıradaki gün çekilir, tarihler gerekirse ileri kayar).
        26 kulüp (Süper Lig + 1. Lig): 32'ye eksik kadar (6) en yüksek itibarlı Süper Lig kulübü 1. Turu bay geçer →
        1. Tur 10 maç, Son 16, Çeyrek Final, Yarı Final, Final (tarafsız saha: MatchState.neutral, iç saha avantajı yok).
        Tarihler çarşamba (cupRoundDate: 23 Eyl, 28 Eki, 27 Oca, 3 Mar, 5 May sonrası ilk çarşamba; final ligin son
        haftasından önce). Kura: 1. Tur maçtan 14 gün önce, sonrakiler önceki tur bitince (processDay → cupDay), ayrı
        tohumlu rng (ana rastgeleliği değiştirmez); farklı ligdekilerden alt ligdeki evinde. Eleme: MatchState.knockout,
        beraberlikte 90 dakikadan sonra doğrudan penaltı atışları (uzatma yok): 5'er atış + tek tek; vurucu sırası
        seçilen penaltıcı, sonra penaltı becerisi, kaleci en son; olasılık penaltı/soğukkanlılık − kalecinin refleks/
        bire bir. MatchResult.penalties. Turu geçene ödül (100 bin → 3 Mn €, 'prize'); kullanıcıya kura/tur/veda
        haberleri ('cup'); alt lig takımına elenmek güven −4, kupayı kazanmak +15 ve manager.cups. Puan durumu
        (computeStandings), yönetimin hafta sayısı, lig istatistikleri ve sezon ödülleri yalnızca lig maçları;
        oyuncu sezon istatistikleri, kariyer, form, ceza ve menajer G/B/M kaydı kupayı da sayar. SeasonSummary.cupWinner*.
        Arayüz: Fikstür'de "Türkiye Kupası" sekmesi (turlar, bay geçenler, durumumuz), Kulübüm listesi tarih sırasında
        kupa etiketiyle, skorlar "2 - 2 (P 4-3)", maç ve rapor başlığında fixtureLabel, tabelada penaltılar, haber
        bandı son maç gününün sonuçları, geçmiş sezonlarda kupa şampiyonu, menajer kartında kupa sayısı.
  - [x] Avrupa kupaları. Fixture.competition: 'cup' | 'cl' | 'el' (Competition), Avrupa grup maçında Fixture.group;
        round: 1–6 grup maçları, 7/8 çeyrek final ilk maç/rövanş, 9/10 yarı final, 11 final. computeStandings artık
        yalnızca lig maçları (competition yok); mini lig için tableFrom. 16'şar kulüp: ŞL = Türkiye'den geçen sezonun
        ilk 2'si + en güçlü 14 yabancı; AL = kupa şampiyonu (ŞL'de değilse) + 3./4. (gerekirse 5.) + ŞL dışındaki en
        ZAYIF 13 yabancı (ilk denemede en güçlüler konunca Türk kulüpleri neredeyse hiç kazanamıyordu). İlk sezon
        itibar sırası. Bir ülkeden en çok 4 kulüp; grup kurası 4 torba (itibar), geri izlemeyle aynı ülke aynı grupta
        olmaz. Kura 25 Ağustos (ilk maça 3 günden az kaldıysa o sezon Avrupa yok: eski kayıt), sonraki aşamalar önceki
        bitince (processDay → europeDay); ayrı tohumlu rng. ŞL salı, AL perşembe (STAGE_DATES: 14 Eyl … 7 Ara grup,
        8/15 Mar çeyrek, 12/19 Nis yarı, 18 May final — ligin bitiminden sonra; sezon ŞL finalinin ertesi günü kapanır).
        Çeyrek final: grup birincisi başka grubun ikincisiyle, rövanş birincinin evinde; yarı final serbest kura; final
        tarafsız. Rövanş: MatchSetup/MatchState.aggregate (ilk maçın golleri, bu maçın ev/deplasmanı açısından);
        toplamda eşitlikte penaltılar (deplasman golü yok). Ödüller ('prize'; EUROPE[comp].prizes): katılım, grup
        galibiyeti/beraberliği, çeyrek, yarı, final, şampiyonluk (ŞL 8 Mn katılım … 10 Mn şampiyonluk; AL daha az).
        Kullanıcı: gruptan çıkmak / tur atlamak güven +5 ve itibar +1, şampiyonluk ŞL +25 / AL +15, itibar +3
        (Türk kulübü, en çok 100), manager.europeTitles; haberler ('europe'). SeasonSummary.clWinnerName/elWinnerName.
        Motor istatistik testi artık yalnızca lig maçlarını ölçer. Arayüz: Fikstür'de "Avrupa" sekmesi (ŞL / AL
        seçimi; grup tabloları, eleme turları ilk maç + rövanş + toplam), Kulübüm listesinde ŞL/AL etiketi, tabelada
        ve raporda "Toplam X-Y", puan durumu bölgeleri 1–2 ŞL, 3–4 AL (Konferans Ligi kalktı), geçmişte şampiyonlar,
        menajer kartında Avrupa kupası. Ölçüm (5 sezon): Türk kulüpleri ŞL'de çoğunlukla 3.–4., AL'de ara sıra gruptan çıkar.
  - [x] Milli takımlar (kullanıcı seçti: yalnızca kulüp tarafı, eleme + yaz turnuvası, dünyadaki oyuncular + sanal
        tamamlama). Ayrıntı world.md > "Milli takımlar" bölümünde.
  - [ ] Sıradaki: IDEAS.md'den seçilecek.

## Açık konular / ileride
- Duran top özellikleri (penaltı, korner) mevkiyle ilgisizse düşük çıkabiliyor — 10. aşamada denge.
- Beraberlik %25.4 (hedef %27; Süper Lig gerçeği ~%25). Daha fazlası gol ortalamasını düşürüyor.

- Oyuncu "transfer listesine koyma" yok; yapay zekâ ilgisi kendiliğinden geliyor.

## Sıradaki adım
10. aşama devam: kullanıcı IDEAS.md listesinden sıradaki maddeyi seçer (yapılanlar orada [x] işaretlenir).

