import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useTheme, useThemeStore } from './components/SharedUI';

WebBrowser.maybeCompleteAuthSession();

import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { RecreationFacilitiesScreen } from './components/RecreationFacilitiesScreen';
import { CourseDetail } from './components/CourseDetail';
import { AuthLanding } from './components/AuthLanding';
import { LoginScreen } from './components/LoginScreen';
import { AnnexHubScreen } from './components/AnnexHubScreen';
import { AnnexLibraryDetailScreen } from './components/AnnexLibraryDetailScreen';
import { AnnexRentalDetailScreen } from './components/AnnexRentalDetailScreen';

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
import { ErrorBoundary } from './components/ErrorBoundary';

import { SocialHubScreen } from './components/SocialHubScreen';
import { GradesScreen } from './components/GradesScreen';
import { GPACalculatorScreen } from './components/GPACalculatorScreen';
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
import RestaurantMenuScreen from './components/dining/RestaurantMenuScreen';

import { Home, Map, Users, User, Cog, UtensilsCrossed, Clock3, Settings, Radio } from 'lucide-react-native';
import { GlassPillTabBar } from './components/GlassPillTabBar';
import { getOrderedItems, getOrderedVisibleItems, useAppShellStore } from './store/appShellStore';
import { useSessionStore } from './store/sessionStore';
import { TourTarget, useTour } from './components/onboarding/TourProvider';

import {
  installApiFetchInterceptor,
  requestJson,
  setApiAuthTokenProvider,
  setApiResponseHandlers,
  syncUser,
} from './api/client';
import { TOSScreen } from './components/TOSScreen';
import { NotificationPromptScreen } from './components/onboarding/NotificationPromptScreen';
import { EventPreferenceOnboardingScreen } from './components/onboarding/EventPreferenceOnboardingScreen';

import { AdminApplicationScreen } from './components/admin/AdminApplicationScreen';
import { AdminPortal } from './components/admin/AdminPortal';
import { PendingReviewInterceptor } from './components/events/PendingReviewInterceptor';
import { API_URL } from './config';
import { ClubAccessScreen } from './components/ClubAccessScreen';
import { FocusMotionView } from './components/common/Motion';
import { useEventStore, type MajorOption } from './store/eventStore';

const VALID_EVENT_MAJORS: MajorOption[] = [
  'Engineering',
  'Business',
  'Liberal Arts',
  'Agriculture',
  'Science',
  'Architecture',
  'Education',
  'Public Health',
  'Law',
  'Medicine',
];

function isMajorOption(value: unknown): value is MajorOption {
  return typeof value === 'string' && VALID_EVENT_MAJORS.includes(value as MajorOption);
}

