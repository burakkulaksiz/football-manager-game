/**
 * Oyuncu menajerleri ve sözleşme pazarlığı. Her oyuncunun bir menajeri vardır (kimliğine göre);
 * menajerin tavrı talebi, sabrı ve menajer ücretini belirler. Sözleşme maddeleri: rol, serbest kalma
 * bedeli, maç ve gol primi. Oyuncunun bakışı "yıllık maaş karşılığı" üzerinden hesaplanır: imza bonusu,
 * primler ve menajer ücretindeki fark yıllara bölünüp maaşa eklenir.
 */
import type { GameData } from '../data';
import type { GameDate } from '../date';
import { addExpense } from '../finance/finance';
import { clubPlayers } from '../generation/worldGenerator';
import { ageOn, marketValue, primaryPosition, roundNice } from '../player';
import type { Rng } from '../rng';
import type { Agent, AgentStyle, Contract, GameWorld, MatchResult, Player, Position, SquadRole } from '../types';
import { contractExpiry, preferredYears, wageDemand, type TransferTerms } from './market';

export const AGENT_SEED_SALT = 0x5a17e9c3;
export const AGENT_COUNT = 30;

export interface AgentProfile {
  /** Maaş talebine çarpan. */
  wageFactor: number;
  /** Menajer ücreti talebi: sözleşmenin toplam maaşının oranı. */
  feeRate: number;
  /** Menajer ücretindeki 1 € kaç € toplam maaş yerine geçer (ücret ↔ maaş takası). */
  feeWeight: number;
  /** İstenen ücretin en az bu kadarı verilmezse imza yok. */
  minFeeShare: number;
  /** Transfer görüşmesinde ret hakkı. */
  patience: number;
  /** Serbest kalma bedeli şartı: piyasa değerinin en çok bu katı (null = şart değil). */
  clauseMultiple: number | null;
}

export const AGENT_PROFILES: Record<AgentStyle, AgentProfile> = {
  fair: { wageFactor: 1, feeRate: 0.04, feeWeight: 0.5, minFeeShare: 0, patience: 4, clauseMultiple: null },
  greedy: { wageFactor: 1, feeRate: 0.1, feeWeight: 1, minFeeShare: 0.6, patience: 3, clauseMultiple: null },
  tough: { wageFactor: 1.08, feeRate: 0.06, feeWeight: 0.4, minFeeShare: 0, patience: 2, clauseMultiple: 2.5 },
};

/** Rol sırası: küçükten büyüğe. */
export const ROLE_ORDER: readonly SquadRole[] = ['backup', 'rotation', 'star'];

/** Rolün beklenen yıllık maç sayısı (prim değerlemesi). */
const ROLE_APPS: Record<SquadRole, number> = { star: 30, rotation: 20, backup: 8 };
/** Rolü beklentinin altındaysa her kademe için maaş talebi çarpanı. */
const ROLE_PENALTY = 1.15;
/** Rolü beklentinin üstündeyse talep çarpanı (forma sözü verilir). */
const ROLE_BONUS = 0.97;
/** Primler, oyuncunun gözünde beklenen tutarın bu oranı kadar değerli (garanti değil). */
const BONUS_WEIGHT = 0.6;
/** İstediği süre dışında sözleşme için çarpan. */
const OFF_TERM = 1.1;

/** Menajerler: çoğu makul, bir kısmı açgözlü ya da sert. */
export function generateAgents(rng: Rng, data: GameData): Agent[] {
  const pool = data.namePools.tr ?? Object.values(data.namePools)[0]!;
  const agents: Agent[] = [];
  const used = new Set<string>();
  for (let id = 1; agents.length < AGENT_COUNT; id++) {
    const name = `${rng.pick(pool.firstNames)} ${rng.pick(pool.lastNames)}`;
    if (used.has(name) && id < AGENT_COUNT * 5) continue;
    used.add(name);
    const r = rng.next();
    agents.push({ id: agents.length + 1, name, style: r < 0.5 ? 'fair' : r < 0.8 ? 'greedy' : 'tough' });
  }
  return agents;
}

