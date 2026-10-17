import { useGameStore } from '../../store/gameStore';
import { MENU } from '../screens';

export function Sidebar() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const quitToMenu = useGameStore((s) => s.quitToMenu);

  return (
    <nav className="sidebar">
      {MENU.map((group) => (
        <div key={group.title} className="menu-group">
          <div className="menu-group-title">{group.title}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              className={`menu-item${item.id === screen ? ' active' : ''}`}
              onClick={() => setScreen(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
      <div className="sidebar-footer">
        <button className="menu-item" onClick={quitToMenu}>
          ◀ Ana Menü
        </button>
      </div>
    </nav>
  );
}
