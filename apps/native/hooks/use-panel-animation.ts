import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';

const PANEL_HEIGHT = 160; // compact card height for slide animation

type UsePanelAnimationResult<T> = {
  selectedItem: T | null;
  panelAnim: Animated.Value;
  markerJustPressedRef: React.MutableRefObject<boolean>;
  selectItem: (item: T) => void;
  dismissPanel: () => void;
};

/**
 * Manages a slide-up preview panel: tracks selected item, spring-in on select,
 * timing-out on dismiss. markerJustPressedRef prevents the map's
 * onRegionChangeComplete from hiding the panel immediately after a pin tap.
 */
export function usePanelAnimation<T>(): UsePanelAnimationResult<T> {
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const panelAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const markerJustPressedRef = useRef(false);

  const showPanel = useCallback(() => {
    Animated.spring(panelAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [panelAnim]);

  const dismissPanel = useCallback(() => {
    Animated.timing(panelAnim, {
      toValue: PANEL_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedItem(null));
  }, [panelAnim]);

  const selectItem = useCallback(
    (item: T) => {
      markerJustPressedRef.current = true;
      setSelectedItem(item);
      showPanel();
      setTimeout(() => {
        markerJustPressedRef.current = false;
      }, 600);
    },
    [showPanel]
  );

  return { selectedItem, panelAnim, markerJustPressedRef, selectItem, dismissPanel };
}
