import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Compass,
  GraduationCap,
  LayoutGrid,
  Radio,
  SlidersHorizontal,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Card, PrimaryButton, useTheme } from './SharedUI';
import {
  APP_MODE_OPTIONS,
  AppMode,
  DEFAULT_NAV_ITEMS,
  NavItemId,
  PARKING_PERMIT_OPTIONS,
  ParkingPermit,
  PLACES_VIEW_MODE_OPTIONS,
  PlacesViewMode,
  getShellPresetState,
  SHELL_PRESET_OPTIONS,
  ShellPresetId,
  UI_DENSITY_OPTIONS,
  UIDensity,
  useAppShellStore,
} from '../store/appShellStore';

const LANDING_OPTIONS: Array<{ id: NavItemId; label: string }> = DEFAULT_NAV_ITEMS
  .filter((item) => ['Dashboard', 'Places', 'Dining', 'Social'].includes(item.id))
  .map((item) => ({ id: item.id, label: item.label }));

function getModeIcon(mode: AppMode) {
  switch (mode) {
    case 'academic':
      return GraduationCap;
    case 'social':
      return Radio;
    case 'navigation':
      return Compass;
    case 'dining':
      return UtensilsCrossed;
    case 'all_in_one':
    default:
      return LayoutGrid;
  }
}

