import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { Search } from './components/Search';
import { Builder } from './components/Builder';
import { Saved } from './components/Saved';
import { Profile } from './components/Profile';
import { CourseDetail } from './components/CourseDetail';
import { AuthLanding } from './components/AuthLanding';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen';
import { UsersScreen } from './components/UsersScreen';

import { NewCourseSearchScreen } from './components/NewCourseSearchScreen';
import { NewCourseDetailScreen } from './components/NewCourseDetailScreen';
import { ScheduleListScreen } from './components/ScheduleListScreen';
import { ScheduleDetailScreen } from './components/ScheduleDetailScreen';
import { CampusMapScreen } from './components/CampusMapScreen';
import { LocationSearchScreen } from './components/LocationSearchScreen';
import { ExtrasSidebar } from './components/ExtrasSidebar';
import { CampusNavigationScreen } from './components/CampusNavigationScreen';
import { PlaceRecommendationsScreen } from './components/PlaceRecommendationsScreen';
import { EventsCalendarScreen } from './components/EventsCalendarScreen';
import { ForYouScreen } from './components/ForYouScreen';
import { CrowdPingScreen } from './components/CrowdPingScreen';
import { GPACalculatorScreen } from './components/GPACalculatorScreen';

import { Calendar, Search as SearchIcon, Grid3x3, Bookmark, User, Menu, Compass, MessageSquare } from 'lucide-react-native';
import { COLORS } from './components/SharedUI';

import { syncUser } from './api/client';

/**
 * Invisible component that syncs the signed-in Clerk user to the PostgreSQL
 * users table on every app load.  Renders its children unchanged.
 */
function UserSync({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  React.useEffect(() => {
    if (user) {
      syncUser(
        user.id,
        user.primaryEmailAddress?.emailAddress,
        user.fullName ?? undefined,
      ).catch((err: any) => console.warn('UserSync failed:', err));
    }
  }, [user]);

  return <>{children}</>;
}

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file.');
} else {
  console.log('Clerk Publishable Key detected:', publishableKey.substring(0, 12) + '...');
}

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

import { CampusScreen } from './components/CampusScreen';

function MainTabs() {
  return (
    <Tab.Navigator
        id="MainTabs"
        screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let IconName;

          if (route.name === 'Dashboard') {
            IconName = Calendar;
          } else if (route.name === 'Campus') {
            IconName = Compass;
          } else if (route.name === 'Search') {
            IconName = SearchIcon;
          } else if (route.name === 'Messages') {
            IconName = MessageSquare;
          }

          if (IconName) {
            return <IconName size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
          }
          return null;
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarStyle: {
          height: 84,
          paddingBottom: 28,
          paddingTop: 12,
          backgroundColor: '#0A0A0A',
          borderTopColor: '#1F1F1F',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} options={{ title: 'Home' }} />
      <Tab.Screen name="Campus" component={CampusScreen} options={{ title: 'Campus' }} />
      <Tab.Screen name="Search" component={NewCourseSearchScreen} options={{ title: 'Search' }} />
      <Tab.Screen name="Messages" component={UsersScreen} options={{ title: 'Messages' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  const navigator = (
    <Stack.Navigator id="RootStack" screenOptions={{ 
        headerShown: false,
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#FFFFFF',
    }}>
      {isSignedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="CourseDetail" component={CourseDetail} options={{ headerShown: true }} />
          <Stack.Screen
            name="ChatScreen"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UsersScreen"
            component={UsersScreen}
            options={{ headerShown: false }}
          />
          
          <Stack.Screen name="NewCourseSearch" component={NewCourseSearchScreen} options={{ headerShown: true, title: 'Course Search' }} />
          <Stack.Screen name="NewCourseDetail" component={NewCourseDetailScreen} options={{ headerShown: true, title: 'Course Details' }} />
          <Stack.Screen name="ScheduleList" component={ScheduleListScreen} options={{ headerShown: true, title: 'My Schedules' }} />
          <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} options={{ headerShown: true, title: 'Schedule Details' }} />
          <Stack.Screen name="CampusMap" component={CampusMapScreen} options={{ headerShown: true, title: 'Campus Traffic Map' }} />
          <Stack.Screen name="LocationSearch" component={LocationSearchScreen} options={{ headerShown: true, title: 'Location Traffic Search' }} />
          <Stack.Screen name="CampusNavigation" component={CampusNavigationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlaceRecommendations" component={PlaceRecommendationsScreen} options={{ headerShown: true, title: 'Find a Spot' }} />
          <Stack.Screen name="EventsCalendar" component={EventsCalendarScreen} options={{ headerShown: true, title: 'Campus Events' }} />
          <Stack.Screen name="ForYou" component={ForYouScreen} options={{ headerShown: true, title: 'For You' }} />
          <Stack.Screen name="CrowdPing" component={CrowdPingScreen} options={{ headerShown: true, title: 'CrowdPing' }} />
          <Stack.Screen name="GPACalculator" component={GPACalculatorScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Onboarding" component={Onboarding} />
          <Stack.Screen 
            name="AuthLanding" 
            children={(props: any) => (
              <AuthLanding
                onLoginPress={() => props.navigation.navigate('Login')}
              />
            )} 
          />
          <Stack.Screen 
            name="Login" 
            children={(props: any) => <LoginScreen onBack={() => props.navigation.goBack()} />} 
          />
        </>
      )}
    </Stack.Navigator>
  );

  // Wrap with UserSync only when signed in so the DB row is created/updated
  return isSignedIn ? <UserSync>{navigator}</UserSync> : navigator;
}

import { registerRootComponent } from 'expo';

function App() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

registerRootComponent(App);
