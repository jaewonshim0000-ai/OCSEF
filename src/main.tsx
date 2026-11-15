import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Cache the app shell so the basics keep working offline after the first load.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
  } else {
    // A worker left over from a production preview would serve stale files in development.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
}
