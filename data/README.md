# data/

Düzenlenebilir oyun verileri (JSON). Elle değiştirebilirsin; oyun açılırken doğrulanır ve
hatalı bir alan varsa Türkçe hata mesajıyla neyin yanlış olduğu söylenir.

- `clubs.json` — Süper Lig kulüpleri: itibar (1–100), transfer bütçesi (€), yıllık maaş bütçesi (€),
  stadyum, kapasite, taraftar beklentisi (`title`, `europe`, `top_half`, `mid_table`, `avoid_relegation`),
  renkler. İtibar kadro gücünü belirler.
- `lower_league.json` — kurgusal 1. Lig kulüpleri (aynı biçim); küme düşenlerin yerine çıkanlar.
- `foreign_clubs.json` — yurtdışı kulüpleri (aynı biçim + `country`: nations.json'daki ülke kodu). Maç
  oynamazlar; kadroları transfer pazarında yer alır. İtibar 130'a kadar çıkabilir (devler ~120).
- `nations.json` — ülkeler; `weight` yabancı oyuncu üretiminde o ülkenin seçilme ağırlığıdır.
- `names/*.json` — isim havuzları (`firstNames`, `lastNames`). Yeni bir dosya ekleyip
  `nations.json`'da `namePool` ile ona işaret etmen yeterli.

Not: Değişiklikler **yeni oyun** başlatıldığında etkili olur.
