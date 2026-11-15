import { useEffect, useState } from 'react';
import {
  Bandage,
  Bed,
  CloudRain,
  GlassWater,
  HandHelping,
  Snowflake,
  Sun,
  Toilet,
  Utensils,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { useNav } from '../app/nav';
import { backTarget } from '../app/paths';
import { ReadAloudButton } from '../components/Sound';
import { Heading, Screen, TopBar } from '../components/ui';
import { claimPlayback, releasePlayback } from '../lib/playback';
import { cancelSpeech, speak, speechAvailable } from '../lib/speech';
import { useStore } from '../lib/store';

export const NEEDS: ReadonlyArray<{ label: string; Icon: LucideIcon }> = [
  { label: "I'm cold", Icon: Snowflake },
  { label: "I'm too hot", Icon: Sun },
  { label: "It's too loud", Icon: VolumeX },
  { label: 'I need the toilet', Icon: Toilet },
  { label: "I'm thirsty", Icon: GlassWater },
  { label: "I'm hungry", Icon: Utensils },
  { label: "I'm tired", Icon: Bed },
  { label: "I'm in pain", Icon: Bandage },
  { label: 'I feel worried', Icon: CloudRain },
  { label: 'Please help me', Icon: HandHelping },
];

/**
 * Large picture buttons for saying a need when words are hard to find.
 * Nothing personal, so it works before unlock too.
 */
export function NeedsBoard() {
  const { route, session, navigate } = useNav();
  const { data } = useStore();
  const [shown, setShown] = useState<(typeof NEEDS)[number] | null>(null);
  const back = session.unlocked ? backTarget(route) : { label: 'Back to help', path: '/help' };

  // Say the need once when it is shown, if Read aloud is on.
  useEffect(() => {
    if (!shown || !data.prefs.readAloud || !speechAvailable()) return;
    const token = claimPlayback(cancelSpeech);
    speak(shown.label, () => releasePlayback(token));
    return () => {
      releasePlayback(token);
      cancelSpeech();
    };
  }, [shown, data.prefs.readAloud]);

  if (shown) {
    const { Icon, label } = shown;
    return (
      <Screen top={<TopBar back={{ label: 'Back to the list', onClick: () => setShown(null) }} />} label={label}>
        <div className="need-shown">
          <Icon size={120} strokeWidth={2} aria-hidden />
          <Heading>{label}</Heading>
        </div>
        <ReadAloudButton text={label} label="Say it again" />
      </Screen>
    );
  }

  return (
    <Screen top={<TopBar back={{ label: back.label, onClick: () => navigate(back.path) }} />} label="I need">
      <Heading sub="Tap one to show it or say it.">I need…</Heading>
      <div className="need-grid">
        {NEEDS.map((need) => (
          <button key={need.label} type="button" className="need-button" onClick={() => setShown(need)}>
            <need.Icon size={44} strokeWidth={2.25} aria-hidden />
            <span>{need.label}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
