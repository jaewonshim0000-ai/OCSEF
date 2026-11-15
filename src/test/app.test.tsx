import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { MemoryBackend } from '../lib/db';
import { seedSample, type DemoMediaLoader } from '../lib/repo';
import { DEMO_MEDIA, SAMPLE_PIN } from '../lib/seed';

const loader: DemoMediaLoader = async (backend) => {
  const ids = new Set<string>();
  for (const [id, { mime }] of Object.entries(DEMO_MEDIA)) {
    await backend.putMedia({ id, blob: new Blob(['x'], { type: mime }), mime, createdAt: 0 });
    ids.add(id);
  }
  return ids;
};

async function renderApp() {
  const user = userEvent.setup();
  const backend = new MemoryBackend();
  await seedSample(backend, loader);
  render(<App backend={backend} loader={loader} />);
  await screen.findByRole('heading', { name: 'Enter PIN' });
  return { user, backend };
}

function wrongPinsInARow(): string {
  const term = screen.getByText('Wrong PINs in a row').nextElementSibling;
  return term?.textContent ?? '';
}

async function enterPin(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const d of digits) {
    await user.click(screen.getByRole('button', { name: d }));
  }
  // The PIN is checked against a hash, which takes a moment.
  await waitFor(() => expect(screen.queryByText(/Checking/)).not.toBeInTheDocument());
}

