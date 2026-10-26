# Futbol Menajeri (FM 2005 tarzı) — Geliştirme Notları

Yeni bir oturumda buradan devam et. Asıl istek/kapsam: `FM_Agent_Prompt.md`.
Çalışma şekli: her aşama sonunda test + commit, kullanıcıya nasıl deneyeceğini yaz, onay bekle.

Notlar konuya göre `docs/` altına bölündü (içerik aynen taşındı). Yalnızca işine yarayan dosyayı oku:

| Dosya | İçerik (NOTES.md'deki bölümler) |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Komutlar, yığın, dosya dosya mimari haritası |
| [docs/game-model.md](docs/game-model.md) | Oyun modeli kararları: para, CA/PA, takvim, fikstür, maç motoru, taktik etkileri, puan, Devam akışı |
| [docs/data-and-saves.md](docs/data-and-saves.md) | Veri formatları (data/ JSON), kayıt kuralları, gerçek kadrolar (Transfermarkt) |
| [docs/transfer-finance.md](docs/transfer-finance.md) | Transfer ve finans kuralları, transfer / kiralık listesi, gözlemci sistemi, tesisler |
| [docs/squad.md](docs/squad.md) | Oyuncu durumu (sakatlık, ceza, kondisyon, moral, gelişim), altyapı, yardımcı antrenör, görüşmeler, kaptanlık, oyuncu geçmişi |
| [docs/season-manager.md](docs/season-manager.md) | Sezon döngüsü ve yönetim, menajer itibarı ve kariyer |
| [docs/world.md](docs/world.md) | Yurtdışı kulüpleri, milli takımlar |
| [docs/tactics.md](docs/tactics.md) | Taktik ekranı ve karşılaştırma, taktik özelleştirme (talimatlar, özel diziliş, setler, duran top) |
| [docs/match-pitch.md](docs/match-pitch.md) | 2D saha akışı, şut ve ısı haritası |
| [docs/ui.md](docs/ui.md) | Görünüm (tema), arayüz ve konfor (ayarlar, kısayollar, denge raporu), kararlar / bildirimler / gezinme |
| [docs/balance.md](docs/balance.md) | Denge düzeltmeleri (denge raporu bulguları) |
| [docs/history.md](docs/history.md) | Aşamalar (geliştirme geçmişi; 2D saha, kupalar, menajer pazarlığı ayrıntıları dahil), açık konular, sıradaki adım |

Yeni kalıcı kuralı ilgili `docs/` dosyasına yaz; yeni bir konuysa yeni dosya açıp bu tabloya ekle.
