/**
 * Oyun sesleri: public/sounds/ altındaki gerçek kayıtlar (kaynaklar KAYNAKLAR.md), Web Audio ile çalınır. Yalnızca sunum:
 * motoru, Rng'yi ve sonucu etkilemez. Dosya yüklenemezse o ses sessizce atlanır.
 */
import type { GameWorld, MatchEvent, NewsCategory } from '../engine';
import type { Settings, SoundVolume } from '../store/settings';

export type SoundId =
  | 'whistle' | 'whistleShort' | 'whistleHalf' | 'whistleEnd'
  | 'goal' | 'goalAway' | 'chance' | 'red'
  | 'click' | 'notify' | 'offer' | 'sign' | 'trophy' | 'sacked';
export type SoundSettings = Pick<Settings, 'sound' | 'soundVolume' | 'menuSound'>;

/** Dört varyantlı kayıt: `ad.mp3`, `ad-2.mp3` … `ad-4.mp3`. */
const variants = (name: string) => [`${name}.mp3`, `${name}-2.mp3`, `${name}-3.mp3`, `${name}-4.mp3`];

/**
 * Kayıtlar. Çözülünce tepe değeri 1'e normalize edilir; `gain` sesler arası göreli düzey. `duration` (sn) uzun kaydı keser
 * (sonu sönümlenir). Birden çok dosya varyanttır: her çalışta sıradaki çalar. Düzeyler dalga biçimine bakılarak seçildi,
 * kulakla ölçülmedi.
 */
const FILES = {
  whistleLong: { files: variants('whistle-long'), gain: 0.4 },
  whistleShort: { files: variants('whistle-short'), gain: 0.4 },
  whistleEnd: { files: variants('whistle-end'), gain: 0.4 },
  cheer: { files: variants('crowd-goal'), gain: 1, duration: 9 },
  ahh: { files: variants('crowd-ahh'), gain: 0.75 },
  boo: { files: variants('crowd-boo'), gain: 0.6, duration: 4 },
  ambience: { files: variants('crowd-ambience'), gain: 0.22 },
  click: { files: ['click.mp3'], gain: 0.12 },
  notify: { files: ['notify.mp3'], gain: 0.3 },
  offer: { files: ['offer.mp3'], gain: 0.35 },
  sign: { files: ['sign.mp3'], gain: 0.5 },
  fanfare: { files: ['fanfare.mp3'], gain: 0.45 },
} satisfies Record<string, { files: string[]; gain: number; duration?: number }>;
type FileKey = keyof typeof FILES;

/** Bir ses: katmanlar [kayıt, gecikme sn, kazanç çarpanı]; `gap`: aynı ses bu kadar saniyeden sık başlamaz. */
const SOUNDS: Record<SoundId, { layers: [FileKey, number, number][]; gap: number }> = {
  whistle: { layers: [['whistleLong', 0, 1]], gap: 0.5 },
  whistleShort: { layers: [['whistleShort', 0, 1]], gap: 0.5 },
  whistleHalf: { layers: [['whistleShort', 0, 1], ['whistleShort', 0.7, 1]], gap: 2 },
  whistleEnd: { layers: [['whistleEnd', 0, 1]], gap: 3 },
  goal: { layers: [['cheer', 0, 1]], gap: 3 },
  // Deplasman golü: ev sahibi tribünü iç çeker, uzaktan küçük bir sevinç
  goalAway: { layers: [['ahh', 0, 1], ['cheer', 0.15, 0.25]], gap: 3 },
  chance: { layers: [['ahh', 0, 1]], gap: 1.2 },
  red: { layers: [['whistleShort', 0, 1], ['boo', 0.4, 1]], gap: 2 },
  click: { layers: [['click', 0, 1]], gap: 0.05 },
  notify: { layers: [['notify', 0, 1]], gap: 0.5 },
  offer: { layers: [['offer', 0, 1]], gap: 1 },
  sign: { layers: [['sign', 0, 1]], gap: 1 },
  trophy: { layers: [['fanfare', 0, 1], ['cheer', 0.5, 0.6]], gap: 3 },
  sacked: { layers: [['boo', 0, 1]], gap: 3 },
};

