import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Bookmark } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const DARK_COLORS = {
  background: '#000000',      // Pure Black
  primary: '#500000',         // Aggie Maroon
  primaryLight: '#3D0000',
  accent: '#FF8A8A',
  textSecondary: '#A0A0A5',
  textTertiary: '#636366',
  textPrimary: '#FFFFFF',
  surface: '#000000',
  surfaceElevated: '#111111',
  border: '#2C2C2E',
  danger: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',
};

export const LIGHT_COLORS = {
  background: '#FAFAFA',      // Barely off-white
  primary: '#500000',         // Aggie Maroon
  primaryLight: '#FFFFFF',    // Bright white for buttons
  accent: '#500000',          // Maroon accent against light bg
  textSecondary: '#666666',   // High contrast grey
  textTertiary: '#8E8E93',    // Light grey
  textPrimary: '#000000',     // Pitch Black
  surface: '#FFFFFF',         // Crisp white cards
  surfaceElevated: '#F2F2F7', // iOS grey system color
  border: '#E5E5EA',          // Hairline grey
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
};

// Zustand Theme Store
export const useThemeStore = create<any>((set) => ({
  theme: 'dark', // 'dark' | 'light'
  setTheme: (newTheme: string) => set({ theme: newTheme })
}));

export const useTheme = () => {
  const theme = useThemeStore((s: any) => s.theme);
  const COLORS = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  return { COLORS, theme, setTheme: useThemeStore.getState().setTheme };
};

export const COLORS = DARK_COLORS; // Fallback for static usage

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

export const Card = ({ children, style }: any) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

export const PrimaryButton = ({ title, onPress, style, textStyle, isLoading, variant = 'primary' }: any) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const isPrimary = variant === 'primary';
  const getBgColor = () => {
    if (variant === 'danger') return COLORS.danger;
    if (variant === 'outline') return 'transparent';
    return isPrimary ? COLORS.primary : COLORS.primaryLight;
  };
  
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.button, 
        { backgroundColor: getBgColor() },
        variant === 'outline' && { borderWidth: 1, borderColor: COLORS.border },
        style,
        pressed && styles.pressed
      ]} 
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? <ActivityIndicator color="#fff" /> : 
      <Text style={[
          styles.buttonText, 
          { color: '#FFFFFF' }, // Always white text on maroon buttons
          variant === 'outline' && { color: COLORS.primary },
          textStyle
      ]}>{title}</Text>}
    </Pressable>
  );
};

export const SectionRow = ({ section, onAdd, onRemove, isAdded }: any) => {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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

const getStyles = (COLORS: any) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8, // Sharper, more modern corners
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600', // Cleaner weight for san-serif
    fontSize: 16,
    letterSpacing: -0.2,
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
