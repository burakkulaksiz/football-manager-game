# Sezon döngüsü, yönetim ve menajer kariyeri

Ayrıca: Türkiye Kupası ve Avrupa kupalarının kuralları history.md > "Aşamalar" > 10. Cila maddelerinde.

## Sezon döngüsü ve yönetim kuralları (aşama 9)
- **Lig yapısı:** world.clubs = Süper Lig (division 1) + 1. Lig (division 2). Fikstür ve puan durumu yalnızca
  `leagueClubs(world)`. 1. Lig maçları oynanmaz; çıkan 3 kulüp itibar² ağırlıklı rastgele seçilir.
- **Yönetim:** hedef sıra = beklentiden (title 1, europe 4, top_half 8, mid_table 12, avoid_relegation 15).
  Güven 60'tan başlar. Maç: galibiyet +1.5, beraberlik +0.3 (büyük kulüpte −0.5), yenilgi −2.5 (büyük kulüpte −3.5).
  Aylık (5. haftadan sonra): (hedef − sıra) × 0.8 (−5…+3); kasa eksi → −3. < 30 uyarı, < 10 ve 8+ hafta oynanmışsa
  görevden alma. Sezon sonu: şampiyon +30, hedef tuttu +15, 3 sıraya kadar geride −5, daha kötü −20; < 15 → görevden
  alma; küme düşme → görevden alma. Görevden alınınca `world.gameOver`: Devam kapalı, otomatik kayıt alınmaz.
- **Sezon sonu (son maçın ertesi günü):** ödüller (Gol Kralı, Asist Kralı, Sezonun Oyuncusu [≥ hafta×0.55 maç],
  Genç Oyuncusu [≤21 yaş, ≥10 maç], Kalecisi), sıralama primi (15 / 10 / 7 / 5 Mn, sonra 3.5 → 0.8 Mn),
  world.history'ye SeasonSummary (isimler saklanır), seasonState = 'ended'.
- **Devam sezon arasında** bir sonraki maç günü yerine 1 Temmuz'a kadar ilerler (haberlerde durur).
- **1 Mayıs:** sözleşmesi bitecek oyuncularımız için uyarı. **30 Haziran:** kullanıcının sözleşmesi biten oyuncuları
  serbest kalır; yapay zekâ kadro sırası < 18 ve ≤ 32 yaş olanı yeniler, diğerlerini bırakır.
- **1 Temmuz (yeni sezon):** küme düşen → division 2, itibar −5, maaş bütçesi ×0.6, temel bütçe ×0.5; çıkan →
  division 1, itibar +3, ×1.4 / ×1.5. İtibar: şampiyon +3, ilk 4 +1, itibar sırasından 3+ iyi +1 / 3+ kötü −1.
  Emeklilik: 34+ yaşta 0.25 + (yaş−34)×0.18 (+0.15 CA<90), 38'de kesin; serbest 31+ → +0.4. Emekliler silinir.
  Altyapı: her kulübe 3–4 genç (16–17 yaş, seviye taban−4.5, ek potansiyel 10–45). Yapay zekâ kadrosu > 30 ise en
  zayıflar bırakılır. Bütçeler: yayın = maaş bütçesi × (0.45 / 1. Lig 0.3), sponsor 0.3, transfer bütçesi = temel
  bütçe + (kasa − maaş bütçesi/4) fazlasının %30'u. Beklenti itibar sırasından. Sarı kartlar sıfırlanır.
- **Serbest oyuncular:** clubId = null. Kullanıcı bonservissiz imzalar (negotiateFreeAgent, dönem şartı yok);
  yapay zekâ transfer döneminde bedelsiz alabilir.
- **Gelen Kutusu:** world.news içinden `important` ya da kulübümüzle ilgili olanlar; okundu bilgisi haberde.
- Denge (aşama 9 sonrası): deplasman takımı 75'ten sonra beraberliğe razı (mentalite −1); goalBase 0.275,
  injuryChance 0.0018. ~4600 maç: 2.52 gol, %44.1 ev, %25.9 beraberlik.
