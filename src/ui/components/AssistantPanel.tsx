import { Fragment, useState, type ReactNode } from 'react';
import { assistantAdvice, type Advice, type AdviceSeverity, type AreaGroup } from '../../engine';
import { useGameStore, useWorld, type ScreenId } from '../../store/gameStore';
import { POSITION_NAMES } from '../labels';

const SEVERITY_LABELS: Record<AdviceSeverity, string> = { high: 'Acil', medium: 'Önemli', low: 'Öneri' };

const AREA_LABELS: Record<AreaGroup, string> = { GK: 'kale', DEF: 'defans', MID: 'orta saha', ATT: 'hücum' };

interface AdviceView {
  text: ReactNode;
  action?: { label: string; screen: ScreenId };
}

/** Öneriyi cümleye çevirir; oyuncu adları tıklanınca profil açılır. */
function describe(a: Advice, name: (id: number) => ReactNode): AdviceView {
  const names = (ids: number[]) => ids.map((id, i) => <Fragment key={id}>{i > 0 && ', '}{name(id)}</Fragment>);
  const pos = a.slot ? POSITION_NAMES[a.slot] : '';
  const tactics = { label: 'Taktik', screen: 'tactics' as const };
  switch (a.kind) {
    case 'unavailableStarter':
      if (a.reason === 'gone') return { text: <>İlk 11'deki bir oyuncu artık kadroda değil ({pos}); maçta yerine otomatik biri girecek.</>, action: tactics };
      return {
        text: <>{name(a.playerIds[0]!)} {a.reason === 'injury' ? `sakat (${a.value} gün)` : `cezalı (${a.value} maç)`} ama ilk 11'de; maçta yerine otomatik biri girecek.</>,
        action: tactics,
      };
    case 'outOfPosition':
      return { text: <>{name(a.playerIds[0]!)} {pos} mevkisinin yabancısı: burada verimi %{a.value}.</>, action: tactics };
    case 'betterOption':
      return { text: <>{pos}: {name(a.playerIds[1]!)}, {name(a.playerIds[0]!)} yerine daha iyi bir seçenek olabilir.</>, action: tactics };
    case 'tiredStarter':
      return { text: <>{name(a.playerIds[0]!)} yorgun (kondisyon %{a.value}); sıradaki maçta dinlendirmeyi düşün.</>, action: tactics };
    case 'unhappyStarter':
      return { text: <>{name(a.playerIds[0]!)} mutsuz; sahadaki verimi düşebilir.</> };
    case 'thinPosition':
      return a.value === 0
        ? { text: <>{pos} mevkisinde oynayabilecek bir oyuncun yok.</>, action: { label: 'Transfer Merkezi', screen: 'transfers' } }
        : { text: <>{pos} mevkisinde yedeğin yok: yalnızca {names(a.playerIds)} oynayabiliyor.</>, action: { label: 'Transfer Merkezi', screen: 'transfers' } };
    case 'weakArea':
      return {
        text: <>Kadronun en zayıf bölgesi {AREA_LABELS[a.group!]}: ilk 11'deki seviyesi takımın gerisinde. Bu bölgeye takviye düşünebilirsin.</>,
        action: { label: 'Transfer Merkezi', screen: 'transfers' },
      };
    case 'expiringContract':
      return {
        text: <>{a.playerIds.length === 1 ? 'Önemli bir oyuncunun' : `${a.playerIds.length} önemli oyuncunun`} sözleşmesi bu sezon bitiyor: {names(a.playerIds)}. Yenilemezsen 30 Haziran'da ayrılırlar.</>,
      };
    case 'overAgeU19':
      return { text: <>U19 yaş sınırını geçenler: {names(a.playerIds)}. A takıma al ya da serbest bırak.</>, action: { label: 'Altyapı', screen: 'academy' } };
    case 'youthReady':
      return { text: <>U19'dan {name(a.playerIds[0]!)} A takım seviyesine geldi; A takıma almayı düşün.</>, action: { label: 'Altyapı', screen: 'academy' } };
    case 'needsMinutes':
      return { text: <>Bu sezon hiç süre bulamayan gençler: {names(a.playerIds)}. Gelişimleri için kiralık listesine koymayı düşün.</> };
    case 'squadTooBig':
      return { text: <>A takım kadron kalabalık ({a.value} oyuncu): fazlalıkları transfer listesine koymayı düşün.</>, action: { label: 'Kadro', screen: 'squad' } };
    case 'squadTooSmall':
      return { text: <>A takım kadron çok dar ({a.value} oyuncu): sakatlık ve cezalarda zorlanırsın.</>, action: { label: 'Transfer Merkezi', screen: 'transfers' } };
    case 'wagesOver':
      return { text: <>Maaş bütçesi aşıldı (kullanım %{a.value}); yönetim harcamalara dikkat edilmesini ister.</>, action: { label: 'Finans', screen: 'finance' } };
  }
}

/**
 * Yardımcı antrenörün önerileri (önem sırasıyla).
 * `filter`: yalnızca bu önerileri göster; `limit`: önce bu kadarı (fazlası "Tümünü göster" ile).
 * `hideWhenEmpty`: öneri yoksa hiç çizilmez (Taktik ekranı, maç öncesi).
 */
export function AssistantPanel({ filter, limit = 4, hideWhenEmpty = false, compact = false }: {
  filter?: (a: Advice) => boolean;
  limit?: number;
  hideWhenEmpty?: boolean;
  compact?: boolean;
}) {
  const world = useWorld();
  const openPlayer = useGameStore((s) => s.openPlayer);
  const setScreen = useGameStore((s) => s.setScreen);
  const currentScreen = useGameStore((s) => s.screen);
  const [expanded, setExpanded] = useState(false);
  const all = assistantAdvice(world).filter((a) => !filter || filter(a));
  if (all.length === 0 && hideWhenEmpty) return null;
  const shown = expanded ? all : all.slice(0, limit);

  const name = (id: number) => {
    const p = world.players[id];
    if (!p) return 'Bir oyuncu';
    return <button className="link-button strong" onClick={() => openPlayer(id)}>{p.firstName} {p.lastName}</button>;
  };

  return (
    <section className={`panel assistant-panel${compact ? ' compact' : ''}`}>
      <h2 className="panel-title panel-title-row">
        <span>Yardımcı Antrenör</span>
        {all.length > limit && (
          <button className="btn btn-small" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Daha az göster' : `Tümünü göster (${all.length})`}
          </button>
        )}
      </h2>
      {all.length === 0 ? (
        <div className="panel-body muted">Şu an önemli bir konu yok; kadro ve ilk 11 iyi görünüyor.</div>
      ) : (
        <ul className="advice-list">
          {shown.map((a) => {
            const view = describe(a, name);
            return (
              <li key={a.id} className={`advice advice-${a.severity}`}>
                <span className={`advice-badge ${a.severity}`}>{SEVERITY_LABELS[a.severity]}</span>
                <span className="advice-text">{view.text}</span>
                {/* Zaten o ekrandaysak yönlendirme düğmesi gereksiz */}
                {view.action && view.action.screen !== currentScreen && (
                  <button className="btn btn-small" onClick={() => setScreen(view.action!.screen)}>{view.action.label} ›</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
