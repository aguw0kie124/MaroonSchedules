import React, { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { Dimensions } from 'react-native';
import MapView, {
  Circle,
  Marker,
  Polyline,
  type Camera,
  type EdgePadding,
  type LatLng,
  type Region,
} from 'react-native-maps';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

function normalizePadding(
  padding?:
    | number
    | [number, number]
    | [number, number, number, number]
    | { top?: number; right?: number; bottom?: number; left?: number },
): EdgePadding | undefined {
  if (padding == null) return undefined;
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  if (Array.isArray(padding)) {
    if (padding.length === 2) {
      const [vertical, horizontal] = padding;
      return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
    }
    const [top, right, bottom, left] = padding;
    return { top, right, bottom, left };
  }
  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  };
}

function toLatLng(coordinate: MapCoordinate): LatLng {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  };
}

function getCenterFromCoordinates(coordinates: MapCoordinate[]) {
  const total = coordinates.reduce(
    (acc, coordinate) => {
      acc.latitude += coordinate.latitude;
      acc.longitude += coordinate.longitude;
      return acc;
    },
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / coordinates.length,
    longitude: total.longitude / coordinates.length,
  };
}

function regionDeltaFromZoom(zoom = 16) {
  const normalizedZoom = Math.max(2, Math.min(zoom, 20));
  const latitudeDelta = Math.max(0.0008, 360 / Math.pow(2, normalizedZoom));
  return {
    latitudeDelta,
    longitudeDelta: latitudeDelta,
  };
}

// ─── Camera hook ─────────────────────────────────────────────────────────────

export function useMapCamera(initialRegion: MapRegion) {
  const cameraRef = useRef<MapView>(null);

  const animateToRegion = (region: MapRegion, duration = 800) => {
    cameraRef.current?.animateToRegion(region, duration);
  };

  const animateCamera = (
    config: {
      center?: MapCoordinate;
      zoom?: number;
      pitch?: number;
      heading?: number;
    },
    options?: { duration?: number },
  ) => {
    const camera: Partial<Camera> = {};
    if (config.center) {
      camera.center = toLatLng(config.center);
    }
    if (typeof config.pitch === 'number') {
      camera.pitch = config.pitch;
    }
    if (typeof config.heading === 'number') {
      camera.heading = config.heading;
    }
    if (typeof config.zoom === 'number') {
      // Altitude conversion for react-native-maps camera
      camera.altitude = Math.max(150, 800000 / Math.pow(2, Math.max(0, config.zoom - 2)));
      camera.zoom = config.zoom;
    }
    cameraRef.current?.animateCamera(camera, { duration: options?.duration ?? 700 });
  };

  const fitToCoordinates = (
    coordinates: MapCoordinate[],
    options?: {
      edgePadding?: { top?: number; right?: number; bottom?: number; left?: number };
      animated?: boolean;
      duration?: number;
    },
  ) => {
    const validCoordinates = coordinates.filter(
      (coordinate) =>
        Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude),
    );
    if (!validCoordinates.length) return;
    if (validCoordinates.length === 1) {
      const center = validCoordinates[0];
      const delta = regionDeltaFromZoom(16);
      cameraRef.current?.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta.latitudeDelta,
          longitudeDelta: delta.longitudeDelta,
        },
        options?.duration ?? 700,
      );
      return;
    }

    cameraRef.current?.fitToCoordinates(validCoordinates.map(toLatLng), {
      edgePadding: normalizePadding(options?.edgePadding),
      animated: options?.animated !== false,
    });
  };

  const defaultCamera = useMemo(
    (): Region => ({
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
      latitudeDelta: initialRegion.latitudeDelta,
      longitudeDelta: initialRegion.longitudeDelta,
    }),
    [
      initialRegion.latitude,
      initialRegion.longitude,
      initialRegion.latitudeDelta,
      initialRegion.longitudeDelta,
    ],
  );

  return {
    cameraRef,
    defaultCamera,
    animateToRegion,
    animateCamera,
    fitToCoordinates,
  };
}

// ─── Overlay components ───────────────────────────────────────────────────────

export function MapCircleOverlay({
  center,
  radiusMeters,
  fillColor,
  strokeColor,
  strokeWidth = 1.5,
  fillOpacity,
}: {
  id: string;
  center: MapCoordinate;
  radiusMeters: number;
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeWidth?: number;
}) {
  // Guard against nil coordinates
  if (
    !center ||
    center.latitude == null ||
    center.longitude == null ||
    !Number.isFinite(center.latitude) ||
    !Number.isFinite(center.longitude)
  ) {
    return null;
  }

  return (
    <Circle
      center={toLatLng(center)}
      radius={radiusMeters}
      fillColor={fillOpacity !== undefined ? `${fillColor}${Math.floor(fillOpacity * 255).toString(16).padStart(2, '0')}` : fillColor}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      zIndex={1}
    />
  );
}

export function MapPolylineOverlay({
  coordinates,
  color,
  width = 4,
  lineDasharray,
}: {
  id: string;
  coordinates: MapCoordinate[];
  color: string;
  width?: number;
  lineDasharray?: number[];
}) {
  const sanitizedCoordinates = useMemo(
    () =>
      coordinates.filter(
        (coordinate) =>
          Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude),
      ),
    [coordinates],
  );

  if (sanitizedCoordinates.length < 2) return null;

  return (
    <Polyline
      coordinates={sanitizedCoordinates.map(toLatLng)}
      strokeColor={color}
      strokeWidth={width}
      lineDashPattern={lineDasharray}
      zIndex={2}
    />
  );
}

export function MapMarker({
  coordinate,
  anchor,
  onPress,
  tracksViewChanges,
  children,
}: {
  id: string;
  coordinate: MapCoordinate;
  anchor?: { x: number; y: number };
  onPress?: () => void;
  tracksViewChanges?: boolean;
  allowOverlap?: boolean;
  children: ReactElement;
}) {
  // CRITICAL: nil coordinates crash the native AIRMap with NSInvalidArgumentException
  if (
    !coordinate ||
    coordinate.latitude == null ||
    coordinate.longitude == null ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude)
  ) {
    return null;
  }

  return (
    <Marker
      coordinate={toLatLng(coordinate)}
      anchor={anchor}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      {children}
    </Marker>
  );
}

export function getMapRegionFromCoordinates(
  coordinates: MapCoordinate[],
  fallbackRegion: MapRegion,
): MapRegion {
  const validCoordinates = coordinates.filter(
    (coordinate) => Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude),
  );
  if (!validCoordinates.length) return fallbackRegion;
  if (validCoordinates.length === 1) {
    const delta = regionDeltaFromZoom(16);
    return {
      latitude: validCoordinates[0].latitude,
      longitude: validCoordinates[0].longitude,
      latitudeDelta: delta.latitudeDelta,
      longitudeDelta: delta.longitudeDelta,
    };
  }

  const center = getCenterFromCoordinates(validCoordinates);
  const latitudes = validCoordinates.map((coordinate) => coordinate.latitude);
  const longitudes = validCoordinates.map((coordinate) => coordinate.longitude);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.max(0.01, (Math.max(...latitudes) - Math.min(...latitudes)) * 1.5),
    longitudeDelta: Math.max(0.01, (Math.max(...longitudes) - Math.min(...longitudes)) * 1.5),
  };
}
