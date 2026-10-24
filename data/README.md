# data/

Düzenlenebilir oyun verileri (JSON). Elle değiştirebilirsin; oyun açılırken doğrulanır ve
hatalı bir alan varsa Türkçe hata mesajıyla neyin yanlış olduğu söylenir.

- `clubs.json` — Süper Lig kulüpleri: itibar (1–100), transfer bütçesi (€), yıllık maaş bütçesi (€),
  stadyum, kapasite, taraftar beklentisi (`title`, `europe`, `top_half`, `mid_table`, `avoid_relegation`),
  renkler. İtibar kadro gücünü belirler.
- `lower_league.json` — 1. Lig kulüpleri (aynı biçim; gerçek 2026/27 1. Ligi); küme düşenlerin yerine çıkanlar.
- `foreign_clubs.json` — yurtdışı kulüpleri (aynı biçim + `country`: nations.json'daki ülke kodu). Maç
  oynamazlar; kadroları transfer pazarında yer alır. İtibar 130'a kadar çıkabilir (devler ~120).
- `nations.json` — ülkeler; `weight` yabancı oyuncu üretiminde o ülkenin seçilme ağırlığıdır. Milli takımlar için:
  `confederation` (`UEFA`, `CONMEBOL`, `CAF`, `AFC`, `CONCACAF`, `OFC`; eleme grupları UEFA ülkeleriyle, en az 8),
  `strength` (1–100: ülkenin oyun dünyasında olmayan oyuncularının seviyesi; milli kadro dünyadaki oyuncularla bu
  "sanal" oyuncuların en iyilerinden kurulur), `colors` (`primary`, `secondary`; bayrak) ve isteğe bağlı
  `nationalTeam: false` (milli takımı oyunda yok; küçük ülkeler).
- `names/*.json` — isim havuzları (`firstNames`, `lastNames`). Yeni bir dosya ekleyip
  `nations.json`'da `namePool` ile ona işaret etmen yeterli.
- `squads/<kulüpId>.json` — gerçek kadrolar. Dosyası olan kulübün kadrosu buradan kurulur, olmayanınki üretilir.
  Biçim: `{ "players": [ { ... }, ... ] }`, oyuncu başına:
  - zorunlu: `firstName` (tek adlı oyuncuda `""`), `lastName`, `born` (`"1998-12-29"` ya da `1998`),
    `nationality` (nations.json kodu), `positions` (`["ST"]` — ilki asıl mevki; tek mevkide yakın mevkiler üretilir,
    birden çoksa hepsi doğal; ya da yatkınlıklarla `{ "AMC": 20, "ST": 15 }`), `ability` (güç 1–20: Süper Lig yıldızı
    ~16–18, orta sıra ~12–13, 1. Lig ~10; özellikler buna ve mevkiye göre üretilir)
  - isteğe bağlı (üretilen değeri ezer): `potential` (1–20), `number`, `foot` (`right` / `left` / `both`),
    `joined` (kulübe katılış), `contractExpires` (tarih ya da yıl; 30 Haziran'a yuvarlanır), `wage` (yıllık €),
    `attributes` (ör. `{ "finishing": 18 }`), `hidden` (`consistency`, `injuryProneness`, `professionalism`).
    `marketValue` ve `source` yalnızca bilgi içindir.
  - A takım 25 kişiden azsa eksik mevkiler rastgele oyuncularla tamamlanır; 18 yaş ve altı, kulübün çok altındaki
    gençler U19'a gider.
  - Kadroları Transfermarkt'tan yenilemek için: `node scripts/transfermarkt.mjs` (tümü) ya da
    `node scripts/transfermarkt.mjs galatasaray`. Betik dosyayı baştan yazar (elle düzeltmeler gider); güç piyasa
    değeri ve yaştan tahmin edilir. nations.json'da olmayan uyrukları listeler.

Not: Değişiklikler **yeni oyun** başlatıldığında etkili olur.
