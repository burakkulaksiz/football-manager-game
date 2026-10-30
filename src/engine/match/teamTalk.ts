import { displayMinute, type MatchState, type Side, type TeamTalk } from './state';
import type { PlayerLookup } from './engine';

export const TEAM_TALKS: readonly TeamTalk[] = ['praise', 'demand', 'calm', 'angry'];

/**
 * Konuşmanın bir oyuncuya etkisi: günlük forma eklenen fark (verim çarpanı; ±0,04 civarı).
 * `diff`: takım açısından skor farkı (rövanşta toplam), `professionalism`: gizli özellik 1–20.
 * Doğru konuşma işe yarar, durumu okumayan konuşma geri teper.
 */
export function talkEffect(talk: TeamTalk, diff: number, professionalism: number): number {
  switch (talk) {
    // Öndeyken hak edilmiş övgü; gerideyken rehavet
    case 'praise':
      return diff > 0 ? 0.03 : diff === 0 ? 0.01 : -0.02;
    // Yakın skorda kamçı; öndeyken etkisiz, maç kopmuşsa baskı
    case 'demand':
      return diff > 0 ? 0 : diff === 0 ? 0.02 : diff >= -2 ? 0.03 : -0.01;
    // Öndeyken odak, ağır gerideyken baskıyı alır, 1 golde gevşetir
    case 'calm':
      return diff > 0 ? 0.02 : diff === 0 ? 0.01 : diff === -1 ? 0 : 0.02;
    // Sert çıkış: profesyonel oyuncuyu gerideyken ateşler, diğerlerini kırar
    case 'angry':
      if (diff < 0) return professionalism >= 14 ? 0.04 : professionalism < 10 ? -0.03 : 0.01;
      return professionalism >= 14 ? 0 : -0.03;
  }
}

const TALK_TEXTS: Record<TeamTalk, string> = {
  praise: 'oyuncularını övdü',
  demand: 'oyuncularından daha fazlasını istedi',
  calm: 'oyuncularını sakinleştirdi',
  angry: 'soyunma odasında sert çıktı',
};

/** Günlük form sınırı (maç kurulurken ±0,12; konuşma biraz aşabilir). */
const DAY_FORM_LIMIT = 0.15;
/** Günlük form farkının kalıcı morale çevrimi (0,03 → +6). */
const MORALE_PER_FORM = 200;

/**
 * Devre arası konuşması: sahadaki ve yedekteki oyuncuların günlük formu (ikinci yarı verimi) ve morali değişir.
 * Yalnızca devre arasında ve bir kez; rastgelelik kullanmaz (maçın akışı kaymaz). Başarısızsa false.
 * Moral oyuncunun kendisinde (`lookup` = dünyanın oyuncuları) yerinde değişir.
 */
export function giveTeamTalk(state: MatchState, lookup: PlayerLookup, side: Side, talk: TeamTalk): boolean {
  const team = state[side];
  if (state.period !== 'half' || team.talk) return false;
  const other: Side = side === 'home' ? 'away' : 'home';
  const agg = state.aggregate ?? { home: 0, away: 0 };
  const diff = state.score[side] + agg[side] - (state.score[other] + agg[other]);
  for (const id of [...team.onPitch, ...team.bench]) {
    const ps = state.players[id];
    const p = lookup[id];
    if (!ps || !p) continue;
    const e = talkEffect(talk, diff, p.hidden.professionalism);
    ps.dayForm = Math.max(-DAY_FORM_LIMIT, Math.min(DAY_FORM_LIMIT, ps.dayForm + e));
    p.morale = Math.max(0, Math.min(100, p.morale + Math.round(e * MORALE_PER_FORM)));
  }
  team.talk = talk;
  const { minute, extra } = displayMinute(state);
  state.events.push({ minute, extra, type: 'info', side, text: `Devre arası: ${team.name} teknik direktörü ${TALK_TEXTS[talk]}.` });
  return true;
}
