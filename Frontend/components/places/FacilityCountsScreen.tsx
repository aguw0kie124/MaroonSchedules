import React, { useState, useMemo, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ArrowLeft, Clock, Activity, MapPin, RefreshCw, AlertCircle, Search, X } from "lucide-react-native";
import { useTheme } from "../SharedUI";
import { useNavigation, useRoute } from "@react-navigation/native";
import { OccupancyChart } from "./OccupancyChart";
import type { CampusLocation, FacilityCountEntry } from "./types";
import { useDiningTheme } from "../dining/DiningTheme";
import { Card, SectionLabel, Badge } from "../dining/DiningUI";
import { getLiveHoursForFacility } from "./campusData";
import { getStatusColor as getCapacityColorRaw } from "./utils";
import { fetchFacilityCounts as getLazyFacilityCounts } from "../../api/client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getCapacityColor(percent: number | null, T: any) {
  return getCapacityColorRaw(percent);
}

function CircularProgress({ percent, isClosed, size = 80, strokeWidth = 6, isDark, T }: { 
  percent: number | null, 
  isClosed: boolean,
  size?: number, 
  strokeWidth?: number, 
  isDark: boolean,
  T: any
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const validPercent = isClosed || percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (validPercent / 100) * circumference;
  
  const statusColor = isClosed ? "#EF4444" : getCapacityColor(percent, T);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {!isClosed && percent !== null && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={statusColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        )}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ 
            fontSize: size * 0.22, 
            fontWeight: '800', 
            color: isClosed ? "#EF4444" : getCapacityColor(percent, T) 
          }}>
            {isClosed ? "OFF" : (percent !== null ? `${Math.round(percent)}%` : "N/A")}
          </Text>
      </View>
    </View>
  );
}

