# Taktik ekranı ve taktik özelleştirme

## Taktik ekranı ve karşılaştırma (kullanıcı istekleri)
- Taktik: HTML5 sürükle-bırak (listeden oyuncu, dolu saha yeri, dolu yedek hücresi → saha yeri / yedek hücresi; hedefte oyuncu
  varsa yer değiştirir; sahadan / yedekten kadro listesine bırakılan kadro dışı — removePlayer). Tıkla-seç-tıkla da duruyor.
  Saha yerinde ve yedekte çift tık profili açar. Düzen: sol sütun (tactics-main) kadro + talimatlar + kaptan + uyarılar,
  sağ sütun saha + yedekler position: sticky (main.content kaydırılırken ekranda kalır). Yedekler sahanın sağında dikey liste
  (bench-side, kullanıcı isteği: sahaya yer kalsın); saha 100vh − 290px yüksekliğe sığar, en çok 560 px genişlik. Seçili oyuncunun
  düğmeleri (karşılaştır, kadro dışı) panel başlığında.
- Karşılaştırma en çok 4 oyuncu (engine/squad/compare.ts MAX_COMPARE; store toggleCompare son 4). Bileşenler
  ui/components/CompareDialog.tsx: CompareBar (seçilenler, Karşılaştır, Temizle; pencereyi açar) — Kadro ve Taktik ekranında
  (taktikte ⇆ sütunu ve seçili oyuncu için “Karşılaştırmaya Ekle”); CompareDialog 2–4 sütun (satırda tek başına en iyi değer
  vurgulu, pencere genişliği oyuncu sayısına göre), başlıkta çıkar düğmesi.
- Yardımcı antrenör notu: compareAdvice (saf, yapılandırılmış; metni arayüz kurar): pick (aynı mevki grubunda; yetenek + son
  3 maç formu, sakat seçilmez, yorgun geri düşer), best / close (fark < 4), future (≤ 23 yaş, potansiyeli en iyinin bugününü 8+
  geçen), inXI (kendi oyuncumuz ilk 11'de), fitsXI / rotation / prospect / notNeeded (başka kulübün oyuncusu, scoutVerdict),
  value (en iyiye 6 puan yakın, değeri en iyinin %60'ından az), injured, tired (< %75), unknown (bilgi < 45: gözlemci gönder),
  mixedPositions (farklı mevki grupları; öneri yok). Yetenek / potansiyel gözlemci tahmini (abilityEstimate).

## Taktik özelleştirme (kayıt sürümü 17)
- Yeni takım talimatları (TeamInstructions): tackling (yumuşak/normal/sert), crossing (alçak/karışık/yüksek), freedom
  (disiplinli/normal/özgür), counterAttack, offsideTrap, playOutOfDefence, timeWasting, cornerStyle (ön direk/karışık/arka
  direk/kısa), freeKickStyle (kaleye/karışık/orta). Varsayılanlar motorda etkisiz; göç eski taktiklere varsayılanları ekler, motor
  da eksik alanları varsayılanla doldurur (newTeam). Etkiler instructionEffects'te (rakibin talimatları da girer: karşı atak hücuma
  kalkan rakibe, geriden oyun kurma yoğun prese karşı); yeni etki oppAttackChance (zaman geçirme iki tarafın atağını azaltır).
  TeamProfile'a hücumcuların hava topu, yaratıcılık, defansın pası / dikkati, sıkı markaj sayısı eklendi. 600 maçlık ölçümde
  tek talimatın gol farkına etkisi ±0,2 içinde, hepsinin bedeli var.
- Bireysel talimat (PlayerOrders: duty, channel, longShots, dribble, tightMarking, freeRole) mevkiye verilir: Tactics.orders
  (mevki sırası; varsayılan = null, hepsi varsayılansa []). resolveLineup → Lineup.starters[].orders → PlayerMatchState.orders;
  oyuna giren yedek çıkanınkini devralır. Motor: orderWeights (hücum/orta/savunma katkısı), orderShooting (şutçu seçimi; uzaktan
  şut talimatında uzaktan şut payı +0,2), orderCreating (asist). 2D saha: ordersShift (ileri/geri, kenar/orta kayma).
- Diziliş şekli artık önemli: fullWeights = dizilişin ağırlığı^0,7 × yapay zekâ dizilişlerinin ortalaması^0,3 (SHAPE_EXPONENT);
  çok forvetli diziliş hücumda biraz güçlü, savunmada zayıf. Yapay zekâ yalnızca eski 6 dizilişten seçer (AI_FORMATION_IDS);
  kullanıcıya 4-1-4-1, 4-4-1-1, 3-4-3, 4-3-1-2 eklendi.
- Özel diziliş: CustomFormation {slots, layout} (Tactics.custom, TeamSetup/TeamState.custom). slotsOf / layoutOf / formationName
  (satırlar yüksekliğe göre) her yerde FORMATIONS[...] yerine; positionAt(x, y) konumdan mevki (FV < 27 ≤ OOS < 42 ≤ OS < 57 ≤
  ÖL/KB < 67 ≤ DEF; kenar %28–32). Taktik ekranında “Dizilişi Düzenle”: yerler pointer olaylarıyla sürüklenir (kaleci sabit),
  sahada mevki bölgeleri görünür; moveFormationSpot oyuncuyu ve talimatı yerinde bırakır. Hazır dizilişe geçince özel bırakılır,
  bireysel talimatlar aynı mevkiye taşınır (carryOrders).
- Taktik setleri: Tactics.plans (3 set, TacticPlan {formation, custom, instructions, orders}) + activePlan; etkin set üstteki
  alanlardadır. switchPlan şimdikini kaydeder, seçileni yükler, ilk 11'i yeni mevkilere dağıtır; copyPlan. Maçta
  store.liveSwitchPlan → changeTactics({formation, custom, instructions, orders, plan}); TeamState.plan gösterim için.
  changeTactics artık özel diziliş ve bireysel talimat alır; slotHolders (mevki sırasına göre sahadakiler) 2D sahayla ortak.
- Duran top: Tactics.cornerTakerId, targetManId (TeamSetup / TeamState). Korner tarzı şut olasılığı / kalitesi (CORNER_STYLE),
  kısa kornerde yerden şut; kornerci varsa gol asistinin %80'i onun; hedef adam kafa vuruşlarının üçte birinden fazlasını alır;
  serbest vuruşta “orta” kafa vuruşuna çevirir. Varsayılan korner (karışık, kornerci seçilmemiş) eskisi gibi.
- Arayüz: InstructionsPanel (Hücum / Savunma grupları, aç-kapa talimatlar çip), SetPieceStyles, OrdersEditor, PlanPicker,
  FormationPicker (özel sekmesi). Taktik ekranı: set seçici + “Seti kopyala”, Oyuncu Talimatları paneli (sahada tıklanan
  oyuncu; ▲ ▼ • rozetleri), Kaptan ve Duran Toplar'a kornerci / hedef adam / tarzlar. Maç ekranı taktik paneli: set (A/B/C),
  diziliş, talimatlar, duran top.

