import { useState } from 'react';
import {
  activePromise,
  daysBetween,
  nextTalkDate,
  openRequest,
  PROMISE_MATCHES,
  PROMISE_STARTS,
  recentForm,
  REQUEST_ANSWERS,
  respondToRequest,
  talkToPlayer,
  type Player,
  type RequestAnswer,
  type RequestTopic,
  type TalkTopic,
} from '../../engine';
import { useGameStore, useWorld } from '../../store/gameStore';
import { formatDateShort, moraleLabel } from '../labels';
import { ContractDialog } from './TransferDialogs';

const TOPIC_TEXT: Record<RequestTopic, string> = {
  playingTime: 'Yeterince forma şansı bulamadığını düşünüyor ve seninle görüşmek istiyor.',
  contract: 'Geleceğini netleştirmek için yeni bir sözleşme konuşmak istiyor.',
  transfer: 'Kulüpten ayrılmak istediğini söylüyor.',
};

const ANSWER_LABELS: Record<RequestTopic, Partial<Record<RequestAnswer, string>>> = {
  playingTime: { promise: 'Forma şansı sözü ver', compete: 'Yerini kazanmalı', loanList: 'Kiralık listesine koy' },
  contract: { negotiate: 'Sözleşmeyi görüşelim', later: 'Şimdi değil', refuse: 'Mevcut sözleşmesine uymalı' },
  transfer: { transferList: 'Transfer listesine koy', refuse: 'Ayrılamaz' },
};

const TALKS: { topic: TalkTopic; label: string; hint: string }[] = [
  { topic: 'praise', label: 'Öv', hint: 'Son maçlardaki formu iyiyse sevinir; formu kötüyse samimi bulmaz.' },
  { topic: 'criticize', label: 'Eleştir', hint: 'Formu kötü ve profesyonel oyuncu kabullenir; formu iyiyse haksızlık sayar.' },
  { topic: 'encourage', label: 'Moral ver', hint: 'Morali düşük oyuncuya iyi gelir.' },
  { topic: 'promise', label: 'Forma şansı sözü ver', hint: `Sonraki ${PROMISE_MATCHES} maçın en az ${PROMISE_STARTS}'ünde ilk 11; tutulmazsa morali çok bozulur.` },
];

/** Oyuncu profilinde görüşme: bekleyen talebe yanıt, verilen söz, menajerin başlattığı görüşmeler. */
export function TalkPanel({ player }: { player: Player }) {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const showNotice = useGameStore((s) => s.showNotice);
  const [contract, setContract] = useState(false);
  const request = openRequest(world, player.id);
  const promise = activePromise(world, player.id);
  const nextTalk = nextTalkDate(world, player);
  const form = recentForm(player);
  const name = `${player.firstName} ${player.lastName}`;

  const reactionText = (delta: number) =>
    delta >= 4 ? `${name} memnun kaldı (moral +${delta}).`
      : delta <= -4 ? `${name} rahatsız oldu (moral ${delta}).`
        : `${name} pek tepki vermedi.`;

  const answer = (a: RequestAnswer) => {
    const result = worldAction((w) => respondToRequest(w, request!.id, a));
    if (result.error) {
      showNotice(result.error, 'error');
      return;
    }
    showNotice(reactionText(result.delta), result.delta <= -4 ? 'error' : 'ok');
    if (a === 'negotiate') setContract(true);
  };

  const talk = (topic: TalkTopic) => {
    const result = worldAction((w) => talkToPlayer(w, player.id, topic));
    if (result.error) showNotice(result.error, 'error');
    else showNotice(reactionText(result.delta), result.reaction === 'negative' ? 'error' : 'ok');
  };

  return (
    <section className="panel talk-panel">
      <h2 className="panel-title panel-title-row">
        <span>Görüşme</span>
        <span className="title-extra">
          Moral: {moraleLabel(player.morale)} · Son maçlar: {form === null ? '—' : form.toFixed(1)}
        </span>
      </h2>
      {request && (
        <div className="talk-request">
          <div>
            <strong>Görüşme talebi:</strong> {TOPIC_TEXT[request.topic]}{' '}
            <span className="muted">Yanıt için {Math.max(0, daysBetween(world.date, request.respondBy))} gün kaldı.</span>
          </div>
          <div className="talk-buttons">
            {REQUEST_ANSWERS[request.topic].map((a) => (
              <button key={a} className={`btn btn-small${a === REQUEST_ANSWERS[request.topic][0] ? ' btn-go' : ''}`} onClick={() => answer(a)}>
                {ANSWER_LABELS[request.topic][a]}
              </button>
            ))}
          </div>
        </div>
      )}
      {promise && (
        <div className="panel-note">
          Forma şansı sözü ({formatDateShort(promise.made)}): oynayabildiği {promise.matches}/{PROMISE_MATCHES} maçta {promise.starts} kez ilk 11
          (en az {PROMISE_STARTS} gerekli).
        </div>
      )}
      <div className="panel-body talk-buttons">
        {TALKS.map((t) => (
          <button
            key={t.topic}
            className="btn btn-small"
            title={t.hint}
            disabled={nextTalk !== null || (t.topic === 'promise' && promise !== undefined)}
            onClick={() => talk(t.topic)}
          >
            {t.label}
          </button>
        ))}
        {nextTalk && <span className="muted">Yeniden görüşebileceğin tarih: {formatDateShort(nextTalk)}</span>}
      </div>
      {contract && <ContractDialog player={player} onClose={() => setContract(false)} />}
    </section>
  );
}
