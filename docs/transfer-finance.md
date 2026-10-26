# Transfer, finans, gözlemciler ve tesisler

Ayrıca: menajer pazarlığı (world.agents, sözleşme maddeleri, serbest kalma bedeli) history.md > "Aşamalar" > 10. Cila maddesinde.

## Transfer ve finans kuralları (aşama 7)
- **Dönemler:** yaz 1 Tem – 8 Eyl, devre arası 2 Oca – 1 Şub. Dönem kapanınca açık teklifler iptal.
- **Kullanıcı alıcı:** teklif → satıcı ertesi gün karar: ≥ beklentinin %92'si kabul, ≥ %60 karşı teklif
  (= beklenti), altı ret; kadrosu ≤ 20 olan satmaz. Beklenti = piyasa değeri × (1.15 + 0.35 × önem);
  önem: ilk 11 = 1, rotasyon (12–16) = 0.5; sözleşmesine ≤ 1 yıl kalana ×0.8.
- **Sözleşme:** oyuncu talebi = max(kulübün maaş ölçeğine göre adil maaş, mevcut maaş × 1.1);
  istediği süre dışında +%10; (maaş + imza bonusu / yıl) ≥ talep → imzalar; %80'ine yakınsa talebini
  söyler; 3 ret → anlaşma bozulur. Maaş bütçesi ve transfer bütçesi kontrol edilir.
- **İsteklilik:** oyuncu, kulübünden 20 itibar puanından daha düşük kulübe gitmez (30+ yaş: 30 puan).
- **Kiralık:** sezon sonuna (30 Haz) kadar; maaşı kiralayan öder; ilk 11 oyuncusu kiralık verilmez;
  bedel beklentisi değerin %8'i.
- **Kullanıcı satıcı:** yapay zekâ teklifi 7 gün bekler; kabul → hemen satış; karşı teklif → alıcı ertesi
  gün, gizli üst sınırı (`maxFee`, değerin 1.1–1.4 katı) içindeyse kabul eder.
- **Yapay zekâ alımları:** dönem içinde her kulüp günlük %5 (yaz) / %3 (kış) olasılıkla en eksik mevki
  grubuna, bütçesine ve itibarına uygun oyuncu alır; kadro ≥ 28 ise almaz. Sezonda ~30–40 transfer.
- **Finans:** başlangıç kasası = transfer bütçesi + maaş bütçesinin 1/4'ü. Yıllık yayın = maaş bütçesinin
  %45'i, sponsor %30'u (aylık 1/12). Bilet = seyirci × bilet fiyatı (8 + itibar × 0.3 €); seyirci =
  min(kapasite, taraftar × rakip çekiciliği), taraftar = 2000 + (itibar/100)³ × 60000. Galibiyet primi
  maaş bütçesinin %0.3'ü (beraberlik 1/3). Satışın %50'si transfer bütçesine eklenir.
- Lig sıralaması ödülü / yayın payının performansa bağlanması 9. aşamada (sezon sonu).

## Transfer / kiralık listesi kuralları
- Player.listing = { kind: 'transfer' | 'loan', price: number | null (null = önerilen), since }.
- Kullanıcı: kendi (kiralık olmayan) oyuncusunu listeler; transfer listesi moral −8 (bir kez). Önerilen bedel:
  transferde piyasa değerinin %90'ı, kiralıkta loanFeeAsk. Dönem açıkken listedeki oyuncu başına günlük %8 (yaz) /
  %6 (devre arası) teklif olasılığı, aynı anda tek açık teklif. Alıcı: kadrosu < 28, oyuncu ilk 11 ortalamasının
  −22…+12 aralığında, transferde bütçe ≥ bedelin %70'i. Teklif istenen bedelin %65–100'ü, gizli üst sınır %100–115.
  Gelen kiralık teklifi: completeAiDeal (kabul / karşı teklif kiralık olarak tamamlanır).
- Yapay zekâ: dönem açıldığı gün (ve yeni oyunda) refreshAiListings: kadro sırası 22+ ve 22+ yaş → satılık (≤ 3),
  21 yaş altı ve kadro sırası 16+ → kiralık (≤ 2). Satılıkta askingPrice ×0.8, kiralıkta loanFeeAsk ×0.6.
- Transfer / kiralık / serbest bırakma listeyi siler. Biçim 7 dönüşümü: dönem açıksa yapay zekâ listeleri.
- Arayüz: profilde liste düğmeleri ve ListDialog; Transfer Merkezi "Listem" sekmesi, aramada "Liste" filtresi,
  gelen tekliflerde tür; kadro ekranında etiket ve "Listede" filtresi.

## Gözlemci sistemi (kullanıcı seçti: aralık gösterimi, kendi kadro + maç bilgisi, görev listesi)
- Bilgi 0–100 yalnızca kullanıcı için (world.scouting.knowledge); yapay zekâ her şeyi bilir, motoru etkilemez.
  knowledgeOf: kendi oyuncumuz (U19, kiralık gelen dahil) ve bizde oynamış olan (moves/career) = 100; diğerleri
  max(ün, kayıtlı bilgi). Ün = (CA − 90) × 0.45 + (itibar − 30) × 0.25, 0–60; başka kulübün U19'u 0.
  Başlangıçta ligin çoğu 1–39, en iyiler ~50.
