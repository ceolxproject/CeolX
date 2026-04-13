// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RejectReasonDialog } from '../RejectReasonDialog';

function setup(onConfirm = vi.fn(), onOpenChange = vi.fn()) {
  render(<RejectReasonDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
  return { onConfirm, onOpenChange };
}

describe('RejectReasonDialog', () => {
  it('disables confirm button when reason is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Reject Event' })).toBeDisabled();
  });

  it('enables confirm button once a reason is typed', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Rejection reason'), 'Content violates guidelines');
    expect(screen.getByRole('button', { name: 'Reject Event' })).toBeEnabled();
  });

  it('calls onConfirm with the trimmed reason', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(screen.getByLabelText('Rejection reason'), '  Bad content  ');
    await user.click(screen.getByRole('button', { name: 'Reject Event' }));
    expect(onConfirm).toHaveBeenCalledWith('Bad content');
  });

  it('clears the textarea after confirming', async () => {
    const user = userEvent.setup();
    setup();
    const textarea = screen.getByLabelText('Rejection reason');
    await user.type(textarea, 'Some reason');
    await user.click(screen.getByRole('button', { name: 'Reject Event' }));
    expect(textarea).toHaveValue('');
  });

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
