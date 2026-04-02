import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { RecreationFacilitiesScreen } from './components/RecreationFacilitiesScreen';
import { CourseDetail } from './components/CourseDetail';
import { AuthLanding } from './components/AuthLanding';
import { LoginScreen } from './components/LoginScreen';
import { AnnexHubScreen } from './components/AnnexHubScreen';

import { NewCourseSearchScreen } from './components/NewCourseSearchScreen';
import { NewCourseDetailScreen } from './components/NewCourseDetailScreen';
import { ScheduleListScreen } from './components/ScheduleListScreen';
import { ScheduleDetailScreen } from './components/ScheduleDetailScreen';
import { CampusNavigationScreen } from './components/CampusNavigationScreen';
import BusTimetableScreen from './components/BusTimetableScreen';
import TransitTripPlannerScreen from './components/TransitTripPlannerScreen';
import { TransitTripResultsScreen } from './components/TransitTripResultsScreen';
import { PlacesMapScreen } from './components/PlacesMapScreen';
import { EventsCalendarScreen } from './components/EventsCalendarScreen';

import { SocialHubScreen } from './components/SocialHubScreen';
import { GradesScreen } from './components/GradesScreen';
import { GPACalculatorScreen } from './components/GPACalculatorScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { ShareOverlay } from './components/ShareOverlay';
import { TimerScreen } from './components/TimerScreen';

import DiningDashboard from './components/dining/DiningDashboard';
import FullMenuScreen from './components/dining/FullMenuScreen';
import DiningSettingsScreen from './components/dining/DiningSettingsScreen';
import MealOptimizerScreen from './components/dining/MealOptimizerScreen';
import MealTrackerScreen from './components/dining/MealTrackerScreen';
import RetailSwipesScreen from './components/dining/RetailSwipesScreen';
import FoodDatabaseScreen from './components/dining/FoodDatabaseScreen';
import WeightTrackerScreen from './components/dining/WeightTrackerScreen';
import TrackerHubScreen from './components/dining/TrackerHubScreen';
import StreakHubScreen from './components/dining/StreakHubScreen';

import { Home, Map, Users, User, UtensilsCrossed, Clock3 } from 'lucide-react-native';
import { GlassPillTabBar } from './components/GlassPillTabBar';
import { useTheme, useThemeStore } from './components/SharedUI';
import { getOrderedVisibleItems, useAppShellStore } from './store/appShellStore';

import { syncUser } from './api/client';

function UserSync({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const lastSyncedUserId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (user?.id && lastSyncedUserId.current !== user.id) {
      lastSyncedUserId.current = user.id;
      syncUser(
        user.id,
        user.primaryEmailAddress?.emailAddress,
        user.fullName ?? undefined,
        user.imageUrl ?? undefined,
      ).catch((err: any) => console.warn('UserSync failed:', err));
    }
  }, [user?.id, user?.primaryEmailAddress?.emailAddress, user?.fullName, user?.imageUrl]);

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

