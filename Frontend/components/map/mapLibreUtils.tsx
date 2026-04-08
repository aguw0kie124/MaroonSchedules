import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable } from 'react-native';
import {
  type CameraRef,
  FillLayer,
  LineLayer,
  MarkerView,
  ShapeSource,
} from '@maplibre/maplibre-react-native';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export const CAMPUS_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type MapLibreStyleLayer = {
  id?: string;
  type?: string;
  source?: string;
  'source-layer'?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

type MapLibreStyleSource = {
  url?: string;
  tiles?: string[];
  data?: string;
  [key: string]: unknown;
};

type MapLibreStyleDefinition = {
  sprite?: string;
  glyphs?: string;
  sources?: Record<string, MapLibreStyleSource>;
  layers?: MapLibreStyleLayer[];
  [key: string]: unknown;
};

let campusMapStyleCache: MapLibreStyleDefinition | null = null;
let campusMapStylePromise: Promise<MapLibreStyleDefinition> | null = null;

const EARTH_RADIUS_METERS = 6371008.8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isAbsoluteUrl(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function toAbsoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value || isAbsoluteUrl(value)) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function absolutizeStyleDefinition(
  styleDefinition: MapLibreStyleDefinition,
  baseUrl: string,
): MapLibreStyleDefinition {
  const style = JSON.parse(JSON.stringify(styleDefinition)) as MapLibreStyleDefinition;

  style.sprite = toAbsoluteUrl(style.sprite, baseUrl);
  style.glyphs = toAbsoluteUrl(style.glyphs, baseUrl);

  if (style.sources) {
    Object.values(style.sources).forEach((source) => {
      source.url = toAbsoluteUrl(source.url, baseUrl);
      if (Array.isArray(source.tiles)) {
        source.tiles = source.tiles.map((tileUrl) => toAbsoluteUrl(tileUrl, baseUrl) || tileUrl);
      }
      if (typeof source.data === 'string') {
        source.data = toAbsoluteUrl(source.data, baseUrl);
      }
    });
  }

  return style;
}

function setLayerPaint(
  layer: MapLibreStyleLayer,
  updates: Record<string, unknown>,
) {
  layer.paint = {
    ...(layer.paint || {}),
    ...updates,
  };
}

function hideLayer(layer: MapLibreStyleLayer) {
  layer.layout = {
    ...(layer.layout || {}),
    visibility: 'none',
  };
}

function getLayerName(layer: MapLibreStyleLayer) {
  return `${layer.id || ''} ${layer.source || ''} ${layer['source-layer'] || ''}`.toLowerCase();
}

function customizeCampusMapStyle(baseStyle: MapLibreStyleDefinition) {
  const style = JSON.parse(JSON.stringify(baseStyle)) as MapLibreStyleDefinition;

  style.layers = (style.layers || []).map((layer) => {
    const name = getLayerName(layer);
    const isSymbolLayer = layer.type === 'symbol';
    const isWaterLayer = name.includes('water');
    const isBuildingLayer = name.includes('building');
    const isPathLayer =
      name.includes('path') ||
      name.includes('footway') ||
      name.includes('pedestrian') ||
      name.includes('walk');
    const isRoadLayer =
      name.includes('road') ||
      name.includes('street') ||
      name.includes('bridge') ||
      name.includes('tunnel');
    const isMajorRoadLayer =
      isRoadLayer &&
      (name.includes('motorway') ||
        name.includes('trunk') ||
        name.includes('primary') ||
        name.includes('major'));
    const isGreenLayer =
      name.includes('park') ||
      name.includes('grass') ||
      name.includes('wood') ||
      name.includes('forest') ||
      name.includes('landcover') ||
      name.includes('landuse');
    const isCampusNoiseLabel =
      isSymbolLayer &&
      (name.includes('poi') ||
        name.includes('transit') ||
        name.includes('housenumber') ||
        name.includes('address') ||
        name.includes('road') ||
        name.includes('street') ||
        name.includes('path') ||
        name.includes('pedestrian') ||
        name.includes('aeroway'));

    if (layer.type === 'background') {
      setLayerPaint(layer, {
        'background-color': '#f5f1e8',
      });
    }

    if (isGreenLayer) {
      setLayerPaint(layer, {
        'fill-color': '#dce7d7',
        'fill-opacity': 0.75,
        'line-color': '#c6d5c2',
      });
    }

    if (isWaterLayer) {
      setLayerPaint(layer, {
        'fill-color': '#bad6e7',
        'fill-opacity': 0.9,
        'line-color': '#8fb7cf',
      });
    }

    if (isBuildingLayer) {
      setLayerPaint(layer, {
        'fill-color': '#e4ddd1',
        'fill-outline-color': '#c6baa7',
        'fill-opacity': 0.72,
        'line-color': '#c6baa7',
      });
    }

    if (isRoadLayer) {
      setLayerPaint(layer, {
        'line-color': isMajorRoadLayer ? '#cbb9a2' : '#ddd3c6',
        'line-opacity': isMajorRoadLayer ? 0.72 : 0.52,
      });
    }

    if (isPathLayer) {
      setLayerPaint(layer, {
        'line-color': '#cebda3',
        'line-opacity': 0.4,
      });
    }

    if (isCampusNoiseLabel) {
      hideLayer(layer);
      return layer;
    }

    if (isSymbolLayer) {
      setLayerPaint(layer, {
        'text-color': '#5b5147',
        'text-halo-color': '#f5f1e8',
        'text-halo-width': 1.1,
      });
    }

    return layer;
  });

  return style;
}

async function loadCampusMapStyle() {
  if (campusMapStyleCache) return campusMapStyleCache;
  if (!campusMapStylePromise) {
    campusMapStylePromise = fetch(CAMPUS_MAP_STYLE_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load map style (${response.status})`);
        }

        const styleDefinition = (await response.json()) as MapLibreStyleDefinition;
        const absolutizedStyle = absolutizeStyleDefinition(styleDefinition, CAMPUS_MAP_STYLE_URL);
        const customizedStyle = customizeCampusMapStyle(absolutizedStyle);
        campusMapStyleCache = customizedStyle;
        return customizedStyle;
      })
      .finally(() => {
        campusMapStylePromise = null;
      });
  }

  return campusMapStylePromise;
}

export function useCampusMapStyle() {
  const [mapStyle, setMapStyle] = useState<string | MapLibreStyleDefinition>(CAMPUS_MAP_STYLE_URL);

  useEffect(() => {
    let isMounted = true;

    loadCampusMapStyle()
      .then((styleDefinition) => {
        if (isMounted) {
          setMapStyle(styleDefinition);
        }
      })
      .catch((error) => {
        console.warn('Failed to customize campus map style', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return mapStyle;
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function regionToZoomLevel(region: MapRegion) {
  const { width } = Dimensions.get('window');
  const safeLongitudeDelta = Math.max(region.longitudeDelta, 0.0001);
  const zoom = Math.log2((360 * ((width || 1) / 256)) / safeLongitudeDelta);
  return clamp(zoom, 2, 20);
}

function normalizePadding(
  padding?:
    | number
    | [number, number]
    | [number, number, number, number]
    | { top?: number; right?: number; bottom?: number; left?: number },
) {
  if (padding == null) return undefined;
  if (typeof padding === 'number') return padding;
  if (Array.isArray(padding)) return padding;
  return [
    padding.top ?? 0,
    padding.right ?? 0,
    padding.bottom ?? 0,
    padding.left ?? 0,
  ] as [number, number, number, number];
}

export function toMapLibrePosition(coordinate: MapCoordinate): [number, number] {
  return [coordinate.longitude, coordinate.latitude];
}

export function getCameraStopFromRegion(
  region: MapRegion,
  extras: Partial<{
    pitch: number;
    heading: number;
    animationDuration: number;
    animationMode: 'flyTo' | 'easeTo' | 'linearTo' | 'moveTo';
  }> = {},
) {
  return {
    centerCoordinate: toMapLibrePosition(region),
    zoomLevel: regionToZoomLevel(region),
    pitch: extras.pitch ?? 0,
    heading: extras.heading ?? 0,
    animationDuration: extras.animationDuration,
    animationMode: extras.animationMode,
  };
}

export function createCirclePolygon(center: MapCoordinate, radiusMeters: number, steps = 48) {
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const latitudeRad = degToRad(center.latitude);
  const longitudeRad = degToRad(center.longitude);
  const coordinates: number[][] = [];

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

    coordinates.push([radToDeg(lng), radToDeg(lat)]);
  }

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coordinates],
    },
    properties: {},
  };
}

export function createLineFeature(coordinates: MapCoordinate[]) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: coordinates.map(toMapLibrePosition),
    },
    properties: {},
  };
}

function isValidCoordinate(
  coordinate: MapCoordinate | null | undefined,
): coordinate is MapCoordinate {
  return (
    coordinate != null &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude)
  );
}

export function useMapLibreCamera(initialRegion: MapRegion) {
  const cameraRef = useRef<CameraRef>(null);

  const animateToRegion = (region: MapRegion, duration = 800) => {
    cameraRef.current?.setCamera({
      ...getCameraStopFromRegion(region),
      animationDuration: duration,
      animationMode: 'easeTo',
    });
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
    cameraRef.current?.setCamera({
      centerCoordinate: config.center ? toMapLibrePosition(config.center) : undefined,
      zoomLevel: config.zoom,
      pitch: config.pitch,
      heading: config.heading,
      animationDuration: options?.duration ?? 700,
      animationMode: 'easeTo',
    });
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
    if (coordinates.length === 1) {
      animateCamera(
        {
          center: coordinates[0],
          zoom: 16,
        },
        { duration: options?.duration ?? 700 },
      );
      return;
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    coordinates.forEach((coordinate) => {
      minLat = Math.min(minLat, coordinate.latitude);
      maxLat = Math.max(maxLat, coordinate.latitude);
      minLng = Math.min(minLng, coordinate.longitude);
      maxLng = Math.max(maxLng, coordinate.longitude);
    });

    cameraRef.current?.fitBounds(
      [maxLng, maxLat],
      [minLng, minLat],
      normalizePadding(options?.edgePadding),
      options?.animated === false ? 0 : (options?.duration ?? 700),
    );
  };

  const defaultCamera = useMemo(
    () => getCameraStopFromRegion(initialRegion),
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
  const shape = useMemo(
    () => createCirclePolygon(center, radiusMeters),
    [center.latitude, center.longitude, radiusMeters],
  );

  return (
    <ShapeSource id={`${id}-source`} shape={shape}>
      <FillLayer
        id={`${id}-fill`}
        style={{
          fillColor,
          fillOpacity,
        }}
      />
      <LineLayer
        id={`${id}-stroke`}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
        }}
      />
    </ShapeSource>
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
  const shape = useMemo(
    () => createLineFeature(sanitizedCoordinates),
    [sanitizedCoordinates],
  );
  const lineStyle = useMemo(() => {
    const style: {
      lineColor: string;
      lineWidth: number;
      lineDasharray?: number[];
    } = {
      lineColor: color,
      lineWidth: width,
    };

    if (Array.isArray(lineDasharray) && lineDasharray.length > 0) {
      style.lineDasharray = lineDasharray;
    }

    return style;
  }, [color, lineDasharray, width]);

  if (sanitizedCoordinates.length < 2) return null;

  return (
    <ShapeSource id={`${id}-source`} shape={shape}>
      <LineLayer id={`${id}-line`} style={lineStyle} />
    </ShapeSource>
  );
}

export function MapLibreMarker({
  coordinate,
  anchor,
  onPress,
  allowOverlap = true,
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
    <MarkerView
      coordinate={toMapLibrePosition(coordinate)}
      anchor={anchor}
      allowOverlap={allowOverlap}
    >
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={8}>
          {children}
        </Pressable>
      ) : children}
    </MarkerView>
  );
}
