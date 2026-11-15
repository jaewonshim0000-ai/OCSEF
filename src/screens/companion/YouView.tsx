import { ChevronRight, Mic, Music, Settings } from 'lucide-react';
import { useNav } from '../../app/nav';
import { backTarget } from '../../app/paths';
import { Photo } from '../../components/Photo';
import { AudioButton, ReadAloudButton } from '../../components/Sound';
import { Button, Card, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { useStore } from '../../lib/store';
import { sortContacts, VoiceMessageButton } from './FamilyViews';

export function YouFull() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const back = backTarget(route);
  const p = data.profile;
  const name = p.preferredName.trim();
  const intro = p.intro.trim();
  const details = p.details.map((d) => d.trim()).filter(Boolean);
  const voices = sortContacts(data.contacts).filter((c) => c.voice);
  const empty = !name && !intro && !details.length && !p.photo && !p.voice && !voices.length;

  return (
    <Screen
      tone="you"
      top={<TopBar back={{ label: back.label, onClick: () => navigate(back.path) }} getHelp={() => navigate('/help')} />}
    >
      <Heading>You</Heading>
      {empty ? (
        <Stack>
          <Notice>Nothing has been written here yet. You can fill this in together with someone you trust.</Notice>
          <Button variant="quiet" size="md" icon={Settings} onClick={() => navigate('/setup/you')}>
            Fill it in with Helper setup
          </Button>
        </Stack>
      ) : (
        <Stack>
          <div className="contact-hero">
            <Photo photo={p.photo} kind="person" name={name} className="photo-portrait" />
            {name ? <p className="big-cue">I'm {name}.</p> : null}
          </div>
          {intro ? <p className="big-text">{intro}</p> : null}
          {intro || name ? <ReadAloudButton text={[name ? `You are ${name}.` : '', intro].filter(Boolean).join(' ')} /> : null}
          {p.voice ? <AudioButton audio={p.voice} label="Play my message" variant="primary" /> : null}
          <Card>
            <h2 className="card-title">
              <Mic size={24} strokeWidth={2.5} aria-hidden /> Voices from your family
            </h2>
            {voices.length ? (
              <ul className="family-voice-list">
                {voices.map((c) => (
                  <li key={c.id} className="family-voice">
                    <div className="family-voice-head">
                      <Photo photo={c.photo} kind="person" name={c.name} className="photo-avatar-sm" />
                      <p className="family-voice-title">
                        {c.name || 'Someone in your family'}
                        {c.relationship ? <span className="family-voice-rel"> · {c.relationship}</span> : null}
                      </p>
                    </div>
                    <VoiceMessageButton contact={c} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>No one has recorded a message yet. A helper can add one in Helper setup.</p>
            )}
          </Card>
          {details.length ? (
            <Card>
              <h2 className="card-title">About me</h2>
              <ul className="landmarks">
                {details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {data.songs.length ? (
            <button type="button" className="list-button" onClick={() => navigate('/music?from=you')}>
              <Music size={26} strokeWidth={2.5} aria-hidden />
              <span className="list-button-text">
                <span>Songs I love</span>
                <span className="list-button-sub">
                  {data.songs.length} {data.songs.length === 1 ? 'song' : 'songs'}
                </span>
              </span>
              <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
            </button>
          ) : null}
        </Stack>
      )}
    </Screen>
  );
}
