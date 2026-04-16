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
  StyleSheet,
} from "react-native";
import {
  X,
  ExternalLink,
  Calendar,
  ChevronRight,
  Utensils,
  Star,
  Navigation,
  MapPin,
  Flag,
  Shield,
  Trash2,
  ChevronUp,
  ChevronDown,
  Leaf,
  Clock,
  Activity,
} from "lucide-react-native";
import { useUser } from "@clerk/clerk-expo";
import { PillTabs } from "../PillTabs";
import { ALL_DINING_MEAL_PERIODS } from "../../services/diningMenuCache";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import type { CampusLocation, FacilityCountEntry } from "./types";
import { SHEET_BOTTOM_OFFSET, SCREEN_HEIGHT } from "./types";
import {
  getStatusColor,
  formatScheduleDays,
  getLocationContextLink,
} from "./utils";
import { getCanonicalLocationName, getLiveHoursForFacility } from "./campusData";
import { getStaticRestaurantMenu } from "../../data/restaurantMenus";
import { getRestaurantHoursToday } from "../../data/restaurantHours";
import {
  DiningMealPeriod,
  isDiningHallMenuLocation,
} from "../../services/diningMenuCache";
import { Alert } from "react-native";

import { ClassMeetingCard } from "./ClassMeetingCard";
import { OccupancyChart } from "./OccupancyChart";

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
    case "Academic": return "academic";
    case "Library": return "library";
    case "Dining": return "dining";
    case "Rec": return "recreation";
    case "Housing": return "housing";
    case "Athletics": return "athletics";
    case "General": return "general";
    default: return "landmark";
  }
}

function getOccupancyLabel(percentFull: number) {
  if (percentFull >= 80) return "Busy";
  if (percentFull >= 55) return "Steady";
  if (percentFull >= 30) return "Moderate";
  return "Light";
}

