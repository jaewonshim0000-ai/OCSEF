import { useState } from 'react';
import { CalendarClock, ChevronRight, Eye, House, Images, Music, Settings, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useNav } from '../../app/nav';
import { Button, Notice } from '../../components/ui';
import { useStore } from '../../lib/store';
import { isPreviewEmpty } from '../../lib/preview';
import { LockedPreviewModal, SetupPage } from './common';

export function SetupHub() {
  const { data, preview } = useStore();
  const { navigate } = useNav();
  const [previewing, setPreviewing] = useState(false);
  const shownCount = countShown(preview);

  const items = [
    { path: '/setup/you', Icon: UserRound, label: 'About you', hint: 'Name, photo, introduction, voice message' },
    { path: '/setup/home', Icon: House, label: 'Home', hint: 'Home photo, address, familiar places' },
    { path: '/setup/family', Icon: Users, label: 'Family', hint: familyHint(data.contacts) },
    { path: '/setup/routine', Icon: CalendarClock, label: 'Routine', hint: 'Today’s plan and step-by-step routines' },
    { path: '/setup/memories', Icon: Images, label: 'Memories', hint: `${data.memories.length} ${data.memories.length === 1 ? 'photo' : 'photos'}` },
    { path: '/setup/music', Icon: Music, label: 'Music', hint: `${data.songs.length} favourite ${data.songs.length === 1 ? 'song' : 'songs'}` },
    {
      path: '/setup/privacy',
      Icon: ShieldCheck,
      label: 'Before unlock',
      hint: isPreviewEmpty(preview) ? 'Nothing is shown before unlock' : `${shownCount} ${shownCount === 1 ? 'item is' : 'items are'} shown before unlock`,
    },
    { path: '/setup/settings', Icon: Settings, label: 'Settings and reset', hint: 'Text size, Read aloud, calls, reset' },
  ];

  return (
    <SetupPage
      title="Helper setup"
      sub="Set this up together. The person chooses what is shared, and what can be seen before the phone is unlocked."
      backPath="/today"
      backLabel="Back to Today"
    >
      <Notice tone="warn">
        Demo only: the pretend PIN is not real security. A real app would ask for the phone's own passcode or Face ID
        before anyone could change these settings.
      </Notice>
      <nav className="stack stack-sm" aria-label="Setup sections">
        {items.map(({ path, Icon, label, hint }) => (
          <button key={path} type="button" className="list-button setup-item" onClick={() => navigate(path)}>
            <Icon size={28} strokeWidth={2.25} aria-hidden />
            <span className="list-button-text">
              <span>{label}</span>
              <span className="list-button-sub">{hint}</span>
            </span>
            <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
          </button>
        ))}
      </nav>
      <Button variant="primary" icon={Eye} onClick={() => setPreviewing(true)}>
        Preview locked view
      </Button>
      {previewing ? <LockedPreviewModal source={data} onClose={() => setPreviewing(false)} /> : null}
    </SetupPage>
  );
}

function familyHint(contacts: Array<{ voice: unknown }>): string {
  const people = `${contacts.length} ${contacts.length === 1 ? 'person' : 'people'}`;
  const voices = contacts.filter((c) => c.voice).length;
  return `${people} · ${voices} voice ${voices === 1 ? 'message' : 'messages'}`;
}

function countShown(p: ReturnType<typeof useStore>['preview']): number {
  let n = 0;
  if (p.home.photo) n++;
  if (p.home.cue) n++;
  if (p.you.name) n++;
  if (p.you.photo) n++;
  if (p.you.voice) n++;
  if (p.routineCue) n++;
  if (p.contact) {
    if (p.contact.name) n++;
    if (p.contact.relationship) n++;
    if (p.contact.photo) n++;
    if (p.contact.call) n++;
    if (p.contact.voice) n++;
  }
  return n;
}
