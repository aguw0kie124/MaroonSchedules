import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
} from "react-native";
import { ChevronRight, Calendar, Plus, Menu, ChevronLeft, Navigation, Maximize2, Minimize2, Share2 } from "lucide-react-native";
import { ShareContent } from "../../store/shareStore";
import { Card } from "../SharedUI";
import type { CampusLocation } from "./types";
import { SCREEN_HEIGHT } from "./types";
import type { ScheduleMapOption } from "./types";
import {
  getCategoryIcon,
  getDistanceLabel,
  getParkingRecommendation,
  haversineDistanceMeters,
} from "./utils";
import { getCanonicalLocationName } from "./campusData";
import { TodayTimeline } from "./TodayTimeline";

interface PlacesListProps {
  styles: any;
  COLORS: any;
  activeLayer: string;
  selectedId: string | null;
  sortedFilteredLocations: CampusLocation[];
  scheduleOptions: ScheduleMapOption[];
  activeScheduleOption: ScheduleMapOption | null;
  scheduleSummaryLabel: string;
  isLoadingSchedules: boolean;
  setActiveScheduleId: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  openScheduleList: () => void;
  openNewCourseSearch: () => void;
  userCoord: { latitude: number; longitude: number } | null;
  parkingPermit: any;
  recreationFacilityMap: Map<string, any>;
  handleSelectLocation: (loc: CampusLocation) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  nextEntry: any;
  activeWalkingRoute?: any;
  isTodayExpanded?: boolean;
  setIsTodayExpanded?: (expanded: boolean) => void;
  onShare?: (content: ShareContent) => void;
  openNavigationToLocation?: (loc: CampusLocation, mode?: "walk" | "bus") => void;
}

