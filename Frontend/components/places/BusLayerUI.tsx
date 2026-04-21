import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
} from "react-native";
import { X, ChevronDown, Clock, MapPin, Bus, Route } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getStopLabel } from "./utils";
import { transitService } from "../../services/transitService";

interface BusLayerUIProps {
  styles: any;
  COLORS: any;
  busRoutes: any[];
  selectedBusRouteId: string | null;
  selectedRoute: any;
  isAllBusRoutesSelected: boolean;
  isRouteDropdownOpen: boolean;
  setIsRouteDropdownOpen: (v: boolean) => void;
  filteredBusRoutes: any[];
  handleSelectBusRoute: (routeId: string) => void;
  openBusTimetable: () => void;
  selectedDirection?: string;
  setSelectedDirection?: (v: string) => void;
  // Stop info card
  selectedStop: any;
  setSelectedStop: (v: any) => void;
  selectedBus: any;
  setSelectedBus: (v: any) => void;
  nearestBusInfo: string | null;
  handleStopPress: (stop: any) => void;
  openTransitTripPlanner?: () => void;
}

function getRouteLegendColor(route: any) {
  const rawColor = typeof route?.Color === "string" ? route.Color.trim() : "";
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawColor)) {
    return rawColor;
  }
  return transitService.getRouteColor(
    route?.Key || route?.ShortName || route?.Name || "",
  );
}

