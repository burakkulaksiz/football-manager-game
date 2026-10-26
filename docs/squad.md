# Oyuncu durumu ve kadro yönetimi

## Oyuncu durumu kuralları (aşama 8)
- **Uygunluk:** `isAvailable(p)` = sakat değil ve cezalı değil. Otomatik kadro, taktik çözümü (resolveLineup)
  ve yapay zekâ bunu kullanır. Otomatik kadro yorgun oyuncuyu cezalandırır (kondisyon < 85 → puan düşer).
- **Sakatlık:** maç içi sakatlık kalıcı olur (10 tür, 2 gün – 8 ay, ağırlar nadir); antrenmanda günlük
  0.0005 × (sakatlık eğilimi/10) × yoğunluk çarpanı. Gün gün iyileşir; dönüşte kondisyon ≥ 70.
  Sezonda kulüp başına ~5–15 maç sakatlığı + antrenman sakatlıkları.
- **Ceza:** 4 sarı → 1 maç (sayaç 4 düşer); ikinci sarıdan kırmızı → 1 maç (o maçın sarısı sayılmaz);
  direkt kırmızı → 1 (%60) / 2 (%30) / 3 (%10) maç. Ceza, kulübün sonraki lig maçlarında çekilir.
- **Kondisyon:** maç sonu kondisyonu oyuncuya yazılır; günlük +6 + doğal kondisyon × 0.25; tavan yoğunluğa
  göre (hafif 100, normal 98, yoğun 94). Sakat oyuncu 60'ı geçmez.
- **Moral:** galibiyet +5, yenilgi −5, puan ≥ 7.5 +3, ≤ 5.5 −3, ilk 11 +1; kadro sırası ilk 14'te olup
  oynamayan sağlam oyuncu −3; diğerleri sonucun yarısı. Günlük ortalamaya (60) dönüş (%3, en az 1 puan).
  Kullanıcının oyuncusu < 30 ise haftalık şikâyet haberi (45 gün arayla). Transfer → en az 72, yenileme +8.
- **Gelişim (pazartesi):** yaşa göre haftalık özellik puanı (≤18: 0.5 … 28–29: 0 … 34+: −0.28).
  Artı: × (PA − CA)/25 (0–1) × (0.6 + profesyonellik × 0.8) × yoğunluk; sakat gelişemez.
  Eksi: × (1.2 − prof × 0.4) × (1.15 − doğal kondisyon × 0.3). Birikim ±1 → bir özellik ±1, CA yeniden
  hesaplanır. Artışta özellik seçimi: mevki ağırlığı × odak (×3) × (20 − değer)/10; düşüşte fiziksel ×3.
  `trend` gelişim eğilimi (UI ▲/▼). Antrenör raporu yıldızları = (yetenek − 45) / 25, 0.5–5.
- Denge (aşama 8 sonrası, ~4600 maç): 2.55 gol, %44.9 ev, %25.0 beraberlik (goalBase 0.27, homeAttack 1.2).

## Altyapı kuralları (aşama 10, kullanıcı seçti: ayrı U19 takımı)
- Player.academy = U19 oyuncusu. clubPlayers() A takımı döndürür (U19 hariç): maç kadrosu, kadro ekranı, taktik,
  moral, transfer sıralamaları (squadRanks) U19'u saymaz. U19 haftalık gelişime katılır (DEFAULT_TRAINING).
- Başlangıç: her kulübe 7–9 kişilik U19 (15–18 yaş), ayrı rng (seed ^ ACADEMY_SEED_SALT) — ana dünya aynı kalır.
- 30 Haziran: U19 sözleşmeleri 1 yıl uzar. 1 Temmuz: manageAcademies (yapay zekâ: 19+ yaştakini A takımın
  22. oyuncusundan iyiyse alır, değilse oyuncu silinir; 17+ yaşta 16. oyuncudan iyiyse erken alır; A takım ≤ 28),
  kullanıcıya 19+ için haber; sonra academyIntake (her kulübe 4–6 kişi, 15–16 yaş; haber kategorisi 'academy').
