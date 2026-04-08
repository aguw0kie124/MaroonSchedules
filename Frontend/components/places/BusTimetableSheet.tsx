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
} from "react-native";
import { X, MapPin, Clock, Navigation } from "lucide-react-native";
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
  }>;
  onStopPress: (stop: any) => void;
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

  const routeColor = selectedRoute?.Color || (isDark ? "#FF8FA3" : "#500000");

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#1A1A1C" : "#FFFFFF",
          borderTopColor: COLORS.border || "rgba(0,0,0,0.1)",
          transform: [{ translateY: panY }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 20,
        },
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
        <View
          style={[
            styles.dragHandle,
            { backgroundColor: isDark ? "#444" : "#D1D1D6" },
          ]}
        />
      </View>

      {/* Hero Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: isDark ? "#1A1A1C" : "#FFFFFF" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {selectedRoute && (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: routeColor,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text
                  style={{ color: routeColor, fontWeight: "900", fontSize: 20 }}
                >
                  {selectedRoute.ShortName}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.title,
                  {
                    color: isDark ? "#F2F2F7" : "#1C1C1E",
                  },
                ]}
                numberOfLines={1}
              >
                {selectedRoute ? selectedRoute.Name : "Bus Timetable"}
              </Text>
              {selectedRoute && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <View
                    style={[
                      styles.pulseDot,
                      {
                        backgroundColor:
                          liveBusCount > 0 ? "#34C759" : "#FF3B30",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.subtitle,
                      { color: isDark ? "#EBEBF5" : "#8E8E93" },
                    ]}
                  >
                    {liveBusCount} live bus{liveBusCount === 1 ? "" : "es"} on
                    route
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={[
            styles.closeBtn,
            { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
          ]}
          hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
        >
          <X size={20} color={isDark ? "#EBEBF5" : "#8E8E93"} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.listContainer}
        contentContainerStyle={{
          paddingBottom: SCREEN_HEIGHT / 2,
          paddingTop: 10,
        }}
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
        {stopTimetable.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
              ]}
            >
              <Clock size={36} color={routeColor} />
            </View>
            <Text
              style={[
                styles.emptyStateTitle,
                { color: isDark ? "#F2F2F7" : "#1C1C1E" },
              ]}
            >
              No Active Schedule
            </Text>
            <Text
              style={[
                styles.emptyStateText,
                { color: isDark ? "#8E8E93" : "#8E8E93" },
              ]}
            >
              {selectedRoute
                ? "This route has no currently scheduled stops."
                : "Select a route to view exactly when it arrives."}
            </Text>
          </View>
        ) : (
          <View style={styles.timelineWrapper}>
            {/* Continuous background line for timeline */}
            <View
              style={[
                styles.continuousLine,
                { backgroundColor: isDark ? "#3A3A3C" : "#E5E5EA" },
              ]}
            />

            {stopTimetable.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === stopTimetable.length - 1;
              const isLiveOrSoon =
                item.etaLabel === "Now" ||
                item.etaLabel === "Arriving" ||
                parseInt(item.etaLabel) <= 5;
              const isNow =
                item.etaLabel === "Now" || item.etaLabel === "Arriving";

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
                        styles.timelineDot,
                        {
                          backgroundColor: isNow
                            ? routeColor
                            : isDark
                              ? "#1A1A1C"
                              : "#FFFFFF",
                          borderColor: isLiveOrSoon
                            ? routeColor
                            : isDark
                              ? "#48484A"
                              : "#C7C7CC",
                          borderWidth: isNow ? 0 : 3,
                          width: isNow ? 16 : 14,
                          height: isNow ? 16 : 14,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.stopContent}>
                    <View style={styles.stopTextContainer}>
                      <Text
                        style={[
                          styles.stopName,
                          {
                            color: isDark ? "#F2F2F7" : "#1C1C1E",
                            fontWeight: isLiveOrSoon ? "800" : "600",
                          },
                        ]}
                      >
                        {item.stop.Name}
                      </Text>
                      <View style={styles.detailRow}>
                        <MapPin
                          size={12}
                          color={isDark ? "#8E8E93" : "#8E8E93"}
                        />
                        <Text
                          style={[
                            styles.stopDetail,
                            { color: isDark ? "#8E8E93" : "#8E8E93" },
                          ]}
                        >
                          Stop #{item.stop.StopCode || item.sequence}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.etaContainer}>
                      <View
                        style={[
                          styles.etaBox,
                          isNow && styles.etaBoxNow,
                          {
                            backgroundColor: isNow
                              ? routeColor
                              : isLiveOrSoon
                                ? isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.05)"
                                : "transparent",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.etaText,
                            {
                              color: isNow
                                ? "#FFFFFF"
                                : isDark
                                  ? "#F2F2F7"
                                  : "#1C1C1E",
                              fontWeight: isNow ? "900" : "700",
                            },
                          ]}
                        >
                          {item.etaLabel}
                        </Text>
                        {!isNow && /^\d+$/.test(item.etaLabel) && (
                          <Text
                            style={[
                              styles.etaUnit,
                              { color: isDark ? "#8E8E93" : "#8E8E93" },
                            ]}
                          >
                            min
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    zIndex: 99999,
    elevation: 999,
  },
  dragHandleArea: {
    width: "100%",
    paddingTop: 14,
    paddingBottom: 10,
    alignItems: "center",
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.15)",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 10,
    borderRadius: 20,
    marginLeft: 16,
  },
  listContainer: {
    flex: 1,
  },
  timelineWrapper: {
    paddingHorizontal: 24,
    position: "relative",
  },
  continuousLine: {
    position: "absolute",
    left: 45, // 24 (padding) + 21 (center of timelineCol)
    top: 30,
    bottom: 60,
    width: 3,
    borderRadius: 1.5,
    zIndex: 1,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 74,
  },
  timelineCol: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineDot: {
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  stopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
  },
  stopTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  stopName: {
    fontSize: 17,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stopDetail: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  etaContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  etaBox: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  etaBoxNow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  etaText: {
    fontSize: 17,
    letterSpacing: 0.5,
  },
  etaUnit: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 3,
  },
  emptyState: {
    padding: 40,
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
});
