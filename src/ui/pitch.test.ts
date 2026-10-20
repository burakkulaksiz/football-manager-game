import { describe, expect, it } from 'vitest';
import { clubPlayers, createMatch, createWorld, stepMatch, type MatchState } from '../engine';
import { autoSelectLineup } from '../engine/match/formation';
import { gameData } from '../gameData';
import { ballSpot, blockLine, cameraTransform, CAMERA_ZOOM, colorsClash, PITCH_LENGTH, PITCH_VIEW, PITCH_WIDTH, screenUnit, shotOrigin, teamSpots, toScreen } from './pitch';

const world = createWorld(gameData, 3, 'galatasaray', '2026-07-01');

function match(): MatchState {
  const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(world, clubId)) });
  return createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed: 9 }, world.players);
}

const inside = (p: { x: number; y: number }) =>
  p.x >= -2 && p.x <= PITCH_LENGTH + 2 && p.y >= 0 && p.y <= PITCH_WIDTH;

describe('2D saha geometrisi', () => {
  it('başlama vuruşunda top ortada, iki takım da kendi yarısında', () => {
    const m = match();
    const ball = ballSpot(null, 0);
    expect(ball).toEqual({ x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 });
    const home = teamSpots(m, 'home', ball, true);
    const away = teamSpots(m, 'away', ball, true);
    expect(home.size).toBe(11);
    expect(away.size).toBe(11);
    for (const p of home.values()) expect(p.x).toBeLessThan(PITCH_LENGTH / 2);
    for (const p of away.values()) expect(p.x).toBeGreaterThan(PITCH_LENGTH / 2);
  });

  it('gol ev sahibinde rakip kalenin içinde, deplasmanda ev sahibi kalesinin içinde', () => {
    const home = ballSpot({ side: 'home', kind: 'goal', playerId: 1 }, 30);
    const away = ballSpot({ side: 'away', kind: 'goal', playerId: 1 }, 30);
    expect(home.x).toBeGreaterThan(PITCH_LENGTH);
    expect(away.x).toBeLessThan(0);
    for (const b of [home, away]) expect(Math.abs(b.y - PITCH_WIDTH / 2)).toBeLessThan(3.66);
  });

  it('penaltı şutu penaltı noktasından çıkar; şut olmayan anda şut çizgisi yok', () => {
    expect(shotOrigin({ side: 'home', kind: 'goal', playerId: 1, fromPenalty: true }, 10)).toEqual({ x: PITCH_LENGTH - 11, y: PITCH_WIDTH / 2 });
    expect(shotOrigin({ side: 'away', kind: 'hold', playerId: null }, 10)).toBeNull();
  });

  it('top rakip kaleye yaklaştıkça hücum eden takım ileri, savunan geri çekilir', () => {
    const deep = ballSpot({ side: 'home', kind: 'attack', playerId: null }, 5);
    expect(blockLine('home', deep)).toBeGreaterThan(0.6);
    expect(blockLine('away', deep)).toBeLessThan(0.2);
  });

  it('maç boyunca her dakika top ve oyuncular saha içinde kalır', () => {
    const m = match();
    while (m.period !== 'full') {
      stepMatch(m, world.players);
      const ball = ballSpot(m.lastPlay, m.minute);
      expect(ball.y).toBeGreaterThanOrEqual(0);
      expect(ball.y).toBeLessThanOrEqual(PITCH_WIDTH);
      for (const side of ['home', 'away'] as const) {
        for (const p of teamSpots(m, side, ball, m.lastPlay === null).values()) expect(inside(p)).toBe(true);
      }
      // Gol olan dakikada son an gol olmalı
      const goal = m.goals[m.goals.length - 1];
      if (m.lastPlay?.kind === 'goal') expect(goal?.playerId).toBe(m.lastPlay.playerId);
    }
  });

  it('renk çakışması: kırmızıya karşı kırmızı çakışır, kırmızıya karşı lacivert çakışmaz', () => {
    expect(colorsClash('#C8102E', '#B3122E')).toBe(true);
    expect(colorsClash('#C8102E', '#0A2A66')).toBe(false);
  });
});

describe('kamera', () => {
  it('tam sahada kaydırma yok; yakında hedef ortalanır', () => {
    expect(cameraTransform(null, CAMERA_ZOOM)).toEqual({ tx: 0, ty: 0, zoom: 1 });
    expect(cameraTransform({ x: 50, y: 34 }, 1)).toEqual({ tx: 0, ty: 0, zoom: 1 });
    const cam = cameraTransform({ x: 52.5, y: 34 }, 2);
    // Orta nokta ekranın ortasına düşer: tx + fx·zoom = 0.5
    const fx = (52.5 - PITCH_VIEW.x) / PITCH_VIEW.w;
    const fy = (34 - PITCH_VIEW.y) / PITCH_VIEW.h;
    expect(cam.tx + fx * cam.zoom).toBeCloseTo(0.5, 6);
    expect(cam.ty + fy * cam.zoom).toBeCloseTo(0.5, 6);
  });

  it('kenarda durur: köşedeki hedefte görüntü sahanın dışına taşmaz', () => {
    for (const target of [{ x: 0, y: 0 }, { x: 105, y: 68 }, { x: 106, y: 34 }]) {
      const cam = cameraTransform(target, CAMERA_ZOOM);
      expect(cam.tx).toBeLessThanOrEqual(0);
      expect(cam.tx).toBeGreaterThanOrEqual(1 - CAMERA_ZOOM);
      expect(cam.ty).toBeLessThanOrEqual(0);
      expect(cam.ty).toBeGreaterThanOrEqual(1 - CAMERA_ZOOM);
    }
  });
});

describe('ekran konumu (HTML oyuncu katmanı)', () => {
  it('kameranın ortaladığı nokta ekranın ortasına düşer; birim büyütmeyle büyür', () => {
    const width = 1110;
    const height = (width * PITCH_VIEW.h) / PITCH_VIEW.w;
    const target = { x: 60, y: 30 };
    const cam = cameraTransform(target, CAMERA_ZOOM);
    const p = toScreen(target, cam, width);
    expect(p.x).toBeCloseTo(width / 2, 6);
    expect(p.y).toBeCloseTo(height / 2, 6);
    const full = cameraTransform(null, CAMERA_ZOOM);
    expect(screenUnit(full, width)).toBeCloseTo(10, 6);
    expect(screenUnit(cam, width)).toBeCloseTo(10 * CAMERA_ZOOM, 6);
    // Tam sahada sahanın sol üst köşesi (0, 0) kenar payı kadar içeride
    expect(toScreen({ x: 0, y: 0 }, full, width)).toEqual({ x: 30, y: 20 });
  });
});
