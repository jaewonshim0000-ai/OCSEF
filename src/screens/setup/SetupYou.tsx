import { AudioField, ListField, PhotoField, TextArea, TextField } from '../../components/fields';
import { ShowBeforeUnlock } from '../../components/Switch';
import { Card } from '../../components/ui';
import { useStore } from '../../lib/store';
import type { Approvals, Profile } from '../../lib/types';
import { SectionTitle, SetupPage, useDraft } from './common';

interface Draft {
  profile: Profile;
  youName: boolean;
  youPhoto: boolean;
  youVoice: boolean;
}

/** Approvals for empty fields are saved as off. */
export function mergeYouApprovals(base: Approvals, d: Draft): Approvals {
  return {
    ...base,
    youName: d.youName && !!d.profile.preferredName.trim(),
    youPhoto: d.youPhoto && !!d.profile.photo,
    youVoice: d.youVoice && !!d.profile.voice,
    // Clearing the name turns the help card's name off, so a new name isn't shared by surprise.
    helpCard: { ...base.helpCard, name: base.helpCard.name && !!d.profile.preferredName.trim() },
  };
}

export function SetupYou() {
  const { data, save } = useStore();
  const { draft, setDraft, dirty, markSaved } = useDraft<Draft>(() => ({
    profile: data.profile,
    youName: data.approvals.youName,
    youPhoto: data.approvals.youPhoto,
    youVoice: data.approvals.youVoice,
  }));
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setProfile = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const p = draft.profile;

  const clean = (d: Draft): Draft => ({
    ...d,
    profile: { ...d.profile, details: d.profile.details.map((x) => x.trim()).filter(Boolean) },
  });

  return (
    <SetupPage
      title="About you"
      sub="Written with, or by, the person."
      dirty={dirty}
      previewSource={{ ...data, profile: draft.profile, approvals: mergeYouApprovals(data.approvals, draft) }}
      onSave={async () => {
        const d = clean(draft);
        const approvals = mergeYouApprovals(data.approvals, d);
        await save({ profile: d.profile, approvals });
        markSaved({ ...d, youName: approvals.youName, youPhoto: approvals.youPhoto, youVoice: approvals.youVoice });
      }}
    >
      <Card>
        <TextField
          label="Preferred name"
          hint="The name you like to be called."
          value={p.preferredName}
          onChange={(v) => setProfile({ preferredName: v })}
          maxLength={60}
        />
        <ShowBeforeUnlock
          what="preferred name"
          checked={draft.youName && !!p.preferredName.trim()}
          disabled={!p.preferredName.trim()}
          onChange={(v) => set({ youName: v })}
          note={!p.preferredName.trim() ? 'Add a name first.' : undefined}
        />
      </Card>

      <Card>
        <PhotoField
          label="Photo"
          kind="person"
          name={p.preferredName}
          value={p.photo}
          defaultAlt={p.preferredName.trim() ? `${p.preferredName.trim()} smiling` : 'My photo'}
          onChange={(photo) => setProfile({ photo })}
        >
          <ShowBeforeUnlock
            what="photo"
            checked={draft.youPhoto && !!p.photo}
            disabled={!p.photo}
            onChange={(v) => set({ youPhoto: v })}
            note={!p.photo ? 'Add a photo first.' : undefined}
          />
        </PhotoField>
      </Card>

      <Card>
        <AudioField label="A reassuring voice message" value={p.voice} onChange={(voice) => setProfile({ voice })}>
          <ShowBeforeUnlock
            what="voice message"
            checked={draft.youVoice && !!p.voice}
            disabled={!p.voice}
            onChange={(v) => set({ youVoice: v })}
            note={!p.voice ? 'Record or choose a message first.' : 'It only plays when someone taps Play.'}
          />
        </AudioField>
      </Card>

      <SectionTitle>Only after unlock</SectionTitle>
      <Card>
        <TextArea
          label="A short introduction"
          hint="For example: I'm Peggy. I live at home with my cat."
          value={p.intro}
          onChange={(v) => setProfile({ intro: v })}
        />
        <ListField
          label="Things about me"
          itemLabel="Detail"
          addLabel="Add a detail"
          items={p.details}
          placeholder="For example: I grew up by the sea."
          onChange={(details) => setProfile({ details })}
        />
      </Card>
    </SetupPage>
  );
}
