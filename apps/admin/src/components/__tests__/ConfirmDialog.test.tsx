// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../ConfirmDialog';

function setup(props?: Partial<Parameters<typeof ConfirmDialog>[0]>) {
  const onConfirm = props?.onConfirm ?? vi.fn();
  const onOpenChange = props?.onOpenChange ?? vi.fn();
  render(
    <ConfirmDialog
      open={true}
      onOpenChange={onOpenChange}
      title="Delete item"
      description="This cannot be undone."
      onConfirm={onConfirm}
      {...props}
    />
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    setup();
    expect(screen.getByText('Delete item')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) after confirming', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders custom confirmLabel', () => {
    setup({ confirmLabel: 'Delete Forever' });
    expect(screen.getByRole('button', { name: 'Delete Forever' })).toBeInTheDocument();
  });

  it('uses destructive variant when isDangerous is true', () => {
    setup({ isDangerous: true });
    const btn = screen.getByRole('button', { name: 'Confirm' });
    expect(btn.className).toMatch(/destructive/);
  });
});
