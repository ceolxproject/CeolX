// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RemoveReasonDialog } from '../RemoveReasonDialog';

function setup(onConfirm = vi.fn(), onOpenChange = vi.fn()) {
  render(<RemoveReasonDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
  return { onConfirm, onOpenChange };
}

describe('RemoveReasonDialog', () => {
  it('renders the destructive removal title', () => {
    setup();
    expect(screen.getByRole('heading', { name: /remove event/i })).toBeInTheDocument();
  });

  it('disables confirm button when reason is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: /^remove event$/i })).toBeDisabled();
  });

  it('keeps confirm disabled when reason is shorter than 10 characters', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Removal reason'), 'too short');
    expect(screen.getByRole('button', { name: /^remove event$/i })).toBeDisabled();
  });

  it('enables confirm at exactly 10 characters', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Removal reason'), 'exactly10!');
    expect(screen.getByRole('button', { name: /^remove event$/i })).toBeEnabled();
  });

  it('calls onConfirm with the trimmed reason', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(
      screen.getByLabelText('Removal reason'),
      '  Event location is outside Ireland.  '
    );
    await user.click(screen.getByRole('button', { name: /^remove event$/i }));
    expect(onConfirm).toHaveBeenCalledWith('Event location is outside Ireland.');
  });

  it('does not call onConfirm if the trimmed reason is below 10 chars', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    // 12 chars including spaces, 8 after trim — UI prevents click via disabled state
    await user.type(screen.getByLabelText('Removal reason'), '   spam!    ');
    expect(screen.getByRole('button', { name: /^remove event$/i })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clears the textarea after confirming', async () => {
    const user = userEvent.setup();
    setup();
    const textarea = screen.getByLabelText('Removal reason');
    await user.type(textarea, 'A genuine removal reason');
    await user.click(screen.getByRole('button', { name: /^remove event$/i }));
    expect(textarea).toHaveValue('');
  });

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
