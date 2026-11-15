import { describe, expect, it } from 'vitest';
import { emptyAppData, emptyApprovals } from '../lib/defaults';
import { DEFAULT_HELP_MESSAGE, buildLockedPreview, isPreviewEmpty } from '../lib/preview';
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
    // The help card's "Who to call" switch is a separate choice that also shares the number.
    const noCall = withApprovals(phoneMode, {
      contact: { ...data.approvals.contact, call: false },
      helpCard: { ...data.approvals.helpCard, contact: false },
    });
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

describe("today's note before unlock", () => {
  const note = { text: '  Maya is coming at 2 today.  ', until: 1_000 };

  it('shows only when its switch is on and the text is not blank', () => {
    const data = { ...emptyAppData(), schedule: { ...emptyAppData().schedule, note } };
    expect(buildLockedPreview(data).note).toBeNull();
    const on = withApprovals(data, { note: true });
    expect(buildLockedPreview(on).note).toEqual({ text: 'Maya is coming at 2 today.', until: 1_000 });
    expect(isPreviewEmpty(buildLockedPreview(on))).toBe(false);
    const blank = { ...on, schedule: { ...on.schedule, note: { text: '   ', until: 1_000 } } };
    expect(buildLockedPreview(blank).note).toBeNull();
  });
});

describe('help card', () => {
  const card = (patch: Partial<AppData['approvals']['helpCard']>) => (data: AppData) =>
    withApprovals(data, { helpCard: { ...data.approvals.helpCard, ...patch } });

  it('shares nothing personal until switches are turned on', () => {
    const data = { ...demoAppData(), approvals: emptyApprovals() };
    expect(buildLockedPreview(data).helpCard).toEqual({ message: DEFAULT_HELP_MESSAGE, name: null, contact: null, address: null });
    expect(isPreviewEmpty(buildLockedPreview(data))).toBe(true);
  });

  it('uses the helper message, the name and the address when switched on', () => {
    const base = { ...demoAppData(), approvals: emptyApprovals() };
    const p = buildLockedPreview(card({ message: '  I am lost.  ', name: true, address: true })(base));
    expect(p.helpCard.message).toBe('I am lost.');
    expect(p.helpCard.name).toBe('Peggy');
    expect(p.helpCard.address).toBe('14 Elm Street, Riverton RT4 2AB');
    expect(p.helpCard.contact).toBeNull();
  });

  it('names the before-unlock contact, or else the primary one, with a call only in phone mode and with a number', () => {
    const demo = demoAppData();
    const chosen = buildLockedPreview(card({ contact: true })(demo));
    expect(chosen.helpCard.contact).toEqual({ name: 'Maya', call: { mode: 'demo' } });

    const phoneMode = { ...demo, prefs: { ...demo.prefs, callMode: 'phone' as const } };
    expect(buildLockedPreview(card({ contact: true })(phoneMode)).helpCard.contact?.call).toEqual({ mode: 'phone', phone: '07700 900123' });

    const noneChosen = card({ contact: true })({ ...demo, approvals: { ...demo.approvals, contact: { ...demo.approvals.contact, id: null } } });
    const primary = demo.contacts.find((c) => c.primary)!;
    expect(buildLockedPreview(noneChosen).helpCard.contact?.name).toBe(primary.name);

    const noNumber = { ...phoneMode, contacts: phoneMode.contacts.map((c) => ({ ...c, phone: '' })) };
    expect(buildLockedPreview(card({ contact: true })(noNumber)).helpCard.contact?.call).toBeNull();

    const nobody = card({ contact: true })({ ...demo, contacts: [] });
    expect(buildLockedPreview(nobody).helpCard.contact).toBeNull();
  });
});
