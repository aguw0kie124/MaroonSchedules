import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCampusPlaceDetail } from "../../api/client";
import {
  fetchDiningFullMenuCached,
  getDiningContextDate,
  getDiningMealOptionsForLocation,
  getDiningMealPeriodForLocation,
  getDiningMenuCandidates,
  isDiningHallMenuLocation,
  warmDiningMenusInBackground,
  type DiningMealPeriod,
} from "../../services/diningMenuCache";
import { getLocalDateString } from "../../services/dateUtils";
import {
  findFoodCourtParentLocation,
  getFoodCourtVenueLabel,
  getFoodCourtVenueLocations,
  getLocationSelectionId,
  shouldHideFoodCourtLocationInBrowse,
} from "./campusData";
import type { CampusLocation } from "./types";

/** Overlay fields from GET /campus/places/{id}/detail (same snapshot as the map) when list merge dropped them. */
function mergePlaceDetailSnapshot(
  mapLoc: CampusLocation | undefined,
  detailPayload: { place?: CampusLocation } | null,
): CampusLocation | undefined {
  if (!mapLoc) return undefined;
  const snap = detailPayload?.place;
  if (!snap || typeof snap !== "object") return mapLoc;
  const isCapacityPlace = mapLoc.type === "Library" || mapLoc.type === "Rec";
  return {
    ...mapLoc,
    hours_today: snap.hours_today ?? mapLoc.hours_today,
    hours_holiday_notice: snap.hours_holiday_notice ?? mapLoc.hours_holiday_notice,
    visitor_parking_available: snap.visitor_parking_available ?? mapLoc.visitor_parking_available,
    visitor_parking_code: snap.visitor_parking_code ?? mapLoc.visitor_parking_code,
    visitor_parking_garage_name: snap.visitor_parking_garage_name ?? mapLoc.visitor_parking_garage_name,
    visitor_parking_as_of: snap.visitor_parking_as_of ?? mapLoc.visitor_parking_as_of,
    visitor_parking_source_url: snap.visitor_parking_source_url ?? mapLoc.visitor_parking_source_url,
    occupancy_name:
      isCapacityPlace
        ? mapLoc.occupancy_name ?? snap.occupancy_name
        : snap.occupancy_name ?? mapLoc.occupancy_name,
    capacity_last_updated:
      isCapacityPlace
        ? mapLoc.capacity_last_updated ?? snap.capacity_last_updated
        : snap.capacity_last_updated ?? mapLoc.capacity_last_updated,
    capacity_source_url:
      isCapacityPlace
        ? mapLoc.capacity_source_url ?? snap.capacity_source_url
        : snap.capacity_source_url ?? mapLoc.capacity_source_url,
    capacity_as_of:
      isCapacityPlace
        ? mapLoc.capacity_as_of ?? snap.capacity_as_of
        : snap.capacity_as_of ?? mapLoc.capacity_as_of,
    facility_counts:
      isCapacityPlace
        ? mapLoc.facility_counts ?? snap.facility_counts
        : snap.facility_counts ?? mapLoc.facility_counts,
    percent_full:
      isCapacityPlace
        ? (typeof mapLoc.percent_full === "number" ? mapLoc.percent_full : snap.percent_full)
        : (typeof snap.percent_full === "number" ? snap.percent_full : mapLoc.percent_full),
    available_seats:
      isCapacityPlace ? mapLoc.available_seats ?? snap.available_seats : snap.available_seats ?? mapLoc.available_seats,
    is_live:
      isCapacityPlace
        ? (typeof mapLoc.is_live === "boolean" ? mapLoc.is_live : snap.is_live)
        : (typeof snap.is_live === "boolean" ? snap.is_live : mapLoc.is_live),
    capacity: isCapacityPlace ? mapLoc.capacity ?? snap.capacity : snap.capacity ?? mapLoc.capacity,
    current_count:
      isCapacityPlace ? mapLoc.current_count ?? snap.current_count : snap.current_count ?? mapLoc.current_count,
  };
}

function getLayerForPlace(loc: CampusLocation): string {
  if (loc.type === "Dining" || loc.type === "Hub") return "Dining";
  if (loc.type === "Rec") return "Rec";
  if (loc.type === "Library") return "Library";
  if (loc.type === "Parking") return "Parking";
  return "Academic";
}

type UsePlacesSelectionParams = {
  allMapLocations: CampusLocation[];
  setActiveLayer: (layer: string) => void;
  currentLayer: string;
  onAfterSelectLocation?: (loc: CampusLocation, nextLayer: string) => void;
};

