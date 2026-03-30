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
  const [collapsedRouteKey, setCollapsedRouteKey] = React.useState<string | null>(state.routes[state.index].key);
  const styles = getStyles(COLORS, theme === 'dark');

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

            if (collapsedRouteKey && isFocused && isCollapsedItem) {
              setCollapsedRouteKey(null);
              return;
            }

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
              setCollapsedRouteKey(route.key);
              return;
            }

            if (isFocused && !collapsedRouteKey) {
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

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    outer: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 18,
      alignItems: 'center',
    },
    shell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark
        ? 'rgba(16,16,18,0.88)'
        : 'rgba(255,255,255,0.88)',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
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
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 16,
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
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
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
