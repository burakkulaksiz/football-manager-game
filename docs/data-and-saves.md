# Veri dosyaları, gerçek kadrolar ve kayıt

## Veri formatları
- `data/clubs.json` — `[{ id, name, shortName, city, stadium, capacity, reputation (1–100),
  budget (€), wageBudget (€/yıl), fanExpectation, colors: { primary, secondary } }]`.
  fanExpectation: `title | europe | top_half | mid_table | avoid_relegation`.
  Stadyum/bütçe değerleri yaklaşık, elle düzeltilebilir.
- `data/nations.json` — `[{ code, name, namePool, weight }]`. `TUR` zorunlu (weight 0: yerli ayrı seçilir).
  weight = yabancı oyuncu üretiminde seçilme ağırlığı.
- `data/names/<havuz>.json` — `{ firstNames: [], lastNames: [] }`. Yeni dosya eklemek yeterli.
- `data/lower_league.json` — 1. Lig kulüpleri (gerçek 2026/27; clubs.json ile aynı biçim, en az 3). Oyunda
  `division: 2`; kadroları oyun başında üretilir. Küme düşen Süper Lig kulübü de buraya iner.
- **Kayıt** (IndexedDB, Dexie şema sürümü 2): `saves` = SaveSlot `{ id, name, careerId, clubId, clubName,
  gameDate, season, isAutosave, createdAt, updatedAt, formatVersion, managerName? }`; `saveData` = `{ id, world: GameWorld }`
  (aynı id). GameWorld olduğu gibi yazılır (düz veri), kayıt anında `structuredClone` ile kopyalanır.
  `SAVE_FORMAT_VERSION = CURRENT_WORLD_VERSION` (şu an 11). GameWorld yapısı değişince sürümü artır ve
  `engine/migrate.ts`'e dönüşüm ekle; `loadGame` eski kayıtları otomatik dönüştürür, daha yeni sürümü reddeder.
  Sezon sonu kaydı ~1.7 MB (+ haberler/teklifler).
- **careerId** = `${seed}-${playerClubId}`. Otomatik kayıt kariyer başına AUTOSAVE_SLOTS (3) dönüşümlü slot:
  dolmadıysa yeni slot, dolduysa updatedAt'i en eski olanın üzerine yazar (updatedAt art arda kayıtta da kesin artar); elle kayıt sınırsız.
- **Hata günlüğü** (persistence/errorLog.ts): localStorage 'fm-error-log', son 50 { at, source, message, stack? }. Kaynaklar:
  window 'error', 'unhandledrejection' (installErrorLog, main.tsx), ErrorBoundary (ekran çökmesi; boş sayfa yerine yenile ekranı),
  otomatik kayıt hatası (store). Depolama erişilemezse sessizce atlanır. Arayüz: Ayarlar > Hata Günlüğü (kopyala, temizle).
- **PWA**: public/manifest.webmanifest + icon.svg + sw.js (bağımlılık yok). sw.js yalnızca üretimde kaydedilir (main.tsx); sayfa
  önce ağ, diğer dosyalar önce önbellek (önbellek adı sürümlü: 'futbol-menajeri-v1'; değiştirince eskisi silinir). Sesler ilk
  çalındıklarında saklanır. navigator.storage.persist() istenir (kayıtlar silinmesin).

## Kayıt kuralları (kullanıcıyla kararlaştırıldı)
- Canlı maç sürerken (başlama öncesi dahil) kayıt **yapılamaz**; liveMatch kaydedilmez.
- **Otomatik kayıt** her maç gününden sonra (haftanın maçları oynanınca) arka planda alınır.
- Maç ortasında çıkılırsa son kayıt yüklenince o maç baştan oynanır (aynı tohum → yine deterministik).
- Ana menüye dönüşte kaydedilmemiş ilerleme varsa uyarı (Kaydet ve Çık / Kaydetmeden Çık); sekme
  kapatılırken tarayıcı uyarısı (beforeunload). Ana menüde en son kayıttan "Devam Et" kısayolu.