const FALLBACK_AGENT: Agent = { id: 0, name: 'Menajeri', style: 'fair' };

/** Oyuncunun menajeri: kimliğinden (karıştırılmış) sabit seçilir; oyuncuda alan tutulmaz. */
export function agentOf(world: GameWorld, player: Player): Agent {
  const agents = world.agents;
  if (!agents || agents.length === 0) return FALLBACK_AGENT;
  const h = Math.imul(player.id ^ 0x9e3779b9, 2654435761) >>> 0;
  return agents[h % agents.length]!;
}

export function agentProfile(world: GameWorld, player: Player): AgentProfile {
  return AGENT_PROFILES[agentOf(world, player).style];
}

/** Oyuncunun o kulüpte beklediği rol: kendisinden iyi oyuncu sayısına göre; 21 yaş altı bir kademe aşağıya razı. */
export function expectedRole(world: GameWorld, player: Player, clubId: string): SquadRole {
  const better = clubPlayers(world, clubId).filter((p) => p.id !== player.id && p.currentAbility > player.currentAbility).length;
  let index = better < 9 ? 2 : better < 16 ? 1 : 0;
  if (ageOn(player.birthDate, world.date) < 21) index = Math.max(0, index - 1);
  return ROLE_ORDER[index]!;
}

/** Maç başına beklenen gol (gol primi değerlemesi). */
function goalsPerApp(position: Position): number {
  if (position === 'ST') return 0.45;
  if (position === 'AMC' || position === 'AMR' || position === 'AML') return 0.25;
  if (position === 'MC' || position === 'MR' || position === 'ML') return 0.1;
  if (position === 'GK') return 0;
  return 0.04;
}

/** Oyuncunun ve menajerinin tam talebi. */
export interface ContractDemand {
  wage: number;
  years: number;
  signingBonus: number;
  agentFee: number;
  role: SquadRole;
  /** Şart koşulan en yüksek serbest kalma bedeli; şart yoksa null. */
  releaseClause: number | null;
}

/** Sözleşme süresinin oyuncunun tercihine uyarlanmışı. */
function preferredTerm(world: GameWorld, player: Player, years?: number): number {
  const [minYears, maxYears] = preferredYears(ageOn(player.birthDate, world.date));
  if (years === undefined) return Math.round((minYears + maxYears) / 2);
  return Math.min(maxYears, Math.max(minYears, years));
}

/** Serbest kalma bedelinin oyuncunun gözündeki etkisi (düşük bedel = kolay ayrılık → talep azalır; çok yüksek bedel anlamsız). */
function clauseFactor(clause: number | null, value: number): number {
  if (clause === null) return 1;
  return clause <= value * 1.5 ? 0.95 : clause <= value * 3 ? 0.98 : 1;
}

/**
 * Talep: maaş (menajerin tavrıyla), istediği süre, menajer ücreti, beklediği rol ve (sert menajerde)
 * serbest kalma bedeli. `years` verilirse o süreye göre (tercih aralığına çekilerek).
 */
export function contractDemand(world: GameWorld, player: Player, clubId: string, years?: number): ContractDemand {
  const profile = agentProfile(world, player);
  const term = preferredTerm(world, player, years);
  const value = marketValue(player, world.date);
  const releaseClause = profile.clauseMultiple !== null ? roundNice(value * profile.clauseMultiple) : null;
  const wage = roundNice(wageDemand(world, player, clubId) * profile.wageFactor * clauseFactor(releaseClause, value));
  return {
    wage,
    years: term,
    signingBonus: 0,
    agentFee: roundNice(profile.feeRate * wage * term),
    role: expectedRole(world, player, clubId),
    releaseClause,
  };
}

