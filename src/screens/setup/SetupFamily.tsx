import { useState } from 'react';
import { ChevronRight, Lock, Mic, Plus, Trash2, UserPlus } from 'lucide-react';
import { useNav } from '../../app/nav';
import { AudioField, PhotoField, TextField } from '../../components/fields';
import { ConfirmDialog } from '../../components/Modal';
import { Photo } from '../../components/Photo';
import { ShowBeforeUnlock, Switch } from '../../components/Switch';
import { Button, Card, Notice } from '../../components/ui';
import { emptyApprovals, newId } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { Approvals, Contact } from '../../lib/types';
import { sortContacts } from '../companion/FamilyViews';
import { SectionTitle, SetupPage, useDraft } from './common';

export function SetupFamily() {
  const { data } = useStore();
  const { navigate } = useNav();
  const lockedId = data.approvals.contact.id;
  const contacts = sortContacts(data.contacts);

  return (
    <SetupPage
      title="Family"
      sub="People to call. Each person can record a voice message to remind the person who they are. One person can be shown before unlock."
    >
      {contacts.length === 0 ? <Notice>No one has been added yet.</Notice> : null}
      <div className="stack stack-sm">
        {contacts.map((c) => (
          <button key={c.id} type="button" className="list-button contact-setup-row" onClick={() => navigate(`/setup/family/${c.id}`)}>
            <Photo photo={c.photo} kind="person" name={c.name} className="photo-avatar-sm" />
            <span className="list-button-text">
              <span>
                {c.name || 'Unnamed'}
                {c.primary ? <span className="badge">Main</span> : null}
              </span>
              <span className="list-button-sub">{c.relationship || 'No relationship added'}</span>
              <span className={`list-button-sub${c.voice ? ' voice-flag' : ''}`}>
                <Mic size={16} strokeWidth={2.5} aria-hidden /> {c.voice ? 'Voice message recorded' : 'No voice message yet'}
              </span>
              {lockedId === c.id ? (
                <span className="list-button-sub shown-flag">
                  <Lock size={16} strokeWidth={2.5} aria-hidden /> Shown before unlock
                </span>
              ) : null}
            </span>
            <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
          </button>
        ))}
      </div>
      <Button variant="primary" icon={UserPlus} onClick={() => navigate('/setup/family/new')}>
        Add a person
      </Button>
    </SetupPage>
  );
}

interface LockFlags {
  name: boolean;
  relationship: boolean;
  photo: boolean;
  call: boolean;
  voice: boolean;
}

/** An example message in this person's own words, e.g. "Hi, it's Priya, your care partner. You're Peggy…". */
export function voiceExample(contact: Pick<Contact, 'name' | 'relationship'>, preferredName: string): string {
  const name = contact.name.trim() || 'Maya';
  const relationship = contact.relationship.trim().replace(/^my\s+/i, '');
  const person = preferredName.trim();
  const who = relationship ? `it’s ${name}, your ${relationship}` : `it’s ${name}`;
  const you = person ? `You’re ${person}, and you’re safe.` : 'You’re safe, and you’re loved.';
  return `Hi, ${who}. ${you}`;
}

const NO_FLAGS: LockFlags ={ name: false, relationship: false, photo: false, call: false, voice: false };

function flagsFor(a: Approvals['contact'], contactId: string): LockFlags {
  return a.id === contactId
    ? { name: a.name, relationship: a.relationship, photo: a.photo, call: a.call, voice: a.voice }
    : { ...NO_FLAGS };
}

interface Draft {
  contact: Contact;
  lock: LockFlags;
}

/**
 * Only one person can be shown before unlock. Turning on any switch for this
 * person moves the locked contact here; turning them all off removes it.
 * Switches for empty fields are saved as off.
 */
