import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface LocationMapPreviewProps {
  lat: number;
  lng: number;
  venueAddress?: string;
  distanceKm?: number;
  className?: string;
}

export function LocationMapPreview({
  lat,
  lng,
  venueAddress,
  distanceKm,
  className,
}: LocationMapPreviewProps) {
  const handleGetDirections = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    if (url) void Linking.openURL(url);
  };

  const estimatedMinutes = distanceKm ? Math.round(distanceKm * 1.5) : undefined;

  return (
    <View className={className}>
      <Text className="text-xl font-bold text-white font-sans mb-4">Location</Text>

      <View className="rounded-[10px] overflow-hidden h-[224px] relative">
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        </MapView>

        {/* Gradient scrim — darkens the top of the map so the white overlay
            text stays legible. Sits behind the controls; non-interactive. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          pointerEvents="none"
          className="absolute top-0 left-0 right-0 h-16"
        />

        {/* Top overlay — distance + time + direction button */}
        <View className="absolute top-3 left-4 right-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            {distanceKm !== undefined && (
              <View>
                <Text className="text-[13px] text-[#a8a8a8] font-sans">Distance</Text>
                <Text className="text-[13px] text-white font-medium font-sans">
                  {distanceKm.toFixed(2)} <Text className="text-[#a8a8a8] font-normal">km</Text>
                </Text>
              </View>
            )}
            {estimatedMinutes !== undefined && (
              <View>
                <Text className="text-[13px] text-[#a8a8a8] font-sans">Time</Text>
                <Text className="text-[13px] text-white font-medium font-sans">
                  {estimatedMinutes} <Text className="text-[#a8a8a8] font-normal">min</Text>
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={handleGetDirections}
            className="w-[35px] h-[35px] rounded-full bg-blue-10 items-center justify-center active:opacity-80"
          >
            <Ionicons name="navigate" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {venueAddress && (
        <Text
          className="text-sm text-white/60 font-sans mt-2"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {venueAddress}
        </Text>
      )}
    </View>
  );
}
