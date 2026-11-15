/**
 * Record types for Familiar Place.
 *
 * Personal data (everything in AppData) lives in IndexedDB. The lock session
 * (LockSession, see session.ts) lives only in memory and is never written to
 * storage.
 */

export type MediaId = string;

/** A stored photo plus its text alternative. */
export interface PhotoRef {
  id: MediaId;
  alt: string;
}

/** A stored recording plus a transcript as its text alternative. */
export interface AudioRef {
  id: MediaId;
  transcript: string;
}

export interface MediaRecord {
  id: MediaId;
  blob: Blob;
  mime: string;
  createdAt: number;
}

/** A salted PBKDF2-SHA256 hash of a PIN. The PIN itself is never stored. */
export interface PinHash {
  /** base64, 16 random bytes */
  salt: string;
  /** base64, 32 bytes */
  hash: string;
  iterations: number;
}

export interface Profile {
  preferredName: string;
  photo: PhotoRef | null;
  /** Short personal cue / introduction, written by the person. */
  intro: string;
  /** Optional personal details, one per line. */
  details: string[];
  voice: AudioRef | null;
}

export interface Hotspot {
  id: string;
  /** Position as a percentage of the photo's width (0–100). */
  x: number;
  /** Position as a percentage of the photo's height (0–100). */
  y: number;
  label: string;
  detail: string;
}

/** A wide photo of a familiar space with tappable highlights. */
export interface FamiliarSpace {
  id: string;
  label: string;
  photo: PhotoRef | null;
  hotspots: Hotspot[];
}

export interface Place {
  label: string;
  photo: PhotoRef | null;
  /** Landmark cue, e.g. "My front door is blue." */
  cue: string;
  /** Optional full address. Never eligible for the locked view. */
  address: string;
  landmarks: string[];
  spaces: FamiliarSpace[];
}

export interface Contact {
  id: string;
  /** Display name: a first name or a label such as "My helper". */
  name: string;
  relationship: string;
  photo: PhotoRef | null;
  phone: string;
  primary: boolean;
  /**
   * A voice message recorded by this family member, reminding the person who
   * they are, e.g. "Hi Mum, it's Maya, your daughter. You're Peggy…".
   */
  voice: AudioRef | null;
  order: number;
}

export interface ScheduleItem {
  id: string;
  /** Local time, "HH:MM" (24-hour). */
  time: string;
  label: string;
}

export interface Schedule {
  items: ScheduleItem[];
  /** The one cue that may be shown before unlock, e.g. "Lunch at noon". */
  lockedCue: string;
}

export interface RoutineStep {
  id: string;
  text: string;
  photo: PhotoRef | null;
  audio: AudioRef | null;
}

export interface RoutineProgress {
  stepIndex: number;
  updatedAt: number;
}

export interface Routine {
  id: string;
  title: string;
  /** Optional local schedule, "HH:MM". Shown in today's schedule when set. */
  scheduleTime: string | null;
  steps: RoutineStep[];
  progress: RoutineProgress | null;
  order: number;
}

/** A favourite piece of music and the memory it brings back. */
export interface Song {
  id: string;
  title: string;
  /** Who sings or plays it, e.g. "The Riverton Dance Band" or "Sung by Peggy". */
  artist: string;
  /** The memory or story it brings back. */
  note: string;
  photo: PhotoRef | null;
  /** The song itself: a file the family owns or a recording. Transcript describes the music. */
  audio: AudioRef | null;
  order: number;
}

export interface Memory {
  id: string;
  title: string;
  photo: PhotoRef | null;
  caption: string;
  audio: AudioRef | null;
  order: number;
}

/**
 * The allowlist of fields approved for display before unlock.
 * Every switch defaults to false, and at most one contact is eligible.
 */
export interface Approvals {
  youName: boolean;
  youPhoto: boolean;
  youVoice: boolean;
  homePhoto: boolean;
  homeCue: boolean;
  contact: {
    id: string | null;
    name: boolean;
    relationship: boolean;
    photo: boolean;
    call: boolean;
    /** This person's voice message. */
    voice: boolean;
  };
  routineCue: boolean;
}

export type TextSize = 'standard' | 'large' | 'xlarge';
export type CallMode = 'demo' | 'phone';

export interface Prefs {
  textSize: TextSize;
  /** Show Read aloud buttons. */
  readAloud: boolean;
  /** 'demo' never dials. 'phone' hands the number to the phone's dialer. */
  callMode: CallMode;
  /** Favourite music starts by itself after unlock and plays in the background. */
  backgroundMusic: boolean;
}

export interface Security {
  /** Null when the in-app lock is off. */
  personPin: PinHash | null;
  /** Null only in 'new' mode before wizard step 1, and in 'sample' mode. */
  helperPin: PinHash | null;
  lockEnabled: boolean;
  /** Android: show "Tap for help" on the phone's lock screen (real mode only). */
  lockHelp: boolean;
}

export type AppMode = 'new' | 'sample' | 'real';

export interface SetupState {
  mode: AppMode;
  /** First-run step to resume at (1–6). Null once setup is finished. */
  wizardStep: number | null;
  /** When the last backup file was produced (ms since epoch). */
  lastBackupAt: number | null;
}

export interface AppData {
  profile: Profile;
  home: Place;
  contacts: Contact[];
  schedule: Schedule;
  routines: Routine[];
  memories: Memory[];
  songs: Song[];
  approvals: Approvals;
  prefs: Prefs;
  security: Security;
  setup: SetupState;
}

export type TileId = 'home' | 'family' | 'you' | 'routine';
