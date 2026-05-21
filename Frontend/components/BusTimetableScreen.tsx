import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Bell, Bus, ChevronLeft, Clock3, MapPin } from "lucide-react-native";
import { useTheme } from "./SharedUI";
import { useAppShellStore } from "../store/appShellStore";
import { scheduleBusArrivalNotification } from "../services/notificationService";
import { Alert } from "react-native";

function RouteBadge({
  shortName,
  color,
  styles,
}: {
  shortName?: string;
  color?: string;
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={[styles.routeBadge, { backgroundColor: color || "#500000" }]}>
      <Text style={styles.routeBadgeText}>{shortName || "??"}</Text>
    </View>
  );
}

function getStopLabel(stop: any) {
  return (
    stop?.Name ||
    stop?.StopName ||
    stop?.Description ||
    stop?.StopCode ||
    "Transit Stop"
  );
}

function formatDepartureList(entry: any) {
  const departures = Array.isArray(entry?.departures) ? entry.departures : [];
  const labels = departures
    .map((departure: any) => departure?.estimated_depart_time_utc || departure?.scheduled_depart_time_utc)
    .filter(Boolean)
    .slice(0, 3)
    .map((value: string) =>
      new Date(value).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    );

  return labels.join(" • ");
}

function TimetableRow({
  entry,
  routeName,
  styles,
  COLORS,
}: {
  entry: any;
  routeName: string;
  styles: ReturnType<typeof getStyles>;
  COLORS: any;
}) {
  const handleAlert = async () => {
    const prefs = useAppShellStore.getState();
    const leadTime = prefs.notificationLeadTime;
    if (!prefs.placeNotifications) {
      Alert.alert(
        "Notifications Disabled",
        "Please enable notifications in your settings.",
      );
      return;
    }

    const nextDeparture = entry.departures?.[0];
    const departTimeIso =
      nextDeparture?.estimated_depart_time_utc ||
      nextDeparture?.scheduled_depart_time_utc;

    if (!departTimeIso) {
      Alert.alert(
        "No Upcoming Departures",
        "There is no scheduled departure to remind you about at this stop.",
      );
      return;
    }

    const departMs = new Date(departTimeIso).getTime();
    if (!Number.isFinite(departMs)) {
      Alert.alert("No Upcoming Departures", "Could not read the next departure time.");
      return;
    }

    const minutes = Math.round((departMs - Date.now()) / 60000);
    if (minutes <= 0) {
      Alert.alert("Bus Arriving", "This bus is already arriving!");
      return;
    }

    const stopLabel = getStopLabel(entry.stop);
    const id = await scheduleBusArrivalNotification(
      routeName,
      stopLabel,
      minutes,
      leadTime,
    );
    if (id) {
      Alert.alert(
        "Reminder Set",
        `We will notify you ${leadTime} minutes before the bus arrives at ${stopLabel}.`,
      );
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.sequence}>
        <Text style={styles.sequenceText}>{entry.sequence}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stopName}>{getStopLabel(entry.stop)}</Text>
        <Text style={styles.stopMeta}>{entry.detail}</Text>
        {formatDepartureList(entry) ? (
          <Text style={styles.stopMeta}>{formatDepartureList(entry)}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={styles.eta}>{entry.etaLabel}</Text>
        <TouchableOpacity onPress={handleAlert} style={{ padding: 4 }}>
          <Bell size={16} color="#500000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BusTimetableScreen({ navigation, route }: any) {
  const { theme, COLORS } = useTheme();
  const darkMode = theme === "dark";
  const styles = getStyles(COLORS, darkMode);
  const mode = route.params?.mode || "single";
  const routeInfo = route.params?.route;
  const entries = route.params?.entries || [];
  const boards = route.params?.boards || [];
  const liveBusCount = route.params?.liveBusCount || 0;
  const nearbyTransitInsight = route.params?.nearbyTransitInsight;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.background }]}>
      <StatusBar
        barStyle={darkMode ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {mode === "all"
                ? "All Route Timetables"
                : `${routeInfo?.Name || "Bus Route"} Timetable`}
            </Text>
            <Text style={styles.subtitle}>
              {liveBusCount > 0
                ? `${liveBusCount} buses live`
                : "Route map loaded"}
            </Text>
          </View>
        </View>

        {mode === "single" ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <RouteBadge
                  shortName={routeInfo?.ShortName}
                  color={routeInfo?.Color}
                  styles={styles}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>
                    {routeInfo?.Name || "Transit route"}
                  </Text>
                  <Text style={styles.heroSub}>
                    Tap any stop on the map to track the nearest bus.
                  </Text>
                </View>
              </View>

              {nearbyTransitInsight ? (
                <View style={styles.insightCard}>
                  <View style={styles.insightRow}>
                    <MapPin size={14} color="#500000" />
                    <Text style={styles.insightText}>
                      {nearbyTransitInsight.nearestStop
                        ? `${nearbyTransitInsight.nearestStop.stop.Name} is ${Math.round(
                            nearbyTransitInsight.nearestStop.distanceMeters,
                          )} m away.`
                        : "No nearby stop detected yet."}
                    </Text>
                  </View>
                  {nearbyTransitInsight.nearestVehicle ? (
                    <View style={styles.insightRow}>
                      <Bus size={14} color="#500000" />
                      <Text style={styles.insightText}>
                        Closest bus is about{" "}
                        {Math.round(
                          nearbyTransitInsight.nearestVehicle.distanceMeters,
                        )}{" "}
                        m away.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <Clock3 size={15} color="#500000" />
              <Text style={styles.sectionTitle}>Stop Board</Text>
            </View>

            <View style={styles.boardCard}>
              {liveBusCount === 0 ? (
                <Text style={styles.emptyText}>
                  There are currently no buses on this route.
                </Text>
              ) : entries.length > 0 ? (
                entries.map((entry: any) => (
                  <TimetableRow
                    key={`${routeInfo?.Key || "route"}-${entry.stop?.StopCode || entry.sequence}`}
                    entry={entry}
                    routeName={routeInfo?.Name || "Bus"}
                    styles={styles}
                    COLORS={COLORS}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>
                  No timetable entries are available for this route yet.
                </Text>
              )}
            </View>
          </>
        ) : (
          <>
            {boards.length > 0 ? (
              boards.map((board: any) => (
                <View
                  key={board.route?.Key || board.route?.Name}
                  style={styles.boardCard}
                >
                  <View style={styles.heroHeader}>
                    <RouteBadge
                      shortName={board.route?.ShortName}
                      color={board.route?.Color}
                      styles={styles}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroTitle}>
                        {board.route?.Name || "Route"}
                      </Text>
                      <Text style={styles.heroSub}>
                        {board.liveCount > 0
                          ? `${board.liveCount} buses live`
                          : "Route loaded"}
                      </Text>
                    </View>
                  </View>
                  {board.entries.length > 0 ? (
                    board.entries.map((entry: any) => (
                      <TimetableRow
                        key={`${board.route?.Key || board.route?.Name}-${entry.stop?.StopCode || entry.sequence}`}
                        entry={entry}
                        routeName={board.route?.Name || "Bus"}
                        styles={styles}
                        COLORS={COLORS}
                      />
                    ))
                  ) : (
                    <Text style={styles.emptyText}>
                      Stop timetable unavailable for this route.
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.boardCard}>
                <Text style={styles.emptyText}>
                  Route timetables are still loading.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safe: { flex: 1 },
    content: { padding: 18, paddingBottom: 40 },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(8,8,10,0.74)" : "rgba(255,255,255,0.78)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.52)",
      marginRight: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.24 : 0.08,
      shadowRadius: 8,
      elevation: 6,
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 3,
    },
    heroCard: {
      backgroundColor: isDark
        ? "rgba(12,12,14,0.86)"
        : "rgba(255,255,255,0.98)",
      borderRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      padding: 18,
      marginBottom: 18,
    },
    heroHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    heroTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800" },
    heroSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
    routeBadge: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    routeBadgeText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
    insightCard: {
      marginTop: 16,
      gap: 10,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.04)"
        : "rgba(12,12,14,0.04)",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(12,12,14,0.06)",
      padding: 14,
    },
    insightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    insightText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      flex: 1,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      color: "#500000",
      fontSize: 13,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    boardCard: {
      backgroundColor: isDark
        ? "rgba(12,12,14,0.86)"
        : "rgba(255,255,255,0.98)",
      borderRadius: 26,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      padding: 16,
      marginBottom: 14,
      gap: 10,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(12,12,14,0.06)",
    },
    sequence: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#500000", // Hardcoded Aggie Maroon
      alignItems: "center",
      justifyContent: "center",
    },
    sequenceText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
    stopName: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 22,
    },
    stopMeta: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
    eta: { color: "#500000", fontSize: 15, fontWeight: "900" },
    emptyText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  });
