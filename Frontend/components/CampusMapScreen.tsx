import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, Circle, Callout } from "react-native-maps";
import axios from "axios";
import { useTheme } from "./SharedUI";
import { API_URL } from "../config";

const TAMU_CENTER = {
  latitude: 30.6153,
  longitude: -96.341,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

// Known coordinates for TAMU Facilities
const COORD_MAP: Record<string, { lat: number; lng: number }> = {
  // Rec Centers (Key strings)
  "Student Rec": { lat: 30.6071, lng: -96.3454 },
  Southside: { lat: 30.6155, lng: -96.3334 },
  Polo: { lat: 30.6225, lng: -96.3353 },

  // Libraries
  Evans: { lat: 30.6171, lng: -96.3387 },
  Annex: { lat: 30.6171, lng: -96.3387 },
  Cushing: { lat: 30.6166, lng: -96.3386 },
  WCL: { lat: 30.6146, lng: -96.3426 }, // Business
  "West Campus": { lat: 30.6146, lng: -96.3426 },
  MSL: { lat: 30.612, lng: -96.3533 }, // Medical
  Medical: { lat: 30.612, lng: -96.3533 },
  PSEL: { lat: 30.6151, lng: -96.351 },

  // Other known explicit buildings from events
  "Memorial Student Center": { lat: 30.6123, lng: -96.3415 },
  MSC: { lat: 30.6123, lng: -96.3415 },
  Rudder: { lat: 30.613, lng: -96.3406 },
  Wisenbaker: { lat: 30.6202, lng: -96.34 },
  Zachry: { lat: 30.6213, lng: -96.3403 },
  Langford: { lat: 30.6186, lng: -96.3381 },
  Architecture: { lat: 30.6186, lng: -96.3381 },
  "General Services": { lat: 30.6027, lng: -96.3368 },
  "The Gardens": { lat: 30.6137, lng: -96.3496 },
  Forsyth: { lat: 30.6123, lng: -96.3415 },
};

const MAIN_REC_KEYWORDS = [
  "Court",
  "Field",
  "Locker",
  "Boulder Wall",
  "Climbing",
  "Pool",
  "Spa",
  "Strength",
  "Dive",
  "50-Meter",
  "Turf",
  "Gym",
  "Rec",
  "Instructional",
  "Racquetball",
  "Squash",
  "Volleyball",
  "Bag Room",
  "Sauna",
];
const IGNORED = [
  "Zoom",
  "Virtual",
  "Online",
  "Unknown Event Location",
  "Multiple dates",
  "TX, USA",
  "Online",
];
const MAIN_REC_COORD = { lat: 30.6094, lng: -96.34 };

function getCapacityColor(percent: number) {
  if (percent < 40) return "rgba(46, 125, 50, 0.7)"; // Green
  if (percent < 70) return "rgba(237, 108, 2, 0.7)"; // Yellow
  if (percent < 90) return "rgba(230, 81, 0, 0.7)"; // Orange
  return "rgba(198, 40, 40, 0.7)"; // Red
}

function getStrokeColor(percent: number) {
  if (percent < 40) return "#1B5E20";
  if (percent < 70) return "#E65100";
  if (percent < 90) return "#BF360C";
  return "#B71C1C";
}

function getRadius(percent: number) {
  // scale from 50 to 180 meters depending on fullness
  return 50 + (percent / 100) * 130;
}

export function CampusMapScreen() {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTraffic();
  }, []);

  const fetchTraffic = async () => {
    try {
      const res = await axios.get(`${API_URL}/traffic/retrieve`);
      const data = await res.data;
      const mapped = data
        .map((d: any) => {
          let coord = null;
          const safeLocation = d.location || "";
          // 1. Exact string fuzzy matching
          for (const [key, val] of Object.entries(COORD_MAP)) {
            if (safeLocation.toLowerCase().includes(key.toLowerCase())) {
              coord = { lat: val.lat, lng: val.lng };
              break;
            }
          }

          // 2. Main Rec internal layout matching (Catch-all for 'Court', 'Pool', etc)
          if (
            !coord &&
            MAIN_REC_KEYWORDS.some((k) =>
              safeLocation.toLowerCase().includes(k.toLowerCase()),
            )
          ) {
            coord = { lat: MAIN_REC_COORD.lat, lng: MAIN_REC_COORD.lng };
          }

          // 3. Fallback for random valid campus events (exclude generic string)
          if (
            !coord &&
            !IGNORED.some((k) =>
              safeLocation.toLowerCase().includes(k.toLowerCase()),
            ) &&
            safeLocation.trim().length > 3
          ) {
            coord = {
              lat: 30.6153,
              lng: -96.341,
            };
          }

          return { ...d, coord };
        })
        .filter((d: any) => d.coord !== null);
      setLocations(mapped);
    } catch (err) {
      console.warn("Failed to fetch traffic data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>
          Loading live campus traffic...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Campus Traffic Map</Text>
        <Text style={styles.subtitle}>Live Facility and Event Occupancy</Text>
      </View>
      <MapView
        style={styles.map}
        initialRegion={TAMU_CENTER}
        showsUserLocation={true}
      >
        {locations.map((loc, idx) => {
          const radius = getRadius(loc.percent_full);
          const fill = getCapacityColor(loc.percent_full);
          const stroke = getStrokeColor(loc.percent_full);

          return (
            <React.Fragment key={`${loc.location}-${idx}`}>
              <Circle
                center={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                radius={radius}
                fillColor={fill}
                strokeColor={stroke}
                strokeWidth={1}
              />
              <Marker
                coordinate={{
                  latitude: loc.coord.lat,
                  longitude: loc.coord.lng,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                title={loc.location}
                description={`Live Capacity: ${loc.percent_full}%`}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: stroke,
                  }}
                />
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>
    </View>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: "#E0E0E0",
      zIndex: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: COLORS.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: 4,
    },
    map: {
      flex: 1,
      width: "100%",
    },
  });
