import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An accessible dialog drawn inside the phone screen. Focus moves into the
 * dialog, stays there while it is open, and returns when it closes.
 */
export function Modal({
  title,
  children,
  onClose,
  full = false,
  hideTitle = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** Fill the phone screen, used for the locked-view preview. */
  full?: boolean;
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (!node) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  const root = document.getElementById('modal-root') ?? document.body;
  return createPortal(
    <div className={`modal-backdrop${full ? ' modal-full' : ''}`}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <h2 id={titleId} className={hideTitle ? 'sr-only' : 'modal-title'}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    root,
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="modal-body">{body}</div>
      <div className="modal-actions">
        <button type="button" className={`btn btn-lg btn-block ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          <span>{confirmLabel}</span>
        </button>
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={onCancel} data-autofocus>
          <span>{cancelLabel}</span>
        </button>
      </div>
    </Modal>
  );
}
