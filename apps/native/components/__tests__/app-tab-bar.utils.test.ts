import { describe, expect, it } from 'vitest';

import { getTabPressActions } from '../app-tab-bar.utils';

describe('getTabPressActions', () => {
  it('resets the nested stack then switches when pressing an unfocused tab with a pushed detail screen', () => {
    // Bug repro: user drilled into discover/event/[id], switched away, then taps Discover.
    // Without the reset they land back on the detail screen instead of the list.
    const actions = getTabPressActions({
      isFocused: false,
      defaultPrevented: false,
      tabName: 'discover',
      nestedStackKey: 'stack-discover',
    });

    expect(actions).toEqual([
      { type: 'popToTop', target: 'stack-discover' },
      { type: 'navigate', tab: 'discover' },
    ]);
  });

  it('pops the active tab to its root list when re-tapping a focused tab showing a detail', () => {
    const actions = getTabPressActions({
      isFocused: true,
      defaultPrevented: false,
      tabName: 'bookings',
      nestedStackKey: 'stack-bookings',
    });

    expect(actions).toEqual([{ type: 'popToTop', target: 'stack-bookings' }]);
  });

  it('only switches tabs when the nested stack has never been initialised', () => {
    const actions = getTabPressActions({
      isFocused: false,
      defaultPrevented: false,
      tabName: 'discover',
      nestedStackKey: undefined,
    });

    expect(actions).toEqual([{ type: 'navigate', tab: 'discover' }]);
  });

  it('does nothing when a tabPress listener prevented the default', () => {
    const actions = getTabPressActions({
      isFocused: false,
      defaultPrevented: true,
      tabName: 'discover',
      nestedStackKey: 'stack-discover',
    });

    expect(actions).toEqual([]);
  });
});
