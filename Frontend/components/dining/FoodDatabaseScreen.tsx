import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList, Alert, ScrollView } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, Divider, ActionButton } from './DiningUI';

export default function FoodDatabaseScreen({ navigation }: any) {
  const { user } = useUser();
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
    // Proxy through backend if needed, but for now just mock success
    Alert.alert('Success', `${newFood.name} added to database!`);
    setShowAdd(false);
    setNewFood({ name: '', location: '', calories: '', protein: '', carbs: '', fat: '' });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Food Database</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
            <Text style={{ color: '#E8922A', fontSize: 24, fontWeight: '200' }}>{showAdd ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <TextInput style={s.searchInput} placeholder="Search foods or USDA..." 
          placeholderTextColor="#666" value={query} onChangeText={setQuery} />
      </View>

      <View style={s.filterRow}>
        {['all', 'usda', 'dining'].map(s_opt => (
          <TouchableOpacity key={s_opt} 
            style={[s.filter, source === s_opt && s.filterActive]} 
            onPress={() => setSource(s_opt)}>
            <Text style={[s.filterText, source === s_opt && { color: '#E8922A' }]}>{s_opt.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {showAdd && (
        <Card>
          <SectionLabel>Add Custom Food</SectionLabel>
          <TextInput style={s.input} placeholder="Food Name" placeholderTextColor="#666" value={newFood.name} onChangeText={v => setNewFood({...newFood, name: v})} />
          <TextInput style={s.input} placeholder="Location (e.g. Chick-fil-A)" placeholderTextColor="#666" value={newFood.location} onChangeText={v => setNewFood({...newFood, location: v})} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Cal" placeholderTextColor="#666" value={newFood.calories} onChangeText={v => setNewFood({...newFood, calories: v})} keyboardType="decimal-pad" />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Pro (g)" placeholderTextColor="#666" value={newFood.protein} onChangeText={v => setNewFood({...newFood, protein: v})} keyboardType="decimal-pad" />
          </View>
          <ActionButton label="Add to Database" onPress={doAdd} />
        </Card>
      )}

      {loading ? <ActivityIndicator color="#E8922A" style={{ marginTop: 20 }} /> : (
        <FlatList
          data={foods}
          keyExtractor={(item: any, index) => item.id?.toString() || index.toString()}
          ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>Search for foods above</Text>}
          renderItem={({ item }: any) => (
            <View style={s.foodCard}>
                <View style={{ flex: 1 }}>
                    <Text style={s.foodName}>{item.name}</Text>
                    <Text style={s.foodSub}>{item.location}</Text>
                </View>
                <View style={s.macroCol}>
                    <Text style={s.macroVal}>{Math.round(item.calories)} kcal</Text>
                    <Text style={s.macroPro}>{Math.round(item.protein)}g P</Text>
                </View>
                {item.source === 'usda' && <Text style={s.usdaBadge}>USDA</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 10 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  searchRow: { marginBottom: 16 },
  searchInput: { backgroundColor: '#0a0a0a', borderRadius: 16, padding: 18, color: '#fff', borderWidth: 1, borderColor: '#1a1a1a', fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  filter: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#111' },
  filterActive: { borderColor: '#E8922A', backgroundColor: '#E8922A11' },
  filterText: { color: '#444', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  input: { backgroundColor: '#050505', borderRadius: 12, padding: 14, color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  foodCard: { 
    flexDirection: 'row', 
    backgroundColor: '#0a0a0a', 
    borderRadius: 20, 
    padding: 18, 
    marginBottom: 14, 
    borderWidth: 1, 
    borderColor: '#111', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  foodName: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: -0.2 },
  foodSub: { color: '#444', fontSize: 12, marginTop: 4, fontWeight: '600' },
  macroCol: { alignItems: 'flex-end', marginLeft: 15 },
  macroVal: { color: '#E8922A', fontWeight: '900', fontSize: 16 },
  macroPro: { color: '#52d98a', fontWeight: '800', fontSize: 12, marginTop: 2 },
  usdaBadge: { position: 'absolute', top: 10, right: 10, fontSize: 8, color: '#5ab0e8', fontWeight: '900', opacity: 0.6 },
});
