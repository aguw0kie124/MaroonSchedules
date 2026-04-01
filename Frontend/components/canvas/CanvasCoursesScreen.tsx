import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView, TouchableOpacity, StyleSheet } from 'react-native';
import { useCanvasCourses } from '../../api/canvasApi';
import { useTheme } from '../SharedUI';
import { ArrowLeft, BookOpen } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export function CanvasCoursesScreen() {
  const { data, isLoading, error } = useCanvasCourses();
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
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginLeft: 16 }}>My Courses</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {data && data.length > 0 ? data.map((course: any, idx: number) => {
          return (
            <View key={idx} style={[styles.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <BookOpen color={COLORS.accent} size={24} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textPrimary }}>{course.name}</Text>
                    <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4 }}>{course.course_code}</Text>
                  </View>
               </View>
            </View>
          );
        }) : (
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 20 }}>No courses found.</Text>
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
