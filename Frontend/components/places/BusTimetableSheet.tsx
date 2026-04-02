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
import { X, MapPin, Clock } from "lucide-react-native";
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
          <Text style={[styles.title, { color: COLORS.text }]}>
            {selectedRoute
              ? `Route ${selectedRoute.ShortName}`
              : "Bus Timetable"}
          </Text>
          {selectedRoute && (
            <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
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
        contentContainerStyle={{ paddingBottom: SNAP_FULL + 80 }}
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
        {stopTimetable.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === stopTimetable.length - 1;

          return (
            <TouchableOpacity
              key={item.stop.Id || index}
              style={styles.stopRow}
              onPress={() => onStopPress(item.stop)}
              activeOpacity={0.7}
            >
              <View style={styles.timelineCol}>
                <View
                  style={[
                    styles.timelineLine,
                    {
                      backgroundColor: COLORS.border,
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
                        item.etaLabel === "Now"
                          ? COLORS.primary
                          : COLORS.textTertiary,
                      borderColor:
                        COLORS.surfaceElevated ||
                        COLORS.background ||
                        (isDark ? "#111" : "#fff"),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.timelineLine,
                    {
                      backgroundColor: COLORS.border,
                      opacity: isLast ? 0 : 1,
                      flex: 1,
                    },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.stopContent,
                  { borderBottomColor: isLast ? "transparent" : COLORS.border },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text
                    style={[styles.stopName, { color: COLORS.text }]}
                    numberOfLines={1}
                  >
                    {item.stop.Name}
                  </Text>
                  <View style={styles.detailRow}>
                    <MapPin size={12} color={COLORS.textTertiary} />
                    <Text
                      style={[
                        styles.stopDetail,
                        { color: COLORS.textTertiary },
                      ]}
                    >
                      Stop #{item.stop.StopCode || item.sequence}
                    </Text>
                  </View>
                </View>
                <View style={styles.etaContainer}>
                  <Text
                    style={[
                      styles.etaBox,
                      {
                        backgroundColor:
                          item.etaLabel === "Now"
                            ? `${COLORS.primary}22`
                            : isDark
                              ? "#222"
                              : "#F5F5F5",
                        color:
                          item.etaLabel === "Now"
                            ? COLORS.primary
                            : isDark
                              ? "#AAA"
                              : "#666",
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
            <Clock size={32} color={COLORS.textTertiary} />
            <Text
              style={[styles.emptyStateText, { color: COLORS.textSecondary }]}
            >
              {selectedRoute
                ? "No schedule available for this route."
                : "Select a route to view its timetable."}
            </Text>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    zIndex: 999,
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
    width: 24,
    alignItems: "center",
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 2,
    marginVertical: 4,
  },
  timelineLine: {
    width: 2,
  },
  stopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  stopDetail: {
    fontSize: 13,
    marginLeft: 4,
  },
  etaContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  etaBox: {
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
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
});
