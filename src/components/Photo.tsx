import { useEffect, useState } from 'react';
import { ImageOff, UserRound } from 'lucide-react';
import { useStore } from '../lib/store';
import type { MediaId } from '../lib/types';

export type MediaState = { status: 'loading' | 'ready' | 'missing'; url: string | null };

export function useMediaUrl(id: MediaId | null | undefined): MediaState {
  const { mediaUrl } = useStore();
  const [state, setState] = useState<MediaState>({ status: id ? 'loading' : 'missing', url: null });
  useEffect(() => {
    if (!id) {
      setState({ status: 'missing', url: null });
      return;
    }
    let live = true;
    setState({ status: 'loading', url: null });
    mediaUrl(id).then((url) => {
      if (live) setState(url ? { status: 'ready', url } : { status: 'missing', url: null });
    });
    return () => {
      live = false;
    };
  }, [id, mediaUrl]);
  return state;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Shows a stored photo, or a clear placeholder when the photo is missing or
 * cannot be loaded.
 */
export function Photo({
  photo,
  kind = 'scene',
  name,
  className,
  missingText = 'No photo yet',
}: {
  photo: { id: MediaId; alt: string } | null;
  kind?: 'person' | 'scene';
  /** Used for initials when a person has no photo. */
  name?: string;
  className?: string;
  missingText?: string;
}) {
  const media = useMediaUrl(photo?.id);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [media.url]);
  const cls = `photo photo-${kind}${className ? ` ${className}` : ''}`;

  if (media.status === 'loading') {
    return <div className={`${cls} photo-loading`} aria-hidden />;
  }
  if (media.status === 'ready' && media.url && !broken) {
    return <img className={cls} src={media.url} alt={photo?.alt || ''} onError={() => setBroken(true)} />;
  }
  if (kind === 'person') {
    const letters = name ? initials(name) : '';
    return (
      <div className={`${cls} photo-missing`} role="img" aria-label={name ? `No photo of ${name} yet` : missingText}>
        {letters ? <span className="photo-initials">{letters}</span> : <UserRound size={56} aria-hidden />}
      </div>
    );
  }
  return (
    <div className={`${cls} photo-missing`} role="img" aria-label={missingText}>
      <ImageOff size={40} aria-hidden />
      <span>{missingText}</span>
    </div>
  );
}
