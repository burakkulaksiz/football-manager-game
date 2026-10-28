import { useState, type ReactNode } from 'react';
import type { NewsCategory } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { DEFAULT_SETTINGS, type Settings } from '../../store/settings';
import { accentColors, ACCENT_COLORS } from '../appearance';
import { NEWS_CATEGORY_LABELS } from '../labels';
import { sound } from '../sound';
import { ShortcutList } from './ShortcutList';

interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

/** Bir ayar satırı: etiket, segmentli seçim ve seçilenin açıklaması. */
function Choice<K extends keyof Settings>({ label, field, options, hint, extra }: {
  label: string;
  field: K;
  options: readonly Option<Settings[K]>[];
  hint?: string;
  /** Seçimin yanında ek düğme (ör. Sesi dene). */
  extra?: ReactNode;
}) {
  const value = useGameStore((s) => s.settings[field]);
  const update = useGameStore((s) => s.updateSettings);
  const current = options.find((o) => o.value === value);
  return (
    <div className="setting-row">
      <div className="setting-label">{label}</div>
      <div className="tabs">
        {options.map((o) => (
          <button
            key={String(o.value)}
            className={`tab${o.value === value ? ' active' : ''}`}
            onClick={() => update({ [field]: o.value } as Partial<Settings>)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {extra}
      {(current?.hint ?? hint) && <div className="setting-hint">{current?.hint ?? hint}</div>}
    </div>
  );
}

/** Ses zincirini maç beklemeden dener (tıklama kullanıcı hareketi: tarayıcı sese izin verir); ayar kapalı olsa da çalar. */
function SoundTest() {
  const volume = useGameStore((s) => s.settings.soundVolume);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button className="btn btn-small" onClick={() => void sound.test(volume).then((ok) => setFailed(!ok))}>Sesi dene</button>
      {failed && <div className="setting-hint neg">Ses çalınamadı: tarayıcı izin vermedi ya da ses desteklenmiyor.</div>}
    </>
  );
}

const ON_OFF = [
  { value: true, label: 'Açık' },
  { value: false, label: 'Kapalı' },
] as const;

const BACKGROUNDS: { value: Settings['background']; label: string }[] = [
  { value: 'grass', label: 'Çim şeritli' },
  { value: 'plain', label: 'Düz yeşil' },
  { value: 'navy', label: 'Koyu lacivert' },
];

const ACCENT_LABELS: Record<Settings['accent'], string> = {
  yellow: 'Sarı',
  club: 'Kulüp rengi',
  blue: 'Mavi',
  green: 'Yeşil',
  orange: 'Turuncu',
  pink: 'Pembe',
};

/** Zemin ve vurgu rengi: küçük örnek kutularla seçim. */
function Appearance() {
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);
  const club = useGameStore((s) => s.world?.clubs.find((c) => c.id === s.world?.playerClubId)?.colors ?? null);
  return (
    <>
      <div className="setting-row">
        <div className="setting-label">Zemin</div>
        <div className="swatches">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              className={`swatch swatch-bg bg-${b.value}${settings.background === b.value ? ' active' : ''}`}
              onClick={() => update({ background: b.value })}
              aria-pressed={settings.background === b.value}
            >
              <span className="swatch-sample" />
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">Vurgu Rengi</div>
        <div className="swatches">
          {(Object.keys(ACCENT_LABELS) as Settings['accent'][]).map((a) => {
            const color = a === 'club' ? accentColors('club', club).accent : ACCENT_COLORS[a];
            return (
              <button
                key={a}
                className={`swatch${settings.accent === a ? ' active' : ''}`}
                onClick={() => update({ accent: a })}
                aria-pressed={settings.accent === a}
              >
                <span className="swatch-dot" style={{ background: color }} />
                {ACCENT_LABELS[a]}
              </button>
            );
          })}
        </div>
        <div className="setting-hint">
          Başlıklar, seçili sekmeler ve Devam butonu bu renkte. Kulüp rengi koyu zeminde okunmuyorsa açılır{!club ? ' (kariyer açıkken kulübünün rengi)' : ''}.
        </div>
      </div>
    </>
  );
}

const NEWS_ORDER: NewsCategory[] = [
  'offer', 'transfer', 'window', 'contract', 'loan', 'injury', 'discipline', 'player', 'training',
  'board', 'job', 'finance', 'season', 'academy', 'scouting', 'cup', 'europe', 'international',
];

/** Devam'ı durduran haber türleri. */
function NewsStops() {
  const muted = useGameStore((s) => s.settings.mutedNews);
  const update = useGameStore((s) => s.updateSettings);
  const toggle = (c: NewsCategory) => update({ mutedNews: muted.includes(c) ? muted.filter((x) => x !== c) : [...muted, c] });
  return (
    <div className="setting-row setting-row-wide">
      <div className="setting-label">Devam'ı Durduran Haberler</div>
      <div className="chips">
        {NEWS_ORDER.map((c) => (
          <button key={c} className={`chip${muted.includes(c) ? '' : ' active'}`} aria-pressed={!muted.includes(c)} onClick={() => toggle(c)}>
            {muted.includes(c) ? '' : '✓ '}{NEWS_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="setting-hint">
        İşaretli türlerde önemli bir haber gelince Devam o gün durur; diğerleri gelen kutusuna sessizce düşer.
        Karar bekleyen konular (gelen teklif, sözleşme görüşmesi…) yine de Devam'ı durdurur.
        <span className="setting-links">
          <button className="link-btn" onClick={() => update({ mutedNews: [] })}>Hepsini işaretle</button>
          <button className="link-btn" onClick={() => update({ mutedNews: NEWS_ORDER.filter((c) => c !== 'offer') })}>Yalnızca teklifler</button>
        </span>
      </div>
    </div>
  );
}

/** Ayarlar: oyun, maç, görünüm, onay ve uyarılar. Ayarlar tarayıcıda saklanır, bütün kariyerlerde geçerlidir. */
export function SettingsPanel() {
  const update = useGameStore((s) => s.updateSettings);
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2 className="panel-title">Oyun</h2>
        <div className="panel-body settings-body">
          <Choice
            label="Otomatik Kayıt"
            field="autosave"
            options={[
              { value: 'off', label: 'Kapalı', hint: 'Yalnızca elle kaydedersin.' },
              { value: 'matchday', label: 'Her maç günü', hint: 'Her maç gününden sonra (kariyer başına tek otomatik kayıt).' },
              { value: 'weekly', label: 'Haftada bir', hint: 'Maç günü sonrasında, son otomatik kayıttan en az bir hafta geçtiyse.' },
              { value: 'monthly', label: 'Ayda bir', hint: 'Maç günü sonrasında, yeni bir aya girildiyse.' },
            ]}
          />
          <NewsStops />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Maç</h2>
        <div className="panel-body settings-body">
          <Choice
            label="Maç Hızı"
            field="matchSpeed"
            options={[
              { value: 'slow', label: 'Yavaş', hint: 'Sakin dakika ~1,4 sn; önemli anlar yavaş oynanır.' },
              { value: 'normal', label: 'Normal', hint: 'Sakin dakika 1 sn.' },
              { value: 'fast', label: 'Hızlı', hint: 'Saat ve 2D sahadaki anlar 1,6 kat hızlı.' },
              { value: 'veryFast', label: 'Çok hızlı', hint: 'Saat ve 2D sahadaki anlar 2,5 kat hızlı.' },
            ]}
          />
          <Choice label="2D Saha" field="showPitch" options={ON_OFF} hint="Maç ekranında saha görünsün mü (maçta da açıp kapatabilirsin)." />
          <Choice
            label="Kamera"
            field="camera"
            options={[
              { value: 'full', label: 'Tam saha', hint: 'Bütün saha görünür.' },
              { value: 'follow', label: 'Yakın', hint: 'Kamera topu yakından izler.' },
            ]}
          />
          <Choice
            label="Anlatım"
            field="commentary"
            options={[
              { value: 'all', label: 'Tümü', hint: 'Bütün olaylar ve renkli anlatım.' },
              { value: 'key', label: 'Önemli olaylar', hint: 'Goller, şutlar, kartlar, sakatlık ve değişiklikler; faul, korner ve renkli anlatım gizli.' },
            ]}
          />
          <Choice
            label="Ses"
            field="sound"
            options={ON_OFF}
            extra={<SoundTest />}
            hint="Bütün sesler: maçta düdük, gol sevinci, kaçan pozisyonda tribün, stadyum uğultusu (maçta V ile açıp kapatabilirsin). Çok hızlı maçta ve Anında Sonuçlandır'da maç sesi çalmaz. Sesi dene, ayar kapalıyken de çalar."
          />
          <Choice
            label="Maç Dışı Sesler"
            field="menuSound"
            options={[
              { value: 'off', label: 'Kapalı', hint: 'Ses yalnızca maçta.' },
              { value: 'events', label: 'Önemli olaylar', hint: 'Devam\'ı durduran haber, kulübe transfer, kupa / şampiyonluk, iş teklifi ve kovulma.' },
              { value: 'all', label: '+ Tıklamalar', hint: 'Önemli olaylar ve düğmelerde hafif tıklama sesi.' },
            ]}
          />
          <Choice
            label="Ses Düzeyi"
            field="soundVolume"
            options={[
              { value: 'low', label: 'Kısık' },
              { value: 'medium', label: 'Orta' },
              { value: 'high', label: 'Yüksek' },
            ]}
          />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Görünüm</h2>
        <div className="panel-body settings-body">
          <Appearance />
          <Choice
            label="Yazı Boyutu"
            field="scale"
            options={[
              { value: 'small', label: 'Küçük', hint: 'Arayüz %90: ekrana daha çok bilgi sığar.' },
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Büyük', hint: 'Arayüz %110.' },
              { value: 'xlarge', label: 'Çok büyük', hint: 'Arayüz %120: büyük ekranlar ya da uzaktan bakış için.' },
            ]}
          />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Klavye</h2>
        <div className="panel-body settings-body">
          <Choice
            label="Kısayollar"
            field="hotkeys"
            options={[
              { value: true, label: 'Açık', hint: 'Boşluk = Devam, Alt+←/→ = geri / ileri, harf tuşlarıyla ekranlar; ? ile liste açılır.' },
              { value: false, label: 'Kapalı', hint: 'Klavye kısayolları çalışmaz (yalnızca Tab / Enter ile gezinme).' },
            ]}
          />
          <ShortcutList />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Onay ve Uyarılar</h2>
        <div className="panel-body settings-body">
          <Choice
            label="Ana Menüye Dönerken"
            field="quitConfirm"
            options={[
              { value: 'always', label: 'Her zaman sor' },
              { value: 'unsaved', label: 'Kaydedilmemişse sor', hint: 'Her şey kayıtlıysa doğrudan ana menüye döner.' },
            ]}
          />
          <Choice
            label="Sekme Kapanırken"
            field="warnUnsaved"
            options={ON_OFF}
            hint="Kaydedilmemiş ilerleme varken sekme kapanır ya da yenilenirse tarayıcı uyarır."
          />
          <Choice
            label="Haber Kutusu"
            field="newsAlert"
            options={[
              { value: true, label: 'Açık', hint: 'Devam bir haber yüzünden durunca ekranın üstünde haber kutusu açılır.' },
              { value: false, label: 'Kapalı', hint: 'Yalnızca kısa bir bildirim görünür; haberler gelen kutusunda.' },
            ]}
          />
          <Choice
            label="Bildirim Süresi"
            field="noticeLength"
            options={[
              { value: 'short', label: 'Kısa', hint: 'Bildirimler 2 sn (hatalar 4 sn) görünür.' },
              { value: 'normal', label: 'Normal', hint: 'Bildirimler 3 sn (hatalar 6 sn) görünür.' },
              { value: 'long', label: 'Uzun', hint: 'Bildirimler 6 sn (hatalar 12 sn) görünür.' },
            ]}
          />
          <div className="settings-reset">
            <button className="btn" onClick={() => update({ ...DEFAULT_SETTINGS })}>Bütün Ayarları Varsayılana Döndür</button>
          </div>
        </div>
      </section>
    </div>
  );
}
