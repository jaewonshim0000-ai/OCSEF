import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { foregroundActive, subscribeForeground } from '../lib/playback';
import { useStore } from '../lib/store';
import type { AudioRef, Song } from '../lib/types';
import { useNav } from './nav';

/** A favourite song that has music to play. */
export type PlayableSong = Song & { audio: AudioRef };

/**
 * - playing: music is playing (or about to).
 * - waiting: it stepped aside for a voice message, Read aloud, recording or a call, and will carry on by itself.
 * - paused: someone paused it, or it has not started yet.
 * - blocked: the browser wants a tap before it plays sound.
 * - failed: none of the songs could be played.
 */
export type MusicState = 'playing' | 'waiting' | 'paused' | 'blocked' | 'failed';

export interface Music {
  /** Songs with music, in the same order as the Music screen. */
  playlist: PlayableSong[];
  /** The song playing or next to play. Null when no song has music. */
  current: PlayableSong | null;
  state: MusicState;
  /** Play, optionally switching to a particular song. */
  play(songId?: string): void;
  pause(): void;
  next(): void;
}

/** Gentle enough to sit behind the screen, loud enough to recognise. */
export const MUSIC_VOLUME = 0.7;

export function songTitle(song: Pick<Song, 'title'>): string {
  return song.title.trim() || 'A favourite song';
}

