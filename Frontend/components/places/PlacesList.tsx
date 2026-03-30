import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
} from "react-native";
import { ChevronRight, Calendar, Plus, Menu } from "lucide-react-native";
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
}: PlacesListProps) {
  const shouldShowSheet =
    !selectedId && activeLayer !== "Bus" && activeLayer !== "Heatmap" && (activeLayer === "Schedule" || sortedFilteredLocations.length > 0);

  // Keep the sheet docked lower so the map remains the main workspace.
  const sheetHeight = Math.min(Math.round(SCREEN_HEIGHT * 0.52), 470);
  const collapsedHeight = activeLayer === "Schedule" ? 164 : 110;
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
    if (activeLayer === "Schedule") return "Class Locations";
    if (activeLayer === "Dining") return "Dining Places";
    if (activeLayer === "Academic") return "Academic Places";
    if (activeLayer === "Study") return "Study Spots";
    if (activeLayer === "Library") return "Libraries";
    if (activeLayer === "Rec") return "Gyms and Rec";
    if (activeLayer === "Parking") return "Parking";
    return `${activeLayer} Places`;
  };

  const getSheetSubtitle = () => {
    if (activeLayer === "Schedule") {
      return activeScheduleOption
        ? `${activeScheduleOption.label} on the map.`
        : isLoadingSchedules
          ? "Loading class map."
          : "Map your classes to view them here.";
    }
    return `${sortedFilteredLocations.length} place${sortedFilteredLocations.length === 1 ? "" : "s"} in this view.`;
  };

  const renderScheduleCard = () => {
    if (activeLayer !== "Schedule") return null;

    const hasSchedules = scheduleOptions.length > 0;
    return (
      <View style={styles.placesSheetScheduleCard}>
        <View style={styles.placesSheetScheduleTopRow}>
          <View style={styles.placesSheetScheduleIcon}>
            <Calendar size={18} color="#FFF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.placesSheetScheduleEyebrow}>Class map</Text>
            <Text style={styles.placesSheetScheduleTitle} numberOfLines={1}>
              {activeScheduleOption ? activeScheduleOption.label : "No schedule selected"}
            </Text>
            <Text style={styles.placesSheetScheduleBody} numberOfLines={1}>
              {scheduleSummaryLabel}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.placesSheetScheduleMenuButton}
            onPress={openScheduleList}
          >
            <Menu size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.placesSheetScheduleActionRow}>
          <TouchableOpacity
            style={[styles.placesSheetScheduleAction, styles.placesSheetScheduleActionPrimary]}
            onPress={openScheduleList}
          >
            <Text style={styles.placesSheetScheduleActionPrimaryText}>Schedules</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.placesSheetScheduleAction}
            onPress={openNewCourseSearch}
          >
            <Plus size={14} color={COLORS.textPrimary} />
            <Text style={styles.placesSheetScheduleActionText}>Add class</Text>
          </TouchableOpacity>
        </View>

        {hasSchedules ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.placesSheetScheduleChipScroller}
          >
            {scheduleOptions.map((option) => {
              const isActive = activeScheduleOption?.id === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.placesSheetScheduleChip,
                    isActive && styles.placesSheetScheduleChipActive,
                  ]}
                  onPress={() => {
                    setActiveScheduleId(option.id);
                    setSelectedId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.placesSheetScheduleChipLabel,
                      isActive && styles.placesSheetScheduleChipLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.placesSheetScheduleChipMeta,
                      isActive && styles.placesSheetScheduleChipMetaActive,
                    ]}
                  >
                    {option.source === "uploaded" ? "Uploaded" : `${option.entries.length} classes`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
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
            <View style={styles.placesSheetItemHeader}>
              <Text style={styles.placesSheetItemTitle} numberOfLines={1}>
                {loc.location}
              </Text>
              <Text style={styles.placesSheetItemDistance}>
                {getDistanceLabel(distanceMeters)}
              </Text>
            </View>
            <Text style={styles.placesSheetItemMeta} numberOfLines={compact ? 1 : 2}>
              {loc.classMeetings?.length
                ? `${loc.classMeetings.length} class${loc.classMeetings.length === 1 ? "" : "es"}`
                : loc.type === "Rec"
                  ? `Today: ${recreationFacility?.today_hours || recreationFacility?.hours_hint || loc.hours || "Check official page"}`
                  : loc.description || loc.hours || loc.type}
            </Text>
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
              <Text style={styles.placesSheetTitle}>{getSheetTitle()}</Text>
              <Text style={styles.placesSheetSubtitle}>{getSheetSubtitle()}</Text>
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
          {renderScheduleCard()}
          {isExpanded ? (
            sortedFilteredLocations.map((loc) => renderPlaceCard(loc))
          ) : (
            <View style={styles.placesSheetCollapsedBody}>
              <Text style={styles.placesSheetCollapsedBodyText}>
                {activeLayer === "Schedule"
                  ? "Pull up for the class list."
                  : "Pull up for the full list."}
              </Text>
              <View style={styles.placesSheetCollapsedSummary}>
                <Text style={styles.placesSheetCollapsedSummaryTitle}>
                  {activeLayer === "Schedule"
                    ? activeScheduleOption?.label || "No schedule selected"
                    : sortedFilteredLocations[0]?.location || "Browse nearby places"}
                </Text>
                <Text style={styles.placesSheetCollapsedSummaryMeta}>
                  {activeLayer === "Schedule"
                    ? scheduleSummaryLabel
                    : `${sortedFilteredLocations.length} result${sortedFilteredLocations.length === 1 ? "" : "s"}`}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
