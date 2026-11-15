import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { claimPlayback, releasePlayback } from '../lib/playback';
import { cancelSpeech, speak as speakText, speechAvailable } from '../lib/speech';
import { useStore } from '../lib/store';
import type { MediaId } from '../lib/types';
import { useMediaUrl } from './Photo';

/**
 * Plays a stored recording only when tapped. Shows the words as a text
 * alternative, and explains clearly when sound is blocked or missing.
 */
export function AudioButton({
  audio,
  label = 'Play recording',
  variant = 'secondary',
  showTranscript = true,
  transcriptLabel = 'What it says:',
  name,
}: {
  audio: { id: MediaId; transcript: string };
  label?: string;
  variant?: 'primary' | 'secondary';
  showTranscript?: boolean;
  /** Label before the text alternative, e.g. "About this music:". */
  transcriptLabel?: string;
  /** What is playing, so screen readers hear "Play The Riverside Waltz" rather than just "Play". */
  name?: string;
}) {
  const media = useMediaUrl(audio.id);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef<symbol | null>(null);
  const [playing, setPlaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const stop = useCallback(() => {
    const el = elRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    if (tokenRef.current) releasePlayback(tokenRef.current);
    tokenRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    // A different recording: drop the old element.
    stop();
    elRef.current = null;
    setProblem(null);
  }, [media.url, stop]);

  const start = async () => {
    if (!media.url) return;
    setProblem(null);
    if (!elRef.current) {
      const el = new Audio(media.url);
      el.onended = () => stop();
      el.onerror = () => {
        stop();
        setProblem("This recording couldn't be played.");
      };
      elRef.current = el;
    }
    tokenRef.current = claimPlayback(stop);
    setPlaying(true);
    try {
      await elRef.current.play();
    } catch {
      stop();
      setProblem("Sound couldn't start. Check the volume, then tap Play again.");
    }
  };

  const unavailable = media.status === 'missing';

  return (
    <div className="sound">
      <button
        type="button"
        className={`btn btn-${variant} btn-lg btn-block`}
        onClick={playing ? stop : start}
        disabled={unavailable || media.status === 'loading'}
        aria-pressed={playing}
        aria-label={name ? `${playing ? 'Stop' : label}: ${name}` : undefined}
      >
        {playing ? <Square size={26} strokeWidth={2.5} aria-hidden /> : <Play size={26} strokeWidth={2.5} aria-hidden />}
        <span>{playing ? 'Stop' : label}</span>
      </button>
      {unavailable ? <p className="sound-note">This recording is missing. The words are below.</p> : null}
      {problem ? (
        <p className="sound-note" role="alert">
          {problem}
        </p>
      ) : null}
      {showTranscript && audio.transcript ? (
        <p className="transcript">
          <span className="transcript-label">{transcriptLabel} </span>“{audio.transcript}”
        </p>
      ) : null}
    </div>
  );
}

/**
 * Reads text aloud using the browser's speech engine when it exists and the
 * person has Read aloud switched on. Renders nothing otherwise, so the screen
 * still works without speech.
 */
export function ReadAloudButton({
  text,
  variant = 'secondary',
  label = 'Read aloud',
}: {
  text: string;
  variant?: 'primary' | 'secondary';
  label?: string;
}) {
  const { data } = useStore();
  const [speaking, setSpeaking] = useState(false);
  const tokenRef = useRef<symbol | null>(null);
  const supported = speechAvailable();

  const stop = useCallback(() => {
    if (tokenRef.current) {
      releasePlayback(tokenRef.current);
      tokenRef.current = null;
      cancelSpeech();
    }
    setSpeaking(false);
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => stop(), [text, stop]);

  if (!supported || !data.prefs.readAloud || !text.trim()) return null;

  const speak = () => {
    tokenRef.current = claimPlayback(stop);
    const token = tokenRef.current;
    const finish = () => {
      if (tokenRef.current === token) {
        releasePlayback(token);
        tokenRef.current = null;
        setSpeaking(false);
      }
    };
    setSpeaking(true);
    speakText(text, finish);
  };

  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-lg btn-block`}
      onClick={speaking ? stop : speak}
      aria-pressed={speaking}
    >
      {speaking ? <Square size={26} strokeWidth={2.5} aria-hidden /> : <Volume2 size={26} strokeWidth={2.5} aria-hidden />}
      <span>{speaking ? 'Stop reading' : label}</span>
    </button>
  );
}
