import { useState } from 'react';
import { ArrowRight, Check, Eye } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ChoosePin } from '../../components/ChoosePin';
import { PhotoField, TextField } from '../../components/fields';
import { Switch } from '../../components/Switch';
import { Button, Card, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { persistStorage } from '../../lib/db';
import { newId } from '../../lib/defaults';
import { hashPin } from '../../lib/pin';
import { HELPER_PIN_LENGTH, PIN_LENGTH } from '../../lib/session';
import { useStore } from '../../lib/store';
import type { AppData, Approvals, Contact } from '../../lib/types';
import { LockedPreviewModal } from '../setup/common';

type Next = (changes?: Partial<AppData>) => Promise<void>;

/**
 * The six-step first run. The current step is saved in setup.wizardStep, and
 * each step saves on Next or Skip, so closing the app resumes where it was.
 */
export function SetupWizard() {
  const { data, save } = useStore();
  const { restart } = useNav();
  const [problem, setProblem] = useState<string | null>(null);
  const step = data.setup.wizardStep ?? 1;
  const total = data.security.lockEnabled ? 6 : 5;

  const go = async (target: number, changes: Partial<AppData> = {}) => {
    setProblem(null);
    // A step that turns the lock off shortens the wizard.
    const lockOn = (changes.security ?? data.security).lockEnabled;
    const last = lockOn ? 6 : 5;
    try {
      if (target > last) {
        await save({ ...changes, setup: { ...data.setup, mode: 'real', wizardStep: null } });
        void persistStorage();
        restart({ unlocked: true, flash: 'setup-done' });
      } else {
        await save({ ...changes, setup: { ...data.setup, wizardStep: target } });
      }
    } catch {
      setProblem("That couldn't be saved. Please try again.");
    }
  };

  const next: Next = (changes) => go(step + 1, changes);
  const skip = () => go(step + 1);
  const isLast = step === total;

  return (
    <Screen
      top={<TopBar back={step > 1 ? { label: 'Back', onClick: () => void go(step - 1) } : undefined} />}
      label="Set up Familiar Place"
    >
      <p className="wizard-count">
        Step {step} of {total}
      </p>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {step === 1 ? <HelperPinStep data={data} onNext={next} /> : null}
      {step === 2 ? <AboutStep data={data} onNext={next} /> : null}
      {step === 3 ? <PinStep data={data} onNext={next} /> : null}
      {step === 4 ? <HomeStep data={data} onNext={next} onSkip={skip} /> : null}
      {step === 5 ? <ContactStep data={data} onNext={next} onSkip={skip} last={isLast} /> : null}
      {step === 6 ? <ApprovalsStep data={data} onNext={next} /> : null}
    </Screen>
  );
}

function HelperPinStep({ data, onNext }: { data: AppData; onNext: Next }) {
  return (
    <>
      <Heading sub="Only people who know this can change Familiar Place. Keep it somewhere safe.">Choose a helper PIN</Heading>
      <ChoosePin
        length={HELPER_PIN_LENGTH}
        onChosen={async (pin) => onNext({ security: { ...data.security, helperPin: await hashPin(pin) } })}
      />
    </>
  );
}

function AboutStep({ data, onNext }: { data: AppData; onNext: Next }) {
  const [name, setName] = useState(data.profile.preferredName);
  const [photo, setPhoto] = useState(data.profile.photo);
  const trimmed = name.trim();
  return (
    <>
      <Heading sub="The name they like to be called, and a photo they recognise.">About them</Heading>
      <Stack>
        <TextField label="Preferred name" value={name} onChange={setName} maxLength={60} />
        <PhotoField
          label="Their photo (optional)"
          value={photo}
          onChange={setPhoto}
          kind="person"
          defaultAlt={trimmed ? `Photo of ${trimmed}` : 'Their photo'}
          name={trimmed}
        />
        <Button
          variant="primary"
          icon={ArrowRight}
          disabled={!trimmed}
          onClick={() => void onNext({ profile: { ...data.profile, preferredName: trimmed, photo } })}
        >
          Next
        </Button>
      </Stack>
    </>
  );
}

function PinStep({ data, onNext }: { data: AppData; onNext: Next }) {
  return (
    <>
      <Heading sub="They'll use it to open Familiar Place. Use a different PIN from the phone's own passcode.">
        Choose their PIN
      </Heading>
      <ChoosePin
        length={PIN_LENGTH}
        onChosen={async (pin) =>
          onNext({ security: { ...data.security, personPin: await hashPin(pin), lockEnabled: true } })
        }
      />
      <Stack gap="sm">
        <Button
          variant="quiet"
          size="md"
          onClick={() => void onNext({ security: { ...data.security, personPin: null, lockEnabled: false } })}
        >
          Don't use a PIN
        </Button>
        <p className="field-hint">Without a PIN, Familiar Place opens straight to Today.</p>
      </Stack>
    </>
  );
}

function HomeStep({ data, onNext, onSkip }: { data: AppData; onNext: Next; onSkip: () => void }) {
  const [photo, setPhoto] = useState(data.home.photo);
  const [cue, setCue] = useState(data.home.cue);
  const [address, setAddress] = useState(data.home.address);
  return (
    <>
      <Heading sub="A photo and a few words help them recognise home.">Home</Heading>
      <Stack>
        <PhotoField label="Photo of home (optional)" value={photo} onChange={setPhoto} defaultAlt="The front of home" />
        <TextField
          label="Something to recognise it by (optional)"
          hint='For example: "My front door is blue."'
          value={cue}
          onChange={setCue}
        />
        <TextField label="Address (optional)" hint="Shown only after unlock." value={address} onChange={setAddress} />
        <Button
          variant="primary"
          icon={ArrowRight}
          onClick={() => void onNext({ home: { ...data.home, photo, cue: cue.trim(), address: address.trim() } })}
        >
          Next
        </Button>
        <Button variant="quiet" size="md" onClick={onSkip}>
          Skip for now
        </Button>
      </Stack>
    </>
  );
}

function ContactStep({
  data,
  onNext,
  onSkip,
  last,
}: {
  data: AppData;
  onNext: Next;
  onSkip: () => void;
  last: boolean;
}) {
  // Editing the first contact, so going Back and Next never adds a second one.
  const existing: Contact | undefined = data.contacts[0];
  const [name, setName] = useState(existing?.name ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [photo, setPhoto] = useState(existing?.photo ?? null);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    if (!name.trim()) return onSkip();
    if (!phone.trim()) {
      setError(`Add a phone number, or tap ${last ? 'Skip and finish' : 'Skip for now'}.`);
      return;
    }
    const contact: Contact = {
      id: existing?.id ?? newId('contact'),
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      photo,
      primary: true,
      voice: existing?.voice ?? null,
      order: 0,
    };
    void onNext({ contacts: [contact, ...data.contacts.slice(1)] });
  };

  return (
    <>
      <Heading sub="The person they'd most like to call for help. You can add more people later.">Someone they trust</Heading>
      <Stack>
        <TextField label="Name" value={name} onChange={setName} maxLength={60} />
        <TextField label="Relationship (optional)" hint="For example: My daughter" value={relationship} onChange={setRelationship} />
        <TextField label="Phone number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={setPhone} />
        <PhotoField
          label="Their photo (optional)"
          value={photo}
          onChange={setPhoto}
          kind="person"
          defaultAlt={name.trim() ? `Photo of ${name.trim()}` : 'Photo'}
          name={name.trim()}
        />
        {error ? (
          <div role="alert">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}
        <Button variant="primary" icon={last ? Check : ArrowRight} onClick={next}>
          {last ? 'Finish' : 'Next'}
        </Button>
        <Button variant="quiet" size="md" onClick={onSkip}>
          {last ? 'Skip and finish' : 'Skip for now'}
        </Button>
      </Stack>
    </>
  );
}

function ApprovalsStep({ data, onNext }: { data: AppData; onNext: Next }) {
  const [a, setA] = useState<Approvals>(data.approvals);
  const [previewing, setPreviewing] = useState(false);
  const p = data.profile;
  const h = data.home;
  const c: Contact | undefined = data.contacts[0];
  const setContact = (patch: Partial<Approvals['contact']>) =>
    setA((x) => ({ ...x, contact: { ...x.contact, ...patch, id: c?.id ?? null } }));

  const rows: Array<{ label: string; show: boolean; checked: boolean; set: (v: boolean) => void; description?: string }> = [
    { label: `Their name (${p.preferredName})`, show: !!p.preferredName.trim(), checked: a.youName, set: (v) => setA((x) => ({ ...x, youName: v })) },
    { label: 'Their photo', show: !!p.photo, checked: a.youPhoto, set: (v) => setA((x) => ({ ...x, youPhoto: v })) },
    { label: 'Photo of home', show: !!h.photo, checked: a.homePhoto, set: (v) => setA((x) => ({ ...x, homePhoto: v })) },
    { label: `“${h.cue}”`, show: !!h.cue.trim(), checked: a.homeCue, set: (v) => setA((x) => ({ ...x, homeCue: v })) },
  ];
  if (c) {
    rows.push(
      { label: `${c.name}'s name`, show: true, checked: a.contact.name, set: (v) => setContact({ name: v }) },
      { label: `${c.name}'s relationship`, show: !!c.relationship.trim(), checked: a.contact.relationship, set: (v) => setContact({ relationship: v }) },
      { label: `${c.name}'s photo`, show: !!c.photo, checked: a.contact.photo, set: (v) => setContact({ photo: v }) },
      {
        label: `Button to call ${c.name}`,
        show: !!c.phone.trim(),
        checked: a.contact.call,
        set: (v) => setContact({ call: v }),
        description: "The phone's dialer may show this number on the lock screen.",
      },
    );
  }
  const visible = rows.filter((r) => r.show);

  return (
    <>
      <Heading sub="Choose what may show on the help screen while Familiar Place is locked. Everything else stays private. You can change this later.">
        Before unlock
      </Heading>
      <Stack>
        {visible.length ? (
          <Card>
            {visible.map((r) => (
              <Switch key={r.label} label={r.label} description={r.description} checked={r.checked} onChange={r.set} />
            ))}
          </Card>
        ) : (
          <Notice>Nothing has been added yet that could show before unlock.</Notice>
        )}
        <Button icon={Eye} onClick={() => setPreviewing(true)}>
          Preview locked view
        </Button>
        <Button variant="primary" icon={Check} onClick={() => void onNext({ approvals: a })}>
          Finish
        </Button>
      </Stack>
      {previewing ? <LockedPreviewModal source={{ ...data, approvals: a }} onClose={() => setPreviewing(false)} /> : null}
    </>
  );
}
