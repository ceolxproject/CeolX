import { memo, useEffect, useState } from 'react';
import { Marker } from 'react-native-maps';

import { MapEventPin } from '@/components/MapEventPin';

// Shape passed by react-native-map-clustering's renderCluster callback.
export type ClusterObject = {
  id: string | number;
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: { point_count: number };
  onPress: () => void;
};

type MapClusterMarkerProps = {
  cluster: ClusterObject;
};

/**
 * A cluster count badge on the map.
 *
 * Without an explicit `tracksViewChanges`, react-native-maps defaults to `true`
 * — every cluster re-rasterizes its custom view every frame, which is the
 * cluster-equivalent of the venue-pin slowness. The badge has no async image,
 * so we just track until the first paint settles, then freeze. Clusters re-mount
 * with fresh ids on each zoom level, so this runs once per visible cluster.
 */
function MapClusterMarkerComponent({ cluster }: MapClusterMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{
        latitude: cluster.geometry.coordinates[1],
        longitude: cluster.geometry.coordinates[0],
      }}
      tracksViewChanges={tracksViewChanges}
      onPress={cluster.onPress}
    >
      <MapEventPin type="cluster" count={cluster.properties.point_count} />
    </Marker>
  );
}

export const MapClusterMarker = memo(MapClusterMarkerComponent);
