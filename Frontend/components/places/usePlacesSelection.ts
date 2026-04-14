import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCampusPlaceDetail } from "../../api/client";
import {
  fetchDiningFullMenuCached,
  getDiningMealOptionsForLocation,
  getDiningMealPeriodForLocation,
  getDiningMenuCandidates,
  isDiningHallMenuLocation,
  type DiningMealPeriod,
} from "../../services/diningMenuCache";
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
  return {
    ...mapLoc,
    hours_today: snap.hours_today ?? mapLoc.hours_today,
    hours_holiday_notice: snap.hours_holiday_notice ?? mapLoc.hours_holiday_notice,
    visitor_parking_available: snap.visitor_parking_available ?? mapLoc.visitor_parking_available,
    visitor_parking_code: snap.visitor_parking_code ?? mapLoc.visitor_parking_code,
    visitor_parking_garage_name: snap.visitor_parking_garage_name ?? mapLoc.visitor_parking_garage_name,
    visitor_parking_as_of: snap.visitor_parking_as_of ?? mapLoc.visitor_parking_as_of,
    visitor_parking_source_url: snap.visitor_parking_source_url ?? mapLoc.visitor_parking_source_url,
    percent_full:
      typeof snap.percent_full === "number" ? snap.percent_full : mapLoc.percent_full,
    available_seats: snap.available_seats ?? mapLoc.available_seats,
    is_live: typeof snap.is_live === "boolean" ? snap.is_live : mapLoc.is_live,
    capacity: snap.capacity ?? mapLoc.capacity,
    current_count: snap.current_count ?? mapLoc.current_count,
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
    useState<DiningMealPeriod>("lunch");
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState<any | null>(null);

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
    setActiveDiningMealPeriod("lunch");
    setDiningMenuPreview(null);
  }, []);

  const loadBestDiningPreview = useCallback(
    async (locationName: string, preferredMeal: DiningMealPeriod) => {
      const preview = await fetchDiningFullMenuCached({
        location: locationName,
        mealPeriod: preferredMeal,
      }).catch(() => null);
      return { preview, meal: preferredMeal };
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

        const menuCandidates = getDiningMenuCandidates(loc.location, []);
        setDiningMenuOptions(menuCandidates);
        setActiveDiningMenu(loc.location);
        setActiveDiningMealPeriod(
          getDiningMealPeriodForLocation(loc.location) as DiningMealPeriod,
        );
        setDiningMenuPreview(null);
      } catch (error) {
        console.warn("Failed to fetch dining data", error);
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

      const nextLayer = getLayerForPlace(nextLocation);
      setActiveLayer(nextLayer);
      setSelectedId(getLocationSelectionId(nextLocation));
      onAfterSelectLocation?.(nextLocation, nextLayer);
    },
    [allMapLocations, currentLayer, onAfterSelectLocation, setActiveLayer],
  );

  useEffect(() => {
    if (!selectedLocFromMap) {
      setSelectedPlaceDetail(null);
      return;
    }

    let cancelled = false;
    const identifier = selectedLocFromMap.placeId || selectedLocFromMap.location;
    fetchCampusPlaceDetail(identifier)
      .then((detail) => {
        if (!cancelled) setSelectedPlaceDetail(detail);
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedPlaceDetail(null);
          console.warn("Failed to fetch place detail snapshot", error);
        }
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
    loadBestDiningPreview(activeDiningMenu, activeDiningMealPeriod)
      .then(({ preview, meal }) => {
        if (!cancelled) {
          if (meal !== activeDiningMealPeriod) setActiveDiningMealPeriod(meal);
          setDiningMenuPreview(preview);
        }
      })
      .catch((error) => console.warn("Failed to load dining menu preview", error))
      .finally(() => {
        if (!cancelled) setIsFetchingDining(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDiningMealPeriod, activeDiningMenu, loadBestDiningPreview]);

  const isPrimaryDiningHallSelection = useMemo(() => {
    const reference = (activeDiningMenu || selectedLoc?.location || "").toLowerCase();
    return (
      reference.includes("sbisa") ||
      reference.includes("commons") ||
      reference.includes("duncan")
    );
  }, [activeDiningMenu, selectedLoc?.location]);

  return {
    selectedId,
    setSelectedId,
    selectedLoc,
    selectedPlaceDetail,
    foodCourtVenues,
    isFetchingDining,
    diningMenuOptions,
    activeDiningMenu,
    setActiveDiningMenu,
    activeDiningMealPeriod,
    setActiveDiningMealPeriod,
    diningMenuPreview,
    isPrimaryDiningHallSelection,
    handleSelectLocation,
  };
}
