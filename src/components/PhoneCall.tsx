import { useState } from 'react';
import { Phone } from 'lucide-react';
import { telHref } from '../app/paths';
import { formatPhone } from '../lib/phone';
import { LinkButton, Notice } from './ui';

/**
 * Hands the number to the phone's own dialer. A tablet or computer may have no
 * dialer, so after a tap the number is shown to dial from a phone instead.
 */
export function PhoneCallButton({ phone, label }: { phone: string; label: string }) {
  const [tapped, setTapped] = useState(false);
  return (
    <>
      <LinkButton href={telHref(phone)} variant="call" icon={Phone} onClick={() => setTapped(true)}>
        {label}
      </LinkButton>
      {tapped ? (
        <div role="status">
          <Notice>{`If no call started, dial ${formatPhone(phone)} from a phone.`}</Notice>
        </div>
      ) : null}
    </>
  );
}
