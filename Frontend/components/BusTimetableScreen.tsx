import React from 'react';
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bus, ChevronLeft, Clock3, MapPin } from 'lucide-react-native';
import { useTheme } from './SharedUI';

function RouteBadge({ shortName, color }: { shortName?: string; color?: string }) {
  return (
    <View style={[styles.routeBadge, { backgroundColor: color || '#500000' }]}>
      <Text style={styles.routeBadgeText}>{shortName || '??'}</Text>
    </View>
  );
}

function getStopLabel(stop: any) {
  return stop?.Name || stop?.StopName || stop?.Description || stop?.StopCode || 'Transit Stop';
}

function TimetableRow({ entry }: { entry: any }) {
  return (
    <View style={styles.row}>
      <View style={styles.sequence}>
        <Text style={styles.sequenceText}>{entry.sequence}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stopName} numberOfLines={1}>
          {getStopLabel(entry.stop)}
        </Text>
        <Text style={styles.stopMeta}>{entry.detail}</Text>
      </View>
      <Text style={styles.eta}>{entry.etaLabel}</Text>
    </View>
  );
}

export default function BusTimetableScreen({ navigation, route }: any) {
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const mode = route.params?.mode || 'single';
  const routeInfo = route.params?.route;
  const entries = route.params?.entries || [];
  const boards = route.params?.boards || [];
  const liveBusCount = route.params?.liveBusCount || 0;
  const nearbyTransitInsight = route.params?.nearbyTransitInsight;

  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : darkMode
      ? require('../assets/black_marble.jpg')
      : require('../assets/white_marble.jpg');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: darkMode ? '#060607' : '#F5F2EC' }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: darkMode ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.70)' },
          ]}
        />
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color="#F3F1ED" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {mode === 'all' ? 'All Route Timetables' : `${routeInfo?.Name || 'Bus Route'} Timetable`}
            </Text>
            <Text style={styles.subtitle}>
              {liveBusCount > 0 ? `${liveBusCount} buses live` : 'Route map loaded'}
            </Text>
          </View>
        </View>

        {mode === 'single' ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <RouteBadge shortName={routeInfo?.ShortName} color={routeInfo?.Color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>{routeInfo?.Name || 'Transit route'}</Text>
                  <Text style={styles.heroSub}>Tap any stop on the map to track the nearest bus.</Text>
                </View>
              </View>

              {nearbyTransitInsight ? (
                <View style={styles.insightCard}>
                  <View style={styles.insightRow}>
                    <MapPin size={14} color="#F3F1ED" />
                    <Text style={styles.insightText}>
                      {nearbyTransitInsight.nearestStop
                        ? `${nearbyTransitInsight.nearestStop.stop.Name} is ${Math.round(
                            nearbyTransitInsight.nearestStop.distanceMeters,
                          )} m away.`
                        : 'No nearby stop detected yet.'}
                    </Text>
                  </View>
                  {nearbyTransitInsight.nearestVehicle ? (
                    <View style={styles.insightRow}>
                      <Bus size={14} color="#F3F1ED" />
                      <Text style={styles.insightText}>
                        Closest bus is about {Math.round(nearbyTransitInsight.nearestVehicle.distanceMeters)} m away.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <Clock3 size={15} color="#F3F1ED" />
              <Text style={styles.sectionTitle}>Stop Board</Text>
            </View>

            <View style={styles.boardCard}>
              {entries.length > 0 ? (
                entries.map((entry: any) => (
                  <TimetableRow key={`${routeInfo?.Key || 'route'}-${entry.stop?.StopCode || entry.sequence}`} entry={entry} />
                ))
              ) : (
                <Text style={styles.emptyText}>No timetable entries are available for this route yet.</Text>
              )}
            </View>
          </>
        ) : (
          <>
            {boards.length > 0 ? (
              boards.map((board: any) => (
                <View key={board.route?.Key || board.route?.Name} style={styles.boardCard}>
                  <View style={styles.heroHeader}>
                    <RouteBadge shortName={board.route?.ShortName} color={board.route?.Color} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroTitle}>{board.route?.Name || 'Route'}</Text>
                      <Text style={styles.heroSub}>
                        {board.liveCount > 0 ? `${board.liveCount} buses live` : 'Route loaded'}
                      </Text>
                    </View>
                  </View>
                  {board.entries.length > 0 ? (
                    board.entries.map((entry: any) => (
                      <TimetableRow
                        key={`${board.route?.Key || board.route?.Name}-${entry.stop?.StopCode || entry.sequence}`}
                        entry={entry}
                      />
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Stop timetable unavailable for this route.</Text>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.boardCard}>
                <Text style={styles.emptyText}>Route timetables are still loading.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,10,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
  },
  title: { color: '#F3F1ED', fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: '#C8C8CF', fontSize: 12, fontWeight: '600', marginTop: 3 },
  heroCard: {
    backgroundColor: 'rgba(12,12,14,0.86)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    marginBottom: 18,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { color: '#F3F1ED', fontSize: 18, fontWeight: '800' },
  heroSub: { color: '#A7A7AE', fontSize: 12, marginTop: 3 },
  routeBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  insightCard: {
    marginTop: 16,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 14,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightText: { color: '#E0E0E6', fontSize: 12, lineHeight: 18, flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { color: '#F3F1ED', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  boardCard: {
    backgroundColor: 'rgba(12,12,14,0.86)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sequence: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequenceText: { color: '#F3F1ED', fontSize: 11, fontWeight: '800' },
  stopName: { color: '#F3F1ED', fontSize: 14, fontWeight: '700' },
  stopMeta: { color: '#A7A7AE', fontSize: 11, marginTop: 3 },
  eta: { color: '#F3F1ED', fontSize: 13, fontWeight: '800' },
  emptyText: { color: '#A7A7AE', fontSize: 13, lineHeight: 20 },
});
