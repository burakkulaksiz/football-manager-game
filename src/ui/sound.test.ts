import { describe, expect, it } from 'vitest';
import type { GameWorld, MatchEvent, NewsItem } from '../engine';
import {
  admitSound, careerMark, careerSound, createEventCursor, createSoundPlayer, matchSounds, MAX_VOICES, soundAllowed,
  type SoundSettings,
} from './sound';

const ev = (type: MatchEvent['type'], side: MatchEvent['side'] = null): MatchEvent => ({ minute: 1, extra: 0, type, side, text: '' });

/** Web Audio'nun kullanılan kısmı kadar sahte bağlam: oluşturulan düğümleri ve başlatılan kaynakları sayar. */
function fakeContext() {
  const created: string[] = [];
  const started: { loop: boolean; length?: number; buffer: unknown }[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = (kind: string) => {
    created.push(kind);
    const n = {
      gain: param(), threshold: param(), knee: param(), ratio: param(),
      buffer: null as unknown, loop: false, loopStart: 0, loopEnd: 0, onended: null as null | (() => void),
      connect: (x: unknown) => x,
      start(_when?: number, _offset?: number, length?: number) {
        started.push({ loop: n.loop, length, buffer: n.buffer });
      },
      stop() {},
    };
    return n;
  };
  const buffer = { duration: 2, numberOfChannels: 1, getChannelData: () => new Float32Array([0, 0.5, -0.25]) };
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => node('gain'),
    createBufferSource: () => node('source'),
    createDynamicsCompressor: () => node('limiter'),
    // her dosya ayrı bir kayıt (varyantlar ayırt edilsin)
    decodeAudioData: async () => ({ ...buffer }),
    resume: async () => {},
    suspend: async () => {},
  };
  return { ctx: ctx as unknown as AudioContext, created, started, raw: ctx };
}

const files = async () => new ArrayBuffer(8);
const flush = () => new Promise((r) => setTimeout(r, 0));

const ON: SoundSettings = { sound: true, soundVolume: 'medium', menuSound: 'events' };
const OFF: SoundSettings = { ...ON, sound: false };

