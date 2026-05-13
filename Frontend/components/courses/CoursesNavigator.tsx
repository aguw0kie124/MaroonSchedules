import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { CoursesHomeScreen } from './CoursesHomeScreen';
import { CourseSearchScreen } from './CourseSearchScreen';
import { CourseDetailScreen } from './CourseDetailScreen';
import { DegreePlanScreen } from './DegreePlanScreen';
import { ProgressTrackerScreen } from './ProgressTrackerScreen';

const Stack = createStackNavigator();

export function CoursesNavigator() {
  return (
    <Stack.Navigator id="CoursesStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CoursesHome" component={CoursesHomeScreen} />
      <Stack.Screen name="CourseSearch" component={CourseSearchScreen} />
      <Stack.Screen name="CourseDetailCatalog" component={CourseDetailScreen} />
      <Stack.Screen name="DegreePlan" component={DegreePlanScreen} />
      <Stack.Screen name="ProgressTracker" component={ProgressTrackerScreen} />
    </Stack.Navigator>
  );
}
