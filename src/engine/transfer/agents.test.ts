import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { migrateWorld } from '../migrate';
import { marketValue } from '../player';
import type { AgentStyle, GameWorld, MatchResult, Player } from '../types';
import {
  AGENT_COUNT,
  agentOf,
  contractDemand,
  evaluateTerms,
  expectedRole,
  payContractBonuses,
} from './agents';
import type { TransferTerms } from './market';
import { negotiateRenewal, triggerReleaseClause } from './offers';

const START = '2026-07-01';

function setup(): GameWorld {
  const world = createWorld(gameData, 21, 'kasimpasa', START);
  world.finances.kasimpasa!.transferBudget = 50_000_000;
  world.finances.kasimpasa!.wageBudget = 60_000_000;
  return world;
}

/** Menajeri bu tavırda olan bir rakip oyuncu. */
function withAgent(world: GameWorld, style: AgentStyle): Player {
  const player = Object.values(world.players).find((p) => p.clubId === 'konyaspor' && agentOf(world, p).style === style);
  if (!player) throw new Error(`${style} menajerli oyuncu yok`);
  return player;
}

const demandTerms = (world: GameWorld, p: Player): TransferTerms => {
  const d = contractDemand(world, p, 'kasimpasa');
  return { wage: d.wage, years: d.years, signingBonus: 0, agentFee: d.agentFee, role: d.role, releaseClause: d.releaseClause };
};

