import React, { useMemo } from 'react';
import { Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { ScalePressable } from './common/Motion';
import { useTheme } from './SharedUI';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'icon';
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

export function Button({ variant = 'primary', children, onPress, style, textStyle, disabled }: ButtonProps) {
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const getContainerStyle = () => [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'icon' && styles.icon,
    style,
  ];

  const getTextStyle = () => [
    styles.textBase,
    variant === 'primary' && styles.textPrimary,
    variant === 'secondary' && styles.textSecondary,
    textStyle,
  ];

  return (
    <ScalePressable
      style={getContainerStyle()}
      containerStyle={disabled ? { opacity: 0.5 } : undefined}
      onPress={onPress}
      disabled={disabled}
    >
      {variant === 'icon' ? (
        children
      ) : typeof children === 'string' || typeof children === 'number' ? (
        <Text style={getTextStyle()}>{children}</Text>
      ) : (
        children
      )}
    </ScalePressable>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    base: {
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primary: {
      height: 48,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 24,
    },
    secondary: {
      height: 48,
      backgroundColor: COLORS.primaryLight,
      paddingHorizontal: 24,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    textBase: {
      fontWeight: '600',
      fontSize: 16,
    },
    textPrimary: {
      color: '#FFFFFF',
    },
    textSecondary: {
      color: COLORS.primary,
    },
  });
