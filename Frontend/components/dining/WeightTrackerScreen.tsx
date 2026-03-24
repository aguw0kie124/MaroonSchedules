import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, StatPill, ActionButton } from './DiningUI';

const SW = Dimensions.get('window').width;

export default function WeightTrackerScreen({ navigation }: any) {
  const { user } = useUser();
  const [weights, setWeights] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newWt, setNewWt] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [wRes, sRes] = await Promise.all([
        fetch(`${API_URL}/dining/weights/${user.id}`).then(r => r.json()),
        fetch(`${API_URL}/dining/weight-stats/${user.id}`).then(r => r.json()),
      ]);
      setWeights(Array.isArray(wRes) ? wRes : []);
      setStats(sRes);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const doLog = async () => {
    if (!user || !newWt || isNaN(+newWt)) { Alert.alert('Enter a valid weight'); return; }
    setSaving(true);
    try {
      await fetch(`${API_URL}/dining/weights/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, weight_lbs: +newWt }),
      });
      setNewWt(''); 
      setShowAdd(false);
      await load();
    } catch (e) { 
      Alert.alert('Error', 'Failed to log weight'); 
    }
    setSaving(false);
  };

  const doDelete = (date: string) => Alert.alert('Remove Entry', `Delete entry for ${date}?`, [
    { text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { 
        await fetch(`${API_URL}/dining/weights/${user?.id}/${date}`, { method: 'DELETE' });
        load(); 
      } catch {}
    }},
  ]);

  const recent = weights.slice(-14);
  const chartData = recent.length > 0 ? {
    labels: recent.length === 1 ? [recent[0].date.slice(5), recent[0].date.slice(5)] : recent.map((w, i) => i % 4 === 0 ? w.date.slice(5) : ' '),
    datasets: [{ 
      data: recent.length === 1 ? [Number(recent[0].weight_lbs), Number(recent[0].weight_lbs)] : recent.map(w => Number(w.weight_lbs)), 
      color: () => '#E8922A', 
      strokeWidth: 2 
    }],
  } : null;

  const change = stats?.totalChange;
  const changeColor = change < 0 ? '#52d98a' : change > 0 ? '#ff4d4d' : '#999';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <View style={s.header}>
        <Text style={s.title}>Weight Tracker</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
            <Text style={{ color: '#5ab0e8', fontSize: 24, fontWeight: '200' }}>{showAdd ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={s.pillRow}>
          <StatPill label="Current" value={`${stats.currentWeight} lbs`} color="#5ab0e8" />
          <StatPill label="Goal" value={stats.goalWeight ? `${stats.goalWeight} lbs` : '—'} color="#E8922A" />
          <StatPill label="Change" value={change != null ? `${change > 0 ? '+' : ''}${change.toFixed(1)} lbs` : '—'} color={changeColor} />
        </View>
      )}

      {showAdd && (
        <Card>
          <SectionLabel>Log Weight</SectionLabel>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1.2 }]} placeholder="Weight (lbs)"
              placeholderTextColor="#666" value={newWt} onChangeText={setNewWt}
              keyboardType="decimal-pad" />
            <TextInput style={[s.input, { flex: 1.5 }]} placeholder="YYYY-MM-DD"
              placeholderTextColor="#666" value={newDate} onChangeText={setNewDate} />
          </View>
          <TouchableOpacity style={s.logBtn} onPress={doLog} disabled={saving}>
            <Text style={s.logBtnText}>{saving ? 'Saving...' : 'Log Weight'}</Text>
          </TouchableOpacity>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator color="#5ab0e8" style={{ marginTop: 20 }} />
      ) : chartData ? (
        <Card style={{ paddingHorizontal: 8 }}>
          <SectionLabel>Trend — last {recent.length} entries</SectionLabel>
          <LineChart
            data={chartData}
            width={SW - 56}
            height={180}
            chartConfig={{
              backgroundColor: '#111',
              backgroundGradientFrom: '#111',
              backgroundGradientTo: '#111',
              decimalPlaces: 1,
              color: (o = 1) => `rgba(90, 176, 232, ${o})`,
              labelColor: (o = 1) => `rgba(153, 153, 153, ${o})`,
              propsForDots: { r: '4', strokeWidth: '1', stroke: '#5ab0e8' },
              propsForBackgroundLines: { stroke: '#333', strokeWidth: 0.5 },
            }}
            bezier
            withShadow={false}
            style={{ borderRadius: 12, marginTop: 10 }}
          />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 20 }}>
            Log weight to see trend chart.
          </Text>
        </Card>
      )}

      <Card>
        <SectionLabel>History</SectionLabel>
        {weights.length === 0 ? (
          <Text style={{ color: '#666', textAlign: 'center' }}>No entries</Text>
        ) : weights.slice(-10).reverse().map((w, i) => (
          <View key={w.date} style={s.entryRow}>
            <Text style={s.entryDate}>{w.date}</Text>
            <Text style={s.entryWeight}>{w.weight_lbs} lbs</Text>
            <TouchableOpacity onPress={() => doDelete(w.date)}>
              <Text style={{ color: '#ff4d4d' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff' },
  pillRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { backgroundColor: '#111', borderRadius: 12, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#333' },
  logBtn: { backgroundColor: '#500000', padding: 16, borderRadius: 12, alignItems: 'center' },
  logBtnText: { color: '#fff', fontWeight: '800' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  entryDate: { color: '#999', fontSize: 13 },
  entryWeight: { color: '#fff', fontWeight: 'bold' },
});
