/**
 * Taktikler: takım talimatları, bunların motora etkisi ve kullanıcının kadro düzeni.
 */
import { isAvailable } from '../player';
import type { Player } from '../types';
import {
  assignToFormation,
  autoBench,
  BENCH_SIZE,
  DEFAULT_FORMATION_ID,
  FORMATIONS,
  slotFit,
  type FormationId,
  type Lineup,
} from './formation';
import type { Mentality } from './state';

export type PassingStyle = 'short' | 'mixed' | 'direct';
export type Tempo = 'slow' | 'normal' | 'fast';
export type Pressing = 'low' | 'normal' | 'high';
export type DefensiveLine = 'deep' | 'normal' | 'high';
export type Width = 'narrow' | 'normal' | 'wide';

export interface TeamInstructions {
  mentality: Mentality;
  passing: PassingStyle;
  tempo: Tempo;
  pressing: Pressing;
  defensiveLine: DefensiveLine;
  width: Width;
}

export const DEFAULT_INSTRUCTIONS: TeamInstructions = {
  mentality: 0,
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'normal',
  defensiveLine: 'normal',
  width: 'normal',
};

/** Kullanıcının kulübü için kayıtlı taktik. */
export interface Tactics {
  formation: FormationId;
  /** FORMATIONS[formation][i] mevkiindeki oyuncu (boşsa null). */
  lineup: (number | null)[];
  bench: number[];
  captainId: number | null;
  /** Kaptan sahada değilse liderlik etkisini yardımcı kaptan verir. */
  viceCaptainId: number | null;
  penaltyTakerId: number | null;
  freeKickTakerId: number | null;
  instructions: TeamInstructions;
}

/* ------------------------------------------------------------------ */
/* Talimatların etkisi                                                  */
/* ------------------------------------------------------------------ */

/** Talimatların ürettiği çarpanlar (1 = etkisiz). */
export interface InstructionEffects {
  /** Kendi orta saha (top hakimiyeti) gücü. */
  midfield: number;
  /** Rakibin orta saha gücüne uygulanır (pres). */
  oppMidfield: number;
  /** Topa sahipken atak kurma olasılığı. */
  attackChance: number;
  /** Atağın şuta dönüşme olasılığı. */
  shotChance: number;
  /** Rakibin şut olasılığına uygulanır (ne kadar açık verdiğimiz). */
  oppShotChance: number;
  /** Kendi şutlarımızın isabet ve gol kalitesi. */
  shotQuality: number;
  /** Rakip şutlarının gol olasılığına uygulanır. */
  oppShotQuality: number;
  fouls: number;
  fatigue: number;
  /** Kafa şutu payına eklenir (uzun top, kanat ortaları). */
  headerBonus: number;
  /** Şuta dönüşmeyen ataktan korner çıkma olasılığı. */
  corners: number;
}

export const NEUTRAL_EFFECTS: InstructionEffects = {
  midfield: 1, oppMidfield: 1, attackChance: 1, shotChance: 1, oppShotChance: 1,
  shotQuality: 1, oppShotQuality: 1, fouls: 1, fatigue: 1, headerBonus: 0, corners: 1,
};

/** Talimat etkisinin hesaplanmasında takımın sahadaki profili. */
export interface TeamProfile {
  /** Saha oyuncularının pas + teknik ortalaması (1–20). */
  passing: number;
  /** Defans oyuncularının hız ortalaması. */
  defencePace: number;
  /** Hücum oyuncularının hız ortalaması. */
  attackPace: number;
}

/**
 * Talimatların etkisi. Her ayarın bedeli var: hücum açar ama açık verir, pres topu kazandırır
 * ama yorar ve faul yaptırır, kısa pas iyi pasörlerle işe yarar, yüksek hat hızlı forvetlere karşı risklidir.
 */
