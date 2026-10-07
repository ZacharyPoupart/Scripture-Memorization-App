import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { init, setUpdateReady } from './store.ts';
import { App } from './ui/App.tsx';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    setUpdateReady(true);
  },
  onRegisteredSW(_url, registration) {
    // Installed iPhone apps rarely do a full reload, so look for a new version whenever the app comes back.
    if (!registration) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update().catch(() => {});
    });
  },
});

render(<App onReload={() => void updateSW(true)} />, document.getElementById('app')!);
void init();
