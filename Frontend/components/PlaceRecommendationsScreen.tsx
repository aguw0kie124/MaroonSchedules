import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from 'react-native';
import { COLORS, Card } from './SharedUI';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const SUGGESTION_CHIPS = [
  'Best study spots right now',
  'Quiet coffee shop near MSC',
  'Late night food options',
  'Best place to work out',
  'Where to eat between classes',
  'Hidden gems on campus',
];

interface Recommendation {
  name: string;
  percent_full: number;
  available_seats: number;
  reason?: string;
}

export function PlaceRecommendationsScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) return;

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setLastQuery(q);

    try {
      let recommendations: Recommendation[] = [];

      // Step 1: Fetch live traffic data from backend
      let trafficData: any[] = [];
      try {
        const trafficRes = await fetch(`${API_URL}/traffic/retrieve`);
        if (trafficRes.ok) {
          const raw = await trafficRes.json();
          // Filter out event entries with no real location
          trafficData = (raw || []).filter((item: any) =>
            item.location && !item.location.toLowerCase().includes('unknown')
          );
        }
      } catch {
        console.warn('[PlaceRec] Could not fetch traffic data');
      }

      // Step 2: Use Gemini to pick the best spots based on query + live data
      if (GEMINI_API_KEY && trafficData.length > 0) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `You are a Texas A&M University campus assistant. A student asked: "${q}"

Here is live occupancy data for campus locations:
${JSON.stringify(trafficData.slice(0, 25))}

Pick the top 3 locations that best answer the student's query. Prefer locations with lower percent_full.
Return ONLY a JSON array, no markdown fences, no explanation. Each object:
[{"name":"Location Name","percent_full":25.0,"available_seats":150,"reason":"Brief reason this is a great pick"}]`,
                  }],
                }],
              }),
            },
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
            let parsed: any = null;
            try {
              parsed = JSON.parse(cleaned);
            } catch {
              const match = cleaned.match(/\[[\s\S]*\]/);
              if (match) {
                try { parsed = JSON.parse(match[0]); } catch {}
              }
            }
            if (Array.isArray(parsed) && parsed.length > 0) {
              recommendations = parsed.slice(0, 5).map((item: any) => ({
                name: String(item.name || ''),
                percent_full: Number(item.percent_full ?? 0),
                available_seats: Number(item.available_seats ?? 0),
                reason: String(item.reason || ''),
              }));
            }
          } else {
            console.warn('[PlaceRec] Gemini returned status', geminiRes.status);
          }
        } catch (e) {
          console.warn('[PlaceRec] Gemini call failed:', e);
        }
      }

      // Step 3: Local keyword fallback if Gemini failed or was rate-limited
      if (recommendations.length === 0 && trafficData.length > 0) {
        const queryWords = q.toLowerCase().split(/\s+/);
        let matched = trafficData.filter((item: any) => {
          const name = (item.location || '').toLowerCase();
          return queryWords.some((w: string) => w.length > 2 && name.includes(w));
        });
        if (matched.length === 0) matched = trafficData;
        matched.sort((a: any, b: any) => (a.percent_full || 0) - (b.percent_full || 0));

        recommendations = matched.slice(0, 3).map((item: any) => ({
          name: String(item.location || 'Unknown'),
          percent_full: Number(item.percent_full ?? 0),
          available_seats: Math.max(0, Math.round((100 - (item.percent_full || 0)) * 2)),
          reason: (item.percent_full || 0) < 30
            ? 'Very quiet right now!'
            : (item.percent_full || 0) < 60
              ? 'Not too busy — good pick'
              : 'Getting busy, but still available',
        }));
      }

      setResults(recommendations);
      if (recommendations.length === 0) {
        setError('No recommendations found. Make sure the backend is running.');
      }
    } catch (e) {
      setError('Failed to get recommendations. Check your connection.');
      console.error('[PlaceRec] Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getCapacityColor = (pct: number) => {
    if (pct < 40) return '#32D74B';
    if (pct < 70) return '#FF9500';
    return '#FF3B30';
  };

  const getCapacityEmoji = (pct: number) => {
    if (pct < 40) return '🟢';
    if (pct < 70) return '🟡';
    return '🔴';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Find a Spot</Text>
        <Text style={styles.subtitle}>AI-powered campus recommendations</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="What are you looking for?"
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => handleSearch()}
          returnKeyType="search"
        />
        <Pressable
          style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
          onPress={() => handleSearch()}
          disabled={loading}
        >
          <Text style={styles.searchBtnText}>{loading ? '...' : 'Ask'}</Text>
        </Pressable>
      </View>

      {/* Suggestion Chips */}
      {results.length === 0 && !loading && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
          {SUGGESTION_CHIPS.map((chip) => (
            <Pressable
              key={chip}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              onPress={() => { setQuery(chip); handleSearch(chip); }}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Results */}
      <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Finding the best spots for you…</Text>
          </View>
        )}

        {lastQuery && results.length > 0 && (
          <Text style={styles.queryLabel}>Results for "{lastQuery}"</Text>
        )}

        {results.map((rec, idx) => (
          <Card key={idx} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultRank}>#{idx + 1}</Text>
              <View style={styles.resultNameRow}>
                <Text style={styles.resultName}>{rec.name}</Text>
                <Text style={styles.resultCapacity}>
                  {getCapacityEmoji(rec.percent_full)} {rec.percent_full}% full
                </Text>
              </View>
            </View>
            <View style={styles.capacityBarBg}>
              <View
                style={[
                  styles.capacityBarFill,
                  {
                    width: `${Math.min(rec.percent_full, 100)}%`,
                    backgroundColor: getCapacityColor(rec.percent_full),
                  },
                ]}
              />
            </View>
            <Text style={styles.resultSeats}>
              {rec.available_seats > 0 ? `${rec.available_seats} seats available` : 'Capacity data unavailable'}
            </Text>
            {rec.reason && <Text style={styles.resultReason}>{rec.reason}</Text>}
          </Card>
        ))}

        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
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
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  searchRow: { flexDirection: 'row', padding: 16, gap: 10 },
  searchInput: {
    flex: 1, height: 48, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16,
    fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#2A2A2A',
  },
  searchBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  chipsRow: { maxHeight: 44, paddingHorizontal: 16 },
  chipsContent: { gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  resultsScroll: { flex: 1 },
  resultsContent: { padding: 16, gap: 12 },
  queryLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 15 },
  resultCard: { padding: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  resultRank: { fontSize: 26, fontWeight: '900', color: '#FF8A8A', minWidth: 34 },
  resultNameRow: { flex: 1 },
  resultName: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  resultCapacity: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  capacityBarBg: { height: 5, backgroundColor: '#1E1E1E', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  capacityBarFill: { height: '100%', borderRadius: 3 },
  resultSeats: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  resultReason: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 6, lineHeight: 18 },
  errorContainer: { alignItems: 'center', paddingVertical: 20 },
  errorText: { color: COLORS.danger, textAlign: 'center', fontSize: 14 },
});