describe('maç sesleri', () => {
  it('olaylardan sesler: düdükler, ev / deplasman golü, kaçan pozisyon, kart; sessiz olaylar yok', () => {
    expect(matchSounds([ev('kickoff')])).toEqual(['whistle']);
    expect(matchSounds([ev('halftime')])).toEqual(['whistleHalf']);
    expect(matchSounds([ev('fulltime')])).toEqual(['whistleEnd']);
    expect(matchSounds([ev('goal', 'home')])).toEqual(['goal']);
    expect(matchSounds([ev('goal', 'away')])).toEqual(['goalAway']);
    expect(matchSounds([ev('save'), ev('miss')])).toEqual(['chance']);
    expect(matchSounds([ev('foul'), ev('yellow')])).toEqual(['whistleShort']);
    expect(matchSounds([ev('red')])).toEqual(['red']);
    expect(matchSounds([ev('sub'), ev('info'), ev('corner'), ev('injury')])).toEqual([]);
  });

  it('aynı adımda tek düdük ve tek tribün tepkisi: en önemlisi', () => {
    // Gol varsa önceki kaçan pozisyonun "ah"ı çalmaz; son düdük faul düdüğünü bastırır
    expect(matchSounds([ev('save'), ev('goal', 'home'), ev('miss')])).toEqual(['goal']);
    expect(matchSounds([ev('foul'), ev('fulltime'), ev('miss')])).toEqual(['whistleEnd', 'chance']);
    expect(matchSounds([ev('goal', 'away'), ev('goal', 'home')])).toEqual(['goal']);
  });

  it('ayara göre: ses kapalıyken hiçbiri; maç dışı sesler ayrı, tıklama yalnızca "Tıklamalar"da', () => {
    expect(soundAllowed('goal', OFF)).toBe(false);
    expect(soundAllowed('notify', OFF)).toBe(false);
    expect(soundAllowed('goal', { ...ON, menuSound: 'off' })).toBe(true);
    expect(soundAllowed('trophy', { ...ON, menuSound: 'off' })).toBe(false);
    expect(soundAllowed('trophy', ON)).toBe(true);
    expect(soundAllowed('click', ON)).toBe(false);
    expect(soundAllowed('click', { ...ON, menuSound: 'all' })).toBe(true);
  });

  it('çakışma: aynı ses aralıktan sık başlamaz, aynı anda en çok MAX_VOICES ses', () => {
    expect(admitSound(undefined, 0, 1, 0)).toBe(true);
    expect(admitSound(5, 5.5, 1, 0)).toBe(false);
    expect(admitSound(5, 6, 1, 0)).toBe(true);
    expect(admitSound(undefined, 0, 1, MAX_VOICES)).toBe(false);
  });

  it('ayar kapalıyken ses bağlamı hiç kurulmaz', () => {
    let made = 0;
    const player = createSoundPlayer(() => {
      made++;
      return fakeContext().ctx;
    }, files);
    player.play('goal', OFF);
    player.crowd(true, OFF);
    player.unlock(OFF);
    expect(made).toBe(0);
  });

  it('kayıtlar bir kez yüklenir; ses katmanları çalınır, aynı ses hemen tekrar çalmaz, uğultu döngüsü tek', async () => {
    const fake = fakeContext();
    let made = 0;
    let loads = 0;
    const player = createSoundPlayer(() => {
      made++;
      return fake.ctx;
    }, async () => {
      loads++;
      return new ArrayBuffer(8);
    });
    player.unlock(ON);
    player.unlock(ON);
    // Uğultu kayıt yüklenmeden istenir: yüklenince başlar
    player.crowd(true, ON);
    await flush();
    expect(made).toBe(1);
    expect(loads).toBe(33); // 7 kayıt × 4 varyant + 5 tekli
    expect(fake.started.filter((s) => s.loop)).toHaveLength(1);

    player.play('whistleHalf', ON);
    const halves = fake.started.filter((s) => !s.loop);
    expect(halves).toHaveLength(2); // iki kısa düdük, farklı varyant
    expect(halves[0]?.buffer).not.toBe(halves[1]?.buffer);
    player.play('whistleHalf', ON);
    expect(fake.started.filter((s) => !s.loop)).toHaveLength(2);
    // Kesilen kayıt (gol 9 sn) kaydın kendi süresini (2 sn) aşmaz
    player.play('goal', ON);
    expect(fake.started.at(-1)?.length).toBe(2);

    player.crowd(true, ON);
    expect(fake.started.filter((s) => s.loop)).toHaveLength(1);
    player.crowd(false, ON);
    player.crowd(true, ON);
    const loops = fake.started.filter((s) => s.loop);
    expect(loops).toHaveLength(2);
    expect(loops[0]?.buffer).not.toBe(loops[1]?.buffer); // yeni maçta başka uğultu
    // Dört varyant dönünce baştakine gelinir
    for (let i = 0; i < 3; i++) {
      player.crowd(false, ON);
      player.crowd(true, ON);
    }
    expect(fake.started.filter((s) => s.loop).at(-1)?.buffer).toBe(loops[0]?.buffer);
  });

  it('kayıt inmezse ya da çözülemezse hata fırlatmaz, sessiz kalır; Sesi dene false', async () => {
    const fake = fakeContext();
    const player = createSoundPlayer(() => fake.ctx, async () => {
      throw new Error('404');
    });
    player.unlock(ON);
    await flush();
    expect(() => player.play('goal', ON)).not.toThrow();
    expect(fake.started).toHaveLength(0);
    expect(await player.test('medium')).toBe(false);

    const broken = fakeContext();
    broken.raw.decodeAudioData = () => Promise.reject(new Error('bozuk'));
    expect(await createSoundPlayer(() => broken.ctx, files).test('medium')).toBe(false);
  });

  it('olay akışı: başlama düdüğü, önemli an açılınca gol, Anında Sonuçlandır sessiz, yeni maçta sayaç sıfırlanır', () => {
    const events: MatchEvent[] = [];
    const cursor = createEventCursor(0);
    expect(cursor.next(events, 0)).toEqual([]);
    events.push(ev('kickoff'));
    expect(cursor.next(events, 1)).toEqual(['whistle']);
    // Gol adımı: saha sahnesi oynarken sonuç gizli (gösterilen sayı aynı), sonra açılır
    events.push(ev('miss'), ev('goal', 'home'));
    expect(cursor.next(events, 1)).toEqual([]);
    expect(cursor.next(events, 3)).toEqual(['goal']);
    // Anında Sonuçlandır: önce gizli kalan an, sonra kalan dakikalar; hiçbiri çalmaz
    cursor.skipNext();
    events.push(ev('goal'), ev('yellow'), ev('fulltime'));
    expect(cursor.next(events, 3)).toEqual([]);
    expect(cursor.next(events, 6)).toEqual([]);
    // Yeni maç: olay sayısı düşer, baştan sayılır
    expect(cursor.next([], 0)).toEqual([]);
    expect(cursor.next([ev('kickoff')], 1)).toEqual(['whistle']);
  });

  it('Sesi dene: ayar kapalı olsa da çalar; bağlam yoksa, sürdürülemezse ya da askıda kalırsa false', async () => {
    const fake = fakeContext();
    expect(await createSoundPlayer(() => fake.ctx, files).test('medium')).toBe(true);
    expect(fake.started).toHaveLength(2);

    expect(await createSoundPlayer(() => {
      throw new Error('AudioContext yok');
    }, files).test('medium')).toBe(false);

    const rejecting = fakeContext();
    rejecting.raw.resume = () => Promise.reject(new Error('izin yok'));
    expect(await createSoundPlayer(() => rejecting.ctx, files).test('low')).toBe(false);

    const suspended = fakeContext();
    suspended.raw.state = 'suspended';
    expect(await createSoundPlayer(() => suspended.ctx, files).test('high')).toBe(false);
  });

  it('tarayıcı ses bağlamı vermezse hata fırlatmaz', () => {
    const player = createSoundPlayer(() => {
      throw new Error('AudioContext yok');
    }, files);
    expect(() => player.play('whistle', ON)).not.toThrow();
    expect(() => player.crowd(true, ON)).not.toThrow();
  });
});

