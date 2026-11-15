import { useEffect } from 'react';
import { MusicCornerScope, MusicProvider, useMusic } from './app/music';
import { NavProvider, useNav } from './app/nav';
import { Heading, Screen, TopBar } from './components/ui';
import { TileGrid } from './components/TileGrid';
import { isLockedSafe } from './lib/router';
import { StoreProvider, useStore } from './lib/store';
import type { Backend } from './lib/db';
import type { DemoMediaLoader } from './lib/repo';
import { formatClock } from './lib/schedule';
import { useNow } from './lib/useNow';
import { SAMPLE_PIN } from './lib/seed';
import { AUTO_HELP_AFTER } from './lib/session';
import { LockScreen } from './screens/LockScreen';
import { LockedExperience, type LockedScreenId } from './screens/locked/LockedViews';
import { Today } from './screens/companion/Today';
import { HomeFull, Places } from './screens/companion/HomeViews';
import { ContactDetail, DemoCall, FamilyFull } from './screens/companion/FamilyViews';
import { YouFull } from './screens/companion/YouView';
import { RoutineFull, RoutinePlayer } from './screens/companion/RoutineViews';
import { MemoriesView } from './screens/companion/MemoriesView';
import { MusicView } from './screens/companion/MusicView';
import { SetupHub } from './screens/setup/SetupHub';
import { SetupYou } from './screens/setup/SetupYou';
import { SetupHome, SetupSpace } from './screens/setup/SetupHome';
import { SetupContact, SetupFamily } from './screens/setup/SetupFamily';
import { SetupRoutine, SetupRoutineEdit } from './screens/setup/SetupRoutine';
import { SetupMemories, SetupMemoryEdit } from './screens/setup/SetupMemories';
import { SetupMusic, SetupSongEdit } from './screens/setup/SetupMusic';
import { SetupPrivacy } from './screens/setup/SetupPrivacy';
import { SetupSettings } from './screens/setup/SetupSettings';
import { SetupWizard } from './screens/start/SetupWizard';
import { Welcome } from './screens/start/Welcome';

