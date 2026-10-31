/**
 * Taktikler: takım talimatları, bunların motora etkisi ve kullanıcının kadro düzeni.
 */
import { isAvailable, primaryPosition } from '../player';
import type { Player, Position } from '../types';
import {
  assignToFormation,
  autoBench,
  BENCH_SIZE,
  conditionFactor,
  DEFAULT_FORMATION_ID,
  FORMATIONS,
  moveCustomSpot,
  slotFit,
  slotsOf,
  toCustom,
  type CustomFormation,
  type Formation,
  type FormationId,
  type Lineup,
} from './formation';
import type { Mentality } from './state';

export type PassingStyle = 'short' | 'mixed' | 'direct';
export type Tempo = 'slow' | 'normal' | 'fast';
export type Pressing = 'low' | 'normal' | 'high';
export type DefensiveLine = 'deep' | 'normal' | 'high';
export type Width = 'narrow' | 'normal' | 'wide';
export type Tackling = 'easy' | 'normal' | 'hard';
export type CrossStyle = 'low' | 'mixed' | 'high';
export type Freedom = 'disciplined' | 'normal' | 'expressive';
export type CornerStyle = 'near' | 'mixed' | 'far' | 'short';
export type FreeKickStyle = 'shoot' | 'mixed' | 'cross';

export interface TeamInstructions {
  mentality: Mentality;
  passing: PassingStyle;
  tempo: Tempo;
  pressing: Pressing;
  defensiveLine: DefensiveLine;
  width: Width;
  /** Müdahale sertliği. */
  tackling: Tackling;
  /** Orta tercihi (alçak / yüksek). */
  crossing: CrossStyle;
  /** Yaratıcı özgürlük. */
  freedom: Freedom;
  /** Top kazanınca hızlı karşı atak. */
  counterAttack: boolean;
  /** Ofsayt taktiği. */
  offsideTrap: boolean;
  /** Oyunu geriden kur (defans topu kısa pasla çıkarır). */
  playOutOfDefence: boolean;
  /** Zaman geçir. */
  timeWasting: boolean;
  /** Korner: ön direk / karışık / arka direk / kısa. */
  cornerStyle: CornerStyle;
  /** Tehlikeli serbest vuruş: doğrudan kaleye / karışık / ceza sahasına orta. */
  freeKickStyle: FreeKickStyle;
}

/** Varsayılan talimatlar motorda etkisizdir (denge bunlarla ayarlı). */
export const DEFAULT_INSTRUCTIONS: TeamInstructions = {
  mentality: 0,
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'normal',
  defensiveLine: 'normal',
  width: 'normal',
  tackling: 'normal',
  crossing: 'mixed',
  freedom: 'normal',
  counterAttack: false,
  offsideTrap: false,
  playOutOfDefence: false,
  timeWasting: false,
  cornerStyle: 'mixed',
  freeKickStyle: 'mixed',
};

/* ------------------------------------------------------------------ */
/* Oyuncuya bireysel talimat                                            */
/* ------------------------------------------------------------------ */

/** Görev: geride kal (savunma) / destek / ileri çık (hücum). */
export type Duty = 'defend' | 'support' | 'attack';
/** Koşu yolu: içe kat / normal / kanada aç. */
export type Channel = 'inside' | 'normal' | 'wide';

export interface PlayerOrders {
  duty: Duty;
  channel: Channel;
  /** Uzaktan şut dene. */
  longShots: boolean;
  /** Topla sür. */
  dribble: boolean;
  /** Adamını sıkı markaja al. */
  tightMarking: boolean;
  /** Serbest rol: pozisyonunu bırakıp oyunun içinde dolaşır. */
  freeRole: boolean;
}

export const DEFAULT_ORDERS: PlayerOrders = {
  duty: 'support',
  channel: 'normal',
  longShots: false,
  dribble: false,
  tightMarking: false,
  freeRole: false,
};

