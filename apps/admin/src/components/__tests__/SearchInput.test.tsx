// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchInput } from '../SearchInput';

describe('SearchInput', () => {
  it('renders with given value', () => {
    render(<SearchInput value="hello" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  describe('debounced onChange', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('debounces onChange by 300ms', () => {
      const onChange = vi.fn();
      render(<SearchInput value="" onChange={onChange} />);
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });

      // Not called yet — within debounce window
      expect(onChange).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(onChange).toHaveBeenCalledWith('abc');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does not fire onChange on a parent re-render when the value is unchanged', () => {
      // Reproduces the pagination bug: parents pass an inline onChange that
      // changes identity every render. Re-rendering must not re-emit onChange
      // (which would clobber sibling state like the current page).
      const onChange = vi.fn();
      const { rerender } = render(<SearchInput value="" onChange={onChange} />);

      // Simulate a parent re-render (e.g. page state changed) with a brand-new
      // onChange function identity but the same controlled value.
      rerender(<SearchInput value="" onChange={vi.fn(onChange)} />);
      vi.runAllTimers();

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('does not show clear button when value is empty', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('shows clear button when rendered with a non-empty value', () => {
    render(<SearchInput value="test" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears input and calls onChange immediately when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);
    await user.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('uses custom placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Find events…" />);
    expect(screen.getByPlaceholderText('Find events…')).toBeInTheDocument();
  });
});
