import React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { TourTarget } from "../onboarding/TourProvider";
import type { CampusLocation } from "./types";
import { getCanonicalLocationName } from "./campusData";
import {
  getCategoryColor,
  getCategoryIcon,
  getDistanceLabel,
  getParkingRecommendation,
  haversineDistanceMeters,
} from "./utils";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const VISITOR_GARAGE_IDS = [
  "osm:way:91100311",
  "garage-polo",
  "osm:way:450686873",
  "garage-university-center",
  "garage-west-campus",
];

interface PlacesListPopupProps {
  styles: any;
  COLORS: any;
  activeLayer: string;
  visible: boolean;
  locations: CampusLocation[];
  userCoord: { latitude: number; longitude: number } | null;
  parkingPermit: any;
  recreationFacilityMap: Map<string, any>;
  onToggle: () => void;
  onSelectLocation: (loc: CampusLocation) => void;
  listScrollRef?: React.RefObject<ScrollView | null>;
  activeTargetName?: string | null;
  advanceStep?: (targetName: string) => void;
  onRecCenterRowLayout?: (y: number) => void;
  scrollToRecCenterItem?: () => void;
}

const formatUpdatedLabel = (raw?: string | null) => {
  if (!raw) return null;
  const parsed = new Date(
    String(raw).includes("T") ? String(raw) : String(raw).replace(" ", "T"),
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return `Updated ${parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

const isVisitorParkingGarage = (loc: CampusLocation) => {
  const name = (loc.location || "").toLowerCase();
  return (
    loc.type === "Parking" &&
    (VISITOR_GARAGE_IDS.includes(loc.placeId || "") ||
      name.includes("central campus garage") ||
      name.includes("polo") ||
      name.includes("stallings") ||
      name.includes("university center garage") ||
      name.includes("west campus garage"))
  );
};

const getParkingFillPercent = (loc: CampusLocation) => {
  if (loc.percent_full != null && Number.isFinite(loc.percent_full)) {
    return loc.percent_full;
  }
  if (loc.capacity && loc.capacity > 0 && loc.current_count != null) {
    return Math.round((loc.current_count / loc.capacity) * 100);
  }
  const available = loc.visitor_parking_available;
  if (available == null || !isVisitorParkingGarage(loc)) {
    return null;
  }

  let capacityEstimate = 1000;
  if (loc.location.includes("Central Campus")) capacityEstimate = 600;
  else if (loc.location.includes("Stallings")) capacityEstimate = 1300;
  else if (loc.location.includes("University Center")) capacityEstimate = 2300;
  else if (loc.location.includes("West Campus")) capacityEstimate = 3500;

  return Math.round(Math.max(0, (capacityEstimate - available) / capacityEstimate) * 100);
};

const getPopupTitle = (activeLayer: string) => {
  if (activeLayer === "Dining") return "Dining Places";
  if (activeLayer === "Academic") return "Academic Places";
  if (activeLayer === "Library") return "Libraries";
  if (activeLayer === "Rec") return "Gyms and Rec";
  if (activeLayer === "Parking") return "Parking";
  return `${activeLayer} Places`;
};

const buildPlaceMeta = (
  loc: CampusLocation,
  userCoord: { latitude: number; longitude: number } | null,
  recreationFacilityMap: Map<string, any>,
  parkingPermit: any,
) => {
  const distanceMeters = userCoord
    ? haversineDistanceMeters(
        userCoord.latitude,
        userCoord.longitude,
        loc.coord.lat,
        loc.coord.lng,
      )
    : null;
  const distanceLabel = userCoord ? getDistanceLabel(distanceMeters) : null;
  const typeLabel = loc.type === "Hub" ? "Dining" : loc.type;
  const eyebrow = [typeLabel, distanceLabel].filter(Boolean).join(" · ");

  const recreationFacility =
    recreationFacilityMap.get(getCanonicalLocationName(loc.location)) || null;
  const occupancyPercent = getParkingFillPercent(loc);
  const parkingAvailable = loc.visitor_parking_available ?? null;
  const parkingRecommendation =
    loc.type === "Parking" ? getParkingRecommendation(loc.location, parkingPermit) : null;
  const hoursLabel =
    loc.hours_today ||
    loc.hours ||
    recreationFacility?.today_hours ||
    recreationFacility?.hours_hint ||
    null;
  const featureLabel =
    loc.features?.slice(0, 2).join(" · ") ||
    loc.restaurants?.slice(0, 2).join(" · ") ||
    null;
  const recUpdatedLabel = formatUpdatedLabel(
    loc.capacity_last_updated || loc.capacity_as_of,
  );
  const parkingUpdatedLabel = formatUpdatedLabel(loc.visitor_parking_as_of);

  if (loc.classMeetings?.length) {
    return {
      eyebrow,
      detail: `${loc.classMeetings.length} class${loc.classMeetings.length === 1 ? "" : "es"} here today`,
    };
  }

  if (isVisitorParkingGarage(loc) && parkingAvailable != null) {
    return {
      eyebrow,
      detail: `${parkingAvailable.toLocaleString()} spaces available${parkingUpdatedLabel ? ` · ${parkingUpdatedLabel}` : ""}`,
    };
  }

  if ((loc.type === "Library" || loc.type === "Rec") && occupancyPercent != null) {
    return {
      eyebrow,
      detail: `${occupancyPercent}% full${recUpdatedLabel ? ` · ${recUpdatedLabel}` : ""}`,
    };
  }

  if (hoursLabel) {
    return { eyebrow, detail: hoursLabel };
  }

  if (loc.type === "Parking" && parkingRecommendation) {
    return { eyebrow, detail: parkingRecommendation.badge };
  }

  if (featureLabel) {
    return { eyebrow, detail: featureLabel };
  }

  if (loc.address) {
    return { eyebrow, detail: loc.address };
  }

  return { eyebrow, detail: null };
};

export function PlacesListPopup({
  styles,
  COLORS,
  activeLayer,
  visible,
  locations,
  userCoord,
  parkingPermit,
  recreationFacilityMap,
  onToggle,
  onSelectLocation,
  listScrollRef,
  activeTargetName,
  advanceStep,
  onRecCenterRowLayout,
  scrollToRecCenterItem,
}: PlacesListPopupProps) {
  const popupHeight = Math.min(Math.round(SCREEN_HEIGHT * 0.54), 460);
  const title = getPopupTitle(activeLayer);
  const subtitle = `${locations.length} place${locations.length === 1 ? "" : "s"}`;
  const animationProgress = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [shouldRenderPopup, setShouldRenderPopup] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRenderPopup(true);
    }

    const animation = Animated.timing(animationProgress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setShouldRenderPopup(false);
      }
    });

    return () => {
      animation.stop();
    };
  }, [animationProgress, visible]);

  const chevronAnimatedStyle = {
    transform: [
      {
        rotate: animationProgress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
  };

  const popupAnimatedStyle = {
    opacity: animationProgress,
    transform: [
      {
        translateY: animationProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 0],
        }),
      },
      {
        scale: animationProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.placesListPopupWrap}>
      <TouchableOpacity
        activeOpacity={0.88}
        style={[
          styles.placesListTrigger,
          visible ? styles.placesListTriggerActive : null,
        ]}
        onPress={onToggle}
      >
        <Text style={styles.placesListTriggerText}>List View</Text>
        <Animated.View style={chevronAnimatedStyle}>
          <ChevronDown size={18} color={COLORS.textPrimary} />
        </Animated.View>
      </TouchableOpacity>

      {shouldRenderPopup ? (
        <Animated.View
          style={[
            styles.placesListPopupCard,
            { maxHeight: popupHeight },
            popupAnimatedStyle,
          ]}
          pointerEvents={visible ? "auto" : "none"}
        >
          <View style={styles.placesListPopupHeader}>
            <View style={styles.placesListPopupHandle} />
            <Text style={styles.placesListPopupTitle}>{title}</Text>
            <Text style={styles.placesListPopupSubtitle}>{subtitle}</Text>
          </View>

          <ScrollView
            ref={listScrollRef}
            style={styles.placesListPopupScroll}
            contentContainerStyle={styles.placesListPopupContent}
            showsVerticalScrollIndicator={false}
          >
            {locations.length === 0 ? (
              <View style={styles.placesListPopupEmptyState}>
                <Text style={styles.placesListPopupEmptyTitle}>No places right now</Text>
                <Text style={styles.placesListPopupEmptySubtitle}>
                  Try another layer or search on the map.
                </Text>
              </View>
            ) : null}

            {locations.map((loc) => {
              const meta = buildPlaceMeta(
                loc,
                userCoord,
                recreationFacilityMap,
                parkingPermit,
              );
              const isRecCenterTourItem =
                getCanonicalLocationName(loc.location) ===
                getCanonicalLocationName("Student Recreation Center");

              const row = (
                <TouchableOpacity
                  key={`${loc.placeId || loc.location}-${loc.coord.lat}-${loc.coord.lng}`}
                  activeOpacity={0.88}
                  style={styles.placesListPopupRow}
                  onLayout={
                    isRecCenterTourItem && onRecCenterRowLayout
                      ? (event) => {
                          onRecCenterRowLayout(event.nativeEvent.layout.y);
                          if (activeTargetName === "rec-center-item") {
                            setTimeout(() => scrollToRecCenterItem?.(), 0);
                          }
                        }
                      : undefined
                  }
                  onPress={() => {
                    onSelectLocation(loc);
                    if (isRecCenterTourItem && activeTargetName === "rec-center-item") {
                      setTimeout(() => {
                        advanceStep?.("rec-center-item");
                      }, 0);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.placesListPopupRowIcon,
                      { backgroundColor: getCategoryColor(loc.type) },
                    ]}
                  >
                    {getCategoryIcon(loc.type, "#FFFFFF", 18)}
                  </View>

                  <View style={styles.placesListPopupRowBody}>
                    <Text
                      style={styles.placesListPopupRowTitle}
                      numberOfLines={1}
                    >
                      {loc.location}
                    </Text>
                    <Text
                      style={styles.placesListPopupRowEyebrow}
                      numberOfLines={1}
                    >
                      {meta.eyebrow}
                    </Text>
                    {meta.detail ? (
                      <Text
                        style={styles.placesListPopupRowDetail}
                        numberOfLines={1}
                      >
                        {meta.detail}
                      </Text>
                    ) : null}
                  </View>

                  <ChevronRight size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              );

              if (!isRecCenterTourItem) {
                return row;
              }

              return (
                <TourTarget
                  key={`tour-${loc.location}`}
                  name="rec-center-item"
                  assistAction={() => {
                    onSelectLocation(loc);
                    setTimeout(() => {
                      advanceStep?.("rec-center-item");
                    }, 0);
                  }}
                >
                  {row}
                </TourTarget>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}
