import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Bookmark } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { ScalePressable } from './common/Motion';

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

export const DEFAULT_LIGHT_ACCENT = '#500000';
export const DEFAULT_DARK_ACCENT = '#500000';
const LEGACY_DEFAULT_ACCENT = '#8E8E93';

export function getDefaultAccentColor(theme: 'light' | 'dark') {
  return theme === 'dark' ? DEFAULT_DARK_ACCENT : DEFAULT_LIGHT_ACCENT;
}

function isLegacyDefaultAccent(accentColor: string | null | undefined) {
  return (accentColor || '').toUpperCase() === LEGACY_DEFAULT_ACCENT;
}

// Zustand Theme Store
export const useThemeStore = create<any>((set, get) => ({
  theme: 'light', // 'dark' | 'light'
  accentColor: DEFAULT_DARK_ACCENT,
  applyAccentToText: false,
  setTheme: (newTheme: string) => {
    const currentTheme = get().theme as 'light' | 'dark';
    const currentAccent = get().accentColor;
    const nextState: Record<string, string> = { theme: newTheme };
    if (
      currentAccent === getDefaultAccentColor(currentTheme) ||
      isLegacyDefaultAccent(currentAccent)
    ) {
      nextState.accentColor = getDefaultAccentColor(newTheme as 'light' | 'dark');
      AsyncStorage.setItem('accent_color', nextState.accentColor).catch(() => {});
    }
    set(nextState);
    AsyncStorage.setItem('theme_mode', newTheme).catch(() => {});
  },
  setAccentColor: (accentColor: string) => {
    set({ accentColor });
    AsyncStorage.setItem('accent_color', accentColor).catch(() => {});
  },
  setApplyAccentToText: (applyAccentToText: boolean) => {
    set({ applyAccentToText });
    AsyncStorage.setItem('accent_text_enabled', JSON.stringify(applyAccentToText)).catch(() => {});
  },
  loadWallpaperPref: async () => {
    const [storedTheme, accentColor, accentTextEnabled, useWallpaper, backgroundMode, wallpaperUri] = await Promise.all([
      AsyncStorage.getItem('theme_mode'),
      AsyncStorage.getItem('accent_color'),
      AsyncStorage.getItem('accent_text_enabled'),
      AsyncStorage.getItem('use_wallpaper'),
      AsyncStorage.getItem('background_mode'),
      AsyncStorage.getItem('custom_wallpaper_uri'),
    ]);

    const nextState: Record<string, unknown> = {};

    const nextTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : get().theme;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      nextState.theme = storedTheme;
    }

    nextState.accentColor =
      !accentColor || isLegacyDefaultAccent(accentColor)
        ? getDefaultAccentColor(nextTheme)
        : accentColor;

    if (accentTextEnabled !== null) {
      nextState.applyAccentToText = accentTextEnabled === 'true';
    }

    if (useWallpaper !== null) nextState.useWallpaper = useWallpaper === 'true';
    if (backgroundMode !== null) nextState.backgroundMode = backgroundMode;
    if (wallpaperUri !== null) nextState.wallpaperUri = wallpaperUri;

    if (Object.keys(nextState).length) {
      set(nextState);
    }
  },
  setUseWallpaper: (val: boolean) => {
    set({ useWallpaper: val });
    AsyncStorage.setItem('use_wallpaper', String(val)).catch(() => {});
  },
  setWallpaperUri: (uri: string | null) => {
    set({ wallpaperUri: uri });
    if (uri) AsyncStorage.setItem('custom_wallpaper_uri', uri).catch(() => {});
    else AsyncStorage.removeItem('custom_wallpaper_uri').catch(() => {});
  },
  setBackgroundMode: (mode: string) => {
    set({ backgroundMode: mode });
    AsyncStorage.setItem('background_mode', mode).catch(() => {});
  }
}));