- Genç potansiyeli: generatePotential yaşa bağlı pay + ek: %6 cevher (+20…45), diğerleri −5…+18.
  U19 PA medyanı ~109, %90'ı ≤ 137, 5 yıldız (≥ 158) ~%1 (academy.test denetler).
- U19'a gönderme: A takımdaki, kiralık olmayan, 19 yaşından küçük oyuncu. Transfer/kiralık/serbest bırakma
  oyuncuyu U19'dan çıkarır. Yapay zekâ başka kulübün U19'undan oyuncu almaz; kullanıcı teklif yapabilir.
- world.youthWatch: takip listesi (oyuncu silinince temizlenir). Biçim 6 dönüşümü: U19 kadroları, youthWatch,
  ilk gelişim kaydı.
- Arayüz: Altyapı ekranı (U19 Kadrosu / Gelişim / Ligdeki Gençler). Yetenek puanı gizli: grafiklerde sayı yok,
  "Son 6 ay" etiketi (Hızlı ≥ +10, İyi ≥ +4, Yavaş ≥ 0, Geriliyor). Başka kulübün oyuncusunda potansiyel gözlem
  tahmini (potentialStarsFor: oyuncuya sabit ±0.5 yıldız sapma) — kadro ekranı ve profilde de.

## Yardımcı antrenör
- assistantAdvice(world): önem sırasıyla (Acil / Önemli / Öneri) öneriler. Türler: ilk 11'de sakat / cezalı /
  ayrılmış oyuncu (acil), mevkisinin yabancısı (verim < %85), yedekte yetenek × verimi 10+ iyi seçenek, maça ≤ 3 gün
  kala yorgun (< %80), mutsuz (moral < 30); dizilişteki mevkide yatkınlığı ≥ 15 oyuncu sayısı < gereken + 1
  (hiç yoksa acil); ilk 11'de bölge ortalaması takımın 8+ gerisinde (en zayıf bölge); en iyi 14 oyuncudan sözleşmesi
  sezon sonu bitenler (tek öneri; ocaktan önemli, nisandan acil); U19 yaş sınırı, A takım 18. oyuncusu seviyesindeki
  U19'lu; 6+ maçtır hiç oynamayan ≤ 21 yaş gençler (tek öneri); kadro > 30 / < 20; maaş bütçesi aşımı.
- Arayüz: AssistantPanel — Gelen Kutusu üstünde (ilk 4, "Tümünü göster"), Taktik ekranında ilk 11 ve mevki derinliği
  (yoksa gizli), maç öncesinde acil / önemli ilk 11 uyarıları. Bulunulan ekrana giden düğme gizlenir.