export function App({ backend, loader }: { backend?: Backend; loader?: DemoMediaLoader }) {
  return (
    <StoreProvider backend={backend} loader={loader}>
      <NavProvider>
        <MusicProvider>
          <Shell />
        </MusicProvider>
      </NavProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { ready, data } = useStore();
  const { route } = useNav();

  useEffect(() => {
    document.documentElement.dataset.textSize = data.prefs.textSize;
  }, [data.prefs.textSize]);

  // Move focus to the new screen's heading so screen-reader and keyboard users start at the top.
  useEffect(() => {
    if (!ready) return;
    const id = window.requestAnimationFrame(() => {
      // Don't pull focus away from someone who has already started typing.
      if (document.activeElement?.closest('.device-screen input, .device-screen textarea, .device-screen select')) return;
      const heading = document.querySelector<HTMLElement>('.device-screen [data-screen-heading]');
      heading?.focus({ preventScroll: true });
      document.querySelector('.device-screen .screen-scroll')?.scrollTo?.({ top: 0 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [route.path, ready, data.setup.wizardStep]);

  return (
    <div className="stage">
      <DemoNotes />
      <div className="device">
        <div className="device-screen">
          <StatusBar />
          <div className="device-content">{ready ? <Screens /> : <Loading />}</div>
          <div id="modal-root" />
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  const now = useNow();
  return (
    <div className="status-bar" aria-hidden>
      <span>{formatClock(now)}</span>
      <span className="status-bar-demo">Demo phone</span>
    </div>
  );
}

function Loading() {
  return (
    <div className="screen">
      <main className="screen-scroll">
        <div className="loading" role="status">
          Getting things ready…
        </div>
      </main>
    </div>
  );
}

function LockedLive({ screen }: { screen: LockedScreenId }) {
  const { preview } = useStore();
  const { navigate, flash } = useNav();
  return (
    <LockedExperience
      preview={preview}
      screen={screen}
      flash={flash}
      go={(s) => navigate(s === 'help' ? '/help' : `/help/${s}`)}
      onTryPin={() => navigate('/lock')}
    />
  );
}

function HelpUnlocked() {
  const { navigate } = useNav();
  return (
    <Screen top={<TopBar back={{ label: 'Back to Today', onClick: () => navigate('/today') }} />} label="Get help">
      <Heading sub="Choose one.">Need a hand?</Heading>
      <TileGrid onOpen={(tile) => navigate(`/${tile}?from=help`)} />
    </Screen>
  );
}

function Screens() {
  const { session } = useNav();
  // The music button sits at the top right of unlocked screens only.
  return (
    <MusicCornerScope show={session.unlocked}>
      <ScreenSwitch />
    </MusicCornerScope>
  );
}

function ScreenSwitch() {
  const { route, session } = useNav();
  const { data } = useStore();

  if (data.setup.mode === 'new') return route.name === 'start' ? <SetupWizard /> : <Welcome />;

  // Defence in depth: the router already redirects, but never render a private
  // screen while locked.
  if (!session.unlocked && !isLockedSafe(route.name)) return <LockedLive screen="help" />;

  switch (route.name) {
    case 'lock':
      return <LockScreen />;
    case 'help':
      return session.unlocked ? <HelpUnlocked /> : <LockedLive screen="help" />;
    case 'locked-tile':
      return <LockedLive screen={route.tile ?? 'help'} />;
    case 'locked-call':
      return <LockedLive screen="call" />;
    case 'today':
      return <Today />;
    case 'home':
      return <HomeFull />;
    case 'places':
      return <Places key={route.id ?? 'first'} />;
    case 'family':
      return <FamilyFull />;
    case 'contact':
      return <ContactDetail />;
    case 'call':
      return <DemoCall />;
    case 'you':
      return <YouFull />;
    case 'routine':
      return <RoutineFull />;
    case 'routine-play':
      return <RoutinePlayer key={route.id} />;
    case 'memories':
      return <MemoriesView />;
    case 'music':
      return <MusicView />;
    case 'setup':
      return <SetupScreens key={route.path.split('?')[0]} />;
    default:
      return <Today />;
  }
}

function SetupScreens() {
  const { route } = useNav();
  const id = route.id;
  switch (route.section) {
    case 'you':
      return <SetupYou />;
    case 'home':
      return id ? <SetupSpace spaceId={id} /> : <SetupHome />;
    case 'family':
      return id ? <SetupContact contactId={id} /> : <SetupFamily />;
    case 'routine':
      return id ? <SetupRoutineEdit routineId={id} /> : <SetupRoutine />;
    case 'memories':
      return id ? <SetupMemoryEdit memoryId={id} /> : <SetupMemories />;
    case 'music':
      return id ? <SetupSongEdit songId={id} /> : <SetupMusic />;
    case 'privacy':
      return <SetupPrivacy />;
    case 'settings':
      return <SetupSettings />;
    default:
      return <SetupHub />;
  }
}

/** Notes beside the phone on wide screens, for presenters and judges. */
function DemoNotes() {
  const { session } = useNav();
  const { persistent } = useStore();
  const music = useMusic();
  const musicStatus = !music.current
    ? 'No songs with music'
    : !session.unlocked
      ? 'Off while locked'
      : music.state === 'playing'
      ? 'Playing'
      : music.state === 'waiting'
        ? 'Paused for another sound'
        : music.state === 'blocked'
          ? 'Waiting for a tap'
          : music.state === 'failed'
            ? 'Couldn’t play'
            : 'Paused';
  return (
    <aside className="demo-notes" aria-label="About this demo">
      <p className="demo-notes-kicker">Working prototype</p>
      <h2 className="demo-notes-title">Familiar Place</h2>
      <p className="demo-notes-promise">
        If your phone is locked, you still have a way to get your bearings and reach someone you trust.
      </p>
      <dl className="demo-status">
        <div>
          <dt>Demo phone</dt>
          <dd>{session.unlocked ? 'Unlocked' : 'Locked'}</dd>
        </div>
        <div>
          <dt>Wrong PINs in a row</dt>
          <dd>{session.consecutiveInvalid}</dd>
        </div>
        <div>
          <dt>Help opened automatically</dt>
          <dd>{session.autoHelpShown ? 'Yes, this sequence' : 'Not yet'}</dd>
        </div>
        <div>
          <dt>Background music</dt>
          <dd>{musicStatus}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{persistent ? 'This device only' : 'This visit only'}</dd>
        </div>
      </dl>
      <ol className="demo-steps">
        <li>Enter a wrong PIN {AUTO_HELP_AFTER} times. Help opens on its own.</li>
        <li>Tap Family, then the demo call.</li>
        <li>Open Routine and Home.</li>
        <li>Unlock with demo PIN {SAMPLE_PIN}. Open Home to see the address.</li>
        <li>Start a step-by-step routine.</li>
        <li>Music starts after unlock. Tap the music button at the top right to pause it.</li>
      </ol>
      <p className="demo-notes-fine">
        Fictional people and sample media. Simulated lock screen: never type a real passcode. Refreshing the page starts
        a new lock session.
      </p>
    </aside>
  );
}
