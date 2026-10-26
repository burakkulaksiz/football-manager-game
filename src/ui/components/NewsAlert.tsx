import { useGameStore, useWorld } from '../../store/gameStore';
import { NEWS_CATEGORY_LABELS } from '../labels';
import type { NewsItem } from '../../engine';

/**
 * Devam'ı durduran yeni haberler: ekranın üstünde belirgin kutu. Habere tıklanınca gelen kutusunda o haber açılır;
 * teklif haberinde Transfer Merkezi'nin teklifler sekmesine gidilir. Sonraki Devam'da kendiliğinden kapanır.
 */
export function NewsAlert() {
  const world = useWorld();
  const ids = useGameStore((s) => s.newsAlert);
  const dismiss = useGameStore((s) => s.dismissNewsAlert);
  const setScreen = useGameStore((s) => s.setScreen);
  const worldAction = useGameStore((s) => s.worldAction);
  if (!ids) return null;
  const items = ids.map((id) => world.news.find((n) => n.id === id)).filter((n): n is NewsItem => n !== undefined);
  if (items.length === 0) return null;

  const open = (n: NewsItem) => {
    dismiss();
    worldAction((w) => {
      const item = w.news.find((x) => x.id === n.id);
      if (item) item.read = true;
    });
    if (n.category === 'offer') setScreen('transfers', { 'transfers.tab': 'offers' });
    else if (n.category === 'job') setScreen('jobs');
    else setScreen('inbox', { 'inbox.selected': n.id, 'inbox.filter': 'all' });
  };

  return (
    <div className="news-alert" role="alert">
      <div className="news-alert-head">
        <span className="news-alert-title">{items.length === 1 ? 'Yeni haber' : `${items.length} yeni haber`}</span>
        <button className="btn btn-small" onClick={() => { dismiss(); setScreen('inbox'); }}>Gelen Kutusu ›</button>
        <button className="icon-btn" title="Kapat" onClick={dismiss}>✕</button>
      </div>
      <ul>
        {items.slice(0, 5).map((n) => (
          <li key={n.id}>
            <button className="news-alert-item" onClick={() => open(n)}>
              <span className="tag">{NEWS_CATEGORY_LABELS[n.category]}</span>
              <span className="news-alert-text">
                <strong>{n.title}</strong>
                <span className="muted">{n.body.length > 140 ? `${n.body.slice(0, 140)}…` : n.body}</span>
              </span>
              <span className="news-alert-go">{n.category === 'offer' ? 'Teklife git ›' : 'Aç ›'}</span>
            </button>
          </li>
        ))}
        {items.length > 5 && <li className="muted news-alert-more">+{items.length - 5} haber daha gelen kutusunda</li>}
      </ul>
    </div>
  );
}
