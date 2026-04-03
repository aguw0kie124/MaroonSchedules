import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminMapPoster } from './AdminMapPoster';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
import { useTheme } from '../SharedUI';
import { MapPin, BarChart2 } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

export function AdminPortal() {
  const { COLORS } = useTheme();

  return (
    <Tab.Navigator
      id="AdminPortalTabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tab.Screen 
        name="Post Event" 
        component={AdminMapPoster} 
        options={{
          tabBarIcon: ({ color }) => <MapPin color={color} size={24} />
        }}
      />
      <Tab.Screen 
        name="Analytics" 
        component={AdminAnalyticsScreen} 
        options={{
          tabBarIcon: ({ color }) => <BarChart2 color={color} size={24} />
        }}
      />
    </Tab.Navigator>
  );
}
