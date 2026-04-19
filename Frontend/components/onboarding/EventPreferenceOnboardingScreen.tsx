import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle,
  ChevronLeft,
  Church,
  Compass,
  Dumbbell,
  EyeOff,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  Leaf,
  Monitor,
  MoreHorizontal,
  Music,
  Palette,
  Pizza,
  Rocket,
  Scale,
  Speech,
  Sprout,
  Stethoscope,
  Theater,
  Ticket,
  Trees,
  Trophy,
  Users,
  Utensils,
  Zap,
} from 'lucide-react-native';

import { updateUserProfile } from '../../api/client';
import { useAppShellStore } from '../../store/appShellStore';
import { useEventStore, type MajorOption } from '../../store/eventStore';
import { NotificationPromptScreen } from './NotificationPromptScreen';

type Props = {
  clerkId: string;
  onDone: () => void;
};

type StoredCategory = 'Featured' | 'Food' | 'Sports' | 'Social' | 'Academic' | 'Entertainment';

const { width } = Dimensions.get('window');

const COLORS = {
  maroon950: '#270000',
  maroon900: '#410000',
  maroon800: '#500000',
  maroon700: '#83251b',
  maroon600: '#a33d2f',
  surface: '#f9f9f9',
  surfaceDim: '#f3f3f3',
  white: '#ffffff',
  textMuted: 'rgba(80, 0, 0, 0.6)',
};

const INTERESTS = [
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'tech', label: 'Tech', icon: Monitor },
  { id: 'art', label: 'Art', icon: Palette },
  { id: 'volunteering', label: 'Volunteering', icon: Heart },
  { id: 'startups', label: 'Startups', icon: Rocket },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'outdoors', label: 'Outdoors', icon: Trees },
  { id: 'culture', label: 'Culture', icon: Globe },
  { id: 'faith', label: 'Faith', icon: Church },
  { id: 'social', label: 'Social', icon: Users },
  { id: 'wellness', label: 'Wellness', icon: Leaf },
];

const ACADEMICS = [
  { id: 'engineering', label: 'Engineering', icon: GraduationCap },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'liberal-arts', label: 'Liberal Arts', icon: BookOpen },
  { id: 'science', label: 'Science', icon: FlaskConical },
  { id: 'agriculture', label: 'Agriculture', icon: Sprout },
  { id: 'architecture', label: 'Architecture', icon: Compass },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'law', label: 'Law', icon: Scale },
  { id: 'medicine', label: 'Medicine', icon: Stethoscope },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
  { id: 'private', label: 'Prefer not to say', icon: EyeOff },
];

const EVENTS = [
  { id: 'free-food', label: 'Free Food', icon: Pizza },
  { id: 'club-meetings', label: 'Club Meetings', icon: Users },
  { id: 'career-fairs', label: 'Career Fairs', icon: Briefcase },
  { id: 'academic-talks', label: 'Academic Talks', icon: Speech },
  { id: 'social-events', label: 'Social Events', icon: Zap },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'performances', label: 'Performances', icon: Theater },
  { id: 'workshops', label: 'Workshops', icon: Monitor },
  { id: 'networking', label: 'Networking', icon: Users },
  { id: 'volunteer-events', label: 'Volunteer Events', icon: Heart },
  { id: 'traditions', label: 'Campus Traditions', icon: Ticket },
];

const MAJOR_TO_ACADEMIC_ID: Record<MajorOption, string> = {
  Engineering: 'engineering',
  Business: 'business',
  'Liberal Arts': 'liberal-arts',
  Agriculture: 'agriculture',
  Science: 'science',
  Architecture: 'architecture',
  Education: 'education',
  'Public Health': 'medicine',
  Law: 'law',
  Medicine: 'medicine',
};

const ACADEMIC_TO_MAJOR: Partial<Record<string, MajorOption>> = {
  engineering: 'Engineering',
  business: 'Business',
  'liberal-arts': 'Liberal Arts',
  agriculture: 'Agriculture',
  science: 'Science',
  architecture: 'Architecture',
  education: 'Education',
  law: 'Law',
  medicine: 'Medicine',
};

const STORED_CATEGORY_TO_EVENT: Record<StoredCategory, string> = {
  Featured: 'traditions',
  Food: 'free-food',
  Sports: 'sports',
  Social: 'social-events',
  Academic: 'academic-talks',
  Entertainment: 'performances',
};

