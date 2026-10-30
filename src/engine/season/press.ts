/**
 * Basın toplantısı ve medya: kullanıcının her maçından sonra (isteğe bağlı, Devam'ı engellemez) sonuca göre bir soru.
 * Cevap kadro moralini, taraftarı ve yönetimin güvenini etkiler; sözler medyada manşet olur. Sonraki maçta toplantı düşer.
 * Rastgelelik yok.
 */
import { clubPlayers, getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import type { Fixture, GameWorld } from '../types';
import { changeFans } from './fans';

export type PressTone = 'win' | 'draw' | 'loss';

export interface PressConference {
  fixtureId: number;
  tone: PressTone;
}

export interface PressAnswer {
  text: string;
  /** Medyadaki manşet ({club}: kulüp adı). */
  headline: string;
  /** Kadrodaki herkesin moraline. */
  morale: number;
  fans: number;
  board: number;
}

export const PRESS_QUESTIONS: Record<PressTone, { question: string; answers: readonly PressAnswer[] }> = {
  win: {
    question: 'Bugünkü galibiyeti nasıl değerlendiriyorsunuz?',
    answers: [
      { text: 'Oyuncularımı tebrik ederim, hepsi harika oynadı.', headline: 'Teknik direktör oyuncularına övgü yağdırdı', morale: 3, fans: 0, board: 0 },
      { text: 'Daha iyisini yapabiliriz; ayaklarımız yere basmalı.', headline: '{club} hocası: "Daha iyisini yapabiliriz"', morale: 0, fans: 0, board: 1 },
      { text: 'Bu takım her maçı kazanabilir!', headline: '{club} hocası iddialı: "Her maçı kazanabiliriz"', morale: 1, fans: 3, board: -1 },
    ],
  },
  draw: {
    question: 'Beraberlik sizi tatmin etti mi?',
    answers: [
      { text: 'Bir puan da değerlidir.', headline: '{club} hocası: "Bir puan da değerli"', morale: 1, fans: -2, board: 0 },
      { text: 'Kazanmamız gereken bir maçtı.', headline: '{club} hocası beraberlikten memnun değil', morale: -1, fans: 2, board: 1 },
      { text: 'Hakem kararları bizi üzdü.', headline: '{club} cephesinden hakeme tepki', morale: 1, fans: 1, board: -2 },
    ],
  },
  loss: {
    question: 'Yenilginin sebebi neydi?',
    answers: [
      { text: 'Sorumluluk tamamen bende.', headline: '{club} hocası yenilgiyi üstlendi', morale: 3, fans: 0, board: -1 },
      { text: 'Oyuncularım beklentimin çok altındaydı.', headline: '{club} hocası oyuncularını eleştirdi', morale: -4, fans: 2, board: 1 },
      { text: 'Hakem maçın sonucunu belirledi.', headline: '{club} hocası faturayı hakeme kesti', morale: 1, fans: 2, board: -3 },
    ],
  },
};

/** Kullanıcının maçından sonra toplantıyı açar (öncekini düşürür). */
export function pressAfterMatch(world: GameWorld, fixture: Fixture): void {
  const user = world.playerClubId;
  if (!fixture.result || (fixture.homeId !== user && fixture.awayId !== user)) return;
  const own = fixture.homeId === user ? fixture.result.homeGoals : fixture.result.awayGoals;
  const opp = fixture.homeId === user ? fixture.result.awayGoals : fixture.result.homeGoals;
  world.press = { fixtureId: fixture.id, tone: own > opp ? 'win' : own < opp ? 'loss' : 'draw' };
}

/** Cevabı uygular, toplantıyı kapatır. Hata varsa metin döner. */
export function answerPress(world: GameWorld, index: number): string | null {
  const press = world.press;
  const answer = press ? PRESS_QUESTIONS[press.tone].answers[index] : undefined;
  if (!press || !answer) return 'Bekleyen bir basın toplantısı yok.';
  for (const p of clubPlayers(world, world.playerClubId)) p.morale = Math.max(0, Math.min(100, p.morale + answer.morale));
  changeFans(world, answer.fans);
  world.board.confidence = Math.max(0, Math.min(100, world.board.confidence + answer.board));
  world.press = null;
  const club = getClub(world, world.playerClubId).name;
  addNews(world, {
    category: 'media',
    title: answer.headline.replace('{club}', club),
    body: `${world.manager.name}, maç sonu basın toplantısında konuştu: "${answer.text}"`,
    important: false,
    clubId: world.playerClubId,
  });
  return null;
}
