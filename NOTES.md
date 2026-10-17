# Futbol Menajeri (FM 2005 tarzı) — Geliştirme Notları

Yeni bir oturumda buradan devam et. Asıl istek/kapsam: `FM_Agent_Prompt.md`.

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
data/              Elle düzenlenebilir JSON verileri (kulüpler, isim havuzları) — 2. aşamada
src/engine/        SAF TypeScript oyun motoru. React/DOM/IndexedDB'ye bağımlı OLAMAZ.
  rng.ts           Seed'li RNG (mulberry32). Tüm rastgelelik buradan; Math.random yasak.
                   Durumu tek sayı → getState()/Rng.fromState() ile kayda yazılır.
  date.ts          GameDate = 'YYYY-MM-DD' metni; UTC ile hesap; Türkçe biçimleme.
  index.ts         Motorun dışa açık yüzü + SEASON_START_DATE (2026-07-01).
src/store/         Zustand store'ları (UI durumu + motoru çağıran eylemler).
src/persistence/   Dexie (IndexedDB) — 'fm-super-lig' veritabanı, `saves` tablosu.
src/ui/            React bileşenleri. Motoru sadece çağırır, oyun mantığı içermez.
  layout/          GameShell (üst bar + sol menü + içerik), TopBar, Sidebar
  screens/         MainMenu, PlaceholderScreen (henüz yapılmamış ekranlar)
  screens.ts       Sol menü tanımı (ekran id → etiket, hangi aşamada geleceği)
  styles.css       FM 2005 teması (CSS değişkenleri, .panel, .data-table vb.)
```
Testler motor dosyalarının yanında: `src/**/*.test.ts` (node ortamı).

## Veri formatları
- **SaveSlot** (`src/persistence/db.ts`): `{ id, name, clubName, gameDate, isAutosave, createdAt, updatedAt, data }`.
  `data` = tüm oyun durumunun serileştirilmiş hâli; 6. aşamada tanımlanacak.

## Aşamalar
- [x] **1. Kurulum ve iskelet** — proje, klasörler, Vitest, Zustand, Dexie; ana menü,
      sol menü, üst bar (tarih + Devam). Devam şimdilik takvimi 1 gün ilerletiyor.
- [ ] 2. Veri üretimi (kulüp JSON, isim havuzları, oyuncu üretici, Kadro + Oyuncu Profili)
- [ ] 3. Lig ve takvim (fikstür, puan tablosu, takvim ilerletme, anında maç sonucu)
- [ ] 4. Maç motoru (dakika dakika, maç ekranı, istatistik doğrulama testleri)
- [ ] 5. Taktik ekranı ve motora etkisi
- [ ] 6. Kayıt sistemi (yeni oyun, kaydet/yükle, otomatik kayıt)
- [ ] 7. Transfer, sözleşme, finans
- [ ] 8. Moral, form, sakatlık, ceza, antrenman, gelişim
- [ ] 9. Yönetim, gelen kutusu, sezon sonu, yeni sezon
- [ ] 10. Cila

## Sıradaki adım
2. aşama: `data/clubs.json` (18 Süper Lig kulübü), `data/names/*.json`, `src/engine/` altında
oyuncu modeli + üretici (seed'li), Kadro ve Oyuncu Profili ekranları, kulüp seçimi.