function parseLiveTimestamp(value?: string | null) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLiveTimestamp(value?: string | null) {
  const parsed = parseLiveTimestamp(value);
  if (!parsed) return null;
  return parsed.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const ClassMeetingList = React.memo(({ meetings }: { meetings: any[] | null | undefined }) => {
  if (!meetings?.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      {meetings.slice(0, 3).map((meeting) => (
        <ClassMeetingCard key={meeting.id} meeting={meeting} />
      ))}
    </View>
  );
});

interface LocationBottomSheetProps {
  styles: any;
  COLORS: any;
  isDark: boolean;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  selectedLoc: CampusLocation | undefined;
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
  openScheduleList: () => void;
  selectedRecreationFacility: any | null;
  recreationFacilityMap: Map<string, any>;
  openFacilityCounts: (loc: CampusLocation) => void;
  navigation: any;
  getPlaceExternalLink: (location: CampusLocation) => { label: string; url: string };
  selectedStop: any;
  selectedBus: any;
  openNavigationToLocation?: (loc: CampusLocation, mode?: "walk" | "drive" | "bus") => void;
  isFetchingDetail?: boolean;
}

export function LocationBottomSheet({
  styles, COLORS, isDark, selectedId, setSelectedId, selectedLoc,
  foodCourtVenues, diningMenuOptions, activeDiningMenu, setActiveDiningMenu,
  activeDiningMealPeriod, setActiveDiningMealPeriod, diningMenuPreview,
  isFetchingDining, isPrimaryDiningHallSelection, openFullMenu, openScheduleList,
  selectedRecreationFacility, recreationFacilityMap, openFacilityCounts,
  navigation, getPlaceExternalLink, selectedStop, selectedBus, openNavigationToLocation,
  isFetchingDetail,
}: LocationBottomSheetProps) {
  const { advanceStep, activeTargetName } = useTour();
  const sheetY = useRef(new Animated.Value(SHEET_HIDDEN_SNAP)).current;
  const sheetSnap = useRef<number>(SHEET_HIDDEN_SNAP);
  const panStartY = useRef<number>(SHEET_HIDDEN_SNAP);
  const [sheetMode, setSheetMode] = useState<SheetMode>("hidden");
  const [diningDetailTab, setDiningDetailTab] = useState<"menus">("menus");
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

  const animateSheet = useCallback((toValue: number, onDone?: () => void) => {
    sheetSnap.current = toValue;
    setSheetMode(getSheetModeForSnap(toValue));
    Animated.spring(sheetY, {
      toValue, useNativeDriver: true, damping: 30, stiffness: 260, mass: 0.9,
    }).start(() => { if (onDone) onDone(); });
  }, [sheetY]);

  useEffect(() => {
    if (selectedId) {
      animateSheet(
        selectedLoc && isDiningHallMenuLocation(selectedLoc.location) && isPrimaryDiningHallSelection
          ? SHEET_DINING_HALL_SNAP : SHEET_MID_SNAP
      );
    } else {
      animateSheet(SHEET_HIDDEN_SNAP);
    }
  }, [selectedId, animateSheet, isPrimaryDiningHallSelection, selectedLoc?.location]);

  const isDiningHallCard = !!selectedLoc && isDiningHallMenuLocation(selectedLoc.location) && isPrimaryDiningHallSelection;
  const isFoodCourtHub = foodCourtVenues.length > 0;
  const isDiningMenuExperience = isDiningHallCard || isFoodCourtHub;
  const preferredExpandedSnap = isDiningHallCard ? SHEET_DINING_HALL_SNAP : SHEET_MID_SNAP;
  const isPeekSheet = sheetMode === "peek";
  const isParking = selectedLoc?.type === "Parking";
  const isVisitorGarage = isParking && (
    selectedLoc?.placeId === "osm:way:91100311" || 
    selectedLoc?.placeId === "garage-polo" || 
    selectedLoc?.placeId === "osm:way:450686873" || 
    selectedLoc?.placeId === "garage-university-center" || 
    selectedLoc?.placeId === "garage-west-campus"
  );
  const isCapacityPlace = (selectedLoc?.type === "Library" || selectedLoc?.type === "Rec") && 
                         !selectedLoc?.location?.includes("Bush");
  
  const hasLiveParking = isVisitorGarage && selectedLoc?.visitor_parking_available != null;
  const hasLiveOccupancy = isCapacityPlace && selectedLoc?.percent_full != null && selectedLoc?.is_live;
  const hasAnyLiveData = hasLiveParking || hasLiveOccupancy;

  const occupancyPercent = selectedLoc ? Math.max(0, Math.min(100, 
    selectedLoc.capacity && selectedLoc.capacity > 0 && selectedLoc.current_count != null
    ? Math.round((selectedLoc.current_count / selectedLoc.capacity) * 100)
    : Number.isFinite(selectedLoc.percent_full) ? selectedLoc.percent_full : 0
  )) : 0;
  const occupancyToneColor = selectedLoc ? getStatusColor(occupancyPercent) : COLORS.primary;

  const shouldHideCapacityOnCard = useMemo(() => {
    if (!selectedLoc) return false;
    const name = selectedLoc.location;
    const short = selectedLoc.shortName;
    return (
      name === "PEAP" || 
      name === "Aquatics" || 
      name === "Penberthy Rec Sports Complex-Tennis" ||
      name === "Tennis Courts" ||
      short === "PEAP" ||
      short === "PENBERTHY" ||
      short === "AQUATICS"
    );
  }, [selectedLoc]);

  const peekMetaText = useMemo(() => {
    if (!selectedLoc) return "";
    if (isFetchingDetail && !hasAnyLiveData && isVisitorGarage) return "Loading..."; 
    if (hasLiveParking) return `Visitor: ${selectedLoc.visitor_parking_available.toLocaleString()} spaces (live)`;
    if (isCapacityPlace && !shouldHideCapacityOnCard) return `${occupancyPercent}% full`;
    
    const dynamicHours = getLiveHoursForFacility(selectedLoc.location);
    if (dynamicHours) return dynamicHours;

    if (selectedLoc.hours_today) return selectedLoc.hours_today;
    if (isFoodCourtHub) return `${foodCourtVenues.length} locations`;
    return selectedLoc.type || "";
  }, [foodCourtVenues.length, hasAnyLiveData, isCapacityPlace, isFetchingDetail, isParking, hasLiveParking, occupancyPercent, selectedLoc, shouldHideCapacityOnCard]);

  const externalLink = useMemo(() => (selectedLoc ? getPlaceExternalLink(selectedLoc) : null), [getPlaceExternalLink, selectedLoc]);
  const heroMetaText = useMemo(() => {
    if (!selectedLoc) return "";
    const bits: string[] = [];
    if (selectedLoc.address) bits.push(selectedLoc.address);
    
    // Check for dynamic rec hours first
    const dynamicHours = getLiveHoursForFacility(selectedLoc.location);
    if (dynamicHours) {
        bits.push(dynamicHours);
    } else if (selectedLoc.hours_today) {
        bits.push(selectedLoc.hours_today);
    }
    
    return bits.filter(Boolean).slice(0, 2).join(" • ");
  }, [selectedLoc]);

  const handleNavigatePress = () => {
    if (!selectedLoc) return;
    if (openNavigationToLocation) { openNavigationToLocation(selectedLoc); return; }
    navigation.navigate("CampusNavigation", {
      initialDestination: {
        id: selectedLoc.location, name: selectedLoc.location, shortName: selectedLoc.shortName || selectedLoc.location,
        latitude: selectedLoc.coord.lat, longitude: selectedLoc.coord.lng, type: getNavigationPlaceType(selectedLoc.type),
      },
    });
  };

  const handleExternalLinkPress = () => {
    if (!selectedLoc || !externalLink) return;
    Linking.openURL(externalLink.url).catch(() => {});
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
    onPanResponderGrant: () => { panStartY.current = sheetSnap.current; sheetY.stopAnimation(); },
    onPanResponderMove: (_, { dy }) => {
      const next = Math.max(SHEET_TOP_SNAP, Math.min(SHEET_HIDDEN_SNAP, panStartY.current + dy));
      sheetY.setValue(next);
    },
    onPanResponderRelease: (_, { dy, vy }) => {
      const liveY = panStartY.current + dy;
      const snapPoints = [SHEET_TOP_SNAP, preferredExpandedSnap, SHEET_PEEK_SNAP, SHEET_HIDDEN_SNAP];
      const currentIndex = snapPoints.reduce((bestIndex, point, index) => {
        const bestDistance = Math.abs(snapPoints[bestIndex] - sheetSnap.current);
        const nextDistance = Math.abs(point - sheetSnap.current);
        return nextDistance < bestDistance ? index : bestIndex;
      }, 0);
      if (vy < -1.0) { animateSheet(snapPoints[Math.max(0, currentIndex - 1)]); return; }
      if (vy > 1.0) {
        const nextSnap = snapPoints[Math.min(snapPoints.length - 1, currentIndex + 1)];
        if (nextSnap === SHEET_HIDDEN_SNAP) animateSheet(SHEET_HIDDEN_SNAP, () => setSelectedId(null));
        else animateSheet(nextSnap);
        return;
      }
      const topMidThreshold = (SHEET_TOP_SNAP + preferredExpandedSnap) / 2;
      const midPeekThreshold = (preferredExpandedSnap + SHEET_PEEK_SNAP) / 2;
      const peekHiddenThreshold = (SHEET_PEEK_SNAP + SHEET_HIDDEN_SNAP) / 2;
      if (liveY >= peekHiddenThreshold) animateSheet(SHEET_HIDDEN_SNAP, () => setSelectedId(null));
      else if (liveY >= midPeekThreshold) animateSheet(SHEET_PEEK_SNAP);
      else if (liveY >= topMidThreshold) animateSheet(preferredExpandedSnap);
      else animateSheet(SHEET_TOP_SNAP);
    },
  }), [animateSheet, preferredExpandedSnap, setSelectedId, sheetY]);

  if (!selectedId || selectedStop || selectedBus) return null;

  return (
    <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]} {...panResponder.panHandlers}>
      <View style={styles.dragHandle} />
      {selectedLoc && (
        <>
          <View style={[styles.heroCard, isPeekSheet && styles.heroCardPeek]}>
            <View style={[styles.heroHeadingRow, isPeekSheet && styles.heroHeadingRowPeek]}>
              <View style={styles.heroHeadingText}>
                <Text style={[styles.locationName, isPeekSheet ? styles.locationNamePeek : styles.locationNameExpanded]} numberOfLines={isPeekSheet ? 1 : 3}>
                  {selectedLoc.location}
                </Text>
                {((isPeekSheet ? peekMetaText : heroMetaText) || "").length ? (
                  <Text style={[styles.heroMetaText, isPeekSheet && styles.heroMetaTextPeek]} numberOfLines={1}>
                    {isPeekSheet ? peekMetaText : heroMetaText}
                  </Text>
                ) : null}
              </View>
              {!isPeekSheet ? (
                <TouchableOpacity onPress={() => setSelectedId(null)} hitSlop={12} style={styles.dismissBtn}>
                  <X size={16} color="#888" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => animateSheet(preferredExpandedSnap)} style={styles.peekPrimaryAction}>
                  <ChevronRight size={18} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            {!isPeekSheet && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.quickActionRow}
              >
                <TouchableOpacity style={styles.quickActionPill} onPress={handleNavigatePress}>
                  <Navigation size={14} color={COLORS.textPrimary} /><Text style={styles.quickActionText}>Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionPill} onPress={() => {
                  const url = Platform.select({
                    ios: `maps:0,0?q=${selectedLoc.location}@${selectedLoc.coord.lat},${selectedLoc.coord.lng}`,
                    android: `geo:0,0?q=${selectedLoc.coord.lat},${selectedLoc.coord.lng}(${selectedLoc.location})`
                  });
                  if (url) Linking.openURL(url);
                }}>
                  <MapPin size={14} color={COLORS.textPrimary} /><Text style={styles.quickActionText}>Google Maps</Text>
                </TouchableOpacity>
                {selectedLoc.type === "Rec" && (
                  <TouchableOpacity style={styles.quickActionPill} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openFacilityCounts(selectedLoc); }}>
                    <Activity size={14} color={COLORS.textPrimary} /><Text style={styles.quickActionText}>Live Facility Counts</Text>
                  </TouchableOpacity>
                )}
                {externalLink && (
                  <TouchableOpacity style={styles.quickActionPill} onPress={handleExternalLinkPress}>
                    <ExternalLink size={14} color={COLORS.textPrimary} /><Text style={styles.quickActionText}>{externalLink.label}</Text>
                  </TouchableOpacity>
                )}
                {isDiningHallCard && activeDiningMenu && (
                  <TouchableOpacity style={styles.quickActionPill} onPress={() => openFullMenu(activeDiningMenu, activeDiningMealPeriod)}>
                    <Utensils size={14} color={COLORS.textPrimary} /><Text style={styles.quickActionText}>Menus</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>

          {isFetchingDetail && !hasAnyLiveData && isVisitorGarage ? (
             <View style={{ paddingVertical: 80, alignItems: 'center', justifyContent: 'center' }}>
               <ActivityIndicator color={COLORS.primary} size="large" />
               <Text style={{ marginTop: 16, color: COLORS.textTertiary, fontSize: 13, fontWeight: '600' }}>Fetching live data...</Text>
             </View>
          ) : !isPeekSheet && !isDiningHallCard && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} scrollEventThrottle={16}>
              {isFoodCourtHub ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.sectionTitle}>Inside this Food Court</Text>
                  <View style={styles.foodCourtVenueList}>
                    {foodCourtVenues.map((venue, idx) => (
                      <View key={`${venue.selectionId}-${idx}`} style={styles.foodCourtVenueCard}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={styles.foodCourtVenueTitle}>{venue.label}</Text>
                          <Text style={styles.foodCourtVenueMeta}>{getRestaurantHoursToday(venue.label) || "Dining location"}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openFullMenu(venue.menuCandidate || venue.location.location)} style={styles.foodCourtVenueMenuBtn}>
                          <Utensils size={11} color="#FFF" /><Text style={styles.foodCourtVenueMenuBtnText}>Menu</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <>
                  {isParking && hasLiveParking && (
                    <View style={styles.infoBlock}>
                      <View style={styles.occupancySummaryRow}>
                        <Text style={styles.occupancyLiveLabel}>Visitor Parking</Text>
                        <Text style={[styles.occupancyLiveText, { color: COLORS.primary }]}>{selectedLoc.visitor_parking_available?.toLocaleString()} spaces</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                         <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#32D74B' }} />
                         <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>Real-time available</Text>
                        {selectedLoc.visitor_parking_as_of && (
                          <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, marginLeft: 'auto' }}>
                            Updated {formatLiveTimestamp(selectedLoc.visitor_parking_as_of)}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                  {isCapacityPlace && !shouldHideCapacityOnCard && hasLiveOccupancy && (
                    <View style={styles.infoBlock}>
                      <View style={styles.occupancySummaryRow}>
                        <Text style={styles.occupancyLiveLabel}>Live Occupancy</Text>
                        <Text style={[styles.occupancyLiveText, { color: occupancyToneColor }]}>{occupancyPercent}%</Text>
                      </View>
                      <View style={styles.occupancyTrack}>
                        <View style={[styles.occupancyFill, { width: `${occupancyPercent}%`, backgroundColor: occupancyToneColor }]} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Activity size={10} color={COLORS.textTertiary} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }}>
                               {selectedLoc.type === "Rec" && selectedLoc.facility_counts?.length 
                                 ? `${selectedLoc.facility_counts.filter(f => !f.is_closed).length} of ${selectedLoc.facility_counts.length} areas open`
                                 : getOccupancyLabel(occupancyPercent)
                               }
                            </Text>
                         </View>
                         {(selectedLoc.capacity_last_updated || selectedLoc.capacity_as_of) && (
                          <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, opacity: 0.8 }}>
                            Updated {formatLiveTimestamp(selectedLoc.capacity_last_updated || selectedLoc.capacity_as_of)}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                  {isCapacityPlace && !shouldHideCapacityOnCard && hasLiveOccupancy && (
                    <TourTarget name="rec-center-capacity">
                      <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Foot Traffic · Last 8h</Text>
                        <OccupancyChart history={selectedLoc.traffic_history} />
                      </View>
                    </TourTarget>
                  )}
                  {selectedLoc.classMeetings?.length ? (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Today's Schedule</Text>
                        <TouchableOpacity onPress={openScheduleList}><Text style={styles.seeAllText}>My Today</Text></TouchableOpacity>
                      </View>
                      <ClassMeetingList meetings={selectedLoc.classMeetings} />
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}

          {isDiningHallCard && !isPeekSheet && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 12 }}>
              <View style={{ marginBottom: 12 }}><Text style={styles.sectionTitle}>Menu</Text></View>
              <View style={{ marginBottom: 16, flexDirection: 'row', gap: 24 }}>
                {ALL_DINING_MEAL_PERIODS.map((period) => {
                  const isActive = activeDiningMealPeriod === period;
                  return (
                    <TouchableOpacity key={period} onPress={() => setActiveDiningMealPeriod(period)} style={{ paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: isActive ? COLORS.primary : 'transparent' }}>
                      <Text style={{ fontSize: 15, fontWeight: isActive ? '700' : '600', color: isActive ? COLORS.textPrimary : COLORS.textTertiary }}>
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {diningMenuPreview?.categories?.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 18, paddingRight: 30 }} style={{ marginBottom: 20, marginHorizontal: -18 }}>
                  <TouchableOpacity style={[{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.card, borderColor: COLORS.border }, activeCategoryKey === "all" && { borderWidth: 1.5, borderColor: "transparent", backgroundColor: "#E8EEF9" }]} onPress={() => { setActiveCategoryKey("all"); const categoryNames = diningMenuPreview.categories.map((c: any) => c.name); setCollapsedCategories(new Set(categoryNames)); }} activeOpacity={0.8}>
                    <Text style={[{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary }, activeCategoryKey === "all" && { color: "#4A6FA5", fontWeight: "800" }]}>All stations</Text>
                  </TouchableOpacity>
                  {diningMenuPreview.categories.map((category: any) => (
                    <TouchableOpacity key={category.name} style={[{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.card, borderColor: COLORS.border }, activeCategoryKey === category.name && { borderWidth: 1.5, borderColor: "transparent", backgroundColor: "#E8EEF9" }]} onPress={() => { setActiveCategoryKey(category.name); setCollapsedCategories(new Set()); }} activeOpacity={0.8}>
                      <Text style={[{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary }, activeCategoryKey === category.name && { color: "#4A6FA5", fontWeight: "800" }]}>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
              {isFetchingDining ? (
                <View style={{ paddingTop: 40, alignItems: "center" }}><ActivityIndicator color={COLORS.primary} size="large" /></View>
              ) : !diningMenuPreview?.categories || diningMenuPreview.categories.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}><Utensils size={32} color={COLORS.textTertiary} style={{ marginBottom: 12, opacity: 0.5 }} /><Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.textSecondary }}>No stations available right now</Text></View>
              ) : (
                <View style={{ paddingHorizontal: 0 }}>
                  {(diningMenuPreview?.categories || []).filter((c: any) => activeCategoryKey === "all" || c.name === activeCategoryKey).map((category: any) => {
                    const isAllSelected = activeCategoryKey === "all";
                    const isCollapsed = isAllSelected && collapsedCategories.has(category.name);
                    return (
                      <View key={category.name} style={isAllSelected ? { marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 16, overflow: "hidden" } : {}}>
                        {isAllSelected && (
                          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 18 }} onPress={() => toggleCategory(category.name)} activeOpacity={0.7}>
                            <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.textPrimary }}>{category.name}</Text>
                            {!isCollapsed ? <ChevronUp size={20} color={COLORS.primary} /> : <ChevronDown size={20} color={COLORS.primary} />}
                          </TouchableOpacity>
                        )}
                        {!isCollapsed && (
                          <View style={isAllSelected ? { paddingHorizontal: 16, paddingBottom: 16 } : {}}>
                            {category.items.map((item: any, idx: number) => (
                              <View key={`${category.name}-${item.name}-${idx}`} style={{ paddingVertical: 14, borderBottomWidth: idx === category.items.length - 1 ? 0 : 1, borderBottomColor: COLORS.border }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8, lineHeight: 20 }}>{item.name}</Text>
                                    <View style={{ flexDirection: "row", gap: 16 }}>
                                      <View><Text style={{ fontSize: 9, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 2 }}>Energy</Text><Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textPrimary }}>{Math.round(item.calories || 0)} kcal</Text></View>
                                      {item.protein ? <View><Text style={{ fontSize: 9, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 2 }}>Protein</Text><Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textPrimary }}>{Math.round(item.protein)}g</Text></View> : null}
                                    </View>
                                  </View>
                                  {(item.dietary?.includes("Vegetarian") || item.dietary?.includes("Vegan")) && (
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#E6EFDE", alignItems: "center", justifyContent: "center", marginTop: 2 }}><Leaf size={13} color="#5B9A68" /></View>
                                  )}
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
          )}
        </>
      )}
    </Animated.View>
  );
}
