import type { AppData, Approvals, Place, Prefs, Profile, Schedule, Security, SetupState } from './types';

export function emptySecurity(): Security {
  return { personPin: null, helperPin: null, lockEnabled: true };
}

export function newSetup(): SetupState {
  return { mode: 'new', wizardStep: 1, lastBackupAt: null };
}

export function emptyApprovals(): Approvals {
  return {
    youName: false,
    youPhoto: false,
    youVoice: false,
    homePhoto: false,
    homeCue: false,
    contact: { id: null, name: false, relationship: false, photo: false, call: false, voice: false },
    routineCue: false,
  };
}

export function emptyProfile(): Profile {
  return { preferredName: '', photo: null, intro: '', details: [], voice: null };
}

export function emptyPlace(): Place {
  return { label: 'My home', photo: null, cue: '', address: '', landmarks: [], spaces: [] };
}

export function emptySchedule(): Schedule {
  return { items: [], lockedCue: '' };
}

export function defaultPrefs(): Prefs {
  return { textSize: 'standard', readAloud: true, callMode: 'phone', backgroundMusic: true };
}

/** A blank profile with an empty locked preview. */
export function emptyAppData(): AppData {
  return {
    profile: emptyProfile(),
    home: emptyPlace(),
    contacts: [],
    schedule: emptySchedule(),
    routines: [],
    memories: [],
    songs: [],
    approvals: emptyApprovals(),
    prefs: defaultPrefs(),
    security: emptySecurity(),
    setup: newSetup(),
  };
}

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
