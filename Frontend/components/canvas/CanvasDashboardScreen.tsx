import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCanvasDashboard } from '../../api/canvasApi';
import * as WebBrowser from 'expo-web-browser';
import { requestJson } from '../../api/client';
import { useTheme } from '../SharedUI';
import { AlertCircle, BookOpen, Calendar, CheckCircle, Clock } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export function CanvasDashboardScreen() {
  const { data, isLoading, error, refetch } = useCanvasDashboard();
  const { COLORS, theme } = useTheme();
  const navigation = useNavigation<any>();

  const handleConnect = async () => {
    try {
      const authData = await requestJson('/canvas/auth');
      
      if (authData.oauth_url) {
        // In Expo dev, use localhost:8081. In prod, your app scheme.
        const result = await WebBrowser.openBrowserAsync(authData.oauth_url);
        // Note: With openBrowserAsync you might need the user to manually return. 
        // For openAuthSessionAsync you need scheme registered.
        setTimeout(() => refetch(), 2000); // Polling or reloading
      }
    } catch (err) {
      console.warn("Failed to start Canvas OAuth", err);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 12 }}>Loading Canvas Data...</Text>
      </View>
    );
  }

  if (error && error.message.includes("User not connected")) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <BookOpen size={64} color={COLORS.textTertiary} style={{ marginBottom: 16 }} />
        <Text style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 }}>Canvas LMS</Text>
        <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginHorizontal: 32, marginBottom: 24 }}>
          Connect your Texas A&M Canvas account to view your dashboard, assignments, and grades all in one place.
        </Text>
        <TouchableOpacity 
          onPress={handleConnect} 
          style={{ paddingHorizontal: 24, paddingVertical: 14, backgroundColor: COLORS.accent, borderRadius: 12 }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Connect TAMU Canvas</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.textPrimary }}>Canvas Hub</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ padding: 8, backgroundColor: COLORS.surface, borderRadius: 8 }}>
            <Clock size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Dashboard Stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={[styles.statBox, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>Courses</Text>
            <Text style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{data?.courses?.length || 0}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>To Do</Text>
            <Text style={{ color: '#F59E0B', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{data?.todo?.length || 0}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>Events</Text>
            <Text style={{ color: COLORS.accent, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{data?.schedule?.length || 0}</Text>
          </View>
        </View>

        {/* Quick Links */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          <TouchableOpacity 
             onPress={() => navigation.navigate('CanvasCourses')}
             style={[styles.linkBtn, { backgroundColor: COLORS.surface }]}
          >
            <BookOpen size={20} color={COLORS.accent} />
            <Text style={{ color: COLORS.textPrimary, fontWeight: '600', marginLeft: 8 }}>Courses</Text>
          </TouchableOpacity>

          <TouchableOpacity 
             onPress={() => navigation.navigate('CanvasAssignments')}
             style={[styles.linkBtn, { backgroundColor: COLORS.surface }]}
          >
            <CheckCircle size={20} color="#F59E0B" />
            <Text style={{ color: COLORS.textPrimary, fontWeight: '600', marginLeft: 8 }}>Assignments</Text>
          </TouchableOpacity>

          <TouchableOpacity 
             onPress={() => navigation.navigate('CanvasGrades')}
             style={[styles.linkBtn, { backgroundColor: COLORS.surface }]}
          >
            <AlertCircle size={20} color="#10B981" />
            <Text style={{ color: COLORS.textPrimary, fontWeight: '600', marginLeft: 8 }}>Grades</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming To Do */}
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 }}>Upcoming Work</Text>
        {data?.todo?.length > 0 ? (
          data.todo.slice(0, 5).map((item: any, idx: number) => {
             // Basic styling logic based on Canvas API item shape
             return (
               <View key={idx} style={[styles.todoCard, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
                 <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                 <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 4 }}>
                   Due: {item.due_at ? new Date(item.due_at).toLocaleDateString() : 'No date'}
                 </Text>
               </View>
             );
          })
        ) : (
          <Text style={{ color: COLORS.textSecondary }}>No upcoming assignments! 🎉</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statBox: {
    width: (width - 32 - 24) / 3,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center'
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexGrow: 1,
    justifyContent: 'center'
  },
  todoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12
  }
});
