// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from '../FormField';

describe('FormField', () => {
  it('renders label and input', () => {
    render(<FormField label="Email" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<FormField label="Email" value="" onChange={vi.fn()} error="Invalid email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('does not show error when error prop is absent', () => {
    render(<FormField label="Email" value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onChange with new value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormField label="Name" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Name'), 'Alice');
    expect(onChange).toHaveBeenCalled();
  });

  it('marks input as aria-invalid when error is present', () => {
    render(<FormField label="Name" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });
});
