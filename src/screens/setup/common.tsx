import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Eye, Save, X } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Button, Heading, Screen, TopBar } from '../../components/ui';
import { buildLockedPreview } from '../../lib/preview';
import type { AppData } from '../../lib/types';
import { LockedExperience, type LockedScreenId } from '../locked/LockedViews';

/** A form draft compared against the last saved snapshot. */
export function useDraft<T>(initial: () => T) {
  const [base, setBase] = useState<T>(initial);
  const [draft, setDraft] = useState<T>(base);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);
  const markSaved = (value: T) => {
    setBase(value);
    setDraft(value);
  };
  return { draft, setDraft, dirty, markSaved };
}

/**
 * Shows exactly what the locked help screen would show, built with the same
 * function and the same components as the real locked view.
 */
export function LockedPreviewModal({ source, onClose }: { source: AppData; onClose: () => void }) {
  const preview = useMemo(() => buildLockedPreview(source), [source]);
  const [screen, setScreen] = useState<LockedScreenId>('help');
  return (
    <Modal title="Preview of the locked screen" onClose={onClose} full hideTitle>
      <div className="preview-banner">
        <Eye size={22} strokeWidth={2.5} aria-hidden />
        <span>Preview: what shows before unlock</span>
        <button type="button" className="preview-close" onClick={onClose} data-autofocus>
          <X size={20} strokeWidth={2.5} aria-hidden />
          <span>Close</span>
        </button>
      </div>
      <div className="preview-frame">
        <LockedExperience preview={preview} screen={screen} go={setScreen} previewMode />
      </div>
    </Modal>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SetupPage({
  title,
  sub,
  dirty = false,
  backPath = '/setup',
  backLabel = 'Back to setup',
  onSave,
  previewSource,
  children,
  extraFooter,
}: {
  title: string;
  sub?: ReactNode;
  dirty?: boolean;
  backPath?: string;
  backLabel?: string;
  /** When given, the page shows a Save button. Throwing shows an error. */
  onSave?: () => Promise<void>;
  /** When given, the page offers "Preview locked view" using this data. */
  previewSource?: AppData;
  children: ReactNode;
  extraFooter?: ReactNode;
}) {
  const { navigate } = useNav();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (dirty && status === 'saved') setStatus('idle');
  }, [dirty, status]);

  const leave = (path: string) => (dirty ? setLeaving(path) : navigate(path));

  const doSave = async () => {
    if (!onSave) return;
    setStatus('saving');
    try {
      await onSave();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const showFooter = !!onSave || !!previewSource || !!extraFooter;

  return (
    <Screen
      top={<TopBar back={{ label: backLabel, onClick: () => leave(backPath) }} />}
      footer={
        showFooter ? (
          <div className="save-bar">
            <p className={`save-status save-${status}`} role="status">
              {status === 'saved' ? (
                <>
                  <Check size={20} strokeWidth={3} aria-hidden /> Saved
                </>
              ) : status === 'error' ? (
                "Couldn't save. Please try again."
              ) : dirty ? (
                'You have changes that are not saved yet.'
              ) : (
                ''
              )}
            </p>
            <div className="save-bar-buttons">
              {previewSource ? (
                <Button size="md" icon={Eye} onClick={() => setPreviewing(true)} block={false} className="grow">
                  Preview locked view
                </Button>
              ) : null}
              {onSave ? (
                <Button
                  variant="primary"
                  size="md"
                  icon={Save}
                  onClick={doSave}
                  disabled={!dirty || status === 'saving'}
                  block={false}
                  className="grow"
                >
                  {status === 'saving' ? 'Saving…' : 'Save changes'}
                </Button>
              ) : null}
            </div>
            {extraFooter}
          </div>
        ) : undefined
      }
    >
      <Heading sub={sub}>{title}</Heading>
      <div className="setup-body">{children}</div>
      {leaving ? (
        <ConfirmDialog
          title="Leave without saving?"
          body={<p>Your changes on this page will be lost.</p>}
          confirmLabel="Leave without saving"
          cancelLabel="Stay here"
          danger
          onConfirm={() => {
            const path = leaving;
            setLeaving(null);
            navigate(path);
          }}
          onCancel={() => setLeaving(null)}
        />
      ) : null}
      {previewing && previewSource ? <LockedPreviewModal source={previewSource} onClose={() => setPreviewing(false)} /> : null}
    </Screen>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}