const EVENT_TO_STORED_CATEGORY: Record<string, StoredCategory[]> = {
  'free-food': ['Food'],
  'club-meetings': ['Social'],
  'career-fairs': ['Academic'],
  'academic-talks': ['Academic'],
  'social-events': ['Social'],
  sports: ['Sports'],
  performances: ['Entertainment'],
  workshops: ['Academic'],
  networking: ['Academic', 'Social'],
  'volunteer-events': ['Social'],
  traditions: ['Entertainment', 'Social'],
};

function getInitialAcademicSelections(isMajorSpecific: boolean, selectedMajor: MajorOption) {
  if (!isMajorSpecific) {
    return [] as string[];
  }
  const mapped = MAJOR_TO_ACADEMIC_ID[selectedMajor];
  return mapped ? [mapped] : [];
}

function getInitialEventSelections(categories: string[]) {
  const mapped = new Set<string>();
  categories.forEach((category) => {
    const eventId = STORED_CATEGORY_TO_EVENT[category as StoredCategory];
    if (eventId) {
      mapped.add(eventId);
    }
  });
  return Array.from(mapped);
}

function buildStoredCategories(eventIds: string[]) {
  const next: StoredCategory[] = [];
  const seen = new Set<StoredCategory>();

  eventIds.forEach((eventId) => {
    (EVENT_TO_STORED_CATEGORY[eventId] || []).forEach((category) => {
      if (!seen.has(category)) {
        seen.add(category);
        next.push(category);
      }
    });
  });

  return next;
}

function getPrimaryMajor(academics: string[]) {
  for (const academic of academics) {
    const major = ACADEMIC_TO_MAJOR[academic];
    if (major) {
      return major;
    }
  }
  return null;
}

