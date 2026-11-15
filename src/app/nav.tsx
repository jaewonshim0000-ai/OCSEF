import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { stopAllPlayback } from '../lib/playback';
import { resolveRoute, type Route } from '../lib/router';
import { verifyPin } from '../lib/pin';
import {
  helperAttempt,
  helperOpenAt,
  initialHelperGate,
  initialSession,
  isCompleteEntry,
  relock,
  submitPin,
  RELOCK_AFTER_MS,
  type HelperGate,
  type LockSession,
  type PinOutcome,
} from '../lib/session';
import { useStore } from '../lib/store';

export type Flash = 'auto-help' | 'private' | 'setup-done' | null;

export interface Nav {
  route: Route;
  session: LockSession;
  flash: Flash;
  navigate(path: string, opts?: { replace?: boolean; flash?: Flash }): void;
  back(fallback: string): void;
  submitPin(entry: string): Promise<PinOutcome>;
  lock(): void;
  /** True while a correct helper PIN is less than 10 minutes old. */
  isHelperOpen(): boolean;
  /** When the 30-second wait after 5 wrong helper PINs ends (ms since epoch), or 0. */
  helperWaitUntil: number;
  checkHelperPin(entry: string): Promise<'ok' | 'wrong' | 'wait'>;
  /** Starts a fresh session at the right first screen for the saved data. */
  restart(opts?: { unlocked?: boolean; flash?: Flash }): void;
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
 * Holds the in-memory lock session and the hash route. On every page load the
 * route is reset to the keypad, so refreshing starts a new session.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const { ready, snapshot } = useStore();
  const sessionRef = useRef<LockSession>(initialSession());
  const [session, setSessionState] = useState<LockSession>(sessionRef.current);
  const [route, setRoute] = useState<Route>(() => resolveRoute('/lock', false).route);
  const [flash, setFlash] = useState<Flash>(null);
  const gateRef = useRef<HelperGate>(initialHelperGate());
  const [gate, setGateState] = useState<HelperGate>(gateRef.current);
  const setGate = useCallback((g: HelperGate) => {
    gateRef.current = g;
    setGateState(g);
  }, []);
  const closeGate = useCallback(() => setGate({ ...gateRef.current, verifiedUntil: 0 }), [setGate]);

  const isHelperOpen = useCallback(() => helperOpenAt(gateRef.current, Date.now()), []);

  const checkHelperPin = useCallback<Nav['checkHelperPin']>(
    async (entry) => {
      if (Date.now() < gateRef.current.waitUntil) return 'wait';
      const pin = snapshot().security.helperPin;
      const matched = pin ? await verifyPin(entry, pin).catch(() => false) : false;
      const now = Date.now();
      const next = helperAttempt(gateRef.current, matched, now);
      setGate(next);
      if (matched && helperOpenAt(next, now)) return 'ok';
      return now < next.waitUntil ? 'wait' : 'wrong';
    },
    [setGate, snapshot],
  );

  const setSession = useCallback((next: LockSession) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const apply = useCallback(
    (path: string, mode: 'push' | 'replace' | 'none', nextFlash: Flash) => {
      const resolution = resolveRoute(path, sessionRef.current.unlocked, snapshot().setup.mode);
      const finalPath = resolution.route.path;
      if (mode !== 'none' || finalPath !== path) {
        writeHash(finalPath, mode === 'replace' || mode === 'none');
      }
      stopAllPlayback();
      setRoute(resolution.route);
      setFlash(resolution.blockedPrivate ? 'private' : nextFlash);
      if (sessionRef.current.view !== finalPath) setSession({ ...sessionRef.current, view: finalPath });
    },
    [setSession, snapshot],
  );

  // Follow back/forward and hash changes. The first route is set by restart().
  useEffect(() => {
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
    async (entry) => {
      if (!isCompleteEntry(entry)) return 'incomplete';
      const pin = snapshot().security.personPin;
      const matched = pin ? await verifyPin(entry, pin).catch(() => false) : false;
      const result = submitPin(sessionRef.current, entry, matched);
      setSession(result.session);
      if (result.outcome === 'unlocked') apply('/today', 'push', null);
      else if (result.outcome === 'invalid-open-help') apply('/help', 'push', 'auto-help');
      return result.outcome;
    },
    [apply, setSession, snapshot],
  );

  const lock = useCallback(() => {
    closeGate();
    setSession(relock());
    apply('/lock', 'push', null);
  }, [apply, closeGate, setSession]);

  const restart = useCallback<Nav['restart']>(
    (opts) => {
      setGate(initialHelperGate());
      const d = snapshot();
      const isNew = d.setup.mode === 'new';
      const unlocked = !isNew && (opts?.unlocked ?? !d.security.lockEnabled);
      setSession({ ...initialSession(), unlocked });
      const path = isNew ? ((d.setup.wizardStep ?? 1) > 1 ? '/start' : '/welcome') : unlocked ? '/today' : '/lock';
      apply(path, 'replace', opts?.flash ?? null);
    },
    [apply, setGate, setSession, snapshot],
  );

  // Pick the first screen once saved data has loaded.
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    restart();
  }, [ready, restart]);

  // Lock again after RELOCK_AFTER_MS in the background, when the lock is on.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away < RELOCK_AFTER_MS) return;
      closeGate();
      const d = snapshot();
      if (d.setup.mode !== 'new' && d.security.lockEnabled && sessionRef.current.unlocked) lock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [closeGate, lock, snapshot]);

  const value = useMemo<Nav>(
    () => ({
      route,
      session,
      flash,
      navigate,
      back,
      submitPin: doSubmit,
      lock,
      restart,
      isHelperOpen,
      helperWaitUntil: gate.waitUntil,
      checkHelperPin,
    }),
    [route, session, flash, navigate, back, doSubmit, lock, restart, isHelperOpen, gate, checkHelperPin],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
