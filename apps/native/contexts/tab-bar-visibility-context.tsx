import React, { createContext, useContext, useMemo, useState } from 'react';

type TabBarVisibilityContextType = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | undefined>(undefined);

/**
 * Lets a screen hide the custom AppTabBar while an overlay owns the bottom of
 * the screen (e.g. the map's event preview card / same-location sheet). The
 * provider wraps <Tabs>, so both the screens and the tabBar can reach it across
 * the navigator boundary — React Navigation's `tabBarStyle` can't, since the
 * tab bar is custom and the map screen lives in a nested stack.
 */
export const TabBarVisibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [hidden, setHidden] = useState(false);

  const value = useMemo(() => ({ hidden, setHidden }), [hidden]);

  return (
    <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>
  );
};

export function useTabBarVisibility() {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  }
  return context;
}
