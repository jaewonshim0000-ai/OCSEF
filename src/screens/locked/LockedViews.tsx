import { ArrowLeft, IdCard, KeyRound, Lock, MessageSquareText, Phone, PhoneOff, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { MusicCornerScope } from '../../app/music';
import type { Flash } from '../../app/nav';
import { Photo } from '../../components/Photo';
import { AudioButton, ReadAloudButton } from '../../components/Sound';
import { TileGrid } from '../../components/TileGrid';
import { Button, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import type { LockedPhoto, LockedPreview } from '../../lib/preview';
import type { TileId } from '../../lib/types';
import { PhoneCallButton } from '../../components/PhoneCall';
import { TodayNoteCard } from '../../components/TodayNote';

/**
 * Limited views shown while Familiar Place is locked.
 *
 * These components receive only the LockedPreview, which is built from
 * explicitly approved values. They never import the store's full records.
 */

export type LockedScreenId = 'help' | TileId | 'call';

export interface LockedProps {
  preview: LockedPreview;
  screen: LockedScreenId;
  go: (screen: LockedScreenId) => void;
  /** Returns to the keypad. Absent in the setup preview. */
  onTryPin?: () => void;
  flash?: Flash;
  /** In the setup preview, a call never leaves the app, even in phone mode. */
  previewMode?: boolean;
  /** Opens another screen that is safe while locked (the "I need…" board, the help card). */
  openPath?: (path: string) => void;
}

export function LockedExperience(props: LockedProps) {
  // Locked screens, and previews of them, never show the music button.
  return (
    <MusicCornerScope show={false}>
      <LockedScreen {...props} />
    </MusicCornerScope>
  );
}

function LockedScreen(props: LockedProps) {
  switch (props.screen) {
    case 'home':
      return <LockedHome {...props} />;
    case 'family':
      return <LockedFamily {...props} />;
    case 'you':
      return <LockedYou {...props} />;
    case 'routine':
      return <LockedRoutine {...props} />;
    case 'call':
      return <LockedCall {...props} />;
    default:
      return <LockedHelp {...props} />;
  }
}

function LockedStatus() {
  return (
    <div className="locked-status">
      <Lock size={18} strokeWidth={2.5} aria-hidden />
      <span>Phone locked · private info hidden</span>
    </div>
  );
}

function LockedHelp({ preview, go, onTryPin, flash, openPath }: LockedProps) {
  return (
    <Screen top={<LockedStatus />} label="Get help">
      <Heading sub="Choose one.">Need a hand?</Heading>
      {flash === 'auto-help' ? (
        <Notice tone="ok">Having trouble unlocking? That's okay. These can help.</Notice>
      ) : null}
      {flash === 'private' ? (
        <Notice tone="private" icon={Lock}>
          That's private until the phone is unlocked. Here is what you can see now.
        </Notice>
      ) : null}
      <TodayNoteCard note={preview.note} />
      <TileGrid onOpen={go} />
      {openPath ? (
        <>
          <Button variant="primary" icon={IdCard} onClick={() => openPath('/card')}>
            Show someone a message
          </Button>
          <Button icon={MessageSquareText} onClick={() => openPath('/needs')}>
            I need…
          </Button>
        </>
      ) : null}
      {onTryPin ? (
        <Button icon={KeyRound} onClick={onTryPin}>
          Try PIN again
        </Button>
      ) : null}
    </Screen>
  );
}

function LockedDetail({ tile, title, go, children }: { tile: TileId; title: string; go: LockedProps['go']; children: ReactNode }) {
  return (
    <Screen tone={tile} top={<TopBar back={{ label: 'Back to help', onClick: () => go('help') }} />}>
      <Heading>{title}</Heading>
      <Stack>{children}</Stack>
    </Screen>
  );
}

/** Loads a photo only if its media id is in the preview's allowlist. */
function ApprovedPhoto({
  preview,
  photo,
  kind = 'scene',
  name,
}: {
  preview: LockedPreview;
  photo: LockedPhoto | null;
  kind?: 'person' | 'scene';
  name?: string;
}) {
  if (!photo || !preview.mediaIds.includes(photo.id)) return null;
  return <Photo photo={photo} kind={kind} name={name} className={kind === 'person' ? 'photo-portrait' : 'photo-wide'} />;
}

function NothingShared({ message, preview, go }: { message: string; preview: LockedPreview; go: LockedProps['go'] }) {
  return (
    <>
      <Notice tone="private" icon={Lock}>
        {message}
      </Notice>
      {preview.contact ? (
        <Button variant="primary" icon={Users} onClick={() => go('family')}>
          Go to Family
        </Button>
      ) : null}
      <Button icon={ArrowLeft} onClick={() => go('help')}>
        Back to help
      </Button>
    </>
  );
}

function LockedHome(props: LockedProps) {
  const { preview, go } = props;
  const { photo, cue } = preview.home;
  return (
    <LockedDetail tile="home" title="Home" go={go}>
      {!photo && !cue ? (
        <NothingShared
          preview={preview}
          go={go}
          message="Nothing about home has been shared for the locked screen yet. Unlock the phone to see Home."
        />
      ) : (
        <>
          <ApprovedPhoto preview={preview} photo={photo} />
          {cue ? <p className="big-cue">{cue}</p> : null}
          {cue ? <ReadAloudButton text={cue} variant="primary" /> : null}
          <Notice tone="private" icon={Lock}>
            The full address is private until the phone is unlocked.
          </Notice>
        </>
      )}
    </LockedDetail>
  );
}

function callLabel(name: string | null) {
  return name ? `Call ${name}` : 'Call';
}

function LockedFamily(props: LockedProps) {
  const { preview, go, previewMode } = props;
  const c = preview.contact;
  if (!c) {
    return (
      <LockedDetail tile="family" title="Family" go={go}>
        <NothingShared
          preview={preview}
          go={go}
          message="No one has been chosen to show here yet. Unlock the phone to see Family, or ask someone nearby."
        />
      </LockedDetail>
    );
  }
  const displayName = c.name ?? 'Your trusted contact';
  return (
    <LockedDetail tile="family" title="Family" go={go}>
      <div className="contact-hero">
        <ApprovedPhoto preview={preview} photo={c.photo} kind="person" name={c.name ?? undefined} />
        <p className="contact-hero-name">
          {displayName}
          {c.relationship ? <span className="contact-hero-rel"> · {c.relationship}</span> : null}
        </p>
      </div>
      {c.voice && preview.mediaIds.includes(c.voice.id) ? (
        <AudioButton
          audio={c.voice}
          label={c.name ? `Play ${c.name}'s message` : 'Play their message'}
          transcriptLabel={c.name ? `What ${c.name} says:` : 'What they say:'}
        />
      ) : null}
      {c.call ? (
        c.call.mode === 'phone' && !previewMode ? (
          <PhoneCallButton phone={c.call.phone} label={callLabel(c.name)} />
        ) : (
          <button type="button" className="btn btn-call btn-xl btn-block btn-two-line" onClick={() => go('call')}>
            <Phone size={30} strokeWidth={2.5} aria-hidden />
            <span>
              <span className="btn-main">{callLabel(c.name)}</span>
              <span className="btn-sub">Demo call · nobody is phoned</span>
            </span>
          </button>
        )
      ) : (
        <Notice icon={PhoneOff}>Calling has not been set up for the locked screen.</Notice>
      )}
      <Notice tone="private" icon={Lock}>
        Other contacts and phone numbers are private until the phone is unlocked.
      </Notice>
    </LockedDetail>
  );
}

function LockedYou(props: LockedProps) {
  const { preview, go } = props;
  const { name, photo, voice } = preview.you;
  const family = preview.contact?.voice && preview.mediaIds.includes(preview.contact.voice.id) ? preview.contact : null;
  const familyName = family?.name ?? null;
  return (
    <LockedDetail tile="you" title="You" go={go}>
      {!name && !photo && !voice && !family ? (
        <NothingShared preview={preview} go={go} message="Nothing about you has been shared for the locked screen yet." />
      ) : (
        <>
          <ApprovedPhoto preview={preview} photo={photo} kind="person" name={name ?? undefined} />
          {name ? <p className="big-cue">Your name is {name}.</p> : null}
          {voice && preview.mediaIds.includes(voice.id) ? (
            <AudioButton audio={voice} label="Play my message" variant="primary" />
          ) : name ? (
            <ReadAloudButton text={`Your name is ${name}.`} variant="primary" />
          ) : null}
          {family?.voice ? (
            <section className="family-voice" aria-label={familyName ? `A message from ${familyName}` : 'A message from your family'}>
              <p className="family-voice-title">
                {familyName ? `A message from ${familyName}` : 'A message from your family'}
                {family.relationship ? <span className="family-voice-rel"> · {family.relationship}</span> : null}
              </p>
              <AudioButton
                audio={family.voice}
                label={familyName ? `Play ${familyName}'s message` : 'Play the message'}
                variant={voice || name ? 'secondary' : 'primary'}
                transcriptLabel={familyName ? `What ${familyName} says:` : 'What they say:'}
              />
            </section>
          ) : null}
        </>
      )}
    </LockedDetail>
  );
}

function LockedRoutine(props: LockedProps) {
  const { preview, go } = props;
  const cue = preview.routineCue;
  return (
    <LockedDetail tile="routine" title="Routine" go={go}>
      {!cue ? (
        <NothingShared preview={preview} go={go} message="No routine reminder has been shared for the locked screen yet." />
      ) : (
        <>
          <p className="routine-cue">
            <span className="routine-cue-label">Next up</span>
            <span className="routine-cue-text">{cue}</span>
          </p>
          <ReadAloudButton text={cue} variant="primary" />
          <Notice tone="private" icon={Lock}>
            The full schedule is private until the phone is unlocked.
          </Notice>
        </>
      )}
    </LockedDetail>
  );
}

function LockedCall(props: LockedProps) {
  const { preview, go } = props;
  const c = preview.contact;
  if (!c?.call) {
    return (
      <LockedDetail tile="family" title="Call" go={go}>
        <NothingShared preview={preview} go={go} message="Calling has not been set up for the locked screen." />
      </LockedDetail>
    );
  }
  return (
    <DemoCallView
      photo={<ApprovedPhoto preview={preview} photo={c.photo} kind="person" name={c.name ?? undefined} />}
      name={c.name}
      relationship={c.relationship}
      onEnd={() => go('family')}
    />
  );
}

/** Shows who would be called. It never dials and never plays a ringtone. */
export function DemoCallView({
  photo,
  name,
  relationship,
  number,
  onEnd,
}: {
  photo: ReactNode;
  name: string | null;
  relationship: string | null;
  number?: string;
  onEnd: () => void;
}) {
  return (
    <div className="screen demo-call">
      <main className="screen-scroll">
        <div className="demo-call-body">
          <span className="demo-chip">Demo call</span>
          {photo}
          <h1 tabIndex={-1} data-screen-heading className="demo-call-title">
            {name ? `Calling ${name}` : 'Calling your trusted contact'}
          </h1>
          {relationship ? <p className="demo-call-rel">{relationship}</p> : null}
          {number ? <p className="demo-call-number">{number}</p> : null}
          <p className="demo-call-note" role="status">
            This is a demo. No real call is being made.
          </p>
          <Button variant="danger" size="xl" icon={PhoneOff} onClick={onEnd}>
            End demo call
          </Button>
        </div>
      </main>
    </div>
  );
}
