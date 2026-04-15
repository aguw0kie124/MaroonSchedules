import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ScheduleMeetingEntry } from "./types";
import { formatScheduleDays } from "./utils";

interface ClassMeetingCardProps {
  meeting: ScheduleMeetingEntry;
}

export const ClassMeetingCard = React.memo(({ meeting }: ClassMeetingCardProps) => {
  return (
    <View style={styles.classMeetingCard}>
      <View style={styles.classMeetingHeader}>
        <Text style={styles.classMeetingCode}>{meeting.code}</Text>
        <Text style={styles.classMeetingTime}>{meeting.timeLabel}</Text>
      </View>
      <Text style={styles.classMeetingName}>{meeting.name}</Text>
      <Text style={styles.classMeetingMeta}>
        {formatScheduleDays(meeting.days)}
        {meeting.room ? ` · Room ${meeting.room}` : ""}
      </Text>
      {meeting.scheduleLabel ? (
        <Text style={styles.classMeetingScheduleLabel}>
          {meeting.scheduleLabel}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  classMeetingCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  classMeetingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  classMeetingCode: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  classMeetingTime: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.8,
  },
  classMeetingName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  classMeetingMeta: {
    color: "#AAA",
    fontSize: 12,
    fontWeight: "500",
  },
  classMeetingScheduleLabel: {
    color: "#500000",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.9)",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
    overflow: "hidden",
  },
});
