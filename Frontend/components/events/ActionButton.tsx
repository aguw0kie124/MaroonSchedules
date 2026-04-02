import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actionButtonSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
});

export function ActionButton({
  color,
  onPress,
  children,
  small = false,
}: {
  color: string;
  onPress: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionButton,
        small ? styles.actionButtonSmall : null,
        { backgroundColor: color },
      ]}
    >
      {children}
    </Pressable>
  );
}
