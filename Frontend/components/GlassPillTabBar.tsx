import React from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { TourTarget, useTour } from './onboarding/TourProvider';
import { ScalePressable } from './common/Motion';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function GlassPillTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { COLORS, theme, tabBarMode } = useTheme();
  const { activeTargetName, advanceStep } = useTour();
  const isBottomBarHidden = useAppShellStore((store) => store.isBottomBarHidden);

  const [collapsedRouteKey, setCollapsedRouteKey] = React.useState<string | null>(
    tabBarMode === 'floating' ? state.routes[state.index]?.key ?? null : null,
  );
  const prevIndexRef = React.useRef(state.index);
  const prevModeRef = React.useRef(tabBarMode);

  React.useEffect(() => {
    const indexChanged = prevIndexRef.current !== state.index;
    const modeChanged = prevModeRef.current !== tabBarMode;

    if (indexChanged || modeChanged) {
      if (tabBarMode === 'floating') {
        setCollapsedRouteKey(state.routes[state.index]?.key ?? null);
      } else {
        setCollapsedRouteKey(null);
      }
      prevIndexRef.current = state.index;
      prevModeRef.current = tabBarMode;
    }
  }, [state.index, state.routes, tabBarMode]);

  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  if (isBottomBarHidden) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      <View pointerEvents="box-none" style={[styles.shell, collapsedRouteKey ? styles.shellCollapsed : null]}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const isFocused = state.index === index;
          const isCollapsedItem = collapsedRouteKey === route.key;
          const shouldRender = !collapsedRouteKey || isCollapsedItem;

          const onPress = () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            // Advance Tour if this tab is the target
            if (route.name === 'Places' && activeTargetName === 'places-tab') {
              advanceStep('places-tab');
            }
            if (route.name === 'Social' && activeTargetName === 'social-tab') {
              advanceStep('social-tab');
            }
            if (route.name === 'Settings' && activeTargetName === 'settings-tab') {
              advanceStep('settings-tab');
            }

            if (tabBarMode === 'floating' && collapsedRouteKey && isFocused && isCollapsedItem) {
              setCollapsedRouteKey(null);
              return;
            }

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
              if (tabBarMode === 'floating') {
                setCollapsedRouteKey(route.key);
              }
              return;
            }

            if (tabBarMode === 'floating' && isFocused && !collapsedRouteKey) {
              setCollapsedRouteKey(route.key);
            }
          };

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: isFocused ? COLORS.primary : COLORS.textTertiary,
            size: 20,
          });

          if (!shouldRender) {
            return null;
          }

          const getTargetName = () => {
            if (route.name === 'Dashboard') return 'dashboard-tab';
            if (route.name === 'Places') return 'places-tab';
            if (route.name === 'Social') return 'social-tab';
            if (route.name === 'Settings') return 'settings-tab';
            return null;
          };
          const targetName = getTargetName();

          const itemContent = (
            <>
              {targetName ? (
                <TourTarget
                  name={targetName}
                  assistAction={() => {
                    navigation.navigate(route.name);
                    setTimeout(() => advanceStep(targetName), 350);
                  }}
                >
                  <View style={styles.iconWrap}>{icon}</View>
                </TourTarget>
              ) : (
                <View style={styles.iconWrap}>{icon}</View>
              )}
              {!collapsedRouteKey ? (
                <Text style={[styles.label, isFocused && styles.labelFocused]}>
                  {label}
                </Text>
              ) : null}
            </>
          );

          const item = (
            <ScalePressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              scaleTo={0.94}
              style={[
                styles.item,
                collapsedRouteKey ? styles.itemCollapsed : null,
                collapsedRouteKey && isFocused ? styles.itemFocusedCollapsed : null,
              ]}
            >
              {itemContent}
            </ScalePressable>
          );

          return item;
        })}
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    outer: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      alignItems: 'center',
    },
    shell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      width: '100%',
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(12,12,14,0.85)' : 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 6,
    },
    shellCollapsed: {
      width: 'auto',
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    item: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      borderRadius: 16,
      minWidth: 64,
    },
    itemCollapsed: {
      flex: 0,
      width: 60,
      minWidth: 60,
      height: 60,
      minHeight: 60,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 30,
      gap: 0,
      backgroundColor: isDark ? 'rgba(12,12,14,0.95)' : 'rgba(255,255,255,1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 10,
    },
    itemFocusedCollapsed: {
      // Keep background or highlight if needed
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textTertiary,
      textAlign: 'center',
    },
    labelFocused: {
      color: COLORS.primary,
    },
  });
