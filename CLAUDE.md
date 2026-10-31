# CLAUDE.md

FM 2005 tarzında, tarayıcıda oynanan Türkçe bir futbol menajerlik oyunu (Süper Lig, 1. Lig, 8 yurtdışı birinci ligi,
Türkiye Kupası, Avrupa kupaları, milli takımlar; gerçek 2026/27 kadroları; her ligden kulüp seçilebilir). Saf TypeScript oyun motoru + React arayüzü; sunucu yok, kayıtlar tarayıcıda
(IndexedDB). Kişisel proje. Kod yorumları, arayüz metinleri, hata mesajları ve commit mesajları Türkçe.

Kapsamın kendisi: `FM_Agent_Prompt.md`. Genel tanıtım: `README.md`. Fikirler: `IDEAS.md`, oynarken bulunan eksikler: `FINDINGS.md`.

## Komutlar

| Komut | Ne yapar | Süre |
|---|---|---|
| `npm run dev` | Vite geliştirme sunucusu (http://localhost:5173) | — |
| `npm run build` | `tsc --noEmit` + üretim derlemesi (`dist/`) | — |
| `npm run typecheck` | Yalnızca TypeScript kontrolü | saniyeler |
| `npm test` | Bütün testler (Vitest, node ortamı) | ~5,5 dk (sezon testleri 8 yurtdışı ligini de oynatır; önceden ~1,5 dk) |
| `npm run test:watch` | İzleme modunda Vitest | — |
| `npm run balance` | Denge raporu (`vitest.balance.config.ts`; çıktı `reports/balance/latest.md`) | varsayılan 6 kariyer × 4 sezon ≈ 2 dk, 1 sezon ≈ 5–6 sn |

Hızlı geri bildirim: `npx vitest run src/ui src/store src/persistence src/tools` (saniyeler), motor için `npx vitest run src/engine`,
tek dosya için `npx vitest run src/ui/pitchScene.test.ts`. Testler kaynakların yanında: `src/**/*.test.ts`.

## Klasör haritası ve bağımlılık yönü

```
data/              Elle düzenlenebilir JSON: kulüpler, ülkeler, isim havuzları, gerçek kadrolar (biçim: data/README.md)
scripts/           transfermarkt.mjs: gerçek kadro verisini yeniler (data/squads/; önbellek scripts/.cache)
src/gameData.ts    data/ dosyalarını yükler ve doğrular → GameData (Vite'a özgü import.meta.glob burada)
src/engine/        Saf oyun motoru: üretim, lig/kupa/Avrupa/milli, maç motoru, transfer, finans, kadro, sezon, kayıt dönüşümü
src/store/         Zustand: oyun durumu, ekran ve gezinme geçmişi, canlı maç, kayıt eylemleri, ayarlar
src/persistence/   Dexie (IndexedDB): kayıt slotları, otomatik kayıt, biçim sürümü
src/ui/            React: ekranlar, bileşenler, 2D saha (pitch*.ts saf ve testli), grafikler, kısayollar, tema (styles.css)
src/tools/         Geliştirici araçları (pakete girmez): denge raporu
```

- Yön: `ui → store → engine`, `store → persistence`. **Motor (`src/engine/`) arayüzü, store'u, depolamayı, React'i, DOM'u ve
  Dexie'yi import etmez** (doğrulandı: src/engine'de böyle bir import yok). Veriyi `GameData` olarak dışarıdan alır.
- Tek istisna: `src/store/gameStore.ts`, `ui/squadFilters`'tan kadro filtresi tipini ve varsayılanını alır.
- Arayüz oyun mantığı içermez: kural değişikliği `src/engine/` içinde; arayüz motoru çağırır ve gösterir.

## Kurallar ve bilinen tuzaklar (koddan doğrulandı)

- **Rastgelelik yalnızca `Rng`** (`src/engine/rng.ts`, mulberry32). Motorda `Math.random` / `Date.now` yok; aynı tohum + aynı kararlar
  birebir aynı sonuç. Durum tek sayı: `world.rngState` (`rng.getState()` / `Rng.fromState()`), kayda yazılır. Oyunun tohumu yalnızca
  yeni oyunda store'da bir kez `Date.now()` ile seçilir.
