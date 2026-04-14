import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './SharedUI';

export interface PillTabItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

interface PillTabsProps {
  items: PillTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  floating?: boolean;
  compact?: boolean;
  subtle?: boolean;
  activeTextMode?: 'always' | 'active-only';
  layout?: 'row' | 'stacked';
}

export function PillTabs({
  items,
  activeKey,
  onChange,
  floating = false,
  compact = false,
  subtle = false,
  activeTextMode = 'always',
  layout = 'row',
}: PillTabsProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(0, items.findIndex(item => item.key === activeKey));

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 280,
      friction: 32,
    }).start();
  }, [activeIndex, indicatorAnim]);

  const slotWidth = trackWidth > 0 ? trackWidth / Math.max(items.length, 1) : 0;
  const indicatorInset = compact ? 2 : 4;
  const indicatorWidth = Math.max(slotWidth - indicatorInset * 2, 0);
  const translateX = items.length < 2
    ? indicatorInset
    : indicatorAnim.interpolate({
        inputRange: items.map((_, index) => index),
        outputRange: items.map((_, index) => index * slotWidth + indicatorInset),
      });

  const handleLayout = useMemo(
    () => (event: LayoutChangeEvent) => {
      setTrackWidth(event.nativeEvent.layout.width);
    },
    []
  );

  return (
    <View style={[styles.shell, floating && styles.shellFloating, compact && styles.shellCompact, subtle && styles.shellSubtle]}>
      <View
        style={[
          styles.track,
          floating && styles.trackFloating,
          compact && styles.trackCompact,
          subtle && styles.trackSubtle,
        ]}
        onLayout={handleLayout}
      >
        <Animated.View
          style={[
            styles.indicator,
            compact && styles.indicatorCompact,
            subtle && styles.indicatorSubtle,
            {
              width: indicatorWidth || undefined,
              transform: [{ translateX }],
            },
          ]}
        />
        {items.map(item => {
          const isActive = item.key === activeKey;
          const Icon = item.icon;
          const shouldShowText = activeTextMode === 'always' || isActive;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              onPress={() => onChange(item.key)}
              style={[
                styles.tab,
                compact && styles.tabCompact,
                layout === 'stacked' && styles.tabStacked,
                compact && layout === 'stacked' && styles.tabStackedCompact,
              ]}
            >
              {Icon ? (
                <Icon
                  size={compact ? 18 : 20}
                  color={isActive ? '#FFFFFF' : COLORS.textTertiary}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              ) : null}
              {shouldShowText ? (
                <Text
                  style={[
                    styles.label,
                    compact && styles.labelCompact,
                    isActive ? styles.labelActive : styles.labelInactive,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
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
    shell: {
      width: '100%',
    },
    shellFloating: {
      backgroundColor: 'transparent',
    },
    shellCompact: {
      minHeight: 46,
    },
    shellSubtle: {
      width: undefined,
      alignSelf: 'flex-start',
    },
    track: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16,16,18,0.86)' : 'rgba(255,255,255,0.86)',
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      padding: 6,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 10,
    },
    trackFloating: {
      backgroundColor: isDark ? 'rgba(8,8,10,0.9)' : 'rgba(255,255,255,0.9)',
      borderColor: 'rgba(255,255,255,0.08)',
    },
    trackCompact: {
      padding: 4,
    },
    trackSubtle: {
      backgroundColor: isDark ? 'rgba(22,22,24,0.82)' : 'rgba(246,247,250,0.96)',
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.06)',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    indicator: {
      position: 'absolute',
      left: 0,
      top: 6,
      bottom: 6,
      backgroundColor: isDark ? 'rgba(0,0,0,0.74)' : 'rgba(12,12,14,0.88)',
      borderRadius: 999,
    },
    indicatorCompact: {
      top: 4,
      bottom: 4,
    },
    indicatorSubtle: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF',
    },
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      zIndex: 1,
      paddingHorizontal: 8,
    },
    tabCompact: {
      minHeight: 38,
      gap: 4,
    },
    tabStacked: {
      flexDirection: 'column',
      gap: 3,
      paddingHorizontal: 4,
    },
    tabStackedCompact: {
      gap: 2,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'center',
    },
    labelCompact: {
      fontSize: 10,
    },
    labelActive: {
      color: '#FFFFFF',
    },
    labelInactive: {
      color: COLORS.textTertiary,
    },
  });
