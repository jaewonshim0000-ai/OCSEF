import { useState } from 'react';
import { ChevronRight, MapPin, Navigation } from 'lucide-react';
import { useNav } from '../../app/nav';
import { backTarget, mapsHref, withFrom } from '../../app/paths';
import { Modal } from '../../components/Modal';
import { Photo } from '../../components/Photo';
import { ReadAloudButton } from '../../components/Sound';
import { Button, Card, Heading, LinkButton, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { useStore } from '../../lib/store';

export function HomeFull() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const [confirmMaps, setConfirmMaps] = useState(false);
  const home = data.home;
  const back = backTarget(route);
  const address = home.address.trim();
  const cue = home.cue.trim();

  return (
    <Screen
      tone="home"
      top={<TopBar back={{ label: back.label, onClick: () => navigate(back.path) }} getHelp={() => navigate('/help')} />}
    >
      <Heading>{home.label.trim() || 'Home'}</Heading>
      <Stack>
        <Photo photo={home.photo} className="photo-wide" missingText="No photo of home yet" />
        {cue ? <p className="big-cue">{cue}</p> : null}
        {cue ? <ReadAloudButton text={cue} /> : null}

        <Card>
          <h2 className="card-title">
            <MapPin size={24} strokeWidth={2.5} aria-hidden /> My address
          </h2>
          {address ? (
            <>
              <p className="address">{address}</p>
              <Button variant="primary" size="xl" icon={Navigation} onClick={() => setConfirmMaps(true)}>
                Open in maps
              </Button>
            </>
          ) : (
            <p>No address has been saved yet. A helper can add it in Helper setup.</p>
          )}
        </Card>

        {home.landmarks.length ? (
          <Card>
            <h2 className="card-title">Landmarks near home</h2>
            <ul className="landmarks">
              {home.landmarks.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h2 className="card-title">Where things are</h2>
          {home.spaces.length ? (
            <div className="stack stack-sm">
              {home.spaces.map((s) => (
                <button key={s.id} type="button" className="list-button" onClick={() => navigate(withFrom(`/home/places/${s.id}`, route))}>
                  <span>{s.label || 'A familiar place'}</span>
                  <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <p>No familiar places have been added yet. A helper can add them in Helper setup.</p>
          )}
        </Card>
      </Stack>

      {confirmMaps ? (
        <Modal title="Open your address in maps?" onClose={() => setConfirmMaps(false)}>
          <div className="modal-body">
            <p>This opens your maps app with your home address. Your address leaves Familiar Place when you do this.</p>
          </div>
          <div className="modal-actions">
            <LinkButton href={mapsHref(address)} variant="primary" icon={Navigation} newTab onClick={() => setConfirmMaps(false)}>
              Open maps
            </LinkButton>
            <Button onClick={() => setConfirmMaps(false)} data-autofocus>
              Not now
            </Button>
          </div>
        </Modal>
      ) : null}
    </Screen>
  );
}

/** A wide photo of a familiar space with tappable highlights of where things usually are. */
export function Places() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const spaces = data.home.spaces;
  const space = spaces.find((s) => s.id === route.id) ?? spaces[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = space?.hotspots.find((h) => h.id === selectedId) ?? null;
  const backPath = withFrom('/home', route);

  return (
    <Screen
      tone="home"
      top={<TopBar back={{ label: 'Back to Home', onClick: () => navigate(backPath) }} getHelp={() => navigate('/help')} />}
    >
      <Heading sub={space ? 'Tap a number to see where something usually is.' : undefined}>
        {space ? space.label || 'A familiar place' : 'Where things are'}
      </Heading>
      {!space ? (
        <Notice>No familiar places have been added yet. A helper can add them in Helper setup.</Notice>
      ) : (
        <Stack>
          {spaces.length > 1 ? (
            <div className="segmented" role="group" aria-label="Choose a place">
              {spaces.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === space.id}
                  className="segment"
                  onClick={() => {
                    setSelectedId(null);
                    navigate(withFrom(`/home/places/${s.id}`, route), { replace: true });
                  }}
                >
                  {s.label || 'Place'}
                </button>
              ))}
            </div>
          ) : null}

          <HotspotPhoto space={space} selectedId={selectedId} onSelect={setSelectedId} />

          {selected ? (
            <Card className="hotspot-detail">
              <h2 className="card-title">{selected.label}</h2>
              <p className="big-text">{selected.detail}</p>
              <ReadAloudButton text={`${selected.label}. ${selected.detail}`} />
            </Card>
          ) : null}

          {space.hotspots.length ? (
            <div className="stack stack-sm" role="group" aria-label="Things in this place">
              {space.hotspots.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  className="list-button"
                  aria-pressed={h.id === selectedId}
                  onClick={() => setSelectedId(h.id)}
                >
                  <span className="hotspot-num" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="list-button-text">{h.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <Notice>No highlights have been added to this photo yet.</Notice>
          )}
        </Stack>
      )}
    </Screen>
  );
}

export function HotspotPhoto({
  space,
  selectedId,
  onSelect,
  onPhotoClick,
}: {
  space: { photo: { id: string; alt: string } | null; hotspots: Array<{ id: string; x: number; y: number; label: string }> };
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Used by the editor to place a new highlight. Receives percentages. */
  onPhotoClick?: (x: number, y: number) => void;
}) {
  return (
    <div
      className={`hotspot-wrap${onPhotoClick ? ' is-editing' : ''}`}
      onClick={(e) => {
        if (!onPhotoClick || (e.target as HTMLElement).closest('.hotspot')) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onPhotoClick(Math.round(Math.min(98, Math.max(2, x)) * 10) / 10, Math.round(Math.min(96, Math.max(4, y)) * 10) / 10);
      }}
    >
      <Photo photo={space.photo} className="photo-hotspot" missingText="No photo of this place yet" />
      {space.photo
        ? space.hotspots.map((h, i) => (
            <button
              key={h.id}
              type="button"
              className={`hotspot${h.id === selectedId ? ' is-selected' : ''}`}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
              aria-label={`${i + 1}: ${h.label}`}
              aria-pressed={h.id === selectedId}
              onClick={() => onSelect(h.id)}
            >
              {i + 1}
            </button>
          ))
        : null}
    </div>
  );
}
