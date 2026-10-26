# Futbol Menajeri — Süper Lig

FM 2005 tarzında, tarayıcıda oynanan bir futbol menajerlik oyunu. Türkiye Süper Ligi (18 takım, 34 hafta), 1. Lig, Türkiye Kupası,
Avrupa kupaları ve milli takımlar; gerçek 2026/27 kadroları, gün gün ilerleyen takvim, dakika dakika maç motoru, 2D saha görünümü.

> Kişisel kullanım için geliştirilen bir projedir; dağıtılması düşünülmedi. Kadro verisi Transfermarkt'tan çekilmiştir (bkz. [Veri](#veri)).

## Hızlı başlangıç

Gereksinim: Node.js 22+ ve npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (Vite) |
| `npm run build` | Tip kontrolü + üretim derlemesi (`dist/`) |
| `npm run preview` | Derlemeyi yerelde sunar |
| `npm run typecheck` | Yalnızca TypeScript kontrolü |
| `npm test` | Bütün testler (Vitest, node ortamı) |
| `npm run test:watch` | Testleri izleme modunda çalıştırır |
| `npm run balance` | Otomatik denge raporu (bkz. [Denge raporu](#denge-raporu)) |

Tam test koşusu ~1,5 dakika sürer (en uzunu maç motoru istatistik testi: 10 tam sezon). Hızlı geri bildirim için ilgili klasörü verin:
`npx vitest run src/ui src/store src/persistence src/tools` (saniyeler), motor testleri için `npx vitest run src/engine`.

## Yığın

TypeScript 7 (strict, `noUncheckedIndexedAccess`), React 19, Vite 8, Zustand 5 (durum), Dexie 4 (IndexedDB kayıtları), Vitest 5.
Router yok: ekran geçişi Zustand'daki `screen` alanı ve kendi geçmiş yığınıyla yapılır.

## Mimari

```
data/              Elle düzenlenebilir JSON: kulüpler, ülkeler, isim havuzları, gerçek kadrolar (data/README.md)
scripts/           transfermarkt.mjs: kadro verisini yeniler
src/engine/        Saf TypeScript oyun motoru. React, DOM ya da IndexedDB'ye bağımlı OLAMAZ.
src/gameData.ts    data/ dosyalarını yükler ve doğrular (Vite'a özgü import.meta.glob burada)
src/store/         Zustand: oyun durumu, ekran gezinmesi, canlı maç, kayıt, ayarlar
src/persistence/   Dexie: kayıt slotları, otomatik kayıt, kayıt biçimi sürümü ve dönüşümü
src/ui/            React arayüzü: ekranlar, bileşenler, 2D saha, grafikler, klavye kısayolları, tema
src/tools/         Geliştirici araçları (arayüz paketine girmez): denge raporu
```

Bağımlılık yönü tek taraflıdır: `ui → store → engine` ve `store → persistence`. Motor, arayüzü ve depoyu hiç bilmez; veriyi
`GameData` nesnesi olarak dışarıdan alır. Bu, motoru testlerde, denge raporunda (ve ileride sunucuda ya da Worker'da) doğrudan
çalıştırabilmeyi sağlar.

Dosya dosya ayrıntılı harita ve her sistemin kuralları konuya göre **[docs/](docs/)** altında (içindekiler: [NOTES.md](NOTES.md)).

### Motor kuralları (değiştirirken bilmen gerekenler)

- **Rastgelelik yalnızca `Rng` üzerinden** (`src/engine/rng.ts`, mulberry32). `Math.random` ve `Date.now` yasak: aynı tohum ve aynı
  kararlar birebir aynı sonucu vermelidir. Durum tek sayıdır (`world.rngState`), kayıtla birlikte saklanır. Yan sistemler
  (menajerler, altyapı, yurtdışı kulüpler) ana akışı bozmamak için tohuma tuz katılmış ayrı bir `Rng` kullanır.
- **Dünya düz veridir** (`GameWorld`, `structuredClone` ile kopyalanabilir, JSON'a yazılabilir; sınıf, fonksiyon, `Map` yok).
  Motor dünyayı **yerinde değiştirir**; arayüzde değişikliği bildirmek için store'daki `worldAction` / `touch(world)` kullanılır.
- **Kayıt biçimi sürümlüdür.** `GameWorld` şekli değişirse `CURRENT_WORLD_VERSION` artırılır ve `engine/migrate.ts` içine eski kaydı
  dönüştüren adım eklenir (eski kayıtlar açılabilmeli). Alan isteğe bağlıysa sürüm artırmak gerekmeyebilir.
- **Arayüz oyun mantığı içermez.** Kural değişikliği `src/engine/` içinde yapılır; arayüz motoru çağırır ve sonucu gösterir.
- **Denge sabitleri tek yerde:** maç motoru için `TUNING` (`src/engine/match/engine.ts`).
- Kod yorumları, arayüz metinleri ve hata mesajları Türkçedir.

## Test

Testler kaynak dosyaların yanında, `src/**/*.test.ts`:

- Motor: maç istatistikleri (binlerce maç, `engine.test.ts`), fikstür, puan tablosu, finans, transfer, sezon döngüsü, kayıt dönüşümleri.
- Arayüz mantığı: saf yardımcılar (filtreler, 2D saha sahneleri, grafik verisi, kısayol haritası).
- Kayıt: gerçek Dexie koduyla `fake-indexeddb` üzerinde, canlı maç dahil.

Yavaş testler (tam sezon) kendi zaman aşımlarıyla çalışır; ayrıntı için [FINDINGS.md](FINDINGS.md) > Testler.

## Veri

`data/` altındaki JSON dosyaları elle düzenlenebilir ve oyun açılırken doğrulanır (hatalı alan Türkçe mesajla bildirilir).
Değişiklikler **yeni oyunda** etkili olur. Biçim ayrıntıları: [data/README.md](data/README.md).

Gerçek kadroları yenilemek için:

```bash
node scripts/transfermarkt.mjs              # tüm kulüpler
node scripts/transfermarkt.mjs galatasaray  # tek kulüp
```

Betik dosyaları baştan yazar (o kulüp için elle yapılan düzeltmeler gider); sayfalar `scripts/.cache/` altında 24 saat saklanır ve
istekler arasında bekler. Kaynak sitenin kullanım koşullarına dikkat edin.

## Denge raporu

`npm run balance`, çok sayıda kariyeri birkaç sezon oynatıp maç, sezon tablosu, ekonomi, oyuncu yeteneği (uzun vadeli eğilim), Avrupa ve
yönetim ölçülerini hedef aralıklarla karşılaştırır. Çıktı `reports/balance/latest.md` (okunur rapor) ve `latest.json`; sonraki koşu
öncekiyle karşılaştırılır. Motoru değiştirdikten sonra: koşu → raporda hedef dışı ölçüler ve "bak:" ipuçları → ayar → yeniden koşu.

```bash
BALANCE_CAREERS=12 BALANCE_SEASONS=10 npm run balance    # daha büyük örnek (Git Bash / macOS / Linux)
```

Ortam değişkenleri: `BALANCE_CAREERS` (6), `BALANCE_SEASONS` (4), `BALANCE_SEED` (9000), `BALANCE_CLUBS`, `BALANCE_OUT`.
Hedefler ve nedenleri `src/tools/balance/metrics.ts` içindedir. Aynı tohumla koşular birebir aynıdır.

## Proje belgeleri

| Dosya | İçerik |
|---|---|
| [NOTES.md](NOTES.md) | `docs/` içindekiler: konuya göre mimari harita, sistemlerin kuralları, ölçülmüş denge değerleri, açık konular |
| [IDEAS.md](IDEAS.md) | Fikir ve yol haritası; yapılanlar `[x]` ile işaretli (mimari / backend / AI ile geliştirme fikirleri dahil) |
| [FINDINGS.md](FINDINGS.md) | Oynarken bulunan eksikler ve otomatik denge bulguları, kanıt satırlarıyla |
| [FM_Agent_Prompt.md](FM_Agent_Prompt.md) | Projenin özgün kapsam ve istek metni |
| [data/README.md](data/README.md) | Veri dosyası biçimleri |

## Katkı akışı

1. Değişiklikten önce ilgili `docs/` dosyasını oku (hangisi: NOTES.md); motor kurallarına (yukarıda) uy.
2. `npm run typecheck` ve ilgili testler yeşil olmalı; yeni kural için test ekle.
3. Denge etkileyen değişiklikten sonra `npm run balance` ile raporu karşılaştır.
4. Yapılan işi IDEAS.md / FINDINGS.md'de işaretle, kalıcı kuralları ilgili `docs/` dosyasına yaz.
5. Commit mesajları Türkçe ve özet + gerekçe biçimindedir (bkz. `git log`).
