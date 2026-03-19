import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

export const COLORS = {
  background: '#F5F5F7',
  primary: '#500000',
  textSecondary: '#666',
  textPrimary: '#000',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  danger: '#DC2626',
  success: '#10B981'
};

export const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>
    {children}
  </View>
);

export const PrimaryButton = ({ title, onPress, style, textStyle, isLoading, variant = 'primary' }: any) => {
  const getBgColor = () => {
    if (variant === 'danger') return COLORS.danger;
    if (variant === 'outline') return 'transparent';
    return COLORS.primary;
  };
  
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.button, 
        { backgroundColor: getBgColor() },
        variant === 'outline' && { borderWidth: 1, borderColor: COLORS.primary },
        style,
        pressed && styles.pressed
      ]} 
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? <ActivityIndicator color="#fff" /> : 
      <Text style={[styles.buttonText, variant === 'outline' && { color: COLORS.primary }, textStyle]}>{title}</Text>}
    </Pressable>
  );
};

export const SectionRow = ({ section, onAdd, onRemove, isAdded }: any) => {
    return (
        <Card style={styles.sectionRow}>
            <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Section {section.section || section.id}</Text>
                <Text style={styles.sectionInfo}>Prof: {section.instructors?.[0]?.name || 'TBA'}</Text>
                <Text style={styles.sectionInfo}>Seats: {section.openSeats !== undefined ? section.openSeats : '?'}</Text>
            </View>
            {onAdd && !isAdded && (
                <PrimaryButton title="Add" onPress={() => onAdd(section.id)} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
            )}
            {onRemove && (
                <PrimaryButton variant="danger" title="Remove" onPress={() => onRemove(section.id)} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
            )}
            {isAdded && !onRemove && (
                <Text style={{color: COLORS.success, fontWeight: '600'}}>Added ✓</Text>
            )}
        </Card>
    );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
  },
  sectionTitle: {
      fontWeight: 'bold',
      fontSize: 16,
      marginBottom: 4,
  },
  sectionInfo: {
      fontSize: 14,
      color: COLORS.textSecondary
  }
});