export function isDefaultOrders(o: PlayerOrders | null | undefined): boolean {
  if (!o) return true;
  return (Object.keys(DEFAULT_ORDERS) as (keyof PlayerOrders)[]).every((k) => o[k] === DEFAULT_ORDERS[k]);
}

/** Taktik seti: diziliş, talimatlar ve mevkilere verilen bireysel talimatlar (kadro seçimi setler arasında ortak). */
export interface TacticPlan {
  formation: FormationId;
  custom?: CustomFormation | null;
  instructions: TeamInstructions;
  orders?: (PlayerOrders | null)[];
}

/** Kaç taktik seti (A, B, C) tutulur. */
export const PLAN_COUNT = 3;
export const PLAN_LABELS = ['A', 'B', 'C'] as const;

/** Kullanıcının kulübü için kayıtlı taktik. */
export interface Tactics {
  formation: FormationId;
  /** Kendi dizilişi: varsa hazır dizilişin (formation) yerine kullanılır. */
  custom?: CustomFormation | null;
  /** slotsOf(this)[i] mevkiindeki oyuncu (boşsa null). */
  lineup: (number | null)[];
  /** Mevki sırasına göre bireysel talimatlar (yoksa varsayılan). */
  orders?: (PlayerOrders | null)[];
  bench: number[];
  captainId: number | null;
  /** Kaptan sahada değilse liderlik etkisini yardımcı kaptan verir. */
  viceCaptainId: number | null;
  penaltyTakerId: number | null;
  freeKickTakerId: number | null;
  /** Kornerleri kullanan (yoksa orta becerisi en iyi olan). */
  cornerTakerId?: number | null;
  /** Duran toplarda kafa için hedef oyuncu (yoksa uzun boylular). */
  targetManId?: number | null;
  instructions: TeamInstructions;
  /** Taktik setleri; etkin setin güncel hâli üstteki alanlardadır, buradaki kopyası set değişince yazılır. */
  plans?: (TacticPlan | null)[];
  /** Etkin set (0 = A). */
  activePlan?: number;
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
  /** Rakibin atak kurma olasılığına uygulanır (zaman geçirme). */
  oppAttackChance: number;
}

export const NEUTRAL_EFFECTS: InstructionEffects = {
  midfield: 1, oppMidfield: 1, attackChance: 1, shotChance: 1, oppShotChance: 1,
  shotQuality: 1, oppShotQuality: 1, fouls: 1, fatigue: 1, headerBonus: 0, corners: 1, oppAttackChance: 1,
};

/** Talimat etkisinin hesaplanmasında takımın sahadaki profili. */
export interface TeamProfile {
  /** Saha oyuncularının pas + teknik ortalaması (1–20). */
  passing: number;
  /** Defans oyuncularının hız ortalaması. */
  defencePace: number;
  /** Hücum oyuncularının hız ortalaması. */
  attackPace: number;
  /** Hücum oyuncularının hava topu (kafa + sıçrama) ortalaması. */
  attackAerial: number;
  /** Saha oyuncularının yaratıcılık + yetenek (flair) ortalaması. */
  creativity: number;
  /** Defans oyuncularının pas + soğukkanlılık ortalaması (geriden oyun kurma). */
  defencePassing: number;
  /** Defans oyuncularının konsantrasyon + önsezi ortalaması (ofsayt taktiği). */
  defenceAwareness: number;
  /** Sıkı markaj talimatı verilen oyuncu sayısı. */
  tightMarkers: number;
}

/** Profilin 1–20 değerini −1…1 aralığında kaliteye çevirir (11 ortalama). */
const quality = (v: number, spread = 4) => Math.max(-1, Math.min(1, (v - 11) / spread));

/**
 * Talimatların etkisi. Her ayarın bedeli var: hücum açar ama açık verir, pres topu kazandırır
 * ama yorar ve faul yaptırır, kısa pas iyi pasörlerle işe yarar, yüksek hat hızlı forvetlere karşı risklidir.
 */
