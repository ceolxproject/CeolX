// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders "Live" label for active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders "Pending Review" label for pending_review status', () => {
    render(<StatusBadge status="pending_review" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders "Rejected" label for rejected status', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders "Draft" label for draft status', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders "Archived" label for archived status', () => {
    render(<StatusBadge status="archived" />);
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('applies destructive colour class for rejected status', () => {
    render(<StatusBadge status="rejected" />);
    const badge = screen.getByText('Rejected');
    expect(badge.className).toMatch(/red/);
  });

  it('applies success colour class for active status', () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByText('Live');
    expect(badge.className).toMatch(/emerald/);
  });
});
