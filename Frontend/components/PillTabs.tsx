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
  activeTextMode?: 'always' | 'active-only';
  layout?: 'row' | 'stacked';
}

export function PillTabs({
  items,
  activeKey,
  onChange,
  floating = false,
  compact = false,
  activeTextMode = 'always',
  layout = 'row',
}: PillTabsProps) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
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
  const translateX = indicatorAnim.interpolate({
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
    <View style={[styles.shell, floating && styles.shellFloating, compact && styles.shellCompact]}>
      <View
        style={[styles.track, floating && styles.trackFloating, compact && styles.trackCompact]}
        onLayout={handleLayout}
      >
        <Animated.View
          style={[
            styles.indicator,
            compact && styles.indicatorCompact,
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

const getStyles = (COLORS: any) =>
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
    track: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      borderRadius: 32,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
      padding: 6,
      overflow: 'hidden',
    },
    trackFloating: {
      backgroundColor: 'rgba(8,8,8,0.88)',
      borderColor: 'rgba(255,255,255,0.08)',
    },
    trackCompact: {
      padding: 4,
    },
    indicator: {
      position: 'absolute',
      left: 0,
      top: 6,
      bottom: 6,
      backgroundColor: COLORS.primary,
      borderRadius: 26,
    },
    indicatorCompact: {
      top: 4,
      bottom: 4,
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
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
    },
    labelCompact: {
      fontSize: 11,
    },
    labelActive: {
      color: '#FFFFFF',
    },
    labelInactive: {
      color: COLORS.textTertiary,
    },
  });
