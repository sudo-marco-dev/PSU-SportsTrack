import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import './index.css'
import App from './App.tsx'

// Auto-recover from stale chunks after new deployments when waking from background / alt-tab
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Dynamic import chunk failed to load. Auto-refreshing for latest deployment...', event);
  const lastReload = sessionStorage.getItem('last_vite_preload_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('last_vite_preload_reload', String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