- Maç: kulübümüzün maçında forma giyen rakipler +20 (en fazla 75; tam bilgi yalnızca raporla) — applyResult.
- Görünüm: özellik aralığı genişliği 2 + (1 − k/100) × 8 (bilgi 0 → 10, tam → tek sayı); gerçek değer hep içinde,
  kayma oyuncu+özelliğe bağlı sabit oran. Yetenek tahmini ±20 × (1 − k/100), potansiyel ±(5 + 15 × (1 − k/100))
  (tam bilgide bile ±5). Tahminler "?" ile; kendi oyuncumuzda antrenör raporu kesin. Transfer aramasında özellik
  filtresi aralığın ortasıyla; başka oyuncunun gelişim grafiği yalnızca tam bilgiyle.
- Görevler (aynı anda 3; ücret transfer bütçesinden ve kasadan, finans dökümünde "Gözlemcilik"):
  oyuncu 7 gün €10 bin → 100; arama (mevki, en fazla yaş, en fazla değer) 14 gün €25 bin → en iyi 5 aday
  (CA + gençte (PA − CA)/2 ± 12 yanılgı) 100; kulüp taraması 21 gün €40 bin → A takım 80. İptalde ücret dönmez.
  Rapor günü önemli haber; en fazla 30 rapor. Emekli olanların bilgisi yeni sezonda silinir.
- Gözlemci görüşü (scoutVerdict): görünen yetenek, kadromuzda aynı mevki grubunun ilk 11 düzeyi (GK 1, DEF 4,
  MID 4, ATT 2. en iyi) ve yedek düzeyiyle (2 katı) karşılaştırılır → İlk 11'e girer / Rotasyon / Geleceğin
  oyuncusu (≤ 21 yaş, potansiyeli ilk 11 düzeyinde) / Kadroya katkı sağlamaz. Profilde bilgi ≥ 80 ise görünür.
- Arayüz: Transfer Merkezi → Gözlemciler (süren görevler, yeni görev, açılır raporlar); profilde "Gözlemci gönder",
  Gözlemci Raporu (bilgi çubuğu, tahminler, görüş); aramada Yetenek ve Bilgi sütunları.

## Tesisler (kullanıcı seçti: dört tesis, yönetimden talep, seviye + inşaat süresi + bakım)
- Kayıt sürümü 16: world.facilities (FacilitiesState: Türkiye kulüplerinin seviyeleri training / youth / medical 1–10, kullanıcının
  inşaatları, reddedilen taleplerin günü); ExpenseCategory facilities ("Tesisler"). engine/finance/facilities.ts.
- Başlangıç: levelForReputation = 1 + itibar/100 × 8 (± kulübe bağlı sabit 1 sapma); yurtdışı kulübünde saklanmaz, itibardan (devler 10).
  Stadyum seviye değil kapasite: genişletme +5.000 koltuk (en çok 80.000), €1.200 / koltuk, en erken 5 ay sonraki 1 Temmuz'da biter.
- Tesis bedeli 200 bin × seviye^1.6 (5→6 ~€2,6 Mn, 9→10 ~€6,7 Mn), inşaat 3 + seviye/3 ay. Bakım (ay başı, tüm Türkiye kulüpleri):
  seviye başına €40 bin / yıl + 1000 koltuk başına €6 bin / yıl.
- Talep (requestFacility): kasa ≥ bedel × 1,3 + maaş bütçesi / 8 ve yönetim güveni ≥ 50 − (menajer itibarı − 50) × 0,3; onayda bedel
  kasadan, reddedilirse 60 gün bekleme; tür başına tek inşaat. Haber (board). facilitiesDay tamamlanınca seviye / kapasite + önemli haber.
- Etkiler: antrenman tesisi gelişim × (0,85 + 0,035 × seviye) (U19'da altyapı tesisi), antrenman sakatlığı × (1,15 − 0,03 × antrenman)
  × (1,15 − 0,03 × sağlık); sağlık merkezi sakatlık süresi × (1,2 − 0,04 × seviye), maç sakatlığı × (1,12 − 0,025 × seviye)
  (TeamSetup / TeamState.injuryRisk, checkInjury); altyapı tesisi U19 alımında seviye + (L−5)×0,25, ek potansiyel + (L−5)×2, cevher
  olasılığı × (0,6 + 0,08 L) (generateYouthPlayer bonus). Yapay zekâ kulüplerinin tesisleri sabit (yatırım yapmazlar).
- Arayüz: Kulüp → Tesisler (FacilitiesScreen): kasa, gereken güven, yıllık bakım; kart başına seviye çubuğu, ligdeki sıra, şu anki
  etki (oyundaki çarpanlardan), bir üst seviyenin bedeli / süresi / etkisi, "Yönetimden İste" ve süren inşaatın ilerlemesi;
  stadyumda ortalama seyirci ve doluluk.

