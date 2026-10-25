import { SettingsPanel } from '../components/SettingsPanel';

/** Ayarlar ekranı (oyun içinden). Ayarlar anında uygulanır ve tarayıcıda saklanır. */
export function SettingsScreen() {
  return (
    <div className="screen">
      <div className="panel-note settings-note">Ayarlar anında uygulanır; bu tarayıcıda saklanır ve bütün kariyerlerde geçerlidir (kayıt dosyasına girmez).</div>
      <SettingsPanel />
    </div>
  );
}
