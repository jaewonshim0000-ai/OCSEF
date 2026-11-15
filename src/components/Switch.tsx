import { useId, type ReactNode } from 'react';

/** An accessible on/off switch that states its value in words, not colour alone. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  accessibleName,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Overrides the visible label for screen readers, e.g. to say which field it controls. */
  accessibleName?: string;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <div className={`switch-row${disabled ? ' is-disabled' : ''}`}>
      <div className="switch-text">
        <span id={labelId} className="switch-label">
          {label}
        </span>
        {description ? (
          <span id={descId} className="switch-desc">
            {description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={accessibleName}
        aria-labelledby={accessibleName ? undefined : labelId}
        aria-describedby={description ? descId : undefined}
        className={`switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch-track" aria-hidden>
          <span className="switch-thumb" />
        </span>
        <span className="switch-state" aria-hidden>
          {checked ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  );
}

/** The "Show before unlock" switch used beside each eligible field. */
export function ShowBeforeUnlock({
  checked,
  onChange,
  what,
  disabled,
  note,
  label = 'Show before unlock',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  what: string;
  disabled?: boolean;
  note?: ReactNode;
  /** Visible label, for forms with several switches, e.g. "Show name before unlock". */
  label?: string;
}) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      label={label}
      accessibleName={`Show before unlock: ${what}`}
      description={note}
    />
  );
}
