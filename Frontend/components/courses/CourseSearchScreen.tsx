import React from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { searchCourses } from '../../api/courses';
import { useCoursesStore } from '../../store/coursesStore';
import { useTheme } from '../SharedUI';
import { CourseRecord, CourseSearchResponse } from '../../types/courses';

function CourseCard({ course, onPress, COLORS }: { course: CourseRecord; onPress: () => void; COLORS: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: COLORS.surfaceElevated,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
        gap: 6,
      }}
    >
      <Text style={{ color: COLORS.primary, fontWeight: '800' }}>
        {course.department} {course.number}
      </Text>
      <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' }}>{course.title}</Text>
      <Text style={{ color: COLORS.textSecondary }}>
        {course.credit_hours} credit hours
        {course.grade_summary?.avg_gpa != null ? ` · GPA ${course.grade_summary.avg_gpa.toFixed(2)}` : ' · no GPA data'}
      </Text>
    </Pressable>
  );
}

export function CourseSearchScreen({ navigation, route }: any) {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);
  const { searchQuery, setSearchQuery, filters, setFilters } = useCoursesStore();
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (route.params?.query) {
      setSearchQuery(route.params.query);
    }
    if (route.params?.college) {
      setFilters({ college: route.params.college });
    }
  }, [route.params?.college, route.params?.query, setFilters, setSearchQuery]);

  const { data, isLoading } = useQuery<CourseSearchResponse>({
    queryKey: ['course-search', searchQuery, filters.department, filters.creditHours, filters.hasGradeData, page],
    queryFn: () =>
      searchCourses({
        q: searchQuery,
        dept: filters.department,
        credit_hours: filters.creditHours,
        has_grade_data: filters.hasGradeData,
        page,
        page_size: 20,
      }),
  });

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search courses"
          placeholderTextColor={COLORS.textTertiary}
        />
      </View>

      <View style={styles.filters}>
        <Pressable style={styles.filterChip} onPress={() => setFilters({ department: filters.department ? undefined : 'CSCE' })}>
          <Text style={styles.filterText}>Department</Text>
        </Pressable>
        <Pressable style={styles.filterChip} onPress={() => setFilters({ creditHours: filters.creditHours ? undefined : 3 })}>
          <Text style={styles.filterText}>Credit Hours</Text>
        </Pressable>
        <Pressable style={styles.filterChip} onPress={() => setFilters({ hasGradeData: filters.hasGradeData ? undefined : true })}>
          <Text style={styles.filterText}>Has Grade Data</Text>
        </Pressable>
      </View>

      {isLoading ? <Text style={styles.helper}>Searching courses...</Text> : null}

      <FlatList
        data={data?.items || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <CourseCard
            course={item}
            COLORS={COLORS}
            onPress={() => navigation.navigate('CourseDetailCatalog', { dept: item.department, number: item.number })}
          />
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.helper}>No courses match those filters.</Text> : null}
        ListFooterComponent={
          data?.total && data.total > (data.page * data.page_size) ? (
            <Pressable onPress={() => setPage((current) => current + 1)} style={styles.moreButton}>
              <Text style={styles.moreText}>Load More</Text>
            </Pressable>
          ) : <View style={{ height: 24 }} />
        }
      />
    </View>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    searchBar: { padding: 16, paddingBottom: 10 },
    input: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      color: COLORS.textPrimary,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
    filterChip: {
      backgroundColor: COLORS.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    filterText: { color: COLORS.textSecondary, fontWeight: '600' },
    list: { padding: 16, paddingTop: 6 },
    helper: { color: COLORS.textSecondary, paddingHorizontal: 16, paddingVertical: 20 },
    moreButton: {
      backgroundColor: COLORS.primary,
      marginTop: 12,
      borderRadius: 14,
      alignItems: 'center',
      paddingVertical: 12,
    },
    moreText: { color: '#FFFFFF', fontWeight: '800' },
  });