/** Maç dışı sesler: Ayarlar > Maç Dışı Sesler ile açılır; tıklama yalnızca "Tıklamalar dahil"de. */
const MENU_SOUNDS = new Set<SoundId>(['click', 'notify', 'offer', 'sign', 'trophy', 'sacked']);

/** Ayara göre bu ses çalınır mı. */
export function soundAllowed(id: SoundId, s: SoundSettings): boolean {
  if (!s.sound) return false;
  if (id === 'click') return s.menuSound === 'all';
  return !MENU_SOUNDS.has(id) || s.menuSound !== 'off';
}

const EVENT_SOUNDS: Partial<Record<MatchEvent['type'], SoundId>> = {
  kickoff: 'whistle',
  secondhalf: 'whistle',
  halftime: 'whistleHalf',
  fulltime: 'whistleEnd',
  save: 'chance',
  miss: 'chance',
  blocked: 'chance',
  penaltyMiss: 'chance',
  penalty: 'whistle',
  foul: 'whistleShort',
  yellow: 'whistleShort',
  red: 'red',
};

/** Aynı adımda tek düdük ve tek tribün tepkisi: en önemlisi (ör. gol varsa "ah" çalmaz). */
const WHISTLES: SoundId[] = ['whistleEnd', 'whistleHalf', 'whistle', 'whistleShort'];
const CROWD: SoundId[] = ['goal', 'goalAway', 'red', 'chance'];

/** Yeni gösterilen olaylardan çalınacak sesler: ev sahibi golünde tribün coşar, deplasman golünde iç çeker. */
export function matchSounds(events: readonly MatchEvent[]): SoundId[] {
  const ids = new Set(events.flatMap((e) => (e.type === 'goal' ? (e.side === 'away' ? 'goalAway' : 'goal') : EVENT_SOUNDS[e.type] ?? [])));
  return [WHISTLES.find((id) => ids.has(id)), CROWD.find((id) => ids.has(id))].filter((id): id is SoundId => id !== undefined);
}

/**
 * Ekranda açılan olaylardan çalınacak sesler: yalnızca yeni açılanlar. Anında Sonuçlandır'ın açtıkları sessiz geçer
 * (`skipNext`); olay sayısı düşerse (yeni maç) sayaç baştan başlar.
 */
export function createEventCursor(initial: number) {
  let last = initial;
  let skip = false;
  return {
    skipNext(): void {
      skip = true;
    },
    next(events: readonly MatchEvent[], shown: number): SoundId[] {
      const prev = last;
      last = shown;
      if (shown <= prev) return [];
      if (skip) {
        skip = false;
        return [];
      }
      return matchSounds(events.slice(prev, shown));
    },
  };
}

/** Kariyer olaylarını yakalamak için dünyanın özeti (iki durum arasındaki fark ses seçer). */
export interface CareerMark {
  seed: number;
  nextNewsId: number;
  trophies: number;
  sacked: boolean;
  gameOver: boolean;
  offers: number;
}

export function careerMark(w: GameWorld): CareerMark {
  const m = w.manager;
  return {
    seed: w.seed,
    nextNewsId: w.nextNewsId,
    trophies: m.titles + (m.cups ?? 0) + (m.europeTitles ?? 0),
    sacked: w.unemployed?.reason === 'sacked',
    gameOver: w.gameOver !== null,
    offers: w.jobOffers?.length ?? 0,
  };
}

/**
 * Önceki özetten bu yana olan en büyük kariyer olayının sesi: kovulma / kariyer sonu, kupa, iş teklifi, kulübümüze transfer,
 * yoksa Devam'ı durduran (önemli, susturulmamış) haber. Başka kariyere geçilince (tohum farklı, haber sayacı geride) sessiz.
 */
