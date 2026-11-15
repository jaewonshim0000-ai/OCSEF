import { Music, Pause, Play, Settings } from 'lucide-react';
import { songTitle, useMusic, type PlayableSong } from '../../app/music';
import { useNav } from '../../app/nav';
import { Photo } from '../../components/Photo';
import { Button, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { useStore } from '../../lib/store';

/** Play or pause one song in the background music player. */
function SongButton({ song }: { song: PlayableSong }) {
  const music = useMusic();
  const title = songTitle(song);
  const isCurrent = music.current?.id === song.id;
  const active = isCurrent && (music.state === 'playing' || music.state === 'waiting');
  return (
    <div className="sound">
      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        onClick={active ? music.pause : () => music.play(song.id)}
        aria-pressed={active}
        aria-label={`${active ? 'Pause' : 'Play'}: ${title}`}
      >
        {active ? <Pause size={26} strokeWidth={2.5} aria-hidden /> : <Play size={26} strokeWidth={2.5} aria-hidden />}
        <span>{active ? 'Pause' : 'Play'}</span>
      </button>
      {isCurrent && music.state === 'playing' ? <p className="song-now">Playing now</p> : null}
      {song.audio.transcript ? (
        <p className="transcript">
          <span className="transcript-label">About this music: </span>“{song.audio.transcript}”
        </p>
      ) : null}
    </div>
  );
}

/**
 * Favourite music, each with the memory it brings back. Music plays in the
 * background after unlock, one song at a time; Play here picks the song.
 */
export function MusicView() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const back = route.from === 'you' ? { label: 'Back to You', path: '/you' } : { label: 'Back to Today', path: '/today' };
  const songs = data.songs;

  return (
    <Screen top={<TopBar back={{ label: back.label, onClick: () => navigate(back.path) }} getHelp={() => navigate('/help')} />}>
      <Heading sub="Songs I love">Music</Heading>
      {songs.length === 0 ? (
        <Stack>
          <Notice icon={Music}>No favourite music has been added yet.</Notice>
          <Button variant="quiet" size="md" icon={Settings} onClick={() => navigate('/setup/music')}>
            Add songs in Helper setup
          </Button>
        </Stack>
      ) : (
        <ul className="song-list">
          {songs.map((song) => {
            const title = songTitle(song);
            return (
              <li key={song.id} className="song-card">
                <div className="song-head">
                  {song.photo ? (
                    <Photo photo={song.photo} className="song-art" />
                  ) : (
                    <div className="song-art song-art-empty" aria-hidden>
                      <Music size={40} strokeWidth={2.25} />
                    </div>
                  )}
                  <div className="song-text">
                    <h2 className="song-title">{title}</h2>
                    {song.artist.trim() ? <p className="song-artist">{song.artist}</p> : null}
                  </div>
                </div>
                {song.note.trim() ? <p className="song-note">{song.note}</p> : null}
                {song.audio ? (
                  <SongButton song={{ ...song, audio: song.audio }} />
                ) : (
                  <p className="muted">The music for this song hasn’t been added yet. A helper can add it in Helper setup.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {songs.some((s) => !s.audio) ? (
        <Button variant="quiet" size="md" icon={Settings} onClick={() => navigate('/setup/music')}>
          Add music in Helper setup
        </Button>
      ) : null}
    </Screen>
  );
}