- **Ayrı rastgelelik akışları**: yan sistemler ana akışı kaydırmamak için `new Rng((seed ^ X_SEED_SALT) >>> 0)` kullanır
  (`AGENT_`, `ACADEMY_`, `FOREIGN_`, `CUP_`, `EUROPE_`, `INTL_`, `JOBS_`, `DEPTH_`, `LEAGUES_SEED_SALT`; yurtdışı lig maçları
  günün `leaguesRng`'siyle). Yeni yan sistem eklerken yeni bir tuz aç;
  ana `Rng`'den çekiliş eklemek mevcut tüm sonuçları değiştirir.
- **Dünya düz veridir** (`GameWorld`: JSON'a yazılabilir, `structuredClone` ile kopyalanır; sınıf / fonksiyon / `Map` yok).
  **Motor dünyayı yerinde değiştirir.** Store'da motor çağrısını `worldAction(fn)` içinde yap (o da iç `touch(world)` ile yeni referans
  verip `revision`'ı artırır); yoksa React yeniden çizmez ve "kaydedilmemiş ilerleme" izlenmez.
- **Kayıt biçimi sürümlü**: `CURRENT_WORLD_VERSION` (`src/engine/migrate.ts`; `SAVE_FORMAT_VERSION` buna eşit). `GameWorld` şekli
  değişirse sürümü artır ve `migrateWorld` içine `if (fromVersion < N)` adımı ekle; eski kayıtlar açılabilmeli, daha yeni sürüm
  reddedilir. İsteğe bağlı yeni alan için sürüm artırmak gerekmeyebilir. Not: docs/ içindeki "şu an 11 / 16" gibi sürüm numaraları
  tarihsel; güncel değer koddadır.
- **Denge sabitleri** maç motorunda `TUNING` (`src/engine/match/engine.ts`). Denge etkileyen değişiklikten sonra `npm run balance`
  raporunu öncekiyle karşılaştır. Sonucu değiştirmemesi gereken (performans) değişiklikte aynı tohumla önce / sonra karşılaştır.
- **Veri yükleme `import.meta.glob`** (`src/gameData.ts`: `data/names/*.json`, `data/squads/*.json`). Yeni isim havuzu ya da kadro
  dosyası eklemek yeterli. Notlara göre testler eski glob sonucunu önbellekten okuyabiliyor; o zaman `node_modules/.vitest-cache`
  sil (klasör var; önbellek davranışı bu oturumda yeniden üretilmedi).
- `data/` değişiklikleri yalnızca **yeni oyunda** etkili olur (kayıttaki dünya değişmez).
- **Windows / CRLF**: `core.autocrlf=true`; depodaki dosyalar LF. Git'in "LF will be replaced by CRLF" uyarıları zararsız. Notlara göre
  `git stash` / `checkout` dosyaları CRLF yazabiliyor ve düzenleme betikleri LF bekliyor.
- 2D saha: motor koordinat tutmaz; `MatchState.lastPlay`'den sahne `src/ui/pitchScene.ts` / `pitchMotion.ts`'de (saf, testli) türetilir.
  Saha kuralı değişikliğini önce bu saf fonksiyonlarda yap ve testle.
- CSS: uygulamanın çim zemin sınıfı `.pitch-bg`; 2D saha SVG'si `.pitch-grass`.

## Notlar: hangi konu için hangi dosya

Ayrıntılı kurallar ve ölçülmüş değerler `docs/` altında (içindekiler: `NOTES.md`). Yalnızca ilgili dosyayı oku:

| Konu | Dosya |
|---|---|
| Dosya dosya mimari haritası, yığın | `docs/architecture.md` |
| Oyun modeli: para, CA/PA, takvim, fikstür, maç motoru, taktik etkileri, puan, Devam akışı | `docs/game-model.md` |
| data/ JSON biçimleri, gerçek kadrolar (Transfermarkt), kayıt kuralları | `docs/data-and-saves.md` |
| Transfer, sözleşme, finans, transfer listesi, gözlemciler, tesisler | `docs/transfer-finance.md` |
| Sakatlık, ceza, kondisyon, moral, gelişim, altyapı, yardımcı antrenör, görüşmeler, kaptanlık, oyuncu geçmişi | `docs/squad.md` |
| Sezon döngüsü, yönetim güveni, menajer itibarı / kariyer | `docs/season-manager.md` |
| Yurtdışı kulüpleri, milli takımlar | `docs/world.md` |
| Taktik ekranı, karşılaştırma, talimatlar, özel diziliş, taktik setleri, duran top | `docs/tactics.md` |
| 2D saha akışı, şut / ısı haritası | `docs/match-pitch.md` |
| Tema, ayarlar, kısayollar, denge raporu, kararlar / bildirimler / gezinme | `docs/ui.md` |
| Denge düzeltmeleri | `docs/balance.md` |
| Aşama geçmişi (2D saha sürümleri, Türkiye Kupası, Avrupa kupaları, menajer pazarlığı ayrıntıları), açık konular | `docs/history.md` |

Yeni kalıcı kuralı ilgili `docs/` dosyasına yaz; yapılan işi `IDEAS.md` / `FINDINGS.md`'de `[x]` ile ve kanıt satırıyla işaretle.