/** A tenth of a second of silence, played on the first tap so iPhones allow music later. */
function silentWav(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const MusicContext = createContext<Music | null>(null);

export function useMusic(): Music {
  const music = useContext(MusicContext);
  if (!music) throw new Error('useMusic must be used inside <MusicProvider>');
  return music;
}

/** Null outside the provider, so shared components still render on their own. */
export function useOptionalMusic(): Music | null {
  return useContext(MusicContext);
}

const CornerContext = createContext(false);

/**
 * Says whether the music button belongs in the top bar here. On only for
 * unlocked screens: locked screens, and previews of them, never show it.
 */
export function MusicCornerScope({ show, children }: { show: boolean; children: ReactNode }) {
  return <CornerContext.Provider value={show}>{children}</CornerContext.Provider>;
}

export function useShowMusicCorner(): boolean {
  return useContext(CornerContext);
}

/**
 * Plays favourite music in the background. It starts by itself when the phone
 * is unlocked (unless a helper turned that off, or the person paused it this
 * visit), keeps going from screen to screen, steps aside for any other sound,
 * and stops while the phone is locked.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const { data, mediaUrl } = useStore();
  const { session, route } = useNav();
  const elRef = useRef<HTMLAudioElement | null>(null);
  const silentRef = useRef<string | null>(null);
  /** Which recording the element holds now. */
  const loadedRef = useRef<string | null>(null);
  /** The person paused it, so unlocking again doesn't restart it this visit. */
  const userPausedRef = useRef(false);
  const errorsRef = useRef(0);

  const playlist = useMemo(() => data.songs.filter((s): s is PlayableSong => !!s.audio), [data.songs]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = playlist.find((s) => s.id === currentId) ?? playlist[0] ?? null;
  const [want, setWant] = useState(false);
  const [busy, setBusy] = useState(foregroundActive);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const unlocked = session.unlocked;
  const onCall = route.name === 'call';
  const currentAudioId = current?.audio.id ?? null;
  const shouldPlay = want && unlocked && !busy && !onCall && !failed && currentAudioId !== null;

  const latest = useRef({ playlist, current });
  latest.current = { playlist, current };

  const element = useCallback((): HTMLAudioElement => {
    if (!elRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.volume = MUSIC_VOLUME;
      elRef.current = el;
    }
    return elRef.current;
  }, []);

  const silent = () => (silentRef.current ??= silentWav());

  const advance = useCallback(() => {
    const { playlist: list, current: now } = latest.current;
    if (!list.length) return;
    const index = now ? list.findIndex((s) => s.id === now.id) : -1;
    const nextSong = list[(index + 1) % list.length];
    if (nextSong.id === now?.id) {
      // Only one song: start it again.
      element().currentTime = 0;
      return;
    }
    setCurrentId(nextSong.id);
  }, [element]);

  /** A song couldn't be played: try the next one, and give up after trying them all. */
  const trackFailed = useCallback(() => {
    errorsRef.current += 1;
    if (errorsRef.current >= latest.current.playlist.length) {
      errorsRef.current = 0;
      setFailed(true);
      return;
    }
    advance();
  }, [advance]);

  const start = useCallback(
    (el: HTMLAudioElement) => {
      let attempt: Promise<void> | undefined;
      try {
        attempt = el.play();
      } catch {
        trackFailed();
        return;
      }
      attempt
        ?.then(() => setBlocked(false))
        .catch((err: unknown) => {
          const name = (err as { name?: string } | null)?.name;
          if (name === 'AbortError') return; // paused or switched before it began
          if (name === 'NotAllowedError') setBlocked(true);
          else trackFailed();
        });
    },
    [trackFailed],
  );

  // The element's own events.
  useEffect(() => {
    const el = element();
    el.onended = () => advance();
    el.onplaying = () => {
      errorsRef.current = 0;
    };
    el.onerror = () => {
      if (!loadedRef.current || el.getAttribute('src') === silentRef.current) return;
      trackFailed();
    };
    return () => {
      el.onended = null;
      el.onplaying = null;
      el.onerror = null;
      el.pause();
      el.removeAttribute('src');
      loadedRef.current = null;
    };
  }, [element, advance, trackFailed]);

  // On the first tap or key press anywhere, play a moment of silence so that
  // phones which only allow sound after a tap will let the music start later.
  useEffect(() => {
    const el = element();
    let done = false;
    const prime = () => {
      if (done) return;
      done = true;
      remove();
      if (el.getAttribute('src')) return;
      const clip = silent();
      el.src = clip;
      const clear = () => {
        if (el.getAttribute('src') === clip) {
          el.pause();
          el.removeAttribute('src');
        }
      };
      try {
        el.play()?.then(clear, clear);
      } catch {
        clear();
      }
    };
    const remove = () => {
      document.removeEventListener('pointerdown', prime, true);
      document.removeEventListener('keydown', prime, true);
    };
    document.addEventListener('pointerdown', prime, true);
    document.addEventListener('keydown', prime, true);
    return remove;
  }, [element]);

  // Step aside while another sound plays.
  useEffect(() => {
    const unsubscribe = subscribeForeground(setBusy);
    setBusy(foregroundActive());
    return unsubscribe;
  }, []);

  // Start by itself each time the phone is unlocked.
  useEffect(() => {
    if (unlocked && data.prefs.backgroundMusic && !userPausedRef.current && playlist.length > 0) setWant(true);
    // Only the moment of unlocking matters here.
  }, [unlocked]);

  // Turning the setting off stops the music now.
  const autoStart = data.prefs.backgroundMusic;
  const prevAutoStart = useRef(autoStart);
  useEffect(() => {
    if (prevAutoStart.current && !autoStart) setWant(false);
    prevAutoStart.current = autoStart;
  }, [autoStart]);

  // No music left (for example after Erase everything): nothing to wait for.
  useEffect(() => {
    if (playlist.length === 0) {
      setWant(false);
      setFailed(false);
    }
  }, [playlist.length]);

  useEffect(() => {
    element().loop = playlist.length === 1;
  }, [element, playlist.length]);

  // Play or pause to match the situation, loading the song when needed.
  useEffect(() => {
    const el = element();
    if (!shouldPlay || !currentAudioId) {
      el.pause();
      return;
    }
    if (loadedRef.current === currentAudioId) {
      start(el);
      return;
    }
    let live = true;
    mediaUrl(currentAudioId).then((url) => {
      if (!live) return;
      if (!url) {
        trackFailed();
        return;
      }
      el.src = url;
      loadedRef.current = currentAudioId;
      start(el);
    });
    return () => {
      live = false;
    };
  }, [shouldPlay, currentAudioId, element, mediaUrl, start, trackFailed]);

  const play = useCallback(
    (songId?: string) => {
      userPausedRef.current = false;
      errorsRef.current = 0;
      setFailed(false);
      setBlocked(false);
      setWant(true);
      const { playlist: list, current: now } = latest.current;
      const target = songId ? list.find((s) => s.id === songId) ?? now : now;
      if (!target) return;
      const el = element();
      if (target.id !== now?.id) {
        setCurrentId(target.id);
        return;
      }
      // Resume straight away, inside the tap, so browsers allow the sound.
      if (unlocked && !busy && loadedRef.current === target.audio.id) start(el);
    },
    [element, start, unlocked, busy],
  );

  const pause = useCallback(() => {
    userPausedRef.current = true;
    setWant(false);
    element().pause();
  }, [element]);

  const next = useCallback(() => {
    errorsRef.current = 0;
    setFailed(false);
    advance();
  }, [advance]);

  const state: MusicState = failed ? 'failed' : !want ? 'paused' : blocked ? 'blocked' : shouldPlay ? 'playing' : 'waiting';

  const value = useMemo<Music>(
    () => ({ playlist, current, state, play, pause, next }),
    [playlist, current, state, play, pause, next],
  );
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
