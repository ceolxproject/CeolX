import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';

interface MapCentrePinProps {
  /** Shown instead of the pin glyph — the Add Location screen pins the user's avatar. */
  avatarUrl?: string | null;
  // Two purples exist across the app (#662FFF on the location sheet, #6155F5 on Add
  // Location). Kept as a prop so this stays behaviour-preserving; unifying them is a
  // design decision, not part of this fix.
  color?: string;
}

/**
 * Pin fixed to the centre of a map. The user moves the map under it rather than
 * placing the pin, so there is no tap handler to fire by accident and no network
 * round-trip between the gesture and the pin appearing to move.
 *
 * `pointerEvents="none"` is load-bearing: it lets pan gestures reach the MapView.
 */
export function MapCentrePin({ avatarUrl, color = '#662FFF' }: MapCentrePinProps) {
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      {avatarUrl ? (
        <View
          className="h-12 w-12 overflow-hidden rounded-full border-2 bg-black"
          style={{ borderColor: color }}
        >
          <Image source={{ uri: avatarUrl }} className="h-full w-full" resizeMode="cover" />
        </View>
      ) : (
        // marginBottom lifts the glyph so its tip, not its centre, marks the point
        <Ionicons name="location-sharp" size={40} color={color} style={{ marginBottom: 40 }} />
      )}
    </View>
  );
}