export function EventPreferenceOnboardingScreen({ clerkId, onDone }: Props) {
  const preferredEventCategories = useAppShellStore((state) => state.preferredEventCategories);
  const preferredEventInterests = useAppShellStore((state) => state.preferredEventInterests);
  const setPreferredEventCategories = useAppShellStore((state) => state.setPreferredEventCategories);
  const setPreferredEventInterests = useAppShellStore((state) => state.setPreferredEventInterests);
  const setPreferredTime = useAppShellStore((state) => state.setPreferredTime);
  const setPreferredSocialMode = useAppShellStore((state) => state.setPreferredSocialMode);
  const setEventPreferencesCompleted = useAppShellStore((state) => state.setEventPreferencesCompleted);
  const setShowEventPreferencesOnboarding = useAppShellStore((state) => state.setShowEventPreferencesOnboarding);
  const setNotificationPrompted = useAppShellStore((state) => state.setNotificationPrompted);

  const selectedMajor = useEventStore((state) => state.selectedMajor);
  const isMajorSpecific = useEventStore((state) => state.isMajorSpecific);
  const setSelectedMajor = useEventStore((state) => state.setSelectedMajor);
  const setMajorSpecific = useEventStore((state) => state.setMajorSpecific);

  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState({
    interests: preferredEventInterests,
    academics: getInitialAcademicSelections(isMajorSpecific, selectedMajor),
    events: getInitialEventSelections(preferredEventCategories),
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isSavingRef = useRef(false);

  const transitionTo = (nextStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const toggleSelection = (key: keyof typeof selections, id: string, max?: number) => {
    const current = selections[key];
    const exists = current.includes(id);

    if (exists || max == null || current.length < max) {
      Haptics.selectionAsync().catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }

    setSelections((prev) => {
      const current = prev[key];
      const exists = current.includes(id);
      if (exists) {
        return { ...prev, [key]: current.filter((item) => item !== id) };
      }
      if (max == null || current.length < max) {
        return { ...prev, [key]: [...current, id] };
      }
      return prev;
    });
  };

  const handleFinish = async () => {
    if (isSavingRef.current) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    isSavingRef.current = true;
    const storedCategories = buildStoredCategories(selections.events);
    const major = getPrimaryMajor(selections.academics);

    setPreferredEventCategories(storedCategories);
    setPreferredEventInterests(selections.interests);
    setPreferredTime(null);
    setPreferredSocialMode(null);

    if (major) {
      setSelectedMajor(major);
    }
    setMajorSpecific(false);

    setEventPreferencesCompleted(true);
    setShowEventPreferencesOnboarding(false);
    onDone();

    try {
      await updateUserProfile(clerkId, {
        preferred_event_categories: storedCategories,
        preferred_time: '',
        preferred_social_mode: '',
        major: major ?? '',
        event_preferences_completed: true,
      });
    } catch (error) {
      console.warn('Failed to save event preferences', error);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 0:
        return <IntroScreen onNext={() => transitionTo(1)} onSkip={() => transitionTo(4)} />;
      case 1:
        return (
          <SelectionView
            title="What are you into?"
            subtitle="Pick up to 5 interests to curate your MaroonLife experience."
            data={INTERESTS}
            selected={selections.interests}
            onToggle={(id: string) => toggleSelection('interests', id, 5)}
            onNext={() => transitionTo(2)}
            onBack={() => transitionTo(0)}
            max={5}
          />
        );
      case 2:
        return (
          <SelectionView
            title="Academic Interests"
            subtitle="Select up to 3 academic interests."
            data={ACADEMICS}
            selected={selections.academics}
            onToggle={(id: string) => toggleSelection('academics', id, 3)}
            onNext={() => transitionTo(3)}
            onBack={() => transitionTo(1)}
            max={3}
          />
        );
      case 3:
        return (
          <TagSelectionView
            title="What events do you actually want to see?"
            data={EVENTS}
            selected={selections.events}
            onToggle={(id: string) => toggleSelection('events', id)}
            onNext={() => transitionTo(4)}
            onBack={() => transitionTo(2)}
            onSkip={() => transitionTo(4)}
          />
        );
      case 4:
        return (
          <NotificationPromptScreen
            onDone={() => {
              setNotificationPrompted(true);
              transitionTo(5);
            }}
          />
        );
      case 5:
        return <SuccessScreen onEdit={() => transitionTo(1)} onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
        {renderContent()}
      </Animated.View>
    </SafeAreaView>
  );
}

function IntroScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <View style={styles.screenCenter}>
      <View style={styles.iconCircleBig}>
        <GraduationCap size={48} color={COLORS.maroon800} />
      </View>
      <View style={styles.textStack}>
        <Text style={styles.h1}>Welcome to your{'\n'}MaroonLife</Text>
        <Text style={styles.p}>
          Help us personalize your experience by answering a few quick questions about yourself.
        </Text>
      </View>
      <View style={styles.buttonStack}>
        <TouchableOpacity style={styles.btnPrimary} onPress={onNext}>
          <Text style={styles.btnPrimaryText}>Get started</Text>
          <ArrowRight size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={onSkip}>
          <Text style={styles.btnSecondaryText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SelectionView({
  title,
  subtitle,
  data,
  selected,
  onToggle,
  onNext,
  onBack,
  max,
}: {
  title: string;
  subtitle: string;
  data: Array<{ id: string; label: string; icon: React.ComponentType<any> }>;
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  max: number;
}) {
  return (
    <View style={styles.flex1}>
      <Header onBack={onBack} onSkip={onNext} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.h2}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.grid}>
          {data.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onToggle(item.id)}
                activeOpacity={0.8}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                  <item.icon size={24} color={isSelected ? COLORS.white : COLORS.maroon800} />
                </View>
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                  {item.label}
                </Text>
                {isSelected ? <CheckCircle size={16} color={COLORS.white} style={styles.checkIcon} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <Footer count={selected.length} max={max} onNext={onNext} />
    </View>
  );
}

function TagSelectionView({
  title,
  data,
  selected,
  onToggle,
  onNext,
  onBack,
  onSkip,
}: {
  title: string;
  data: Array<{ id: string; label: string; icon: React.ComponentType<any> }>;
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.flex1}>
      <Header onBack={onBack} onSkip={onSkip} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, styles.center]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.h2, styles.textCenter]}>{title}</Text>
        <View style={styles.tagCloud}>
          {data.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onToggle(item.id)}
                style={[styles.tag, isSelected && styles.tagSelected]}
              >
                <item.icon size={18} color={isSelected ? COLORS.white : COLORS.maroon800} />
                <Text style={[styles.tagLabel, isSelected && styles.tagLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.bottomActions}>
        <Text style={styles.tagProgress}>{selected.length} Selected</Text>
        <TouchableOpacity
          style={[styles.btnPrimary, selected.length === 0 && styles.btnDisabled]}
          onPress={onNext}
          disabled={selected.length === 0}
        >
          <Text style={styles.btnPrimaryText}>Continue to Campus</Text>
          <ArrowRight size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SuccessScreen({
  onEdit,
  onFinish,
}: {
  onEdit: () => void;
  onFinish: () => void;
}) {
  const ringAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    Animated.parallel([
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.04,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [iconScale, ringAnim]);

  return (
    <View style={styles.screenCenter}>
      <View style={styles.completionWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.completionRing,
            styles.completionRingInner,
            {
              opacity: ringAnim.interpolate({
                inputRange: [0, 0.12, 1],
                outputRange: [0, 0.18, 0],
              }),
              transform: [
                {
                  scale: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.2],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.completionRing,
            styles.completionRingOuter,
            {
              opacity: ringAnim.interpolate({
                inputRange: [0, 0.08, 1],
                outputRange: [0, 0.12, 0],
              }),
              transform: [
                {
                  scale: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.38],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <View style={[styles.iconCircleBig, styles.iconCircleBigStatic]}>
            <CheckCircle size={56} color={COLORS.maroon800} />
          </View>
        </Animated.View>
      </View>
      <View style={styles.textStack}>
        <Text style={styles.h1}>You're all set.</Text>
        <Text style={styles.p}>Welcome to MaroonLife. We'll tune your feed around your preferences.</Text>
      </View>
      <View style={styles.buttonStack}>
        <TouchableOpacity style={styles.btnPrimary} onPress={onFinish}>
          <Text style={styles.btnPrimaryText}>Start exploring</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit}>
          <Text style={styles.btnGhostText}>EDIT ANSWERS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Header({
  onBack,
  onSkip,
}: {
  onBack?: () => void;
  onSkip?: () => void;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <ChevronLeft size={28} color={COLORS.maroon800} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}
      <View style={styles.headerSpacer} />
      {onSkip ? (
        <TouchableOpacity onPress={onSkip}>
          <Text style={styles.skipBtn}>Skip</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}
    </View>
  );
}

function Footer({
  count,
  max,
  onNext,
}: {
  count: number;
  max: number;
  onNext: () => void;
}) {
  const isDisabled = count === 0;
  return (
    <View style={styles.footer}>
      <Text style={styles.footerProgress}>
        <Text style={styles.bold}>{count}</Text> of {max} selected
      </Text>
      <TouchableOpacity
        style={[styles.btnContinue, isDisabled && styles.btnDisabled]}
        onPress={onNext}
        disabled={isDisabled}
      >
        <Text style={styles.btnContinueText}>Continue</Text>
        <ArrowRight size={18} color={isDisabled ? COLORS.maroon800 : COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  inner: { flex: 1 },
  flex1: { flex: 1 },
  screenCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerBtn: { width: 40 },
  headerSpacer: { flex: 1 },
  skipBtn: { color: COLORS.textMuted, fontWeight: '600' },

  scrollContent: { padding: 24, paddingBottom: 120 },
  h1: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.maroon950,
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 12,
  },
  h2: { fontSize: 32, fontWeight: '800', color: COLORS.maroon950, marginBottom: 8 },
  p: { fontSize: 18, color: COLORS.textMuted, textAlign: 'center', lineHeight: 26 },
  subtitle: { fontSize: 16, color: COLORS.textMuted, marginBottom: 32 },

  iconCircleBig: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: COLORS.maroon800,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircleBigStatic: {
    marginBottom: 0,
  },

  textStack: { gap: 8, marginBottom: 48 },
  buttonStack: { width: '100%', gap: 16, alignItems: 'center' },
  completionWrap: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  completionRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.maroon800,
  },
  completionRingInner: {
    width: 132,
    height: 132,
  },
  completionRingOuter: {
    width: 154,
    height: 154,
  },

  btnPrimary: {
    backgroundColor: COLORS.maroon800,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    shadowColor: COLORS.maroon800,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    gap: 8,
  },
  btnPrimaryText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },

  btnSecondary: {
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.1)',
  },
  btnSecondaryText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '600' },
  btnGhostText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: (width - 48 - 12) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.05)',
  },
  cardSelected: { backgroundColor: COLORS.maroon800, borderColor: COLORS.maroon800 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleSelected: { backgroundColor: 'rgba(255,255,255,0.2)' },
  cardLabel: { fontSize: 14, fontWeight: '600', color: COLORS.maroon950 },
  cardLabelSelected: { color: COLORS.white },
  checkIcon: { position: 'absolute', top: 12, right: 12 },

  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.05)',
  },
  tagSelected: { backgroundColor: COLORS.maroon800, borderColor: COLORS.maroon800 },
  tagLabel: { fontSize: 14, fontWeight: '600', color: COLORS.maroon950 },
  tagLabelSelected: { color: COLORS.white },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(249, 249, 249, 0.95)',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(80,0,0,0.05)',
  },
  footerProgress: { color: COLORS.textMuted, fontSize: 14 },
  bold: { fontWeight: '700', color: COLORS.maroon800 },
  btnContinue: {
    backgroundColor: COLORS.maroon800,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  btnContinueText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  btnDisabled: { backgroundColor: 'rgba(80,0,0,0.05)', shadowOpacity: 0, elevation: 0 },

  bottomActions: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  tagProgress: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(80,0,0,0.2)',
    letterSpacing: 1,
  },
});
