# Denge düzeltmeleri

## Denge düzeltmeleri (denge raporu bulguları)
- Kadro tamamlama (transfer/ai.ts `fillAiDepth`, `MIN_AI_SQUAD` = 24): kadrosu altına inen yapay zekâ kulübü (yurtdışı dahil, kullanıcı hariç) transfer
  döneminde serbest oyunculardan, kulübün ilk 11 ortalamasının 30 altı / 6 üstü aralığında, en çok ihtiyaç duyulan mevki grubundan ve maaş bütçesine sığan en iyi
  oyuncuyu bedelsiz alır; gün başına %35 (yurtdışı %17,5). Kendi rastgelelik akışı vardır (`DEPTH_SEED_SALT` + gün): mevcut akışı değiştirmez. Nedeni: alım kuralı yalnızca
  ilk 11 seviyesine yakın oyuncuları alıyor, sözleşme yenileme yalnızca sıra < `AI_RENEW_RANK` (22) olanlara; yedekler gidince kadrolar 28 → 20'ye küçülüyor, serbest
  havuz şişiyor, ligin ortalama CA'sı yapay yükseliyordu (FINDINGS.md > Denge).
- İşsiz oyuncuların emekliliği (season/rollover.ts `retirementChance`): 31+ yaş +%40; 24–30 yaş CA < 100 → +%25, değilse +%10 (24 altı yok). Serbest havuz ~250'de doyar.
- Maaş disiplini (transfer/market.ts, season/rollover.ts, transfer/ai.ts): yapay zekâ sözleşme yenilemesi zamsız (`aiRenewalWage` = max(adil, eski maaş)), yeni imza adil maaşla
  (`aiSigningWage`; `wageDemand`'ın eski maaş × 1,1 / × 1,05 zammı yalnızca kullanıcıyla pazarlıkta kalır). 30 Haziran'da yapay zekâ kulübü en iyiden başlayarak yeniler; maaş toplamı
  `wageBudget × WAGE_BUDGET_SLACK` (1,05) aşılırsa kadro sırası `CORE_RENEW_RANK` (11) ve üstündekiler gider. Alımlarda aday maaşı bütçeye sığmıyorsa elenir. Nedeni: zam sarmalı + üstel
  maaş formülü + bütçe kontrolsüzlüğü maaş gideri 10 sezonda ×2,6 yapıp kasaları eksiye indiriyordu (FINDINGS.md > Denge). Rapor "Ekonomi: nakit akışı" ölçüleriyle izler.
- Transfer bütçesi sınırı (season/rollover.ts `seasonTransferBudget`): yıllık bütçe = temel bütçe + kasa fazlasının %30'u, en çok transfer dışı yıllık gelirin yarısı (`TRANSFER_BUDGET_INCOME_CAP`),
  temel bütçenin altına inmez. Nedeni: kasa birikip bütçeyi şişiriyor, kulüpler giderek daha pahalı oyuncu alıyordu (transfer edilenlerin ortalama CA'sı 139 → 157, bedeller ×3,3).
- Yapay zekâ alım eşiği mevki grubuna göre (transfer/ai.ts `groupLevel`): aday CA'sı, alınacak grubun kadrodaki en iyi oyuncularının (kaleci 1, defans 4, orta saha 3, forvet 3)
  ortalamasının 8 altından düşük olamaz. Önceden tek eşik "ilk 11 ortalaması − 8" idi; CA ölçeği mevkiye göre farklı olduğundan kaleciler eşiğe zor ulaşıyordu.
- Kaleci tabanı (transfer/ai.ts `MIN_AI_KEEPERS` = 2): kalecisi 2'nin altına inen yapay zekâ kulübü, kadrosu dolu olsa da ve transfer dönemi
  dışında da (`aiTransferDay` → `fillAiDepth(world, true)`) serbest kaleci alır; aday kulübün kendi kaleci seviyesine göre, alt sınır ve maaş
  bütçesi sınırı yok. Nedeni: kaleci CA ölçeği düşük olduğundan yedek kaleciler sözleşme yenilemede eleniyor, Süper Lig'de kaleci sayısı 63 → 33
  iniyordu; kaleyi saha oyuncusunun tuttuğu maçlar bazı sezonlarda %14, o maçlarda yenen gol 1,4 → 3,4, maç başı gol 2,8 → 3,35.
  Ölçüm (tohum 9000, 5 sezon, yurtdışı ligleriyle): kalecisiz maç %0, Süper Lig kaleci sayısı 50–63, tek kalecili kulüp yok, maç başı gol 2,62–2,94.
- Performans (sonucu değiştirmeyen): `primaryPosition` yalnızca oyuncunun mevkilerini tarar (saha sırası eşitlik kuralı korunur), şutta `keeperUnit`, `teamUnits` ortalamaları
  toplam + sayıyla. Motor performans değişikliğinden sonra: bir sezonun skor + oyuncu CA + RNG durumu parmak izini önce / sonra karşılaştır (birebir aynı olmalı).
- Kadro şablonundaki gençler (generateClubSquad, role 'youth') yıllık genç alımıyla (generateYouthPlayer) aynı model: seviye temel − `YOUTH_LEVEL_GAP` (4,5),
  ek potansiyel `youthExtraPotential` (%6 cevher +20…45, yoksa −5…18; tek çekiliş). Önceden başlangıçtaki yurtdışı gençleri çok yüksek potansiyelliydi, dünya elit katmanı şişiyordu.
- Denge raporu bu iki sorunu kalıcı ölçülerle izler ("Oyuncu havuzu": kadro büyüklüğü, serbest havuz, havuz eğimi). Kullanıcı kulübü kadro ölçülerine girmez (ihmal ediliyor).