export function instructionEffects(
  i: TeamInstructions,
  own: TeamProfile,
  opp: TeamProfile,
  oppI: TeamInstructions = DEFAULT_INSTRUCTIONS,
): InstructionEffects {
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

  // Müdahale sertliği: sert oyun topu kazandırır ama faul ve kart getirir; yumuşak oyun rakibi rahat bırakır.
  if (i.tackling === 'hard') {
    e.oppMidfield *= 0.97;
    e.fouls *= 1.3;
  } else if (i.tackling === 'easy') {
    e.oppMidfield *= 1.03;
    e.oppShotChance *= 1.02;
    e.fouls *= 0.75;
  }

  // Orta tercihi: yüksek orta hava toplarında iyi forvetlerle işe yarar, alçak orta yerden bitirişe dönük.
  if (i.crossing === 'high') {
    e.headerBonus += 0.06;
    e.shotQuality *= 0.98 + 0.05 * quality(own.attackAerial);
  } else if (i.crossing === 'low') {
    e.headerBonus -= 0.05;
    e.shotQuality *= 1.01;
  }

  // Yaratıcı özgürlük: yaratıcı oyuncularla daha kaliteli pozisyon, ama takım şekli bozulur.
  if (i.freedom === 'expressive') {
    e.shotQuality *= 1.01 + 0.04 * quality(own.creativity);
    e.attackChance *= 1.03;
    e.oppShotChance *= 1.04;
  } else if (i.freedom === 'disciplined') {
    e.shotQuality *= 0.97;
    e.attackChance *= 0.98;
    e.oppShotChance *= 0.96;
  }

  // Karşı atak: topu rakibe bırakır, kazanınca hızlı çıkar; hızlı forvetlerle ve hücuma kalkan rakibe karşı etkili.
  if (i.counterAttack) {
    e.midfield *= 0.97;
    e.attackChance *= 0.95;
    e.shotChance *= 1.06 + 0.03 * Math.max(0, oppI.mentality) + 0.03 * quality(own.attackPace);
    e.oppShotChance *= 0.98;
  }

  // Ofsayt taktiği: rakibi pozisyondan düşürür; dikkatsiz defansla ve hızlı forvete karşı arkaya kaçırır.
  if (i.offsideTrap) {
    const risk = Math.max(0, Math.min(1.5, (opp.attackPace - own.defenceAwareness) / 4 + 0.5));
    e.oppShotChance *= i.defensiveLine === 'deep' ? 0.98 : 0.93;
    e.oppShotQuality *= 1 + 0.1 * risk;
  }

  // Oyunu geriden kurma: iyi pasör defansla topu tutar; rakip yoğun pres yaparsa kendi yarı sahamızda top kaybı.
  if (i.playOutOfDefence) {
    const q = quality(own.defencePassing);
    e.midfield *= 1.02 + 0.03 * q;
    e.oppShotChance *= 1.03 - 0.02 * q + (oppI.pressing === 'high' ? 0.03 : 0);
  }

  // Zaman geçirme: oyunu yavaşlatır (iki taraf da daha az atak kurar).
  if (i.timeWasting) {
    e.attackChance *= 0.9;
    e.oppAttackChance *= 0.94;
    e.fatigue *= 0.95;
  }

  // Bireysel sıkı markaj fauli artırır
  e.fouls *= 1 + 0.04 * own.tightMarkers;
  return e;
}

/* ------------------------------------------------------------------ */
/* Bireysel talimatların etkisi                                         */
/* ------------------------------------------------------------------ */

/** Oyuncunun hücum / orta saha / savunma katkısına bireysel talimat çarpanları. */
export function orderWeights(o: PlayerOrders | undefined, dribbling: number): { att: number; mid: number; def: number } {
  if (!o) return { att: 1, mid: 1, def: 1 };
  let att = 1;
  let mid = 1;
  let def = 1;
  if (o.duty === 'attack') {
    att *= 1.18;
    def *= 0.78;
  } else if (o.duty === 'defend') {
    att *= 0.75;
    def *= 1.18;
  }
  if (o.freeRole) {
    att *= 1.07;
    mid *= 1.04;
    def *= 0.82;
  }
  if (o.dribble) {
    // İyi top süren oyuncu fark yaratır, kötüsü top kaybeder
    att *= dribbling >= 13 ? 1.05 : 0.98;
    mid *= 0.97;
  }
  if (o.tightMarking) def *= 1.06;
  return { att, mid, def };
}

