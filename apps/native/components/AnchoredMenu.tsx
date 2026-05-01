import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  Text,
  TouchableWithoutFeedback,
  View,
  type View as RNView,
} from 'react-native';

export type AnchoredMenuItem = {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
  /** When set, taps show a native confirmation Alert before calling onPress. */
  confirm?: {
    title: string;
    message: string;
    confirmLabel: string;
  };
  testID?: string;
};

type Anchor = { top?: number; bottom?: number; right: number };

type Props = {
  items: AnchoredMenuItem[];
  /** Square trigger button size in px. Default 32. */
  triggerSize?: number;
  /** Tailwind class for the trigger background. Default 'bg-green-10'. */
  triggerBgClassName?: string;
  /** Color of the kebab icon. Default '#080808'. */
  iconColor?: string;
  accessibilityLabel?: string;
  testID?: string;
};

// Used only to decide whether to flip the menu above the trigger; not a hard
// height. Real height is driven by content via min-w/auto-height.
const ESTIMATED_ITEM_HEIGHT = 44;
const MENU_VERTICAL_PADDING = 8;
const MENU_GAP = 6;

export function AnchoredMenu({
  items,
  triggerSize = 32,
  triggerBgClassName = 'bg-green-10',
  iconColor = '#080808',
  accessibilityLabel = 'More options',
  testID,
}: Props) {
  const triggerRef = useRef<RNView>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const close = () => setOpen(false);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      const screen = Dimensions.get('window');
      const estimatedHeight = items.length * ESTIMATED_ITEM_HEIGHT + MENU_VERTICAL_PADDING * 2;
      const spaceBelow = screen.height - (y + h);
      const flipUp = spaceBelow < estimatedHeight + MENU_GAP;

      const right = Math.max(0, screen.width - (x + w));

      setAnchor(
        flipUp ? { bottom: screen.height - y + MENU_GAP, right } : { top: y + h + MENU_GAP, right }
      );
      setOpen(true);
    });
  };

  const handleItemPress = (item: AnchoredMenuItem) => {
    close();
    if (!item.confirm) {
      item.onPress();
      return;
    }
    Alert.alert(item.confirm.title, item.confirm.message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: item.confirm.confirmLabel,
        style: item.destructive ? 'destructive' : 'default',
        onPress: item.onPress,
      },
    ]);
  };

  const iconSize = Math.round(triggerSize * 0.5);

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        hitSlop={8}
        className={`items-center justify-center rounded-full active:opacity-80 ${triggerBgClassName}`}
        style={{ height: triggerSize, width: triggerSize }}
      >
        <Ionicons name="ellipsis-horizontal" size={iconSize} color={iconColor} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={close}>
          <View className="flex-1">
            {anchor && (
              <TouchableWithoutFeedback>
                <View
                  className="absolute rounded-2xl bg-white py-1 min-w-[160px] shadow-2xl"
                  style={anchor}
                >
                  {items.map((item, idx) => (
                    <Pressable
                      key={`${item.label}-${idx}`}
                      onPress={() => handleItemPress(item)}
                      testID={item.testID}
                      className="flex-row items-center px-4 py-3 active:bg-black/5"
                    >
                      {item.icon && (
                        <Ionicons
                          name={item.icon}
                          size={16}
                          color={item.destructive ? '#dc2626' : '#080808'}
                          style={{ marginRight: 10 }}
                        />
                      )}
                      <Text
                        className="text-sm font-semibold font-urbanist"
                        style={{ color: item.destructive ? '#dc2626' : '#080808' }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
