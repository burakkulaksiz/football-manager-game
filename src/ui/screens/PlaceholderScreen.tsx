import type { ScreenId } from '../../store/gameStore';
import { screenInfo } from '../screens';

/** Henüz yapılmamış ekranlar için geçici panel. */
export function PlaceholderScreen({ screen }: { screen: ScreenId }) {
  const info = screenInfo(screen);
  return (
    <section className="panel">
      <h2 className="panel-title">{info.label}</h2>
      <div className="panel-body">
        <p className="muted">Bu ekran {info.stage}. aşamada eklenecek.</p>
      </div>
    </section>
  );
}
