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
import { getLocationSelectionId } from "./campusData";
import type { CampusLocation } from "./types";

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
  onAfterSelectLocation?: (loc: CampusLocation, nextLayer: string) => void;
};

export function usePlacesSelection({
  allMapLocations,
  setActiveLayer,
  onAfterSelectLocation,
}: UsePlacesSelectionParams) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hubRestaurants, setHubRestaurants] = useState<string[]>([]);
  const [isFetchingDining, setIsFetchingDining] = useState(false);
  const [diningMenuOptions, setDiningMenuOptions] = useState<string[]>([]);
  const [activeDiningMenu, setActiveDiningMenu] = useState<string | null>(null);
  const [activeDiningMealPeriod, setActiveDiningMealPeriod] =
    useState<DiningMealPeriod>("lunch");
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState<any | null>(null);

  const selectedLoc = useMemo(
    () =>
      allMapLocations.find((location) => getLocationSelectionId(location) === selectedId),
    [allMapLocations, selectedId],
  );

  const resetDiningState = useCallback(() => {
    setHubRestaurants([]);
    setDiningMenuOptions([]);
    setActiveDiningMenu(null);
    setActiveDiningMealPeriod("lunch");
    setDiningMenuPreview(null);
  }, []);

  const loadBestDiningPreview = useCallback(
    async (locationName: string, preferredMeal: DiningMealPeriod) => {
      const mealOptions = getDiningMealOptionsForLocation(locationName);
      const firstMeal =
        mealOptions.find((meal) => meal === preferredMeal) ||
        mealOptions[0] ||
        preferredMeal;
      const orderedMeals: DiningMealPeriod[] = [
        firstMeal,
        ...mealOptions.filter((meal) => meal !== firstMeal),
      ];
      let fallbackPreview: any = null;
      let fallbackMeal = firstMeal;

      for (const meal of orderedMeals) {
        const preview = await fetchDiningFullMenuCached({
          location: locationName,
          mealPeriod: meal,
        }).catch(() => null);
        if (!fallbackPreview) {
          fallbackPreview = preview;
          fallbackMeal = meal;
        }
        if (preview?.success && preview?.categories?.length) {
          return { preview, meal };
        }
      }

      return { preview: fallbackPreview, meal: fallbackMeal };
    },
    [],
  );

  const fetchDiningData = useCallback(
    async (loc: CampusLocation) => {
      setIsFetchingDining(true);
      try {
        if (!isDiningHallMenuLocation(loc.location)) {
          resetDiningState();
          return;
        }

        const menuCandidates = getDiningMenuCandidates(loc.location, []);
        setHubRestaurants([]);
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
    [resetDiningState],
  );

  const handleSelectLocation = useCallback(
    (loc: CampusLocation) => {
      const nextLayer = getLayerForPlace(loc);
      setActiveLayer(nextLayer);
      setSelectedId(getLocationSelectionId(loc));
      onAfterSelectLocation?.(loc, nextLayer);
    },
    [onAfterSelectLocation, setActiveLayer],
  );

  useEffect(() => {
    if (!selectedLoc) {
      setSelectedPlaceDetail(null);
      return;
    }

    let cancelled = false;
    const identifier = selectedLoc.placeId || selectedLoc.location;
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
  }, [selectedLoc?.location, selectedLoc?.placeId]);

  useEffect(() => {
    if (!selectedLoc || !isDiningHallMenuLocation(selectedLoc.location)) {
      resetDiningState();
      return;
    }
    fetchDiningData(selectedLoc);
  }, [fetchDiningData, resetDiningState, selectedLoc]);

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
    hubRestaurants,
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
