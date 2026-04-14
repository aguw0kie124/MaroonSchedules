import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { TourProvider, useTour, TourTarget } from "../onboarding/TourProvider";
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import {
  X,
  ExternalLink,
  Calendar,
  ChevronRight,
  Utensils,
  Star,
  Navigation,
  Flag,
  Shield,
  Trash2,
  ChevronUp,
  ChevronDown,
  Leaf,
  Clock,
} from "lucide-react-native";
import { useUser } from "@clerk/clerk-expo";
import { PillTabs } from "../PillTabs";
import { ALL_DINING_MEAL_PERIODS } from "../../services/diningMenuCache";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import type { CampusLocation } from "./types";
import { SHEET_BOTTOM_OFFSET, SCREEN_HEIGHT } from "./types";
import {
  getStatusColor,
  formatScheduleDays,
  getLocationContextLink,
} from "./utils";
import { getCanonicalLocationName } from "./campusData";
import { getStaticRestaurantMenu } from "../../data/restaurantMenus";
import {
  DiningMealPeriod,
  isDiningHallMenuLocation,
} from "../../services/diningMenuCache";
import { reportContent, blockUser, deleteReview } from "../../services/socialFeedService";
import { Alert } from "react-native";

const SHEET_HEIGHT = SCREEN_HEIGHT * 0.94;
const SHEET_TOP_VISIBLE_HEIGHT = SCREEN_HEIGHT * 0.84;
const SHEET_TOP_SNAP = Math.max(SHEET_HEIGHT - SHEET_TOP_VISIBLE_HEIGHT, 0);
const SHEET_MID_VISIBLE_HEIGHT = Math.min(440, SCREEN_HEIGHT * 0.48);
const SHEET_DINING_HALL_VISIBLE_HEIGHT = Math.min(250, SCREEN_HEIGHT * 0.3);
const SHEET_PEEK_VISIBLE_HEIGHT = Math.min(116, SCREEN_HEIGHT * 0.085);
const SHEET_MID_SNAP = Math.max(SHEET_HEIGHT - SHEET_MID_VISIBLE_HEIGHT, 0);
const SHEET_DINING_HALL_SNAP = Math.max(
  SHEET_HEIGHT - SHEET_DINING_HALL_VISIBLE_HEIGHT,
  0,
);
const SHEET_PEEK_SNAP = Math.max(SHEET_HEIGHT - SHEET_PEEK_VISIBLE_HEIGHT, 0);
const SHEET_HIDDEN_SNAP = SCREEN_HEIGHT;

type SheetMode = "peek" | "mid" | "top" | "hidden";

function getSheetModeForSnap(toValue: number): SheetMode {
  const topMidThreshold = (SHEET_TOP_SNAP + SHEET_MID_SNAP) / 2;
  const midPeekThreshold = (SHEET_MID_SNAP + SHEET_PEEK_SNAP) / 2;
  const peekHiddenThreshold = (SHEET_PEEK_SNAP + SHEET_HIDDEN_SNAP) / 2;

  if (toValue >= peekHiddenThreshold) return "hidden";
  if (toValue >= midPeekThreshold) return "peek";
  if (toValue >= topMidThreshold) return "mid";
  return "top";
}

function getNavigationPlaceType(type: CampusLocation["type"]) {
  switch (type) {
    case "Academic":
      return "academic";
    case "Library":
      return "library";
    case "Dining":
      return "dining";
    case "Rec":
      return "recreation";
    case "Housing":
      return "housing";
    case "Athletics":
      return "athletics";
    case "General":
      return "general";
    default:
      return "landmark";
  }
}

function getOccupancyLabel(percentFull: number) {
  if (percentFull >= 80) return "Busy";
  if (percentFull >= 55) return "Steady";
  if (percentFull >= 30) return "Moderate";
  return "Light";
}

function getOccupancyInsight(
  percentFull: number,
  trafficHistory?: number[],
  fallback?: string | null,
) {
  const history = Array.isArray(trafficHistory)
    ? trafficHistory.filter((value): value is number => Number.isFinite(value))
    : [];

  if (history.length >= 2) {
    const previous = history[history.length - 2];
    const delta = percentFull - previous;
    if (delta >= 8) {
      return "Traffic is climbing compared with the last update.";
    }
    if (delta <= -8) {
      return "Traffic is easing compared with the last update.";
    }
  }

  if (fallback) {
    return fallback;
  }

  if (percentFull >= 80) {
    return "Crowded right now, so expect tighter space.";
  }
  if (percentFull >= 55) {
    return "Moderate traffic right now with steady turnover.";
  }
  return "Plenty of open space right now.";
}

interface LocationBottomSheetProps {
  styles: any;
  COLORS: any;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  selectedLoc: CampusLocation | undefined;
  // Sheet state is managed internally
  // Reviews
  reviews: any[];
  reviewModalVisible: boolean;
  setReviewModalVisible: (v: boolean) => void;
  newRating: number;
  setNewRating: (v: number) => void;
  newReviewText: string;
  setNewReviewText: (v: string) => void;
  isPostingReview: boolean;
  handlePostReview: () => void;
  allReviewsModalVisible: boolean;
  setAllReviewsModalVisible: (v: boolean) => void;
  isFetchingReviews: boolean;
  isDark: boolean;
  fetchReviews: (placeId: string, limit?: number) => void;
  // Dining
  foodCourtVenues: Array<{
    selectionId: string;
    label: string;
    menuCandidate: string | null;
    location: CampusLocation;
  }>;
  diningMenuOptions: string[];
  activeDiningMenu: string | null;
  setActiveDiningMenu: (v: string | null) => void;
  activeDiningMealPeriod: DiningMealPeriod;
  setActiveDiningMealPeriod: (v: DiningMealPeriod) => void;
  diningMenuPreview: any | null;
  isFetchingDining: boolean;
  isPrimaryDiningHallSelection: boolean;
  openFullMenu: (locationName: string, mealPeriod?: DiningMealPeriod) => void;
  // Schedule
  openScheduleList: () => void;
  // Recreation
  selectedRecreationFacility: any | null;
  recreationFacilityMap: Map<string, any>;
  // Navigation
  navigation: any;
  // External link
  getPlaceExternalLink: (location: CampusLocation) => { label: string; url: string };
  // Bus state — to know when not to show
  selectedStop: any;
  selectedBus: any;
  openNavigationToLocation?: (loc: CampusLocation, mode?: "walk" | "drive" | "bus") => void;
}

