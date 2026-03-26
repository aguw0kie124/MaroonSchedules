import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, SafeAreaView, ImageBackground } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, ActionButton } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

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

  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#500000" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]} />
      </ImageBackground>

      <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 24, color: T.text }}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: T.text }]}>Dining Settings</Text>
        </View>

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
              value={String(form.age || '')} 
              onChangeText={v => upd('age', +v)} 
              keyboardType="numeric"
            />
          </View>
        </View>

        {form.bodyFat && (
          <View style={[s.row, { marginTop: 10, justifyContent: 'center' }]}>
            <View style={[s.statBox, { borderColor: T.sky + '44' }]}>
               <Text style={[s.statVal, { color: T.sky }]}>{form.bodyFat}%</Text>
               <Text style={s.statLbl}>EST. BODY FAT</Text>
            </View>
          </View>
        )}

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Weight (lbs)</Text>
            <TextInput style={s.input} value={String(form.weight_lbs || '')} onChangeText={v => upd('weight_lbs', +v)} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Height (in)</Text>
            <TextInput style={s.input} value={String(form.height_in || '')} onChangeText={v => upd('height_in', +v)} keyboardType="numeric" />
          </View>
        </View>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Waist (in)</Text>
            <TextInput style={s.input} value={String(form.waist_in || '')} onChangeText={v => upd('waist_in', +v)} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Neck (in)</Text>
            <TextInput style={s.input} value={String(form.neck_in || '')} onChangeText={v => upd('neck_in', +v)} keyboardType="numeric" />
          </View>
          {form.gender === 'female' && (
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Hip (in)</Text>
              <TextInput style={s.input} value={String(form.hip_in || '')} onChangeText={v => upd('hip_in', +v)} keyboardType="numeric" />
            </View>
          )}
        </View>
      </Card>

      <Card>
        <SectionLabel>Dietary Goals</SectionLabel>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Goal Weight (lbs)</Text>
            <TextInput style={s.input} value={String(form.goal_weight_lbs || '')} onChangeText={v => upd('goal_weight_lbs', +v)} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Goal Date</Text>
            <TextInput style={s.input} value={form.goal_date || ''} onChangeText={v => upd('goal_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor="#666" />
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

      <Card>
        <SectionLabel>Meal Distribution (%)</SectionLabel>
        <Text style={{ color: T.text3, fontSize: 11, marginBottom: 12 }}>Divide your target calories across meals (Total must be 100%).</Text>
        <View style={s.row}>
            <View style={{ flex: 1 }}>
                <Text style={s.label}>Breakfast</Text>
                <TextInput style={s.input} value={String(form.meal_split?.breakfast || 25)} onChangeText={v => upd('meal_split', { ...form.meal_split, breakfast: +v })} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.label}>Lunch</Text>
                <TextInput style={s.input} value={String(form.meal_split?.lunch || 35)} onChangeText={v => upd('meal_split', { ...form.meal_split, lunch: +v })} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.label}>Dinner</Text>
                <TextInput style={s.input} value={String(form.meal_split?.dinner || 40)} onChangeText={v => upd('meal_split', { ...form.meal_split, dinner: +v })} keyboardType="numeric" />
            </View>
        </View>
        <View style={s.genderRow}>
            <TouchableOpacity style={s.presetBtn} onPress={() => upd('meal_split', { breakfast: 25, lunch: 35, dinner: 40 })}>
                <Text style={{ color: T.sky, fontSize: 10, fontWeight: '700' }}>25 / 35 / 40 (Standard)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.presetBtn} onPress={() => upd('meal_split', { breakfast: 33, lunch: 33, dinner: 34 })}>
                <Text style={{ color: T.amber, fontSize: 10, fontWeight: '700' }}>33 / 33 / 34 (Even)</Text>
            </TouchableOpacity>
        </View>
      </Card>

      <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Settings</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 34, height: 34, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginLeft: 10, flex: 1 },
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
  statBox: { padding: 15, borderRadius: 15, borderWidth: 1, alignItems: 'center', backgroundColor: '#ffffff05', flex: 0.8 },
  statVal: { fontSize: 24, fontWeight: '900' },
  statLbl: { fontSize: 9, color: '#666', fontWeight: 'bold', marginTop: 4 },
  presetBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center', backgroundColor: '#ffffff05' },
});