export function mergeContactApprovals(base: Approvals, d: Draft): Approvals {
  const c = d.contact;
  const flags = {
    name: d.lock.name && !!c.name.trim(),
    relationship: d.lock.relationship && !!c.relationship.trim(),
    photo: d.lock.photo && !!c.photo,
    call: d.lock.call && !!c.phone.trim(),
    voice: d.lock.voice && !!c.voice,
  };
  const anyOn = flags.name || flags.relationship || flags.photo || flags.call || flags.voice;
  if (anyOn) return { ...base, contact: { id: c.id, ...flags } };
  if (base.contact.id === c.id) return { ...base, contact: emptyApprovals().contact };
  return base;
}

export function SetupContact({ contactId }: { contactId: string }) {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<Draft>(() => {
    const found = data.contacts.find((c) => c.id === contactId);
    const contact: Contact = found ?? {
      id: newId('contact'),
      name: '',
      relationship: '',
      photo: null,
      phone: '',
      primary: data.contacts.length === 0,
      voice: null,
      order: data.contacts.reduce((m, c) => Math.max(m, c.order + 1), 0),
    };
    return { contact, lock: flagsFor(data.approvals.contact, contact.id) };
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const c = draft.contact;
  const isNew = !data.contacts.some((x) => x.id === c.id);
  const setContact = (patch: Partial<Contact>) => setDraft((d) => ({ ...d, contact: { ...d.contact, ...patch } }));
  const setLock = (patch: Partial<LockFlags>) => setDraft((d) => ({ ...d, lock: { ...d.lock, ...patch } }));

  const otherLocked = data.approvals.contact.id && data.approvals.contact.id !== c.id
    ? data.contacts.find((x) => x.id === data.approvals.contact.id)
    : undefined;
  const anyLockOn = draft.lock.name || draft.lock.relationship || draft.lock.photo || draft.lock.call || draft.lock.voice;

  const withContact = (list: Contact[], contact: Contact): Contact[] => {
    const exists = list.some((x) => x.id === contact.id);
    let next = exists ? list.map((x) => (x.id === contact.id ? contact : x)) : [...list, contact];
    if (contact.primary) next = next.map((x) => (x.id === contact.id ? x : { ...x, primary: false }));
    return next;
  };

  const cleaned = (): Contact => ({
    ...c,
    name: c.name.trim(),
    relationship: c.relationship.trim(),
    phone: c.phone.trim(),
  });

  const firstName = c.name.trim() || 'this person';

  return (
    <SetupPage
      title={isNew ? 'Add a person' : c.name.trim() || 'Person'}
      dirty={dirty}
      backPath="/setup/family"
      backLabel="Back to Family setup"
      previewSource={{
        ...data,
        contacts: withContact(data.contacts, c),
        approvals: mergeContactApprovals(data.approvals, draft),
      }}
      onSave={async () => {
        const contact = cleaned();
        const next = { ...draft, contact };
        const approvals = mergeContactApprovals(data.approvals, next);
        await save({ contacts: withContact(data.contacts, contact), approvals });
        markSaved({ contact, lock: flagsFor(approvals.contact, contact.id) });
      }}
    >
      <Card>
        <TextField
          label="Name"
          hint='A first name, or a label such as "My helper".'
          value={c.name}
          onChange={(v) => setContact({ name: v })}
          maxLength={60}
        />
        <TextField
          label="Relationship"
          hint='For example: "My daughter" or "My care partner".'
          value={c.relationship}
          onChange={(v) => setContact({ relationship: v })}
          maxLength={60}
        />
        <TextField label="Phone number" type="tel" inputMode="tel" value={c.phone} onChange={(v) => setContact({ phone: v })} maxLength={30} />
        <Switch
          label="Main contact"
          description="Shown first in Family."
          checked={c.primary}
          onChange={(v) => setContact({ primary: v })}
        />
      </Card>
      <Card>
        <PhotoField
          label="Photo"
          kind="person"
          name={c.name}
          value={c.photo}
          defaultAlt={c.name.trim() ? `${c.name.trim()} smiling` : 'Photo of my contact'}
          onChange={(photo) => setContact({ photo })}
        />
      </Card>

      <Card>
        <AudioField
          label={`A voice message from ${c.name.trim() || 'this person'}`}
          value={c.voice}
          onChange={(voice) => setContact({ voice })}
          transcriptLabel="The words, for reading"
          noun="message"
        />
        <p className="field-hint">
          Record {c.name.trim() || 'them'} saying who they are and who the person is. For example: “{voiceExample(c, data.profile.preferredName)}”
          It plays from You and Family, only when tapped.
        </p>
      </Card>

      <SectionTitle>Before unlock</SectionTitle>
      <Card>
        <p className="field-hint">Only one person can appear on the locked help screen. Each switch starts off.</p>
        {otherLocked ? (
          <Notice tone="warn">
            {otherLocked.name || 'Someone else'} is shown before unlock now.
            {anyLockOn ? ` Saving will show ${firstName} instead.` : ` Turning on a switch here will show ${firstName} instead.`}
          </Notice>
        ) : null}
        <ShowBeforeUnlock
          what={`${firstName}'s name`}
          checked={draft.lock.name && !!c.name.trim()}
          disabled={!c.name.trim()}
          onChange={(v) => setLock({ name: v })}
          label="Show name before unlock"
          note={!c.name.trim() ? 'Add a name first.' : undefined}
        />
        <ShowBeforeUnlock
          what={`${firstName}'s relationship`}
          checked={draft.lock.relationship && !!c.relationship.trim()}
          disabled={!c.relationship.trim()}
          onChange={(v) => setLock({ relationship: v })}
          label="Show relationship before unlock"
          note={!c.relationship.trim() ? 'Add a relationship first.' : undefined}
        />
        <ShowBeforeUnlock
          what={`${firstName}'s photo`}
          checked={draft.lock.photo && !!c.photo}
          disabled={!c.photo}
          onChange={(v) => setLock({ photo: v })}
          label="Show photo before unlock"
          note={!c.photo ? 'Add a photo first.' : undefined}
        />
        <ShowBeforeUnlock
          what={`Call button for ${firstName}`}
          checked={draft.lock.call && !!c.phone.trim()}
          disabled={!c.phone.trim()}
          onChange={(v) => setLock({ call: v })}
          label="Show Call button before unlock"
          note={!c.phone.trim() ? 'Add a phone number first.' : undefined}
        />
        <ShowBeforeUnlock
          what={`${firstName}'s voice message`}
          checked={draft.lock.voice && !!c.voice}
          disabled={!c.voice}
          onChange={(v) => setLock({ voice: v })}
          label="Show voice message before unlock"
          note={!c.voice ? 'Record a message first.' : 'Plays from Family and You on the locked screen, only when tapped.'}
        />
        <Notice icon={Lock}>
          {data.prefs.callMode === 'demo'
            ? 'In the sample family, the call button shows who would be called and nobody is phoned. '
            : 'Calls open the phone’s own dialer. '}
          On a real phone, calling from the lock screen can show this number in the phone’s dialer. The number is never
          shown on the help screen itself.
        </Notice>
      </Card>

      {!isNew ? (
        <Button variant="danger" size="md" icon={Trash2} onClick={() => setConfirmRemove(true)}>
          Remove {firstName} from Family
        </Button>
      ) : (
        <Notice icon={Plus}>Save to add {firstName} to Family.</Notice>
      )}
      {confirmRemove ? (
        <ConfirmDialog
          title={`Remove ${firstName}?`}
          body={<p>{firstName} will be removed from Family and from the locked help screen on this phone.</p>}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setConfirmRemove(false);
            const approvals = data.approvals.contact.id === c.id ? { ...data.approvals, contact: emptyApprovals().contact } : data.approvals;
            await save({ contacts: data.contacts.filter((x) => x.id !== c.id), approvals });
            markSaved(draft);
            navigate('/setup/family', { replace: true });
          }}
        />
      ) : null}
    </SetupPage>
  );
}