export function instructionEffects(i: TeamInstructions, own: TeamProfile, opp: TeamProfile): InstructionEffects {
  const e = { ...NEUTRAL_EFFECTS };
  const m = i.mentality;

  // Mentalite: hücum → daha çok atak ve şut, ama rakibe daha çok alan.
  e.attackChance *= 1 + 0.15 * m;
  e.shotChance *= 1 + 0.05 * m;
  e.oppShotChance *= 1 + 0.1 * m;
  e.midfield *= 1 + 0.04 * m;
  e.fatigue *= 1 + 0.06 * m;

  // Pas tarzı: kısa pasın faydası takımın pas kalitesine bağlı.
  if (i.passing === 'short') {
    const quality = Math.max(-1, Math.min(1, (own.passing - 11) / 4));
    e.midfield *= 1.03 + 0.05 * quality;
    e.attackChance *= 0.94;
    e.shotQuality *= 1.05;
  } else if (i.passing === 'direct') {
    e.midfield *= 0.95;
    e.attackChance *= 1.1;
    e.shotQuality *= 0.94;
    e.headerBonus += 0.08;
  }

  // Tempo
  if (i.tempo === 'fast') {
    e.attackChance *= 1.1;
    e.shotQuality *= 0.96;
    e.midfield *= 0.98;
    e.fatigue *= 1.12;
  } else if (i.tempo === 'slow') {
    e.attackChance *= 0.9;
    e.shotQuality *= 1.04;
    e.midfield *= 1.02;
    e.fatigue *= 0.92;
  }

  // Pres
  if (i.pressing === 'high') {
    e.oppMidfield *= 0.93;
    e.oppShotChance *= 1.03;
    e.fouls *= 1.25;
    e.fatigue *= 1.22;
  } else if (i.pressing === 'low') {
    e.oppMidfield *= 1.04;
    e.oppShotChance *= 0.97;
    e.fouls *= 0.85;
    e.fatigue *= 0.9;
  }

  // Savunma hattı: yüksek hat hızlı rakip forvetlere karşı tehlikeli.
  if (i.defensiveLine === 'high') {
    const paceRisk = Math.max(0, Math.min(1.5, (opp.attackPace - own.defencePace) / 4 + 0.5));
    e.oppMidfield *= 0.97;
    e.attackChance *= 1.04;
    e.oppShotQuality *= 1 + 0.15 * paceRisk;
  } else if (i.defensiveLine === 'deep') {
    e.oppShotChance *= 1.06;
    e.oppShotQuality *= 0.9;
    e.attackChance *= 0.95;
  }

  // Genişlik: geniş oyun kanatlardan orta ve korner getirir ama ortada boşluk bırakır;
  // dar oyun orta sahayı kalabalıklaştırır, kanat ataklarından vazgeçer.
  if (i.width === 'wide') {
    e.attackChance *= 1.04;
    e.headerBonus += 0.05;
    e.corners *= 1.15;
    e.midfield *= 0.98;
    e.oppShotChance *= 1.03;
  } else if (i.width === 'narrow') {
    e.attackChance *= 0.95;
    e.headerBonus -= 0.04;
    e.corners *= 0.85;
    e.midfield *= 1.03;
    e.oppShotChance *= 0.98;
  }
  return e;
}

/* ------------------------------------------------------------------ */
/* Kullanıcı taktiği: kurulum ve düzenleme                              */
/* ------------------------------------------------------------------ */

export function defaultTactics(squad: readonly Player[], formation: FormationId = DEFAULT_FORMATION_ID): Tactics {
  const available = squad.filter(isAvailable);
  const lineup = assignToFormation(available, FORMATIONS[formation]);
  const xi = lineup.filter((id): id is number => id !== null);
  const xiPlayers = available.filter((p) => xi.includes(p.id));
  const ranked = (score: (p: Player) => number) =>
    [...xiPlayers].filter((p) => p.positions.GK === undefined).sort((a, b) => score(b) - score(a));
  const best = (score: (p: Player) => number) => ranked(score)[0]?.id ?? null;
  const secondBest = (score: (p: Player) => number) => ranked(score)[1]?.id ?? null;
  return {
    formation,
    lineup,
    bench: autoBench(available, new Set(xi)),
    captainId: best((p) => p.attributes.leadership * 2 + p.currentAbility / 20),
    viceCaptainId: secondBest((p) => p.attributes.leadership * 2 + p.currentAbility / 20),
    penaltyTakerId: best((p) => p.attributes.penaltyTaking),
    freeKickTakerId: best((p) => p.attributes.freeKicks),
    instructions: { ...DEFAULT_INSTRUCTIONS },
  };
}

export type SquadTarget = { kind: 'slot'; index: number } | { kind: 'bench'; index: number };