export function PlacesList({
  styles,
  COLORS,
  activeLayer,
  selectedId,
  sortedFilteredLocations,
  scheduleOptions,
  activeScheduleOption,
  scheduleSummaryLabel,
  isLoadingSchedules,
  setActiveScheduleId,
  setSelectedId,
  openScheduleList,
  openNewCourseSearch,
  userCoord,
  parkingPermit,
  recreationFacilityMap,
  handleSelectLocation,
  selectedDate,
  setSelectedDate,
  nextEntry,
  activeWalkingRoute,
  isTodayExpanded,
  setIsTodayExpanded,
  onShare,
  openNavigationToLocation,
}: PlacesListProps) {
  const isTodayLayer = activeLayer === "Today";
  const shouldShowSheet =
    !selectedId && (isTodayLayer || activeLayer === "Bus" || activeLayer === "Heatmap" || sortedFilteredLocations.length > 0);

  // Keep the sheet docked lower so the map remains the main workspace.
  const sheetHeight = Math.min(Math.round(SCREEN_HEIGHT * 0.52), 470);
  const collapsedHeight = activeLayer === "Today" ? 230 : 110;
  const collapsedTranslateY = Math.max(sheetHeight - collapsedHeight, 0);
  const translateY = useRef(new Animated.Value(collapsedTranslateY)).current;
  const sheetSnap = useRef(collapsedTranslateY);
  const panStartY = useRef(collapsedTranslateY);
  const [isExpanded, setIsExpanded] = useState(false);

  const animateSheet = useCallback(
    (toValue: number) => {
      sheetSnap.current = toValue;
      setIsExpanded(toValue === 0);
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        damping: 30,
        stiffness: 260,
        mass: 0.9,
      }).start();
    },
    [translateY],
  );

  useEffect(() => {
    if (!shouldShowSheet) {
      return;
    }
    setIsExpanded(false);
    animateSheet(collapsedTranslateY);
  }, [activeLayer, animateSheet, collapsedTranslateY, shouldShowSheet]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const formatDate = (date: Date) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          panStartY.current = sheetSnap.current;
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, { dy }) => {
          const next = Math.max(0, Math.min(collapsedTranslateY, panStartY.current + dy));
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          const liveY = panStartY.current + dy;

          if (vy < -0.7 || liveY < collapsedTranslateY * 0.55) {
            animateSheet(0);
            return;
          }

          if (vy > 0.7 || liveY >= collapsedTranslateY * 0.55) {
            animateSheet(collapsedTranslateY);
          }
        },
      }),
    [animateSheet, collapsedTranslateY, translateY],
  );

  const getSheetTitle = () => {
    if (activeLayer === "Today") return "Today's Schedule";
    if (activeLayer === "Dining") return "Dining Places";
    if (activeLayer === "Academic") return "Academic Places";
    if (activeLayer === "Study") return "Study Spots";
    if (activeLayer === "Library") return "Libraries";
    if (activeLayer === "Rec") return "Gyms and Rec";
    if (activeLayer === "Parking") return "Parking";
    return `${activeLayer} Places`;
  };

  const getSheetSubtitle = () => {
    if (activeLayer === "Today") return null;
    return `${sortedFilteredLocations.length} place${sortedFilteredLocations.length === 1 ? "" : "s"} in this view.`;
  };

  const renderTodayHeader = () => {
    if (activeLayer !== "Today") return null;
    return (
      <View style={styles.dateNavHeader}>
        <TouchableOpacity style={styles.dateNavArrow} onPress={handlePrevDay}>
          <ChevronLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.dateNavTitleContainer}>
          <Text style={styles.dateNavTitle}>{formatDate(selectedDate)}</Text>
        </View>
        <TouchableOpacity style={styles.dateNavArrow} onPress={handleNextDay}>
          <ChevronRight size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        {setIsTodayExpanded && (
          <TouchableOpacity
            style={[styles.dateNavArrow, { marginLeft: 8 }]}
            onPress={() => setIsTodayExpanded(!isTodayExpanded)}
          >
            {isTodayExpanded ? (
              <Minimize2 size={20} color={COLORS.textPrimary} />
            ) : (
              <Maximize2 size={20} color={COLORS.textPrimary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderScheduleCard = () => {
    if (activeLayer !== "Today") return null;

    if (!isTodayExpanded && nextEntry) {
      const travelLabel = activeWalkingRoute
        ? `Get Directions (${activeWalkingRoute.estimatedTimeMinutes} min)`
        : "Get Directions";

      return (
        <View style={styles.nextUpCard}>
          <View style={styles.nextUpMainRow}>
            <View style={styles.nextUpTimeBox}>
              <Text style={styles.nextUpTimeText}>{nextEntry.timeLabel}</Text>
            </View>
            <View style={styles.nextUpContent}>
              <Text style={styles.nextUpTitle} numberOfLines={1}>{nextEntry.name}</Text>
              <Text style={styles.nextUpLocation} numberOfLines={1}>{nextEntry.locationLabel}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                style={styles.nextUpDirectionsPill}
                onPress={() => {
                  if (openNavigationToLocation && nextEntry) {
                    const loc = sortedFilteredLocations.find((l: any) =>
                      l.location === nextEntry.building ||
                      l.shortName === nextEntry.building ||
                      l.location.includes(nextEntry.building)
                    );

                    if (loc) {
                      openNavigationToLocation(loc);
                    } else {
                      openNavigationToLocation({
                        location: nextEntry.building,
                        type: "Building",
                        coord: (nextEntry as any).lat ? { lat: (nextEntry as any).lat, lng: (nextEntry as any).lng } : { lat: 30.6181, lng: -96.3365 }
                      } as any);
                    }
                  }
                }}
              >
                <Navigation size={14} color="#FFFFFF" />
                <Text style={styles.nextUpDirectionsPillText}>Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextUpShareIcon}
                onPress={() => onShare?.({
                  title: nextEntry.name,
                  message: `Heading to ${nextEntry.name} at ${nextEntry.locationLabel}!`,
                  url: "https://maroonschedules.tamu.edu"
                })}
              >
                <Share2 size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    if (!isTodayExpanded && !nextEntry) {
      return (
        <View style={styles.placesSheetCollapsedBody}>
          <View style={styles.placesSheetCollapsedSummary}>
            <Text style={styles.placesSheetCollapsedSummaryTitle}>All done for today!</Text>
            <Text style={styles.placesSheetCollapsedSummaryMeta}>Nothing else in your schedule</Text>
          </View>
        </View>
      );
    }

    const handleTimelineGetDirections = (building: string) => {
      if (!openNavigationToLocation) return;

      // Try to find full location data
      const loc = sortedFilteredLocations.find(l =>
        l.location === building ||
        l.shortName === building ||
        l.location.includes(building)
      );

      if (loc) {
        openNavigationToLocation(loc);
      } else {
        // Fallback with minimal info
        openNavigationToLocation({
          location: building,
          type: "Building",
          coord: (nextEntry && (nextEntry as any).lat) ? { lat: (nextEntry as any).lat, lng: (nextEntry as any).lng } : { lat: 30.6181, lng: -96.3365 }
        } as any);
      }
    };

    return (
      <TodayTimeline
        styles={styles}
        COLORS={COLORS}
        activeScheduleOption={activeScheduleOption}
        onGetDirections={handleTimelineGetDirections}
      />
    );
  };

  const renderPlaceCard = (loc: CampusLocation, compact = false) => {
    const distanceMeters = userCoord
      ? haversineDistanceMeters(
        userCoord.latitude,
        userCoord.longitude,
        loc.coord.lat,
        loc.coord.lng,
      )
      : null;
    const parkingRecommendation =
      loc.type === "Parking"
        ? getParkingRecommendation(loc.location, parkingPermit)
        : null;
    const recreationFacility =
      recreationFacilityMap.get(getCanonicalLocationName(loc.location)) || null;
    const primaryMeta = loc.classMeetings?.length
      ? `${loc.classMeetings.length} class${loc.classMeetings.length === 1 ? "" : "es"}`
      : loc.type === "Rec" || loc.type === "Library"
        ? `${loc.percent_full != null ? `${loc.percent_full}% full` : loc.hours || recreationFacility?.today_hours || recreationFacility?.hours_hint || "Hours available"}`
        : loc.hours || loc.type;
    const secondaryMeta =
      loc.type === "Parking"
        ? parkingRecommendation?.badge || null
        : loc.percent_full != null &&
          (loc.type === "Library" || loc.type === "Rec")
          ? `${loc.percent_full}% full`
          : loc.type;
    const statusChips: string[] = [];

    if (loc.classMeetings?.length) {
      statusChips.push("Today's events");
    }
    if (loc.hours) {
      statusChips.push("Open");
    }
    if (
      loc.percent_full != null &&
      (loc.type === "Library" || loc.type === "Rec")
    ) {
      statusChips.push(
        loc.percent_full >= 80
          ? "Busy"
          : loc.percent_full >= 45
            ? "Moderate"
            : "Light",
      );
    }
    if (loc.type === "Parking" && parkingRecommendation?.badge) {
      statusChips.push(parkingRecommendation.badge);
    }

    return (
      <Card key={`list-${loc.location}`} style={[styles.placesSheetItemCard, compact && styles.placesSheetItemCardCompact]}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.placesSheetItemPressable}
          onPress={() => handleSelectLocation(loc)}
        >
          <View style={styles.placesSheetItemIcon}>
            {React.cloneElement(
              getCategoryIcon(loc.type) as React.ReactElement<any>,
              {
                size: compact ? 16 : 18,
                color: "#F3F1ED",
              },
            )}
          </View>
          <View style={styles.placesSheetItemBody}>
            <View style={styles.placesSheetItemTagRow}>
              <View style={styles.placesSheetItemTag}>
                <Text style={styles.placesSheetItemTagText}>{loc.type}</Text>
              </View>
              {secondaryMeta && secondaryMeta !== loc.type ? (
                <Text style={styles.placesSheetItemTagMeta} numberOfLines={1}>
                  {secondaryMeta}
                </Text>
              ) : null}
            </View>
            <View style={styles.placesSheetItemHeader}>
              <Text style={styles.placesSheetItemTitle} numberOfLines={1}>
                {loc.location}
              </Text>
              <Text style={styles.placesSheetItemDistance}>
                {getDistanceLabel(distanceMeters)}
              </Text>
            </View>
            <Text style={styles.placesSheetItemMeta} numberOfLines={compact ? 1 : 2}>
              {primaryMeta}
            </Text>
            {statusChips.length ? (
              <View style={styles.placesSheetItemStatusRow}>
                {statusChips.slice(0, 3).map((chip) => (
                  <View key={`${loc.location}-${chip}`} style={styles.placesSheetItemStatusChip}>
                    <Text style={styles.placesSheetItemStatusChipText}>{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {parkingRecommendation ? (
              <Text style={styles.placesSheetItemHint} numberOfLines={1}>
                {parkingRecommendation.badge} · {parkingRecommendation.detail}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </Card>
    );
  };

  if (!shouldShowSheet) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.placesSheet,
        { height: sheetHeight, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.placesSheetHandleZone} {...panResponder.panHandlers}>
        <View style={styles.placesSheetHandle} />
        <View style={styles.placesSheetHeader}>
          <View style={styles.placesSheetTitleRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={{ flex: 1 }}
              onPress={() => animateSheet(isExpanded ? collapsedTranslateY : 0)}
            >
              {activeLayer === "Today" ? (
                renderTodayHeader()
              ) : (
                <>
                  <Text style={styles.placesSheetTitle}>{getSheetTitle()}</Text>
                  {getSheetSubtitle() && (
                    <Text style={styles.placesSheetSubtitle}>{getSheetSubtitle()}</Text>
                  )}
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.placesSheetCloseButton}
              onPress={() => animateSheet(collapsedTranslateY)}
            >
              <Text style={styles.placesSheetCloseText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.placesSheetBody}>
        <ScrollView
          style={styles.placesSheetScroll}
          contentContainerStyle={styles.placesSheetListContent}
          showsVerticalScrollIndicator={false}
        >
          {activeLayer !== "Today" && renderScheduleCard()}
          {isExpanded && activeLayer !== "Today" ? (
            sortedFilteredLocations.map((loc) => renderPlaceCard(loc))
          ) : !isExpanded && activeLayer !== "Today" ? (
            <View style={styles.placesSheetCollapsedBody}>
              <View style={styles.placesSheetCollapsedSummary}>
                <Text style={styles.placesSheetCollapsedSummaryTitle}>
                  {activeLayer === "Today"
                    ? "Schedule Details"
                    : sortedFilteredLocations[0]?.location || "Browse nearby places"}
                </Text>
                <Text style={styles.placesSheetCollapsedSummaryMeta}>
                  {activeLayer === "Today"
                    ? "See floating card above"
                    : `${sortedFilteredLocations.length} result${sortedFilteredLocations.length === 1 ? "" : "s"}`}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