describe('menajerler', () => {
  it('dünyada menajerler var; her oyuncunun sabit bir menajeri olur, üç tavır da görülür', () => {
    const world = setup();
    expect(world.agents).toHaveLength(AGENT_COUNT);
    expect(new Set(world.agents.map((a) => a.style))).toEqual(new Set(['fair', 'greedy', 'tough']));
    const p = clubPlayers(world, 'konyaspor')[0]!;
    expect(agentOf(world, p)).toBe(agentOf(world, p));
    // Aynı tohum aynı menajerler
    expect(setup().agents).toEqual(world.agents);
  });

  it('menajerin tam talebi kabul edilir', () => {
    const world = setup();
    for (const style of ['fair', 'greedy', 'tough'] as const) {
      const p = withAgent(world, style);
      expect(evaluateTerms(world, p, 'kasimpasa', demandTerms(world, p)).ok).toBe(true);
    }
  });

  it('açgözlü menajer ücretsiz imza vermez; yüksek ücret karşılığı maaştan iner', () => {
    const world = setup();
    const p = withAgent(world, 'greedy');
    const terms = demandTerms(world, p);
    const noFee = evaluateTerms(world, p, 'kasimpasa', { ...terms, wage: terms.wage * 2, agentFee: 0 });
    expect(noFee.ok).toBe(false);
    expect(noFee.problem).toBe('fee');
    // Fazladan ücret yıllara bölünüp maaş yerine geçer
    const cut = terms.wage * 0.1;
    const traded = { ...terms, wage: terms.wage - cut, agentFee: terms.agentFee! + cut * terms.years };
    expect(evaluateTerms(world, p, 'kasimpasa', traded).ok).toBe(true);
    // Makul menajer aynı takası yarı değerle sayar
    const f = withAgent(world, 'fair');
    const fair = demandTerms(world, f);
    const fairCut = fair.wage * 0.1;
    expect(evaluateTerms(world, f, 'kasimpasa', { ...fair, wage: fair.wage - fairCut, agentFee: fair.agentFee! + fairCut * fair.years }).ok).toBe(false);
  });

  it('sert menajer serbest kalma bedeli şart koşar ve daha yüksek maaş ister', () => {
    const world = setup();
    const p = withAgent(world, 'tough');
    const terms = demandTerms(world, p);
    expect(terms.releaseClause).toBeGreaterThan(0);
    const none = evaluateTerms(world, p, 'kasimpasa', { ...terms, releaseClause: null });
    expect(none.ok).toBe(false);
    expect(none.problem).toBe('clause');
    expect(evaluateTerms(world, p, 'kasimpasa', { ...terms, releaseClause: terms.releaseClause! * 2 }).problem).toBe('clause');
  });

  it('beklediğinden düşük rol daha çok maaş ister; primler maaşın yerine geçebilir', () => {
    const world = setup();
    const p = withAgent(world, 'fair');
    const terms = demandTerms(world, p);
    const lower = expectedRole(world, p, 'kasimpasa') === 'backup' ? null : ('backup' as const);
    if (lower) {
      const verdict = evaluateTerms(world, p, 'kasimpasa', { ...terms, role: lower });
      expect(verdict.ok).toBe(false);
      expect(evaluateTerms(world, p, 'kasimpasa', { ...terms, role: lower, wage: terms.wage * 1.35 }).ok).toBe(true);
    }
    // Maaştan %10 kesinti, maç primiyle telafi (yedek rolde yılda ~8 maç beklenir; prim beklenenin %60ı sayılır)
    const cut = terms.wage * 0.1;
    expect(evaluateTerms(world, p, 'kasimpasa', { ...terms, wage: terms.wage - cut }).ok).toBe(false);
    expect(evaluateTerms(world, p, 'kasimpasa', { ...terms, wage: terms.wage - cut, appearanceBonus: cut / 4 }).ok).toBe(true);
  });

  it('yenilemede "önemli oyuncu" rolü forma sözü olur; maddeler sözleşmeye yazılır, menajer ücreti ödenir', () => {
    const world = setup();
    const p = clubPlayers(world, 'kasimpasa').sort((a, b) => b.currentAbility - a.currentAbility)[0]!;
    const terms = { ...demandTerms(world, p), role: 'star' as const, releaseClause: marketValue(p, world.date) * 2, goalBonus: 20_000 };
    const balance = world.finances.kasimpasa!.balance;
    expect(negotiateRenewal(world, p.id, terms).outcome).toBe('signed');
    expect(p.contract.role).toBe('star');
    expect(p.contract.releaseClause).toBeGreaterThan(0);
    expect(p.contract.goalBonus).toBe(20_000);
    expect(world.promises.some((pr) => pr.playerId === p.id)).toBe(true);
    expect(world.finances.kasimpasa!.balance).toBe(balance - terms.agentFee!);
  });

  it('maçtan sonra maç ve gol primi ödenir', () => {
    const world = setup();
    const p = clubPlayers(world, 'kasimpasa')[0]!;
    p.contract.appearanceBonus = 5_000;
    p.contract.goalBonus = 10_000;
    const before = world.finances.kasimpasa!.current.expense.bonuses;
    const result = { players: [{ playerId: p.id, clubId: 'kasimpasa', started: true, minutes: 90, rating: 7, goals: 2, assists: 0 }] } as unknown as MatchResult;
    payContractBonuses(world, result);
    expect(world.finances.kasimpasa!.current.expense.bonuses - before).toBe(25_000);
  });

  it('serbest kalma bedelini ödeyen kulübe oyuncu satılır', () => {
    const world = setup();
    const p = clubPlayers(world, 'kasimpasa')[3]!;
    p.contract.releaseClause = 2_000_000;
    const balance = world.finances.kasimpasa!.balance;
    triggerReleaseClause(world, p, 'konyaspor');
    expect(p.clubId).toBe('konyaspor');
    expect(p.contract.releaseClause).toBeUndefined();
    expect(world.finances.kasimpasa!.balance).toBe(balance + 2_000_000);
    expect(world.news.some((n) => n.title.includes('serbest kalma bedelini'))).toBe(true);
  });

  it('eski kayıt: menajerler ve menajer ücreti gider kalemi eklenir', () => {
    const world = setup();
    const raw = structuredClone(world) as Partial<GameWorld>;
    delete raw.agents;
    for (const fin of Object.values(raw.finances!)) delete (fin.current.expense as Partial<typeof fin.current.expense>).agentFees;
    const migrated = migrateWorld(raw, 12, gameData);
    expect(migrated.agents).toEqual(world.agents);
    expect(migrated.finances.kasimpasa!.current.expense.agentFees).toBe(0);
  });
});