/** Oyuncunun taktikteki yeri. */
export function locate(t: Tactics, playerId: number): SquadTarget | null {
  const slot = t.lineup.indexOf(playerId);
  if (slot !== -1) return { kind: 'slot', index: slot };
  const bench = t.bench.indexOf(playerId);
  if (bench !== -1) return { kind: 'bench', index: bench };
  return null;
}

/**
 * Oyuncuyu bir mevkiye ya da yedek sırasına koyar. Hedefteki oyuncu, gelen oyuncunun
 * eski yerine geçer (takas); gelen oyuncu kadro dışından geliyorsa hedefteki kadro dışına çıkar.
 * Yeni bir taktik nesnesi döner.
 */
export function placePlayer(t: Tactics, target: SquadTarget, playerId: number): Tactics {
  const lineup = [...t.lineup];
  const bench = [...t.bench];
  const from = locate(t, playerId);
  if (from && from.kind === target.kind && from.index === target.index) return t;

  const displaced = target.kind === 'slot' ? lineup[target.index] ?? null : bench[target.index] ?? null;

  // Hedefe yerleştir
  if (target.kind === 'slot') lineup[target.index] = playerId;
  else if (target.index < bench.length) bench[target.index] = playerId;
  else if (bench.length < BENCH_SIZE) bench.push(playerId);
  else return t;

  // Eski yerine hedefteki oyuncuyu koy (ya da boşalt)
  if (from?.kind === 'slot') lineup[from.index] = displaced;
  if (from?.kind === 'bench') {
    if (displaced !== null) bench[from.index] = displaced;
    else bench.splice(from.index, 1);
  }
  return { ...t, lineup, bench };
}

/** Oyuncuyu ilk 11'den ya da yedeklerden çıkarır (kadro dışı). */
export function removePlayer(t: Tactics, playerId: number): Tactics {
  return {
    ...t,
    lineup: t.lineup.map((id) => (id === playerId ? null : id)),
    bench: t.bench.filter((id) => id !== playerId),
  };
}

/** Dizilişi değiştirir; mevcut ilk 11 yeni mevkilere en iyi uyumla dağıtılır. */
export function changeFormation(t: Tactics, formation: FormationId, squad: readonly Player[]): Tactics {
  const xi = squad.filter((p) => t.lineup.includes(p.id));
  return { ...t, formation, lineup: assignToFormation(xi, FORMATIONS[formation]) };
}

/** İlk 11 için seçili oyuncuların mevki uyumu (UI uyarıları için). */
export function lineupFits(t: Tactics, squad: readonly Player[]): (number | null)[] {
  const byId = new Map(squad.map((p) => [p.id, p]));
  return t.lineup.map((id, i) => {
    const p = id === null ? undefined : byId.get(id);
    return p ? slotFit(p, FORMATIONS[t.formation][i]!) : null;
  });
}

/**
 * Taktikten maç kadrosu: kulüpte olmayan ya da sakat oyuncular çıkarılır,
 * boş mevkiler en uygun oyuncuyla otomatik doldurulur. Yedek listesi boşsa otomatik seçilir.
 */
export function resolveLineup(t: Tactics, squad: readonly Player[]): Lineup {
  const formation = FORMATIONS[t.formation];
  const available = squad.filter(isAvailable);
  const ok = new Set(available.map((p) => p.id));
  const lineup = t.lineup.map((id) => (id !== null && ok.has(id) ? id : null));

  const used = new Set(lineup.filter((id): id is number => id !== null));
  const missing = lineup.map((id, i) => (id === null ? i : -1)).filter((i) => i !== -1);
  if (missing.length > 0) {
    const rest = available.filter((p) => !used.has(p.id) && !t.bench.includes(p.id));
    const pool = rest.length >= missing.length ? rest : available.filter((p) => !used.has(p.id));
    const fill = assignToFormation(pool, missing.map((i) => formation[i]!));
    missing.forEach((slotIndex, k) => {
      const id = fill[k] ?? null;
      if (id !== null) {
        lineup[slotIndex] = id;
        used.add(id);
      }
    });
  }

  const starters = lineup.flatMap((playerId, i) => (playerId === null ? [] : [{ playerId, slot: formation[i]! }]));
  let bench = t.bench.filter((id) => ok.has(id) && !used.has(id));
  if (bench.length === 0) bench = autoBench(available, used);
  return { starters, bench };
}
