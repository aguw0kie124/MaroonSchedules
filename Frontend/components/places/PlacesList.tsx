import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import { ChevronRight, Calendar, Plus, Menu, X } from "lucide-react-native";
import { Card } from "../SharedUI";
import type { CampusLocation } from "./types";
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
  visible: boolean;
  onClose: () => void;
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
  visible,
  onClose,
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
  const shouldShowList =
    !selectedId && activeLayer !== "Bus" && activeLayer !== "Heatmap" && (activeLayer === "Schedule" || sortedFilteredLocations.length > 0);

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
    const primaryMeta = loc.classMeetings?.length
      ? `${loc.classMeetings.length} class${loc.classMeetings.length === 1 ? "" : "es"}`
      : loc.type === "Rec"
        ? recreationFacility?.today_hours || recreationFacility?.hours_hint || loc.hours || "Hours available"
        : loc.hours || loc.description || loc.type;
    const secondaryMeta =
      loc.type === "Parking"
        ? parkingRecommendation?.badge || null
        : loc.percent_full != null &&
            (loc.type === "Library" || loc.type === "Rec")
          ? `${loc.percent_full}% full`
          : loc.type;
    const statusChips: string[] = [];

    if (loc.classMeetings?.length) {
      statusChips.push("Classes here");
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

  if (!visible || !shouldShowList) {
    return null;
  }

  return (
    <View style={styles.placesListOverlay}>
      <Pressable style={styles.placesListBackdrop} onPress={onClose} />
      <Card style={styles.placesListCard}>
        <View style={styles.placesListHeader}>
          <View style={styles.placesListHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.placesListTitle}>{getSheetTitle()}</Text>
              <Text style={styles.placesListSubtitle}>{getSheetSubtitle()}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.placesListExitButton}
              onPress={onClose}
            >
              <X size={16} color={COLORS.textPrimary} />
              <Text style={styles.placesListExitText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.placesListContent}
          contentContainerStyle={styles.placesSheetListContent}
          showsVerticalScrollIndicator={false}
        >
          {renderScheduleCard()}
          {sortedFilteredLocations.map((loc) => renderPlaceCard(loc))}
        </ScrollView>
      </Card>
    </View>
  );
}