- Denge (aşama 10, gol dağılımı): gol kralı 29–42 ve takım golleri 14–103 idi (güç farkı üç yerde çarpılıyordu).
  Değişenler: threatExponent 1.35 → 1.2; top hakimiyeti üssü 2 → 1.5 (possessionExponent); vuruş yeteneğinin
  etkisi: isabet × (0.5 + yetenek/24) (önce yetenek/12), gol × (yetenek/kaleci)^0.8 (finishingExponent, önce 1.2);
  SHOOTER_WEIGHT ST 6 → 3.5; penaltı (penaltyChance) 0.017 → 0.024; goalBase 0.275 → 0.31.
  12 sezon: gol kralı ort. 24 (19–32), kulübün en golcüsü takım gollerinin %28'i, santrforlar tüm gollerin
  %32'si, en golcü takım 72–93 gol, en az golcü 24–32, şampiyon 72–95 puan, penaltı golü 0.26/maç,
  asist kralı 10–15. ~4600 maç: 2.69 gol, %44.2 ev, %26.3 beraberlik. engine.test.ts gol kralını da denetler.
  testing.ts playSeason yönetim güvenini tazeler (görevden alınma test sezonunu yarıda kesmesin).

## Menajer itibarı ve kariyer (kullanıcı seçti: geçmiş seçimi; itibar transferi ve yönetimi etkiler)
- Kayıt sürümü 15: ManagerInfo.background, reputation (1–100), reputationHistory ({ month, value }, ay başı; en çok 360),
  seasons (ManagerSeason: kulüp, sıra / hedef, G-B-M ve goller tüm maçlardan, kupalar, sezon sonu itibarı, sacked), bestWin /
  worstDefeat. engine/season/manager.ts. Dönüşüm: itibar = geçmiş (eski futbolcu 35) + şampiyonluk ×8 + kupa ×4 + Avrupa ×10;
  sezonlar arşivden (maç istatistikleri yok, “—”).
- Geçmiş (yeni oyunda seçilir): amatör 15, eski futbolcu 35, eski milli futbolcu 50, tecrübeli teknik direktör 65.
- Değişim: maç (reputationAfterMatch, applyResult'ta) — rakibin itibarı 5+ yüksek / denk / 5+ düşük: galibiyet +0.6 / +0.3 / +0.15,
  yenilgi −0.1 / −0.3 / −0.6, beraberlik +0.15 / 0 / −0.15 (penaltıyla kazanılan / kaybedilen eleme maçı galibiyet / yenilgi);
  Avrupa ×1.5, kupa ×0.8. Sezon sonu (managerSeasonEnd, endSeason'da görevden alma kararından önce): (hedef − sıra) × 1.5
  (±10), şampiyonluk +8, kupa +4, ŞL +12, AL +7, küme düşme −12. Görevden alınma −8 (managerSacked; sezon kariyere sacked).
  Ölçüm (tek sezon): hedefin 3 sıra gerisi ~−5, hedefin 1 sıra üstü ~+6.
- Etkiler: willingToJoin — alıcı kulübümüzse kulüp itibarına (itibar − 50) × 0.2 (±10). Yönetim: görevden alma eşiği
  sackThreshold = taban − (itibar − 50) × 0.1 (maç içi 10, sezon sonu 15 tabanı; itibar 100 → 5), yenilgide güven kaybı ×
  lossPenaltyFactor (itibar 100 → 0.8, 1 → 1.2).
- Arayüz: Yeni oyunda geçmiş kartları; sol menüde Kulüp → Menajer Kariyeri (ManagerScreen): itibar ve etiketi (Yerel < 30 ≤
  Bölgesel < 50 ≤ Ulusal < 70 ≤ Avrupa çapında < 85 ≤ Dünyaca ünlü), son 12 ay değişimi, aylık itibar grafiği (tek seri,
  üstüne gelince değer), kupa dolabı, rekorlar, sezon sezon kariyer tablosu. Kulüp Bilgisi'ndeki menajer kartında itibar ve “Kariyer ›”.

