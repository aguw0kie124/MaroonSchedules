import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from './SharedUI';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Card = ({ children, style }: CardProps) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  return <View style={[styles.card, style]}>{children}</View>;
};

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
  });