export function BusRouteSelector({
  styles,
  COLORS,
  busRoutes,
  selectedBusRouteId,
  selectedRoute,
  isAllBusRoutesSelected,
  isRouteDropdownOpen,
  setIsRouteDropdownOpen,
  filteredBusRoutes,
  handleSelectBusRoute,
  openBusTimetable,
  openTransitTripPlanner,
  selectedDirection,
  setSelectedDirection,
  availableDirections,
}: BusLayerUIProps & {
  selectedDirection?: string;
  setSelectedDirection?: (val: string) => void;
  availableDirections?: string[];
}) {
  if (busRoutes.length === 0) return null;

  return (
    <View style={styles.busRouteSelectorOuter} pointerEvents="box-none">
      <View style={styles.busRouteSelectorRow}>
        <TouchableOpacity
          style={styles.busRouteDropdownTrigger}
          onPress={() => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            setIsRouteDropdownOpen(!isRouteDropdownOpen);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <View
            style={[
              styles.selectedRouteBadge,
              isAllBusRoutesSelected && styles.selectedRouteBadgeMuted,
            ]}
          >
            <View
              style={{
                minWidth: 32,
                paddingHorizontal: 4,
                alignItems: "center",
              }}
            >
              <Text style={styles.selectedRouteNumber} numberOfLines={1}>
                {isAllBusRoutesSelected
                  ? "ALL"
                  : busRoutes.find((r) => r.Key === selectedBusRouteId)
                      ?.ShortName || "??"}
              </Text>
            </View>
          </View>
          <View style={styles.selectedRouteTextStack}>
            <Text style={styles.labelSubText}>Transit</Text>
            <Text style={styles.selectedRouteName} numberOfLines={1}>
              {isAllBusRoutesSelected
                ? "All Routes"
                : busRoutes.find((r) => r.Key === selectedBusRouteId)?.Name ||
                  "Select Route"}
            </Text>
          </View>
          <View style={styles.chevronIcon}>
            <ChevronDown
              size={16}
              color={COLORS.textTertiary}
              style={
                isRouteDropdownOpen && { transform: [{ rotate: "180deg" }] }
              }
            />
          </View>
        </TouchableOpacity>

        {!isAllBusRoutesSelected && (
          <TouchableOpacity
            style={styles.busTimetableButton}
            onPress={openBusTimetable}
            activeOpacity={0.85}
          >
            <Clock size={16} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.busTimetableButton,
            { backgroundColor: COLORS.primary },
          ]}
          onPress={openTransitTripPlanner}
          activeOpacity={0.85}
        >
          <Route size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Direction Switcher */}
      {!isAllBusRoutesSelected && selectedDirection && setSelectedDirection && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8, marginTop: 8 }}
        >
          {availableDirections &&
            availableDirections.filter((d) => d !== "All").length > 1 &&
            availableDirections
              .filter((d) => d !== "All")
              .map((dir) => {
                const isSelected = selectedDirection === dir;
                return (
                  <TouchableOpacity
                    key={dir}
                    onPress={() => setSelectedDirection(dir)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      backgroundColor: isSelected
                        ? COLORS.primary
                        : COLORS.surface,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? COLORS.primary : COLORS.border,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#fff" : COLORS.textSecondary,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {dir}
                    </Text>
                  </TouchableOpacity>
                );
              })}
        </ScrollView>
      )}

      {isRouteDropdownOpen && (
        <View style={styles.busRoutesDropdown}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.busDropdownScroll}
            nestedScrollEnabled={true}
          >
            {filteredBusRoutes.length === 0 ? (
              <View style={styles.emptyRouteSearchState}>
                <Text style={styles.emptyRouteSearchTitle}>
                  No routes available right now.
                </Text>
                <Text style={styles.emptyRouteSearchBody}>
                  Pull to refresh live transit data and try again.
                </Text>
              </View>
            ) : (
              filteredBusRoutes.map((route) => {
                const isSelected = selectedBusRouteId === route.Key;
                const legendColor = getRouteLegendColor(route);
                return (
                  <TouchableOpacity
                    key={route.Key}
                    style={[
                      styles.busRouteItem,
                      isSelected && styles.busRouteItemActive,
                    ]}
                    onPress={() => {
                      handleSelectBusRoute(route.Key);
                      setIsRouteDropdownOpen(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                  >
                    <View
                      style={[
                        styles.routeLegendSwatch,
                        {
                          backgroundColor: legendColor,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.routeItemBadge,
                        isSelected
                          ? styles.routeItemBadgeActive
                          : styles.routeItemBadgeIdle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.routeItemNumber,
                          !isSelected && styles.routeItemNumberIdle,
                        ]}
                      >
                        {route.ShortName}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.routeItemName,
                        isSelected && styles.routeItemNameActive,
                      ]}
                    >
                      {route.Name}
                    </Text>
                    {isSelected && <View style={styles.activeCheckDot} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export function BusStopInfoCard({
  styles,
  COLORS,
  selectedStop,
  setSelectedStop,
  nearestBusInfo,
}: Pick<
  BusLayerUIProps,
  | "styles"
  | "COLORS"
  | "selectedStop"
  | "setSelectedStop"
  | "nearestBusInfo"
>) {
  if (!selectedStop) return null;

  return (
    <View style={styles.dockedStopContainer}>
      <TouchableOpacity
        style={styles.busStopDockedCard}
        onPress={() => setSelectedStop(null)}
        activeOpacity={0.9}
      >
        <View style={styles.stopIconCircular}>
          <View style={styles.stopPulseMarker} />
          <MapPin size={20} color="#007AFF" />
        </View>
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={styles.dockedStopName} numberOfLines={1}>
            {getStopLabel(selectedStop)}
          </Text>
          <View style={styles.proximityRow}>
            <Clock
              size={12}
              color={COLORS.textTertiary}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.dockedStopProximity}>
              {nearestBusInfo || "Stop details loading"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.closeStopBtn}
          onPress={() => setSelectedStop(null)}
        >
          <X size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

export function BusVehicleInfoCard({
  styles,
  COLORS,
  selectedBus,
  setSelectedBus,
  selectedRoute,
}: {
  styles: any;
  COLORS: any;
  selectedBus: any;
  setSelectedBus: (v: any) => void;
  selectedRoute: any;
}) {
  if (!selectedBus) return null;

  return (
    <TouchableOpacity
      style={styles.busVehicleInfoCard}
      onPress={() => setSelectedBus(null)}
      activeOpacity={0.9}
    >
      <View style={styles.busInfoIcon}>
        <Bus size={24} color="#FFF" />
      </View>
      <View style={{ flex: 1, paddingLeft: 12 }}>
        <View style={styles.busInfoBadgeRow}>
          <View style={styles.busInfoBadge}>
            <Text style={styles.busInfoBadgeText}>ID: {selectedBus.Name}</Text>
          </View>

          {(selectedBus.Speed !== undefined ||
            selectedBus.speed !== undefined) && (
            <View style={[styles.busInfoBadge, { marginLeft: 6 }]}>
              <Text style={styles.busInfoBadgeText}>
                {Math.round(
                  (selectedBus.Speed || selectedBus.speed || 0) * 2.23694,
                )}{" "}
                mph
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.busInfoRouteName}>
          {selectedBus.RouteShortName ||
            selectedRoute?.ShortName ||
            selectedBus.RouteName ||
            "Bus Route"}
          {selectedBus.DirectionName || selectedBus.direction
            ? ` • ${selectedBus.DirectionName || selectedBus.direction}`
            : ""}
        </Text>
      </View>
      <X size={20} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}
