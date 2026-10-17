# Futbol Menajeri (FM 2005 tarzı) — Geliştirme Notları

Yeni bir oturumda buradan devam et. Asıl istek/kapsam: `FM_Agent_Prompt.md`.
Çalışma şekli: her aşama sonunda test + commit, kullanıcıya nasıl deneyeceğini yaz, onay bekle.

## Komutlar
- `npm run dev` — geliştirme sunucusu (http://localhost:5173)
- `npm test` — Vitest birim testleri
- `npm run typecheck` — TypeScript kontrolü
- `npm run build` — tip kontrolü + üretim derlemesi

## Yığın
TypeScript 7 (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), React 19, Vite 8,
Zustand 5, Dexie 4, Vitest 5. Router yok; ekran geçişi Zustand'daki `screen` alanıyla.

## Mimari
```
data/                  Elle düzenlenebilir JSON (bkz. "Veri formatları")
src/gameData.ts        data/ JSON'larını içe aktarır + doğrular → GameData. (names/*.json otomatik bulunur)
src/engine/            SAF TypeScript oyun motoru. React/DOM/IndexedDB'ye bağımlı OLAMAZ.
  rng.ts               Seed'li RNG (mulberry32). Tüm rastgelelik buradan; Math.random yasak.
                       Durumu tek sayı → getState()/Rng.fromState() ile kayda yazılır.
  date.ts              GameDate = 'YYYY-MM-DD' metni; UTC ile hesap; Türkçe biçimleme.
  attributes.ts        Özellik anahtarları (teknik/zihinsel/fiziksel/kaleci/gizli), 1–20.
  types.ts             Club, Player, Contract, GameWorld…
  positions.ts         14 mevki, yakın mevkiler, mevki başına özellik ağırlıkları (1–3).
  player.ts            Yaş, doğal mevkiler, CA hesabı, maaş tabanı, piyasa değeri.
  data.ts              GameData tipleri + doğrulama (Türkçe hata mesajları).
  generation/          playerGenerator (tek oyuncu), worldGenerator (tüm lig, createWorld).
  index.ts             Motorun dışa açık yüzü + SEASON_START_DATE (2026-07-01).
src/store/gameStore.ts Zustand: phase (menu/newGame/game), screen, world, seçili oyuncu.
src/persistence/db.ts  Dexie (IndexedDB) — 'fm-super-lig' veritabanı, `saves` tablosu.
src/ui/                React. Motoru sadece çağırır, oyun mantığı içermez.
  labels.ts            Türkçe etiketler (özellik, mevki, beklenti), para/tarih biçimleri.
  layout/              GameShell, TopBar, Sidebar
  screens/             MainMenu, NewGameScreen, SquadScreen, PlayerProfile, ClubInfoScreen, Placeholder
  styles.css           Renk paleti CSS değişkenleri olarak (bkz. "Görünüm")
```
Testler kaynak dosyaların yanında: `src/**/*.test.ts` (node ortamı).

## Oyun modeli kararları
- **Para birimi €.** Maaşlar **yıllık** brüt tutulur ve gösterilir.
- **CA/PA 1–200 (gizli).** CA, oyuncunun asıl mevkiinin ağırlıklı özellik ortalamasından hesaplanır
  (ortalama 1 → 1, 20 → 200). PA ≥ CA; gençlerde daha fazla gelişim payı.
- **Kulüp gücü:** itibar (1–100) → taban seviye `7.5 + itibar/100*8` (1–20 ölçeğinde).
  Şablon: 25 kişi (12 "starter", 10 "backup", 3 "youth"). Bkz. `SQUAD_TEMPLATE`.
- **Mevki yatkınlığı** 1–20; 18+ doğal, 13–17 becerikli, 9–12 yeterli. Ana mevki 20.
- **Maaşlar** kulüp toplamı maaş bütçesinin %85–95'i olacak şekilde ölçeklenir.
- **Piyasa değeri saklanmaz**, `marketValue(player, date)` ile hesaplanır.
- Yerli oran ~%65–70 (büyük kulüplerin ilk 11'inde yabancı daha çok).

## Veri formatları
- `data/clubs.json` — `[{ id, name, shortName, city, stadium, capacity, reputation (1–100),
  budget (€), wageBudget (€/yıl), fanExpectation, colors: { primary, secondary } }]`.
  fanExpectation: `title | europe | top_half | mid_table | avoid_relegation`.
  Stadyum/bütçe değerleri yaklaşık, elle düzeltilebilir.
- `data/nations.json` — `[{ code, name, namePool, weight }]`. `TUR` zorunlu (weight 0: yerli ayrı seçilir).
  weight = yabancı oyuncu üretiminde seçilme ağırlığı.
- `data/names/<havuz>.json` — `{ firstNames: [], lastNames: [] }`. Yeni dosya eklemek yeterli.
- **SaveSlot** (`src/persistence/db.ts`): `{ id, name, clubName, gameDate, isAutosave, createdAt, updatedAt, data }`.
  `data` = GameWorld (6. aşamada netleşecek).

## Görünüm
Kullanıcının seçtiği **CM 01/02 renk paleti** (Tapani's Color Adjuster) kullanılıyor — `styles.css`
başındaki değişkenler: menü zemini (155,170,190), büyük butonlar/açılır menüler (85,100,125),
ana butonlar ve kutular yeşil (50,105,25), yedek mevki kutusu (40,95,15), mevki çubuğu/başlık
(85,140,65), metin 1 (155,170,190). Ara tonlar (zebra satır, kenarlık) bunlardan türetildi.

## Aşamalar
- [x] **1. Kurulum ve iskelet** — proje, klasörler, Vitest, Zustand, Dexie; ana menü, sol menü,
      üst bar (tarih + Devam).
- [x] **2. Veri üretimi** — kulüp JSON (18 kulüp), ülkeler, 11 isim havuzu, seed'li oyuncu/dünya
      üretici; Yeni Oyun (kulüp seçimi), Kadro (sıralanabilir, kulüp seçilebilir), Oyuncu Profili,
      Kulüp Bilgisi ekranları; CM 01/02 paleti.
- [ ] 3. Lig ve takvim (fikstür, puan tablosu, takvim ilerletme, anında maç sonucu)
- [ ] 4. Maç motoru (dakika dakika, maç ekranı, istatistik doğrulama testleri)
- [ ] 5. Taktik ekranı ve motora etkisi
- [ ] 6. Kayıt sistemi (yeni oyun, kaydet/yükle, otomatik kayıt)
- [ ] 7. Transfer, sözleşme, finans
- [ ] 8. Moral, form, sakatlık, ceza, antrenman, gelişim
- [ ] 9. Yönetim, gelen kutusu, sezon sonu, yeni sezon
- [ ] 10. Cila

## Açık konular / ileride
- Elle gerçek kadro girişi (ör. `data/squads/<kulüpId>.json`) henüz yok; istenirse eklenecek.
- Duran top özellikleri (penaltı, korner) mevkiyle ilgisizse düşük çıkabiliyor — 10. aşamada denge.
- Devam şu an takvimi 1 gün ilerletiyor; olay sistemi 3. aşamada.

## Sıradaki adım
3. aşama: çift devreli fikstür üretimi (34 hafta, 18 takım), puan tablosu, Devam'ın bir sonraki
maç gününe ilerlemesi, basit anında maç sonucu (kulüp gücüne göre), Fikstür & Puan Durumu ekranları.
