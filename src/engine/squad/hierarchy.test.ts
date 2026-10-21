import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { createMatch } from '../match/engine';
import { autoSelectLineup } from '../match/formation';
import type { GameWorld } from '../types';
import { assistantAdvice } from './assistant';
import { applyCaptainChange, leadersInfluence, teamHierarchy, teamLeaders, tenureYears } from './hierarchy';

const START = '2026-07-01';
const fresh = () => createWorld(gameData, 81, 'samsunspor', START);
const user = (w: GameWorld) => w.playerClubId;

describe('takım hiyerarşisi', () => {
  it('etkiye göre sıralı: 2 lider, 3 etkili, 5 saygın, kalanı diğer', () => {
    const w = fresh();
    const h = teamHierarchy(w, user(w));
    expect(h.map((e) => e.level).slice(0, 10)).toEqual([
      'leader', 'leader', 'influential', 'influential', 'influential',
      'respected', 'respected', 'respected', 'respected', 'respected',
    ]);
    expect(h.slice(10).every((e) => e.level === 'other')).toBe(true);
    for (let i = 1; i < h.length; i++) expect(h[i - 1]!.influence).toBeGreaterThanOrEqual(h[i]!.influence);
  });

  it('liderlik ve kaptanlık etkiyi artırır', () => {
    const w = fresh();
    const last = teamHierarchy(w, user(w)).at(-1)!;
    const p = w.players[last.playerId]!;
    p.attributes.leadership = 20;
    w.tactics[user(w)]!.captainId = p.id;
    const after = teamHierarchy(w, user(w)).find((e) => e.playerId === p.id)!;
    expect(after.influence).toBeGreaterThan(last.influence + 10);
  });

  it('kulüpteki süre: oyun başından beri olanlar 1–6 yıl (yaşını aşmaz) ve zamanla artar; yeni gelen 0, kiralık 0', () => {
    const w = fresh();
    const [a, b, c] = clubPlayers(w, user(w));
    const start = tenureYears(a!, w.date);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start).toBeLessThanOrEqual(6);
    expect(tenureYears(a!, '2027-07-01', w.date)).toBeCloseTo(start + 1, 1);
    const variety = new Set(clubPlayers(w, user(w)).map((p) => tenureYears(p, w.date)));
    expect(variety.size).toBeGreaterThan(3);
    b!.joined = '2026-01-01';
    expect(tenureYears(b!, w.date)).toBeCloseTo(0.5, 1);
    c!.loan = { fromClubId: 'galatasaray', until: '2027-06-30' };
    expect(tenureYears(c!, w.date)).toBe(0);
  });
});

describe('kaptanlık değişikliği', () => {
  it('kaptanlığı alınan lider kırılır, yeni kaptan sevinir; alt sıradan kaptan liderleri bozar', () => {
    const w = fresh();
    const before = teamHierarchy(w, user(w));
    const [leaderA, leaderB] = before.filter((e) => e.level === 'leader').map((e) => w.players[e.playerId]!);
    const nobody = w.players[before.at(-1)!.playerId]!;
    for (const p of [leaderA!, leaderB!, nobody]) p.morale = 60;
    applyCaptainChange(w, 'captain', leaderA!.id, nobody.id, before);
    expect(leaderA!.morale).toBe(60 - 12 - 4); // kaptanlığı alındı (lider: −12) + alt sıradan kaptan (−4)
    expect(leaderB!.morale).toBe(56);
    expect(nobody.morale).toBe(68);
    expect(w.news.some((n) => n.playerId === leaderA!.id && n.title.includes('kaptanlığı'))).toBe(true);
  });

  it('yardımcı kaptan değişikliği daha hafif', () => {
    const w = fresh();
    const before = teamHierarchy(w, user(w));
    const [a, b] = [w.players[before[2]!.playerId]!, w.players[before[3]!.playerId]!];
    a.morale = 60;
    b.morale = 60;
    applyCaptainChange(w, 'vice', a.id, b.id, before);
    expect(a.morale).toBe(54); // etkili oyuncu: −3 −3
    expect(b.morale).toBe(64);
  });
});

describe('liderlerin havası', () => {
  it('liderler mutluysa takım hafifçe yükselir, mutsuzsa düşer', () => {
    const w = fresh();
    const leaders = new Set(teamLeaders(w, user(w)).map((p) => p.id));
    const squad = clubPlayers(w, user(w));
    for (const p of squad) p.morale = leaders.has(p.id) ? 80 : 60;
    leadersInfluence(w);
    expect(squad.filter((p) => !leaders.has(p.id)).every((p) => p.morale === 61)).toBe(true);
    for (const p of squad) p.morale = leaders.has(p.id) ? 20 : 60;
    leadersInfluence(w);
    expect(squad.filter((p) => !leaders.has(p.id)).every((p) => p.morale === 58)).toBe(true);
  });

  it('yardımcı antrenör: kaptan lider değilse ve liderler mutsuzsa uyarır', () => {
    const w = fresh();
    const h = teamHierarchy(w, user(w));
    w.tactics[user(w)]!.captainId = h.at(-1)!.playerId;
    for (const e of teamHierarchy(w, user(w)).filter((x) => x.level === 'leader')) w.players[e.playerId]!.morale = 20;
    const kinds = assistantAdvice(w).map((a) => a.kind);
    expect(kinds).toContain('captainNotLeader');
    expect(kinds).toContain('leadersUnhappy');
  });
});

describe('maçta kaptan', () => {
  it('kaptan seçilmemişse ilk 11in en yüksek liderlikli oyuncusu kaptan, ikincisi yardımcı kaptan', () => {
    const w = fresh();
    const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(w, clubId)) });
    const m = createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed: 3 }, w.players);
    const byLeadership = m.home.onPitch.map((id) => w.players[id]!).sort((a, b) => b.attributes.leadership - a.attributes.leadership);
    expect(w.players[m.home.captainId!]!.attributes.leadership).toBe(byLeadership[0]!.attributes.leadership);
    expect(m.home.viceCaptainId).not.toBe(m.home.captainId);
    expect(w.players[m.home.viceCaptainId!]!.attributes.leadership).toBe(byLeadership[1]!.attributes.leadership);
  });
});
