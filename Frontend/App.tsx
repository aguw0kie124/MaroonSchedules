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
import { Search } from './components/Search';
import { Builder } from './components/Builder';

import { Saved } from './components/Saved';
import { Profile } from './components/Profile';
import { CampusConnectorScreen } from './components/CampusConnectorScreen';
import { RecreationFacilitiesScreen } from './components/RecreationFacilitiesScreen';
import { CourseDetail } from './components/CourseDetail';
import { AuthLanding } from './components/AuthLanding';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen';
import { UsersScreen } from './components/UsersScreen';
import { ChannelListScreen } from './components/ChannelListScreen';

import { NewCourseSearchScreen } from './components/NewCourseSearchScreen';
import { NewCourseDetailScreen } from './components/NewCourseDetailScreen';
import { ScheduleListScreen } from './components/ScheduleListScreen';
import { ScheduleDetailScreen } from './components/ScheduleDetailScreen';
import { CampusMapScreen } from './components/CampusMapScreen';
import { LocationSearchScreen } from './components/LocationSearchScreen';
// import { ExtrasSidebar } from './components/ExtrasSidebar';
import { CampusNavigationScreen } from './components/CampusNavigationScreen';
import BusTimetableScreen from './components/BusTimetableScreen';
import { TransitTripPlannerScreen } from './components/TransitTripPlannerScreen';
import { TransitTripResultsScreen } from './components/TransitTripResultsScreen';
import { PlacesMapScreen } from './components/PlacesMapScreen';
import { EventsCalendarScreen } from './components/EventsCalendarScreen';
import { ForYouScreen } from './components/ForYouScreen';
import { CampusFeedScreen } from './components/CampusFeedScreen';
import { ReelsScreen } from './components/ReelsScreen';

import { CampusScreen } from './components/CampusScreen';
import { SocialHubScreen } from './components/SocialHubScreen';
import { GradesScreen } from './components/GradesScreen';

import FullMenuScreen from './components/dining/FullMenuScreen';
import { CanvasDashboardScreen } from './components/canvas/CanvasDashboardScreen';
import { CanvasCoursesScreen } from './components/canvas/CanvasCoursesScreen';
import { CanvasAssignmentsScreen } from './components/canvas/CanvasAssignmentsScreen';
import { CanvasGradesScreen } from './components/canvas/CanvasGradesScreen';

import { Bus, Calendar, CalendarDays, Clock3, Compass, MessageCircle, Cog } from 'lucide-react-native';
import { useTheme, useThemeStore } from './components/SharedUI';
import { getOrderedVisibleItems, useAppShellStore } from './store/appShellStore';

import { syncUser } from './api/client';

/**
 * Invisible component that syncs the signed-in Clerk user to the PostgreSQL
 * users table on every app load.  Renders its children unchanged.
 */
function UserSync({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const lastSyncedUserId = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Load wallpaper preference from storage
    useThemeStore.getState().loadWallpaperPref?.();

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
  const defaultLandingTab = useAppShellStore((state) => state.defaultLandingTab);
  const visibleNavItems = React.useMemo(
    () => getOrderedVisibleItems(navItems),
    [navItems],
  );

  const tabScreens = [
    ...visibleNavItems.map((item) => {
      if (item.id === 'Dashboard') {
        return {
          name: 'Dashboard',
          component: Dashboard,
          title: 'Home',
          icon: Calendar,
          initialParams: undefined,
        };
      }
      if (item.id === 'Places') {
        return {
          name: 'Places',
          component: PlacesMapScreen,
          title: 'Places',
          icon: Compass,
          initialParams: undefined,
        };
      }
      if (item.id === 'Social') {
        return {
          name: 'Social',
          component: SocialHubScreen,
          title: 'Social',
          icon: MessageCircle,
          initialParams: undefined,
        };
      }
      if (item.id === 'Events') {
        return {
          name: 'Events',
          component: EventsCalendarScreen,
          title: 'Events',
          icon: CalendarDays,
          initialParams: undefined,
        };
      }
      return {
        name: 'BusRoutes',
        component: PlacesMapScreen,
        title: 'Bus',
        icon: Bus,
        initialParams: { initialLayer: 'Bus', focusToken: 1 },
      };
    }),
    {
      name: 'Settings',
      component: Profile,
      title: 'Settings',
      icon: Cog,
      initialParams: undefined,
    },
  ];

  const availableRouteNames = tabScreens.map((screen) => screen.name);
  const initialRouteName = availableRouteNames.includes('Places')
    ? 'Places'
    : availableRouteNames.includes(defaultLandingTab)
    ? defaultLandingTab
    : availableRouteNames[0];
  const shellKey = `${initialRouteName}:${availableRouteNames.join('|')}`;

  return (
    <Tab.Navigator
      key={shellKey}
      id="MainTabs"
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
          shadowColor: '#000000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -3 },
          elevation: 8,
        },
        tabBarActiveTintColor: '#500000',
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.1,
        },
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
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width:
                    focused && screen.name === 'Places'
                      ? 42
                      : focused
                      ? 34
                      : 26,
                  height: focused ? 28 : 24,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? '#500000' : 'transparent',
                }}
              >
                <screen.icon color={focused ? '#FFFFFF' : color} size={focused ? 15 : 14} />
              </View>
            ),
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
          <Stack.Screen
            name="ChatScreen"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ChannelListScreen"
            component={ChannelListScreen}
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
          <Stack.Screen name="LocationSearch" component={LocationSearchScreen} options={{ headerShown: true, title: 'Location Traffic Search' }} />
          <Stack.Screen name="CampusNavigation" component={CampusNavigationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusTimetable" component={BusTimetableScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TransitTripPlanner" component={TransitTripPlannerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TransitTripResults" component={TransitTripResultsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CampusMap" component={CampusMapScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EventsCalendar" component={EventsCalendarScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ForYou" component={ForYouScreen} options={{ headerShown: false }} />

          <Stack.Screen name="Reels" component={ReelsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CampusConnector" component={CampusConnectorScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RecreationFacilities" component={RecreationFacilitiesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CampusFeed" component={CampusFeedScreen} options={{ headerShown: false }} />

          <Stack.Screen name="FullMenu" component={FullMenuScreen} options={{ headerShown: false }} />

          <Stack.Screen name="CanvasDashboard" component={CanvasDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CanvasCourses" component={CanvasCoursesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CanvasAssignments" component={CanvasAssignmentsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CanvasGrades" component={CanvasGradesScreen} options={{ headerShown: false }} />
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

  // Wrap with UserSync only when signed in so the DB row is created/updated
  return isSignedIn ? <UserSync>{navigator}</UserSync> : navigator;
}

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { registerRootComponent } from 'expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  const { theme } = useTheme();

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={theme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({});
