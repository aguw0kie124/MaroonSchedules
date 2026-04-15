import React, { useMemo } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from './SharedUI';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textUnselected]}>{label}</Text>
    </Pressable>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      height: 28,
      borderRadius: 999,
      paddingHorizontal: 12,
      justifyContent: 'center',
      marginBottom: 4,
      marginRight: 4,
    },
    pressed: {
      opacity: 0.8,
    },
    selected: {
      backgroundColor: COLORS.primary,
    },
    unselected: {
      backgroundColor: COLORS.primaryLight,
    },
    text: {
      fontSize: 12,
      fontWeight: '500',
    },
    textSelected: {
      color: '#FFFFFF',
    },
    textUnselected: {
      color: COLORS.primary,
    },
  });
