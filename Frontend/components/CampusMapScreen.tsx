import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, Circle, Callout } from "react-native-maps";
import { useTheme } from "./SharedUI";
import { fetchCampusPlacesMap } from "../api/client";

const TAMU_CENTER = {
  latitude: 30.6153,
  longitude: -96.341,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

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
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      const snapshot = await fetchCampusPlacesMap();
      const mapped = Array.isArray(snapshot?.locations)
        ? snapshot.locations.filter((loc: any) => loc?.coord && !loc?.searchOnly)
        : [];
      setLocations(mapped);
    } catch (err) {
      console.warn("Failed to fetch places map snapshot", err);
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
          Loading campus places...
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
              {loc.coord && (
                <Circle
                  center={{
                    latitude: loc.coord?.lat || 0,
                    longitude: loc.coord?.lng || 0,
                  }}
                  radius={radius}
                  fillColor={fill}
                  strokeColor={stroke}
                  strokeWidth={1}
                />
              )}
              {loc.coord && (
                <Marker
                  coordinate={{
                    latitude: loc.coord?.lat || 0,
                    longitude: loc.coord?.lng || 0,
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
              )}
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
