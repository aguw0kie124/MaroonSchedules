import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView, TouchableOpacity, StyleSheet } from 'react-native';
import { useCanvasAssignments } from '../../api/canvasApi';
import { useTheme } from '../SharedUI';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export function CanvasAssignmentsScreen() {
  const { data, isLoading, error } = useCanvasAssignments();
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginLeft: 16 }}>Canvas Assignments</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {data && data.length > 0 ? data.map((item: any, idx: number) => {
          // Check for missing vs upcoming
          // Canvas todo items often have `assignment` object inside.
          const isMissing = item.assignment?.missing || false;
          const statusColor = isMissing ? '#EF4444' : '#F59E0B'; // red vs yellow
          
          return (
            <View key={idx} style={[styles.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: statusColor }]}>
               <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textPrimary }}>{item.assignment?.name || item.title || 'Assignment'}</Text>
               <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4 }}>Course: {item.context_name}</Text>
               <Text style={{ fontSize: 13, color: statusColor, fontWeight: '500', marginTop: 8 }}>
                 {isMissing ? 'Missing' : 'Upcoming'} - Due {item.assignment?.due_at ? new Date(item.assignment.due_at).toLocaleString() : 'N/A'}
               </Text>
            </View>
          );
        }) : (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <CheckCircle color="#10B981" size={48} />
            <Text style={{ color: COLORS.textPrimary, fontSize: 18, marginTop: 16 }}>All caught up!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  }
});
