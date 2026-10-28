import { describe, expect, it } from 'vitest';
import { clubPlayers, createMatch, createWorld, stepMatch, substitute, type MatchPlay, type MatchState } from '../engine';
import { autoSelectLineup } from '../engine/match/formation';
import { gameData } from '../gameData';
import { ballSpot, PITCH_LENGTH, PITCH_WIDTH } from './pitch';
import {
  bannerKind,
  buildScene,
  frameDurationMs,
  frameSpots,
  frameStartsMs,
  isHighlight,
  LEAD_IN_MS,
  MAX_PLAY_FRAMES,
  playLabel,
  revealDelayMs,
  revealIndex,
  SCENE_HOLD_MS,
  sceneDurationMs,
  sidesSwapped,
  viewScene,
} from './pitchScene';

const world = createWorld(gameData, 3, 'galatasaray', '2026-07-01');

function match(seed = 9): MatchState {
  const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(world, clubId)) });
  return createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed }, world.players);
}

/** Bütün maçı oynatıp her dakikanın anını ve o anki durumu toplar. */
function playAll(m: MatchState): { minute: number; play: MatchPlay; state: MatchState }[] {
  const out: { minute: number; play: MatchPlay; state: MatchState }[] = [];
  while (m.period !== 'full') {
    stepMatch(m, world.players);
    if (m.lastPlay) out.push({ minute: m.minute, play: m.lastPlay, state: structuredClone(m) });
  }
  return out;
}

