import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { X, MapPin, Clock } from "lucide-react-native";
import { formatExactLocalTime } from "../../services/dateUtils";
import { SNAP_PEEK, SNAP_FULL, SCREEN_HEIGHT } from "./types";

interface BusTimetableSheetProps {
  visible: boolean;
  mode: "single" | "all";
  onClose: () => void;
  COLORS: any;
  isDark: boolean;
  selectedRoute: any | null;
  liveBusCount: number;
  stopTimetable: Array<{
    stop: any;
    sequence: number;
    etaLabel: string;
    detail: string;
    departures?: any[];
  }>;
  onStopPress: (stop: any) => void;
  loading?: boolean;
}

export function BusTimetableSheet({
  visible,
  mode,
  onClose,
  COLORS,
  isDark,
  selectedRoute,
  liveBusCount,
  stopTimetable,
  onStopPress,
  loading,
}: BusTimetableSheetProps) {
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(panY, {
        toValue: SNAP_PEEK,
        useNativeDriver: true,
        bounciness: 0,
        speed: 12,
      }).start();
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 50);
    } else {
      Animated.timing(panY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const snapTo = (toValue: number) => {
    Animated.spring(panY, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 12,
    }).start();
  };

  const handleClose = () => {
    snapTo(SCREEN_HEIGHT);
    setTimeout(onClose, 250);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = (panY as any)._value + gestureState.dy;
        if (newValue >= SNAP_FULL) {
          panY.setValue(newValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = (panY as any)._value;
        const velocityY = gestureState.vy;

        if (velocityY > 1.5 || currentY > SNAP_PEEK + 100) {
          handleClose();
        } else if (velocityY < -1.0 || currentY < SNAP_PEEK - 50) {
          snapTo(SNAP_FULL);
        } else {
          snapTo(SNAP_PEEK);
        }
      },
    }),
  ).current;

  if (!visible) return null;

  const formatDepartureList = (item: { departures?: any[] }) => {
    const departures = Array.isArray(item.departures) ? item.departures : [];
    return departures
      .map((departure) => departure?.estimated_depart_time_utc || departure?.scheduled_depart_time_utc)
      .filter(Boolean)
      .slice(0, 3)
      .map((value) => formatExactLocalTime(value))
      .join(" • ");
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor:
            COLORS.surfaceElevated ||
            COLORS.background ||
            (isDark ? "#111" : "#fff"),
          borderTopColor: COLORS.border || "rgba(0,0,0,0.1)",
          transform: [{ translateY: panY }],
        },
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
        <View
          style={[
            styles.dragHandle,
            { backgroundColor: isDark ? "#333" : "#E0E0E0" },
          ]}
        />
      </View>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {selectedRoute && (
              <View
                style={{
                  backgroundColor: selectedRoute.Color || "#500000",
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "900", fontSize: 13 }}
                >
                  {selectedRoute.ShortName}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.title,
                {
                  color: COLORS.textPrimary,
                  marginBottom: 0,
                  fontSize: 24,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                },
              ]}
            >
              {selectedRoute ? "Timetable" : "Bus Timetable"}
            </Text>
          </View>
          {selectedRoute && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: COLORS.textSecondary,
                  marginTop: 6,
                  fontSize: 14,
                  fontWeight: "600",
                },
              ]}
            >
              {selectedRoute.Name} • {liveBusCount} live bus
              {liveBusCount === 1 ? "" : "es"}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <X size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.listContainer}
        contentContainerStyle={{ paddingBottom: SCREEN_HEIGHT / 2 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        onScroll={(e) => {
          if (e.nativeEvent.contentOffset.y <= 0) {
            setScrollEnabled(false);
            setScrollEnabled(true);
          }
        }}
        scrollEventThrottle={16}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={selectedRoute?.Color || (isDark ? "#FF8FA3" : "#500000")}
            />
            <Text
              style={[
                styles.loadingText,
                { color: COLORS.textSecondary, marginTop: 16 },
              ]}
            >
              Retrieving live route schedule...
            </Text>
          </View>
        ) : (
          <>
            {stopTimetable.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === stopTimetable.length - 1;

              return (
                <TouchableOpacity
                  key={item.stop.Id || index}
                  style={styles.stopRow}
                  onPress={() => {
                    snapTo(SNAP_PEEK);
                    onStopPress(item.stop);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.timelineCol}>
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.2)"
                            : "rgba(80, 0, 0, 0.15)",
                          opacity: isFirst ? 0 : 1,
                          flex: 1,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor:
                            item.etaLabel === "Now" || item.etaLabel === "Arriving"
                              ? isDark
                                ? "#FF8FA3"
                                : "#500000"
                              : isDark
                                ? "#2A2A2A"
                                : "#F0F0F0",
                          borderColor: isDark ? "#FF8FA3" : "#500000",
                          shadowColor: isDark ? "#FF8FA3" : "#500000",
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.2)"
                            : "rgba(80, 0, 0, 0.15)",
                          opacity: isLast ? 0 : 1,
                          flex: 1,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.stopContent,
                      {
                        borderBottomColor: isLast
                          ? "transparent"
                          : isDark
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text
                        style={[styles.stopName, { color: COLORS.textPrimary }]}
                      >
                        {item.stop.Name}
                      </Text>
                      <Text
                        style={[
                          styles.stopDetail,
                          { color: COLORS.textSecondary, marginBottom: 6 },
                        ]}
                      >
                        {item.detail}
                      </Text>
                      <View style={styles.detailRow}>
                        <MapPin size={12} color={COLORS.textSecondary} />
                        <Text
                          style={[
                            styles.stopDetail,
                            { color: COLORS.textSecondary },
                          ]}
                        >
                          Stop #{item.stop.StopCode || item.sequence}
                        </Text>
                      </View>
                      {formatDepartureList(item) ? (
                        <View style={[styles.detailRow, { marginTop: 6 }]}>
                          <Clock size={12} color={COLORS.textSecondary} />
                          <Text
                            style={[
                              styles.stopDetail,
                              { color: COLORS.textSecondary },
                            ]}
                          >
                            {formatDepartureList(item)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.etaContainer}>
                      <Text
                        style={[
                          styles.etaBox,
                          {
                            backgroundColor: isDark
                              ? "rgba(255, 143, 163, 0.15)"
                              : "rgba(80, 0, 0, 0.1)",
                            color: isDark ? "#FF8FA3" : "#500000",
                          },
                        ]}
                      >
                        {item.etaLabel}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {stopTimetable.length === 0 && (
              <View style={styles.emptyState}>
                <Clock
                  size={40}
                  color={isDark ? "#FF8FA3" : "#500000"}
                  style={{ opacity: 0.8, marginBottom: 12 }}
                />
                <Text
                  style={[styles.emptyStateText, { color: COLORS.textSecondary }]}
                >
                  {selectedRoute
                    ? "No schedule available for this route."
                    : "Select a route to view its timetable."}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    zIndex: 99999,
    elevation: 999,
  },
  dragHandleArea: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  closeBtn: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 20,
    marginLeft: 10,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 64,
  },
  timelineCol: {
    width: 32,
    alignItems: "center",
    marginRight: 16,
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    zIndex: 2,
    marginVertical: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineLine: {
    width: 4,
    borderRadius: 2,
  },
  stopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  stopName: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "rgba(150, 150, 150, 0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stopDetail: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  etaContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 12,
  },
  etaBox: {
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 15,
    marginTop: 16,
    textAlign: "center",
  },
  loadingContainer: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
});