function goToHash(path: string) {
  act(() => {
    window.history.pushState(null, '', `#${path}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

async function renderFresh(backend: MemoryBackend = new MemoryBackend()) {
  const user = userEvent.setup();
  render(<App backend={backend} loader={loader} />);
  await screen.findByRole('heading', { name: 'Welcome to Familiar Place' });
  return { user, backend };
}

const HELPER_PIN = '246810';

/** Runs the first-run wizard: helper PIN, name, their PIN (or none), skip home and contact. */
async function quickSetup(
  user: ReturnType<typeof userEvent.setup>,
  { pin = '1357', name = 'Ada' }: { pin?: string | null; name?: string } = {},
) {
  await user.click(screen.getByRole('button', { name: 'Set up for someone' }));
  await screen.findByRole('heading', { name: 'Choose a helper PIN' });
  await enterPin(user, HELPER_PIN);
  await enterPin(user, HELPER_PIN);
  await user.type(await screen.findByLabelText('Preferred name'), name);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Choose their PIN' });
  if (pin) {
    await enterPin(user, pin);
    await enterPin(user, pin);
  } else {
    await user.click(screen.getByRole('button', { name: "Don't use a PIN" }));
  }
  await screen.findByRole('heading', { name: 'Home' });
  await user.click(screen.getByRole('button', { name: 'Skip for now' }));
  await screen.findByRole('heading', { name: 'Someone they trust' });
  await user.click(screen.getByRole('button', { name: pin ? 'Skip for now' : 'Skip and finish' }));
  if (pin) {
    await screen.findByRole('heading', { name: 'Before unlock' });
    await user.click(screen.getByRole('button', { name: 'Finish' }));
  }
  await screen.findByRole('heading', { name: new RegExp(`Good (morning|afternoon|evening), ${name}`) });
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('simulated lock screen', () => {
  it('offers the sample PIN in sample mode, with no demo banner', async () => {
    await renderApp();
    expect(screen.queryByText('Demo phone lock screen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use sample PIN/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get help' })).toBeInTheDocument();
  });

  it('three wrong PINs keep the keypad; the fourth opens help', async () => {
    const { user } = await renderApp();
    for (let i = 1; i <= 3; i++) {
      await enterPin(user, '1111');
      expect(screen.getByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent("That PIN didn't match");
      expect(screen.getByRole('img', { name: '0 of 4 numbers entered' })).toBeInTheDocument();
      expect(wrongPinsInARow()).toBe(String(i));
    }
    await enterPin(user, '1111');
    expect(await screen.findByRole('heading', { name: 'Need a hand?' })).toBeInTheDocument();
    expect(screen.getByText(/Having trouble unlocking/)).toBeInTheDocument();
    for (const name of [/^Home/, /^Family/, /^You/, /^Routine/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('keeps the count after automatic help and does not reopen it', async () => {
    const { user } = await renderApp();
    for (let i = 0; i < 4; i++) await enterPin(user, '9999');
    await screen.findByRole('heading', { name: 'Need a hand?' });
    await user.click(screen.getByRole('button', { name: 'Try PIN again' }));
    expect(screen.getByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
    expect(wrongPinsInARow()).toBe('4');
    await enterPin(user, '9999');
    expect(screen.getByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
    expect(wrongPinsInARow()).toBe('5');
    expect(screen.getByRole('button', { name: 'Get help' })).toBeInTheDocument();
  });

  it('backspace, incomplete entries and opening help do not count', async () => {
    const { user } = await renderApp();
    await enterPin(user, '12');
    await user.click(screen.getByRole('button', { name: 'Delete last number' }));
    expect(screen.getByRole('img', { name: '1 of 4 numbers entered' })).toBeInTheDocument();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard('{Enter}');
    expect(screen.getByRole('img', { name: '1 of 4 numbers entered' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Enter all 4 numbers');
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    expect(screen.getByRole('heading', { name: 'Need a hand?' })).toBeInTheDocument();
    expect(screen.queryByText(/Having trouble unlocking/)).not.toBeInTheDocument();
    expect(wrongPinsInARow()).toBe('0');
  });

  it('accepts digits from a physical keyboard', async () => {
    const { user } = await renderApp();
    await user.keyboard('123');
    expect(screen.getByRole('img', { name: '3 of 4 numbers entered' })).toBeInTheDocument();
    await user.keyboard('4');
    await waitFor(() => expect(screen.queryByText(/Checking/)).not.toBeInTheDocument());
    expect(wrongPinsInARow()).toBe('1');
  });

  it('a correct PIN resets the count and opens the daily companion', async () => {
    const { user } = await renderApp();
    await enterPin(user, '1111');
    await enterPin(user, '2222');
    await enterPin(user, SAMPLE_PIN);
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Peggy/ })).toBeInTheDocument();
    expect(wrongPinsInARow()).toBe('0');
  });
});

describe('locked help views', () => {
  it('Family shows the approved contact and a demo call that never dials', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    await user.click(screen.getByRole('button', { name: /^Family/ }));
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText(/My daughter/)).toBeInTheDocument();
    expect(screen.queryByText(/07700/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sam')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Play Maya's message" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Play Sam's message" })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Call Maya/ }));
    expect(screen.getByRole('heading', { name: 'Calling Maya' })).toBeInTheDocument();
    expect(screen.getByText('This is a demo. No real call is being made.')).toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    expect(screen.queryByText(/07700/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'End demo call' }));
    expect(screen.getByRole('heading', { name: 'Family' })).toBeInTheDocument();
  });

  it('Home shows the cue but never the address', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    await user.click(screen.getByRole('button', { name: /^Home/ }));
    expect(screen.getByText('My front door is blue, with red flowers on each side.')).toBeInTheDocument();
    expect(screen.getByText('The full address is private until the phone is unlocked.')).toBeInTheDocument();
    expect(screen.queryByText(/Elm Street/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to help' }));
    expect(screen.getByRole('heading', { name: 'Need a hand?' })).toBeInTheDocument();
  });

  it('Routine shows the approved cue and You shows the preferred name', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    await user.click(screen.getByRole('button', { name: /^Routine/ }));
    expect(screen.getByText('Lunch at noon')).toBeInTheDocument();
    expect(screen.queryByText('Tea with Maya')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to help' }));
    await user.click(screen.getByRole('button', { name: /^You/ }));
    expect(screen.getByText('Your name is Peggy.')).toBeInTheDocument();
    expect(screen.queryByText(/taught piano/)).not.toBeInTheDocument();
    expect(screen.getByText('A message from Maya')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Play Maya's message" }));
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByText(/it's Sam, your son/)).not.toBeInTheDocument();
  });

  it('opening a private route while locked returns to help without showing it', async () => {
    await renderApp();
    for (const path of ['/home', '/family/contact-maya', '/setup/privacy', '/call/contact-maya', '/today']) {
      goToHash(path);
      expect(screen.getByRole('heading', { name: 'Need a hand?' })).toBeInTheDocument();
      expect(screen.getByText(/That's private until the phone is unlocked/)).toBeInTheDocument();
      expect(screen.queryByText(/Elm Street/)).not.toBeInTheDocument();
      expect(screen.queryByText(/07700/)).not.toBeInTheDocument();
      expect(window.location.hash).toBe('#/help');
    }
  });
});

describe('daily companion', () => {
  async function unlock() {
    const ctx = await renderApp();
    await ctx.user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await screen.findByRole('heading', { name: /Good/ });
    return ctx;
  }

  it('shows the full address only after unlock, and relocking starts fresh', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: /^Home/ }));
    expect(screen.getByText('14 Elm Street, Riverton RT4 2AB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in maps' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(screen.getByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
    expect(wrongPinsInARow()).toBe('0');
    goToHash('/home');
    expect(screen.queryByText(/Elm Street/)).not.toBeInTheDocument();
  });

  it('Family lists numbers and uses demo calls by default', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: /^Family/ }));
    expect(screen.getByText('07700 900123')).toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Call Sam/ }));
    expect(screen.getByRole('heading', { name: 'Calling Sam' })).toBeInTheDocument();
    expect(screen.getByText('This is a demo. No real call is being made.')).toBeInTheDocument();
  });

  it('steps through a guided routine and resumes where it was left', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: /^Routine/ }));
    await user.click(screen.getByRole('button', { name: /Get ready to go out/ }));
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /green raincoat/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play recording' }));
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    await user.click(screen.getByRole('button', { name: 'Finish for now' }));
    await user.click(await screen.findByRole('button', { name: /Paused at step 3 of 4/ }));
    expect(screen.getByText('Welcome back. You stopped at step 3 of 4.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carry on from step 3' }));
    expect(screen.getByText(/Step 3 of 4/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    await user.click(screen.getByRole('button', { name: 'All done' }));
    expect(screen.getByRole('heading', { name: 'All done' })).toBeInTheDocument();
  });

  it('browses memories and plays a recording', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: /Memories/ }));
    expect(screen.getByRole('heading', { name: 'Whitby beach, 1978' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'My rose garden' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('heading', { name: 'Whitby beach, 1978' })).toBeInTheDocument();
  });

  it('lists favourite music with its memory, and Play picks the song that plays', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: /Music/ }));
    expect(screen.getByRole('heading', { name: 'Music' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Riverside Waltz' })).toBeInTheDocument();
    expect(screen.getByText(/We danced to this at our wedding/)).toBeInTheDocument();
    expect(screen.getByText(/A slow, gentle waltz/)).toBeInTheDocument();
    // The first song started by itself after unlock.
    expect(await screen.findByRole('button', { name: 'Pause: The Riverside Waltz' })).toBeInTheDocument();
    expect(screen.getByText('Playing now')).toBeInTheDocument();
    // Choosing another song switches to it: still one song at a time.
    await user.click(screen.getByRole('button', { name: "Play: Peggy's lullaby" }));
    expect(await screen.findByRole('button', { name: "Pause: Peggy's lullaby" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play: The Riverside Waltz' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Pause: Peggy's lullaby" }));
    expect(screen.getByRole('button', { name: "Play: Peggy's lullaby" })).toBeInTheDocument();
    expect(screen.queryByText('Playing now')).not.toBeInTheDocument();
    expect(screen.getByText(/added yet. A helper can add it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen.getByRole('heading', { name: /Good/ })).toBeInTheDocument();
  });

  it('You gathers every family voice message to remind the person who they are', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: /^You/ }));
    expect(screen.getByRole('heading', { name: /Voices from your family/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Play Maya's message" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Play Sam's message" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Play Priya's message" })).not.toBeInTheDocument();
    expect(screen.getByText(/it's Sam, your son/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Play Sam's message" }));
    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
  });

  it('persistent Get help opens the four buttons with full views', async () => {
    const { user } = await unlock();
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    expect(screen.getByRole('heading', { name: 'Need a hand?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Home/ }));
    expect(screen.getByText('14 Elm Street, Riverton RT4 2AB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to help' })).toBeInTheDocument();
  });
});

describe('background music', () => {
  async function unlock() {
    const ctx = await renderApp();
    await ctx.user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await screen.findByRole('heading', { name: /Good/ });
    return ctx;
  }

  function musicStatus(): string {
    return screen.getByText('Background music', { selector: 'dt' }).nextElementSibling?.textContent ?? '';
  }

  it('starts by itself after unlock and is controlled from the top-right corner', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    try {
      const { user } = await renderApp();
      expect(screen.queryByRole('button', { name: /Background music/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
      const corner = await screen.findByRole('button', { name: 'Background music playing: The Riverside Waltz' });
      // Top right: the last button in the top bar, after Get help.
      expect(corner.closest('.topbar-right')?.lastElementChild).toBe(corner);
      expect(play.mock.instances.some((el) => (el as unknown as HTMLMediaElement).src.startsWith('blob:'))).toBe(true);
      expect(musicStatus()).toBe('Playing');

      await user.click(corner);
      const dialog = screen.getByRole('dialog', { name: 'Music' });
      expect(within(dialog).getByText('Now playing')).toBeInTheDocument();
      expect(within(dialog).getByText('The Riverside Waltz')).toBeInTheDocument();
      expect(within(dialog).getByText(/We danced to this at our wedding/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Pause music' }));
      expect(within(dialog).getByRole('button', { name: 'Play music' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Background music paused: The Riverside Waltz' })).toBeInTheDocument();
      expect(musicStatus()).toBe('Paused');

      await user.click(within(dialog).getByRole('button', { name: 'Next song' }));
      expect(within(dialog).getByText("Peggy's lullaby")).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Play music' }));
      expect(await screen.findByRole('button', { name: "Background music playing: Peggy's lullaby" })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'See all songs' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Music' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: "Pause: Peggy's lullaby" })).toBeInTheDocument();
    } finally {
      play.mockRestore();
    }
  });

  it('steps aside for a voice message, and stops while the phone is locked', async () => {
    const { user } = await unlock();
    await screen.findByRole('button', { name: 'Background music playing: The Riverside Waltz' });
    await user.click(screen.getByRole('button', { name: /^You/ }));
    await user.click(screen.getByRole('button', { name: "Play Sam's message" }));
    expect(screen.getByRole('button', { name: 'Background music paused for now: The Riverside Waltz' })).toBeInTheDocument();
    expect(musicStatus()).toBe('Paused for another sound');
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('button', { name: 'Background music playing: The Riverside Waltz' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(musicStatus()).toBe('Off while locked');
    expect(screen.queryByRole('button', { name: /Background music/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    await user.click(screen.getByRole('button', { name: /^Family/ }));
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Background music/ })).not.toBeInTheDocument();
    expect(screen.queryByText('The Riverside Waltz')).not.toBeInTheDocument();
    // A message ending while locked doesn't bring the music back.
    await user.click(screen.getByRole('button', { name: "Play Maya's message" }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(musicStatus()).toBe('Off while locked');

    goToHash('/lock');
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    expect(await screen.findByRole('button', { name: 'Background music playing: The Riverside Waltz' })).toBeInTheDocument();
  });

  it('a pause lasts for the visit, and a helper can turn background music off', async () => {
    const { user } = await unlock();
    await user.click(await screen.findByRole('button', { name: /Background music playing/ }));
    await user.click(screen.getByRole('button', { name: 'Pause music' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    expect(await screen.findByRole('button', { name: 'Background music paused: The Riverside Waltz' })).toBeInTheDocument();

    // Play again, then a helper turns background music off: it stops at once and stays off.
    await user.click(screen.getByRole('button', { name: /Background music paused/ }));
    await user.click(screen.getByRole('button', { name: 'Play music' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await screen.findByRole('button', { name: /Background music playing/ });
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await user.click(screen.getByRole('button', { name: /^Music/ }));
    const toggle = screen.getByRole('switch', { name: 'Play music in the background' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('button', { name: /Background music paused/ })).toBeInTheDocument();
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await screen.findByRole('heading', { name: /Good/ });
    expect(screen.getByRole('button', { name: /Background music paused/ })).toBeInTheDocument();
  });
});

describe('setup and consent', () => {
  async function unlockToSetup() {
    const ctx = await renderApp();
    await ctx.user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await ctx.user.click(await screen.findByRole('button', { name: 'Helper setup' }));
    return ctx;
  }

  it('stopping an item removes it from the locked view immediately', async () => {
    const { user } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /Before unlock/ }));
    await user.click(screen.getByRole('button', { name: /Stop showing: Voice message/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Stop showing: Voice message/ })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Stop showing: Landmark cue/ }));
    await waitFor(() => expect(screen.queryByText(/Landmark cue:/)).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Remove Maya from the locked screen/ }));
    await waitFor(() => expect(screen.queryByText('Shown person: Maya')).not.toBeInTheDocument());

    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await user.click(screen.getByRole('button', { name: 'Get help' }));
    await user.click(screen.getByRole('button', { name: /^Home/ }));
    expect(screen.queryByText(/My front door is blue/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to help' }));
    await user.click(screen.getByRole('button', { name: /^Family/ }));
    expect(screen.getByText(/No one has been chosen to show here yet/)).toBeInTheDocument();
    expect(screen.queryByText('Maya')).not.toBeInTheDocument();
  });

  it('new switches start off, and preview shows the draft before saving', async () => {
    const { user } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /About you/ }));
    const voiceSwitch = screen.getByRole('switch', { name: /Show before unlock: voice message/ });
    expect(voiceSwitch).toHaveAttribute('aria-checked', 'false');
    await user.click(voiceSwitch);
    expect(voiceSwitch).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('You have changes that are not saved yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Preview locked view' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^You/ }));
    expect(within(dialog).getByRole('button', { name: 'Play my message' })).toBeInTheDocument();
    // The preview looks exactly like the locked screen: no music button.
    expect(within(dialog).queryByRole('button', { name: /Background music/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('adding a person keeps every Show before unlock switch off', async () => {
    const { user } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /^Family/ }));
    await user.click(screen.getByRole('button', { name: 'Add a person' }));
    await user.type(screen.getByLabelText('Name'), 'Ruth');
    await user.type(screen.getByLabelText('Phone number'), '07700 900999');
    for (const sw of screen.getAllByRole('switch', { name: /Show before unlock/ })) {
      expect(sw).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.getByRole('switch', { name: "Show before unlock: Ruth's voice message" })).toBeDisabled();
    expect(screen.getByText('A voice message from Ruth')).toBeInTheDocument();
    expect(screen.getByText(/Hi, it’s Ruth\. You’re Peggy, and you’re safe\./)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Relationship'), 'My niece');
    expect(screen.getByText(/Hi, it’s Ruth, your niece\. You’re Peggy/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Family setup' }));
    expect(screen.getByText('Ruth')).toBeInTheDocument();
  });

  it('a helper can add a favourite song', async () => {
    const { user } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /^Music/ }));
    await user.click(screen.getByRole('button', { name: 'Add a song' }));
    await user.type(screen.getByLabelText('Song name'), 'Blue Skies Over Riverton');
    await user.type(screen.getByLabelText('The memory it brings back (optional)'), 'Our first holiday.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    goToHash('/music');
    expect(screen.getByRole('heading', { name: 'Blue Skies Over Riverton' })).toBeInTheDocument();
    expect(screen.getByText('Our first holiday.')).toBeInTheDocument();
  });

  it('erase everything returns to Welcome with nothing kept', async () => {
    const { user, backend } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /Settings and reset/ }));
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erase everything' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to Familiar Place' })).toBeInTheDocument();
    expect(await backend.getAll('contacts')).toEqual([]);
    goToHash('/today');
    expect(screen.getByRole('heading', { name: 'Welcome to Familiar Place' })).toBeInTheDocument();
  });
});

describe('locking again', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('locks after 5 minutes in the background, but not after 1', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await screen.findByRole('heading', { name: /Good/ });

    setVisibility('hidden');
    vi.setSystemTime(Date.now() + 60_000);
    setVisibility('visible');
    expect(screen.getByRole('heading', { name: /Good/ })).toBeInTheDocument();

    setVisibility('hidden');
    vi.setSystemTime(Date.now() + 5 * 60_000);
    setVisibility('visible');
    expect(await screen.findByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
  });
});

describe('first run', () => {
  it('sets up from blank, then locks with their own PIN', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    expect(screen.getByText(/All set/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Music/ }));
    expect(screen.getByText('No favourite music has been added yet.')).toBeInTheDocument();
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(screen.queryByRole('button', { name: /Use sample PIN/ })).not.toBeInTheDocument();
    await enterPin(user, '2580');
    expect(screen.getByRole('status')).toHaveTextContent("That PIN didn't match");
    await enterPin(user, '1357');
    expect(await screen.findByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
  });

  it('without a PIN, opens straight to Today, now, next time and after time away', async () => {
    const { user, backend } = await renderFresh();
    await quickSetup(user, { pin: null });
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      setVisibility('hidden');
      vi.setSystemTime(Date.now() + 6 * 60_000);
      setVisibility('visible');
      expect(screen.getByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    }
    cleanup();
    render(<App backend={backend} loader={loader} />);
    expect(await screen.findByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
  });

  it('resumes at the same step after closing the app', async () => {
    const { user, backend } = await renderFresh();
    await user.click(screen.getByRole('button', { name: 'Set up for someone' }));
    await enterPin(user, HELPER_PIN);
    await enterPin(user, HELPER_PIN);
    await user.type(await screen.findByLabelText('Preferred name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Choose their PIN' });
    cleanup();
    render(<App backend={backend} loader={loader} />);
    expect(await screen.findByRole('heading', { name: 'Choose their PIN' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Preferred name')).toHaveValue('Ada');
  });

  it('asks for a number for a named trusted person, and Back then Next never adds them twice', async () => {
    const { user, backend } = await renderFresh();
    await user.click(screen.getByRole('button', { name: 'Set up for someone' }));
    await enterPin(user, HELPER_PIN);
    await enterPin(user, HELPER_PIN);
    await user.type(await screen.findByLabelText('Preferred name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Choose their PIN' });
    await enterPin(user, '1357');
    await enterPin(user, '1357');
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.type(await screen.findByLabelText('Name'), 'Maya');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add a phone number');
    await user.type(screen.getByLabelText('Phone number'), '07700 900123');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Before unlock' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Name')).toHaveValue('Maya');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Before unlock' });
    await user.click(screen.getByRole('switch', { name: "Maya's name" }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await screen.findByRole('heading', { name: /Good .*, Ada/ });
    expect(await backend.getAll('contacts')).toHaveLength(1);
    expect((await backend.getKV<{ contact: { id: string; name: boolean } }>('approvals'))?.contact.name).toBe(true);
  });

  it('opens the sample family from Welcome', async () => {
    const { user } = await renderFresh();
    await user.click(screen.getByRole('button', { name: 'Look around with a sample family' }));
    await user.click(await screen.findByRole('button', { name: /Use sample PIN/ }));
    expect(await screen.findByRole('heading', { name: /Good .*, Peggy/ })).toBeInTheDocument();
  });
});

describe('helper gate', () => {
  afterEach(() => vi.useRealTimers());

  it('asks for the helper PIN, waits after 5 wrong tries, then stays open for 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { user } = await renderFresh();
    await quickSetup(user);
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Enter the helper PIN' })).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await enterPin(user, '111111');
    expect(screen.getByRole('status')).toHaveTextContent("That isn't the helper PIN.");
    await enterPin(user, '111111');
    expect(screen.getByText(/Try again in 30 seconds/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeDisabled();

    vi.setSystemTime(Date.now() + 30_000);
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toBeEnabled(), { timeout: 2500 });
    await enterPin(user, HELPER_PIN);
    expect(await screen.findByRole('heading', { name: 'Helper setup' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Helper setup' })).toBeInTheDocument();

    vi.setSystemTime(Date.now() + 10 * 60_000);
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Enter the helper PIN' })).toBeInTheDocument();
  });

  it('Cancel returns to Today without opening setup', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: /Good/ })).toBeInTheDocument();
  });

  it('a forgotten helper PIN can only lead to erasing, after two confirmations', async () => {
    const { user, backend } = await renderFresh();
    await quickSetup(user);
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await user.click(screen.getByRole('button', { name: 'Forgot the helper PIN?' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erase everything' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erase everything' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, erase everything' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to Familiar Place' })).toBeInTheDocument();
    expect((await backend.getKV<{ preferredName: string }>('profile'))?.preferredName).toBe('');
  });

  it('the sample family skips the gate', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await user.click(await screen.findByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Helper setup' })).toBeInTheDocument();
  });
});

describe('PIN settings', () => {
  async function toSettings(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await enterPin(user, HELPER_PIN);
    await user.click(await screen.findByRole('button', { name: /Settings and reset/ }));
  }

  it('changes their PIN only when both entries match', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    await toSettings(user);
    await user.click(screen.getByRole('button', { name: 'Change their PIN' }));
    const dialog = screen.getByRole('dialog');
    await enterPin(user, '1111');
    await enterPin(user, '2222');
    expect(within(dialog).getByRole('status')).toHaveTextContent("Those didn't match");
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await enterPin(user, '1357');
    expect(await screen.findByRole('heading', { name: /Good/ })).toBeInTheDocument();

    await toSettings(user);
    await user.click(screen.getByRole('button', { name: 'Change their PIN' }));
    await enterPin(user, '9999');
    await enterPin(user, '9999');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await enterPin(user, '1357');
    expect(screen.getByRole('status')).toHaveTextContent("That PIN didn't match");
    await enterPin(user, '9999');
    expect(await screen.findByRole('heading', { name: /Good/ })).toBeInTheDocument();
  });

  it('turning the PIN off removes the Lock button', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    await toSettings(user);
    await user.click(screen.getByRole('switch', { name: 'Ask for a PIN to open Familiar Place' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Turn off the PIN' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Ask for a PIN to open Familiar Place' })).toHaveAttribute('aria-checked', 'false'));
    goToHash('/today');
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
  });
});
