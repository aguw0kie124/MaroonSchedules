import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';

export function GlassPillTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { COLORS, theme } = useTheme();
  const isBottomBarHidden = useAppShellStore((state) => state.isBottomBarHidden);
  const styles = getStyles(COLORS, theme === 'dark');

  if (isBottomBarHidden) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      <View style={styles.shell}>
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

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: isFocused
              ? theme === 'dark'
                ? '#FFFFFF'
                : COLORS.primary
              : COLORS.textTertiary,
            size: 20,
          });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.item, isFocused && styles.itemFocused]}
            >
              <View style={styles.iconWrap}>{icon}</View>
              <Text style={[styles.label, isFocused && styles.labelFocused]}>
                {label}
              </Text>
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
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark
        ? 'rgba(16,16,18,0.88)'
        : 'rgba(255,255,255,0.88)',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    item: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 7,
      borderRadius: 14,
    },
    itemFocused: {
      backgroundColor: isDark
        ? 'rgba(0,0,0,0.68)'
        : 'rgba(12,12,14,0.88)',
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
      color: '#FFFFFF',
    },
  });
