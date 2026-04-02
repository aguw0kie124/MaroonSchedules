import { useState, useEffect, useCallback } from "react";
import { 
  isDiningHallMenuLocation, 
  getDiningMenuCandidates, 
  getDiningMealPeriodForLocation,
  type DiningMealPeriod 
} from "../../services/diningMenuCache";
import type { CampusLocation } from "./types";

export function usePlaceDetails(selectedId: string | null, locations: CampusLocation[]) {
  const [streamReviews, setStreamReviews] = useState<any[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [isPostingReview, setIsPostingReview] = useState(false);
  const [allReviewsModalVisible, setAllReviewsModalVisible] = useState(false);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  
  const [hubRestaurants, setHubRestaurants] = useState<string[]>([]);
  const [isFetchingDining, setIsFetchingDining] = useState(false);
  const [diningMenuOptions, setDiningMenuOptions] = useState<string[]>([]);
  const [activeDiningMenu, setActiveDiningMenu] = useState<string | null>(null);
  const [activeDiningMealPeriod, setActiveDiningMealPeriod] = useState<DiningMealPeriod>("lunch");
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);

  const fetchReviews = useCallback(async (placeId: string, limit = 5) => {
    if (limit > 5) setIsFetchingReviews(true);
    try {
      const { getPlaceReviews } = require("../../services/streamFeeds");
      const revs = await getPlaceReviews(placeId, limit);
      setStreamReviews(revs);
    } catch (e) {
      console.warn("Failed to fetch stream reviews", e);
    } finally {
      setIsFetchingReviews(false);
    }
  }, []);

  const handlePostReview = useCallback(async () => {
    if (!selectedId || !newReviewText.trim() || newRating === 0) return;
    setIsPostingReview(true);
    try {
      const { postPlaceReview } = require("../../services/streamFeeds");
      await postPlaceReview(selectedId, newRating, newReviewText.trim());
      setReviewModalVisible(false);
      setNewReviewText("");
      setNewRating(5);
      fetchReviews(selectedId);
    } catch (e) {
      console.warn("Failed to post review", e);
    } finally {
      setIsPostingReview(false);
    }
  }, [fetchReviews, newRating, newReviewText, selectedId]);

  const fetchDiningData = useCallback(async (loc: CampusLocation) => {
    setIsFetchingDining(true);
    try {
      if (!isDiningHallMenuLocation(loc.location)) {
        setHubRestaurants([]);
        setDiningMenuOptions([]);
        setActiveDiningMenu(null);
        setActiveDiningMealPeriod("lunch");
        setDiningMenuPreview(null);
        return;
      }
      const menuCandidates = getDiningMenuCandidates(loc.location, []);
      setHubRestaurants([]);
      setDiningMenuOptions(menuCandidates);
      setActiveDiningMenu(loc.location);
      setActiveDiningMealPeriod(getDiningMealPeriodForLocation(loc.location) as DiningMealPeriod);
      setDiningMenuPreview(null);
    } catch (e) {
      console.warn("Failed to fetch dining data", e);
    } finally {
      setIsFetchingDining(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId && locations.length > 0) {
      const loc = locations.find((l) => l.location === selectedId);
      if (loc) {
        fetchReviews(selectedId);
        fetchDiningData(loc);
      }
    }
  }, [selectedId, locations, fetchReviews, fetchDiningData]);

  const loadBestDiningPreview = useCallback(async (locationName: string, preferredMeal?: DiningMealPeriod) => {
    try {
      const { fetchDiningFullMenuCached } = require("../../services/diningMenuCache");
      const menu = await fetchDiningFullMenuCached(locationName);
      if (!menu) return { preview: null, meal: preferredMeal || "lunch" };

      const meal = preferredMeal || (getDiningMealPeriodForLocation(locationName) as DiningMealPeriod);
      // Basic heuristic for preview
      const items = menu[meal] || [];
      return { 
        preview: items.slice(0, 3).map((it: any) => it.name).join(", "), 
        meal 
      };
    } catch (e) {
      console.warn("Failed to load dining preview", e);
      return { preview: null, meal: preferredMeal || "lunch" };
    }
  }, []);

  useEffect(() => {
    if (!activeDiningMenu) return;
    let cancelled = false;
    setIsFetchingDining(true);
    loadBestDiningPreview(activeDiningMenu, activeDiningMealPeriod).then(({ preview, meal }) => {
      if (!cancelled) {
        if (meal !== activeDiningMealPeriod) setActiveDiningMealPeriod(meal);
        setDiningMenuPreview(preview);
      }
    }).finally(() => {
      if (!cancelled) setIsFetchingDining(false);
    });
    return () => { cancelled = true; };
  }, [activeDiningMealPeriod, activeDiningMenu, loadBestDiningPreview]);

  return {
    streamReviews,
    reviewModalVisible,
    setReviewModalVisible,
    newRating,
    setNewRating,
    newReviewText,
    setNewReviewText,
    isPostingReview,
    allReviewsModalVisible,
    setAllReviewsModalVisible,
    isFetchingReviews,
    hubRestaurants,
    isFetchingDining,
    diningMenuOptions,
    activeDiningMenu,
    setActiveDiningMenu,
    activeDiningMealPeriod,
    setActiveDiningMealPeriod,
    diningMenuPreview,
    setDiningMenuPreview,
    handlePostReview,
    fetchReviews,
    fetchDiningData,
    loadBestDiningPreview
  };
}
