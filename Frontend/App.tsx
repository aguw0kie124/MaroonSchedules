import React from 'react';
import { View, StyleSheet, Dimensions, Animated, TouchableOpacity, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { Search } from './components/Search';
import { Builder } from './components/Builder';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { COLORS } = useTheme();
  const totalW = Dimensions.get('window').width - 40;
  const tabW = totalW / state.routes.length;
  const indicatorAnim = React.useRef(new Animated.Value(state.index)).current;

  React.useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: state.index,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [state.index]);

  const translateX = indicatorAnim.interpolate({
    inputRange: state.routes.map((_: any, i: number) => i),
    outputRange: state.routes.map((_: any, i: number) => i * tabW),
  });

  return (
    <View style={{
      position: 'absolute',
      bottom: 24,
      left: 0,
      right: 0,
      alignItems: 'center',
      backgroundColor: 'transparent'
    }} pointerEvents="box-none">
      <View style={{
         width: totalW,
         height: 64,
         backgroundColor: COLORS.surface,
         borderRadius: 32,
         borderWidth: StyleSheet.hairlineWidth,
         borderColor: COLORS.border,
         shadowColor: '#000',
         shadowOffset: { width: 0, height: 8 },
         shadowOpacity: 0.25,
         shadowRadius: 20,
         elevation: 12,
         flexDirection: 'row',
         alignItems: 'center',
         padding: 6,
      }}>
        {/* Animated Background Indicator */}
        <Animated.View style={{
          position: 'absolute',
          left: 6,
          top: 6,
          bottom: 6,
          width: tabW - 12,
          backgroundColor: '#800000', // Maroon
          borderRadius: 26,
          transform: [{ translateX }]
        }} />

        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          let IconName: any;
          if (route.name === 'Dashboard') IconName = Calendar;
          else if (route.name === 'Places') IconName = MapPin;
          else if (route.name === 'Social') IconName = Radio;
          else if (route.name === 'Dining') IconName = UtensilsCrossed;
          else if (route.name === 'Profile') IconName = User;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}
            >
              {IconName && <IconName size={22} color={isFocused ? '#FFFFFF' : COLORS.textTertiary} strokeWidth={isFocused ? 2.5 : 2} />}
              {isFocused && <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
import { Saved } from './components/Saved';
import { Profile } from './components/Profile';
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
import { PlacesMapScreen } from './components/PlacesMapScreen';
import { EventsCalendarScreen } from './components/EventsCalendarScreen';
import { ForYouScreen } from './components/ForYouScreen';
import { CampusFeedScreen } from './components/CampusFeedScreen';
import { ReelsScreen } from './components/ReelsScreen';
import { GPACalculatorScreen } from './components/GPACalculatorScreen';
import { CampusScreen } from './components/CampusScreen';
import { SocialHubScreen } from './components/SocialHubScreen';

import DiningDashboard from './components/dining/DiningDashboard';
import MealOptimizerScreen from './components/dining/MealOptimizerScreen';
import MealTrackerScreen from './components/dining/MealTrackerScreen';
import FoodDatabaseScreen from './components/dining/FoodDatabaseScreen';
import RetailSwipesScreen from './components/dining/RetailSwipesScreen';
import DiningSettingsScreen from './components/dining/DiningSettingsScreen';
import WeightTrackerScreen from './components/dining/WeightTrackerScreen';
import TrackerHubScreen from './components/dining/TrackerHubScreen';
import StreakHubScreen from './components/dining/StreakHubScreen';

import { Calendar, Search as SearchIcon, Grid3x3, Bookmark, User, Menu, Compass, MessageSquare, MapPin, Radio, UtensilsCrossed } from 'lucide-react-native';
import { useTheme, useThemeStore } from './components/SharedUI';

import { syncUser } from './api/client';

/**
 * Invisible component that syncs the signed-in Clerk user to the PostgreSQL
 * users table on every app load.  Renders its children unchanged.
 */
function UserSync({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  React.useEffect(() => {
    // Load wallpaper preference from storage
    useThemeStore.getState().loadWallpaperPref?.();

    if (user) {
      syncUser(
        user.id,
        user.primaryEmailAddress?.emailAddress,
        user.fullName ?? undefined,
        user.imageUrl ?? undefined,
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



function MainTabs() {
  const { COLORS } = useTheme();
  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} options={{ title: 'Home' }} />
      <Tab.Screen name="Places" component={PlacesMapScreen} options={{ title: 'Places' }} />
      <Tab.Screen name="Social" component={SocialHubScreen} options={{ title: 'Social' }} />
      <Tab.Screen name="Dining" component={DiningDashboard} options={{ title: 'Dining' }} />
      <Tab.Screen name="Profile" component={Profile} options={{ title: 'Profile' }} />
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
          <Stack.Screen name="EventsCalendar" component={EventsCalendarScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ForYou" component={ForYouScreen} options={{ headerShown: false }} />
          <Stack.Screen name="GPACalculator" component={GPACalculatorScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Reels" component={ReelsScreen} options={{ headerShown: false }} />
          
          <Stack.Screen name="DiningDashboard" component={DiningDashboard} options={{ headerShown: false }} />
          <Stack.Screen name="MealOptimizer" component={MealOptimizerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TrackerHub" component={TrackerHubScreen} options={{ headerShown: false }} />
          <Stack.Screen name="StreakHub" component={StreakHubScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MealTracker" component={MealTrackerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FoodDatabase" component={FoodDatabaseScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RetailSwipes" component={RetailSwipesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DiningSettings" component={DiningSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WeightTracker" component={WeightTrackerScreen} options={{ headerShown: false }} />
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

function App() {
  const { theme } = useTheme();
  
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <NavigationContainer theme={theme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </NavigationContainer>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

registerRootComponent(App);
