import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, Divider } from './DiningUI';

const ACTIVITY = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Little/no exercise' },
  { value: 'light', label: 'Lightly Active', sub: '1–3× per week' },
  { value: 'moderate', label: 'Moderately Active', sub: '3–5× per week' },
  { value: 'active', label: 'Very Active', sub: '6–7× per week' },
  { value: 'very_active', label: 'Extremely Active', sub: '2×/day or physical job' },
];

export default function DiningSettingsScreen({ navigation }: any) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    gender: 'male',
    age: 20,
    weight_lbs: 170,
    height_in: 70,
    activity_level: 'moderate',
  });

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/dining/profile/${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.detail) setForm(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/dining/profile/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      Alert.alert('Saved', 'Your dining profile has been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
    setSaving(false);
  };

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#500000" />;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.title}>Dining Settings</Text>

      <Card>
        <SectionLabel>Biological Metrics</SectionLabel>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Gender</Text>
            <View style={s.genderRow}>
              {['male', 'female'].map(g => (
                <TouchableOpacity 
                    key={g} 
                    style={[s.genderBtn, form.gender === g && s.genderBtnActive]}
                    onPress={() => upd('gender', g)}
                >
                  <Text style={[s.genderText, form.gender === g && { color: '#fff' }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Age</Text>
            <TextInput 
              style={s.input} 
              value={String(form.age)} 
              onChangeText={v => upd('age', +v)} 
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Weight (lbs)</Text>
            <TextInput 
              style={s.input} 
              value={String(form.weight_lbs)} 
              onChangeText={v => upd('weight_lbs', +v)} 
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Height (in)</Text>
            <TextInput 
              style={s.input} 
              value={String(form.height_in)} 
              onChangeText={v => upd('height_in', +v)} 
              keyboardType="numeric"
            />
          </View>
        </View>
      </Card>

      <Card>
        <SectionLabel>Activity Level</SectionLabel>
        {ACTIVITY.map(opt => (
          <TouchableOpacity 
            key={opt.value} 
            style={[s.actRow, form.activity_level === opt.value && s.actRowActive]}
            onPress={() => upd('activity_level', opt.value)}
          >
            <Text style={[s.actLabel, form.activity_level === opt.value && { color: '#fff' }]}>{opt.label}</Text>
            <Text style={s.actSub}>{opt.sub}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Settings</Text>}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  label: { fontSize: 10, color: '#999', fontWeight: '700', textTransform: 'uppercase', marginBottom: 5 },
  input: { backgroundColor: '#111', borderRadius: 12, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#333' },
  genderRow: { flexDirection: 'row', gap: 5 },
  genderBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  genderBtnActive: { borderColor: '#500000', backgroundColor: '#50000022' },
  genderText: { color: '#999', fontSize: 12, textTransform: 'capitalize' },
  actRow: { padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#222' },
  actRowActive: { borderColor: '#500000', backgroundColor: '#50000022' },
  actLabel: { color: '#999', fontWeight: '700', fontSize: 14 },
  actSub: { color: '#666', fontSize: 10, marginTop: 2 },
  saveBtn: { backgroundColor: '#500000', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