/** Şutu çeken oyuncunun seçilme ağırlığına bireysel talimat çarpanı (geniş mevkide içe katma şut arar). */
export function orderShooting(o: PlayerOrders | undefined, wide: boolean): number {
  if (!o) return 1;
  let w = o.duty === 'attack' ? 1.35 : o.duty === 'defend' ? 0.5 : 1;
  if (o.longShots) w *= 1.25;
  if (o.channel === 'inside' && wide) w *= 1.2;
  if (o.freeRole) w *= 1.1;
  return w;
}

/** Asist yapan oyuncunun seçilme ağırlığına çarpan (kanada açılan ve serbest rol daha çok pas verir). */
export function orderCreating(o: PlayerOrders | undefined, wide: boolean): number {
  if (!o) return 1;
  let w = 1;
  if (o.channel === 'wide' && wide) w *= 1.2;
  if (o.channel === 'inside' && wide) w *= 0.9;
  if (o.freeRole) w *= 1.3;
  if (o.dribble) w *= 1.1;
  return w;
}

/* ------------------------------------------------------------------ */
/* Kullanıcı taktiği: kurulum ve düzenleme                              */
/* ------------------------------------------------------------------ */

/** Dizilişin mevkilerine en iyi 11, yedekler ve 11 içinden kaptanlar / vurucular. */
function autoSquad(squad: readonly Player[], slots: Formation) {
  const available = squad.filter(isAvailable);
  const lineup = assignToFormation(available, slots);
  const xi = lineup.filter((id): id is number => id !== null);
  const xiPlayers = available.filter((p) => xi.includes(p.id));
  const ranked = (score: (p: Player) => number) =>
    [...xiPlayers].filter((p) => p.positions.GK === undefined).sort((a, b) => score(b) - score(a));
  const best = (score: (p: Player) => number) => ranked(score)[0]?.id ?? null;
  const secondBest = (score: (p: Player) => number) => ranked(score)[1]?.id ?? null;
  return {
    lineup,
    bench: autoBench(available, new Set(xi)),
    captainId: best((p) => p.attributes.leadership * 2 + p.currentAbility / 20),
    viceCaptainId: secondBest((p) => p.attributes.leadership * 2 + p.currentAbility / 20),
    penaltyTakerId: best((p) => p.attributes.penaltyTaking),
    freeKickTakerId: best((p) => p.attributes.freeKicks),
  };
}

export function defaultTactics(squad: readonly Player[], formation: FormationId = DEFAULT_FORMATION_ID): Tactics {
  return { formation, ...autoSquad(squad, FORMATIONS[formation]), instructions: { ...DEFAULT_INSTRUCTIONS } };
}

/**
 * Geçerli diziliş (özel diziliş dahil) için en iyi 11 ve yedekler; penaltı ve serbest vuruşçu yeniden seçilir.
 * Talimatlar, kaptanlar, diğer duran top seçimleri ve taktik setleri korunur.
 */