## Oyuncu görüşmeleri
- Talepler (pazartesi, playerRequests; eski şikâyet haberinin yerine): ayrılık (30+ gün moral < 25; unhappySince),
  forma şansı (moral < 30, sağlam, sözü yok), sözleşme (ilk 11 seviyesi; ekimden itibaren sözleşmesi sezon sonu
  bitiyor ya da maaşı talebinin %60'ından az). Oyuncu başına tek açık talep, talepler arası 45 gün (lastComplaint),
  haftada en fazla 1 yeni talep (ayrılık > forma > sözleşme, aynı türde en iyi oyuncu). Yanıt süresi 7 gün;
  yanıtsız kalırsa düşer, moral −8.
- Yanıtlar (respondToRequest): forma → söz ver (+12, söz takibe), yerini kazanmalı (profesyonellik ≥ 14: +3, değilse
  −6), kiralık listesi (+6); sözleşme → görüşelim (+4, yenileme penceresi), şimdi değil (−8), sözleşmesine uymalı (−12);
  ayrılık → transfer listesi (moral kaybı yok, +10), ayrılamaz (−15).
- Menajer görüşmeleri (talkToPlayer, oyuncu başına 14 günde bir): öv (form ≥ 7: +8, ≥ 6.5: +4, altı: −3, oynamadı: +1),
  eleştir (form ≥ 7: −12 haksız; profesyonellik ≥ 14: −2, < 10: −10, diğer −5), moral ver (moral < 50: +6, değilse +2),
  forma sözü (+10).
- Forma sözü (trackPromises, maç sonrası): oynayabildiği 5 maçın ≥ 3'ünde ilk 11 → +8; değilse −20 ve mutsuz sayılır.
  Sakat/cezalıyken oynanan maç sayılmaz. Yardımcı antrenör: bekleyen talep (acil), tehlikedeki söz (önemli).
- Arayüz: profilde Görüşme paneli (TalkPanel), kadroda "Görüşmek istiyor" etiketi. Biçim 8: requests, promises.

## Kaptanlık ve hiyerarşi
- Etki = liderlik ×1.5 + tecrübe (18 yaş sonrası yıllar, en fazla 14) ×0.8 + kadrodaki önem (yetenekte ilk 12) ×0.8 +
  kulüpte süre (en fazla 6 yıl) ×1.2 + kaptan 6 / yardımcı kaptan 3. Sıralama: ilk 2 takım lideri, 3 etkili, 5 saygın.
- Kulüpte süre: Player.joined (transfer / altyapıya katılış); oyun başından beri kulüpte olanlar oyuncuya göre sabit
  1–6 yıl (17 yaşından önceye gitmez) + oyun başından beri geçen süre (oyun başı = world.manager.joined).
- Tactics.viceCaptainId (biçim 9). Maçta kaptan sahada değilse yardımcı kaptanın liderliği (±%3); kaptan / yardımcı
  boşsa (otomatik, yapay zekâ dahil) ilk 11'in en yüksek liderlikli iki oyuncusu.
- Kaptan değişikliği (store.updateTactics → applyCaptainChange): eski kaptan −6 (lider/etkiliyse −12) ve haber; yeni
  kaptan +8; liderler varken saygın / diğer seviyesinden kaptan → her lider −4. Yardımcı kaptanda yarısı.
  Taktik ekranındaki "En iyi 11" kaptanları korur.
- Haftalık leadersInfluence: liderlerin moral ortalaması ≥ 70 → diğerleri +1; ≤ 35 → −2.
- Yardımcı antrenör: kaptan lider değil (öneri), liderler mutsuz (önemli). Arayüz: Takım Dinamikleri ekranı
  (kaptan / yardımcı seçimi, takımın havası, hiyerarşi tablosu); Taktik ekranında yardımcı kaptan seçimi.
- Not: kaptan değişikliği gol dağılımını değiştirmedi (40 sezon: gol kralı ort. 25.8, önce 25.6); istatistik testi
  15 sezonda en fazla bir 38+ uç sezona izin verir.

## Oyuncu geçmişi
- Player.career: sezon sonu (endSeason → recordSeasonCareers) her oyuncunun o sezon forma giydiği her kulüp için bir
  satır (maç, ilk 11, gol, asist, MA, kartlar, ort. puan; kiralıksa loan). Bu sezon canlı (currentSeasonRows).
  seasonStatsByClub fikstürü tek geçişte toplar. Oyun başından önceki kariyer yok (kurgusal dünya).
- Player.moves (en fazla 30): transfer (bedel) / serbest imza / kiralık (bedel) / kiralık dönüşü / serbest bırakılma /
  U19'dan A takıma — market.ts (transferPlayer, loanPlayer, returnLoans, releasePlayer) ve promoteToFirstTeam yazar.
- Profil: "İstatistikler" yerine tam genişlikte "Kariyer" (sezonlar + toplam) ve "Kulüp Geçmişi" paneli; kulüp adına
  tıklayınca o kulübün kadrosu. Biçim değişmedi (alanlar isteğe bağlı). Kayıt sezon başına ~50 KB büyür.
- Not: git stash / checkout core.autocrlf=true ile dosyaları CRLF yazabiliyor; düzenleme betikleri LF bekler.

