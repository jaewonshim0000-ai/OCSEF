import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Camera, Mic, Plus, Square, Trash2, Upload } from 'lucide-react';
import { MAX_AUDIO_BYTES, prepareImage, recordingSupported } from '../lib/media';
import { claimPlayback, releasePlayback } from '../lib/playback';
import { useStore } from '../lib/store';
import type { AudioRef, PhotoRef } from '../lib/types';
import { Photo } from './Photo';
import { AudioButton } from './Sound';

export function Field({ label, hint, children, id }: { label: ReactNode; hint?: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  type = 'text',
  maxLength = 200,
  autoComplete = 'off',
  inputMode,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  type?: 'text' | 'tel' | 'time' | 'password';
  maxLength?: number;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'numeric';
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  hint,
  placeholder,
  rows = 3,
  maxLength = 600,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <textarea
        id={id}
        className="input textarea"
        value={value}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** A list of short lines, such as landmarks or personal details. */
export function ListField({
  label,
  items,
  onChange,
  addLabel,
  itemLabel,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  itemLabel: string;
  placeholder?: string;
}) {
  const groupId = useId();
  return (
    <fieldset className="field fieldset" aria-labelledby={groupId}>
      <legend id={groupId} className="field-label">
        {label}
      </legend>
      {items.length === 0 ? <p className="field-hint">None yet.</p> : null}
      {items.map((item, i) => (
        <div key={i} className="list-field-row">
          <input
            className="input"
            value={item}
            placeholder={placeholder}
            maxLength={200}
            aria-label={`${itemLabel} ${i + 1}`}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={22} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-md" onClick={() => onChange([...items, ''])}>
        <Plus size={22} strokeWidth={2.5} aria-hidden />
        <span>{addLabel}</span>
      </button>
    </fieldset>
  );
}

/** Choose, describe, or remove a photo. Photos are shrunk and kept on this device. */
export function PhotoField({
  label,
  value,
  onChange,
  kind = 'scene',
  defaultAlt,
  name,
  children,
}: {
  label: string;
  value: PhotoRef | null;
  onChange: (v: PhotoRef | null) => void;
  kind?: 'person' | 'scene';
  defaultAlt: string;
  name?: string;
  /** Extra controls such as a Show before unlock switch. */
  children?: ReactNode;
}) {
  const { addMedia } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const altId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await prepareImage(file);
      const id = await addMedia(blob);
      onChange({ id, alt: value?.alt?.trim() ? value.alt : defaultAlt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo couldn't be added.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <fieldset className="field fieldset">
      <legend className="field-label">{label}</legend>
      <div className={`photo-field photo-field-${kind}`}>
        <Photo photo={value} kind={kind} name={name} className={kind === 'person' ? 'photo-avatar-lg' : 'photo-thumb'} />
        <div className="photo-field-actions">
          <button type="button" className="btn btn-secondary btn-md" onClick={() => inputRef.current?.click()} disabled={busy}>
            {value ? <Camera size={22} strokeWidth={2.5} aria-hidden /> : <Upload size={22} strokeWidth={2.5} aria-hidden />}
            <span>{busy ? 'Adding…' : value ? 'Change photo' : 'Choose photo'}</span>
          </button>
          {value ? (
            <button type="button" className="btn btn-quiet btn-md" onClick={() => onChange(null)}>
              <Trash2 size={22} strokeWidth={2.5} aria-hidden />
              <span>Remove photo</span>
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {value ? (
        <div className="field">
          <label className="field-label-sm" htmlFor={altId}>
            Describe the photo in words
          </label>
          <input
            id={altId}
            className="input"
            value={value.alt}
            maxLength={200}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
          />
        </div>
      ) : null}
      {children}
    </fieldset>
  );
}

const DEFAULT_MAX_RECORDING_SECONDS = 60;

/** Record or choose a short recording, with its words as a text alternative. */
export function AudioField({
  label,
  value,
  onChange,
  children,
  transcriptLabel = 'Words in the recording',
  maxBytes = MAX_AUDIO_BYTES,
  maxSeconds = DEFAULT_MAX_RECORDING_SECONDS,
  chooseLabel = 'Choose audio file',
  noun = 'recording',
}: {
  label: string;
  value: AudioRef | null;
  onChange: (v: AudioRef | null) => void;
  children?: ReactNode;
  transcriptLabel?: string;
  maxBytes?: number;
  maxSeconds?: number;
  chooseLabel?: string;
  /** Word used on the Play and Remove buttons, e.g. "music". */
  noun?: string;
}) {
  const { addMedia } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; timer: number } | null>(null);
  const transcriptId = useId();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /** Claimed while recording so other sounds, and background music, stay quiet. */
  const playbackRef = useRef<symbol | null>(null);

  const cleanupRecording = () => {
    if (playbackRef.current) {
      releasePlayback(playbackRef.current);
      playbackRef.current = null;
    }
    const r = recRef.current;
    if (!r) return;
    window.clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
  };

  useEffect(
    () => () => {
      const r = recRef.current;
      if (r) {
        r.recorder.onstop = null;
        if (r.recorder.state !== 'inactive') r.recorder.stop();
        cleanupRecording();
      }
    },
    [],
  );

  const store = async (blob: Blob) => {
    if (blob.size > maxBytes) {
      setError(`That file is too large. Please choose one under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      return;
    }
    setBusy(true);
    try {
      const id = await addMedia(blob);
      onChangeRef.current({ id, transcript: valueRef.current?.transcript ?? '' });
    } catch {
      setError("The recording couldn't be saved on this device.");
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("The microphone isn't available. You can choose an audio file instead.");
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError("Recording isn't supported here. You can choose an audio file instead.");
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || chunks[0]?.type || 'audio/webm';
      cleanupRecording();
      setRecording(false);
      if (chunks.length) store(new Blob(chunks, { type }));
    };
    const started = Date.now();
    const timer = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= maxSeconds && recorder.state === 'recording') recorder.stop();
    }, 250);
    recRef.current = { recorder, stream, timer };
    playbackRef.current = claimPlayback(stopRecording);
    setSeconds(0);
    setRecording(true);
    recorder.start();
  };

  function stopRecording() {
    const r = recRef.current;
    if (r && r.recorder.state !== 'inactive') r.recorder.stop();
  }

  const chooseFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file.');
      return;
    }
    await store(file);
  };

  return (
    <fieldset className="field fieldset">
      <legend className="field-label">{label}</legend>
      {value ? (
        <>
          <AudioButton audio={value} label={`Play ${noun}`} showTranscript={false} />
          <div className="field">
            <label className="field-label-sm" htmlFor={transcriptId}>
              {transcriptLabel}
            </label>
            <textarea
              id={transcriptId}
              className="input textarea"
              rows={2}
              maxLength={400}
              value={value.transcript}
              onChange={(e) => onChange({ ...value, transcript: e.target.value })}
            />
          </div>
          <button type="button" className="btn btn-quiet btn-md" onClick={() => onChange(null)}>
            <Trash2 size={22} strokeWidth={2.5} aria-hidden />
            <span>Remove {noun}</span>
          </button>
        </>
      ) : recording ? (
        <div className="recording" role="status">
          <span className="recording-dot" aria-hidden />
          <span>
            Recording… {seconds}s of {maxSeconds}s
          </span>
          <button type="button" className="btn btn-danger btn-md" onClick={stopRecording}>
            <Square size={22} strokeWidth={2.5} aria-hidden />
            <span>Stop</span>
          </button>
        </div>
      ) : (
        <div className="button-row">
          {recordingSupported() ? (
            <button type="button" className="btn btn-secondary btn-md" onClick={startRecording} disabled={busy}>
              <Mic size={22} strokeWidth={2.5} aria-hidden />
              <span>Record</span>
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-md" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload size={22} strokeWidth={2.5} aria-hidden />
            <span>{busy ? 'Adding…' : chooseLabel}</span>
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => chooseFile(e.target.files?.[0])}
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}