export function autoPick(t: Tactics, squad: readonly Player[]): Tactics {
  const auto = autoSquad(squad, slotsOf(t));
  return { ...t, lineup: auto.lineup, bench: auto.bench, penaltyTakerId: auto.penaltyTakerId, freeKickTakerId: auto.freeKickTakerId };
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

/**
 * Bireysel talimatları yeni dizilişe taşır: aynı mevkideki talimat (sırayla) yeni mevkiye geçer.
 * Varsayılan talimatlar listede tutulmaz (dizinin tamamı varsayılansa boş dizi).
 */
export function carryOrders(fromSlots: Formation, orders: readonly (PlayerOrders | null)[] | undefined, toSlots: Formation): (PlayerOrders | null)[] {
  if (!orders || orders.every((o) => isDefaultOrders(o))) return [];
  const used = new Set<number>();
  return toSlots.map((pos) => {
    const i = fromSlots.findIndex((p, k) => p === pos && !used.has(k));
    if (i === -1) return null;
    used.add(i);
    return isDefaultOrders(orders[i]) ? null : orders[i]!;
  });
}

/** Dizilişi değiştirir (özel diziliş bırakılır); mevcut ilk 11 yeni mevkilere en iyi uyumla dağıtılır. */
export function changeFormation(t: Tactics, formation: FormationId, squad: readonly Player[]): Tactics {
  const xi = squad.filter((p) => t.lineup.includes(p.id));
  const slots = FORMATIONS[formation];
  return { ...t, formation, custom: null, lineup: assignToFormation(xi, slots), orders: carryOrders(slotsOf(t), t.orders, slots) };
}

/**
 * Özel dizilişte bir yeri taşır (özel diziliş yoksa geçerli dizilişten oluşturulur).
 * Yerdeki oyuncu ve bireysel talimatı yerinde kalır; mevki konumdan çıkar.
 */
export function moveFormationSpot(t: Tactics, index: number, x: number, y: number): Tactics {
  const custom = moveCustomSpot(t.custom ?? toCustom(t), index, x, y);
  return { ...t, custom };
}

/** Bir mevkinin bireysel talimatını değiştirir. */
export function setSlotOrders(t: Tactics, index: number, change: Partial<PlayerOrders>): Tactics {
  const orders = [...(t.orders ?? [])];
  while (orders.length < slotsOf(t).length) orders.push(null);
  const next = { ...DEFAULT_ORDERS, ...(orders[index] ?? {}), ...change };
  orders[index] = isDefaultOrders(next) ? null : next;
  return { ...t, orders: orders.every((o) => o === null) ? [] : orders };
}

export function slotOrders(t: Pick<Tactics, 'orders'>, index: number): PlayerOrders {
  return t.orders?.[index] ?? DEFAULT_ORDERS;
}

/** Taktiğin etkin set olarak kopyası. */
function planOf(t: Tactics): TacticPlan {
  return {
    formation: t.formation,
    ...(t.custom ? { custom: t.custom } : {}),
    instructions: { ...t.instructions },
    ...(t.orders && t.orders.length > 0 ? { orders: [...t.orders] } : {}),
  };
}

/** Setin kaydı (boş set, etkin taktiğin kopyası sayılır). */
export function tacticPlan(t: Tactics, index: number): TacticPlan {
  const active = t.activePlan ?? 0;
  if (index === active) return planOf(t);
  return t.plans?.[index] ?? planOf(t);
}

/**
 * Etkin taktik setini değiştirir: şimdiki set kaydedilir, seçilen setin dizilişi, talimatları ve bireysel
 * talimatları yüklenir. İlk 11 aynı kalır, oyuncular yeni dizilişin mevkilerine en iyi uyumla dağıtılır.
 */
export function switchPlan(t: Tactics, index: number, squad: readonly Player[]): Tactics {
  const active = t.activePlan ?? 0;
  if (index === active || index < 0 || index >= PLAN_COUNT) return t;
  const plans: (TacticPlan | null)[] = Array.from({ length: PLAN_COUNT }, (_, i) => t.plans?.[i] ?? null);
  plans[active] = planOf(t);
  const next = plans[index] ?? planOf(t);
  const fromSlots = slotsOf(t);
  const toSlots = slotsOf(next);
  const same = fromSlots.length === toSlots.length && fromSlots.every((p, i) => p === toSlots[i]);
  const xi = squad.filter((p) => t.lineup.includes(p.id));
  return {
    ...t,
    formation: next.formation,
    custom: next.custom ?? null,
    instructions: { ...DEFAULT_INSTRUCTIONS, ...next.instructions },
    orders: next.orders ? [...next.orders] : [],
    lineup: same ? t.lineup : assignToFormation(xi, toSlots),
    plans,
    activePlan: index,
  };
}

/** Setin dizilişi, talimatları ve bireysel talimatlarını başka bir sete kopyalar. */
export function copyPlan(t: Tactics, from: number, to: number): Tactics {
  if (from === to) return t;
  const plans: (TacticPlan | null)[] = Array.from({ length: PLAN_COUNT }, (_, i) => t.plans?.[i] ?? null);
  const source = tacticPlan(t, from);
  plans[to] = source;
  if (to !== (t.activePlan ?? 0)) return { ...t, plans };
  return {
    ...t,
    plans,
    formation: source.formation,
    custom: source.custom ?? null,
    instructions: { ...source.instructions },
    orders: source.orders ? [...source.orders] : [],
  };
}

/** İlk 11 için seçili oyuncuların mevki uyumu (UI uyarıları için). */
export function lineupFits(t: Tactics, squad: readonly Player[]): (number | null)[] {
  const byId = new Map(squad.map((p) => [p.id, p]));
  const slots = slotsOf(t);
  return t.lineup.map((id, i) => {
    const p = id === null ? undefined : byId.get(id);
    return p && slots[i] ? slotFit(p, slots[i]) : null;
  });
}

/** Boşalan mevkiye aday puanı: mevki uyumu karesiyle ağır basar (bilmediği mevkideki iyi oyuncu o mevkinin oyuncusunu geçmesin). */
const fillScore = (p: Player, slot: Position) => p.currentAbility * slotFit(p, slot) ** 2 * conditionFactor(p.condition);

/**
 * Taktikten maç kadrosu: kulüpte olmayan ya da sakat / cezalı oyuncular çıkarılır. Boş mevkiye önce yedeklerden o mevkiyi
 * bilen en iyisi, yoksa bütün kadrodan en uygunu girer. Yedek listesi boşsa otomatik seçilir, eksildiyse kalanlardan tamamlanır.
 */
export function resolveLineup(t: Tactics, squad: readonly Player[]): Lineup {
  const formation = slotsOf(t);
  const available = squad.filter(isAvailable);
  const ok = new Set(available.map((p) => p.id));
  const lineup = t.lineup.map((id) => (id !== null && ok.has(id) ? id : null));

  const used = new Set(lineup.filter((id): id is number => id !== null));
  lineup.forEach((id, i) => {
    if (id !== null) return;
    const slot = formation[i]!;
    const free = available.filter((p) => !used.has(p.id));
    const bench = free.filter((p) => t.bench.includes(p.id) && p.positions[slot] !== undefined);
    const best = (bench.length > 0 ? bench : free).reduce<Player | null>(
      (a, p) => (a === null || fillScore(p, slot) > fillScore(a, slot) ? p : a),
      null,
    );
    if (best) {
      lineup[i] = best.id;
      used.add(best.id);
    }
  });

  const starters = lineup.flatMap((playerId, i) => {
    if (playerId === null) return [];
    const orders = t.orders?.[i];
    return [isDefaultOrders(orders) ? { playerId, slot: formation[i]! } : { playerId, slot: formation[i]!, orders: orders! }];
  });
  let bench = t.bench.filter((id) => ok.has(id) && !used.has(id));
  if (bench.length === 0) bench = autoBench(available, used);
  else if (bench.length < t.bench.length) {
    // İlk 11'e giren ya da sakatlanan yedeğin yeri kalanlardan dolar (yedek kaleci yoksa önce kaleci, varsa ikincisi alınmaz)
    const keeper = (id: number) => primaryPosition(available.find((p) => p.id === id)!) === 'GK';
    const hasKeeper = bench.some(keeper);
    const extra = autoBench(available, new Set([...used, ...bench])).filter((id) => !hasKeeper || !keeper(id));
    bench = [...bench, ...extra].slice(0, t.bench.length);
  }
  return { starters, bench };
}