describe('2D saha sahnesi', () => {
  const plays = [9, 10, 11].flatMap((seed) => playAll(match(seed)));

  it('sonuca kadar en çok 8 kare, sonuç karesi motorun anıyla aynı yerde, top saha içinde (gol/aut hariç)', () => {
    // Değişiklik ve kırmızı kart sahnesi uzatır (ayrı testlerde)
    for (const { minute, play, state } of plays.filter((p) => !p.play.subs && p.play.card?.type !== 'red')) {
      const scene = buildScene(state, play, minute);
      const reveal = revealIndex(scene);
      expect(reveal).toBeGreaterThanOrEqual(0);
      expect(reveal).toBeLessThanOrEqual(MAX_PLAY_FRAMES - 1);
      // Kornerde sonuç top dışarı çıkınca, ardından bayrakta kurulum (motorun anının yeri)
      const corner = play.kind === 'corner';
      expect(scene[corner ? reveal + 1 : reveal]!.ball).toEqual(ballSpot(play, minute));
      if (corner) expect(Math.abs(scene[reveal]!.ball.x - PITCH_LENGTH / 2)).toBeGreaterThan(PITCH_LENGTH / 2);
      // Gol ve korner dışında sonuç son karedir; golde ardından 3 sevinç karesi, kornerde kurulum
      expect(scene.length - 1 - reveal).toBe(play.kind === 'goal' ? 3 : corner ? 1 : 0);
      // Kornerle gelen şutta da top önce dışarı çıkar (kurulumdan önceki kare)
      for (const f of scene.slice(0, reveal).filter((_, i) => scene[i + 1]?.setPiece?.kind !== 'corner')) {
        expect(f.ball.x).toBeGreaterThanOrEqual(0);
        expect(f.ball.x).toBeLessThanOrEqual(PITCH_LENGTH);
        expect(f.ball.y).toBeGreaterThanOrEqual(0);
        expect(f.ball.y).toBeLessThanOrEqual(PITCH_WIDTH);
      }
    }
  });

  it('gol sahnesi: asist yapan pası verir, golü atan şutu çeker, sonra top ağlarda', () => {
    // Akan oyundan asistli goller (kornerde ortayı kullanan oyuncu yapar, asist ayrı seçilebilir)
    const goals = plays.filter((p) => p.play.kind === 'goal' && !p.play.fromPenalty && !p.play.fromCorner && p.play.assistId != null);
    expect(goals.length).toBeGreaterThan(0);
    for (const { minute, play, state } of goals) {
      const scene = buildScene(state, play, minute);
      const carriers = scene.map((f) => f.carrierId);
      // Şut, sonuç karesinden hemen önceki karede; golcü topu biraz sürmüş olabilir, ondan önce topa asist yapan sahip
      const shot = revealIndex(scene) - 1;
      expect(carriers[shot]).toBe(play.playerId);
      let before = shot - 1;
      while (before > 0 && carriers[before] === play.playerId) before--;
      expect(carriers[before]).toBe(play.assistId);
      expect(scene[revealIndex(scene)]!.move).toBe('shot');
    }
  });

  it('gol sevinci: golcü köşe bayrağına, takım arkadaşları çevresinde; sonra santra, gol yiyen başlar', () => {
    const goal = plays.find((p) => p.play.kind === 'goal' && p.play.playerId !== null)!;
    const { minute, play, state } = goal;
    const scene = buildScene(state, play, minute);
    const [run, huddle, kickoff] = scene.slice(revealIndex(scene) + 1);
    const flagAt = frameSpots(state, huddle!, false).get(play.playerId!)!.at;
    // Rakip kaleye yakın köşe: hücum yönünde 101 m, kenar çizgisine 5 m
    expect(Math.min(flagAt.y, PITCH_WIDTH - flagAt.y)).toBeCloseTo(5, 5);
    expect(run!.focusId).toBe(play.playerId);
    const mates = [...frameSpots(state, huddle!, false)].filter(([id, p]) => p.side === play.side && id !== play.playerId && state.players[id]!.slot !== 'GK');
    for (const [, p] of mates) expect(Math.hypot(p.at.x - flagAt.x, p.at.y - flagAt.y)).toBeLessThan(6);
    expect(kickoff!.kickoff).toBe(true);
    expect(kickoff!.ball).toEqual({ x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 });
    expect(kickoff!.carrierSide).not.toBe(play.side);
    for (const [, p] of frameSpots(state, kickoff!, false)) {
      if (p.side === 'home') expect(p.at.x).toBeLessThanOrEqual(PITCH_LENGTH / 2);
      else expect(p.at.x).toBeGreaterThanOrEqual(PITCH_LENGTH / 2);
    }
  });

  it('kurtarışta kaleci topun başında; faulde faulü yapan topun yanında', () => {
    const saves = plays.filter((p) => p.play.kind === 'save');
    expect(saves.length).toBeGreaterThan(0);
    for (const { minute, play, state } of saves) {
      const scene = buildScene(state, play, minute);
      const last = scene[revealIndex(scene)]!;
      const keeper = frameSpots(state, last, false).get(play.keeperId!)!;
      expect(Math.hypot(keeper.at.x - last.ball.x, keeper.at.y - last.ball.y)).toBeLessThan(2);
    }
    // Değişiklik olan sakin dakikada sahnede yalnızca değişiklik görünür
    const fouls = plays.filter((p) => p.play.kind === 'foul' && p.play.defenderId != null && !p.play.subs);
    expect(fouls.length).toBeGreaterThan(0);
    for (const { minute, play, state } of fouls) {
      const scene = buildScene(state, play, minute);
      const last = scene[revealIndex(scene)]!;
      const fouler = frameSpots(state, last, false).get(play.defenderId!)!;
      expect(Math.hypot(fouler.at.x - last.ball.x, fouler.at.y - last.ball.y)).toBeLessThan(3);
    }
  });

  it('kart gören oyuncu son karede sahada görünür (kırmızıyla atılmış olsa da)', () => {
    const carded = plays.filter((p) => p.play.card);
    expect(carded.length).toBeGreaterThan(0);
    for (const { minute, play, state } of carded) {
      const scene = buildScene(state, play, minute);
      const last = scene[revealIndex(scene)]!;
      expect(frameSpots(state, last, false).has(play.card!.playerId)).toBe(true);
    }
  });

  it('ışınlanma yok: şut karesinde kimse tek başına uzaktan koşmaz; duran top dizilişi kareler boyunca bozulmaz', () => {
    // Şutu çeken, kartı gören, kornerde kafayı vuran top kaleye giderken (diğerleri dururken) yarım saha koşuyordu;
    // duran topta topu taşıyan değişince diziliş karışıyordu
    const shots = plays.filter((p) => ['goal', 'save', 'miss', 'blocked', 'penalty'].includes(p.play.kind) && !p.play.subs);
    expect(shots.some((p) => p.play.card)).toBe(true);
    expect(shots.some((p) => p.play.fromCorner)).toBe(true);
    expect(shots.some((p) => p.play.fromPenalty || p.play.fromFreeKick)).toBe(true);
    for (const { minute, play, state } of shots) {
      const scene = buildScene(state, play, minute);
      const reveal = revealIndex(scene);
      for (let i = 1; i <= reveal; i++) {
        const before = frameSpots(state, scene[i - 1]!, false);
        const after = frameSpots(state, scene[i]!, false);
        // Şutu bloke eden savunmacı, kurtarışa uzanan kaleci ve topa koşan (pası / ortayı alan) oyuncu hariç
        const runs = [...after]
          .filter(([id]) => before.has(id) && id !== play.defenderId && id !== play.keeperId && id !== scene[i]!.carrierId)
          .map(([id, s]) => Math.hypot(s.at.x - before.get(id)!.at.x, s.at.y - before.get(id)!.at.y))
          .sort((a, b) => b - a);
        if (scene[i - 1]!.setPiece && scene[i]!.setPiece) expect(runs[0]!).toBeLessThan(3);
        else if (i === reveal && runs[0]! > 15) expect(runs[1]!).toBeGreaterThan(3);
      }
      // Korneri kullanan kafayı vuran olamaz (bayraktan altıpasa ışınlanırdı)
      if (play.fromCorner) expect(scene.find((f) => f.setPiece)!.setPiece!.takerId).not.toBe(play.playerId);
    }
  });

  it('penaltıda vurucu dışındaki saha oyuncuları ceza sahası dışında', () => {
    const m = match();
    const shooter = m.home.onPitch.find((id) => m.players[id]!.slot === 'ST')!;
    const play: MatchPlay = { side: 'home', kind: 'goal', playerId: shooter, fromPenalty: true };
    const scene = buildScene(m, play, 30);
    const spot = scene.find((f) => f.setPiece?.kind === 'penalty' && f.carrierId === shooter)!;
    expect(spot.ball).toEqual({ x: PITCH_LENGTH - 11, y: PITCH_WIDTH / 2 });
    for (const [id, { at }] of frameSpots(m, spot, false)) {
      if (id === shooter || m.players[id]!.slot === 'GK') continue;
      const inBox = at.x > PITCH_LENGTH - 16.5 && Math.abs(at.y - PITCH_WIDTH / 2) < 20.16;
      expect(inBox).toBe(false);
    }
  });

  it('penaltı anlık değil: karardan vuruşa en az 2 sn (kurulum, vurucu geri çekilip bekler), maç hızıyla ölçeklenir', () => {
    const m = match();
    const shooter = m.home.onPitch.find((id) => m.players[id]!.slot === 'ST')!;
    const play: MatchPlay = { side: 'home', kind: 'save', playerId: shooter, fromPenalty: true };
    const scene = buildScene(m, play, 30);
    const starts = frameStartsMs(scene);
    const setup = scene.findIndex((f) => f.setPiece?.kind === 'penalty');
    const shot = scene.findIndex((f) => f.move === 'shot');
    // Karar: faul karesine varış; vuruş: şut karesine yola çıkış
    expect(starts[shot - 1]! - starts[setup - 1]!).toBeGreaterThanOrEqual(2000);
    // Vurucu şuttan önce toptan birkaç metre geride
    const runUp = frameSpots(m, scene[shot - 1]!, false).get(shooter)!.at;
    expect(Math.hypot(runUp.x - scene[shot - 1]!.ball.x, runUp.y - scene[shot - 1]!.ball.y)).toBeGreaterThan(3);
  });

  const inBox = (p: { x: number; y: number }) => p.x > PITCH_LENGTH - 16.5 && Math.abs(p.y - PITCH_WIDTH / 2) < 20.16;

  it('korner: kullanan bayrakta, en az 4 hücumcu ve savunmacılar ceza sahasında, birkaç oyuncu geride', () => {
    const m = match();
    const play: MatchPlay = { side: 'home', kind: 'corner', playerId: null };
    const scene = buildScene(m, play, 33);
    const last = scene.at(-1)!;
    expect(last.setPiece).toMatchObject({ kind: 'corner', side: 'home', spot: last.ball });
    expect(last.ball.x).toBeGreaterThan(PITCH_LENGTH - 1);
    const spots = [...frameSpots(m, last, false).values()];
    const home = spots.filter((p) => p.side === 'home');
    const away = spots.filter((p) => p.side === 'away');
    expect(home.filter((p) => inBox(p.at)).length).toBeGreaterThanOrEqual(4);
    expect(away.filter((p) => inBox(p.at)).length).toBeGreaterThanOrEqual(7);
    expect(home.filter((p) => p.at.x < PITCH_LENGTH / 2 + 10).length).toBeGreaterThanOrEqual(3); // kaleci + 2 geride
  });

  it('korner kararı top çizgiyi geçince: top dışarı → karar (sonuç) → bayrakta kurulum; kornerle gelen şutta da', () => {
    const corners = plays.filter((p) => p.play.kind === 'corner' || p.play.fromCorner);
    expect(corners.some((p) => p.play.kind === 'corner')).toBe(true);
    expect(corners.some((p) => p.play.fromCorner)).toBe(true);
    for (const { minute, play, state } of corners) {
      const scene = buildScene(state, play, minute);
      const setup = scene.findIndex((f) => f.setPiece?.kind === 'corner');
      const out = scene[setup - 1]!.ball;
      expect(out.x < 0 || out.x > PITCH_LENGTH).toBe(true);
      if (play.kind === 'corner') expect(revealIndex(scene)).toBe(setup - 1);
    }
  });

  it('top çizgiyi geçince son dokunan: kornerde savunan (korneri hücum eden kullanır), autta ve golde hücumcu; taç yok', () => {
    const seen = { corner: 0, miss: 0 };
    for (const { minute, play, state } of plays.filter((p) => isHighlight(p.play))) {
      const scene = buildScene(state, play, minute);
      scene.forEach((f, i) => {
        // Sahne topu yan çizgiden çıkarmaz (taç gösterilmez)
        expect(f.ball.y).toBeGreaterThanOrEqual(0);
        expect(f.ball.y).toBeLessThanOrEqual(PITCH_WIDTH);
        const out = (x: number) => x < 0 || x > PITCH_LENGTH;
        const prev = scene[i - 1];
        if (!prev || !out(f.ball.x) || out(prev.ball.x)) return;
        // Son dokunan: önceki karede topa vuran (taşıyıcı), yoksa topa en yakın oyuncu (savunmacı topa çarptıysa topun yerinde)
        const spots = frameSpots(state, prev, false);
        const [nearest] = [...spots]
          .map(([id, s]) => ({ id, side: s.side, d: Math.hypot(s.at.x - prev.ball.x, s.at.y - prev.ball.y) }))
          .sort((a, b) => a.d - b.d);
        const toucher = prev.carrierId !== null ? { id: prev.carrierId, side: spots.get(prev.carrierId)!.side } : nearest!;
        if (prev.carrierId === null) expect(nearest!.d).toBeLessThan(1);
        const corner = scene[i + 1]?.setPiece?.kind === 'corner' ? scene[i + 1]!.setPiece! : null;
        if (corner) {
          seen.corner++;
          expect(toucher.side).not.toBe(play.side);
          expect(corner.side).toBe(play.side);
          expect(state.players[corner.takerId!]!.side).toBe(play.side);
        } else {
          // Aut (kale vuruşu) ya da gol: şutu çeken hücumcu
          if (play.kind === 'miss') seen.miss++;
          expect(toucher.side).toBe(play.side);
        }
      });
    }
    expect(seen.corner).toBeGreaterThan(3);
    expect(seen.miss).toBeGreaterThan(3);
  });

  it('serbest vuruş: topa 9.15 m uzaklıkta 4 kişilik baraj, kullanan topun başında', () => {
    const m = match();
    const taker = m.away.onPitch.find((id) => m.players[id]!.slot === 'AMC' || m.players[id]!.slot === 'MC')!;
    const play: MatchPlay = { side: 'away', kind: 'freekick', playerId: taker };
    const last = buildScene(m, play, 52).at(-1)!;
    expect(last.setPiece?.kind).toBe('freekick');
    expect(last.carrierId).toBe(taker);
    const spots = frameSpots(m, last, false);
    const wall = [...spots.values()].filter((p) => p.side === 'home' && Math.abs(Math.hypot(p.at.x - last.ball.x, p.at.y - last.ball.y) - 9.15) < 1.2);
    expect(wall.length).toBeGreaterThanOrEqual(4);
    const t = spots.get(taker)!.at;
    expect(Math.hypot(t.x - last.ball.x, t.y - last.ball.y)).toBeLessThan(2);
  });

  it('önemli anlar: şutlar, duran toplar, kart ve sakatlık; kartsız faul ve şutsuz atak değil', () => {
    const base = { side: 'home' as const, playerId: null };
    for (const kind of ['goal', 'save', 'miss', 'blocked', 'penalty', 'corner', 'freekick'] as const) {
      expect(isHighlight({ ...base, kind })).toBe(true);
    }
    expect(isHighlight({ ...base, kind: 'foul' })).toBe(false);
    expect(isHighlight({ ...base, kind: 'attack' })).toBe(false);
    expect(isHighlight({ ...base, kind: 'hold' })).toBe(false);
    expect(isHighlight({ ...base, kind: 'foul', card: { playerId: 1, type: 'yellow' } })).toBe(true);
    expect(isHighlight({ ...base, kind: 'hold', injuredId: 4 })).toBe(true);
    expect(isHighlight(null)).toBe(false);
    expect(playLabel({ ...base, kind: 'foul', card: { playerId: 1, type: 'red' } })).toBe('Kırmızı kart');
    expect(playLabel({ ...base, kind: 'attack', injuredId: 4 })).toBe('Sakatlık');
    expect(playLabel({ ...base, kind: 'goal', fromPenalty: true })).toBe('GOL! (Penaltı)');
  });

  it('bir maçta önemli anlar dakikaların yaklaşık yarısından azı; sahne süresi kare sayısıyla artar', () => {
    const all = playAll(match(12));
    const highlights = all.filter((p) => isHighlight(p.play)).length;
    expect(highlights).toBeGreaterThan(10);
    expect(highlights / all.length).toBeLessThan(0.6);
    const scene = buildScene(all[0]!.state, all.find((p) => p.play.kind === 'goal' || p.play.kind === 'save')!.play, 20);
    expect(sceneDurationMs(scene)).toBe(LEAD_IN_MS + scene.slice(1).reduce((s, f) => s + frameDurationMs(f), 0) + SCENE_HOLD_MS);
    expect(revealDelayMs(scene)).toBeLessThan(sceneDurationMs(scene));
  });

  it('sakatlanan oyuncu son karede işaretli ve görünür', () => {
    const m = match();
    const injured = m.away.onPitch.find((id) => m.players[id]!.slot === 'DC')!;
    const last = buildScene(m, { side: 'home', kind: 'hold', playerId: null, injuredId: injured }, 40).at(-1)!;
    expect(last.injuredId).toBe(injured);
    expect(frameSpots(m, last, false).has(injured)).toBe(true);
  });

  it('dakika sonundaki değişiklik: önce çıkan oyuncu oynar, sonra kenarda değişir, giren yerine geçer', () => {
    const m = match();
    const outId = m.home.onPitch.find((id) => m.players[id]!.slot === 'MC')!;
    const inId = m.home.bench[0]!;
    m.minute = 60;
    m.period = 'second';
    m.home.userControlled = false;
    // Motorun dakika içinde yaptığı değişiklik gibi: maç durumu değişiklikten sonraki hâli
    expect(substitute(m, world.players, 'home', outId, inId)).toBe(true);
    const sub = { side: 'home' as const, outId, inId };
    m.pendingSubs = [];
    const play: MatchPlay = { side: 'home', kind: 'save', playerId: m.home.onPitch.find((id) => m.players[id]!.slot === 'ST')!, keeperId: m.away.onPitch[0]!, subs: [sub] };
    const scene = buildScene(m, play, 60);
    const reveal = revealIndex(scene);
    expect(scene.length - 1 - reveal).toBe(3);
    for (const f of scene.slice(0, reveal + 1)) {
      const spots = frameSpots(m, f, false);
      expect(spots.has(outId)).toBe(true);
      expect(spots.has(inId)).toBe(false);
    }
    expect(scene.at(-3)!.subs).toEqual([sub]);
    // Kenarda (ekranda alt çizginin dışı; ikinci yarıda saha dönük çizilir) buluşurlar
    const [walk, swap, end] = viewScene(m, scene, false).spots.slice(-3);
    expect(swap!.get(outId)!.at.y).toBeGreaterThan(PITCH_WIDTH);
    expect(walk!.get(inId)!.at.y).toBeGreaterThan(PITCH_WIDTH);
    expect(end!.has(outId)).toBe(false);
    expect(end!.get(inId)!.at.y).toBeLessThan(PITCH_WIDTH);
  });

  it('kullanıcının dakikalar arasındaki değişikliği sıradaki dakikanın sahnesinin başında görünür', () => {
    const m = match();
    stepMatch(m, world.players);
    stepMatch(m, world.players);
    const outId = m.home.onPitch.find((id) => m.players[id]!.slot !== 'GK')!;
    const inId = m.home.bench[0]!;
    expect(substitute(m, world.players, 'home', outId, inId)).toBe(true);
    expect(m.pendingSubs).toEqual([{ side: 'home', outId, inId, early: true }]);
    stepMatch(m, world.players);
    expect(m.pendingSubs).toEqual([]);
    expect(m.lastPlay!.subs).toEqual([{ side: 'home', outId, inId, early: true }]);
    expect(isHighlight(m.lastPlay)).toBe(true);
    const scene = buildScene(m, m.lastPlay, m.minute);
    expect(scene[0]!.subs).toHaveLength(1);
    expect(frameSpots(m, scene[0]!, false).has(outId)).toBe(true);
    expect(playLabel({ side: 'home', kind: 'hold', playerId: null, subs: [{ side: 'home', outId, inId }] })).toBe('Oyuncu değişikliği');
  });

  it('yapay zekânın değişiklikleri o dakikanın anında kaydedilir', () => {
    const all = playAll(match(13));
    const subs = all.flatMap((p) => p.play.subs ?? []);
    expect(subs.length).toBeGreaterThan(0);
    for (const s of subs) expect(s.early).toBeUndefined();
  });

  it('devre arasından sonra taraflar yer değiştirir: ekranda ev sahibi sola hücum eder, kanatlar ve kulübe tutarlı', () => {
    const m = match();
    const shooter = m.home.onPitch.find((id) => m.players[id]!.slot === 'ST')!;
    const back = m.home.onPitch.find((id) => m.players[id]!.slot === 'DR')!;
    const goal: MatchPlay = { side: 'home', kind: 'goal', playerId: shooter };
    const screen = (period: MatchState['period'], minute: number, play: MatchPlay | null) => {
      m.period = period;
      m.minute = minute;
      return viewScene(m, buildScene(m, play, minute), play === null);
    };
    expect([sidesSwapped({ period: 'pre' }), sidesSwapped({ period: 'first' }), sidesSwapped({ period: 'half' })]).toEqual([false, false, false]);
    expect([sidesSwapped({ period: 'second' }), sidesSwapped({ period: 'full' })]).toEqual([true, true]);
    // İlk yarıda ev sahibinin golü sağ kaleye, ikinci yarıda sol kaleye
    const first = screen('first', 30, goal);
    const second = screen('second', 70, goal);
    expect(first.frames[revealIndex(first.frames)]!.ball.x).toBeGreaterThan(PITCH_LENGTH);
    expect(second.frames[revealIndex(second.frames)]!.ball.x).toBeLessThan(0);
    // İkinci yarı santrası: ev sahibi sağ yarıda; sağ bek hücum yönünün sağında (ekranda yukarıda)
    const kickoff = screen('second', 45, null).spots[0]!;
    for (const [, p] of kickoff) {
      if (p.side === 'home') expect(p.at.x).toBeGreaterThanOrEqual(PITCH_LENGTH / 2);
      else expect(p.at.x).toBeLessThanOrEqual(PITCH_LENGTH / 2);
    }
    expect(kickoff.get(back)!.at.y).toBeLessThan(PITCH_WIDTH / 2);
    expect(screen('pre', 0, null).spots[0]!.get(back)!.at.y).toBeGreaterThan(PITCH_WIDTH / 2);
  });

  it('kırmızı kart gören oyuncu sonuçtan sonra kenara yürüyerek sahayı terk eder', () => {
    const m = match();
    const red = m.away.onPitch.find((id) => m.players[id]!.slot === 'DC')!;
    const scene = buildScene(m, { side: 'home', kind: 'foul', playerId: null, defenderId: red, card: { playerId: red, type: 'red' } }, 30);
    const reveal = revealIndex(scene);
    expect(scene.length - 1 - reveal).toBe(1);
    expect(frameSpots(m, scene.at(-1)!, false).get(red)!.at.y).toBeGreaterThan(PITCH_WIDTH);
  });
});

