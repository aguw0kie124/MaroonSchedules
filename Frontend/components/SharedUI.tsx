import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Bookmark } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const COLORS = {
  background: '#000000',     // Pure Black
  primary: '#500000',        // Aggie Maroon
  primaryLight: '#2A0000',   // Deep subtle maroon glow
  textSecondary: '#C7C7CC',  // Brighter grey for A11y high contrast
  textPrimary: '#FFFFFF',    // Pristine White
  surface: '#121212',        // Elevated dark grey for cards
  border: '#2C2C2E',         // Subtle borders
  danger: '#FF3B30',
  success: '#32D74B'
};

export const useSavedStore = create<any>((set, get) => ({
  savedSections: [],
  loadSaved: async () => {
    const data = await AsyncStorage.getItem('saved_sections_store');
    if (data) set({ savedSections: JSON.parse(data) });
  },
  toggleSave: async (section: any) => {
    const { savedSections } = get();
    const exists = savedSections.find((s: any) => s.id === section.id);
    const newSaved = exists ? savedSections.filter((s:any) => s.id !== section.id) : [...savedSections, section];
    set({ savedSections: newSaved });
    await AsyncStorage.setItem('saved_sections_store', JSON.stringify(newSaved));
  }
}));

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
    const { savedSections, toggleSave } = useSavedStore();
    const isSaved = savedSections.some((s:any) => s.id === section.id);

    const prof = section.instructors?.[0];
    const meeting = section.meetings?.[0];
    
    // Formatting presentation Strings
    const timeStr = meeting?.beginTime ? `${meeting.beginTime} - ${meeting.endTime}` : 'Time TBA';
    const daysStr = meeting?.daysOfWeek?.length ? meeting.daysOfWeek.join('') : 'Days TBA';
    const locationStr = meeting?.building ? `${meeting.building} ${meeting.room || ''}`.trim() : 'Location TBA';
    const statusText = section.isOpen ? '🟢 Open' : '🔴 Closed';

    return (
        <Card style={styles.sectionRow}>
            <View style={{ flex: 1 }}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <View style={{flex: 1}}>
                        <Text style={styles.sectionTitle}>
                            {section.dept ? `${section.dept} ${section.courseNumber} - Sec ${section.sectionNumber}` : `Section ${section.sectionNumber || section.section || section.id}`}
                        </Text>
                        {section.courseTitle && (
                            <Text style={{fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6}}>
                                {section.courseTitle}
                            </Text>
                        )}
                    </View>
                    <Pressable onPress={() => toggleSave(section)} style={styles.bookmarkBtn}>
                        <Bookmark size={22} color={isSaved ? '#FF9500' : COLORS.textSecondary} fill={isSaved ? '#FF9500' : 'none'} />
                    </Pressable>
                </View>
                
                <Text style={styles.sectionInfo}>
                    Prof: {prof?.name || 'TBA'} {prof?.overall_rating ? `⭐ ${prof.overall_rating}/5 (${prof.total_reviews})` : ''}
                </Text>
                
                <Text style={styles.sectionInfo}>
                    Meetings: {daysStr} @ {timeStr}
                </Text>

                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 8}}>
                    <MapPin size={14} color={COLORS.textSecondary} style={{marginRight: 4}} />
                    <Text style={[styles.sectionInfo, {marginBottom: 0}]}>{locationStr}</Text>
                </View>
                
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                    <Text style={styles.sectionInfo}>Status: {statusText}</Text>
                    <View style={{flexDirection: 'row', gap: 8}}>
                        {onAdd && !isAdded && (
                            <PrimaryButton title="Add" onPress={() => onAdd(section.id)} style={styles.actionBtn} />
                        )}
                        {onRemove && (
                            <PrimaryButton variant="danger" title="Remove" onPress={() => onRemove(section.id)} style={styles.actionBtn} />
                        )}
                        {isAdded && !onRemove && (
                            <Text style={{color: COLORS.success, fontWeight: '700'}}>Added ✓</Text>
                        )}
                    </View>
                </View>
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary, // Subtle maroon glow
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700', // Harder weight
    fontSize: 16,
    letterSpacing: -0.3,
  },
  pressed: {
    opacity: 0.8,
    transform: [{scale: 0.98}]
  },
  sectionRow: {
      flexDirection: 'column',
  },
  sectionTitle: {
      fontWeight: '800', // Heavy Apple SF Pro Display
      fontSize: 18,
      marginBottom: 2,
      letterSpacing: -0.5,
      color: COLORS.textPrimary
  },
  sectionInfo: {
      fontSize: 15,
      color: COLORS.textSecondary,
      marginBottom: 4,
  },
  bookmarkBtn: {
      padding: 8,
      marginLeft: 8,
      backgroundColor: '#1E1E1E',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
  },
  actionBtn: {
      paddingVertical: 8, 
      paddingHorizontal: 16, 
      borderRadius: 12
  }
});
