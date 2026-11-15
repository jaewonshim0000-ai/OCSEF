import { ChevronRight, Phone } from 'lucide-react';
import { useNav } from '../../app/nav';
import { backTarget, withFrom } from '../../app/paths';
import { PhoneCallButton } from '../../components/PhoneCall';
import { Photo } from '../../components/Photo';
import { AudioButton } from '../../components/Sound';
import { Button, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { useStore } from '../../lib/store';
import type { Contact } from '../../lib/types';
import { DemoCallView } from '../locked/LockedViews';
import { formatPhone } from '../../lib/phone';

export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => Number(b.primary) - Number(a.primary) || a.order - b.order);
}

export function CallAction({ contact, size = 'xl' }: { contact: Contact; size?: 'xl' | 'lg' }) {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const phone = contact.phone.trim();
  const label = `Call ${contact.name.trim() || 'this person'}`;
  if (!phone) return <p className="muted">No phone number saved.</p>;
  if (data.prefs.callMode === 'phone') {
    return <PhoneCallButton phone={phone} label={label} />;
  }
  return (
    <button
      type="button"
      className={`btn btn-call btn-${size} btn-block btn-two-line`}
      onClick={() => navigate(withFrom(`/call/${contact.id}`, route))}
    >
      <Phone size={28} strokeWidth={2.5} aria-hidden />
      <span>
        <span className="btn-main">{label}</span>
        <span className="btn-sub">Demo call · nobody is phoned</span>
      </span>
    </button>
  );
}

/** Plays a family member's voice message, with the words shown as a text alternative. */
export function VoiceMessageButton({ contact, variant = 'secondary' }: { contact: Contact; variant?: 'primary' | 'secondary' }) {
  if (!contact.voice) return null;
  const name = contact.name.trim();
  return (
    <AudioButton
      audio={contact.voice}
      label={name ? `Play ${name}'s message` : 'Play their message'}
      variant={variant}
      transcriptLabel={name ? `What ${name} says:` : 'What they say:'}
    />
  );
}

export function FamilyFull() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const back = backTarget(route);
  const contacts = sortContacts(data.contacts);

  return (
    <Screen
      tone="family"
      top={<TopBar back={{ label: back.label, onClick: () => navigate(back.path) }} getHelp={() => navigate('/help')} />}
    >
      <Heading>Family</Heading>
      {contacts.length === 0 ? (
        <Notice>No one has been added yet. A helper can add people in Helper setup.</Notice>
      ) : (
        <ul className="contact-list">
          {contacts.map((c) => (
            <li key={c.id} className="contact-card">
              <button type="button" className="contact-card-head" onClick={() => navigate(withFrom(`/family/${c.id}`, route))}>
                <Photo photo={c.photo} kind="person" name={c.name} className="photo-avatar" />
                <span className="contact-card-text">
                  <span className="contact-name">{c.name || 'Unnamed'}</span>
                  {c.relationship ? <span className="contact-rel">{c.relationship}</span> : null}
                  {c.phone ? <span className="contact-phone">{formatPhone(c.phone)}</span> : null}
                </span>
                <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
                <span className="sr-only">More about {c.name}</span>
              </button>
              <CallAction contact={c} size="lg" />
              <VoiceMessageButton contact={c} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

export function ContactDetail() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const contact = data.contacts.find((c) => c.id === route.id);
  const backPath = withFrom('/family', route);

  return (
    <Screen
      tone="family"
      top={<TopBar back={{ label: 'Back to Family', onClick: () => navigate(backPath) }} getHelp={() => navigate('/help')} />}
    >
      {!contact ? (
        <>
          <Heading>Not found</Heading>
          <Stack>
            <Notice>This person is no longer in your contacts.</Notice>
            <Button variant="primary" onClick={() => navigate(backPath)}>
              Go to Family
            </Button>
          </Stack>
        </>
      ) : (
        <>
          <Heading>{contact.name || 'Unnamed'}</Heading>
          <Stack>
            <div className="contact-hero">
              <Photo photo={contact.photo} kind="person" name={contact.name} className="photo-portrait" />
              {contact.relationship ? <p className="contact-hero-name">{contact.relationship}</p> : null}
              {contact.phone ? <p className="contact-phone big-text">{formatPhone(contact.phone)}</p> : null}
            </div>
            <CallAction contact={contact} />
            <VoiceMessageButton contact={contact} />
          </Stack>
        </>
      )}
    </Screen>
  );
}

export function DemoCall() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const contact = data.contacts.find((c) => c.id === route.id);
  const backPath = withFrom('/family', route);
  if (!contact) {
    return (
      <Screen tone="family" top={<TopBar back={{ label: 'Back to Family', onClick: () => navigate(backPath) }} />}>
        <Heading>Call</Heading>
        <Stack>
          <Notice>This person is no longer in your contacts.</Notice>
          <Button variant="primary" onClick={() => navigate(backPath)}>
            Go to Family
          </Button>
        </Stack>
      </Screen>
    );
  }
  return (
    <DemoCallView
      photo={<Photo photo={contact.photo} kind="person" name={contact.name} className="photo-portrait" />}
      name={contact.name.trim() || null}
      relationship={contact.relationship.trim() || null}
      number={formatPhone(contact.phone)}
      onEnd={() => navigate(backPath)}
    />
  );
}
