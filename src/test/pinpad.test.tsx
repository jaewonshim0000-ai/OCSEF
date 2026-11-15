import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PinPad } from '../components/PinPad';

describe('PinPad', () => {
  it('ignores digits while a PIN is being checked', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    render(<PinPad length={4} onSubmit={onSubmit} />);
    await user.keyboard('12345678');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1234');
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    await act(async () => release());
    expect(screen.getByRole('img', { name: '0 of 4 numbers entered' })).toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent('Checking');
  });

  it('shows the message it is given', async () => {
    const user = userEvent.setup();
    render(<PinPad length={6} onSubmit={async () => ({ message: 'Nope.', shake: true })} />);
    for (const d of '123456') await user.click(screen.getByRole('button', { name: d }));
    expect(await screen.findByText('Nope.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 6 numbers entered' })).toBeInTheDocument();
  });

  it('asks for every number when Enter is pressed early, and deletes one at a time', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<PinPad length={4} onSubmit={onSubmit} />);
    await user.keyboard('12');
    await user.keyboard('{Backspace}');
    expect(screen.getByRole('img', { name: '1 of 4 numbers entered' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Enter all 4 numbers.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<PinPad length={4} onSubmit={onSubmit} disabled />);
    await user.keyboard('1234');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
  });
});
