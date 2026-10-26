import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../engine';
import { createSoundPlayer, matchSounds, type SoundSettings } from './sound';

const ev = (type: MatchEvent['type']): MatchEvent => ({ minute: 1, extra: 0, type, side: null, text: '' });

/** Web Audio'nun kullanılan kısmı kadar sahte bağlam: oluşturulan düğümleri sayar. */
function fakeContext() {
  const created: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = (kind: string) => {
    created.push(kind);
    return { gain: param(), frequency: param(), Q: param(), type: '', buffer: null, loop: false, connect: (n: unknown) => n, start() {}, stop() {} };
  };
  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    createGain: () => node('gain'),
    createOscillator: () => node('osc'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('source'),
    createBuffer: (_ch: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    resume: async () => {},
    suspend: async () => {},
  };
  return { ctx: ctx as unknown as AudioContext, created };
}

const ON: SoundSettings = { sound: true, soundVolume: 'medium' };
const OFF: SoundSettings = { sound: false, soundVolume: 'medium' };

describe('maç sesleri', () => {
  it('olaylardan sesler: düdükler, gol, kaçan pozisyon, kart; sessiz olaylar ve tekrarlar yok', () => {
    expect(matchSounds([ev('kickoff')])).toEqual(['whistle']);
    expect(matchSounds([ev('halftime')])).toEqual(['whistleHalf']);
    expect(matchSounds([ev('fulltime')])).toEqual(['whistleEnd']);
    expect(matchSounds([ev('save'), ev('goal'), ev('miss')])).toEqual(['chance', 'goal']);
    expect(matchSounds([ev('yellow'), ev('penalty')])).toEqual(['whistleShort']);
    expect(matchSounds([ev('foul'), ev('sub'), ev('info')])).toEqual([]);
  });

  it('ayar kapalıyken ses bağlamı hiç kurulmaz', () => {
    let made = 0;
    const player = createSoundPlayer(() => {
      made++;
      return fakeContext().ctx;
    });
    player.play('goal', OFF);
    player.crowd(true, OFF);
    expect(made).toBe(0);
  });

  it('açıkken bağlam bir kez kurulur, ses düğümleri oluşur; uğultu ikinci kez başlatılmaz', () => {
    const fake = fakeContext();
    let made = 0;
    const player = createSoundPlayer(() => {
      made++;
      return fake.ctx;
    });
    player.play('whistleEnd', ON);
    expect(fake.created.filter((k) => k === 'osc')).toHaveLength(6); // 3 düdük × (ton + titreşim)
    player.play('goal', ON);
    const sources = () => fake.created.filter((k) => k === 'source').length;
    expect(sources()).toBe(1);
    player.crowd(true, ON);
    player.crowd(true, ON);
    expect(sources()).toBe(2);
    player.crowd(false, ON);
    player.crowd(true, ON);
    expect(sources()).toBe(3);
    expect(made).toBe(1);
  });

  it('tarayıcı ses bağlamı vermezse hata fırlatmaz', () => {
    const player = createSoundPlayer(() => {
      throw new Error('AudioContext yok');
    });
    expect(() => player.play('whistle', ON)).not.toThrow();
    expect(() => player.crowd(true, ON)).not.toThrow();
  });
});
