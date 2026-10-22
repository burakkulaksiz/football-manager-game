/**
 * Oyuncu görüşmeleri.
 *
 * Oyuncunun talepleri (haftalık kontrol; yanıt için 7 gün, yanıtsız kalırsa moral düşer):
 * - Forma şansı: morali 30'un altındaki sağlam oyuncu.
 * - Sözleşme: ilk 11 seviyesindeki oyuncunun sözleşmesi bitiyor (ekimden itibaren) ya da maaşı talebinin çok altında.
 * - Ayrılmak: 30 günden uzun süredir mutsuz (moral < 25) oyuncu.
 *
 * Menajerin başlattığı görüşmeler (oyuncu başına 14 günde bir): övgü, eleştiri, moral desteği, forma şansı sözü.
 * Sonuç son maç puanlarına (form) ve profesyonelliğe bağlıdır.
 *
 * Forma şansı sözü: oyuncunun oynayabildiği sonraki 5 maçın en az 3'ünde ilk 11. Tutulursa moral artar,
 * tutulmazsa sert düşer ve oyuncu mutsuz sayılmaya başlar (ayrılmak isteyebilir).
 */
import { addDays, makeDate, type GameDate } from '../date';
import { clubPlayers } from '../generation/worldGenerator';
import { addNews } from '../news';
import { isAvailable } from '../player';
import { listPlayer } from '../transfer/listing';
import { wageDemand } from '../transfer/market';
import type { Fixture, GameWorld, MatchResult, Player, PlayerRequest, RequestTopic } from '../types';

export const REQUEST_RESPONSE_DAYS = 7;
/** Aynı oyuncudan yeni talep için en az bu kadar gün geçmeli. */
const REQUEST_COOLDOWN_DAYS = 45;
export const TALK_COOLDOWN_DAYS = 14;
export const PROMISE_MATCHES = 5;
export const PROMISE_STARTS = 3;
const PLAYING_TIME_MORALE = 30;
const UNHAPPY_MORALE = 25;
const RECOVERED_MORALE = 35;
const UNHAPPY_DAYS_TO_LEAVE = 30;
/** Maaşı talebinin bu oranından azsa sözleşme ister. */
const UNDERPAID_RATIO = 0.6;
const KEY_PLAYERS = 11;
/** Haftada en fazla bu kadar yeni talep. */
export const REQUESTS_PER_WEEK = 1;

export type TalkTopic = 'praise' | 'criticize' | 'encourage' | 'promise';
export type TalkReaction = 'positive' | 'neutral' | 'negative';

export type RequestAnswer =
  | 'promise' // forma şansı: söz ver
  | 'compete' // forma şansı: yerini kazanmalı
  | 'loanList' // forma şansı: kiralık listesine koy
  | 'negotiate' // sözleşme: görüşelim
  | 'later' // sözleşme: şimdi değil
  | 'refuse' // sözleşme / ayrılık: hayır
  | 'transferList'; // ayrılık: transfer listesine koy

