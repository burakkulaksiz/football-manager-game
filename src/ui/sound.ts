/**
 * Maç sesleri: Web Audio ile kodla üretilir (ses dosyası yok). Yalnızca sunum: motoru, Rng'yi ve sonucu etkilemez.
 * Gerçek kayıt eklenecekse SYNTH'teki bir sesin yerine çözümlenmiş AudioBuffer çalınır; çağıranlar değişmez.
 */
import type { MatchEvent } from '../engine';
import type { Settings, SoundVolume } from '../store/settings';

export type SoundId = 'whistle' | 'whistleShort' | 'whistleHalf' | 'whistleEnd' | 'goal' | 'chance';
export type SoundSettings = Pick<Settings, 'sound' | 'soundVolume'>;

const EVENT_SOUNDS: Partial<Record<MatchEvent['type'], SoundId>> = {
  kickoff: 'whistle',
  secondhalf: 'whistle',
  halftime: 'whistleHalf',
  fulltime: 'whistleEnd',
  goal: 'goal',
  save: 'chance',
  miss: 'chance',
  blocked: 'chance',
  penaltyMiss: 'chance',
  penalty: 'whistleShort',
  yellow: 'whistleShort',
  red: 'whistleShort',
};

/** Yeni gösterilen olaylardan çalınacak sesler (aynı ses bir kez). */
export function matchSounds(events: readonly MatchEvent[]): SoundId[] {
  return [...new Set(events.flatMap((e) => EVENT_SOUNDS[e.type] ?? []))];
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

/**
 * Ana ses düzeyi. Süzülmüş gürültü, beyaz gürültünün enerjisinin yalnızca küçük bir kısmını taşır (600 Hz alçak geçiren
 * ~%3): tribün sesleri bu yüzden kazançla telafi edilir. Orta'da hesapla (ölçülmedi) uğultu ~−25 dB, "uuh" ~−17 dB, gol ~−11 dB
 * (RMS), düdük ~−12 dB tepe.
 */
const VOLUME: Record<SoundVolume, number> = { low: 0.3, medium: 0.6, high: 1 };

/** Düdük: bilyenin titrediği tiz ton; `blasts` kez çalar. */
function whistle(c: AudioContext, out: AudioNode, t: number, blasts: number, length: number): void {
  for (let i = 0; i < blasts; i++) {
    const start = t + i * (length + 0.12);
    const osc = c.createOscillator();
    osc.frequency.value = 2900;
    const trill = c.createOscillator();
    trill.frequency.value = 28;
    const depth = c.createGain();
    depth.gain.value = 180;
    trill.connect(depth).connect(osc.frequency);
    const env = c.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.4, start + 0.02);
    env.gain.setValueAtTime(0.4, start + length - 0.05);
    env.gain.linearRampToValueAtTime(0, start + length);
    osc.connect(env).connect(out);
    for (const o of [osc, trill]) {
      o.start(start);
      o.stop(start + length);
    }
  }
}

/** Tribün tepkisi: süzülmüş gürültünün yükselip sönmesi (gol sevinci, "uuh"). */
function roar(c: AudioContext, out: AudioNode, noise: AudioBuffer, t: number, freq: number, peak: number, attack: number, decay: number): void {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(filter).connect(env).connect(out);
  src.start(t);
  src.stop(t + attack + decay);
}

const SYNTH: Record<SoundId, (c: AudioContext, out: AudioNode, noise: AudioBuffer, t: number) => void> = {
  whistle: (c, out, _n, t) => whistle(c, out, t, 1, 0.6),
  whistleShort: (c, out, _n, t) => whistle(c, out, t, 1, 0.25),
  whistleHalf: (c, out, _n, t) => whistle(c, out, t, 2, 0.4),
  whistleEnd: (c, out, _n, t) => whistle(c, out, t, 3, 0.4),
  goal: (c, out, n, t) => roar(c, out, n, t, 900, 3, 0.15, 3.5),
  chance: (c, out, n, t) => roar(c, out, n, t, 500, 2, 0.35, 1.2),
};

const hidden = () => typeof document !== 'undefined' && document.hidden;

/** Ses çalar. `makeContext` testte sahte bağlamla değiştirilir. */
export function createSoundPlayer(makeContext: () => AudioContext) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** İlk seste kurulur (maç kullanıcı tıklayınca başlar); askıdaysa sürdürülür. Tarayıcı izin vermezse sessiz kalınır. */
  function context(s: SoundSettings): AudioContext | null {
    try {
      if (!ctx) {
        const c = makeContext();
        master = c.createGain();
        // Sınırlayıcı: gol + uğultu + düdük üst üste binince Yüksek'te kırpılmasın (varsayılan −24 dB eşiği sesi ezerdi)
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        master.connect(limiter).connect(c.destination);
        noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const data = noise.getChannelData(0);
        // Math.random: yalnızca ses dokusu, oyunun Rng akışına dokunmaz
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        // Sekme arka plandayken sus
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            (document.hidden ? c.suspend() : c.resume()).catch(() => {});
          });
        }
        ctx = c;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      master!.gain.value = VOLUME[s.soundVolume];
      return ctx;
    } catch {
      return null;
    }
  }

  return {
    /** Kullanıcı hareketinde (tıklama / tuş) bağlamı kurar ve sürdürür: sonraki sesleri tarayıcının oto-oynatma kuralı engellemesin. */
    unlock(s: SoundSettings): void {
      if (s.sound) context(s);
    },

    /** "Sesi dene": ayar kapalı olsa da kısa düdük + tribün tepkisi. Tarayıcı ses vermezse false. */
    async test(volume: SoundVolume): Promise<boolean> {
      const s = { sound: true, soundVolume: volume };
      const c = context(s);
      if (!c) return false;
      try {
        await c.resume();
      } catch {
        return false;
      }
      if (c.state !== 'running') return false;
      SYNTH.whistleShort(c, master!, noise!, c.currentTime);
      SYNTH.chance(c, master!, noise!, c.currentTime + 0.35);
      return true;
    },

    play(id: SoundId, s: SoundSettings): void {
      if (!s.sound || hidden()) return;
      const c = context(s);
      if (c) SYNTH[id](c, master!, noise!, c.currentTime);
    },

    /** Tribün uğultusu: maç akarken düşük seviyede döngü. */
    crowd(on: boolean, s: SoundSettings): void {
      if (!on || !s.sound) {
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
      if (crowd || hidden()) return;
      const c = context(s);
      if (!c) return;
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(1, c.currentTime + 1);
      src.connect(filter).connect(gain).connect(master!);
      src.start();
      crowd = { src, gain };
    },
  };
}

export const sound = createSoundPlayer(() => new AudioContext());