export function LocationBottomSheet({
  styles,
  COLORS,
  isDark,
  selectedId,
  setSelectedId,
  selectedLoc,
  reviews,
  reviewModalVisible,
  setReviewModalVisible,
  newRating,
  setNewRating,
  newReviewText,
  setNewReviewText,
  isPostingReview,
  handlePostReview,
  allReviewsModalVisible,
  setAllReviewsModalVisible,
  isFetchingReviews,
  fetchReviews,
  foodCourtVenues,
  diningMenuOptions,
  activeDiningMenu,
  setActiveDiningMenu,
  activeDiningMealPeriod,
  setActiveDiningMealPeriod,
  diningMenuPreview,
  isFetchingDining,
  isPrimaryDiningHallSelection,
  openFullMenu,
  openScheduleList,
  selectedRecreationFacility,
  recreationFacilityMap,
  navigation,
  getPlaceExternalLink,
  selectedStop,
  selectedBus,
  openNavigationToLocation,
}: LocationBottomSheetProps) {
  const { user } = useUser();
  const { advanceStep, activeTargetName } = useTour();
  const selectedReviewId = selectedLoc?.placeId || selectedLoc?.location || null;
  const selectedLabel = selectedLoc?.location || selectedId || "";

  // ── Bottom sheet animation ──────────────────────────────────
  const sheetY = useRef(new Animated.Value(SHEET_HIDDEN_SNAP)).current;
  const sheetSnap = useRef<number>(SHEET_HIDDEN_SNAP);
  const panStartY = useRef<number>(SHEET_HIDDEN_SNAP);
  const [sheetMode, setSheetMode] = useState<SheetMode>("hidden");
  const [diningDetailTab, setDiningDetailTab] = useState<"reviews" | "menus">("reviews");

  const [activeCategoryKey, setActiveCategoryKey] = useState("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((categoryName: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  }, []);

  useEffect(() => {
    if (diningMenuPreview?.categories) {
      const categoryNames = diningMenuPreview.categories.map((c: any) => c.name);
      setCollapsedCategories(new Set(categoryNames));
    }
  }, [diningMenuPreview]);

  const animateSheet = useCallback(
    (toValue: number, onDone?: () => void) => {
      sheetSnap.current = toValue;
      setSheetMode(getSheetModeForSnap(toValue));
      Animated.spring(sheetY, {
        toValue,
        useNativeDriver: true,
        damping: 30,
        stiffness: 260,
        mass: 0.9,
      }).start(() => {
        if (onDone) onDone();
      });
    },
    [sheetY],
  );

  useEffect(() => {
    if (selectedLoc && (isDiningHallMenuLocation(selectedLoc.location) || foodCourtVenues.length > 0)) {
      setDiningDetailTab("menus");
    } else {
      setDiningDetailTab("reviews");
    }
    if (selectedId) {
      animateSheet(
        selectedLoc && isDiningHallMenuLocation(selectedLoc.location) && isPrimaryDiningHallSelection
          ? SHEET_DINING_HALL_SNAP
          : SHEET_MID_SNAP,
      );
    } else {
      animateSheet(SHEET_HIDDEN_SNAP);
    }
  }, [selectedId, animateSheet, activeTargetName, foodCourtVenues.length, selectedLoc?.location, selectedLoc?.type]);

  const isDiningHallCard =
    !!selectedLoc &&
    isDiningHallMenuLocation(selectedLoc.location) &&
    isPrimaryDiningHallSelection;
  const isFoodCourtHub = foodCourtVenues.length > 0;
  const isDiningMenuExperience = isDiningHallCard || isFoodCourtHub;
  const preferredExpandedSnap = isDiningHallCard
    ? SHEET_DINING_HALL_SNAP
    : SHEET_MID_SNAP;

  const isPeekSheet = sheetMode === "peek";
  const isCapacityPlace =
    selectedLoc?.type === "Library" || selectedLoc?.type === "Rec";
  const occupancyPercent = selectedLoc
    ? Math.max(
        0,
        Math.min(
          100,
          Number.isFinite(selectedLoc.percent_full) ? selectedLoc.percent_full : 0,
        ),
      )
    : 0;
  const occupancyToneColor = selectedLoc
    ? getStatusColor(occupancyPercent)
    : COLORS.primary;
  const occupancyCountLabel = useMemo(() => {
    if (!selectedLoc || !isCapacityPlace) return null;
    const cap = selectedLoc.capacity;
    const cur = selectedLoc.current_count;
    if (cap != null && cur != null && cap > 0) {
      return `About ${cur.toLocaleString()} of ${cap.toLocaleString()} people`;
    }
    return null;
  }, [selectedLoc, isCapacityPlace]);
  const parkingRecommendation = useMemo(() => {
    if (!selectedLoc || selectedLoc.type !== "Parking") return null;
    const lower = selectedLoc.location.toLowerCase();
    const isGarage = lower.includes("garage");
    return isGarage
      ? {
          badge: "Recommended",
          detail: "A strong all-around option for most valid permits.",
        }
      : {
          badge: "Available",
          detail: "Keep this as a fallback if your primary lots are full.",
        };
  }, [selectedLoc]);
  const selectedHoursLabel = useMemo(() => {
    if (!selectedLoc) return null;
    const holiday = selectedLoc.hours_holiday_notice;
    const suffix = holiday ? ` · ${holiday}` : "";
    if (selectedLoc.hours_today) {
      return `${selectedLoc.hours_today}${suffix}`;
    }
    if (selectedLoc.type === "Rec") {
      const rec =
        selectedRecreationFacility?.today_hours ||
        selectedRecreationFacility?.hours_hint ||
        selectedLoc.hours ||
        null;
      return rec ? `${rec}${suffix}` : holiday || null;
    }
    const base = selectedLoc.hours || null;
    return base ? `${base}${suffix}` : holiday || null;
  }, [selectedLoc, selectedRecreationFacility]);
  const peekMetaText = useMemo(() => {
    if (!selectedLoc) return "";

    if (isCapacityPlace) {
      return `${occupancyPercent}% full`;
    }
    if (
      selectedLoc.type === "Parking" &&
      selectedLoc.visitor_parking_available != null
    ) {
      const code = selectedLoc.visitor_parking_code || "";
      const name = selectedLoc.visitor_parking_garage_name;
      const label = code && name ? `${code} (${name})` : code || "Garage";
      return `${label}: ${selectedLoc.visitor_parking_available.toLocaleString()} spaces (live)`;
    }
    if (selectedHoursLabel) {
      if (selectedLoc.hours_today) return selectedHoursLabel;
      return selectedLoc.type === "Rec" ? `Today ${selectedHoursLabel}` : selectedHoursLabel;
    }
    if (isFoodCourtHub) {
      return `${foodCourtVenues.length} locations`;
    }
    if (selectedLoc.current_event) {
      return selectedLoc.current_event;
    }
    if (selectedLoc.type !== "Dining" && selectedLoc.type !== "Hub") {
      return selectedLoc.type;
    }
    if (selectedLoc.address) {
      return selectedLoc.address;
    }
    return "";
  }, [
    foodCourtVenues.length,
    isCapacityPlace,
    isFoodCourtHub,
    occupancyPercent,
    selectedHoursLabel,
    selectedLoc,
  ]);
  const contextLink = useMemo(
    () => (selectedLoc ? getLocationContextLink(selectedLoc) : null),
    [selectedLoc],
  );
  const externalLink = useMemo(
    () => (selectedLoc ? getPlaceExternalLink(selectedLoc) : null),
    [getPlaceExternalLink, selectedLoc],
  );
  const heroMetaText = useMemo(() => {
    if (!selectedLoc) return "";

    const bits: string[] = [];
    if (selectedLoc.address) {
      bits.push(selectedLoc.address);
    }
    const hoursDetailTypes = new Set([
      "Library",
      "Dining",
      "Rec",
      "Parking",
      "Hub",
    ]);
    const hoursShownInCard =
      !!selectedLoc.hours_today && hoursDetailTypes.has(selectedLoc.type);
    if (selectedHoursLabel && !hoursShownInCard) {
      if (selectedLoc.hours_today) {
        bits.push(selectedHoursLabel);
      } else {
        bits.push(selectedLoc.type === "Rec" ? `Today ${selectedHoursLabel}` : selectedHoursLabel);
      }
    } else if (!selectedHoursLabel && selectedLoc.current_event) {
      bits.push(selectedLoc.current_event);
    } else if (hoursShownInCard && selectedLoc.current_event) {
      bits.push(selectedLoc.current_event);
    }
    if (!bits.length && isFoodCourtHub) {
      bits.push(`${foodCourtVenues.length} dining locations inside`);
    }
    return bits.filter(Boolean).slice(0, 2).join(" • ");
  }, [foodCourtVenues.length, isFoodCourtHub, selectedHoursLabel, selectedLoc]);
  const officialFacilityUrl = useMemo(
    () =>
      selectedLoc?.type === "Rec"
        ? selectedRecreationFacility?.source_url || null
        : null,
    [selectedLoc?.type, selectedRecreationFacility?.source_url],
  );

  const handleNavigatePress = useCallback(() => {
    if (!selectedLoc) return;
    if (openNavigationToLocation) {
      openNavigationToLocation(selectedLoc);
      return;
    }
    navigation.navigate("CampusNavigation", {
      initialDestination: {
        id: selectedLoc.location,
        name: selectedLoc.location,
        shortName: selectedLoc.shortName || selectedLoc.location,
        latitude: selectedLoc.coord.lat,
        longitude: selectedLoc.coord.lng,
        type: getNavigationPlaceType(selectedLoc.type),
      },
    });
  }, [navigation, openNavigationToLocation, selectedLoc]);

  const handlePeekExpand = useCallback(() => {
    animateSheet(preferredExpandedSnap);
  }, [animateSheet, preferredExpandedSnap]);

  const handleExternalLinkPress = useCallback(() => {
    if (!selectedLoc || !externalLink) return;
    if (externalLink.label === "Open in Maps" && openNavigationToLocation) {
      openNavigationToLocation(selectedLoc);
      return;
    }
    Linking.openURL(externalLink.url).catch((error) => {
      console.warn("Unable to open place external link", error);
    });
  }, [externalLink, openNavigationToLocation, selectedLoc]);

  const handleContextLinkPress = useCallback(() => {
    if (!contextLink) return;
    Linking.openURL(contextLink.url).catch((error) => {
      console.warn("Unable to open place context link", error);
    });
  }, [contextLink]);

  const openReviewComposer = useCallback(() => {
    setReviewModalVisible(true);
  }, [setReviewModalVisible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
        onPanResponderGrant: () => {
          panStartY.current = sheetSnap.current;
          sheetY.stopAnimation();
        },
        onPanResponderMove: (_, { dy }) => {
          const next = Math.max(
            SHEET_TOP_SNAP,
            Math.min(SHEET_HIDDEN_SNAP, panStartY.current + dy),
          );
          sheetY.setValue(next);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          const liveY = panStartY.current + dy;

          const snapPoints = [
            SHEET_TOP_SNAP,
            preferredExpandedSnap,
            SHEET_PEEK_SNAP,
            SHEET_HIDDEN_SNAP,
          ];
          const currentIndex = snapPoints.reduce((bestIndex, point, index) => {
            const bestDistance = Math.abs(snapPoints[bestIndex] - sheetSnap.current);
            const nextDistance = Math.abs(point - sheetSnap.current);
            return nextDistance < bestDistance ? index : bestIndex;
          }, 0);

          if (vy < -1.0) {
            animateSheet(snapPoints[Math.max(0, currentIndex - 1)]);
            return;
          }

          if (vy > 1.0) {
            const nextSnap = snapPoints[Math.min(snapPoints.length - 1, currentIndex + 1)];
            if (nextSnap === SHEET_HIDDEN_SNAP) {
              animateSheet(SHEET_HIDDEN_SNAP, () => setSelectedId(null));
            } else {
              animateSheet(nextSnap);
            }
            return;
          }

          const topMidThreshold = (SHEET_TOP_SNAP + preferredExpandedSnap) / 2;
          const midPeekThreshold = (preferredExpandedSnap + SHEET_PEEK_SNAP) / 2;
          const peekHiddenThreshold = (SHEET_PEEK_SNAP + SHEET_HIDDEN_SNAP) / 2;

          if (liveY >= peekHiddenThreshold) {
            animateSheet(SHEET_HIDDEN_SNAP, () => setSelectedId(null));
          } else if (liveY >= midPeekThreshold) {
            animateSheet(SHEET_PEEK_SNAP);
          } else if (liveY >= topMidThreshold) {
            animateSheet(preferredExpandedSnap);
          } else {
            animateSheet(SHEET_TOP_SNAP);
          }
        },
      }),
    [animateSheet, preferredExpandedSnap, setSelectedId],
  );

    const handleReportReview = (rev: any) => {
        Alert.alert(
            "Report Review",
            "Why are you reporting this review?",
            [
                { text: "Inappropriate", onPress: () => submitReviewReport(rev, "inappropriate") },
                { text: "Spam", onPress: () => submitReviewReport(rev, "spam") },
                { text: "Harassment", onPress: () => submitReviewReport(rev, "harassment") },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const submitReviewReport = async (rev: any, reason: string) => {
        try {
            await reportContent({
                reporteeId: rev.userId || rev.user_id || rev.sub,
                postType: 'review',
                postId: rev.id,
                reason: reason,
                placeId: selectedReviewId || undefined
            });
            Alert.alert("Report Received", "Thank you for your report.");
        } catch (err) {
            Alert.alert("Error", "Failed to submit report.");
        }
    };

    const handleBlockReviewer = (rev: any) => {
        Alert.alert(
            "Block User",
            `Block ${rev.user}? You won't see their reviews.`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Block", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await blockUser(rev.userId || rev.user_id || rev.sub);
                            if (selectedReviewId) fetchReviews(selectedReviewId, 10);
                            Alert.alert("User Blocked");
                        } catch (err) {
                            Alert.alert("Error", "Failed to block user.");
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteReview = (rev: any) => {
        Alert.alert(
            "Delete Review",
            "Are you sure you want to remove your review?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            if (!selectedReviewId) return;
                            await deleteReview(selectedReviewId, rev.id);
                            fetchReviews(selectedReviewId, 10);
                            Alert.alert("Success", "Review deleted.");
                        } catch (err) {
                            Alert.alert("Error", "Failed to delete review.");
                        }
                    }
                }
            ]
        );
    };

  if (!selectedId || selectedStop || selectedBus) return null;

  return (
    <>
      <Animated.View
        style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandle} />

        {selectedLoc ? (
          <>
            <View style={[styles.heroCard, isPeekSheet && styles.heroCardPeek]}>
              <View style={[styles.heroHeadingRow, isPeekSheet && styles.heroHeadingRowPeek]}>
                <View style={styles.heroHeadingText}>
                  <Text
                    style={[
                      styles.locationName,
                      isPeekSheet ? styles.locationNamePeek : styles.locationNameExpanded,
                    ]}
                    numberOfLines={isPeekSheet ? 1 : 3}
                  >
                    {selectedLoc.location}
                  </Text>

                  {((isPeekSheet ? peekMetaText : heroMetaText) || "").length ? (
                    <Text
                      style={[
                        styles.heroMetaText,
                        isPeekSheet && styles.heroMetaTextPeek,
                      ]}
                      numberOfLines={1}
                    >
                      {isPeekSheet ? peekMetaText : heroMetaText}
                    </Text>
                  ) : null}
                </View>

                {isPeekSheet ? (
                  <TouchableOpacity
                    style={styles.peekPrimaryAction}
                    activeOpacity={0.85}
                    onPress={handlePeekExpand}
                  >
                    <ChevronRight size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setSelectedId(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.dismissBtn}
                  >
                    <X size={16} color="#888" />
                  </TouchableOpacity>
                )}
              </View>

              {!isPeekSheet ? (
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    style={styles.quickActionPill}
                    onPress={handleNavigatePress}
                  >
                    <Navigation size={14} color={COLORS.textPrimary} />
                    <Text style={styles.quickActionText}>Directions</Text>
                  </TouchableOpacity>

                  {externalLink && externalLink.label !== "Open in Maps" ? (
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={handleExternalLinkPress}
                    >
                      <ExternalLink size={14} color={COLORS.textPrimary} />
                      <Text style={styles.quickActionText}>
                        {externalLink.label}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {activeDiningMenu && isDiningHallCard ? (
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={() => openFullMenu(activeDiningMenu, activeDiningMealPeriod)}
                    >
                      <Utensils size={14} color={COLORS.textPrimary} />
                      <Text style={styles.quickActionText}>Menus</Text>
                    </TouchableOpacity>
                  ) : null}

                  {selectedLoc.classMeetings?.length ? (
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={openScheduleList}
                    >
                      <Calendar size={14} color={COLORS.textPrimary} />
                      <Text style={styles.quickActionText}>Today</Text>
                    </TouchableOpacity>
                  ) : null}

                  {contextLink ? (
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={handleContextLinkPress}
                    >
                      <ExternalLink size={14} color={COLORS.textPrimary} />
                      <Text style={styles.quickActionText}>
                        {contextLink.label}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>

            {!isPeekSheet && selectedLoc.type === "Parking" ? (
              <View style={[styles.occupancyBlock, { padding: 18 }]}>
                {selectedLoc.visitor_parking_available != null ? (
                  <View style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <View
                        style={[styles.heroBadgeDot, { backgroundColor: "#32D74B" }]}
                      />
                      <Text
                        style={[
                          styles.sectionTitle,
                          { marginBottom: 0, color: "#32D74B" },
                        ]}
                      >
                        Live Availability
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          styles.occupancyLiveText,
                          {
                            fontSize: 34,
                            fontWeight: "900",
                            color: COLORS.textPrimary,
                          },
                        ]}
                      >
                        {selectedLoc.visitor_parking_available.toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          styles.sectionTitle,
                          {
                            fontSize: 14,
                            fontWeight: "800",
                            color: COLORS.textSecondary,
                          },
                        ]}
                      >
                        SPACES OPEN
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                      Visitor Parking
                    </Text>
                    <Text
                      style={[
                        styles.contextCardBody,
                        { fontSize: 14, fontWeight: "600" },
                      ]}
                    >
                      Available at this location
                    </Text>
                  </View>
                )}

                <View
                  style={[styles.sheetDivider, { marginVertical: 12, opacity: 0.5 }]}
                />

                {selectedLoc.hours_today && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <Clock size={16} color={COLORS.textSecondary} />
                    <View>
                      <Text
                        style={[styles.sectionTitle, { fontSize: 10, marginBottom: 2 }]}
                      >
                        Operating Hours
                      </Text>
                      <Text
                        style={[
                          styles.contextCardBody,
                          { fontWeight: "700", color: COLORS.textPrimary },
                        ]}
                      >
                        {selectedLoc.hours_today.includes("Typical")
                          ? "Available 24/7"
                          : selectedLoc.hours_today.replace(/.*?:\s*/, "")}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedLoc.visitor_parking_available == null && (
                  <Text
                    style={[
                      styles.contextCardBody,
                      { fontSize: 12, fontStyle: "italic", marginBottom: 10 },
                    ]}
                  >
                    Real-time counts only available for major visitor garages.
                  </Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.quickActionPill,
                    {
                      alignSelf: "flex-start",
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                    },
                  ]}
                  onPress={() =>
                    Linking.openURL(
                      "https://transport.tamu.edu/parking/realtime.aspx",
                    ).catch(() => {})
                  }
                >
                  <ExternalLink size={14} color={COLORS.textPrimary} />
                  <Text style={styles.quickActionText}>Rates & Rules</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!isPeekSheet &&
            selectedLoc.type !== "Parking" &&
            parkingRecommendation ? (
              <View style={styles.contextCard}>
                <Text style={styles.contextCardTitle}>
                  {parkingRecommendation.badge}
                </Text>
                <Text style={styles.contextCardBody}>
                  {parkingRecommendation.detail}
                </Text>
              </View>
            ) : null}

            {!isPeekSheet &&
            selectedLoc.hours_today &&
            selectedLoc.type !== "Parking" &&
            (selectedLoc.type === "Library" ||
              selectedLoc.type === "Dining" ||
              selectedLoc.type === "Rec" ||
              selectedLoc.type === "Hub") ? (
              <View style={styles.contextCard}>
                <Text style={styles.contextCardTitle}>Open today</Text>
                <Text style={styles.contextCardBody}>
                  {selectedLoc.hours_today}
                </Text>
              </View>
            ) : null}

            {!isPeekSheet && selectedLoc.current_event ? (
              <View style={styles.contextCard}>
                <Text style={styles.contextCardTitle}>
                  Active at this place
                </Text>
                <Text style={styles.contextCardBody}>
                  {selectedLoc.current_event}
                </Text>
              </View>
            ) : null}

            {/* Occupancy / links */}
            {!isPeekSheet && isCapacityPlace ? (
              <View style={styles.infoBlock}>
                <View style={styles.occupancyBlock}>
                  <View style={styles.occupancySummaryRow}>
                    <Text style={styles.occupancyLiveLabel}>
                      Live Occupancy
                    </Text>
                    <Text
                      style={[
                        styles.occupancyLiveText,
                        { color: occupancyToneColor },
                      ]}
                    >
                      {occupancyPercent}% Full
                    </Text>
                  </View>
                  <View style={styles.occupancyTrack}>
                    <View
                      style={[
                        styles.occupancyFill,
                        {
                          width: `${occupancyPercent}%` as any,
                          backgroundColor: occupancyToneColor,
                        },
                      ]}
                    />
                  </View>
                </View>

                {occupancyCountLabel ? (
                  <Text
                    style={[
                      styles.contextCardBody,
                      { marginTop: 8, opacity: 0.9 },
                    ]}
                  >
                    {occupancyCountLabel}
                  </Text>
                ) : null}

                {officialFacilityUrl && officialFacilityUrl !== externalLink?.url ? (
                  <TouchableOpacity
                    style={styles.inlineLinkRow}
                    onPress={() => Linking.openURL(officialFacilityUrl).catch(() => {})}
                  >
                    <ExternalLink size={14} color={COLORS.primary} />
                    <Text style={styles.inlineLinkText}>
                      Open official facility page
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {!isPeekSheet && !isDiningHallCard ? <View style={styles.sheetDivider} /> : null}

            {/* Scrollable detail content */}
            {!isPeekSheet && !isDiningHallCard ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              scrollEventThrottle={16}
            >
              {isDiningMenuExperience ? (
                <>
                  <View style={styles.detailTabsWrap}>
                    <View style={styles.mapsTabRow}>
                      {[
                        { key: "reviews", label: "Reviews" },
                        {
                          key: "menus",
                          label: isDiningHallCard ? "Menu" : "Locations",
                        },
                      ].map((tab) => {
                        const isActive = diningDetailTab === tab.key;
                        return (
                          <TouchableOpacity
                            key={tab.key}
                            style={styles.mapsTabButton}
                            onPress={() =>
                              setDiningDetailTab(tab.key as "reviews" | "menus")
                            }
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[
                                styles.mapsTabLabel,
                                isActive && styles.mapsTabLabelActive,
                              ]}
                            >
                              {tab.label}
                            </Text>
                            <View
                              style={[
                                styles.mapsTabUnderline,
                                isActive && styles.mapsTabUnderlineActive,
                              ]}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {diningDetailTab === "menus" ? (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <View>
                          <Text style={styles.sectionTitle}>
                            {isDiningHallCard ? "Menu" : "Inside this Food Court"}
                          </Text>
                          <Text style={styles.menuIntroText}>
                            {isDiningHallCard
                              ? "Use the Menus button above to open the full dining hall menu."
                              : "Browse the dining locations available inside this hub."}
                          </Text>
                        </View>
                        {isDiningHallCard && activeDiningMenu ? (
                          <TouchableOpacity
                            onPress={() =>
                              openFullMenu(
                                activeDiningMenu || selectedLoc.location,
                                activeDiningMealPeriod,
                              )
                            }
                          >
                            <Text style={styles.seeAllText}>Open full menu</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {!isDiningHallCard && foodCourtVenues.length > 0 ? (
                        <View style={styles.foodCourtVenueList}>
                          {foodCourtVenues.map((venue) => {
                            const hasMenu = !!getStaticRestaurantMenu(venue.location.location);
                            return (
                            <View key={venue.selectionId} style={styles.foodCourtVenueCard}>
                              <View style={{ flex: 1, paddingRight: 12 }}>
                                <Text style={styles.foodCourtVenueTitle}>
                                  {venue.label}
                                </Text>
                                <Text style={styles.foodCourtVenueMeta}>
                                  {venue.location.shortName &&
                                  venue.location.shortName !== venue.location.location
                                    ? venue.location.shortName
                                    : "Dining location"}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.foodCourtVenueAction}>Inside</Text>
                                {hasMenu ? (
                                  <TouchableOpacity
                                    onPress={() => openFullMenu(venue.menuCandidate || venue.location.location)}
                                    style={styles.foodCourtVenueMenuBtn}
                                    activeOpacity={0.7}
                                  >
                                    <Utensils size={11} color="#FFF" />
                                    <Text style={styles.foodCourtVenueMenuBtnText}>Menu</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {isDiningHallCard && diningMenuOptions.length > 1 ? (
                        <View style={styles.restaurantChipList}>
                          {diningMenuOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={[
                                styles.restaurantChip,
                                activeDiningMenu === option && styles.restaurantChipActive,
                              ]}
                              onPress={() => setActiveDiningMenu(option)}
                            >
                              <Text style={styles.restaurantChipText}>{option}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}

                      {!isDiningHallCard && foodCourtVenues.length === 0 ? (
                        <View style={styles.emptyReviews}>
                          <Text style={styles.emptyReviewsText}>
                            No dining locations are listed inside this hub yet.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Reviews</Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity
                            onPress={openReviewComposer}
                          >
                            <Text style={styles.addReviewText}>
                              + Add Review
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setAllReviewsModalVisible(true);
                              if (selectedReviewId) fetchReviews(selectedReviewId, 30);
                            }}
                          >
                            <Text style={styles.seeAllText}>See all</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {reviews.length > 0 ? (
                        reviews.slice(0, 3).map((rev, i) => (
                          <View key={rev.id || i} style={styles.reviewItem}>
                            <View style={styles.reviewMeta}>
                              <View style={styles.reviewUserRow}>
                                <View style={styles.userAvatar}>
                                  <Text style={styles.avatarText}>
                                    {rev.user[0]}
                                  </Text>
                                </View>
                                <Text style={styles.reviewUser}>
                                  {rev.user}
                                </Text>
                              </View>
                              <View style={styles.reviewStars}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={11}
                                    fill={
                                      s <= rev.rating ? "#FFD700" : "transparent"
                                    }
                                    color={s <= rev.rating ? "#FFD700" : "#555"}
                                  />
                                ))}
                              </View>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reviewComment} numberOfLines={3}>
                                {rev.comment}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                {rev.userId === user?.id ? (
                                    <TouchableOpacity onPress={() => handleDeleteReview(rev)}>
                                        <Trash2 size={14} color="#E56B6B" />
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity onPress={() => handleReportReview(rev)}>
                                            <Flag size={14} color="#888" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleBlockReviewer(rev)}>
                                            <Shield size={14} color="#888" />
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyReviews}>
                          <Text style={styles.emptyReviewsText}>
                            No reviews found for this location.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Traffic chart */}
                  {(selectedLoc.type === "Library" ||
                    selectedLoc.type === "Rec") && (
                    <TourTarget name="rec-center-capacity">
                      <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Foot Traffic · Last 8h</Text>
                        <View style={styles.chartBars}>
                          {(
                            selectedLoc.traffic_history || [
                              20, 45, 15, 60, 40, 25, 20, 50,
                            ]
                          ).map((val: number, i: number) => (
                            <View key={i} style={styles.barWrapper}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    height: Math.max(8, (val / 100) * 45),
                                    backgroundColor: getStatusColor(val),
                                  },
                                ]}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    </TourTarget>
                  )}

                  {/* Class meetings */}
                  {selectedLoc.classMeetings?.length ? (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Today's Schedule</Text>
                        <TouchableOpacity onPress={openScheduleList}>
                          <Text style={styles.seeAllText}>My Today</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.classMeetingList}>
                        {selectedLoc.classMeetings.slice(0, 3).map((meeting) => (
                          <View
                            key={meeting.id}
                            style={styles.classMeetingCard}
                          >
                            <View style={styles.classMeetingHeader}>
                              <Text style={styles.classMeetingCode}>
                                {meeting.code}
                              </Text>
                              <Text style={styles.classMeetingTime}>
                                {meeting.timeLabel}
                              </Text>
                            </View>
                            <Text style={styles.classMeetingName}>
                              {meeting.name}
                            </Text>
                            <Text style={styles.classMeetingMeta}>
                              {formatScheduleDays(meeting.days)}
                              {meeting.room ? ` · Room ${meeting.room}` : ""}
                            </Text>
                            <Text style={styles.classMeetingScheduleLabel}>
                              {meeting.scheduleLabel}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Reviews */}
                  <View style={styles.reviewsHeader}>
                    <Text style={styles.sectionTitle}>Reviews</Text>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                      <TouchableOpacity
                        onPress={openReviewComposer}
                      >
                        <Text style={styles.addReviewText}>
                          + Add Review
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setAllReviewsModalVisible(true);
                          if (selectedReviewId) fetchReviews(selectedReviewId, 30);
                        }}
                      >
                        <Text style={styles.seeAllText}>See all</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {reviews.length > 0 ? (
                    reviews.slice(0, 3).map((rev, i) => (
                      <View key={rev.id || i} style={styles.reviewItem}>
                        <View style={styles.reviewMeta}>
                          <View style={styles.reviewUserRow}>
                            <View style={styles.userAvatar}>
                              <Text style={styles.avatarText}>
                                {rev.user[0]}
                              </Text>
                            </View>
                            <Text style={styles.reviewUser}>{rev.user}</Text>
                          </View>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={11}
                                fill={s <= rev.rating ? "#FFD700" : "transparent"}
                                color={s <= rev.rating ? "#FFD700" : "#555"}
                              />
                            ))}
                          </View>
                        </View>
                        <Text style={styles.reviewComment} numberOfLines={3}>
                          {rev.comment}
                        </Text>
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            {rev.userId === user?.id ? (
                              <TouchableOpacity onPress={() => handleDeleteReview(rev)}>
                                <Trash2 size={14} color="#E56B6B" />
                              </TouchableOpacity>
                            ) : (
                              <>
                                <TouchableOpacity onPress={() => handleReportReview(rev)}>
                                  <Flag size={14} color="#888" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleBlockReviewer(rev)}>
                                  <Shield size={14} color="#888" />
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyReviews}>
                      <Text style={styles.emptyReviewsText}>
                        No reviews found for this location.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            ) : null}

            {!isPeekSheet && isDiningHallCard ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60, paddingTop: 12 }}
                scrollEventThrottle={16}
              >
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Menu</Text>
                </View>

                <View style={{ marginBottom: 16, flexDirection: 'row', gap: 24 }}>
                  {ALL_DINING_MEAL_PERIODS.map((period) => {
                    const isActive = activeDiningMealPeriod === period;
                    return (
                      <TouchableOpacity
                        key={period}
                        onPress={() => setActiveDiningMealPeriod(period)}
                        style={{
                          paddingBottom: 6,
                          borderBottomWidth: 2,
                          borderBottomColor: isActive ? COLORS.primary : 'transparent',
                        }}
                      >
                        <Text style={{
                          fontSize: 15,
                          fontWeight: isActive ? '700' : '600',
                          color: isActive ? COLORS.textPrimary : COLORS.textTertiary,
                        }}>
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {diningMenuPreview?.categories?.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingHorizontal: 18, paddingRight: 30 }}
                    style={{ marginBottom: 20, marginHorizontal: -18 }}
                  >
                    <TouchableOpacity
                      style={[
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          borderWidth: 1,
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          backgroundColor: COLORS.card,
                          borderColor: COLORS.border,
                        },
                        activeCategoryKey === "all" && {
                          borderWidth: 1.5,
                          borderColor: "transparent",
                          backgroundColor: "#E8EEF9",
                        },
                      ]}
                      onPress={() => {
                        setActiveCategoryKey("all");
                        const categoryNames = diningMenuPreview.categories.map((c: any) => c.name);
                        setCollapsedCategories(new Set(categoryNames));
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
                          activeCategoryKey === "all" && { color: "#4A6FA5", fontWeight: "800" },
                        ]}
                      >
                        All stations
                      </Text>
                    </TouchableOpacity>

                    {diningMenuPreview.categories.map((category: any) => (
                      <TouchableOpacity
                        key={category.name}
                        style={[
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            borderWidth: 1,
                            borderRadius: 999,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            backgroundColor: COLORS.card,
                            borderColor: COLORS.border,
                          },
                          activeCategoryKey === category.name && {
                            borderWidth: 1.5,
                            borderColor: "transparent",
                            backgroundColor: "#E8EEF9",
                          },
                        ]}
                        onPress={() => {
                          setActiveCategoryKey(category.name);
                          setCollapsedCategories(new Set());
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
                            activeCategoryKey === category.name && { color: "#4A6FA5", fontWeight: "800" },
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}

                {isFetchingDining ? (
                  <View style={{ paddingTop: 40, alignItems: "center" }}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                  </View>
                ) : !diningMenuPreview?.categories || diningMenuPreview.categories.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: "center" }}>
                    <Utensils size={32} color={COLORS.textTertiary} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.textSecondary }}>
                      No stations available right now
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textTertiary, marginTop: 6 }}>
                      Check another meal period.
                    </Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 0 }}>
                    {(diningMenuPreview?.categories || [])
                      .filter((c: any) => activeCategoryKey === "all" || c.name === activeCategoryKey)
                      .map((category: any) => {
                        const isAllSelected = activeCategoryKey === "all";
                        const isCollapsed = isAllSelected && collapsedCategories.has(category.name);
                        
                        return (
                          <View key={category.name} style={isAllSelected ? { marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 16, overflow: "hidden" } : {}}>
                            {isAllSelected && (
                              <TouchableOpacity
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  paddingHorizontal: 16,
                                  paddingVertical: 18,
                                }}
                                onPress={() => toggleCategory(category.name)}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.textPrimary }}>
                                  {category.name}
                                </Text>
                                {!isCollapsed ? (
                                  <ChevronUp size={20} color={COLORS.primary} />
                                ) : (
                                  <ChevronDown size={20} color={COLORS.primary} />
                                )}
                              </TouchableOpacity>
                            )}

                            {!isCollapsed && (
                              <View style={isAllSelected ? { paddingHorizontal: 16, paddingBottom: 16 } : {}}>
                                {category.items.map((item: any, idx: number) => (
                                  <View
                                    key={`${category.name}-${item.name}-${idx}`}
                                    style={{
                                      paddingVertical: 14,
                                      borderBottomWidth: idx === category.items.length - 1 ? 0 : 1,
                                      borderBottomColor: COLORS.border,
                                    }}
                                  >
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                      <View style={{ flex: 1, paddingRight: 12 }}>
                                        <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8, lineHeight: 20 }}>
                                          {item.name}
                                        </Text>
                                        <View style={{ flexDirection: "row", gap: 16 }}>
                                          <View>
                                            <Text style={{ fontSize: 9, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 2 }}>
                                              Energy
                                            </Text>
                                            <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textPrimary }}>
                                              {Math.round(item.calories || 0)} kcal
                                            </Text>
                                          </View>
                                          {item.protein ? (
                                            <View>
                                              <Text style={{ fontSize: 9, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 2 }}>
                                                Protein
                                              </Text>
                                              <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textPrimary }}>
                                                {Math.round(item.protein)}g
                                              </Text>
                                            </View>
                                          ) : null}
                                        </View>
                                      </View>
                                      {item.dietary?.includes("Vegetarian") || item.dietary?.includes("Vegan") ? (
                                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#E6EFDE", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                                          <Leaf size={13} color="#5B9A68" />
                                        </View>
                                      ) : null}
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </>
        ) : null}
      </Animated.View>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback
          onPress={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%", alignItems: "center" }}
            >
              <TouchableWithoutFeedback
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.reviewModalContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Rate {selectedLabel}</Text>
                    <TouchableOpacity
                      onPress={() => setReviewModalVisible(false)}
                    >
                      <X size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setNewRating(s);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                        }}
                        style={styles.starTouch}
                      >
                        <Star
                          size={38}
                          fill={s <= newRating ? "#FFD700" : "transparent"}
                          color={s <= newRating ? "#FFD700" : "#333"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Sharing your experience helps other Aggies..."
                      placeholderTextColor="#555"
                      multiline
                      value={newReviewText}
                      onChangeText={setNewReviewText}
                      maxLength={500}
                    />
                    <Text style={styles.charCount}>
                      {newReviewText.length}/500
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.premiumPostBtn,
                      (!newReviewText.trim() || newRating === 0) && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handlePostReview}
                    disabled={
                      !newReviewText.trim() ||
                      newRating === 0 ||
                      isPostingReview
                    }
                  >
                    <View style={styles.btnContent}>
                      {isPostingReview ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.premiumPostBtnText}>
                          Post Review
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Full Reviews Modal */}
      <Modal
        visible={allReviewsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAllReviewsModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setAllReviewsModalVisible(false)}
        >
          <View style={styles.fullReviewsOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.fullReviewsContainer}>
                <View style={styles.dragHandle} />
                <View style={styles.fullReviewsHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fullReviewsTitle}>User Reviews</Text>
                    <Text style={styles.fullReviewsSubtitle}>{selectedLabel}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAllReviewsModalVisible(false)}
                    style={styles.backBtn}
                  >
                    <X size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {isFetchingReviews ? (
                  <View style={styles.fullReviewsLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.fullReviewsLoadingText}>
                      Loading reviews...
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.fullReviewsScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {reviews.length > 0 ? (
                      reviews.map((rev, i) => (
                        <View key={i} style={styles.reviewItem}>
                          <View style={styles.reviewMeta}>
                            <Text style={styles.reviewUser}>{rev.user}</Text>
                            <View style={styles.reviewStars}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={11}
                                  fill={
                                    s <= rev.rating ? "#FFD700" : "transparent"
                                  }
                                  color={s <= rev.rating ? "#FFD700" : "#444"}
                                />
                              ))}
                            </View>
                          </View>
                          <Text style={styles.reviewComment}>{rev.comment}</Text>
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                {rev.userId === user?.id ? (
                                    <TouchableOpacity onPress={() => handleDeleteReview(rev)}>
                                        <Trash2 size={14} color="#E56B6B" />
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity onPress={() => handleReportReview(rev)}>
                                            <Flag size={14} color="#888" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleBlockReviewer(rev)}>
                                            <Shield size={14} color="#888" />
                                        </TouchableOpacity>
                                    </>
                                )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyReviews}>
                        <Text style={styles.emptyReviewsText}>
                          No reviews found for this location.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
