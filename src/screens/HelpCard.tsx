import { useNav } from '../app/nav';
import { backTarget } from '../app/paths';
import { HelpCardView, helpCardText } from '../components/HelpCardView';
import { ReadAloudButton } from '../components/Sound';
import { Heading, Screen, TopBar } from '../components/ui';
import { useStore } from '../lib/store';

/**
 * A full-screen card to show someone nearby. It is built from the locked
 * preview whether or not the app is unlocked, so a stranger always sees just
 * what the helper chose to share.
 */
export function HelpCard() {
  const { preview } = useStore();
  const { route, session, navigate } = useNav();
  const back = session.unlocked ? backTarget(route) : { label: 'Back to help', path: '/help' };
  return (
    <Screen top={<TopBar back={{ label: 'Close', onClick: () => navigate(back.path) }} />} label="Help card">
      <Heading>Please read this</Heading>
      <HelpCardView card={preview.helpCard} />
      <ReadAloudButton text={helpCardText(preview.helpCard)} />
    </Screen>
  );
}
