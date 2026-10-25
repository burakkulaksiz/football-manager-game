import { shortcutGroups } from '../hotkeys';
import { screenInfo } from '../screens';
import { Modal } from './Modal';

/** Klavye kısayollarının listesi (yardım penceresi ve Ayarlar'da ortak). */
export function ShortcutList() {
  return (
    <div className="shortcuts">
      {shortcutGroups((id) => screenInfo(id).label).map((group) => (
        <div key={group.title} className="shortcut-group">
          <div className="sub-head">{group.title}</div>
          {group.items.map((item) => (
            <div key={`${item.keys.join('+')}-${item.text}`} className="shortcut-row">
              <span className="shortcut-keys">
                {item.keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && <span className="shortcut-plus">+</span>}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </span>
              <span className="shortcut-text">{item.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Klavye Kısayolları" onClose={onClose}>
      <ShortcutList />
      <div className="panel-note">Metin yazarken ve pencereler açıkken kısayollar çalışmaz. Ayarlar'dan tamamen kapatılabilir.</div>
    </Modal>
  );
}
