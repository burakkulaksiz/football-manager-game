import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Basit modal pencere: arka plan karartılır, Esc ya da dışarı tıklama kapatır.
 * body'ye portal ile çizilir; aksi hâlde backdrop-filter kullanan paneller fixed konumu hapseder.
 */
export function Modal({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="panel-title panel-title-row">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose} title="Kapat">✕</button>
        </h2>
        <div className="panel-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