export function careerSound(prev: CareerMark | null, w: GameWorld, muted: readonly NewsCategory[]): SoundId | null {
  const next = careerMark(w);
  if (!prev || prev.seed !== next.seed || next.nextNewsId < prev.nextNewsId) return null;
  if ((next.sacked && !prev.sacked) || (next.gameOver && !prev.gameOver)) return 'sacked';
  if (next.trophies > prev.trophies) return 'trophy';
  if (next.offers > prev.offers) return 'offer';
  const fresh = w.news.filter((n) => n.id >= prev.nextNewsId);
  if (fresh.some((n) => (n.category === 'transfer' || n.category === 'loan') && n.clubId === w.playerClubId)) return 'sign';
  return fresh.some((n) => n.important && !muted.includes(n.category)) ? 'notify' : null;
}

/** Aynı anda en çok bu kadar ses (hızlı maçta üst üste binme sınırı; uğultu sayılmaz). */
export const MAX_VOICES = 6;

/** Yeni ses başlasın mı: aynı ses `gap` saniyeden sık değil ve ses sınırı dolmamış. */
export function admitSound(lastStart: number | undefined, now: number, gap: number, active: number): boolean {
  return active < MAX_VOICES && (lastStart === undefined || now - lastStart >= gap);
}

/** Ana ses düzeyi (sınırlayıcıdan önce). */
const VOLUME: Record<SoundVolume, number> = { low: 0.3, medium: 0.6, high: 1 };
/** Kesilen kaydın sonundaki sönüm (sn): tık sesi olmasın. */
const FADE = 0.4;

const hidden = () => typeof document !== 'undefined' && document.hidden;

const fetchSound = async (file: string): Promise<ArrayBuffer> => {
  const res = await fetch(`${import.meta.env.BASE_URL}sounds/${file}`);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.arrayBuffer();
};