- Kayıt dışa/içe aktarma (persistence/exchange.ts saf, saves.ts exportSlot / importSave, arayüz LoadGameScreen): zarf { format: 'fm-save', formatVersion, exportedAt, slot (SaveSlot, id hariç), data (SaveData, id hariç: world, liveMatch?) }; sıkıştırma yok (~3 MB yeni kariyer), içe aktarma sınırı 100 MB. İçe aktarma: zarf denetimi → yüklemedeki dönüştürme + denetim (readWorld) → saveGame ile yeni slot, güncel biçimde; üzerine yazmaz (aynı ada '(içe aktarıldı)'), otomatik kayıt değildir, careerId dünyadan yeniden hesaplanır. Bozuk dosya hiçbir şey yazmaz.

## Gerçek kadrolar (kullanıcı seçti: Transfermarkt, kısa + isteğe bağlı ayrıntı, eksikler rastgele)
- data/squads/<kulüpId>.json (biçim data/README.md'de; tipler data.ts SquadPlayerData, doğrulama validateSquads).
  gameData.ts glob ile yükler. generateClubSquad dosya varsa realClubSquad'a gider (createWorld, yurtdışı kulüpleri ve
  eski kayıt dönüşümleri aynı yoldan) — yalnızca yeni oyunu etkiler, kayıt biçimi değişmedi.
- realPlayer: generatePlayer (seviye = ability, yaş doğumdan) + dosyadakiler (ad, doğum, mevkiler, ayak, özellikler,
  gizli özellikler, sözleşme 30 Haziran'a yuvarlanır, maaş, forma no, joined → hiyerarşide kulüpteki süre; oyun başından
  sonraki katılış oyun başı sayılır). CA özelliklerden yeniden hesaplanır; potential verilirse PA = CA + (pot − güç) × 10,5.
  Türkiye kulübünde ≤ 18 yaş ve güç < kulüp seviyesi − 3 → U19. A takım < 25 ise şablonun eksik mevki gruplarından
  (genç → yedek → ilk 11 rolleri) rastgele tamamlanır. Maaşı yazılanlar bütçeden düşülür, kalanı diğerlerine ölçeklenir.
