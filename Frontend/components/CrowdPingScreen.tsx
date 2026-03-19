import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { COLORS, Card } from './SharedUI';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

const VIBE_OPTIONS = ['Focused', 'Chill', 'Social', 'Energetic', 'Stressful'] as const;
type Vibe = typeof VIBE_OPTIONS[number];

const CAMPUS_SPOTS = [
  'Evans Library', 'Sbisa Dining Hall', 'Student Rec Center',
  'Memorial Student Center', 'Zachry Engineering', 'Blocker Building',
  'West Campus Library', 'Rudder Tower', 'Commons Dining',
  'Hullabaloo Hall', 'Annex Library',
];

interface CrowdPing {
  id: string;
  place: string;
  crowded: number;
  loud: number;
  vibe: Vibe;
  notes: string;
  timestamp: number;
  likes: number;
}

// Local storage for pings (in a real app, this would be API-backed)
let localPings: CrowdPing[] = [];

const VIBE_EMOJI: Record<Vibe, string> = {
  Focused: '🎯',
  Chill: '😎',
  Social: '🗣️',
  Energetic: '⚡',
  Stressful: '😰',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CrowdPingScreen() {
  const [pings, setPings] = useState<CrowdPing[]>(localPings);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [place, setPlace] = useState('');
  const [crowded, setCrowded] = useState(5);
  const [loud, setLoud] = useState(4);
  const [vibe, setVibe] = useState<Vibe>('Chill');
  const [notes, setNotes] = useState('');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPings([...localPings]);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleSubmit = async () => {
    if (!place.trim()) {
      Alert.alert('Missing info', 'Please select a campus spot.');
      return;
    }
    Keyboard.dismiss();
    setSubmitting(true);

    const newPing: CrowdPing = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      place: place.trim(),
      crowded,
      loud,
      vibe,
      notes: notes.trim(),
      timestamp: Date.now(),
      likes: 0,
    };

    localPings = [newPing, ...localPings];
    setPings([...localPings]);
    setShowForm(false);
    resetForm();
    setSubmitting(false);
  };

  const resetForm = () => {
    setPlace('');
    setCrowded(5);
    setLoud(4);
    setVibe('Chill');
    setNotes('');
  };

  const handleLike = (id: string) => {
    localPings = localPings.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p));
    setPings([...localPings]);
  };

  const getCrowdLabel = (n: number) => {
    if (n <= 2) return 'Empty';
    if (n <= 5) return 'Light';
    if (n <= 7) return 'Busy';
    return 'Packed';
  };

  const getCrowdColor = (n: number) => {
    if (n <= 2) return '#32D74B';
    if (n <= 5) return '#FF9500';
    if (n <= 7) return '#FF6B00';
    return '#FF3B30';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>📡 CrowdPing</Text>
            <Text style={styles.subtitle}>Crowdsourced campus vibes</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.newPingBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowForm(!showForm)}
          >
            <Text style={styles.newPingText}>{showForm ? '✕ Cancel' : '+ New Ping'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Form */}
        {showForm && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Drop a Ping 📡</Text>

            {/* Place picker */}
            <Text style={styles.formLabel}>Where are you?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
              {CAMPUS_SPOTS.map((spot) => (
                <Pressable
                  key={spot}
                  style={[styles.spotChip, place === spot && styles.spotChipActive]}
                  onPress={() => setPlace(spot)}
                >
                  <Text style={[styles.spotChipText, place === spot && styles.spotChipTextActive]}>{spot}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Crowded slider (simplified as buttons) */}
            <Text style={styles.formLabel}>How crowded? ({getCrowdLabel(crowded)})</Text>
            <View style={styles.sliderRow}>
              {[1, 3, 5, 7, 9].map((val) => (
                <Pressable
                  key={val}
                  style={[styles.sliderBtn, crowded === val && { backgroundColor: getCrowdColor(val) }]}
                  onPress={() => setCrowded(val)}
                >
                  <Text style={[styles.sliderBtnText, crowded === val && { color: '#FFF' }]}>{val}</Text>
                </Pressable>
              ))}
            </View>

            {/* Loud slider */}
            <Text style={styles.formLabel}>How loud? ({loud <= 3 ? 'Quiet' : loud <= 6 ? 'Moderate' : 'Loud'})</Text>
            <View style={styles.sliderRow}>
              {[1, 3, 5, 7, 9].map((val) => (
                <Pressable
                  key={val}
                  style={[styles.sliderBtn, loud === val && { backgroundColor: COLORS.primary }]}
                  onPress={() => setLoud(val)}
                >
                  <Text style={[styles.sliderBtnText, loud === val && { color: '#FFF' }]}>{val}</Text>
                </Pressable>
              ))}
            </View>

            {/* Vibe */}
            <Text style={styles.formLabel}>Vibe?</Text>
            <View style={styles.vibeRow}>
              {VIBE_OPTIONS.map((v) => (
                <Pressable
                  key={v}
                  style={[styles.vibeChip, vibe === v && styles.vibeChipActive]}
                  onPress={() => setVibe(v)}
                >
                  <Text style={styles.vibeEmoji}>{VIBE_EMOJI[v]}</Text>
                  <Text style={[styles.vibeText, vibe === v && styles.vibeTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.formLabel}>Quick note (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. 2nd floor is quieter…"
              placeholderTextColor={COLORS.textSecondary}
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, 140))}
              multiline
            />
            <Text style={styles.charCount}>{notes.length}/140</Text>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.8 }, submitting && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Submit Ping</Text>}
            </Pressable>
          </Card>
        )}

        {/* Feed */}
        {!showForm && pings.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📡</Text>
            <Text style={styles.emptyTitle}>No pings yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to share what campus looks like right now!</Text>
          </View>
        )}

        {pings.map((ping) => (
          <Card key={ping.id} style={styles.pingCard}>
            <View style={styles.pingHeader}>
              <Text style={styles.pingPlace}>{ping.place}</Text>
              <Text style={styles.pingTime}>{timeAgo(ping.timestamp)}</Text>
            </View>
            <View style={styles.pingStats}>
              <View style={[styles.statBadge, { backgroundColor: getCrowdColor(ping.crowded) + '22' }]}>
                <Text style={[styles.statText, { color: getCrowdColor(ping.crowded) }]}>
                  {getCrowdLabel(ping.crowded)} ({ping.crowded}/10)
                </Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: '#3B82F622' }]}>
                <Text style={[styles.statText, { color: '#3B82F6' }]}>
                  🔊 {ping.loud}/10
                </Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: '#8B5CF622' }]}>
                <Text style={[styles.statText, { color: '#8B5CF6' }]}>
                  {VIBE_EMOJI[ping.vibe]} {ping.vibe}
                </Text>
              </View>
            </View>
            {ping.notes ? <Text style={styles.pingNotes}>"{ping.notes}"</Text> : null}
            <Pressable onPress={() => handleLike(ping.id)} style={styles.likeBtn}>
              <Text style={styles.likeText}>👍 {ping.likes > 0 ? ping.likes : ''} Helpful</Text>
            </Pressable>
          </Card>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: COLORS.primary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  newPingBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 },
  newPingText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  formCard: { padding: 18 },
  formTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 14 },
  formLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  chipsScroll: { maxHeight: 40 },
  chipsContent: { gap: 8, flexDirection: 'row' },
  spotChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  spotChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  spotChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  spotChipTextActive: { color: '#FFF' },
  sliderRow: { flexDirection: 'row', gap: 8 },
  sliderBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1A1A1A', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  sliderBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  vibeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  vibeEmoji: { fontSize: 16 },
  vibeText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  vibeTextActive: { color: '#FFF' },
  notesInput: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, fontSize: 14, color: '#FFFFFF', minHeight: 60, borderWidth: 1, borderColor: '#2A2A2A', textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
  pingCard: { padding: 14 },
  pingHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pingPlace: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  pingTime: { fontSize: 12, color: COLORS.textSecondary },
  pingStats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  statBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statText: { fontSize: 12, fontWeight: '700' },
  pingNotes: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 8, lineHeight: 20 },
  likeBtn: { alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  likeText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});