function MainTabs() {
  const { COLORS } = useTheme();
  const navItems = useAppShellStore((state) => state.navItems);
  const tabBarMode = useAppShellStore((state) => state.tabBarMode);
  const visibleNavItems = React.useMemo(() => getOrderedVisibleItems(navItems), [navItems]);

  const tabScreens = [
    ...visibleNavItems.map((item) => {
      if (item.id === 'Dashboard') {
        return {
          name: 'Dashboard',
          component: Dashboard,
          title: 'Events',
          icon: Home,
          initialParams: undefined,
        };
      }
      if (item.id === 'Places') {
        return {
          name: 'Places',
          component: PlacesMapScreen,
          title: 'Places',
          icon: Map,
          initialParams: undefined,
        };
      }
      if (item.id === 'Social') {
        return {
          name: 'Social',
          component: SocialHubScreen,
          title: 'Pings',
          icon: Users,
          initialParams: undefined,
        };
      }
      if (item.id === 'Dining') {
        return {
          name: 'Dining',
          component: DiningDashboard,
          title: 'Dining',
          icon: UtensilsCrossed,
          initialParams: undefined,
        };
      }
      return {
        name: 'Timer',
        component: TimerScreen,
        title: 'Timer',
        icon: Clock3,
        initialParams: undefined,
      };
    }),
    {
      name: 'Settings',
      component: Profile,
      title: 'Settings',
      icon: User,
      initialParams: undefined,
    },
  ];

  const availableRouteNames = tabScreens.map((screen) => screen.name);
  const initialRouteName = availableRouteNames.includes('Dashboard')
    ? 'Dashboard'
    : availableRouteNames[0];
  const shellKey = `${tabBarMode}:${availableRouteNames.join('|')}`;

  return (
    <Tab.Navigator
      key={shellKey}
      id="MainTabs"
      initialRouteName={initialRouteName}
      tabBar={tabBarMode === 'floating' ? (props) => <GlassPillTabBar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: tabBarMode !== 'floating',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          display: tabBarMode === 'floating' ? 'none' : 'flex',
          height: 70,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
          shadowColor: '#000000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -3 },
          elevation: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
      }}
    >
      {tabScreens.map((screen) => (
        <Tab.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          initialParams={screen.initialParams}
          options={{
            title: screen.title,
            tabBarIcon: ({ color, focused }) => {
              return (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <screen.icon
                    color={focused ? COLORS.primary : color}
                    size={24}
                    strokeWidth={focused ? 2.5 : 2}
                  />
                </View>
              );
            },
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { COLORS } = useTheme();
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  const navigator = (
    <Stack.Navigator id="RootStack" screenOptions={{
      headerShown: false,
      headerStyle: { backgroundColor: COLORS.background },
      headerTintColor: COLORS.textPrimary,
    }}>
      {isSignedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="CourseDetail" component={CourseDetail} options={{ headerShown: true }} />

          <Stack.Screen name="NewCourseSearch" component={NewCourseSearchScreen} options={{ headerShown: true, title: 'Course Search' }} />
          <Stack.Screen name="NewCourseDetail" component={NewCourseDetailScreen} options={{ headerShown: true, title: 'Course Details' }} />
          <Stack.Screen name="ScheduleList" component={ScheduleListScreen} options={{ headerShown: true, title: 'My Schedules' }} />
          <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} options={{ headerShown: true, title: 'Schedule Details' }} />
          <Stack.Screen name="CampusNavigation" component={CampusNavigationScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="BusTimetable"
            component={BusTimetableScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="TransitTripPlanner" component={TransitTripPlannerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TransitTripResults" component={TransitTripResultsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EventsCalendar" component={EventsCalendarScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AnnexHub" component={AnnexHubScreen} options={{ headerShown: false }} />
          <Stack.Screen name="GPACalculator" component={GPACalculatorScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RecreationFacilities" component={RecreationFacilitiesScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="FullMenu"
            component={FullMenuScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="DiningDashboard" component={DiningDashboard} options={{ headerShown: false }} />
          <Stack.Screen name="DiningSettings" component={DiningSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MealOptimizer" component={MealOptimizerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MealTracker" component={MealTrackerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RetailSwipes" component={RetailSwipesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FoodDatabase" component={FoodDatabaseScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WeightTracker" component={WeightTrackerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TrackerHub" component={TrackerHubScreen} options={{ headerShown: false }} />
          <Stack.Screen name="StreakHub" component={StreakHubScreen} options={{ headerShown: false }} />
          <Stack.Screen name="GradesScreen" component={GradesScreen} options={{ headerShown: true, title: 'Grade Distributions' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Onboarding" component={Onboarding} />
          <Stack.Screen name="AuthLanding">
            {(props: any) => (
              <AuthLanding
                onLoginPress={() => props.navigation.navigate('Login')}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Login">
            {(props: any) => <LoginScreen onBack={() => props.navigation.goBack()} />}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );

  return isSignedIn ? <UserSync>{navigator}</UserSync> : navigator;
}

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { registerRootComponent } from 'expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  const { theme, COLORS } = useTheme();

  React.useEffect(() => {
    useThemeStore.getState().loadWallpaperPref().catch((error: unknown) => {
      console.warn('Failed to load theme preferences', error);
    });
  }, []);

  const navigationTheme = React.useMemo(() => {
    const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: COLORS.primary,
        background: COLORS.background,
        card: COLORS.surface,
        text: COLORS.textPrimary,
        border: COLORS.border,
        notification: COLORS.primary,
      },
    };
  }, [COLORS.background, COLORS.border, COLORS.primary, COLORS.surface, COLORS.textPrimary, theme]);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
            <ShareOverlay />
          </NavigationContainer>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({});
