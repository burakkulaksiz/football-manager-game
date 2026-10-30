import { useState } from 'react';
import { clearErrors, formatErrors, readErrors } from '../../persistence/errorLog';
import { useGameStore } from '../../store/gameStore';

/** Ayarlar > Hata Günlüğü: son hatalar (en yeni önce), kopyala ve temizle. */
export function ErrorLogPanel() {
  const showNotice = useGameStore((s) => s.showNotice);
  const [entries, setEntries] = useState(readErrors);
  const copy = () => {
    navigator.clipboard?.writeText(formatErrors(entries))
      .then(() => showNotice('Hata günlüğü panoya kopyalandı.'))
      .catch(() => showNotice('Panoya kopyalanamadı.', 'error'));
  };
  return (
    <section className="panel">
      <div className="panel-title panel-title-row">
        <span>Hata Günlüğü{entries.length > 0 ? ` (${entries.length})` : ''}</span>
        <span className="toolbar">
          <button className="btn btn-small" disabled={entries.length === 0} onClick={copy}>Kopyala</button>
          <button className="btn btn-small" disabled={entries.length === 0} onClick={() => { clearErrors(); setEntries([]); }}>Temizle</button>
        </span>
      </div>
      <div className="panel-body">
        {entries.length === 0 ? (
          <div className="muted">Kayıtlı hata yok.</div>
        ) : (
          <div className="error-log">
            {[...entries].reverse().map((e, i) => (
              <details key={i}>
                <summary><span className="muted">{new Date(e.at).toLocaleString('tr-TR')} · {e.source}</span> {e.message}</summary>
                {e.stack && <pre>{e.stack}</pre>}
              </details>
            ))}
          </div>
        )}
        <div className="panel-note">Beklenmeyen hatalar burada saklanır (son 50, yalnızca bu tarayıcıda). Bir sorun bildirirken &quot;Kopyala&quot; ile ekleyebilirsin.</div>
      </div>
    </section>
  );
}
