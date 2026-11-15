import { useState } from 'react';
import { CalendarClock, ChevronRight, Eye, House, IdCard, Images, Music, Settings, ShieldCheck, UserRound, Users } from 'lucide-react';
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

  const last = data.setup.lastBackupAt;
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  const stale = data.setup.mode === 'real' && (last === null || Date.now() - last > MONTH);

  const items = [
    { path: '/setup/you', Icon: UserRound, label: 'About you', hint: 'Name, photo, introduction, voice message' },
    { path: '/setup/home', Icon: House, label: 'Home', hint: 'Home photo, address, familiar places' },
    { path: '/setup/family', Icon: Users, label: 'Family', hint: familyHint(data.contacts) },
    { path: '/setup/routine', Icon: CalendarClock, label: 'Routine', hint: 'Today’s plan and step-by-step routines' },
    { path: '/setup/memories', Icon: Images, label: 'Memories', hint: `${data.memories.length} ${data.memories.length === 1 ? 'photo' : 'photos'}` },
    { path: '/setup/music', Icon: Music, label: 'Music', hint: `${data.songs.length} favourite ${data.songs.length === 1 ? 'song' : 'songs'}` },
    { path: '/setup/card', Icon: IdCard, label: 'Help card', hint: 'What to show someone nearby' },
    {
      path: '/setup/privacy',
      Icon: ShieldCheck,
      label: 'Before unlock',
      hint: isPreviewEmpty(preview) ? 'Nothing is shown before unlock' : `${shownCount} ${shownCount === 1 ? 'item is' : 'items are'} shown before unlock`,
    },
    { path: '/setup/settings', Icon: Settings, label: 'Settings and reset', hint: 'Text size, Read aloud, lock, backup, reset' },
  ];

  return (
    <SetupPage
      title="Helper setup"
      sub="Set this up together. The person chooses what is shared, and what can be seen before the phone is unlocked."
      backPath="/today"
      backLabel="Back to Today"
    >
      {stale ? (
        <Notice tone="warn">
          {last === null ? 'No backup yet.' : 'The last backup is more than a month old.'} Familiar Place keeps
          everything on this phone only.{' '}
          <button type="button" className="link-button" onClick={() => navigate('/setup/settings')}>
            Back up now
          </button>
        </Notice>
      ) : null}
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
  if (p.note) n++;
  if (p.helpCard.name) n++;
  if (p.helpCard.contact) n++;
  if (p.helpCard.address) n++;
  if (p.contact) {
    if (p.contact.name) n++;
    if (p.contact.relationship) n++;
    if (p.contact.photo) n++;
    if (p.contact.call) n++;
    if (p.contact.voice) n++;
  }
  return n;
}