export const REQUEST_ANSWERS: Record<RequestTopic, readonly RequestAnswer[]> = {
  playingTime: ['promise', 'compete', 'loanList'],
  contract: ['negotiate', 'later', 'refuse'],
  transfer: ['transferList', 'refuse'],
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

/** Son maç puanlarının ortalaması (oynamadıysa null). */
export function recentForm(p: Player): number | null {
  return p.form.length === 0 ? null : p.form.reduce((a, b) => a + b, 0) / p.form.length;
}

export function openRequest(world: GameWorld, playerId: number): PlayerRequest | undefined {
  return world.requests.find((r) => r.playerId === playerId);
}

export function activePromise(world: GameWorld, playerId: number) {
  return world.promises.find((pr) => pr.playerId === playerId);
}

/** Menajer bu oyuncuyla ne zaman yeniden görüşebilir (şimdi görüşebiliyorsa null). */
export function nextTalkDate(world: GameWorld, p: Player): GameDate | null {
  if (!p.lastTalk) return null;
  const next = addDays(p.lastTalk, TALK_COOLDOWN_DAYS);
  return next > world.date ? next : null;
}

/** Forma şansı sözü (görüşmede ya da sözleşmedeki "önemli oyuncu" rolüyle); önceki söz yerine geçer. */
export function promisePlayingTime(world: GameWorld, p: Player): void {
  makePromise(world, p);
}

function makePromise(world: GameWorld, p: Player): void {
  world.promises = world.promises.filter((pr) => pr.playerId !== p.id);
  world.promises.push({ playerId: p.id, made: world.date, matches: 0, starts: 0 });
}

/* ------------------------------------------------------------------ */
/* Oyuncunun talepleri                                                  */
/* ------------------------------------------------------------------ */

function raiseRequest(world: GameWorld, p: Player, topic: RequestTopic): void {
  p.lastComplaint = world.date;
  world.requests.push({ id: world.nextRequestId++, playerId: p.id, topic, created: world.date, respondBy: addDays(world.date, REQUEST_RESPONSE_DAYS) });
  const titles: Record<RequestTopic, string> = {
    playingTime: `${fullName(p)} forma şansı istiyor`,
    contract: `${fullName(p)} yeni sözleşme istiyor`,
    transfer: `${fullName(p)} ayrılmak istiyor`,
  };
  const bodies: Record<RequestTopic, string> = {
    playingTime: `${fullName(p)} yeterince forma şansı bulamadığını düşünüyor ve seninle görüşmek istiyor.`,
    contract: `${fullName(p)} geleceğini netleştirmek için yeni bir sözleşme konuşmak istiyor.`,
    transfer: `Uzun süredir mutsuz olan ${fullName(p)} kulüpten ayrılmak istediğini söyledi.`,
  };
  addNews(world, {
    category: 'player',
    title: titles[topic],
    body: `${bodies[topic]} Yanıt vermek için ${REQUEST_RESPONSE_DAYS} günün var (oyuncu profilinden). Yanıtsız kalırsa morali bozulur.`,
    important: true,
    playerId: p.id,
    clubId: world.playerClubId,
  });
}

/**
 * Haftalık (pazartesi): kullanıcının oyuncularından talepler. Oyuncu başına aynı anda tek açık talep,
 * talepler arası en az 45 gün. Uzun süren mutsuzluk da burada izlenir.
 */
export function playerRequests(world: GameWorld): void {
  const user = world.playerClubId;
  const squad = clubPlayers(world, user);
  const key = new Set([...squad].sort((a, b) => b.currentAbility - a.currentAbility).slice(0, KEY_PLAYERS).map((p) => p.id));
  const seasonEnd = makeDate(world.season.year + 1, 6, 30);
  const contractSeason = world.date >= makeDate(world.season.year, 10, 1);

  const candidates: { p: Player; topic: RequestTopic }[] = [];
  for (const p of squad) {
    // Mutsuzluk süresi
    if (p.morale < UNHAPPY_MORALE) p.unhappySince ??= world.date;
    else if (p.morale >= RECOVERED_MORALE) delete p.unhappySince;

    if (openRequest(world, p.id)) continue;
    if (p.lastComplaint && addDays(p.lastComplaint, REQUEST_COOLDOWN_DAYS) > world.date) continue;

    const ownPlayer = !p.loan;
    if (ownPlayer && p.listing?.kind !== 'transfer' && p.unhappySince && addDays(p.unhappySince, UNHAPPY_DAYS_TO_LEAVE) <= world.date) {
      candidates.push({ p, topic: 'transfer' });
    } else if (p.morale < PLAYING_TIME_MORALE && isAvailable(p) && !activePromise(world, p.id)) {
      candidates.push({ p, topic: 'playingTime' });
    } else if (ownPlayer && key.has(p.id) && !p.listing) {
      const expiring = contractSeason && p.contract.expires <= seasonEnd;
      const underpaid = p.contract.wage < wageDemand(world, p, user) * UNDERPAID_RATIO;
      if (expiring || underpaid) candidates.push({ p, topic: 'contract' });
    }
  }
  // Gelen kutusu dolmasın: haftada en fazla bir yeni talep (ayrılık > forma şansı > sözleşme; aynı türde en iyi oyuncu)
  const priority: Record<RequestTopic, number> = { transfer: 0, playingTime: 1, contract: 2 };
  candidates.sort((a, b) => priority[a.topic] - priority[b.topic] || b.p.currentAbility - a.p.currentAbility);
  for (const c of candidates.slice(0, REQUESTS_PER_WEEK)) raiseRequest(world, c.p, c.topic);
}

/**
 * Talebe yanıt. Sonuç: moral değişimi ve (forma sözü / listeye koyma gibi) etkiler.
 * Hata ya da geçersiz yanıt için açıklama döner.
 */
export function respondToRequest(world: GameWorld, requestId: number, answer: RequestAnswer): { error?: string; delta: number } {
  const request = world.requests.find((r) => r.id === requestId);
  if (!request) return { error: 'Yanıt verilecek bir talep yok.', delta: 0 };
  if (!REQUEST_ANSWERS[request.topic].includes(answer)) return { error: 'Bu talebe bu yanıt verilemez.', delta: 0 };
  const p = world.players[request.playerId]!;
  const before = p.morale;
  const pro = p.hidden.professionalism;

  switch (answer) {
    case 'promise':
      makePromise(world, p);
      p.morale = clamp(p.morale + 12);
      break;
    case 'compete':
      // Profesyonel oyuncu rekabeti kabullenir
      p.morale = clamp(p.morale + (pro >= 14 ? 3 : -6));
      break;
    case 'loanList': {
      const err = listPlayer(world, p, 'loan', null);
      if (err) return { error: err, delta: 0 };
      p.morale = clamp(p.morale + 6);
      break;
    }
    case 'negotiate':
      p.morale = clamp(p.morale + 4);
      break;
    case 'later':
      p.morale = clamp(p.morale - 8);
      break;
    case 'refuse':
      p.morale = clamp(p.morale - (request.topic === 'transfer' ? 15 : 12));
      break;
    case 'transferList': {
      // Ayrılmak isteyen oyuncu: listeye konmak onu sevindirir (normal liste moral kaybı yok)
      const morale = p.morale;
      const err = listPlayer(world, p, 'transfer', null);
      if (err) return { error: err, delta: 0 };
      p.morale = clamp(morale + 10);
      delete p.unhappySince;
      break;
    }
  }
  world.requests = world.requests.filter((r) => r.id !== requestId);
  return { delta: p.morale - before };
}

/** Her gün: süresi dolan, yanıtsız talepler (oyuncu görmezden gelindiğini düşünür). Kulüpten ayrılanların talepleri düşer. */
export function expireRequests(world: GameWorld): void {
  const user = world.playerClubId;
  world.requests = world.requests.filter((r) => {
    const p = world.players[r.playerId];
    if (!p || p.clubId !== user) return false;
    if (r.respondBy > world.date) return true;
    p.morale = clamp(p.morale - 8);
    addNews(world, {
      category: 'player',
      title: `${fullName(p)} görmezden gelindiğini düşünüyor`,
      body: `${fullName(p)}, görüşme talebine yanıt vermediğin için kırgın.`,
      important: false,
      playerId: p.id,
      clubId: user,
    });
    return false;
  });
  world.promises = world.promises.filter((pr) => world.players[pr.playerId]?.clubId === user);
}

/* ------------------------------------------------------------------ */
/* Menajerin başlattığı görüşmeler                                      */
/* ------------------------------------------------------------------ */

/**
 * Menajer oyuncuyla konuşur. Övgü formu iyiyse sevindirir, kötüyse ters teper; eleştiri formu kötü ve
 * profesyonel oyuncuda iyi karşılanır; moral desteği mutsuz oyuncuya iyi gelir; forma sözü takip edilir.
 */
export function talkToPlayer(world: GameWorld, playerId: number, topic: TalkTopic): { error?: string; reaction: TalkReaction; delta: number } {
  const p = world.players[playerId];
  if (!p || p.clubId !== world.playerClubId) return { error: 'Yalnızca kendi oyuncunla görüşebilirsin.', reaction: 'neutral', delta: 0 };
  if (nextTalkDate(world, p)) return { error: 'Bu oyuncuyla yakın zamanda görüştün.', reaction: 'neutral', delta: 0 };
  if (topic === 'promise' && activePromise(world, p.id)) return { error: 'Bu oyuncuya zaten forma sözü verdin.', reaction: 'neutral', delta: 0 };

  const form = recentForm(p);
  const pro = p.hidden.professionalism;
  let delta = 0;
  switch (topic) {
    case 'praise':
      delta = form === null ? 1 : form >= 7 ? 8 : form >= 6.5 ? 4 : -3;
      break;
    case 'criticize':
      if (form !== null && form >= 7) delta = -12; // haksız eleştiri
      else delta = pro >= 14 ? -2 : pro < 10 ? -10 : -5;
      break;
    case 'encourage':
      delta = p.morale < 50 ? 6 : 2;
      break;
    case 'promise':
      makePromise(world, p);
      delta = 10;
      break;
  }
  p.morale = clamp(p.morale + delta);
  p.lastTalk = world.date;
  const reaction: TalkReaction = delta >= 4 ? 'positive' : delta <= -4 ? 'negative' : 'neutral';
  return { reaction, delta };
}

/* ------------------------------------------------------------------ */
/* Forma sözünün takibi                                                 */
/* ------------------------------------------------------------------ */

/** Maçımızdan sonra: söz verilen oyuncu oynayabiliyorsa maç sayılır; ilk 11'deyse başlangıç. */
export function trackPromises(world: GameWorld, fixture: Fixture, result: MatchResult): void {
  const user = world.playerClubId;
  if (fixture.homeId !== user && fixture.awayId !== user) return;
  const started = new Set(result.players.filter((r) => r.clubId === user && r.started).map((r) => r.playerId));
  for (const pr of [...world.promises]) {
    const p = world.players[pr.playerId];
    if (!p || p.clubId !== user) continue;
    // Sakat / cezalıyken oynanan maç sözü etkilemez (maç kadrosu kurulduktan sonra sakatlanmışsa da başladı sayılır)
    if (!started.has(p.id) && !isAvailable(p)) continue;
    pr.matches++;
    if (started.has(p.id)) pr.starts++;
    if (pr.matches < PROMISE_MATCHES) continue;
    world.promises = world.promises.filter((x) => x !== pr);
    const kept = pr.starts >= PROMISE_STARTS;
    p.morale = clamp(p.morale + (kept ? 8 : -20));
    if (!kept) p.unhappySince ??= world.date;
    addNews(world, {
      category: 'player',
      title: kept ? `${fullName(p)} sözünü tuttuğun için memnun` : `${fullName(p)}: söz tutulmadı`,
      body: kept
        ? `Forma şansı sözünü tuttun: ${fullName(p)} son ${PROMISE_MATCHES} maçın ${pr.starts}'inde ilk 11'deydi.`
        : `${fullName(p)}, verdiğin forma şansı sözünün tutulmadığını düşünüyor (son ${PROMISE_MATCHES} maçta ${pr.starts} kez ilk 11). Morali çok bozuldu.`,
      important: !kept,
      playerId: p.id,
      clubId: user,
    });
  }
}

/** Sözün tutulması zorlaştı mı: kalan maçların hepsinde başlaması gerekiyor. */
export function promiseAtRisk(pr: { matches: number; starts: number }): boolean {
  return PROMISE_STARTS - pr.starts >= PROMISE_MATCHES - pr.matches;
}