- scripts/transfermarkt.mjs: TR1 + TR2 lig sayfalarından kulüpler (CLUBS: TM kimliği → oyun kimliği), kadro sayfası
  (kader/plus/1) curl ile (Node fetch engelleniyor), scripts/.cache'te 24 saat, istekler arası 3,5 sn. Güç = oyunun piyasa
  değeri formülünün tersi: CA = 17·ln(değer/1500), 29 yaş üstüne yıl başına +17·ln(1/0,82), gençte potansiyel payı düşülür;
  seviye = 1 + (CA − 1)·19/199 − 0,3. Değeri olmayan 150 bin € sayılır. İlk uyruk esas (bilinmiyorsa raporlanır).
  --info yeni kulüp için stadyum / kapasite / toplam değer yazdırır.
  --foreign: 8 yurtdışı ligi (FOREIGN_LEAGUES: GB1, ES1, L1, IT1, FR1, PO1, NL1, BE1) lig sayfasından kulüpler (FOREIGN: TM kimliği →
  [oyun kimliği, ad, kısa ad, şehir, renkler], renk / şehir Transfermarkt'ta yok, elle), kadro sayfasından kadro + stadyum /
  kapasite; data/foreign_clubs.json yazılır (dosyada olan kulübün alanları korunur, yeni kulüp kadro değerinden: bkz. world.md).
  DİKKAT (2026-10-31): sitenin değer birimleri "mil. €" / "bin €" iken "Mn €" / "Bin €" / "Mr €" oldu; parseValue ikisini de
  okur. Eski ayrıştırıcıyla Donnarumma 45 € çıkıyordu (güç 7) ve yurtdışı ilk 11'leri 1. Lig'den zayıf kalıyordu.
  Denge düzeltmesi (ilk sürümde 3,25 gol/maç, %21,8 beraberlik, gol kralı ort. 34 çıktı): mevki payı POSITION_OFFSET
  (KL +1,4, STP +0,6, bek +0,45, orta saha +0,2, 10 numara +0,3, kanat/forvet −0,25 — piyasa değeri hücumcuyu pahalı gösterir)
  ve 12,5 çevresinde ×0,72 sıkıştırma (TM'de büyük-küçük farkı oyunun ölçeğinden geniş). Sonuç (~4600 maç): 2,70 gol,
  %43,7 ev, %26,7 beraberlik, gol kralı ort. 25,1 (en çok 30).
- Veri hattı (ağ isteği yok; scripts/data.mjs, mantık src/tools/data/ testli):
  - `npm run data:check`: önce oyunun açılış doğrulaması (validateGameData; yapı hataları), geçerse kadro denetimi (squadCheck.ts):
    hata = takvimde olmayan doğum, 15 altı / 50 üstü yaş, piyasa değeri ≤ 0 ya da > 300 M €, sözleşme bitişinden sonra / doğumdan önce
    katılış, aynı kadroda yinelenen oyuncu (ad + doğum yılı); uyarı = 41 üstü yaş, güçten düşük potansiyel, sezon başından önce bitmiş
    sözleşme, kaleci + oyuncu mevkisi birlikte, başka kadroda da olan oyuncu, kadro < 20 ya da > 40, asıl mevkiye göre kaleci < 2 /
    defans < 5 / orta saha < 5 / hücum < 3, dosyası olmayan Türkiye kulübü. Hata varsa çıkış kodu 1.
    İlk koşu (2026-10-27, 38 kadro, 1140 oyuncu): hata 0, uyarı 0. 118 oyuncunun piyasa değeri yok (çekici bilerek 150 bin € sayıyor;
    genelde altyapıdan yeni çıkanlar), uyarı yapılmadı: her kulüpte çıkıp gerçek uyarıları gömüyordu.
  - `npm run data:diff [-- <sürüm>]`: git'teki sürüm (varsayılan HEAD) ile çalışma kopyası arasında gelen / giden / kulüp değiştiren /
    değeri, asıl mevkisi, gücü, uyruğu ya da sözleşmesi değişen oyuncular (ad + doğum yılıyla eşleşir) → reports/data/diff-latest.md.
  - Güç ile piyasa değeri tutarlılığı denetlenmiyor: abilityFromValue çekici betikte ve betik içe aktarılınca çekime başlıyor.
  - Zamanlanmış iş (tanımlı, ETKİN DEĞİL; karar Burak'ın: Transfermarkt kullanım koşulları, çekme sıklığı ve veri lisansı netleşmeden
    çalıştırılmaz). Haftada bir, elle ya da GitHub Actions / Görev Zamanlayıcı ile, ayrı dalda:
    `git switch -c veri/<tarih>` → `node scripts/transfermarkt.mjs` → `npm run data:check` (hata varsa dur) → `npm run data:diff`
    (rapor PR açıklamasına) → data/squads commit → PR, elle gözden geçirilip birleştirilir. Elle düzeltilmiş kadrolar çekimde ezilir:
    fark raporunda "Bilgisi değişen" bölümüne bakılır.
- Kupa: Süper Lig + itibarı en yüksek 8 1. Lig kulübü (CUP_LOWER_CLUBS; 26 kulüp, 6 bay — eskisi gibi).
  fillAcademies gerçek kadrodan U19'a inenleri sayar (U19 yine 7–9). Gerçek A takımlar 25–38 kişi (yapay zekâ yeni sezonda 30'a indirir).
- Lig 2026/27'ye güncellendi: Çorum FK, Amed SK, Erzurumspor çıktı; Antalyaspor, Kayserispor, Karagümrük 1. Lig'e
  (itibar −5, bütçe ×0,5, maaş bütçesi ×0,6). 1. Lig artık gerçek 20 kulüp (kurgusallar silindi). Yeni kulüplerin itibarı
  kadro değerinden (log ölçek, mevcut kulüplere göre) tahmin, bütçeler benzer itibarlı kulüplerden.
- nations.json 29 → 85 ülke (Transfermarkt uyrukları). Yeni Nation.nationalTeam (false: milli takımı yok — küçük ülkeler,
  Rusya); milli takım sistemi nationalTeams(data) ile. Yeni havuzlar: hu, ro, gr, ar, al, ka, ru, ua, ko. Eleme grupları
  artık ülke sayısına göre (en çok 5'li; 34 UEFA → 7 grup); turnuvaya 8 UEFA ülkesi: qualifierRanking (önce grup
  birincileri, sonra en iyi ikinciler; puan, averaj, gol), metin qualifierRuleText.
- DİKKAT: yeni isim havuzu / kadro dosyası eklenince testler glob sonucunu önbellekten okuyabilir → node_modules/.vitest-cache sil.

