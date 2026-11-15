import { useState } from 'react';
import { ChevronRight, Lock, Plus, Trash2 } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ListField, PhotoField, TextArea, TextField } from '../../components/fields';
import { ConfirmDialog } from '../../components/Modal';
import { ShowBeforeUnlock } from '../../components/Switch';
import { Button, Card, Notice } from '../../components/ui';
import { newId } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { Approvals, FamiliarSpace, Hotspot, Place } from '../../lib/types';
import { HotspotPhoto } from '../companion/HomeViews';
import { SectionTitle, SetupPage, useDraft } from './common';

type HomeFields = Pick<Place, 'label' | 'photo' | 'cue' | 'address' | 'landmarks'>;

interface Draft {
  home: HomeFields;
  homePhoto: boolean;
  homeCue: boolean;
}

export function mergeHomeApprovals(base: Approvals, d: Draft): Approvals {
  return { ...base, homePhoto: d.homePhoto && !!d.home.photo, homeCue: d.homeCue && !!d.home.cue.trim() };
}

export function SetupHome() {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<Draft>(() => ({
    home: {
      label: data.home.label,
      photo: data.home.photo,
      cue: data.home.cue,
      address: data.home.address,
      landmarks: data.home.landmarks,
    },
    homePhoto: data.approvals.homePhoto,
    homeCue: data.approvals.homeCue,
  }));
  const h = draft.home;
  const setHome = (patch: Partial<HomeFields>) => setDraft((d) => ({ ...d, home: { ...d.home, ...patch } }));

  return (
    <SetupPage
      title="Home"
      dirty={dirty}
      previewSource={{ ...data, home: { ...data.home, ...h }, approvals: mergeHomeApprovals(data.approvals, draft) }}
      onSave={async () => {
        const home = { ...h, landmarks: h.landmarks.map((l) => l.trim()).filter(Boolean) };
        const approvals = mergeHomeApprovals(data.approvals, { ...draft, home });
        // Spaces are edited on their own page, so keep the saved ones.
        await save({ home: { ...data.home, ...home }, approvals });
        markSaved({ home, homePhoto: approvals.homePhoto, homeCue: approvals.homeCue });
      }}
    >
      <Card>
        <TextField label="Name for this place" value={h.label} onChange={(v) => setHome({ label: v })} maxLength={60} />
      </Card>
      <Card>
        <PhotoField
          label="Photo of home"
          value={h.photo}
          defaultAlt="My front door"
          onChange={(photo) => setHome({ photo })}
        >
          <ShowBeforeUnlock
            what="home photo"
            checked={draft.homePhoto && !!h.photo}
            disabled={!h.photo}
            onChange={(v) => setDraft((d) => ({ ...d, homePhoto: v }))}
            note={!h.photo ? 'Add a photo first.' : 'Choose a photo that does not show the house number or street name.'}
          />
        </PhotoField>
      </Card>
      <Card>
        <TextField
          label="A landmark cue"
          hint='For example: "My front door is blue."'
          value={h.cue}
          onChange={(v) => setHome({ cue: v })}
          maxLength={120}
        />
        <ShowBeforeUnlock
          what="landmark cue"
          checked={draft.homeCue && !!h.cue.trim()}
          disabled={!h.cue.trim()}
          onChange={(v) => setDraft((d) => ({ ...d, homeCue: v }))}
          note={!h.cue.trim() ? 'Write a cue first.' : undefined}
        />
      </Card>

      <SectionTitle>Only after unlock</SectionTitle>
      <Card>
        <TextArea label="Full address" value={h.address} onChange={(v) => setHome({ address: v })} rows={2} maxLength={200} />
        <Notice tone="private" icon={Lock}>
          The address is never shown before unlock.
        </Notice>
        <ListField
          label="Landmarks near home"
          itemLabel="Landmark"
          addLabel="Add a landmark"
          items={h.landmarks}
          placeholder="For example: The red post box on the corner"
          onChange={(landmarks) => setHome({ landmarks })}
        />
      </Card>

      <SectionTitle>Where things are</SectionTitle>
      <Card>
        <p className="field-hint">
          A wide photo of a familiar room, with highlights showing where everyday things usually are. Saved separately.
        </p>
        <div className="stack stack-sm">
          {data.home.spaces.map((s) => (
            <button key={s.id} type="button" className="list-button" onClick={() => navigate(`/setup/home/${s.id}`)}>
              <span className="list-button-text">
                <span>{s.label || 'Untitled place'}</span>
                <span className="list-button-sub">
                  {s.hotspots.length} {s.hotspots.length === 1 ? 'highlight' : 'highlights'}
                </span>
              </span>
              <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
            </button>
          ))}
        </div>
        <Button size="md" icon={Plus} onClick={() => navigate('/setup/home/new')}>
          Add a familiar place
        </Button>
      </Card>
    </SetupPage>
  );
}