function UserSync({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const isTourCompleted = useAppShellStore((state) => state.isTourCompleted);
  const isEventPreferencesCompleted = useAppShellStore((state) => state.isEventPreferencesCompleted);
  const preferredEventCategories = useAppShellStore((state) => state.preferredEventCategories);
  const preferredTime = useAppShellStore((state) => state.preferredTime);
  const preferredSocialMode = useAppShellStore((state) => state.preferredSocialMode);
  const setTOSAccepted = useAppShellStore((state) => state.setTOSAccepted);
  const setTourCompleted = useAppShellStore((state) => state.setTourCompleted);
  const setEventPreferencesCompleted = useAppShellStore((state) => state.setEventPreferencesCompleted);
  const setPreferredEventCategories = useAppShellStore((state) => state.setPreferredEventCategories);
  const setPreferredTime = useAppShellStore((state) => state.setPreferredTime);
  const setPreferredSocialMode = useAppShellStore((state) => state.setPreferredSocialMode);
  const setSelectedMajor = useEventStore((state) => state.setSelectedMajor);
  const isMajorSpecific = useEventStore((state) => state.isMajorSpecific);
  const setMajorSpecific = useEventStore((state) => state.setMajorSpecific);
  const lastSyncedUserId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (user?.id && lastSyncedUserId.current !== user.id) {
      lastSyncedUserId.current = user.id;
      syncUser(
        user.id,
        user.primaryEmailAddress?.emailAddress,
        user.fullName ?? undefined,
        user.imageUrl ?? undefined,
      ).then((data) => {
        if (data) {
          if (typeof data.tos_accepted === 'boolean') {
            setTOSAccepted(data.tos_accepted);
          }
          if (typeof data.tour_completed === 'boolean') {
            setTourCompleted(isTourCompleted || data.tour_completed);
          }
          const reopeningPrefs = useAppShellStore.getState().showEventPreferencesOnboarding;
          if (!reopeningPrefs) {
            const hasLegacyPreferenceShape =
              !('event_preferences_completed' in data) ||
              (!Array.isArray(data.preferred_event_categories) &&
                data.preferred_time == null &&
                data.preferred_social_mode == null &&
                !isMajorOption(data.major));
            const nextEventPreferencesCompleted =
              typeof data.event_preferences_completed === 'boolean'
                ? data.event_preferences_completed
                : hasLegacyPreferenceShape;
            setEventPreferencesCompleted(
              isEventPreferencesCompleted || nextEventPreferencesCompleted,
            );
            if (Array.isArray(data.preferred_event_categories)) {
              setPreferredEventCategories(
                data.preferred_event_categories.filter((entry: unknown): entry is string => typeof entry === 'string'),
              );
            } else if (!isEventPreferencesCompleted) {
              setPreferredEventCategories([]);
            } else if (preferredEventCategories.length > 0) {
              setPreferredEventCategories(preferredEventCategories);
            } else {
              setPreferredEventCategories([]);
            }
            if (
              data.preferred_time === 'Morning' ||
              data.preferred_time === 'Afternoon' ||
              data.preferred_time === 'Evening' ||
              data.preferred_time === 'Anytime'
            ) {
              setPreferredTime(data.preferred_time);
            } else if (isEventPreferencesCompleted && preferredTime) {
              setPreferredTime(preferredTime);
            } else {
              setPreferredTime(null);
            }
            if (data.preferred_social_mode === 'casual' || data.preferred_social_mode === 'professional') {
              setPreferredSocialMode(data.preferred_social_mode);
            } else if (isEventPreferencesCompleted && preferredSocialMode) {
              setPreferredSocialMode(preferredSocialMode);
            } else {
              setPreferredSocialMode(null);
            }
            if (isMajorOption(data.major)) {
              setSelectedMajor(data.major);
            } else if (!isEventPreferencesCompleted) {
              setMajorSpecific(false);
            }
          }
        }
      }).catch((err: any) => console.warn('UserSync failed:', err));
    }
  }, [isEventPreferencesCompleted, isMajorSpecific, isTourCompleted, preferredEventCategories, preferredSocialMode, preferredTime, setEventPreferencesCompleted, setMajorSpecific, setPreferredEventCategories, setPreferredSocialMode, setPreferredTime, setSelectedMajor, setTOSAccepted, setTourCompleted, user?.fullName, user?.id, user?.imageUrl, user?.primaryEmailAddress?.emailAddress]);

  return <>{children}</>;
}