/** Ses çalar. `makeContext` ve `load` testte sahteleriyle değiştirilir. */
export function createSoundPlayer(makeContext: () => AudioContext, load: (file: string) => Promise<ArrayBuffer> = fetchSound) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let loading: Promise<void> | null = null;
  const buffers = new Map<FileKey, { buffer: AudioBuffer; norm: number }[]>();
  /** Kayıt başına çalınan sayısı: sıradaki varyantı seçer (aynı varyant art arda gelmez). */
  const turns = new Map<FileKey, number>();
  const lastStart = new Map<SoundId, number>();
  let active = 0;
  let crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  let wantCrowd = false;

  /** Bütün kayıtları bir kez indirip çözer; inmeyen / çözülemeyen kayıt atlanır. */
  function loadAll(c: AudioContext): Promise<void> {
    loading ??= Promise.all(
      (Object.keys(FILES) as FileKey[]).flatMap((key) =>
        FILES[key].files.map(async (file) => {
          try {
            const buffer = await c.decodeAudioData(await load(file));
            let peak = 0;
            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
              for (const v of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
            }
            if (peak > 0) buffers.set(key, [...(buffers.get(key) ?? []), { buffer, norm: 1 / peak }]);
          } catch {
            // ses yoksa oyun sessiz sürer (varyant yoksa diğerleri çalar)
          }
        }),
      ),
    ).then(() => {
      if (wantCrowd) startCrowd();
    });
    return loading;
  }

  /** İlk seste kurulur (kullanıcı hareketinde); askıdaysa sürdürülür. Tarayıcı izin vermezse sessiz kalınır. */
  function context(s: Pick<SoundSettings, 'soundVolume'>): AudioContext | null {
    try {
      if (!ctx) {
        const c = makeContext();
        master = c.createGain();
        // Sınırlayıcı: gol + uğultu + düdük üst üste binince Yüksek'te kırpılmasın
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        master.connect(limiter).connect(c.destination);
        // Sekme arka plandayken sus
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            (document.hidden ? c.suspend() : c.resume()).catch(() => {});
          });
        }
        ctx = c;
        void loadAll(c);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      master!.gain.value = VOLUME[s.soundVolume];
      return ctx;
    } catch {
      return null;
    }
  }

  /** Kaydı `when` anında çalar; kayıt yüklenmediyse hiçbir şey yapmaz. */
  function voice(c: AudioContext, key: FileKey, when: number, mul: number, loop = false): { src: AudioBufferSourceNode; gain: GainNode } | null {
    const list = buffers.get(key);
    if (!list) return null;
    const turn = turns.get(key) ?? 0;
    turns.set(key, turn + 1);
    const b = list[turn % list.length]!;
    const def: { gain: number; duration?: number } = FILES[key];
    const src = c.createBufferSource();
    src.buffer = b.buffer;
    const gain = c.createGain();
    const level = def.gain * b.norm * mul;
    src.connect(gain).connect(master!);
    if (loop) {
      // mp3 kodlayıcının baştaki / sondaki boşluğu döngüde boşluk yapmasın
      src.loop = true;
      src.loopStart = 0.1;
      src.loopEnd = b.buffer.duration - 0.1;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(level, when + 1.5);
      src.start(when, 0.1);
      return { src, gain };
    }
    const length = Math.min(def.duration ?? Infinity, b.buffer.duration);
    gain.gain.setValueAtTime(level, when);
    if (def.duration !== undefined) {
      gain.gain.setValueAtTime(level, when + length - FADE);
      gain.gain.linearRampToValueAtTime(0, when + length);
    }
    active++;
    src.onended = () => active--;
    src.start(when, 0, length);
    return { src, gain };
  }

  function startCrowd(): void {
    if (crowd || !ctx || hidden()) return;
    crowd = voice(ctx, 'ambience', ctx.currentTime, 1, true);
  }

  function emit(c: AudioContext, id: SoundId): void {
    const def = SOUNDS[id];
    if (!admitSound(lastStart.get(id), c.currentTime, def.gap, active)) return;
    lastStart.set(id, c.currentTime);
    for (const [key, delay, mul] of def.layers) voice(c, key, c.currentTime + delay, mul);
  }

  return {
    /** Kullanıcı hareketinde (tıklama / tuş) bağlamı kurar, kayıtları yükler: sonraki sesleri oto-oynatma kuralı engellemesin. */
    unlock(s: SoundSettings): void {
      if (s.sound) context(s);
    },

    /** "Sesi dene": ayar kapalı olsa da düdük + tribün "ah"ı. Tarayıcı ses vermezse ya da kayıtlar yüklenemezse false. */
    async test(volume: SoundVolume): Promise<boolean> {
      const c = context({ soundVolume: volume });
      if (!c) return false;
      try {
        await c.resume();
        await loadAll(c);
      } catch {
        return false;
      }
      if (c.state !== 'running' || !buffers.has('whistleShort')) return false;
      voice(c, 'whistleShort', c.currentTime, 1);
      voice(c, 'ahh', c.currentTime + 0.5, 1);
      return true;
    },

    play(id: SoundId, s: SoundSettings): void {
      if (!soundAllowed(id, s) || hidden()) return;
      const c = context(s);
      if (c) emit(c, id);
    },

    /** Stadyum ambiyansı: maç akarken hafif döngü. Kayıt henüz yüklenmediyse yüklenince başlar. */
    crowd(on: boolean, s: SoundSettings): void {
      wantCrowd = on && s.sound;
      if (!wantCrowd) {
        if (crowd && ctx) {
          const t = ctx.currentTime;
          crowd.gain.gain.cancelScheduledValues(t);
          crowd.gain.gain.setValueAtTime(crowd.gain.gain.value, t);
          crowd.gain.gain.linearRampToValueAtTime(0, t + 0.5);
          crowd.src.stop(t + 0.6);
        }
        crowd = null;
        return;
      }
      if (context(s)) startCrowd();
    },
  };
}

export const sound = createSoundPlayer(() => new AudioContext());
