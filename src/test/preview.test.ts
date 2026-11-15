import { describe, expect, it } from 'vitest';
import { emptyAppData, emptyApprovals } from '../lib/defaults';
import { buildLockedPreview, isPreviewEmpty } from '../lib/preview';
import { demoAppData } from '../lib/seed';
import type { AppData } from '../lib/types';

function withApprovals(data: AppData, patch: Partial<AppData['approvals']>): AppData {
  return { ...data, approvals: { ...data.approvals, ...patch } };
}

describe('buildLockedPreview', () => {
  it('is empty when nothing is approved', () => {
    const data = { ...demoAppData(), approvals: emptyApprovals() };
    const p = buildLockedPreview(data);
    expect(isPreviewEmpty(p)).toBe(true);
    expect(p.mediaIds).toEqual([]);
    expect(p.contact).toBeNull();
  });

  it('defaults to an empty preview for a blank profile', () => {
    expect(isPreviewEmpty(buildLockedPreview(emptyAppData()))).toBe(true);
  });

  it('copies only approved values from the demo profile', () => {
    const p = buildLockedPreview(demoAppData());
    expect(p.home).toEqual({
      photo: { id: 'demo-front-door', alt: expect.any(String) },
      cue: 'My front door is blue, with red flowers on each side.',
    });
    expect(p.contact).toEqual({
      name: 'Maya',
      relationship: 'My daughter',
      photo: { id: 'demo-maya', alt: expect.any(String) },
      call: { mode: 'demo' },
      voice: { id: 'demo-maya-message', transcript: expect.stringContaining("it's Maya, your daughter") },
    });
    expect(p.you).toEqual({ name: 'Peggy', photo: { id: 'demo-peggy', alt: expect.any(String) }, voice: null });
    expect(p.routineCue).toBe('Lunch at noon');
    expect(p.mediaIds.sort()).toEqual(['demo-front-door', 'demo-maya', 'demo-maya-message', 'demo-peggy']);
  });

  it('never includes private fields', () => {
    const data = demoAppData();
    const json = JSON.stringify(buildLockedPreview(data));
    const secrets = [
      data.home.address,
      ...data.home.landmarks,
      ...data.contacts.map((c) => c.phone),
      'Sam',
      'Priya',
      data.profile.intro,
      ...data.profile.details,
      // "Lunch" is part of the approved cue "Lunch at noon", so it is not a secret here.
      ...data.schedule.items.map((i) => i.label).filter((l) => l !== 'Lunch'),
      ...data.routines.map((r) => r.title),
      // "Biscuit" (the cat) is named in Maya's approved voice message, so it is not a secret here.
      ...data.memories.map((m) => m.title).filter((t) => t !== 'Biscuit'),
      ...data.songs.flatMap((s) => [s.title, s.note]),
      'demo-song-waltz',
      'demo-record-player',
      'demo-kitchen',
      'demo-sam',
      'demo-peggy-voice',
      'demo-sam-message',
      ...data.contacts.filter((c) => c.id !== 'contact-maya').flatMap((c) => (c.voice ? [c.voice.transcript] : [])),
    ];
    for (const s of secrets) expect(json).not.toContain(s);
  });

  it('removes a field as soon as its approval is revoked', () => {
    const data = demoAppData();
    const p = buildLockedPreview(withApprovals(data, { homeCue: false, contact: { ...data.approvals.contact, photo: false } }));
    expect(p.home.cue).toBeNull();
    expect(p.contact?.photo).toBeNull();
    expect(p.mediaIds).not.toContain('demo-maya');
  });

  it('never copies the phone number in demo call mode', () => {
    const p = buildLockedPreview(demoAppData());
    expect(JSON.stringify(p)).not.toContain('07700');
  });

  it('copies the number only for real dialing with an approved call button', () => {
    const data = demoAppData();
    const phoneMode = { ...data, prefs: { ...data.prefs, callMode: 'phone' as const } };
    expect(buildLockedPreview(phoneMode).contact?.call).toEqual({ mode: 'phone', phone: '07700 900123' });
    const noCall = withApprovals(phoneMode, { contact: { ...data.approvals.contact, call: false } });
    expect(JSON.stringify(buildLockedPreview(noCall))).not.toContain('07700');
  });

  it("includes a family member's voice message only when approved", () => {
    const data = demoAppData();
    const off = buildLockedPreview(withApprovals(data, { contact: { ...data.approvals.contact, voice: false } }));
    expect(off.contact?.voice).toBeNull();
    expect(off.mediaIds).not.toContain('demo-maya-message');
    expect(JSON.stringify(off)).not.toContain('your daughter. You');
    // A voice message alone is enough for a contact card.
    const voiceOnly = buildLockedPreview(
      withApprovals(data, { contact: { id: 'contact-maya', name: false, relationship: false, photo: false, call: false, voice: true } }),
    );
    expect(voiceOnly.contact).toEqual({ name: null, relationship: null, photo: null, call: null, voice: expect.any(Object) });
    expect(voiceOnly.mediaIds).toContain('demo-maya-message');
    expect(voiceOnly.mediaIds).not.toContain('demo-maya');
  });

  it('only includes the voice clip when approved', () => {
    const p = buildLockedPreview(withApprovals(demoAppData(), { youVoice: true }));
    expect(p.you.voice?.id).toBe('demo-peggy-voice');
    expect(p.mediaIds).toContain('demo-peggy-voice');
  });

  it('drops a contact card whose person was removed', () => {
    const data = demoAppData();
    const p = buildLockedPreview({ ...data, contacts: data.contacts.filter((c) => c.id !== 'contact-maya') });
    expect(p.contact).toBeNull();
  });

  it('treats blank approved text as not shown', () => {
    const data = demoAppData();
    const p = buildLockedPreview({ ...data, schedule: { ...data.schedule, lockedCue: '   ' } });
    expect(p.routineCue).toBeNull();
  });

  it('drops the contact card when no field is approved', () => {
    const data = demoAppData();
    const p = buildLockedPreview(
      withApprovals(data, { contact: { id: 'contact-maya', name: false, relationship: false, photo: false, call: false, voice: false } }),
    );
    expect(p.contact).toBeNull();
  });
});
