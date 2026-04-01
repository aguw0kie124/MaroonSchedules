import React from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function GlassPillTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { COLORS, theme } = useTheme();
  const isBottomBarHidden = useAppShellStore((state) => state.isBottomBarHidden);
  const tabBarMode = useAppShellStore((state) => state.tabBarMode);
  const insets = useSafeAreaInsets();
  
  const [collapsedRouteKey, setCollapsedRouteKey] = React.useState<string | null>(
    tabBarMode === 'solid' ? null : state.routes[state.index].key
  );

  React.useEffect(() => {
    if (tabBarMode === 'solid') {
      setCollapsedRouteKey(null);
    }
  }, [tabBarMode]);
  
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark, tabBarMode, insets);

  if (isBottomBarHidden) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      <View style={[styles.shell, collapsedRouteKey ? styles.shellCollapsed : null]}>
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
            color: isFocused
              ? COLORS.primary
              : COLORS.textTertiary,
            size: 20,
          });

          if (!shouldRender) {
            return null;
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={[
                styles.item,
                isFocused && styles.itemFocused,
                collapsedRouteKey ? styles.itemCollapsed : null,
                collapsedRouteKey && isFocused ? styles.itemFocusedCollapsed : null,
              ]}
            >
              <View style={styles.iconWrap}>{icon}</View>
              {!collapsedRouteKey ? (
                <Text
                  style={[
                    styles.label,
                    isFocused && styles.labelFocused,
                    collapsedRouteKey ? styles.labelCollapsed : null,
                  ]}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, tabBarMode: 'floating' | 'solid', insets: any) =>
  StyleSheet.create({
    outer: {
      position: 'absolute',
      left: tabBarMode === 'solid' ? 0 : 16,
      right: tabBarMode === 'solid' ? 0 : 16,
      bottom: tabBarMode === 'solid' ? 0 : 18,
      alignItems: 'center',
    },
    shell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      width: '100%',
      paddingVertical: 8,
      paddingBottom: tabBarMode === 'solid' ? Math.max(insets.bottom, 12) : 8,
      borderRadius: tabBarMode === 'solid' ? 0 : 999,
      backgroundColor: isDark
        ? tabBarMode === 'solid' ? 'rgba(10,10,12,0.98)' : 'rgba(16,16,18,0.88)'
        : tabBarMode === 'solid' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.88)',
      borderTopWidth: tabBarMode === 'solid' ? 1 : 0,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      elevation: tabBarMode === 'solid' ? 0 : 4,
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
    itemFocused: {
      // Background removed to fix obnoxiously large rectangle
    },
    itemCollapsed: {
      flex: 0,
      width: 56,
      minWidth: 56,
      height: 56,
      minHeight: 56,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 28,
      gap: 0,
    },
    itemFocusedCollapsed: {
      backgroundColor: isDark
        ? 'rgba(0,0,0,0.82)'
        : 'rgba(255,255,255,1)',
      borderWidth: 0,
      borderColor: "transparent",
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
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
    labelCollapsed: {
      fontSize: 11,
    },
  });
