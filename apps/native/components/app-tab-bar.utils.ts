// Pure decision logic for the custom bottom tab bar, extracted so it can be unit
// tested without a React Native renderer.
//
// Each tab in (tabs) hosts its own nested Stack (e.g. discover/index -> discover/event/[id]).
// React Navigation preserves a tab's nested stack history across tab switches, so drilling
// into a detail screen and then leaving the tab leaves that detail on top — re-entering the
// tab shows the detail instead of the list. We fix that by popping the tab's nested stack to
// its root whenever the tab is pressed.

export type TabPressAction =
  | { type: 'popToTop'; target: string }
  | { type: 'navigate'; tab: string };

type GetTabPressActionsParams = {
  /** Whether the pressed tab is the currently active tab. */
  isFocused: boolean;
  /** Whether a `tabPress` listener called `preventDefault()`. */
  defaultPrevented: boolean;
  /** Route name of the pressed tab (e.g. "discover"). */
  tabName: string;
  /**
   * Navigation state key of the tab's nested stack, if it has been initialised.
   * Undefined when the tab has never been visited (nothing to reset yet).
   */
  nestedStackKey: string | undefined;
};

/**
 * Resolve the navigation actions to perform when a bottom tab is pressed.
 *
 * - Always resets the tab's nested stack to its root list view (no-op when already there).
 * - Switches to the tab when it isn't already focused.
 * - Does nothing when a listener prevented the default tab press.
 */
export function getTabPressActions({
  isFocused,
  defaultPrevented,
  tabName,
  nestedStackKey,
}: GetTabPressActionsParams): TabPressAction[] {
  if (defaultPrevented) return [];

  const actions: TabPressAction[] = [];

  if (nestedStackKey) {
    actions.push({ type: 'popToTop', target: nestedStackKey });
  }

  if (!isFocused) {
    actions.push({ type: 'navigate', tab: tabName });
  }

  return actions;
}
