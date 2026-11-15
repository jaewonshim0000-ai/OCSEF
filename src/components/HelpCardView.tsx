import type { LockedHelpCard } from '../lib/preview';
import { PhoneCallButton } from './PhoneCall';

/** Everything the card says, for Read aloud. */
export function helpCardText(card: LockedHelpCard): string {
  return [
    card.message,
    card.name ? `My name is ${card.name}.` : '',
    card.address ? `I live at ${card.address}.` : '',
    card.contact ? `Please call ${card.contact.name}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The "Help me tell someone" card. Built only from the locked preview, so it
 * shares exactly what the helper switched on. In the setup preview, the Call
 * button is left out.
 */
export function HelpCardView({ card, preview = false }: { card: LockedHelpCard; preview?: boolean }) {
  return (
    <div className="help-card">
      <p className="help-card-message">{card.message}</p>
      {card.name ? <p className="help-card-line">{`My name is ${card.name}.`}</p> : null}
      {card.address ? <p className="help-card-line">{`I live at ${card.address}.`}</p> : null}
      {card.contact ? (
        <>
          <p className="help-card-line">{`Please call ${card.contact.name}.`}</p>
          {card.contact.call?.mode === 'phone' && !preview ? (
            <PhoneCallButton phone={card.contact.call.phone} label={`Call ${card.contact.name}`} />
          ) : null}
          {card.contact.call?.mode === 'demo' ? <p className="muted">Sample family: no real call is made.</p> : null}
        </>
      ) : null}
    </div>
  );
}
