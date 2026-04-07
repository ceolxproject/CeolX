import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_HEIGHT = 52;
const SEARCH_BAR_GAP = 8;

interface MapSearchBarProps {
  placeholder?: string;
}

export function MapSearchBar({
  placeholder = 'Search by county / artist / category',
}: MapSearchBarProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER_HEIGHT + SEARCH_BAR_GAP;

  return (
    <View style={[styles.container, { top }]} pointerEvents="none">
      <View style={styles.pill}>
        <Ionicons name="search" size={20} color="#8D8D8D" />
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
        <View style={styles.filterButton}>
          <Ionicons name="options-outline" size={20} color="#8D8D8D" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 100,
    height: 44,
    paddingHorizontal: 16,
    gap: 8,
  },
  placeholder: {
    flex: 1,
    color: '#8D8D8D',
    fontSize: 14,
  },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
