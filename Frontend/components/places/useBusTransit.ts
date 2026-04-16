import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { transitService } from "../../services/transitService";
import { ALL_BUS_ROUTES_KEY } from "./types";
import {
  haversineDistanceMeters,
  getClosestProgressMeters,
  formatBusDistance,
  getApproximateEtaMinutes,
  isVehicleOnRoute,
} from "./utils";

export function useBusTransit(
  activeLayer: string,
  mapRef: React.RefObject<any>,
) {
  const [busRoutes, setBusRoutes] = useState<any[]>([]);
  const [busVehicles, setBusVehicles] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any[]>([]);
  const [selectedBusRouteId, setSelectedBusRouteId] = useState<string | null>(
    ALL_BUS_ROUTES_KEY,
  );
  const [routePatterns, setRoutePatterns] = useState<any[]>([]);
  const [routePaths, setRoutePaths] = useState<any[]>([]);
  const [allRoutePatternsById, setAllRoutePatternsById] = useState<
    Record<string, { points: any[]; stops: any[]; paths?: any[] }>
  >({});
  const [temporaryBusFocusRouteId, setTemporaryBusFocusRouteId] = useState<string | null>(null);
  const [isFetchingBus, setIsFetchingBus] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'inbound' | 'outbound' | 'All'>('All');
  const [nearestBusInfo, setNearestBusInfo] = useState<string | null>(null);
  const [routeTimetableEntries, setRouteTimetableEntries] = useState<any[]>([]);

  const busPollInterval = useRef<any>(null);
  const isFetchingRef = useRef(false);

  const isAllBusRoutesSelected =
    !selectedBusRouteId || selectedBusRouteId === ALL_BUS_ROUTES_KEY;

  const selectedRoute = useMemo(
    () =>
      isAllBusRoutesSelected
        ? null
        : busRoutes.find((route) => route.Key === selectedBusRouteId) ?? null,
    [busRoutes, isAllBusRoutesSelected, selectedBusRouteId],
  );

  const busRouteOptions = useMemo(
    () => [
      {
        Key: ALL_BUS_ROUTES_KEY,
        ShortName: "ALL",
        Name: "All Routes",
        Color: "#1E1E1E",
      },
      ...busRoutes,
    ],
    [busRoutes],
  );
  
  const availableDirections = useMemo(() => {
    if (isAllBusRoutesSelected) return ["All"];
    const dirs = new Set<string>();
    busVehicles.forEach((bus) => {
      const dir = bus.direction || bus.DirectionName;
      if (dir && typeof dir === "string") dirs.add(dir.trim());
    });
    // Add any missing directions from the stops just in case vehicles are offline
    busStops.forEach((stop) => {
      const dir = stop.DirectionName || stop.direction;
      if (dir && typeof dir === "string") dirs.add(dir.trim());
    });
    return Array.from(dirs).filter(Boolean);
  }, [busVehicles, busStops, isAllBusRoutesSelected]);

  useEffect(() => {
    if (!isAllBusRoutesSelected && availableDirections.length > 0) {
      if (
        !availableDirections.includes(selectedDirection) ||
        selectedDirection === "All"
      ) {
        setSelectedDirection(availableDirections[0] as any);
      }
    } else {
      setSelectedDirection("All");
    }
  }, [availableDirections, isAllBusRoutesSelected]);

  const filteredBusRoutes = useMemo(() => {
    const query = routeSearchQuery.trim().toLowerCase();
    if (!query) {
      return busRouteOptions;
    }

    const isNumericQuery = /^\d+$/.test(query);
    const matches = busRouteOptions.filter((route) => {
      const shortName = (route.ShortName || "").toString().toLowerCase();
      const name = (route.Name || "").toString().toLowerCase();
      if (isNumericQuery) {
        // For numeric queries, require exact ShortName match or name substring
        return shortName === query || name.includes(query);
      }
      return shortName.includes(query) || name.includes(query);
    });
    // Sort exact ShortName matches first
    matches.sort((a, b) => {
      const aShort = (a.ShortName || "").toString().toLowerCase();
      const bShort = (b.ShortName || "").toString().toLowerCase();
      const aExact = aShort === query ? 0 : 1;
      const bExact = bShort === query ? 0 : 1;
      return aExact - bExact;
    });
    return matches;
  }, [busRouteOptions, routeSearchQuery]);

  const loadAllBusRoutes = useCallback(async (routesToLoad: any[]) => {
    if (!routesToLoad.length) {
      setAllRoutePatternsById({});
      setBusVehicles([]);
      return;
    }

    // Initial vehicles fetch to show something quickly
    transitService.getVehicles().then((v) => {
      stabilizedSetBusVehicles(v);
    });

    // Load patterns in bulk for high performance
    transitService.getBulkRoutePatterns(routesToLoad.map(r => r.Key)).then(results => {
      setAllRoutePatternsById(results);
    }).catch(err => {
      console.warn("[Transit] Bulk pattern load failed:", err);
    });


    setBusStops([]);
    setRoutePatterns([]);
    setRoutePaths([]);
  }, [mapRef, stabilizedSetBusVehicles]);

  // Handle flickering stabilization
  const emptyUpdateCountRef = useRef(0);
  const lastValidVehiclesRef = useRef<any[]>([]);

  const stabilizedSetBusVehicles = useCallback((updated: any[]) => {
    if (updated.length > 0) {
      emptyUpdateCountRef.current = 0;
      setBusVehicles(updated);
    } else if (lastValidVehiclesRef.current.length > 0) {
      emptyUpdateCountRef.current += 1;
      // If we see 3 consecutive empty updates, then we accept the buses are truly offline
      if (emptyUpdateCountRef.current >= 3) {
        setBusVehicles([]);
      } else {
        console.log(`[Transit] Suppressing flickering (empty update #${emptyUpdateCountRef.current})`);
      }
    } else {
      setBusVehicles([]);
    }
  }, []);

  useEffect(() => {
    if (busVehicles.length > 0) {
      lastValidVehiclesRef.current = busVehicles;
      emptyUpdateCountRef.current = 0;
    }
  }, [busVehicles]);

  const handleSelectBusRoute = useCallback(
    async (routeId: string, availableRoutes: any[] = busRoutes) => {
      console.log("[Transit] Selecting route:", routeId);
      setSelectedBusRouteId(routeId);
      setSelectedStop(null);
      setSelectedBus(null);
      setRouteTimetableEntries([]);

      if (routeId === ALL_BUS_ROUTES_KEY) {
        await loadAllBusRoutes(availableRoutes);
        return;
      }

      try {
        const { points, stops, paths } = await transitService.getRoutePattern(routeId);
        if (points && points.length > 0) {
          console.log("[Transit] Route trace points found:", points.length);
          setRoutePatterns(points);
        } else {
          console.warn("[Transit] No route trace found for:", routeId);
          setRoutePatterns([]);
        }

        if (paths && paths.length > 0) {
          setRoutePaths(paths);
        } else {
          setRoutePaths([]);
        }

        if (stops && stops.length > 0) {
          console.log("[Transit] Stops found:", stops.length);
          setBusStops(stops);
        } else {
          console.warn("[Transit] No stops found for:", routeId);
          setBusStops([]);
        }

        if (mapRef.current && points.length > 0) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 220, right: 60, bottom: 80, left: 60 },
            animated: true,
          });
        }
      } catch (e) {
        console.warn("Failed to select bus route", e);
      }
    },
    [busRoutes, loadAllBusRoutes, mapRef],
  );

  const fetchBusData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetchingBus(true);
    try {
      console.log("[Transit] Fetching metadata and active routes...");
      const { routes: metadata, activeIds } = await transitService.getTransitRoutes();

      console.log("[Transit] Metadata count:", metadata.length);
      console.log("[Transit] Active IDs:", activeIds);

      const activeRoutes = metadata.filter(
        (m) =>
          activeIds.includes(m.ShortName) ||
          activeIds.includes(m.Key) ||
          activeIds.includes(m.Name),
      );

      const finalRoutes = activeRoutes.length > 0 ? activeRoutes : metadata;

      console.log("[Transit] Final Active Routes count:", finalRoutes.length);
      setBusRoutes(finalRoutes);

      const isSelectionActive = finalRoutes.some(
        (r) => r.Key === selectedBusRouteId,
      );
      if (
        finalRoutes.length > 0 &&
        (isAllBusRoutesSelected || !selectedBusRouteId || !isSelectionActive)
      ) {
        handleSelectBusRoute(ALL_BUS_ROUTES_KEY, finalRoutes);
      }
    } catch (e) {
      console.warn("Failed to fetch bus routes", e);
    } finally {
      setIsFetchingBus(false);
      isFetchingRef.current = false;
    }
  };

  const resolveNearestBusForStop = useCallback(
    (stop: any, vehicles: any[]) => {
      if (!stop || vehicles.length === 0) {
        setNearestBusInfo(
          selectedRoute ? "Route loaded" : "Transit route loaded",
        );
        return;
      }

      const stopProgress = getClosestProgressMeters(routePatterns, {
        latitude: stop.Latitude,
        longitude: stop.Longitude,
      });

      const rankedBuses = vehicles
        .map((bus) => {
          const directDistanceMeters = haversineDistanceMeters(
            bus.Latitude,
            bus.Longitude,
            stop.Latitude,
            stop.Longitude,
          );

          if (!stopProgress) {
            return {
              bus,
              distanceMeters: directDistanceMeters,
            };
          }

          const busProgress = getClosestProgressMeters(routePatterns, {
            latitude: bus.Latitude,
            longitude: bus.Longitude,
          });

          if (!busProgress) {
            return {
              bus,
              distanceMeters: directDistanceMeters,
            };
          }

          const routeDelta = Math.abs(
            stopProgress.progressMeters - busProgress.progressMeters,
          );
          const wrappedDelta =
            stopProgress.totalRouteMeters > 0
              ? Math.min(routeDelta, stopProgress.totalRouteMeters - routeDelta)
              : routeDelta;

          return {
            bus,
            distanceMeters: Math.min(
              directDistanceMeters,
              wrappedDelta +
                stopProgress.offsetMeters +
                busProgress.offsetMeters,
            ),
          };
        })
        .sort(
          (first, second) => first.distanceMeters - second.distanceMeters,
        );

      const nearestBus = rankedBuses[0];
      if (!nearestBus) {
        setNearestBusInfo(
          selectedRoute ? "Route loaded" : "Transit route loaded",
        );
        return;
      }

      setSelectedBus(nearestBus.bus);
      const etaMinutes = Math.max(
        1,
        Math.round(nearestBus.distanceMeters / 220),
      );
      const busLabel = nearestBus.bus.RouteShortName
        ? `Route ${nearestBus.bus.RouteShortName}`
        : nearestBus.bus.Name
          ? `Bus ${nearestBus.bus.Name}`
          : undefined;
      setNearestBusInfo(
        formatBusDistance(nearestBus.distanceMeters, etaMinutes, busLabel),
      );
    },
    [routePatterns, selectedRoute],
  );

  // Fetch bus data when switching to Bus layer
  useEffect(() => {
    if (activeLayer === "Bus") {
      fetchBusData();
    } else {
      setSelectedBusRouteId(ALL_BUS_ROUTES_KEY);
      setSelectedDirection("All");
      setRouteSearchQuery("");
      setSelectedBus(null);
      setSelectedStop(null);
      setRouteTimetableEntries([]);
    }
  }, [activeLayer]);

  useEffect(() => {
    let cancelled = false;

    if (activeLayer !== "Bus" || !selectedRoute || isAllBusRoutesSelected) {
      setRouteTimetableEntries([]);
      return;
    }

    transitService.getRouteTimetable(selectedRoute.Key, 12)
      .then((entries) => {
        if (!cancelled) {
          setRouteTimetableEntries(entries);
        }
      })
      .catch((error) => {
        console.warn("[Transit] Timetable fetch failed:", error);
        if (!cancelled) {
          setRouteTimetableEntries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer, isAllBusRoutesSelected, selectedRoute]);

  // Poll for bus locations using a safe recursive timeout
  useEffect(() => {
    let timeoutId: any;
    let isActive = true;

    const poll = async () => {
      if (!isActive || activeLayer !== "Bus" || !selectedBusRouteId) return;
      
      try {
        const updated = isAllBusRoutesSelected
          ? await transitService.getVehicles()
          : await transitService.getVehicles(selectedBusRouteId);
        
        if (isActive && updated) {
          stabilizedSetBusVehicles(updated);
        }
      } catch (e) {
        console.warn("[Transit] Polling error:", e);
      } finally {
        if (isActive) {
          const interval = isAllBusRoutesSelected ? 8000 : 5000;
          timeoutId = setTimeout(poll, interval);
        }
      }
    };

    if (activeLayer === "Bus" && selectedBusRouteId) {
      poll();
    }

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeLayer, isAllBusRoutesSelected, selectedBusRouteId]);

  // Update nearest bus when bus positions change
  useEffect(() => {
    if (activeLayer === "Bus" && selectedStop) {
      resolveNearestBusForStop(selectedStop, busVehicles);
    }
  }, [activeLayer, busVehicles, routePatterns, selectedStop, resolveNearestBusForStop]);

  // Computed timetable for selected route
  const stopTimetable = useMemo(() => {
    if (
      activeLayer !== "Bus" ||
      !selectedRoute ||
      (busStops.length === 0 && routeTimetableEntries.length === 0)
    ) {
      return [];
    }

    if (routeTimetableEntries.length > 0) {
      return routeTimetableEntries.map((entry, index) => {
        const departures = Array.isArray(entry.departures) ? entry.departures : [];
        const nextDeparture = departures[0] || null;
        const stop = entry.stop || busStops[index];
        const estimatedTime = nextDeparture?.estimated_depart_time_utc
          ? new Date(nextDeparture.estimated_depart_time_utc)
          : null;
        const scheduledTime = nextDeparture?.scheduled_depart_time_utc
          ? new Date(nextDeparture.scheduled_depart_time_utc)
          : null;
        const primaryTime = estimatedTime || scheduledTime;

        return {
          stop,
          sequence: entry.sequence ?? index + 1,
          etaLabel: primaryTime
            ? primaryTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'No times',
          detail: nextDeparture?.is_realtime
            ? 'Live departure board'
            : 'Scheduled departure board',
          departures,
        };
      });
    }

    return busStops.slice(0, 12).map((stop, index) => {
      if (busVehicles.length === 0) {
        return {
          stop,
          sequence: index + 1,
          etaLabel: "Route loaded",
          detail: "ETA pending",
        };
      }

      const rankedBuses = busVehicles
        .map((bus) => ({
          bus,
          etaMinutes: getApproximateEtaMinutes(routePatterns, stop, bus),
        }))
        .sort((left, right) => left.etaMinutes - right.etaMinutes);
      const nextBus = rankedBuses[0];

      if (!nextBus) {
        return {
          stop,
          sequence: index + 1,
          etaLabel: "No estimate",
          detail: "Live feed unavailable",
        };
      }

      return {
        stop,
        sequence: index + 1,
        etaLabel:
          nextBus.etaMinutes <= 1 ? "Now" : `${nextBus.etaMinutes} min`,
        detail: nextBus.bus.RouteShortName
          ? `Route ${nextBus.bus.RouteShortName}`
          : nextBus.bus.Name || "Live bus",
        departures: [],
      };
    });
  }, [activeLayer, busStops, busVehicles, routePatterns, routeTimetableEntries, selectedRoute]);

  // All-routes board for overview mode
  const allRouteBoards = useMemo(() => {
    if (!isAllBusRoutesSelected) {
      return [];
    }

    return busRoutes
      .map((route) => {
        const pattern = allRoutePatternsById[route.Key];
        const routePoints = pattern?.points || [];
        const routeStops = pattern?.stops || [];
        const routeVehicles = busVehicles.filter((bus) =>
          isVehicleOnRoute(bus, route),
        );
        const entries = routeStops.slice(0, 4).map((stop, index) => {
          const rankedBuses = routeVehicles
            .map((bus) => ({
              bus,
              etaMinutes: getApproximateEtaMinutes(routePoints, stop, bus),
            }))
            .sort((left, right) => left.etaMinutes - right.etaMinutes);
          const nextBus = rankedBuses[0];

          return {
            stop,
            sequence: index + 1,
            etaLabel: nextBus
              ? nextBus.etaMinutes <= 1
                ? "Now"
                : `${nextBus.etaMinutes} min`
              : "Route loaded",
            detail: nextBus?.bus?.RouteShortName
              ? `Route ${nextBus.bus.RouteShortName}`
              : route.Name || "Transit route",
          };
        });

        return {
          route,
          liveCount: routeVehicles.length,
          entries,
        };
      })
      .filter((board) => board.entries.length > 0 || board.liveCount > 0);
  }, [allRoutePatternsById, busRoutes, busVehicles, isAllBusRoutesSelected]);

  // Nearby transit insight for user location
  const getNearbyTransitInsight = useCallback(
    (userCoord: { latitude: number; longitude: number } | null) => {
      if (!userCoord || activeLayer !== "Bus" || !selectedRoute) {
        return null;
      }

      const nearestStop = busStops.reduce(
        (best, stop) => {
          const distance = haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            stop.Latitude,
            stop.Longitude,
          );
          if (!best || distance < best.distanceMeters) {
            return { stop, distanceMeters: distance };
          }
          return best;
        },
        null as { stop: any; distanceMeters: number } | null,
      );

      const nearestVehicle = busVehicles.reduce(
        (best, vehicle) => {
          const distance = haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            vehicle.Latitude,
            vehicle.Longitude,
          );
          if (!best || distance < best.distanceMeters) {
            return { vehicle, distanceMeters: distance };
          }
          return best;
        },
        null as { vehicle: any; distanceMeters: number } | null,
      );

      if (
        (!nearestStop || nearestStop.distanceMeters > 320) &&
        (!nearestVehicle || nearestVehicle.distanceMeters > 380)
      ) {
        return null;
      }

      return {
        nearestStop,
        nearestVehicle,
      };
    },
    [activeLayer, busStops, busVehicles, selectedRoute],
  );

  return {
    busRoutes,
    busVehicles,
    busStops,
    selectedBusRouteId,
    setSelectedBusRouteId,
    selectedRoute,
    busRouteOptions,
    isRouteDropdownOpen,
    setIsRouteDropdownOpen,
    routeSearchQuery,
    setRouteSearchQuery,
    selectedDirection,
    setSelectedDirection,
    selectedStop,
    setSelectedStop,
    selectedBus,
    setSelectedBus,
    nearestBusInfo,
    setNearestBusInfo,
    isAllBusRoutesSelected,
    routePatterns,
    routePaths,
    allRoutePatternsById,
    temporaryBusFocusRouteId,
    setTemporaryBusFocusRouteId,
    handleSelectBusRoute,
    resolveNearestBusForStop,
    stopTimetable,
    allRouteBoards,
    getNearbyTransitInsight,
    filteredBusRoutes,
    isFetchingBus,
    setIsFetchingBus,
    availableDirections
  };
}
