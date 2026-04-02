import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Compass, Calendar } from "lucide-react-native";
import { TourTarget, useTour } from "../onboarding/TourProvider";
import { useNavigation } from "@react-navigation/native";
import type { ScheduleMeetingEntry, ScheduleMapOption } from "./types";

interface TodayTimelineProps {
  styles: any;
  COLORS: any;
  activeScheduleOption: ScheduleMapOption | null;
  onGetDirections?: (building: string) => void;
}

export function TodayTimeline({
  styles,
  COLORS,
  activeScheduleOption,
  onGetDirections,
}: TodayTimelineProps) {
  const { advanceStep, activeTargetName } = useTour();
  const navigation = useNavigation<any>();

  // No internal timer; relies on Parent's Master Timer in PlacesMapScreen.tsx 
  // for synchronization of list collapse and tour step advancement.
  const sortedEntries = React.useMemo(() => {
    if (!activeScheduleOption?.entries) return [];
    
    // Fail-safe sorting utility
    const parseTime = (timeStr: string): number => {
      if (!timeStr || timeStr === "Time TBA") return 0;
      const normalized = timeStr.replace(/[\u202f\u00a0\s]+/g, " ").trim();
      const match = normalized.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return h * 60 + m;
      }
      return 0;
    };

    return [...activeScheduleOption.entries].sort((a: any, b: any) => {
      const tA = parseTime(a.timeLabel) || (a.date_ts ? (new Date(a.date_ts * 1000).getHours() * 60 + new Date(a.date_ts * 1000).getMinutes()) : 0);
      const tB = parseTime(b.timeLabel) || (b.date_ts ? (new Date(b.date_ts * 1000).getHours() * 60 + new Date(b.date_ts * 1000).getMinutes()) : 0);
      if (tA !== tB) return tA - tB;
      return (a.date_ts || 0) - (b.date_ts || 0);
    });
  }, [activeScheduleOption]);

  if (!activeScheduleOption || !sortedEntries.length) {
    return (
      <View style={localStyles.emptyContainer}>
        <Text style={localStyles.emptyText}>No events scheduled for Today.</Text>
      </View>
    );
  }

  const handleGetDirections = (entry: ScheduleMeetingEntry) => {
    if (onGetDirections && entry.building) {
      onGetDirections(entry.building);
    } else {
      const query = encodeURIComponent(`${entry.building || entry.locationLabel} TAMU`);
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
      Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
    }
  };

  const getDotColor = (type?: string) => {
    return type === "event" ? "#FF9500" : "#500000"; // Orange for events, Maroon for classes
  };

  return (
    <TourTarget name="schedule-preview">
      <View style={localStyles.container}>
        <View style={localStyles.timelineLine} />
        
        {sortedEntries.map((entry, index) => {
          const dotColor = getDotColor(entry.type);
          const isEvent = entry.type === "event";

          return (
            <View key={`${entry.id}-${index}`} style={localStyles.timelineItem}>
              <View style={localStyles.timeContainer}>
                <Text style={localStyles.timeText}>
                  {entry.timeLabel.split("-")[0].trim().replace(/^0/, '')}
                </Text>
              </View>

              {/* Middle: Dot */}
              <View style={localStyles.dotContainer}>
                <View style={[localStyles.dot, { backgroundColor: dotColor }]} />
              </View>

              {/* Right side: Content */}
              <View style={localStyles.contentContainer}>
                <View style={localStyles.eventCard}>
                  <View style={localStyles.eventHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={localStyles.eventTitle} numberOfLines={2}>
                        {entry.code} {entry.name}
                      </Text>
                      <Text style={localStyles.eventLocation}>
                        {entry.locationLabel || "On Campus"}
                      </Text>
                    </View>
                    <View style={[localStyles.badge, { backgroundColor: isEvent ? "rgba(255,149,0,0.1)" : "rgba(255,255,255,0.06)" }]}>
                      <Text style={[localStyles.badgeText, { color: isEvent ? "#FF9500" : "#AAA" }]}>
                        {isEvent ? "EVENT" : "CLASS"}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={localStyles.directionsButton}
                    onPress={() => handleGetDirections(entry)}
                  >
                    <Compass size={14} color="#007AFF" />
                    <Text style={localStyles.directionsText}>Get Directions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </TourTarget>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 0, // Align exactly with sheet margin (16px from PlacesList)
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    left: 87, // Center of dot container (74+13)
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    zIndex: 0,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
    zIndex: 1,
  },
  timeContainer: {
    width: 74, // Narrowed for 14pt labels
    alignItems: "flex-start", // Left-align text with sheet header
    paddingRight: 0,
    justifyContent: "flex-start",
    paddingTop: 1,
  },
  timeText: {
    color: "#FFF",
    fontSize: 14, // Decreased as requested
    fontWeight: "900",
    opacity: 1.0,
    textAlign: "right",
    letterSpacing: -0.3,
  },
  dotContainer: {
    width: 26,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(12, 12, 14, 1)",
  },
  contentContainer: {
    flex: 1,
    paddingLeft: 4,
  },
  eventCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  eventHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  eventTitle: {
    color: "#FFF",
    fontSize: 13.5, // Slightly smaller
    fontWeight: "800",
    marginBottom: 2,
    lineHeight: 18,
  },
  eventLocation: {
    color: "#AAA",
    fontSize: 13,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  directionsText: {
    color: "#007AFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#AAA",
    fontSize: 14,
    fontWeight: "600",
  },
});
