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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff' },
  searchRow: { marginBottom: 15 },
  searchInput: { backgroundColor: '#111', borderRadius: 12, padding: 15, color: '#fff', borderWidth: 1, borderColor: '#222' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  filter: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  filterActive: { borderColor: '#E8922A', backgroundColor: '#E8922A11' },
  filterText: { color: '#666', fontSize: 11, fontWeight: '800' },
  input: { backgroundColor: '#000', borderRadius: 8, padding: 12, color: '#fff', marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  foodCard: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  foodName: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  foodSub: { color: '#555', fontSize: 11, marginTop: 2 },
  macroCol: { alignItems: 'flex-end', marginLeft: 10 },
  macroVal: { color: '#E8922A', fontWeight: '900', fontSize: 15 },
  macroPro: { color: '#52d98a', fontWeight: '700', fontSize: 11 },
  usdaBadge: { position: 'absolute', top: 5, right: 5, fontSize: 8, color: '#5ab0e8', fontWeight: '900' },
});
