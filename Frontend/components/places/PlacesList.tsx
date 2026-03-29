import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Card } from "../SharedUI";
import { PlacesViewMode } from "../../store/appShellStore";
import type { CampusLocation } from "./types";
import { FLOATING_CARD_BOTTOM_OFFSET } from "./types";
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
  placesViewMode: PlacesViewMode;
  setPlacesViewMode: (v: PlacesViewMode) => void;
  sortedFilteredLocations: CampusLocation[];
  activeScheduleOption: any;
  userCoord: { latitude: number; longitude: number } | null;
  parkingPermit: any;
  recreationFacilityMap: Map<string, any>;
  handleSelectLocation: (loc: CampusLocation) => void;
}

export function PlacesList({
  styles,
  COLORS,
  activeLayer,
  placesViewMode,
  setPlacesViewMode,
  sortedFilteredLocations,
  activeScheduleOption,
  userCoord,
  parkingPermit,
  recreationFacilityMap,
  handleSelectLocation,
}: PlacesListProps) {
  if (
    placesViewMode !== "list" ||
    activeLayer === "Bus" ||
    activeLayer === "Heatmap"
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.placesListOverlay,
        activeLayer === "Schedule" && styles.placesListOverlaySchedule,
      ]}
      pointerEvents="box-none"
    >
      <Card style={styles.placesListCard}>
        <View style={styles.placesListHeader}>
          <Text style={styles.placesListTitle}>
            {activeLayer === "Schedule"
              ? "Class Locations"
              : `${activeLayer} Places`}
          </Text>
          <Text style={styles.placesListSubtitle}>
            {activeLayer === "Schedule"
              ? activeScheduleOption
                ? `Mapped from ${activeScheduleOption.label}. Open any building to see which classes meet there.`
                : "No uploaded or saved schedule has been pinned yet."
              : "Unified campus nodes with dining, events, parking, and room actions layered in."}
          </Text>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.placesListContent}
        >
          {sortedFilteredLocations.map((loc) => {
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
              recreationFacilityMap.get(
                getCanonicalLocationName(loc.location),
              ) || null;
            return (
              <TouchableOpacity
                key={`list-${loc.location}`}
                style={styles.placesListRow}
                onPress={() => {
                  setPlacesViewMode("map");
                  handleSelectLocation(loc);
                }}
              >
                <View style={styles.placesListIcon}>
                  {React.cloneElement(
                    getCategoryIcon(loc.type) as React.ReactElement<any>,
                    {
                      size: 16,
                      color: "#F3F1ED",
                    },
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.placesListRowHeader}>
                    <Text style={styles.placesListRowTitle}>
                      {loc.location}
                    </Text>
                    <Text style={styles.placesListRowDistance}>
                      {getDistanceLabel(distanceMeters)}
                    </Text>
                  </View>
                  <Text style={styles.placesListRowMeta}>
                    {loc.classMeetings?.length
                      ? `${loc.classMeetings.length} class${loc.classMeetings.length === 1 ? "" : "es"} · ${loc.classMeetings
                          .slice(0, 2)
                          .map((meeting) => meeting.code)
                          .join(" · ")}`
                      : loc.type === "Rec"
                        ? `Today: ${recreationFacility?.today_hours || recreationFacility?.hours_hint || loc.hours || "Check official page"}`
                        : loc.description || loc.hours || loc.type}
                  </Text>
                  {parkingRecommendation ? (
                    <Text style={styles.placesListParkingHint}>
                      {parkingRecommendation.badge} ·{" "}
                      {parkingRecommendation.detail}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Card>
    </View>
  );
}
