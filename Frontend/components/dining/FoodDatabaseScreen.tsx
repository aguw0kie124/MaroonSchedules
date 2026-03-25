import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList, Alert, SafeAreaView, StatusBar, ImageBackground, KeyboardAvoidingView, Platform } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, ActionButton } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

export default function FoodDatabaseScreen({ navigation }: any) {
  const { user } = useUser();
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const [foods, setFoods] = useState([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  
  const [newFood, setNewFood] = useState({ name: '', location: '', calories: '', protein: '', carbs: '', fat: '' });

  const loadFoods = useCallback(async () => {
    if (query.length < 2 && source === 'all') return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/dining/foods?q=${query}&source=${source}`);
      const data = await resp.json();
      setFoods(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [query, source]);

  useEffect(() => {
    const t = setTimeout(loadFoods, 500);
    return () => clearTimeout(t);
  }, [loadFoods]);

  const doAdd = async () => {
    if (!newFood.name || !newFood.calories) { Alert.alert('Enter name and calories'); return; }
    Alert.alert('Success', `${newFood.name} added to database!`);
    setShowAdd(false);
    setNewFood({ name: '', location: '', calories: '', protein: '', carbs: '', fat: '' });
  };

  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]} />
      </ImageBackground>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
        <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 24, color: T.text }}>←</Text>
            </TouchableOpacity>
            <Text style={[s.title, { color: T.text }]}>Database</Text>
            <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
                <Text style={{ color: T.amber, fontSize: 24, fontWeight: '200' }}>{showAdd ? '✕' : '+'}</Text>
            </TouchableOpacity>
        </View>

        <View style={s.searchRow}>
          <TextInput 
            style={[s.searchInput, { backgroundColor: T.bg3, borderColor: T.border, color: T.text }]} 
            placeholder="Search foods or USDA..." 
            placeholderTextColor={T.text3} 
            value={query} 
            onChangeText={setQuery} 
          />
        </View>

        <View style={s.filterRow}>
          {['all', 'usda', 'dining'].map(s_opt => (
            <TouchableOpacity key={s_opt} 
              style={[s.filter, { backgroundColor: T.bg3, borderColor: T.border }, source === s_opt && { borderColor: T.amber, backgroundColor: T.amber + '18' }]} 
              onPress={() => setSource(s_opt)}>
              <Text style={[s.filterText, { color: T.text2 }, source === s_opt && { color: T.amber }]}>{s_opt.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {showAdd && (
          <Card>
            <SectionLabel>Add Custom Food</SectionLabel>
            <TextInput style={[s.input, { backgroundColor: T.bg3, borderColor: T.border, color: T.text }]} placeholder="Food Name" placeholderTextColor={T.text3} value={newFood.name} onChangeText={v => setNewFood({...newFood, name: v})} />
            <TextInput style={[s.input, { backgroundColor: T.bg3, borderColor: T.border, color: T.text }]} placeholder="Location (e.g. Chick-fil-A)" placeholderTextColor={T.text3} value={newFood.location} onChangeText={v => setNewFood({...newFood, location: v})} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[s.input, { flex: 1, backgroundColor: T.bg3, borderColor: T.border, color: T.text }]} placeholder="Cal" placeholderTextColor={T.text3} value={newFood.calories} onChangeText={v => setNewFood({...newFood, calories: v})} keyboardType="decimal-pad" />
                <TextInput style={[s.input, { flex: 1, backgroundColor: T.bg3, borderColor: T.border, color: T.text }]} placeholder="Pro (g)" placeholderTextColor={T.text3} value={newFood.protein} onChangeText={v => setNewFood({...newFood, protein: v})} keyboardType="decimal-pad" />
            </View>
            <ActionButton label="Add to Database" onPress={doAdd} style={{backgroundColor: T.tamuMaroon}} textStyle={{color: T.tamuGold}} />
          </Card>
        )}

        {loading ? <ActivityIndicator color={T.amber} style={{ marginTop: 20 }} /> : (
          <FlatList
            data={foods}
            keyExtractor={(item: any, index) => item.id?.toString() || index.toString()}
            ListEmptyComponent={<Text style={{ color: T.text3, textAlign: 'center', marginTop: 40 }}>Search for foods above</Text>}
            contentContainerStyle={{ paddingBottom: 60 }}
            renderItem={({ item }: any) => (
              <View style={[s.foodCard, { backgroundColor: T.card, borderColor: T.border }]}>
                  <View style={{ flex: 1 }}>
                      <Text style={[s.foodName, { color: T.text }]}>{item.name}</Text>
                      <Text style={[s.foodSub, { color: T.text3 }]}>{item.location}</Text>
                  </View>
                  <View style={s.macroCol}>
                      <Text style={[s.macroVal, { color: T.amber }]}>{Math.round(item.calories)} kcal</Text>
                      <Text style={[s.macroPro, { color: T.sage }]}>{Math.round(item.protein)}g P</Text>
                  </View>
                  {item.source === 'usda' && <Text style={[s.usdaBadge, { color: T.sky }]}>USDA</Text>}
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 34, height: 34, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, flex: 1, marginLeft: 10 },
  searchRow: { marginBottom: 16 },
  searchInput: { borderRadius: 16, padding: 18, borderWidth: 1, fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  filter: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  input: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  foodCard: { 
    flexDirection: 'row', 
    borderRadius: 20, 
    padding: 18, 
    marginBottom: 14, 
    borderWidth: 1, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  foodName: { fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: -0.2 },
  foodSub: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  macroCol: { alignItems: 'flex-end', marginLeft: 15 },
  macroVal: { fontWeight: '900', fontSize: 16 },
  macroPro: { fontWeight: '800', fontSize: 12, marginTop: 2 },
  usdaBadge: { position: 'absolute', top: 10, right: 10, fontSize: 8, fontWeight: '900', opacity: 0.6 },
});
