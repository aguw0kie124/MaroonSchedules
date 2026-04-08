import React, { useMemo, useRef } from 'react';
import { Dimensions, Pressable } from 'react-native';
import MapView, { Marker, Polygon, Polyline, Region } from 'react-native-maps';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Kept for backward compat — react-native-maps uses {lat,lng} objects directly */
export function toMapLibrePosition(coordinate: MapCoordinate): { latitude: number; longitude: number } {
  return { latitude: coordinate.latitude, longitude: coordinate.longitude };
}

const EARTH_RADIUS_METERS = 6371008.8;

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

export function createCirclePolygon(center: MapCoordinate, radiusMeters: number, steps = 48) {
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const latitudeRad = degToRad(center.latitude);
  const longitudeRad = degToRad(center.longitude);
  const coordinates: { latitude: number; longitude: number }[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * Math.PI * 2;
    const lat = Math.asin(
      Math.sin(latitudeRad) * Math.cos(angularDistance) +
        Math.cos(latitudeRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lng =
      longitudeRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRad),
        Math.cos(angularDistance) - Math.sin(latitudeRad) * Math.sin(lat),
      );
    coordinates.push({ latitude: radToDeg(lat), longitude: radToDeg(lng) });
  }

  return coordinates;
}

function isValidCoordinate(coordinate: MapCoordinate | null | undefined): coordinate is MapCoordinate {
  return (
    coordinate != null &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude)
  );
}

// ─── Camera hook ─────────────────────────────────────────────────────────────

export function useMapLibreCamera(initialRegion: MapRegion) {
  const cameraRef = useRef<MapView>(null);

  const defaultCamera = useMemo(
    (): Region => ({
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
      latitudeDelta: initialRegion.latitudeDelta,
      longitudeDelta: initialRegion.longitudeDelta,
    }),
    [initialRegion.latitude, initialRegion.longitude, initialRegion.latitudeDelta, initialRegion.longitudeDelta],
  );

  const animateToRegion = (region: MapRegion, duration = 800) => {
    cameraRef.current?.animateToRegion(
      {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
      duration,
    );
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
    if (!config.center) return;
    // Convert zoom level to approximate latitudeDelta
    const zoomToLatDelta = (zoom?: number) => {
      if (zoom == null) return 0.02;
      // approx: latitudeDelta ≈ 360 / 2^zoom (rough)
      return 360 / Math.pow(2, zoom);
    };
    const latDelta = zoomToLatDelta(config.zoom);
    const { width } = Dimensions.get('window');
    const lngDelta = latDelta * (width / (width || 1)); // aspect ratio ≈ 1 for narrow range
    cameraRef.current?.animateToRegion(
      {
        latitude: config.center.latitude,
        longitude: config.center.longitude,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      },
      options?.duration ?? 700,
    );
  };

  const fitToCoordinates = (
    coordinates: MapCoordinate[],
    options?: {
      edgePadding?: { top?: number; right?: number; bottom?: number; left?: number };
      animated?: boolean;
      duration?: number;
    },
  ) => {
    if (!coordinates.length) return;

    const edgePadding = {
      top: options?.edgePadding?.top ?? 80,
      right: options?.edgePadding?.right ?? 56,
      bottom: options?.edgePadding?.bottom ?? 80,
      left: options?.edgePadding?.left ?? 56,
    };

    cameraRef.current?.fitToCoordinates(
      coordinates.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
      {
        edgePadding,
        animated: options?.animated !== false,
      },
    );
  };

  return {
    cameraRef,
    defaultCamera,
    animateToRegion,
    animateCamera,
    fitToCoordinates,
  };
}

// ─── Overlay components ───────────────────────────────────────────────────────

export function MapLibreCircleOverlay({
  id,
  center,
  radiusMeters,
  fillColor,
  fillOpacity = 0.22,
  strokeColor,
  strokeWidth = 1.5,
}: {
  id: string;
  center: MapCoordinate;
  radiusMeters: number;
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeWidth?: number;
}) {
  const coordinates = useMemo(
    () => createCirclePolygon(center, radiusMeters),
    [center.latitude, center.longitude, radiusMeters],
  );

  // Parse fillColor to extract RGBA components for fillColor + fillOpacity combo
  const resolvedFillColor = useMemo(() => {
    // If already rgba(...), blend opacity in
    if (fillColor.startsWith('rgba')) return fillColor;
    // If hex + separate opacity, build rgba
    const hex = fillColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${fillOpacity})`;
    }
    return fillColor;
  }, [fillColor, fillOpacity]);

  return (
    <Polygon
      key={id}
      coordinates={coordinates}
      fillColor={resolvedFillColor}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
    />
  );
}

export function MapLibrePolylineOverlay({
  id,
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
    () => coordinates.filter(isValidCoordinate),
    [coordinates],
  );

  if (sanitizedCoordinates.length < 2) return null;

  return (
    <Polyline
      key={id}
      coordinates={sanitizedCoordinates.map((c) => ({ latitude: c.latitude, longitude: c.longitude }))}
      strokeColor={color}
      strokeWidth={width}
      lineDashPattern={lineDasharray}
    />
  );
}

export function MapLibreMarker({
  id,
  coordinate,
  anchor,
  onPress,
  children,
}: {
  id: string;
  coordinate: MapCoordinate;
  anchor?: { x: number; y: number };
  onPress?: () => void;
  allowOverlap?: boolean;
  children: React.ReactElement;
}) {
  return (
    <Marker
      key={id}
      identifier={id}
      coordinate={{ latitude: coordinate.latitude, longitude: coordinate.longitude }}
      anchor={anchor}
      onPress={onPress ? () => onPress() : undefined}
      tracksViewChanges={false}
    >
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={8}>
          {children}
        </Pressable>
      ) : children}
    </Marker>
  );
}