describe('akış: top sürme, havadan top, bantlar', () => {
  const plays = [9, 10, 11, 12].flatMap((seed) => playAll(match(seed)));
  const scenes = plays.filter((p) => isHighlight(p.play)).map((p) => ({ ...p, scene: buildScene(p.state, p.play, p.minute) }));

  it('top sürmede topu aynı oyuncu taşır ve top hücum yönünde ilerler', () => {
    const dribbles = scenes.flatMap(({ scene, play }) => scene.flatMap((f, i) => (f.move === 'dribble' && i > 0 ? [{ f, prev: scene[i - 1]!, side: play.side }] : [])));
    expect(dribbles.length).toBeGreaterThan(5);
    for (const { f, prev, side } of dribbles) {
      expect(f.carrierId).toBe(prev.carrierId);
      expect(side === 'home' ? f.ball.x - prev.ball.x : prev.ball.x - f.ball.x).toBeGreaterThan(0);
    }
  });

  it('korner ortası ve uzun paslar havadan; serbest vuruş şutu falsolu', () => {
    const corners = scenes.filter(({ play }) => play.fromCorner);
    expect(corners.length).toBeGreaterThan(0);
    for (const { scene } of corners) {
      const cross = scene.find((f) => f.move === 'cross');
      expect(cross?.height).toBeGreaterThan(5);
    }
    const lobs = scenes.flatMap(({ scene }) => scene.filter((f) => f.move === 'lob'));
    for (const f of lobs) expect(f.height).toBeGreaterThan(2);
    for (const { scene } of scenes.filter(({ play }) => play.fromFreeKick)) {
      const shot = scene.find((f) => f.move === 'shot')!;
      expect(Math.abs(shot.curl ?? 0)).toBeGreaterThan(3);
    }
  });

  it('bantlar: penaltı kararı sonuçtan önce, gol sonuçtan sonra (santrada kalkar)', () => {
    const goal = scenes.find(({ play }) => play.kind === 'goal' && !play.fromPenalty)!;
    const reveal = revealIndex(goal.scene);
    expect(bannerKind(goal.play, goal.scene, reveal - 1, false)).toBeNull();
    expect(bannerKind(goal.play, goal.scene, reveal, true)).toBe('goal');
    expect(bannerKind(goal.play, goal.scene, goal.scene.length - 1, true)).toBeNull();
    const penalty = scenes.find(({ play }) => play.fromPenalty);
    if (penalty) {
      const spot = penalty.scene.findIndex((f) => f.setPiece?.kind === 'penalty');
      expect(bannerKind(penalty.play, penalty.scene, spot, false)).toBe('penalty');
    }
  });
});
