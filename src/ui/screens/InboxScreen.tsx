import { formatDateTR, inboxItems, type NewsCategory, type NewsItem } from '../../engine';
import type { ScreenId } from '../../store/gameStore';
import { useGameStore, useUiState, useWorld } from '../../store/gameStore';
import { formatDateShort, NEWS_CATEGORY_LABELS } from '../labels';
import { AssistantPanel } from '../components/AssistantPanel';

type Filter = 'all' | 'unread' | 'team' | 'transfer' | 'board';

const FILTERS: { id: Filter; label: string; categories?: NewsCategory[] }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'unread', label: 'Okunmamış' },
  { id: 'team', label: 'Takım', categories: ['injury', 'discipline', 'player', 'training', 'contract'] },
  { id: 'transfer', label: 'Transfer', categories: ['transfer', 'offer', 'loan', 'window'] },
  { id: 'board', label: 'Yönetim', categories: ['board', 'season', 'finance'] },
];

/** Mesajdan ilgili ekrana geçiş. */
const CATEGORY_SCREEN: Partial<Record<NewsCategory, { screen: ScreenId; label: string }>> = {
  offer: { screen: 'transfers', label: 'Transfer Merkezi' },
  transfer: { screen: 'transfers', label: 'Transfer Merkezi' },
  loan: { screen: 'transfers', label: 'Transfer Merkezi' },
  window: { screen: 'transfers', label: 'Transfer Merkezi' },
  injury: { screen: 'training', label: 'Antrenman' },
  discipline: { screen: 'training', label: 'Antrenman' },
  board: { screen: 'club', label: 'Kulüp Bilgisi' },
  season: { screen: 'stats', label: 'Lig İstatistikleri' },
  academy: { screen: 'academy', label: 'Altyapı' },
  finance: { screen: 'finance', label: 'Finans' },
  international: { screen: 'international', label: 'Milli Takımlar' },
};

export function InboxScreen() {
  const world = useWorld();
  const worldAction = useGameStore((s) => s.worldAction);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const setScreen = useGameStore((s) => s.setScreen);
  const [filter, setFilter] = useUiState<Filter>('inbox.filter', 'all');
  const all = inboxItems(world);
  const active = FILTERS.find((f) => f.id === filter)!;
  const items = all.filter((n) =>
    filter === 'unread' ? !n.read : active.categories ? active.categories.includes(n.category) : true,
  );
  const [selectedId, setSelectedId] = useUiState<number | null>('inbox.selected', all[0]?.id ?? null);
  const selected = all.find((n) => n.id === selectedId) ?? items[0];
  const unread = all.filter((n) => !n.read).length;

  const open = (n: NewsItem) => {
    setSelectedId(n.id);
    if (!n.read) worldAction((w) => {
      const item = w.news.find((x) => x.id === n.id);
      if (item) item.read = true;
    });
  };

  const markAll = () =>
    worldAction((w) => {
      for (const n of w.news) n.read = true;
    });

  const link = selected ? CATEGORY_SCREEN[selected.category] : undefined;
  const player = selected?.playerId !== undefined ? world.players[selected.playerId] : undefined;

  return (
    <div className="screen">
      <AssistantPanel limit={4} />
    <div className="inbox">
      <section className="panel inbox-list-panel">
        <div className="panel-title panel-title-row">
          <span>Gelen Kutusu{unread > 0 ? ` (${unread})` : ''}</span>
          <button className="btn btn-small" disabled={unread === 0} onClick={markAll}>Tümünü okundu say</button>
        </div>
        <div className="inbox-filters tabs">
          {FILTERS.map((f) => (
            <button key={f.id} className={`tab${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="inbox-list">
          {items.length === 0 && <div className="panel-body muted">Mesaj yok.</div>}
          {items.map((n) => (
            <button
              key={n.id}
              className={`inbox-row${n.read ? '' : ' unread'}${selected?.id === n.id ? ' selected' : ''}${n.important ? ' important' : ''}`}
              onClick={() => open(n)}
            >
              <span className="inbox-row-meta">
                <span className="tag">{NEWS_CATEGORY_LABELS[n.category]}</span>
                <span className="muted">{formatDateShort(n.date)}</span>
              </span>
              <span className="inbox-row-title">{n.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel inbox-detail">
        {selected ? (
          <>
            <h2 className="panel-title">{selected.title}</h2>
            <div className="panel-body">
              <div className="inbox-detail-meta">
                <span className="tag">{NEWS_CATEGORY_LABELS[selected.category]}</span>
                <span className="muted">{formatDateTR(selected.date)}</span>
              </div>
              <p className="inbox-body">{selected.body}</p>
              <div className="button-row inbox-actions">
                {player && (
                  <button className="btn" onClick={() => openPlayer(player.id)}>
                    {player.firstName} {player.lastName} profili
                  </button>
                )}
                {link && <button className="btn" onClick={() => setScreen(link.screen)}>{link.label} ›</button>}
              </div>
            </div>
          </>
        ) : (
          <div className="panel-body muted">Bir mesaj seç.</div>
        )}
      </section>
    </div>
    </div>
  );
}
