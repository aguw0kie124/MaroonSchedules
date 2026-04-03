import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminMapPoster } from './AdminMapPoster';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
import { useTheme } from '../SharedUI';
import { MapPin, LayoutDashboard } from 'lucide-react-native';

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
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
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
        name="Manage Events" 
        component={AdminAnalyticsScreen} 
        options={{
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} />
        }}
      />
    </Tab.Navigator>
  );
}
