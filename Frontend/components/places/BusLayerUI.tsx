import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  LayoutAnimation,
} from "react-native";
import {
  Search,
  X,
  ChevronDown,
  Clock,
  MapPin,
  Bus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { CampusLocation } from "./types";
import { getStopLabel } from "./utils";

interface BusLayerUIProps {
  styles: any;
  COLORS: any;
  busRoutes: any[];
  selectedBusRouteId: string | null;
  selectedRoute: any;
  isAllBusRoutesSelected: boolean;
  isRouteDropdownOpen: boolean;
  setIsRouteDropdownOpen: (v: boolean) => void;
  routeSearchQuery: string;
  setRouteSearchQuery: (v: string) => void;
  filteredBusRoutes: any[];
  handleSelectBusRoute: (routeId: string) => void;
  openBusTimetable: () => void;
  // Destination search
  busDestinationQuery: string;
  setBusDestinationQuery: (v: string) => void;
  busDestinationResults: CampusLocation[];
  openNavigationToLocation: (loc: CampusLocation, mode: "walk" | "bus") => void;
  // Stop info card
  selectedStop: any;
  setSelectedStop: (v: any) => void;
  selectedBus: any;
  setSelectedBus: (v: any) => void;
  nearestBusInfo: string | null;
  handleStopPress: (stop: any) => void;
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
  routeSearchQuery,
  setRouteSearchQuery,
  filteredBusRoutes,
  handleSelectBusRoute,
  openBusTimetable,
  busDestinationQuery,
  setBusDestinationQuery,
  busDestinationResults,
  openNavigationToLocation,
}: BusLayerUIProps) {
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
            <Text style={styles.labelSubText}>Current Route</Text>
            <Text style={styles.selectedRouteName} numberOfLines={1}>
              {isAllBusRoutesSelected
                ? "Show All Routes"
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

        <TouchableOpacity
          style={styles.busTimetableButton}
          onPress={openBusTimetable}
          activeOpacity={0.85}
        >
          <Clock size={16} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.destinationSearchCard}>
        <View style={styles.destinationSearchRow}>
          <Search size={16} color={COLORS.textTertiary} />
          <TextInput
            value={busDestinationQuery}
            onChangeText={setBusDestinationQuery}
            placeholder="Search destination for walking or bus route"
            placeholderTextColor={COLORS.textTertiary}
            style={styles.destinationSearchInput}
          />
          {busDestinationQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setBusDestinationQuery("")}>
              <X size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {busDestinationQuery.trim().length > 0 ? (
          <View style={styles.destinationResults}>
            {busDestinationResults.length > 0 ? (
              busDestinationResults.map((loc) => (
                <View
                  key={`bus-search-${loc.location}`}
                  style={styles.destinationResultItem}
                >
                  <TouchableOpacity
                    style={styles.destinationResultMain}
                    onPress={() => openNavigationToLocation(loc, "walk")}
                  >
                    <MapPin size={14} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.destinationResultTitle}
                        numberOfLines={1}
                      >
                        {loc.location}
                      </Text>
                      <Text
                        style={styles.destinationResultMeta}
                        numberOfLines={1}
                      >
                        {loc.shortName && loc.shortName !== loc.location
                          ? `${loc.shortName} • `
                          : ""}
                        {loc.type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.destinationModePill}
                    onPress={() => openNavigationToLocation(loc, "walk")}
                  >
                    <Text style={styles.destinationModeText}>Walk</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.destinationModePill}
                    onPress={() => openNavigationToLocation(loc, "bus")}
                  >
                    <Text style={styles.destinationModeText}>Bus</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.destinationEmptyText}>
                No places match that search.
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {isRouteDropdownOpen && (
        <View style={styles.busRoutesDropdown}>
          <View style={styles.routeSearchRow}>
            <Search size={15} color={COLORS.textTertiary} />
            <TextInput
              value={routeSearchQuery}
              onChangeText={setRouteSearchQuery}
              placeholder="Search route or number"
              placeholderTextColor={COLORS.textTertiary}
              style={styles.routeSearchInput}
            />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.busDropdownScroll}
            nestedScrollEnabled={true}
          >
            {filteredBusRoutes.length === 0 ? (
              <View style={styles.emptyRouteSearchState}>
                <Text style={styles.emptyRouteSearchTitle}>
                  No routes match that search.
                </Text>
                <Text style={styles.emptyRouteSearchBody}>
                  Try a route number like 01 or a route name keyword.
                </Text>
              </View>
            ) : (
              filteredBusRoutes.map((route) => {
                const isSelected = selectedBusRouteId === route.Key;
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
  selectedBus,
  nearestBusInfo,
}: Pick<
  BusLayerUIProps,
  | "styles"
  | "COLORS"
  | "selectedStop"
  | "setSelectedStop"
  | "selectedBus"
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
          {selectedBus && (
            <Text style={styles.busStopHintText} numberOfLines={1}>
              Tracking{" "}
              {selectedBus.RouteShortName
                ? `route ${selectedBus.RouteShortName}`
                : `bus ${selectedBus.Name}`}
            </Text>
          )}
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
      <View style={{ flex: 1 }}>
        <View style={styles.busInfoBadgeRow}>
          <View style={styles.busInfoBadge}>
            <Text style={styles.busInfoBadgeText}>
              ID: {selectedBus.Name}
            </Text>
          </View>
          {selectedBus.Capacity > 0 && (
            <View
              style={[
                styles.loadBadge,
                {
                  backgroundColor:
                    selectedBus.PassengersOnboard / selectedBus.Capacity > 0.8
                      ? "#FF3B3020"
                      : "#32D74B20",
                },
              ]}
            >
              <Text
                style={[
                  styles.loadText,
                  {
                    color:
                      selectedBus.PassengersOnboard / selectedBus.Capacity > 0.8
                        ? "#FF3B30"
                        : "#32D74B",
                  },
                ]}
              >
                {Math.round(
                  (selectedBus.PassengersOnboard / selectedBus.Capacity) * 100,
                )}
                % Full
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.busInfoRouteName}>
          Heading on Route{" "}
          {selectedBus.RouteShortName ||
            selectedRoute?.ShortName ||
            selectedBus.RouteName ||
            "Bus Route"}
        </Text>
      </View>
      <X size={20} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}