export function Onboarding() {
  const navigation = useNavigation<any>();
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const shellPreset = useAppShellStore((state) => state.shellPreset);
  const appMode = useAppShellStore((state) => state.appMode);
  const density = useAppShellStore((state) => state.density);
  const defaultLandingTab = useAppShellStore((state) => state.defaultLandingTab);
  const parkingPermit = useAppShellStore((state) => state.parkingPermit);
  const placesViewMode = useAppShellStore((state) => state.placesViewMode);
  const applyPreset = useAppShellStore((state) => state.applyPreset);
  const setAppMode = useAppShellStore((state) => state.setAppMode);
  const setDensity = useAppShellStore((state) => state.setDensity);
  const setDefaultLandingTab = useAppShellStore((state) => state.setDefaultLandingTab);
  const setParkingPermit = useAppShellStore((state) => state.setParkingPermit);
  const setPlacesViewMode = useAppShellStore((state) => state.setPlacesViewMode);

  const [step, setStep] = React.useState(0);
  const [selectedPreset, setSelectedPreset] = React.useState<ShellPresetId>(shellPreset);
  const [selectedMode, setSelectedMode] = React.useState<AppMode>(appMode);
  const [selectedDensity, setSelectedDensity] = React.useState<UIDensity>(density);
  const [selectedLanding, setSelectedLanding] = React.useState<NavItemId>(defaultLandingTab);
  const [selectedPermit, setSelectedPermit] = React.useState<ParkingPermit>(parkingPermit);
  const [selectedPlacesView, setSelectedPlacesView] = React.useState<PlacesViewMode>(placesViewMode);

  const steps = [
    {
      title: 'Choose your shell',
      body: 'Start with a preset that matches how you move through campus. You can fine-tune everything later in Settings.',
    },
    {
      title: 'Set your priority',
      body: 'Tell MaroonLife what should come forward first when space is limited.',
    },
    {
      title: 'Finish your layout',
      body: 'Pick how dense the UI should feel and where the app should land first.',
    },
  ];

  const handleContinue = () => {
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    applyPreset(selectedPreset);
    setAppMode(selectedMode);
    setDensity(selectedDensity);
    setDefaultLandingTab(selectedLanding);
    setParkingPermit(selectedPermit);
    setPlacesViewMode(selectedPlacesView);
    navigation.navigate('AuthLanding');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <GraduationCap size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.eyebrow}>Campus OS Setup</Text>
          <Text style={styles.title}>{steps[step].title}</Text>
          <Text style={styles.description}>{steps[step].body}</Text>
          <View style={styles.progressRow}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {step === 0 ? (
          <View style={styles.optionGroup}>
            {SHELL_PRESET_OPTIONS.map((preset) => {
              const selected = preset.id === selectedPreset;
              return (
                <Pressable
                  key={preset.id}
                  style={[styles.optionCard, selected && styles.optionCardActive]}
                  onPress={() => {
                    const presetState = getShellPresetState(preset.id);
                    setSelectedPreset(preset.id);
                    setSelectedMode(presetState.appMode);
                    setSelectedDensity(presetState.density);
                    setSelectedLanding(presetState.defaultLandingTab);
                    setSelectedPermit(presetState.parkingPermit);
                    setSelectedPlacesView(presetState.placesViewMode);
                  }}
                >
                  <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                    {preset.label}
                  </Text>
                  <Text style={styles.optionBody}>{preset.description}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.optionGroup}>
            {APP_MODE_OPTIONS.map((mode) => {
              const selected = mode.id === selectedMode;
              const Icon = getModeIcon(mode.id);
              return (
                <Pressable
                  key={mode.id}
                  style={[styles.modeCard, selected && styles.optionCardActive]}
                  onPress={() => setSelectedMode(mode.id)}
                >
                  <View style={styles.modeIconWrap}>
                    <Icon size={20} color={selected ? '#FFFFFF' : COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                      {mode.label}
                    </Text>
                    <Text style={styles.optionBody}>{mode.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.optionGroup}>
            <Card style={styles.preferenceCard}>
              <View style={styles.preferenceHeader}>
                <SlidersHorizontal size={18} color={COLORS.primary} />
                <Text style={styles.preferenceTitle}>UI Density</Text>
              </View>
              <View style={styles.chipRow}>
                {UI_DENSITY_OPTIONS.map((option) => {
                  const selected = option.id === selectedDensity;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                      onPress={() => setSelectedDensity(option.id)}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Default Landing</Text>
              <View style={styles.chipRow}>
                {LANDING_OPTIONS.map((option) => {
                  const selected = option.id === selectedLanding;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                      onPress={() => setSelectedLanding(option.id)}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Places Default</Text>
              <View style={styles.chipRow}>
                {PLACES_VIEW_MODE_OPTIONS.map((option) => {
                  const selected = option.id === selectedPlacesView;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                      onPress={() => setSelectedPlacesView(option.id)}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Parking Permit</Text>
              <View style={styles.permitList}>
                {PARKING_PERMIT_OPTIONS.map((option) => {
                  const selected = option.id === selectedPermit;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.permitRow, selected && styles.permitRowActive]}
                      onPress={() => setSelectedPermit(option.id)}
                    >
                      <Text style={[styles.permitTitle, selected && styles.optionTitleActive]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionBody}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable style={styles.secondaryButton} onPress={() => setStep((current) => current - 1)}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <PrimaryButton
          title={step === steps.length - 1 ? 'Continue to Sign In' : 'Continue'}
          onPress={handleContinue}
          style={styles.primaryButton}
        />
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    contentContainer: {
      paddingHorizontal: 18,
      paddingTop: 72,
      paddingBottom: 160,
      gap: 16,
    },
    heroCard: {
      padding: 24,
      borderRadius: 30,
      backgroundColor: isDark ? 'rgba(18,18,20,0.88)' : 'rgba(255,255,255,0.9)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    },
    heroBadge: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      color: COLORS.primary,
      marginBottom: 8,
    },
    title: {
      fontSize: 30,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.8,
      marginBottom: 10,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: COLORS.textSecondary,
    },
    progressRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
    },
    progressDot: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(80,0,0,0.12)',
    },
    progressDotActive: {
      backgroundColor: COLORS.primary,
    },
    optionGroup: {
      gap: 14,
    },
    optionCard: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.88)',
    },
    modeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.88)',
    },
    optionCardActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    modeIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    optionTitleActive: {
      color: '#FFFFFF',
    },
    optionBody: {
      fontSize: 13,
      lineHeight: 19,
      color: isDark ? '#B8B8BE' : COLORS.textSecondary,
    },
    preferenceCard: {
      borderRadius: 24,
      gap: 14,
    },
    preferenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    preferenceTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    choiceChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.12)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.04)',
    },
    choiceChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    choiceChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    choiceChipTextActive: {
      color: '#FFFFFF',
    },
    permitList: {
      gap: 10,
    },
    permitRow: {
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(80,0,0,0.03)',
    },
    permitRowActive: {
      borderColor: COLORS.primary,
      backgroundColor: isDark ? 'rgba(80,0,0,0.34)' : 'rgba(80,0,0,0.08)',
    },
    permitTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    footer: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 26,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    secondaryButton: {
      paddingHorizontal: 18,
      height: 54,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(80,0,0,0.06)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    primaryButton: {
      flex: 1,
      height: 54,
      borderRadius: 18,
    },
  });
