import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { installErrorLog } from './persistence/errorLog';
import './ui/styles.css';

installErrorLog();

// İnternetsiz çalışma (PWA): yalnızca üretim derlemesinde; geliştirmede önbellek anlık yenilemeyi bozar
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    // Kayıtlar (IndexedDB) tarayıcı yer açarken silinmesin
    void navigator.storage?.persist?.();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
