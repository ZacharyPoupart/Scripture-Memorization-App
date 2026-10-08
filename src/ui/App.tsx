import { useEffect, useState } from 'preact/hooks';
import { useRoute } from '../router.ts';
import { updateSettings, useApp } from '../store.ts';
import { About } from './About.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { AddVerse } from './AddVerse.tsx';
import { Celebrations } from './Celebrations.tsx';
import { Home } from './Home.tsx';
import { Onboarding } from './Onboarding.tsx';
import { PilePage, PilesOverview } from './Piles.tsx';
import { Review } from './Review.tsx';
import { Settings } from './Settings.tsx';
import { Stats } from './Stats.tsx';
import { TabBar, ToastHost, UpdateBanner, useVisibleViewport } from './Shell.tsx';
import { VerseDetail } from './VerseDetail.tsx';
import { PILES, type Pile } from '../core/types.ts';

const TITLES: Record<string, string> = {
  '': 'Today',
  piles: 'All verses',
  pile: 'Pile',
  verse: 'Verse',
  add: 'Add a verse',
  edit: 'Edit verse',
  review: 'Review',
  stats: 'Progress',
  settings: 'Settings',
  about: 'About',
};

function CrashProbe() {
  if (useApp().debugCrash) throw new Error('simulated render error');
  return null;
}

export function App({ onReload }: { onReload: () => void }) {
  useVisibleViewport();
  const { ready, settings } = useApp();
  const route = useRoute();
  const [intro, setIntro] = useState(false);
  const section = route.path[0] ?? '';
  useEffect(() => {
    document.title = `${TITLES[section] ?? 'Memorize For Life'} · Memorize For Life`;
  }, [section]);
  if (!ready) return <div class="screen" aria-busy="true" />;

  const [a, b] = route.path;
  const inReview = a === 'review';
  let screen;
  let tab = '/';
  if (!a) screen = <Home />;
  else if (a === 'piles') ((screen = <PilesOverview />), (tab = '/piles'));
  else if (a === 'pile' && PILES.includes(b as Pile)) ((screen = <PilePage pile={b as Pile} />), (tab = '/piles'));
  else if (a === 'verse' && b) ((screen = <VerseDetail id={b} />), (tab = '/piles'));
  else if (a === 'add') ((screen = <AddVerse key="add" />), (tab = '/add'));
  else if (a === 'edit' && b) ((screen = <AddVerse key={`edit-${b}`} editId={b} />), (tab = '/piles'));
  else if (a === 'review') screen = <Review route={route} key={route.query.toString()} />;
  else if (a === 'stats') ((screen = <Stats />), (tab = '/stats'));
  else if (a === 'settings') ((screen = <Settings onShowIntro={() => setIntro(true)} />), (tab = '/settings'));
  else if (a === 'about') ((screen = <About onShowIntro={() => setIntro(true)} />), (tab = '/settings'));
  else screen = <Home />;

  return (
    <>
      <UpdateBanner onReload={onReload} />
      <main class={`screen ${inReview ? '' : 'has-tabs'}`}>
        <ErrorBoundary key={route.path.join('/')}>
          <CrashProbe />
          {screen}
        </ErrorBoundary>
      </main>
      {!inReview && <TabBar current={tab} />}
      <Celebrations suppressed={inReview || !settings.onboarded} />
      <ToastHost tabs={!inReview} />
      {(!settings.onboarded || intro) && (
        <Onboarding
          onClose={() => {
            setIntro(false);
            if (!settings.onboarded) updateSettings({ onboarded: true });
          }}
        />
      )}
    </>
  );
}
