import React from 'react';
import { Text, Pressable, StyleSheet, SafeAreaView, View, StyleProp, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'icon';
    children: React.ReactNode;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabled?: boolean;
}

// Colors from Dashboard.tsx
const COLORS = {
    primary: '#500000',
    primaryLight: '#FFE5E5',
    surface: '#FFFFFF',
    border: '#E0E0E0',
    textSecondary: '#666',
};

export function Button({ variant = 'primary', children, onPress, style, textStyle, disabled }: ButtonProps) {
    const getContainerStyle = (pressed: boolean) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'icon' && styles.icon,
        pressed && styles.pressed,
        style,
    ];

    const getTextStyle = () => [
        styles.textBase,
        variant === 'primary' && styles.textPrimary,
        variant === 'secondary' && styles.textSecondary,
        textStyle,
    ];

    return (
        <Pressable 
            style={({ pressed }) => [getContainerStyle(pressed), disabled && { opacity: 0.5 }]} 
            onPress={onPress}
            disabled={disabled}
        >
            {variant === 'icon' ? (
                children
            ) : (
                <Text style={getTextStyle()}>{children}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: 12, // rounded-xl
        justifyContent: 'center',
        alignItems: 'center',
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
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
