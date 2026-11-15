import { useState } from 'react';
import { ListMusic, Music, Pause, Play, SkipForward, X } from 'lucide-react';
import { songTitle, useOptionalMusic, useShowMusicCorner, type Music as MusicApi, type MusicState } from '../app/music';
import { useNav } from '../app/nav';
import { Modal } from './Modal';
import { Photo } from './Photo';

function cornerLabel(state: MusicState, title: string): string {
  switch (state) {
    case 'playing':
      return `Background music playing: ${title}`;
    case 'waiting':
      return `Background music paused for now: ${title}`;
    case 'blocked':
      return `Background music: tap to play ${title}`;
    case 'failed':
      return 'Background music couldn’t play';
    default:
      return `Background music paused: ${title}`;
  }
}

function statusText(state: MusicState): string {
  switch (state) {
    case 'playing':
      return 'Playing in the background.';
    case 'waiting':
      return 'Paused while another sound plays. It will carry on by itself.';
    case 'blocked':
      return 'Tap Play music to start the music.';
    case 'failed':
      return 'This music couldn’t be played. A helper can check it in Helper setup.';
    default:
      return 'Paused. Tap Play music to hear it again.';
  }
}

/**
 * The round music button at the top right of every unlocked screen. It shows
 * whether music is playing and opens simple controls. Hidden when no song has
 * music, and never shown on locked screens.
 */
export function MusicCorner() {
  const show = useShowMusicCorner();
  const music = useOptionalMusic();
  const [open, setOpen] = useState(false);
  if (!show || !music?.current) return null;

  const playing = music.state === 'playing';
  return (
    <>
      <button
        type="button"
        className={`music-corner${playing ? ' is-playing' : ''}`}
        aria-label={cornerLabel(music.state, songTitle(music.current))}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Music size={26} strokeWidth={2.5} aria-hidden />
        {playing ? (
          <span className="music-eq" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        ) : (
          <span className="music-badge" aria-hidden>
            <Pause size={12} strokeWidth={3} />
          </span>
        )}
      </button>
      {open ? <MusicPanel music={music} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function MusicPanel({ music, onClose }: { music: MusicApi; onClose: () => void }) {
  const { route, navigate } = useNav();
  const song = music.current;
  if (!song) return null;
  const title = songTitle(song);
  const playing = music.state === 'playing' || music.state === 'waiting';

  return (
    <Modal title="Music" onClose={onClose}>
      <div className="music-now">
        {song.photo ? (
          <Photo photo={song.photo} className="music-now-art" />
        ) : (
          <div className="music-now-art music-now-art-empty" aria-hidden>
            <Music size={36} strokeWidth={2.25} />
          </div>
        )}
        <div className="music-now-text">
          <p className="music-now-label">
            {music.state === 'playing' ? 'Now playing' : music.state === 'waiting' ? 'Paused for now' : 'Ready to play'}
          </p>
          <p className="music-now-title">{title}</p>
          {song.artist.trim() ? <p className="music-now-artist">{song.artist}</p> : null}
        </div>
      </div>
      {song.note.trim() ? <p className="music-now-note">{song.note}</p> : null}
      <p className="music-now-status" role="status">
        {statusText(music.state)}
      </p>
      <div className="modal-actions">
        {playing ? (
          <button type="button" className="btn btn-primary btn-xl btn-block" onClick={music.pause} data-autofocus>
            <Pause size={28} strokeWidth={2.5} aria-hidden />
            <span>Pause music</span>
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-xl btn-block" onClick={() => music.play()} data-autofocus>
            <Play size={28} strokeWidth={2.5} aria-hidden />
            <span>Play music</span>
          </button>
        )}
        {music.playlist.length > 1 ? (
          <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={music.next}>
            <SkipForward size={28} strokeWidth={2.5} aria-hidden />
            <span>Next song</span>
          </button>
        ) : null}
        {route.name !== 'music' ? (
          <button
            type="button"
            className="btn btn-quiet btn-md btn-block"
            onClick={() => {
              onClose();
              navigate('/music');
            }}
          >
            <ListMusic size={22} strokeWidth={2.5} aria-hidden />
            <span>See all songs</span>
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={onClose}>
          <X size={28} strokeWidth={2.5} aria-hidden />
          <span>Close</span>
        </button>
      </div>
    </Modal>
  );
}
