import { useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Music, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNav } from '../../app/nav';
import { AudioField, PhotoField, TextArea, TextField } from '../../components/fields';
import { ConfirmDialog } from '../../components/Modal';
import { Photo } from '../../components/Photo';
import { Switch } from '../../components/Switch';
import { Button, Card, Notice } from '../../components/ui';
import { newId } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { Song } from '../../lib/types';
import { SetupPage, useDraft } from './common';

/** Songs are larger than voice notes, so allow bigger files and longer recordings. */
const MAX_SONG_BYTES = 15 * 1024 * 1024;
const MAX_SONG_RECORDING_SECONDS = 300;

export function SetupMusic() {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const [problem, setProblem] = useState<string | null>(null);
  const songs = data.songs;

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= songs.length) return;
    const next = [...songs];
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await save({ songs: next.map((s, i) => ({ ...s, order: i })) });
      setProblem(null);
    } catch {
      setProblem("The order couldn't be saved. Please try again.");
    }
  };

  const setBackgroundMusic = async (on: boolean) => {
    try {
      await save({ prefs: { ...data.prefs, backgroundMusic: on } });
      setProblem(null);
    } catch {
      setProblem("That setting couldn't be saved. Please try again.");
    }
  };

  return (
    <SetupPage title="Music" sub="Songs the person loves, and the memories they bring back. Music can spark memories and conversation.">
      <Card>
        <Switch
          label="Play music in the background"
          description="Starts by itself each time the phone is unlocked, one song after another. It pauses for voice messages, Read aloud and calls, then carries on. The music button at the top right of the screen pauses it or skips a song."
          checked={data.prefs.backgroundMusic}
          onChange={setBackgroundMusic}
        />
      </Card>
      <p className="field-hint">
        <Lock size={16} strokeWidth={2.5} aria-hidden /> Music is only shown and played after unlock. Changes on this page save
        straight away.
      </p>
      {songs.length === 0 ? <Notice icon={Music}>No songs yet.</Notice> : null}
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      <ul className="memory-setup-list">
        {songs.map((s, i) => {
          const name = s.title || 'Untitled song';
          return (
            <li key={s.id} className="memory-setup-row">
              {s.photo ? (
                <Photo photo={s.photo} className="photo-thumb-sm" />
              ) : (
                <span className="song-art-sm" aria-hidden>
                  <Music size={24} strokeWidth={2.25} />
                </span>
              )}
              <span className="memory-setup-title">
                {name}
                {!s.audio ? <span className="list-button-sub"> · no music yet</span> : null}
              </span>
              <div className="memory-setup-tools">
                <button type="button" className="icon-btn" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={22} strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${name} down`}
                  disabled={i === songs.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={22} strokeWidth={2.5} aria-hidden />
                </button>
                <button type="button" className="icon-btn" aria-label={`Edit ${name}`} onClick={() => navigate(`/setup/music/${s.id}`)}>
                  <Pencil size={22} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="primary" icon={Plus} onClick={() => navigate('/setup/music/new')}>
        Add a song
      </Button>
    </SetupPage>
  );
}

export function SetupSongEdit({ songId }: { songId: string }) {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<Song>(
    () =>
      data.songs.find((s) => s.id === songId) ?? {
        id: newId('song'),
        title: '',
        artist: '',
        note: '',
        photo: null,
        audio: null,
        order: data.songs.reduce((max, s) => Math.max(max, s.order + 1), 0),
      },
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isNew = !data.songs.some((s) => s.id === draft.id);
  const set = (patch: Partial<Song>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <SetupPage
      title={isNew ? 'Add a song' : draft.title || 'Song'}
      dirty={dirty}
      backPath="/setup/music"
      backLabel="Back to Music setup"
      onSave={async () => {
        const song: Song = {
          ...draft,
          title: draft.title.trim() || 'A favourite song',
          artist: draft.artist.trim(),
          note: draft.note.trim(),
        };
        const songs = data.songs.some((s) => s.id === song.id)
          ? data.songs.map((s) => (s.id === song.id ? song : s))
          : [...data.songs, song];
        await save({ songs });
        markSaved(song);
      }}
    >
      <Card>
        <TextField label="Song name" hint='For example: "The Riverside Waltz".' value={draft.title} onChange={(v) => set({ title: v })} maxLength={100} />
        <TextField
          label="Who sings or plays it (optional)"
          hint='For example: "The Riverton Dance Band" or "Sung by Dad".'
          value={draft.artist}
          onChange={(v) => set({ artist: v })}
          maxLength={100}
        />
        <TextArea
          label="The memory it brings back (optional)"
          hint='For example: "We danced to this at our wedding."'
          value={draft.note}
          onChange={(v) => set({ note: v })}
          rows={3}
          maxLength={300}
        />
      </Card>
      <Card>
        <AudioField
          label="The music"
          value={draft.audio}
          onChange={(audio) => set({ audio })}
          transcriptLabel="Describe the music in words"
          chooseLabel="Choose a song file"
          noun="music"
          maxBytes={MAX_SONG_BYTES}
          maxSeconds={MAX_SONG_RECORDING_SECONDS}
        />
        <p className="field-hint">
          Choose a song file you own, or record someone singing or playing it. Files stay on this phone and are never
          uploaded. The description helps people who can’t hear it.
        </p>
      </Card>
      <Card>
        <PhotoField
          label="A photo that goes with it (optional)"
          value={draft.photo}
          defaultAlt={draft.title.trim() ? `A photo for ${draft.title.trim()}` : 'A photo for this song'}
          onChange={(photo) => set({ photo })}
        />
      </Card>
      {!isNew ? (
        <Button variant="danger" size="md" icon={Trash2} onClick={() => setConfirmRemove(true)}>
          Remove this song
        </Button>
      ) : null}
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove this song?"
          body={<p>“{draft.title || 'This song'}”, its music file and photo will be removed from this phone.</p>}
          confirmLabel="Remove song"
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setConfirmRemove(false);
            await save({ songs: data.songs.filter((s) => s.id !== draft.id) });
            markSaved(draft);
            navigate('/setup/music', { replace: true });
          }}
        />
      ) : null}
    </SetupPage>
  );
}