/** Edit one familiar space: its photo and its tappable highlights. */
export function SetupSpace({ spaceId }: { spaceId: string }) {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<FamiliarSpace>(
    () => data.home.spaces.find((s) => s.id === spaceId) ?? { id: newId('space'), label: '', photo: null, hotspots: [] },
  );
  // A new place becomes an existing one once it has been saved.
  const isNew = !data.home.spaces.some((s) => s.id === draft.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = draft.hotspots.find((x) => x.id === selectedId) ?? null;

  const updateHotspot = (id: string, patch: Partial<Hotspot>) =>
    setDraft((d) => ({ ...d, hotspots: d.hotspots.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const addAt = (x: number, y: number) => {
    const spot: Hotspot = { id: newId('hs'), x, y, label: '', detail: '' };
    setDraft((d) => ({ ...d, hotspots: [...d.hotspots, spot] }));
    setSelectedId(spot.id);
  };

  return (
    <SetupPage
      title={isNew ? 'New familiar place' : draft.label || 'Familiar place'}
      dirty={dirty}
      backPath="/setup/home"
      backLabel="Back to Home setup"
      onSave={async () => {
        const space: FamiliarSpace = {
          ...draft,
          label: draft.label.trim() || 'A familiar place',
          hotspots: draft.hotspots.map((x) => ({ ...x, label: x.label.trim() || 'Something', detail: x.detail.trim() })),
        };
        const spaces = data.home.spaces.some((s) => s.id === space.id)
          ? data.home.spaces.map((s) => (s.id === space.id ? space : s))
          : [...data.home.spaces, space];
        await save({ home: { ...data.home, spaces } });
        markSaved(space);
      }}
    >
      <Card>
        <TextField label="Name of the place" hint="For example: Kitchen" value={draft.label} onChange={(v) => setDraft((d) => ({ ...d, label: v }))} maxLength={60} />
        <PhotoField
          label="Wide photo of the place"
          value={draft.photo}
          defaultAlt={draft.label.trim() ? `My ${draft.label.trim().toLowerCase()}` : 'A familiar room'}
          onChange={(photo) => setDraft((d) => ({ ...d, photo }))}
        />
      </Card>

      <SectionTitle>Highlights</SectionTitle>
      <Card>
        {draft.photo ? (
          <>
            <p className="field-hint">Tap the photo to add a highlight where something usually is.</p>
            <HotspotPhoto space={draft} selectedId={selectedId} onSelect={setSelectedId} onPhotoClick={addAt} />
            <Button
              size="md"
              icon={Plus}
              onClick={() => addAt(50, 50)}
            >
              Add a highlight in the middle
            </Button>
          </>
        ) : (
          <Notice>Add a photo first, then tap it to add highlights.</Notice>
        )}
        {draft.hotspots.map((x, i) => (
          <div key={x.id} className={`hotspot-editor${x.id === selectedId ? ' is-selected' : ''}`}>
            <p className="hotspot-editor-title">
              <span className="hotspot-num" aria-hidden>
                {i + 1}
              </span>
              Highlight {i + 1}
            </p>
            <TextField label="What it is" value={x.label} placeholder="For example: Blue mug" onChange={(v) => updateHotspot(x.id, { label: v })} maxLength={60} />
            <TextField
              label="Where it usually is"
              value={x.detail}
              placeholder="For example: In the cupboard left of the window"
              onChange={(v) => updateHotspot(x.id, { detail: v })}
              maxLength={160}
            />
            <div className="button-row">
              <Button size="md" block={false} onClick={() => setSelectedId(x.id)} aria-pressed={x.id === selectedId}>
                Show on photo
              </Button>
              <Button
                size="md"
                variant="quiet"
                block={false}
                icon={Trash2}
                onClick={() => setDraft((d) => ({ ...d, hotspots: d.hotspots.filter((y) => y.id !== x.id) }))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {selected ? <p className="field-hint">Highlight {draft.hotspots.indexOf(selected) + 1} is selected on the photo.</p> : null}
      </Card>

      {!isNew ? (
        <Button variant="danger" size="md" icon={Trash2} onClick={() => setConfirmDelete(true)}>
          Remove this place
        </Button>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="Remove this place?"
          body={<p>The photo and its highlights will be removed from this phone.</p>}
          confirmLabel="Remove place"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            await save({ home: { ...data.home, spaces: data.home.spaces.filter((s) => s.id !== draft.id) } });
            markSaved(draft);
            navigate('/setup/home', { replace: true });
          }}
        />
      ) : null}
    </SetupPage>
  );
}
