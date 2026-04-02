import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { fetchCampusPulseMap, type CampusHotspot } from "../../services/campusPulse";
import { getLayerForPlace } from "./utils";
import type { CampusLocation } from "./types";

export function usePulseData(
  activeLayer: string,
  pulsePlaces: CampusLocation[],
  mapRef: React.RefObject<any>,
  isMapTilted: boolean
) {
  const [pulseHotspots, setPulseHotspots] = useState<CampusHotspot[]>([]);
  const [isLoadingPulse, setIsLoadingPulse] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const busPulseAnim = useRef(new Animated.Value(1)).current;

  const selectedHotspot = useMemo(
    () => pulseHotspots.find((h) => h.id === selectedHotspotId) || null,
    [pulseHotspots, selectedHotspotId],
  );

  const pulseTotals = useMemo(() => {
    return pulseHotspots.reduce(
      (totals, hotspot) => ({
        hotspots: totals.hotspots + 1,
        pings: totals.pings + hotspot.pingCount,
        events: totals.events + hotspot.eventCount,
      }),
      { hotspots: 0, pings: 0, events: 0 },
    );
  }, [pulseHotspots]);

  const hottestHotspot = pulseHotspots[0] || null;

  const fetchPulseHotspots = useCallback(async () => {
    setIsLoadingPulse(true);
    try {
      const rawHotspots = await fetchCampusPulseMap(12);
      const placeLookup = new Map(
        pulsePlaces.flatMap((place) => {
          const keys = [place.location];
          if (place.placeId) keys.push(place.placeId);
          return keys.map((key) => [key, place] as const);
        }),
      );
      const hotspots = rawHotspots.map((hotspot) => ({
        ...hotspot,
        place:
          (hotspot.placeId ? placeLookup.get(hotspot.placeId) : null) ||
          placeLookup.get(hotspot.locationName) ||
          null,
      }));

      setPulseHotspots(hotspots);
      if (selectedHotspotId && !hotspots.some((h) => h.id === selectedHotspotId)) {
        setSelectedHotspotId(null);
      }
    } catch (error) {
      console.warn("Failed to build pulse hotspots", error);
      if (!selectedHotspotId) setPulseHotspots([]);
    } finally {
      setIsLoadingPulse(false);
    }
  }, [pulsePlaces, selectedHotspotId]);

  useEffect(() => {
    if (!pulsePlaces.length) return;
    fetchPulseHotspots();
  }, [fetchPulseHotspots, pulsePlaces.length]);

  useEffect(() => {
    if (activeLayer !== "Pulse") return;
    const interval = setInterval(() => {
      fetchPulseHotspots();
    }, 25000);
    return () => clearInterval(interval);
  }, [activeLayer, fetchPulseHotspots]);

  // Pulse animation for Bus layer (moved here for centralization if needed, or keep in UI)
  useEffect(() => {
    if (activeLayer === "Bus") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(busPulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(busPulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [activeLayer, busPulseAnim]);

  const handleSelectHotspot = useCallback((hotspot: CampusHotspot) => {
    setSelectedHotspotId(hotspot.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: hotspot.coord.lat,
            longitude: hotspot.coord.lng,
          },
          zoom: 16.2,
          pitch: isMapTilted ? 55 : 0,
          heading: 0,
        },
        { duration: 700 },
      );
    }
  }, [isMapTilted, mapRef]);

  return {
    pulseHotspots,
    isLoadingPulse,
    selectedHotspotId,
    setSelectedHotspotId,
    selectedHotspot,
    pulseTotals,
    hottestHotspot,
    fetchPulseHotspots,
    handleSelectHotspot,
    busPulseAnim
  };
}
