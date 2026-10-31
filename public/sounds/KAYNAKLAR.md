# Ses kaynakları

Maç sesleri (düdükler, tribün) ElevenLabs Sound Effects ile üretildi, her biri 4 varyant: `ad.mp3`, `ad-2.mp3` … `ad-4.mp3`. Oyun
her çalışta sıradakini çalar (uğultu: her maç başka varyant). Ham dosyalar yerel `sounds-elevenlabs/` (git'te yok). Baştaki boşluk
ffmpeg ile kesildi: asıl sesin yükselişinden 30 ms önce, gol sesinde patlamanın 0,25 sn öncesi; 10 ms yumuşak giriş, libmp3lame
`-q:a 2`. Ambiyans ElevenLabs'in Loop seçeneğiyle üretildi, kesilmedi.

Diğerleri freesound.org'daki seslerin yüksek kaliteli önizlemesi (128 kbps mp3, `cdn.freesound.org/previews/...-hq.mp3`),
değiştirilmeden. Tepe normalizasyonu ve uzun kaydın kesilmesi çalarken yapılır (`src/ui/sound.ts` FILES: `duration`, `gain`). Oyun
kişisel kullanım içindir; lisanslar (CC0 / CC BY / CC BY-NC) sesin sayfasında yazar.

| Dosya | Oyunda | Kaynak |
|---|---|---|
| whistle-long.mp3 | başlama / ikinci yarı / penaltı düdüğü | ElevenLabs: "One long referee pea whistle blast, about 1.5 seconds, kick-off signal, slight outdoor stadium reverb, no crowd, starts immediately" |
| whistle-short.mp3 | faul, kart; devre arası (iki kez) | ElevenLabs: "Single short sharp referee pea whistle blast in a large outdoor stadium, slight stadium reverb, no crowd, starts immediately" |
| whistle-end.mp3 | maç sonu (kısa-kısa-uzun) | ElevenLabs: "Referee full-time whistle: two short blasts followed by one long blast, pea whistle, slight outdoor stadium reverb, no crowd" |
| crowd-goal.mp3 | gol coşkusu (ilk 9 sn), kupa | ElevenLabs: "Football stadium crowd explodes as the home team scores: instant massive roar from 40,000 fans, screaming and cheering, pounding drums, air horns, then sustained celebration chanting, wide stereo, no commentary, no music" |
| crowd-ahh.mp3 | kaçan pozisyon / kurtarış "ah"ı, deplasman golü | ElevenLabs: "Football stadium crowd reacts to a near miss: quick rising anticipation then a collective disappointed "ohhh" groan from thousands of fans, fading back to murmur, no commentary" |
| crowd-boo.mp3 | kırmızı kart, kovulma (ilk 4 sn) | ElevenLabs: "Angry football stadium crowd booing and whistling loudly at the referee after a red card, thousands of fans, harsh high-pitched whistles and jeers, no commentary" |
| crowd-ambience.mp3 | maç boyunca stadyum uğultusu (döngü) | ElevenLabs (Loop, 30 sn): "Live football stadium atmosphere during a Turkish Süper Lig match, 40,000 passionate fans, steady crowd roar, ultras section chanting in unison with big drums and rhythmic clapping, occasional whistles, wide stereo, heard from the main stand, no commentary, no announcer, no music, seamless loop" |
| click.mp3 | düğme tıklaması (isteğe bağlı) | "UI Button Click", https://freesound.org/s/467951/ |
| notify.mp3 | Devam'ı durduran haber | "Pop-up/notification.wav", https://freesound.org/s/242502/ |
| offer.mp3 | iş teklifi | "Soft-Notifications - Bell - Ding-Dong.mp3", https://freesound.org/s/571513/ |
| sign.mp3 | kulübe transfer / kiralık | "PEN SIGNATURE SIGNING 2.wav", https://freesound.org/s/326961/ |
| fanfare.mp3 | kupa / şampiyonluk | "Success Fanfare Trumpets.mp3", https://freesound.org/s/456966/ |

Toplam ~4,7 MB (ilk seste hepsi bir kez indirilir). Değiştirmek için aynı adla dosya koymak yeter; düzeyi FILES'taki `gain`
ayarlar. Varyant eksikse kalanlar çalar.