export type TermsProblem = 'fee' | 'clause' | null;

export interface TermsVerdict {
  ok: boolean;
  /** Yakın (karşı teklif) mi, çok mu düşük. */
  close: boolean;
  /** Menajerin ayrıca şart koştuğu: ücret ya da serbest kalma bedeli. */
  problem: TermsProblem;
  demand: ContractDemand;
}

/**
 * Oyuncunun ve menajerinin şartlara bakışı. Verilmeyen menajer ücreti istenen kadar, rol beklenen,
 * serbest kalma bedeli yok sayılır.
 */
export function evaluateTerms(world: GameWorld, player: Player, clubId: string, terms: TransferTerms): TermsVerdict {
  const profile = agentProfile(world, player);
  const [minYears, maxYears] = preferredYears(ageOn(player.birthDate, world.date));
  const demand = contractDemand(world, player, clubId, terms.years);
  const value = marketValue(player, world.date);
  const years = Math.max(1, terms.years);
  const role = terms.role ?? demand.role;
  const clause = terms.releaseClause ? terms.releaseClause : null;

  const termFactor = terms.years >= minYears && terms.years <= maxYears ? 1 : OFF_TERM;
  const gap = ROLE_ORDER.indexOf(demand.role) - ROLE_ORDER.indexOf(role);
  const roleFactor = gap > 0 ? ROLE_PENALTY ** gap : gap < 0 ? ROLE_BONUS : 1;
  // Talep maaşı şart koşulan bedele göre hesaplandı; teklif edilen bedelin etkisiyle değiştir
  const base = demand.wage / clauseFactor(demand.releaseClause, value);
  const required = base * termFactor * roleFactor * clauseFactor(clause, value);

  const fee = terms.agentFee ?? demand.agentFee;
  const apps = ROLE_APPS[role];
  const bonusValue = BONUS_WEIGHT * apps * ((terms.appearanceBonus ?? 0) + (terms.goalBonus ?? 0) * goalsPerApp(primaryPosition(player)));
  const effective = terms.wage + terms.signingBonus / years + bonusValue + (profile.feeWeight * (fee - demand.agentFee)) / years;

  const problem: TermsProblem =
    fee < demand.agentFee * profile.minFeeShare ? 'fee'
      : demand.releaseClause !== null && (clause === null || clause > demand.releaseClause) ? 'clause'
        : null;
  return {
    ok: effective >= required && problem === null,
    close: effective >= required * 0.85,
    problem,
    // Gösterilen talep: beklediği rolde, istediği bedel ve süreyle
    demand: { ...demand, wage: roundNice(base * termFactor * clauseFactor(demand.releaseClause, value)) },
  };
}

/** Şartlardan sözleşme: rol ve yalnızca verilen maddeler yazılır. */
export function contractFromTerms(date: GameDate, terms: TransferTerms): Contract {
  const contract: Contract = { wage: terms.wage, expires: contractExpiry(date, terms.years) };
  if (terms.role) contract.role = terms.role;
  if (terms.releaseClause) contract.releaseClause = roundNice(terms.releaseClause);
  if (terms.appearanceBonus) contract.appearanceBonus = roundNice(terms.appearanceBonus);
  if (terms.goalBonus) contract.goalBonus = roundNice(terms.goalBonus);
  return contract;
}

/** Maçtan sonra sözleşmedeki maç ve gol primleri ödenir (oynadığı kulübün "Primler" giderine). */
export function payContractBonuses(world: GameWorld, result: MatchResult): void {
  for (const record of result.players) {
    if (record.minutes <= 0) continue;
    const contract = world.players[record.playerId]?.contract;
    const fin = world.finances[record.clubId];
    if (!contract || !fin) continue;
    const amount = (contract.appearanceBonus ?? 0) + record.goals * (contract.goalBonus ?? 0);
    if (amount > 0) addExpense(fin, 'bonuses', amount);
  }
}
