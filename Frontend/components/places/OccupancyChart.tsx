import React from "react";
import { View, StyleSheet } from "react-native";
import { getStatusColor } from "./utils";

interface OccupancyChartProps {
  history?: number[];
}

export const OccupancyChart = React.memo(({ history }: OccupancyChartProps) => {
  const data = Array.isArray(history) && history.length > 0 
    ? history 
    : [20, 35, 45, 60, 55, 40, 30, 25]; // Fallback mock for visual consistency

  return (
    <View style={styles.chartContainer}>
      <View style={styles.barsRow}>
        {data.map((val: number, i: number) => (
          <View key={i} style={styles.barWrapper}>
            <View
              style={[
                styles.barFill,
                {
                  height: Math.max(8, (val / 100) * 45),
                  backgroundColor: getStatusColor(val),
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  chartContainer: {
    height: 60,
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 45,
  },
  barWrapper: {
    flex: 1,
    height: 45,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 2,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 2,
  },
});