export function usePlacesSelection({
  allMapLocations,
  setActiveLayer,
  currentLayer,
  onAfterSelectLocation,
}: UsePlacesSelectionParams) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFetchingDining, setIsFetchingDining] = useState(false);
  const [diningMenuOptions, setDiningMenuOptions] = useState<string[]>([]);
  const [activeDiningMenu, setActiveDiningMenu] = useState<string | null>(null);
  const [activeDiningMealPeriod, setActiveDiningMealPeriod] =
    useState<DiningMealPeriod>(() => getDiningMealPeriodForLocation(null));
  const [activeDiningDate, setActiveDiningDate] = useState<string>(getLocalDateString());
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);
  const [diningMenuError, setDiningMenuError] = useState<string | null>(null);
  const [diningMenuRequestNonce, setDiningMenuRequestNonce] = useState(0);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState<any | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  const selectedLocFromMap = useMemo(
    () =>
      allMapLocations.find((location) => getLocationSelectionId(location) === selectedId),
    [allMapLocations, selectedId],
  );

  const selectedLoc = useMemo(
    () => mergePlaceDetailSnapshot(selectedLocFromMap, selectedPlaceDetail),
    [selectedLocFromMap, selectedPlaceDetail],
  );

  const foodCourtVenues = useMemo(() => {
    if (!selectedLoc) return [];
    return getFoodCourtVenueLocations(selectedLoc, allMapLocations).map((location) => ({
      location,
      label: getFoodCourtVenueLabel(location.location),
      menuCandidate: getDiningMenuCandidates(location.location)[0] || null,
      selectionId: getLocationSelectionId(location),
    }));
  }, [allMapLocations, selectedLoc]);

  const resetDiningState = useCallback(() => {
    setDiningMenuOptions([]);
    setActiveDiningMenu(null);
    setActiveDiningMealPeriod(getDiningMealPeriodForLocation(null) as DiningMealPeriod);
    setActiveDiningDate(getLocalDateString());
    setDiningMenuPreview(null);
    setDiningMenuError(null);
  }, []);

  const loadBestDiningPreview = useCallback(
    async (locationName: string, preferredMeal: DiningMealPeriod, dateKey: string) => {
      const contextDate = getDiningContextDate(dateKey);
      const options = getDiningMealOptionsForLocation(locationName, contextDate);
      const orderedMeals: DiningMealPeriod[] = [
        preferredMeal,
        ...options.filter((meal) => meal !== preferredMeal),
      ];

      let lastPreview: any | null = null;
      let lastError: unknown = null;
      for (const meal of orderedMeals) {
        let preview = null;
        try {
          preview = await fetchDiningFullMenuCached({
            location: locationName,
            mealPeriod: meal,
            date: dateKey,
          });
        } catch (error) {
          lastError = error;
        }

        const itemCount = (preview?.categories || []).reduce(
          (sum: number, category: any) => sum + (Array.isArray(category?.items) ? category.items.length : 0),
          0,
        );
        if (isDiningHallMenuLocation(locationName) && itemCount === 0) {
          try {
            preview = await fetchDiningFullMenuCached({
              location: locationName,
              mealPeriod: meal,
              date: dateKey,
              forceRefresh: true,
            });
          } catch (error) {
            lastError = error;
          }
        }
        lastPreview = preview;

        const categories = Array.isArray(preview?.categories) ? preview.categories : [];
        if (categories.length > 0) {
          return { preview, meal, dateKey };
        }
        if (preview?.success === false) {
          lastError = new Error(preview?.message || `No menu items returned for ${locationName} ${meal} on ${dateKey}`);
        }
      }

      const lastCategories = Array.isArray(lastPreview?.categories) ? lastPreview.categories : [];
      if (lastCategories.length === 0 && lastError) {
        throw lastError;
      }

      return { preview: lastPreview, meal: preferredMeal, dateKey };
    },
    [],
  );

  const fetchDiningData = useCallback(
    async (loc: CampusLocation) => {
      setIsFetchingDining(true);
      try {
        const foodCourtLocations = getFoodCourtVenueLocations(loc, allMapLocations);
        if (foodCourtLocations.length > 0) {
          const nextMenuOptions = Array.from(
            new Set(
              foodCourtLocations.flatMap((venue) =>
                getDiningMenuCandidates(venue.location),
              ),
            ),
          );
          const fallbackMenu =
            foodCourtLocations
              .map((venue) => getDiningMenuCandidates(venue.location)[0])
              .find(Boolean) || null;
          const nextMenu =
            (activeDiningMenu && nextMenuOptions.includes(activeDiningMenu)
              ? activeDiningMenu
              : fallbackMenu || nextMenuOptions[0]) || null;

          setDiningMenuOptions(nextMenuOptions);
          setActiveDiningMenu(nextMenu);
          setActiveDiningMealPeriod(
            getDiningMealPeriodForLocation(nextMenu || loc.location) as DiningMealPeriod,
          );
          setDiningMenuPreview(null);
          return;
        }

        if (!isDiningHallMenuLocation(loc.location)) {
          resetDiningState();
          return;
        }

        const todayKey = getLocalDateString();
        const menuCandidates = getDiningMenuCandidates(loc.location, []);
        setDiningMenuOptions(menuCandidates);
        setActiveDiningMenu(loc.location);
        setActiveDiningDate(todayKey);
        setActiveDiningMealPeriod(
          getDiningMealPeriodForLocation(loc.location, getDiningContextDate(todayKey)) as DiningMealPeriod,
        );
        setDiningMenuPreview(null);
        setDiningMenuError(null);
      } catch (error) {
        console.warn("Failed to fetch dining data", error);
        setDiningMenuError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsFetchingDining(false);
      }
    },
    [activeDiningMenu, allMapLocations, resetDiningState],
  );

  const handleSelectLocation = useCallback(
    (loc: CampusLocation) => {
      // Polo Road Fix: If we are already on a layer that the place supports (like Parking),
      // don't resolve to its Hub/Dining parent.
      const shouldJumpToHub = !(currentLayer === "Parking" && loc.type === "Parking");

      const parentFoodCourtLocation = shouldJumpToHub
        ? findFoodCourtParentLocation(loc, allMapLocations)
        : null;

      const nextLocation = parentFoodCourtLocation || loc;
      const preferredMenu = shouldHideFoodCourtLocationInBrowse(loc, allMapLocations)
        ? getDiningMenuCandidates(loc.location)[0] || null
        : null;

      if (preferredMenu) {
        setActiveDiningMenu(preferredMenu);
        setActiveDiningMealPeriod(
          getDiningMealPeriodForLocation(preferredMenu) as DiningMealPeriod,
        );
      }

      const nextLayer = currentLayer === "Today" ? "Today" : getLayerForPlace(nextLocation);
      setActiveLayer(nextLayer);
      setSelectedId(getLocationSelectionId(nextLocation));
      onAfterSelectLocation?.(nextLocation, nextLayer);
    },
    [allMapLocations, currentLayer, onAfterSelectLocation, setActiveLayer],
  );

  useEffect(() => {
    if (!selectedLocFromMap) {
      setSelectedPlaceDetail(null);
      setIsFetchingDetail(false);
      return;
    }

    let cancelled = false;
    const identifier = selectedLocFromMap.placeId || selectedLocFromMap.location;
    setIsFetchingDetail(true);
    fetchCampusPlaceDetail(identifier)
      .then((detail) => {
        if (!cancelled) setSelectedPlaceDetail(detail);
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedPlaceDetail(null);
          console.warn("Failed to fetch place detail snapshot", error);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetchingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLocFromMap?.location, selectedLocFromMap?.placeId]);

  useEffect(() => {
    if (!selectedLocFromMap || !isDiningHallMenuLocation(selectedLocFromMap.location)) {
      resetDiningState();
      return;
    }
    fetchDiningData(selectedLocFromMap);
  }, [fetchDiningData, resetDiningState, selectedLocFromMap]);

  useEffect(() => {
    if (!activeDiningMenu) return;

    let cancelled = false;
    setIsFetchingDining(true);
    setDiningMenuError(null);
    loadBestDiningPreview(activeDiningMenu, activeDiningMealPeriod, activeDiningDate)
      .then(({ preview, meal }) => {
        if (!cancelled) {
          if (meal !== activeDiningMealPeriod) setActiveDiningMealPeriod(meal);
          setDiningMenuPreview(preview);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn("Failed to load dining menu preview", error);
          setDiningMenuError(message);
          setDiningMenuPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetchingDining(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDiningDate, activeDiningMealPeriod, activeDiningMenu, diningMenuRequestNonce, loadBestDiningPreview]);

  useEffect(() => {
    if (!activeDiningMenu) return;
    warmDiningMenusInBackground({
      location: activeDiningMenu,
      centerDate: activeDiningDate,
      pastDays: 1,
      futureDays: 7,
      mealPeriods: [activeDiningMealPeriod],
    });
  }, [activeDiningDate, activeDiningMealPeriod, activeDiningMenu]);

  const isPrimaryDiningHallSelection = useMemo(() => {
    const reference = (activeDiningMenu || selectedLoc?.location || "").toLowerCase();
    const isHall = reference.includes("dining hall");
    return (
      isHall &&
      (reference.includes("sbisa") ||
        reference.includes("commons") ||
        reference.includes("duncan"))
    );
  }, [activeDiningMenu, selectedLoc?.location]);

  return {
    selectedId,
    setSelectedId,
    selectedLoc,
    selectedPlaceDetail,
    isFetchingDetail,
    foodCourtVenues,
    isFetchingDining,
    diningMenuOptions,
    activeDiningMenu,
    setActiveDiningMenu,
    activeDiningMealPeriod,
    setActiveDiningMealPeriod,
    activeDiningDate,
    setActiveDiningDate,
    diningMenuPreview,
    diningMenuError,
    retryDiningMenu: () => setDiningMenuRequestNonce((current) => current + 1),
    isPrimaryDiningHallSelection,
    handleSelectLocation,
  };
}
