import type { AppData, CallMode, MediaId } from './types';

/**
 * The only data the locked help screens may read.
 *
 * It is built by copying explicitly approved values out of the full records.
 * No full record, hidden field, or unapproved media reference is ever placed
 * in it. Locked screens receive this object and nothing else.
 */
export interface LockedPhoto {
  id: MediaId;
  alt: string;
}

export type LockedCall = { mode: 'demo' } | { mode: 'phone'; phone: string };

export interface LockedContact {
  name: string | null;
  relationship: string | null;
  photo: LockedPhoto | null;
  call: LockedCall | null;
  /** This person's voice message reminding the person who they are. */
  voice: { id: MediaId; transcript: string } | null;
}

export interface LockedPreview {
  home: { photo: LockedPhoto | null; cue: string | null };
  contact: LockedContact | null;
  you: {
    name: string | null;
    photo: LockedPhoto | null;
    voice: { id: MediaId; transcript: string } | null;
  };
  routineCue: string | null;
  /** Allowlist of media references the locked UI may load. */
  mediaIds: MediaId[];
}

type PreviewSource = Pick<AppData, 'profile' | 'home' | 'contacts' | 'schedule' | 'approvals'> & {
  prefs: { callMode: CallMode };
};

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildLockedPreview(source: PreviewSource): LockedPreview {
  const a = source.approvals;
  const mediaIds: MediaId[] = [];
  const photo = (ref: { id: MediaId; alt: string } | null): LockedPhoto | null => {
    if (!ref) return null;
    mediaIds.push(ref.id);
    return { id: ref.id, alt: ref.alt };
  };

  const home = {
    photo: a.homePhoto ? photo(source.home.photo) : null,
    cue: a.homeCue ? text(source.home.cue) : null,
  };

  let contact: LockedContact | null = null;
  const c = a.contact.id ? source.contacts.find((x) => x.id === a.contact.id) : undefined;
  if (c) {
    const name = a.contact.name ? text(c.name) : null;
    const relationship = a.contact.relationship ? text(c.relationship) : null;
    const contactPhoto = a.contact.photo ? photo(c.photo) : null;
    const phone = text(c.phone);
    let call: LockedCall | null = null;
    if (a.contact.call && phone) {
      // The number is copied only when the helper chose real dialing, after
      // being told the phone's dialer may show it.
      call = source.prefs.callMode === 'phone' ? { mode: 'phone', phone } : { mode: 'demo' };
    }
    const voiceRef = a.contact.voice ? c.voice : null;
    if (voiceRef) mediaIds.push(voiceRef.id);
    const voice = voiceRef ? { id: voiceRef.id, transcript: voiceRef.transcript } : null;
    if (name || relationship || contactPhoto || call || voice) {
      contact = { name, relationship, photo: contactPhoto, call, voice };
    }
  }

  const ownVoice = a.youVoice ? source.profile.voice : null;
  if (ownVoice) mediaIds.push(ownVoice.id);
  const you = {
    name: a.youName ? text(source.profile.preferredName) : null,
    photo: a.youPhoto ? photo(source.profile.photo) : null,
    voice: ownVoice ? { id: ownVoice.id, transcript: ownVoice.transcript } : null,
  };

  return {
    home,
    contact,
    you,
    routineCue: a.routineCue ? text(source.schedule.lockedCue) : null,
    mediaIds: Array.from(new Set(mediaIds)),
  };
}

export function isPreviewEmpty(p: LockedPreview): boolean {
  return (
    !p.home.photo &&
    !p.home.cue &&
    !p.contact &&
    !p.you.name &&
    !p.you.photo &&
    !p.you.voice &&
    !p.routineCue
  );
}
