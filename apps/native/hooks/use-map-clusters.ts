import { useMemo } from 'react';
import type { Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import type { AnyProps, ClusterFeature, PointFeature } from 'supercluster';

import type { MapEvent } from '@/components/MapEventMarker';

/**
 * Client-side clustering for the map, driven directly by `supercluster` (the
 * pure-JS engine the old react-native-map-clustering wrapper used internally).
 *
 * Owning clustering ourselves — instead of the wrapper — lets us control
 * re-renders: single-event markers keep a stable React key (the event id) so
 * they reconcile across region changes rather than remounting. The wrapper
 * re-created every marker child on every region change, which under the New
 * Architecture failed to re-attach in react-native-maps' ViewAttacherGroup
 * ("View already has a parent") and left pins blank (Asana 1215453288289175).
 */

const CLUSTER_RADIUS = 50; // px — how close pins must be to merge
export const CLUSTER_MAX_ZOOM = 20; // beyond this, points are treated as un-splittable

type LeafProps = { event: MapEvent };

export type MapClusterPoint = PointFeature<LeafProps> | ClusterFeature<AnyProps>;

/** Type guard: is this supercluster feature a cluster (vs. a single event leaf)? */
export function isClusterFeature(feature: MapClusterPoint): feature is ClusterFeature<AnyProps> {
  return 'cluster' in feature.properties && feature.properties.cluster === true;
}

/** Google-style web-mercator zoom from a react-native-maps Region. */
export function regionToZoom(region: Region): number {
  return Math.round(Math.log2(360 / region.longitudeDelta));
}

/** [westLng, southLat, eastLng, northLat] bounding box from a Region. */
export function regionToBBox(region: Region): [number, number, number, number] {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

/** Region centred on (lat,lng) at a given web-mercator zoom — used to animate in. */
export function zoomToRegion(lat: number, lng: number, zoom: number): Region {
  const delta = 360 / Math.pow(2, zoom);
  return { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
}

export function useMapClusters(events: MapEvent[], region: Region | null) {
  const points = useMemo<PointFeature<LeafProps>[]>(
    () =>
      events.map((event) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [event.lng, event.lat] },
        properties: { event },
      })),
    [events]
  );

  const supercluster = useMemo(() => {
    const sc = new Supercluster<LeafProps>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
    });
    sc.load(points);
    return sc;
  }, [points]);

  const clusters = useMemo<MapClusterPoint[]>(() => {
    // No region yet (first paint) — render every event as its own pin.
    if (!region) return points;
    return supercluster.getClusters(regionToBBox(region), regionToZoom(region));
  }, [supercluster, region, points]);

  return { clusters, supercluster };
}