export const useTheme = () => {
  const theme = useThemeStore((s: any) => s.theme);
  const accentColor = useThemeStore((s: any) => s.accentColor);
  const applyAccentToText = useThemeStore((s: any) => s.applyAccentToText);
  const useWallpaper = useThemeStore((s: any) => s.useWallpaper);
  const backgroundMode = useThemeStore((s: any) => s.backgroundMode);
  const wallpaperUri = useThemeStore((s: any) => s.wallpaperUri);
  
  const palette = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const COLORS = {
    ...palette,
    primary: accentColor,
    accent: accentColor,
    accentText: applyAccentToText ? accentColor : palette.textPrimary,
  };
  return {
    COLORS, 
    theme, 
    useWallpaper, 
    backgroundMode: backgroundMode || 'solid', 
    wallpaperUri, 
    accentColor, 
    applyAccentToText,
    setTheme: useThemeStore.getState().setTheme,
    setAccentColor: useThemeStore.getState().setAccentColor,
    setApplyAccentToText: useThemeStore.getState().setApplyAccentToText,
    setUseWallpaper: useThemeStore.getState().setUseWallpaper,
    setWallpaperUri: useThemeStore.getState().setWallpaperUri,
    setBackgroundMode: useThemeStore.getState().setBackgroundMode,
  };
};

export const WALLPAPER_OPTIONS = [
  { id: 'none', label: 'None', uri: null },
  { id: 'abstract_aggie', label: 'Aggie Abstract', uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800' },
  { id: 'geometric_maroon', label: 'Maroon Geometry', uri: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=800' },
  { id: 'dark_texture', label: 'Carbon Fiber', uri: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&q=80&w=800' },
  { id: 'soft_gradient', label: 'Soft Sunset', uri: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800' },
];

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
  const { COLORS, theme } = useTheme();
  const styles = getStyles(COLORS, theme === 'dark');
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

export const PrimaryButton = ({ title, onPress, style, textStyle, isLoading, variant = 'primary' }: any) => {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);
  const isPrimary = variant === 'primary';
  const getBgColor = () => {
    if (variant === 'danger') return COLORS.danger;
    if (variant === 'outline') return 'transparent';
    return isPrimary ? COLORS.primary : COLORS.primaryLight;
  };
  
  return (
    <ScalePressable
      containerStyle={style}
      style={[
        styles.button,
        { backgroundColor: getBgColor() },
        variant === 'outline' && { borderWidth: 1, borderColor: COLORS.border },
      ]}
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? <ActivityIndicator color="#fff" /> : 
      <Text style={[
          styles.buttonText, 
          { color: '#FFFFFF' }, // Always white text on maroon buttons
          variant === 'outline' && { color: isDark ? '#F3F1ED' : COLORS.textPrimary },
          textStyle
      ]}>{title}</Text>}
    </ScalePressable>
  );
};

export const SectionRow = ({ section, onAdd, onRemove, isAdded }: any) => {
    const { COLORS, theme } = useTheme();
    const styles = getStyles(COLORS, theme === 'dark');
    const { savedSections, toggleSave } = useSavedStore();
    const isSaved = savedSections.some((s:any) => s.id === section.id);

    const prof = section.instructors?.[0];
    const meeting = section.meetings?.[0];
    
    // Formatting presentation Strings
    const timeStr = meeting?.beginTime ? `${meeting.beginTime} - ${meeting.endTime}` : 'Time TBA';
    const daysStr = meeting?.daysOfWeek?.length ? meeting.daysOfWeek.join('') : 'Days TBA';
    const locationStr = meeting?.building ? `${meeting.building} ${meeting.room || ''}`.trim() : 'Location TBA';
    const statusText = section.isOpen ? 'Open' : 'Closed';

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
                    Prof: {prof?.name || 'TBA'} {prof?.overall_rating ? ` · ${prof.overall_rating}/5 (${prof.total_reviews})` : ''}
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

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: isDark ? 'rgba(12,12,14,0.84)' : 'rgba(255,255,255,0.88)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.18 : 0.08,
    shadowRadius: 18,
    elevation: 8,
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