describe('maç dışı sesler', () => {
  const news = (id: number, n: Partial<NewsItem>): NewsItem =>
    ({ id, date: '2026-08-01', category: 'player', title: '', body: '', important: false, read: false, ...n }) as NewsItem;
  const world = (over: Partial<GameWorld> = {}): GameWorld =>
    ({
      seed: 1,
      nextNewsId: 10,
      playerClubId: 'gs',
      news: [],
      gameOver: null,
      unemployed: null,
      jobOffers: [],
      manager: { titles: 0, cups: 0, europeTitles: 0 },
      ...over,
    }) as unknown as GameWorld;
  const prev = careerMark(world());
  const noTrophies = { titles: 0, cups: 0, europeTitles: 0 } as GameWorld['manager'];

  it('ilk bakışta ve başka kariyere geçince sessiz', () => {
    expect(careerSound(null, world({ nextNewsId: 11, news: [news(10, { important: true })] }), [])).toBeNull();
    expect(careerSound(prev, world({ seed: 2, nextNewsId: 11, news: [news(10, { important: true })] }), [])).toBeNull();
    expect(careerSound(prev, world({ nextNewsId: 3 }), [])).toBeNull();
    expect(careerSound(prev, world(), [])).toBeNull();
  });

  it('kovulma > kupa > iş teklifi > kulübe transfer > önemli haber', () => {
    const all = world({
      nextNewsId: 13,
      unemployed: { since: '2026-08-01', lastClubId: 'gs', reason: 'sacked' },
      manager: { titles: 0, cups: 1, europeTitles: 0 } as GameWorld['manager'],
      jobOffers: [{ id: 1, clubId: 'fb', date: '2026-08-01', expires: '2026-08-08', via: 'offer' }],
      news: [news(10, { category: 'transfer', clubId: 'gs', important: true }), news(11, { important: true })],
    });
    expect(careerSound(prev, all, [])).toBe('sacked');
    expect(careerSound(prev, { ...all, unemployed: { since: '2026-08-01', lastClubId: 'gs', reason: 'resigned' } }, [])).toBe('trophy');
    expect(careerSound(prev, { ...all, unemployed: null, manager: noTrophies }, [])).toBe('offer');
    const quiet = { ...all, unemployed: null, jobOffers: [], manager: noTrophies };
    expect(careerSound(prev, quiet, [])).toBe('sign');
    expect(careerSound(prev, { ...quiet, news: [news(11, { important: true })] }, [])).toBe('notify');
    expect(careerSound(prev, world({ gameOver: { date: '2026-08-01', reason: '' } }), [])).toBe('sacked');
  });

  it('başka kulübün transferi imza sesi değil; susturulan türde ve önemsiz haberde ses yok; eski haber sayılmaz', () => {
    const other = world({ nextNewsId: 11, news: [news(10, { category: 'transfer', clubId: 'fb', important: false })] });
    expect(careerSound(prev, other, [])).toBeNull();
    const muted = world({ nextNewsId: 11, news: [news(10, { category: 'injury', important: true })] });
    expect(careerSound(prev, muted, ['injury'])).toBeNull();
    expect(careerSound(prev, muted, [])).toBe('notify');
    expect(careerSound(prev, world({ nextNewsId: 11, news: [news(9, { important: true })] }), [])).toBeNull();
  });
});