export default function FacilityCountsScreen() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const T = { ...useDiningTheme(isDark), primary: COLORS.primary };
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const location = route.params?.location as CampusLocation;
  
  const [lazyCounts, setLazyCounts] = useState<FacilityCountEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(() => {
    if (!location?.placeId) return;
    setLoading(true);
    getLazyFacilityCounts(location.placeId, true)
      .then(res => {
        if (res?.facility_counts) {
          setLazyCounts(res.facility_counts);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      })
      .catch(err => console.error("[FacilityCountsScreen] Refresh error:", err))
      .finally(() => setLoading(false));
  }, [location?.placeId]);

  useEffect(() => {
    if (location?.placeId && !location.facility_counts?.length) {
      setLoading(true);
      getLazyFacilityCounts(location.placeId)
        .then(res => {
          if (res?.facility_counts) {
            setLazyCounts(res.facility_counts);
          }
        })
        .catch(err => console.error("[FacilityCountsScreen] fetch error:", err))
        .finally(() => setLoading(false));
    }
  }, [location?.placeId, location?.facility_counts]);

  const facilityCounts = (location?.facility_counts?.length ? location.facility_counts : lazyCounts) || [];
  const dynamicHours = getLiveHoursForFacility(location?.location);
  const isOverallClosed = dynamicHours?.toLowerCase().includes("closed");

  const filteredCounts = useMemo(() => {
    if (!searchQuery.trim()) return facilityCounts;
    const q = searchQuery.toLowerCase();
    return facilityCounts.filter(f => f.location_name.toLowerCase().includes(q));
  }, [facilityCounts, searchQuery]);

  const formatLiveTimestamp = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
           <ArrowLeft size={24} color={T.text} />
         </TouchableOpacity>
         <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: T.text }]} numberOfLines={1}>{location?.location || "Occupancy"}</Text>
            {dynamicHours && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Clock size={12} color={T.text3} />
                <Text style={[styles.subtitle, { color: T.text3 }]}>{dynamicHours}</Text>
              </View>
            )}
         </View>
         <TouchableOpacity 
           style={styles.refreshBtn} 
           onPress={refreshData}
           disabled={loading}
         >
            {loading ? (
              <ActivityIndicator size="small" color={T.primary} />
            ) : (
              <RefreshCw size={22} color={T.primary} />
            )}
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!loading && (
          <View style={[styles.heroSection, { backgroundColor: T.bg2, borderColor: T.border }]}>
             <View style={styles.heroMain}>
                <CircularProgress 
                  percent={location?.percent_full ?? (location?.current_count && location?.capacity ? (location.current_count / location.capacity) * 100 : 0)} 
                  isClosed={isOverallClosed} 
                  size={90} 
                  strokeWidth={8} 
                  isDark={isDark} 
                  T={T} 
                />
                <View style={styles.heroText}>
                   <Text style={[styles.heroLabel, { color: T.text3 }]}>Overall Occupancy</Text>
                   <Text style={[styles.heroValue, { color: T.text }]}>
                      {isOverallClosed ? "Facility Closed" : `${Math.round(location?.percent_full ?? 0)}% Full`}
                   </Text>
                   <View style={styles.metaRowInline}>
                      <Activity size={14} color={T.primary} />
                      <Text style={[styles.heroMeta, { color: T.text2 }]}>
                         {facilityCounts.length > 0 
                           ? `${facilityCounts.filter(f => !f.is_closed).length} of ${facilityCounts.length} areas open`
                           : "Live occupancy data"}
                      </Text>
                   </View>
                </View>
             </View>
             {location?.traffic_history && (
               <View style={styles.heroChart}>
                 <Text style={[styles.chartHeader, { color: T.text2 }]}>Foot Traffic Trend</Text>
                  <OccupancyChart history={location.traffic_history} />
               </View>
             )}
          </View>
        )}

        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitleLabel, { color: T.text }]}>Facility Areas</Text>
           <View style={[styles.searchBar, { backgroundColor: T.bg2, borderColor: T.border, flex: 1, marginLeft: 16 }]}>
             <Search size={16} color={T.text3} style={{ marginRight: 8 }} />
             <TextInput
               placeholder="Search..."
               placeholderTextColor={T.text3}
               style={[styles.searchInput, { color: T.text }]}
               value={searchQuery}
               onChangeText={setSearchQuery}
             />
           </View>
        </View>
        {loading ? (
          <View style={{ paddingVertical: 100, alignItems: 'center' }}>
            <ActivityIndicator color={T.primary} size="large" />
            <Text style={{ marginTop: 12, color: T.text3, fontSize: 14 }}>Loading live data...</Text>
          </View>
        ) : filteredCounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AlertCircle size={48} color={T.text3} style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: T.text3 }]}>No facilities found matching your search.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredCounts.map((item, idx) => {
              const isClosed = item.is_closed || isOverallClosed;
              const statusColor = isClosed ? "#FF3B30" : getCapacityColor(item.percent_full, T);
              
              return (
                <View key={`${item.location_name}-${idx}`} style={[styles.gridItem, { width: (SCREEN_WIDTH - 48) / 2 }]}>
                   <Card style={[styles.facilityCard, { backgroundColor: T.bg2, borderColor: T.border }]}>
                      <View style={styles.cardHeader}>
                         <CircularProgress 
                           percent={item.percent_full} 
                           isClosed={isClosed} 
                           size={64} 
                           strokeWidth={5} 
                           isDark={isDark} 
                           T={T} 
                         />
                      </View>
                      
                      <View style={styles.cardBody}>
                         <Text style={[styles.cardTitle, { color: T.text }]} numberOfLines={2}>{item.location_name}</Text>
                         
                         <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusText, { color: statusColor }]}>
                               {isClosed ? "CLOSED" : (item.percent_full != null ? "OPEN" : "N/A")}
                            </Text>
                         </View>

                         <View style={styles.metaRow}>
                            <Activity size={12} color={T.text3} />
                            <Text style={[styles.metaText, { color: T.text3 }]}>{item.current_count ?? 0} active</Text>
                         </View>
                      </View>

                      <View style={[styles.cardFooter, { borderTopColor: T.border }]}>
                         <Text style={[styles.updatedText, { color: T.text3 }]}>
                            {item.last_updated ? formatLiveTimestamp(item.last_updated) : "Live"}
                         </Text>
                      </View>
                   </Card>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 20,
    paddingBottom: 15,
    gap: 15,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  refreshBtn: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 15,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {
    marginBottom: 0,
  },
  facilityCard: {
    borderRadius: 20,
    padding: 16,
    height: 230,
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  cardBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 10,
    alignItems: 'center',
  },
  updatedText: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.8,
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroSection: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
    gap: 20,
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metaRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroMeta: {
    fontSize: 14,
    fontWeight: '600',
  },
  heroChart: {
    marginTop: 8,
    gap: 12,
  },
  chartHeader: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionTitleLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
});
