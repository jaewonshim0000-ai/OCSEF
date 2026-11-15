import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { stopAllPlayback } from '../lib/playback';
import { resolveRoute, type Route } from '../lib/router';
import { SAMPLE_PIN } from '../lib/seed';
import { initialSession, relock, submitPin, type LockSession, type PinOutcome } from '../lib/session';

export type Flash = 'auto-help' | 'private' | null;

export interface Nav {
  route: Route;
  session: LockSession;
  flash: Flash;
  navigate(path: string, opts?: { replace?: boolean; flash?: Flash }): void;
  back(fallback: string): void;
  submitPin(entry: string): PinOutcome;
  lock(): void;
}

const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside <NavProvider>');
  return nav;
}

function currentHashPath(): string {
  return window.location.hash.replace(/^#/, '') || '/lock';
}

function writeHash(path: string, replace: boolean) {
  const url = `${window.location.pathname}${window.location.search}#${path}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

/**
 * Holds the in-memory demo session and the hash route. On every page load the
 * route is reset to the keypad, so refreshing starts a new simulated session.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const sessionRef = useRef<LockSession>(initialSession());
  const [session, setSessionState] = useState<LockSession>(sessionRef.current);
  const [route, setRoute] = useState<Route>(() => resolveRoute('/lock', false).route);
  const [flash, setFlash] = useState<Flash>(null);

  const setSession = useCallback((next: LockSession) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const apply = useCallback(
    (path: string, mode: 'push' | 'replace' | 'none', nextFlash: Flash) => {
      const resolution = resolveRoute(path, sessionRef.current.unlocked);
      const finalPath = resolution.route.path;
      if (mode !== 'none' || finalPath !== path) {
        writeHash(finalPath, mode === 'replace' || mode === 'none');
      }
      stopAllPlayback();
      setRoute(resolution.route);
      setFlash(resolution.blockedPrivate ? 'private' : nextFlash);
      if (sessionRef.current.view !== finalPath) setSession({ ...sessionRef.current, view: finalPath });
    },
    [setSession],
  );

  // Every load starts on the simulated keypad.
  useEffect(() => {
    writeHash('/lock', true);
    const onPop = () => {
      const path = currentHashPath();
      apply(path, 'none', null);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, [apply]);

  const navigate = useCallback<Nav['navigate']>(
    (path, opts) => apply(path, opts?.replace ? 'replace' : 'push', opts?.flash ?? null),
    [apply],
  );

  const back = useCallback<Nav['back']>((fallback) => apply(fallback, 'push', null), [apply]);

  const doSubmit = useCallback<Nav['submitPin']>(
    (entry) => {
      const result = submitPin(sessionRef.current, entry, entry === SAMPLE_PIN);
      if (result.outcome === 'incomplete') return result.outcome;
      setSession(result.session);
      if (result.outcome === 'unlocked') apply('/today', 'push', null);
      else if (result.outcome === 'invalid-open-help') apply('/help', 'push', 'auto-help');
      return result.outcome;
    },
    [apply, setSession],
  );

  const lock = useCallback(() => {
    setSession(relock());
    apply('/lock', 'push', null);
  }, [apply, setSession]);

  const value = useMemo<Nav>(
    () => ({ route, session, flash, navigate, back, submitPin: doSubmit, lock }),
    [route, session, flash, navigate, back, doSubmit, lock],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
