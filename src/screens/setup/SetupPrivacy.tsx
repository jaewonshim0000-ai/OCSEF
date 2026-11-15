import { useState, type ReactNode } from 'react';
import { CalendarClock, EyeOff, House, ShieldCheck, UserRound, Users } from 'lucide-react';
import { ConfirmDialog } from '../../components/Modal';
import { Button, Card, Notice } from '../../components/ui';
import { emptyApprovals } from '../../lib/defaults';
import { isPreviewEmpty } from '../../lib/preview';
import { useStore } from '../../lib/store';
import type { Approvals } from '../../lib/types';
import { SetupPage } from './common';

/**
 * Everything currently shown before unlock, each with its own "Stop showing"
 * button. Stopping takes effect immediately, with no Save step.
 */
export function SetupPrivacy() {
  const { data, preview, save } = useStore();
  const [confirmAll, setConfirmAll] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lastStopped, setLastStopped] = useState<string | null>(null);
  const a = data.approvals;

  const revoke = async (what: string, change: (a: Approvals) => Approvals) => {
    try {
      await save({ approvals: change(data.approvals) });
      setProblem(null);
      setLastStopped(what);
    } catch {
      setProblem("That change couldn't be saved. Please try again.");
    }
  };

  const contact = a.contact.id ? data.contacts.find((c) => c.id === a.contact.id) : undefined;
  const p = preview;

  return (
    <SetupPage
      title="Before unlock"
      sub="Only these things appear on the help screen while the phone is locked. Everything else stays private."
      previewSource={data}
    >
      <p className="sr-only" role="status">
        {lastStopped ? `${lastStopped} is no longer shown before unlock.` : ''}
      </p>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {!data.security.lockEnabled ? (
        <Notice icon={ShieldCheck}>The lock is off, so nothing here is used right now. Turn the PIN on in Settings to use it.</Notice>
      ) : null}
      {isPreviewEmpty(p) ? (
        <Notice tone="ok" icon={ShieldCheck}>
          Nothing is shown before unlock. The locked help screen still shows the four buttons, each with a short note.
        </Notice>
      ) : null}

      <Group title="Home" Icon={House}>
        {p.home.photo ? <Item label="Home photo" onStop={() => revoke('Home photo', (x) => ({ ...x, homePhoto: false }))} /> : null}
        {p.home.cue ? <Item label={`Landmark cue: “${p.home.cue}”`} onStop={() => revoke('Landmark cue', (x) => ({ ...x, homeCue: false }))} /> : null}
        {!p.home.photo && !p.home.cue ? <Empty /> : null}
      </Group>

      <Group title="Family" Icon={Users}>
        {p.contact && contact ? (
          <>
            <p className="privacy-who">Shown person: {contact.name || 'Unnamed'}</p>
            {p.contact.name ? <Item label="Name" onStop={() => revoke('Name', (x) => ({ ...x, contact: { ...x.contact, name: false } }))} /> : null}
            {p.contact.relationship ? (
              <Item label="Relationship" onStop={() => revoke('Relationship', (x) => ({ ...x, contact: { ...x.contact, relationship: false } }))} />
            ) : null}
            {p.contact.photo ? <Item label="Photo" onStop={() => revoke('Photo', (x) => ({ ...x, contact: { ...x.contact, photo: false } }))} /> : null}
            {p.contact.call ? (
              <Item
                label={p.contact.call.mode === 'demo' ? 'Call button (demo call)' : 'Call button (opens the dialer)'}
                onStop={() => revoke('Call button', (x) => ({ ...x, contact: { ...x.contact, call: false } }))}
              />
            ) : null}
            {p.contact.voice ? (
              <Item label="Voice message" onStop={() => revoke('Voice message', (x) => ({ ...x, contact: { ...x.contact, voice: false } }))} />
            ) : null}
            <Button
              size="md"
              icon={EyeOff}
              onClick={() => revoke(contact.name || 'This person', (x) => ({ ...x, contact: emptyApprovals().contact }))}
            >
              Remove {contact.name || 'this person'} from the locked screen
            </Button>
          </>
        ) : (
          <Empty />
        )}
      </Group>

      <Group title="You" Icon={UserRound}>
        {p.you.name ? <Item label={`Preferred name: ${p.you.name}`} onStop={() => revoke('Preferred name', (x) => ({ ...x, youName: false }))} /> : null}
        {p.you.photo ? <Item label="Photo" onStop={() => revoke('Photo', (x) => ({ ...x, youPhoto: false }))} /> : null}
        {p.you.voice ? <Item label="Voice message" onStop={() => revoke('Voice message', (x) => ({ ...x, youVoice: false }))} /> : null}
        {!p.you.name && !p.you.photo && !p.you.voice ? <Empty /> : null}
      </Group>

      <Group title="Routine" Icon={CalendarClock}>
        {p.routineCue ? (
          <Item label={`Reminder: “${p.routineCue}”`} onStop={() => revoke('Routine reminder', (x) => ({ ...x, routineCue: false }))} />
        ) : (
          <Empty />
        )}
      </Group>

      <p className="field-hint">To add something, open that section and turn on its “Show before unlock” switch.</p>

      {!isPreviewEmpty(p) ? (
        <Button variant="danger" size="md" icon={EyeOff} onClick={() => setConfirmAll(true)}>
          Stop showing everything
        </Button>
      ) : null}
      {confirmAll ? (
        <ConfirmDialog
          title="Stop showing everything?"
          body={<p>The locked help screen will show nothing personal. You can turn items back on in each section.</p>}
          confirmLabel="Stop showing everything"
          danger
          onCancel={() => setConfirmAll(false)}
          onConfirm={() => {
            setConfirmAll(false);
            revoke('Everything', () => emptyApprovals());
          }}
        />
      ) : null}
    </SetupPage>
  );
}

function Group({ title, Icon, children }: { title: string; Icon: typeof House; children: ReactNode }) {
  return (
    <Card>
      <h2 className="card-title">
        <Icon size={24} strokeWidth={2.5} aria-hidden /> {title}
      </h2>
      <div className="stack stack-sm">{children}</div>
    </Card>
  );
}

function Item({ label, onStop }: { label: string; onStop: () => void }) {
  return (
    <div className="privacy-item">
      <span>{label}</span>
      <button type="button" className="btn btn-secondary btn-md" onClick={onStop} aria-label={`Stop showing: ${label}`}>
        <EyeOff size={20} strokeWidth={2.5} aria-hidden />
        <span>Stop showing</span>
      </button>
    </div>
  );
}

function Empty() {
  return <p className="muted">Nothing shown.</p>;
}