function ApiAuthBridge() {
  const { getToken } = useAuth();

  React.useLayoutEffect(() => {
    const removeInterceptor = installApiFetchInterceptor();

    setApiAuthTokenProvider(async (options) => {
      try {
        const token = await getToken(options?.forceRefresh ? { skipCache: true } : undefined);
        return token || null;
      } catch (error) {
        console.warn('Failed to fetch Clerk token for API request', error);
        return null;
      }
    });

    setApiResponseHandlers({
      onUnauthorized: async () => {
        console.warn('Backend returned 401 after a Clerk token refresh attempt.');
      },
      onForbidden: async () => {
        console.warn('Backend rejected the configured API key (403).');
      },
    });

    return () => {
      setApiAuthTokenProvider(null);
      setApiResponseHandlers({});
      removeInterceptor();
    };
  }, [getToken]);

  return null;
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

function withTabMotion(Component: React.ComponentType<any>, delay = 0) {
  return function MotionWrappedScreen(props: any) {
    return (
      <FocusMotionView delay={delay} style={{ flex: 1 }}>
        <Component {...props} />
      </FocusMotionView>
    );
  };
}

const AnimatedDashboardScreen = withTabMotion(Dashboard, 0);
const AnimatedPlacesScreen = withTabMotion(PlacesMapScreen, 40);
const AnimatedSocialScreen = withTabMotion(SocialHubScreen, 60);
const AnimatedDiningScreen = withTabMotion(
  () => (
    <ErrorBoundary name="Dining Dashboard">
      <DiningDashboard />
    </ErrorBoundary>
  ),
  50,
);
const AnimatedTimerScreen = withTabMotion(TimerScreen, 80);
const AnimatedSettingsScreen = withTabMotion(Profile, 80);

function MainTabs(props: any) {
  const { COLORS } = useTheme();
  const navItems = useAppShellStore((state) => state.navItems);
  const tabBarMode = useAppShellStore((state) => state.tabBarMode);
  const isGuest = useSessionStore((state) => state.isGuest);
  const visibleNavItems = React.useMemo(() => {
    if (!isGuest) {
      return getOrderedVisibleItems(navItems);
    }
    return getOrderedItems(navItems)
      .filter((item) => item.id === 'Dashboard' || item.id === 'Places')
      .map((item) => ({ ...item, visible: true }));
  }, [isGuest, navItems]);

  const tabScreens = [
    ...visibleNavItems.map((item) => {
      if (item.id === 'Dashboard') {
        return {
          name: 'Dashboard',
          component: AnimatedDashboardScreen,
          title: 'Events',
          icon: Home,
          initialParams: undefined,
        };
      }
      if (item.id === 'Places') {
        return {
          name: 'Places',
          component: AnimatedPlacesScreen,
          title: 'Places',
          icon: Map,
          initialParams: undefined,
        };
      }
      if (item.id === 'Social') {
        return {
          name: 'Social',
          component: AnimatedSocialScreen,
          title: 'Pings',
          icon: Radio,
          initialParams: undefined,
        };
      }
      if (item.id === 'Dining') {
        return {
          name: 'Dining',
          component: AnimatedDiningScreen,
          title: 'Dining',
          icon: UtensilsCrossed,
          initialParams: undefined,
        };
      }
      return {
        name: 'Timer',
        component: AnimatedTimerScreen,
        title: 'Timer',
        icon: Clock3,
        initialParams: undefined,
      };
    }),
    {
      name: 'Settings',
      component: AnimatedSettingsScreen,
      title: 'Settings',
      icon: Settings,
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
            tabBarButton: (props) => {
              return <TabButtonWrapper screenName={screen.name} props={props} />;
            },
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
  const { user } = useUser();
  const isGuest = useSessionStore((state) => state.isGuest);
  const authMode = useSessionStore((state) => state.authMode);
  const exitGuestMode = useSessionStore((state) => state.exitGuestMode);
  const isTOSAccepted = useAppShellStore((state) => state.isTOSAccepted);
  const setTOSAccepted = useAppShellStore((state) => state.setTOSAccepted);
  const isNotificationPrompted = useAppShellStore((state) => state.isNotificationPrompted);
  const setNotificationPrompted = useAppShellStore((state) => state.setNotificationPrompted);
  const isEventPreferencesCompleted = useAppShellStore((state) => state.isEventPreferencesCompleted);
  const setEventPreferencesCompleted = useAppShellStore((state) => state.setEventPreferencesCompleted);
  const showEventPreferencesOnboarding = useAppShellStore((state) => state.showEventPreferencesOnboarding);
  const setShowEventPreferencesOnboarding = useAppShellStore((state) => state.setShowEventPreferencesOnboarding);
  const isAdmin = useAppShellStore((state) => state.adminAccessStatus);
  const setIsAdmin = useAppShellStore((state) => state.setAdminAccessStatus);
  const isRegularUserFlow = isSignedIn && authMode !== 'admin';

  React.useEffect(() => {
    if (isSignedIn && user?.id) {
       requestJson(`/admin/status?clerk_id=${encodeURIComponent(user.id)}`)
         .then(data => setIsAdmin(data.is_admin))
         .catch(err => setIsAdmin(false));
    }
  }, [isSignedIn, user?.id]);

  React.useEffect(() => {
    if (isSignedIn && isGuest) {
      exitGuestMode();
    }
  }, [exitGuestMode, isGuest, isSignedIn]);

  if (!isLoaded) {
    return null;
  }

  let content: React.ReactNode;

  if (isSignedIn && !isTOSAccepted && user?.id) {
    content = (
      <TOSScreen 
        clerkId={user.id} 
        onAccepted={() => setTOSAccepted(true)} 
      />
    );
  } else if (isSignedIn && isTOSAccepted && !isNotificationPrompted) {
    content = (
      <NotificationPromptScreen 
        onDone={() => setNotificationPrompted(true)} 
      />
    );
  } else if (isRegularUserFlow && isTOSAccepted && isNotificationPrompted && isAdmin === null) {
    content = <View style={{ flex: 1, backgroundColor: COLORS.background }} />;
  } else if (
    isRegularUserFlow &&
    isTOSAccepted &&
    isNotificationPrompted &&
    (showEventPreferencesOnboarding || isAdmin === false) &&
    (!isEventPreferencesCompleted || showEventPreferencesOnboarding) &&
    user?.id
  ) {
    content = (
      <EventPreferenceOnboardingScreen
        clerkId={user.id}
        onDone={() => {
          setEventPreferencesCompleted(true);
          setShowEventPreferencesOnboarding(false);
        }}
      />
    );
  } else {
    const hasAppAccess = !!isSignedIn;
    const isAdminRoute = !!isSignedIn && authMode === 'admin';
    const navigatorMode = isAdminRoute ? 'admin' : hasAppAccess ? 'app' : 'auth';

    content = (
      <Stack.Navigator
        key={navigatorMode}
        id="RootStack"
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
        }}
      >
        {isAdminRoute ? (
            isAdmin === null ? (
              <Stack.Screen name="AdminLoading" options={{ headerShown: false }}>
                 {() => <View style={{flex: 1, backgroundColor: COLORS.background}} />}
              </Stack.Screen>
            ) : isAdmin ? (
              <Stack.Screen name="AdminPortal" component={AdminPortal} options={{ headerShown: false }} />
            ) : (
              <Stack.Screen name="AdminApply" component={AdminApplicationScreen} options={{ headerShown: false }} />
            )
          ) : hasAppAccess ? (
          <>
            <Stack.Screen name="Main">
              {(props) => (
                <ErrorBoundary name="Main Dashboard">
                  <MainTabs {...props} />
                </ErrorBoundary>
              )}
            </Stack.Screen>
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
            <Stack.Screen name="AnnexHub" component={AnnexHubScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AnnexLibraryDetail" component={AnnexLibraryDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AnnexRentalDetail" component={AnnexRentalDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ClubAccess" component={ClubAccessScreen} options={{ headerShown: true, title: 'Club Access' }} />
            <Stack.Screen name="GPACalculator" component={GPACalculatorScreen} options={{ headerShown: false }} />
            <Stack.Screen name="RecreationFacilities" component={RecreationFacilitiesScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="FullMenu"
              component={FullMenuScreen}
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <Stack.Screen
              name="RestaurantMenu"
              component={RestaurantMenuScreen}
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
            <Stack.Screen name="AuthLanding">
              {() => <AuthLanding />}
            </Stack.Screen>
            <Stack.Screen name="Login">
              {(props: any) => <LoginScreen onBack={() => props.navigation.goBack()} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    );
  }

  return (
    <>
      <ApiAuthBridge />
      {isSignedIn ? <UserSync>{content}</UserSync> : content}
      {isSignedIn && <PendingReviewInterceptor />}
    </>
  );
}

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { navigationRef } from './navigation/Refs';
import { registerRootComponent } from 'expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupQueryPersistence } from './services/queryCache';
import { TourProvider } from './components/onboarding/TourProvider';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes default
      /** Do not retry timeouts / dead hosts — that doubled perceived load time (two full abort windows). */
      retry: (failureCount, error) => {
        const message = String((error as Error)?.message ?? error ?? '');
        if (/timed out|Network request failed|Failed to fetch/i.test(message)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
setupQueryPersistence(queryClient);

function TabButtonWrapper({ screenName, props }: { screenName: string; props: any }) {
  const { advanceStep, activeTargetName } = useTour();
  const { COLORS } = useTheme();
  const { onPress, onLongPress, ...rest } = props;

  const targetName = `${screenName.toLowerCase()}-tab`;
  const isHighlighted = activeTargetName === targetName;

  const handlePress = (e: any) => {
    if (activeTargetName === targetName) {
      advanceStep(targetName);
    }
    if (onPress) onPress(e);
  };

  return (
    <TourTarget
      name={targetName}
      style={{ flex: 1 }}
      assistAction={() => {
        (navigationRef as any).navigate('Main', { screen: screenName });
        setTimeout(() => advanceStep(targetName), 350);
      }}
    >
      <View
        style={[
          { flex: 1, margin: 4, borderRadius: 12 },
          isHighlighted && {
            backgroundColor: COLORS.primary + '14',
            borderWidth: 1,
            borderColor: COLORS.primary + '45',
          },
        ]}
      >
        <Pressable {...rest} onPress={handlePress} onLongPress={onLongPress} />
      </View>
    </TourTarget>
  );
}

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
          <NavigationContainer theme={navigationTheme} ref={navigationRef}>
            <TourProvider>
              <ErrorBoundary name="Root Navigator">
                <RootNavigator />
              </ErrorBoundary>
            </TourProvider>
          </NavigationContainer>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({});
