import { Component, type ReactNode } from 'react';
import { AUTOSAVE_SLOTS } from '../../persistence/saves';
import { logError } from '../../persistence/errorLog';

/** Ekran çökerse boş sayfa yerine açıklama ve yenile düğmesi; hata günlüğe yazılır. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError('ekran', Object.assign(error, { stack: `${error.stack ?? ''}${info.componentStack ?? ''}` }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <h1>Bir hata oluştu</h1>
        <p>{this.state.error.message}</p>
        <p className="muted">
          Hata, Ayarlar &gt; Hata Günlüğü&apos;ne yazıldı. Sayfayı yenileyip son kaydından ya da otomatik kayıtlardan
          birinden (son {AUTOSAVE_SLOTS} otomatik kayıt saklanır) devam edebilirsin.
        </p>
        <button className="btn-continue" onClick={() => location.reload()}>Sayfayı yenile</button>
      </div>
    );
  }
}
