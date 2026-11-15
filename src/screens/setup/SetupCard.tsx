import { HelpCardView } from '../../components/HelpCardView';
import { TextArea } from '../../components/fields';
import { Switch } from '../../components/Switch';
import { Card } from '../../components/ui';
import { DEFAULT_HELP_MESSAGE, buildLockedPreview, helpCardContact } from '../../lib/preview';
import { useStore } from '../../lib/store';
import type { HelpCardSettings } from '../../lib/types';
import { SectionTitle, SetupPage, useDraft } from './common';

/** What the "Show someone a message" card shares with a stranger. Every part starts off. */
export function SetupCard() {
  const { data, save } = useStore();
  const { draft, setDraft, dirty, markSaved } = useDraft<HelpCardSettings>(() => data.approvals.helpCard);
  const approvals = { ...data.approvals, helpCard: draft };
  const card = buildLockedPreview({ ...data, approvals }).helpCard;
  const name = data.profile.preferredName.trim();
  const address = data.home.address.trim();
  const who = helpCardContact(data);
  const set = (patch: Partial<HelpCardSettings>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <SetupPage
      title="Help card"
      sub="A card they can show someone nearby when they're lost or stuck. It works before unlock. Choose what it shares."
      dirty={dirty}
      previewSource={{ ...data, approvals }}
      onSave={async () => {
        // A switch for something missing is saved as off, so a value added later isn't shared by surprise.
        const helpCard = {
          message: draft.message.trim(),
          name: draft.name && !!name,
          contact: draft.contact && !!who,
          address: draft.address && !!address,
        };
        await save({ approvals: { ...data.approvals, helpCard } });
        markSaved(helpCard);
      }}
    >
      <Card>
        <TextArea
          label="Message"
          hint={`Leave empty to use: “${DEFAULT_HELP_MESSAGE}”`}
          value={draft.message}
          onChange={(message) => set({ message })}
          rows={3}
          maxLength={200}
        />
        <Switch
          label="Their name"
          description={name ? `Adds “My name is ${name}”.` : 'Add their name in About you first.'}
          checked={draft.name && !!name}
          disabled={!name}
          onChange={(v) => set({ name: v })}
        />
        <Switch
          label="Who to call"
          description={
            who
              ? `Adds “Please call ${who.name.trim() || 'them'}” and a Call button. The number may show on screen.`
              : 'Add someone in Family first.'
          }
          checked={draft.contact && !!who}
          disabled={!who}
          onChange={(v) => set({ contact: v })}
        />
        <Switch
          label="Home address"
          description={address ? 'Adds their full address, so someone can help them home.' : 'Add the address in Home first.'}
          checked={draft.address && !!address}
          disabled={!address}
          onChange={(v) => set({ address: v })}
        />
      </Card>

      <SectionTitle>How the card looks</SectionTitle>
      <Card>
        <HelpCardView card={card} preview />
      </Card>
    </SetupPage>
  );
}
