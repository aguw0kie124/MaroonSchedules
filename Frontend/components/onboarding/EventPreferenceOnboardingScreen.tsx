import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronRight, Clock3, GraduationCap, HeartHandshake, Shapes, Sparkles } from 'lucide-react-native';

import { updateUserProfile } from '../../api/client';
import { useTheme } from '../SharedUI';
import { useEventStore, type MajorOption } from '../../store/eventStore';
import {
  useAppShellStore,
  type EventSocialPreference,
  type EventTimePreference,
} from '../../store/appShellStore';

type Props = {
  clerkId: string;
  onDone: () => void;
};

type SocialModeChoice = EventSocialPreference | 'none';
type TimeChoice = EventTimePreference | 'none';
type QuestionId = 'categories' | 'time' | 'major' | 'social';

type Question = {
  id: QuestionId;
  title: string;
  subtitle: string;
  helper: string;
  icon: React.ComponentType<any>;
  multi?: boolean;
  options: Array<{ id: string; label: string; description: string }>;
};

const NO_PREFERENCE_ID = 'none';

const CATEGORY_OPTIONS: Question['options'] = [
  { id: 'Featured', label: 'Featured', description: 'Big campus happenings and standout moments.' },
  { id: 'Food', label: 'Free Food', description: 'Meals, snacks, and surprise food drops.' },
  { id: 'Sports', label: 'Sports', description: 'Games, rec events, and athletic energy.' },
  { id: 'Social', label: 'Social', description: 'Mixers, hangouts, and meeting people.' },
  { id: 'Academic', label: 'Academic', description: 'Workshops, talks, and career-focused events.' },
  { id: 'Entertainment', label: 'Entertainment', description: 'Shows, concerts, and fun nights out.' },
  { id: NO_PREFERENCE_ID, label: 'No preference', description: 'Keep this broad and let the app learn over time.' },
];

const TIME_OPTIONS: Question['options'] = [
  { id: 'Morning', label: 'Morning', description: 'Start me with early-day plans and campus energy.' },
  { id: 'Afternoon', label: 'Afternoon', description: 'Best for finding events between classes.' },
  { id: 'Evening', label: 'Evening', description: 'Bias the feed toward later-day plans.' },
  { id: NO_PREFERENCE_ID, label: 'No preference', description: 'Do not favor any part of the day yet.' },
];

const MAJOR_OPTIONS: Question['options'] = [
  { id: 'Engineering', label: 'Engineering', description: 'Prioritize engineering-relevant events when possible.' },
  { id: 'Business', label: 'Business', description: 'Surface networking and business-focused opportunities.' },
  { id: 'Science', label: 'Science', description: 'Highlight research, lab, and science-centered events.' },
  { id: 'Liberal Arts', label: 'Liberal Arts', description: 'Show culture, humanities, and discussion events.' },
  { id: NO_PREFERENCE_ID, label: 'No preference', description: 'Keep recommendations broad across campus.' },
];

const SOCIAL_OPTIONS: Question['options'] = [
  { id: 'casual', label: 'Casual', description: 'Fun, friends, and low-pressure social plans.' },
  { id: 'professional', label: 'Professional', description: 'Networking, panels, and growth-focused events.' },
  { id: NO_PREFERENCE_ID, label: 'No preference', description: 'Do not lean one way until I explore more.' },
];

const QUESTIONS: Question[] = [
  {
    id: 'categories',
    title: 'What kinds of events should we feature more often?',
    subtitle: 'Pick up to three so your Events feed starts with the kinds of things you are most likely to care about.',
    helper: 'These map directly to the category filters on the Events page.',
    multi: true,
    icon: Shapes,
    options: CATEGORY_OPTIONS,
  },
  {
    id: 'time',
    title: 'When do you usually want to go out?',
    subtitle: 'We use this as a ranking signal so the Events feed puts the right time-of-day plans higher first.',
    helper: 'This shapes your For You ordering without locking you out of anything.',
    icon: Clock3,
    options: TIME_OPTIONS,
  },
  {
    id: 'major',
    title: 'Should we personalize around your major?',
    subtitle: 'This helps us surface more relevant academic and career events when it makes sense for you.',
    helper: 'You can still toggle major-specific recommendations later from Events.',
    icon: GraduationCap,
    options: MAJOR_OPTIONS,
  },
  {
    id: 'social',
    title: 'When a social event appears, what vibe should we lean toward?',
    subtitle: 'We use this to tune how social recommendations feel so the feed is more useful right away.',
    helper: 'This maps to the social mode filter on the Events screen.',
    icon: HeartHandshake,
    options: SOCIAL_OPTIONS,
  },
];

function getInitialCategories(preferredCategories: string[]) {
  return preferredCategories.length > 0 ? preferredCategories : [NO_PREFERENCE_ID];
}

function getInitialTimeChoice(preferredTime: EventTimePreference | null): TimeChoice {
  return preferredTime ?? NO_PREFERENCE_ID;
}

function getInitialMajorChoice(isMajorSpecific: boolean, selectedMajor: MajorOption): MajorOption | 'none' {
  return isMajorSpecific ? selectedMajor : 'none';
}

function getInitialSocialChoice(preferredSocialMode: EventSocialPreference | null): SocialModeChoice {
  return preferredSocialMode ?? NO_PREFERENCE_ID;
}

function PreferenceCelebration({
  visible,
  title,
  body,
}: {
  visible: boolean;
  title: string;
  body: string;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        id: index,
        left: 20 + index * 18,
        color: ['#F9C74F', '#43AA8B', '#F9844A', '#577590', '#F94144'][index % 5],
      })),
    [],
  );

  React.useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.celebrationWrap}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={`${piece.id}-${title}`}
          style={[
            styles.confettiPiece,
            {
              left: piece.left,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.85, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 140 + (index % 3) * 18],
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, ((index % 5) - 2) * 15],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${160 + index * 14}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          styles.celebrationCard,
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.1, 0.85, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [16, 0, -8],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0.92, 1, 0.98],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.celebrationEyebrow}>Nice choice</Text>
        <Text style={styles.celebrationTitle}>{title}</Text>
        <Text style={styles.celebrationBody}>{body}</Text>
      </Animated.View>
    </View>
  );
}

function QuestionOptionCard({
  option,
  selected,
  onPress,
  index,
  isDark,
  colors,
}: {
  option: { id: string; label: string; description: string };
  selected: boolean;
  onPress: () => void;
  index: number;
  isDark: boolean;
  colors: {
    primary: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
  };
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(18)).current;
  const scale = React.useRef(new Animated.Value(0.98)).current;

  React.useEffect(() => {
    const delay = Math.min(index * 70, 280);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [index, opacity, scale, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.optionCard,
          {
            backgroundColor: selected
              ? `${colors.primary}15`
              : isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(255,255,255,0.78)',
            borderColor: selected ? colors.primary : colors.border,
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <View style={styles.optionTextWrap}>
          <View style={styles.optionLabelRow}>
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{option.label}</Text>
            {selected ? (
              <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.selectedBadgeText}>Selected</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
            {option.description}
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : 'transparent',
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

export function EventPreferenceOnboardingScreen({ clerkId, onDone }: Props) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const fade = React.useRef(new Animated.Value(1)).current;
  const preferredEventCategories = useAppShellStore((state) => state.preferredEventCategories);
  const preferredTime = useAppShellStore((state) => state.preferredTime);
  const preferredSocialMode = useAppShellStore((state) => state.preferredSocialMode);
  const setPreferredEventCategories = useAppShellStore((state) => state.setPreferredEventCategories);
  const setPreferredTime = useAppShellStore((state) => state.setPreferredTime);
  const setPreferredSocialMode = useAppShellStore((state) => state.setPreferredSocialMode);
  const selectedMajor = useEventStore((state) => state.selectedMajor);
  const isMajorSpecific = useEventStore((state) => state.isMajorSpecific);
  const setSelectedMajor = useEventStore((state) => state.setSelectedMajor);
  const setMajorSpecific = useEventStore((state) => state.setMajorSpecific);

  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [celebration, setCelebration] = React.useState<{ title: string; body: string } | null>(null);
  const celebrationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [categorySelection, setCategorySelection] = React.useState<string[]>(
    getInitialCategories(preferredEventCategories),
  );
  const [timeSelection, setTimeSelection] = React.useState<TimeChoice>(
    getInitialTimeChoice(preferredTime),
  );
  const [majorSelection, setMajorSelection] = React.useState<MajorOption | 'none'>(
    getInitialMajorChoice(isMajorSpecific, selectedMajor),
  );
  const [socialSelection, setSocialSelection] = React.useState<SocialModeChoice>(
    getInitialSocialChoice(preferredSocialMode),
  );

  const question = QUESTIONS[questionIndex];
  const progress = (questionIndex + 1) / QUESTIONS.length;
  const nextQuestion = QUESTIONS[questionIndex + 1] || null;

  const canContinue =
    (question.id === 'categories' && categorySelection.length > 0) ||
    (question.id === 'time' && !!timeSelection) ||
    (question.id === 'major' && !!majorSelection) ||
    (question.id === 'social' && !!socialSelection);

  const animateToNext = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(callback, 180);
  };

  const normalizedCategorySelection = React.useMemo(
    () => (categorySelection.includes(NO_PREFERENCE_ID) ? [] : categorySelection),
    [categorySelection],
  );
  const normalizedTimeSelection = timeSelection === NO_PREFERENCE_ID ? null : timeSelection;
  const normalizedSocialSelection = socialSelection === NO_PREFERENCE_ID ? null : socialSelection;
  const singleChoiceReady =
    (question.id === 'time' && !!timeSelection) ||
    (question.id === 'major' && !!majorSelection) ||
    (question.id === 'social' && !!socialSelection);

  React.useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const handleSelect = (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (question.id === 'categories') {
      setCategorySelection((current) => {
        if (optionId === NO_PREFERENCE_ID) {
          return [NO_PREFERENCE_ID];
        }
        const withoutNone = current.filter((entry) => entry !== NO_PREFERENCE_ID);
        if (withoutNone.includes(optionId)) {
          const next = withoutNone.filter((entry) => entry !== optionId);
          return next.length > 0 ? next : [NO_PREFERENCE_ID];
        }
        if (withoutNone.length >= 3) {
          return [...withoutNone.slice(1), optionId];
        }
        return [...withoutNone, optionId];
      });
      return;
    }
    if (question.id === 'time') {
      setTimeSelection(optionId as TimeChoice);
      return;
    }
    if (question.id === 'major') {
      setMajorSelection(optionId as MajorOption | 'none');
      return;
    }
    if (question.id === 'social') {
      setSocialSelection(optionId as SocialModeChoice);
    }
  };

  const handleContinue = React.useCallback(async () => {
    if (!canContinue || loading) return;

    if (questionIndex < QUESTIONS.length - 1) {
      const selectedOptionLabel =
        question.id === 'categories'
          ? categorySelection.includes(NO_PREFERENCE_ID)
            ? 'Keeping it broad'
            : `${normalizedCategorySelection.length} interests saved`
          : question.id === 'time'
            ? timeSelection === NO_PREFERENCE_ID
              ? 'Any time works'
              : timeSelection
            : question.id === 'major'
              ? majorSelection === NO_PREFERENCE_ID
                ? 'No major filter'
                : majorSelection
              : socialSelection === NO_PREFERENCE_ID
                ? 'No social filter'
                : socialSelection === 'casual'
                  ? 'Casual vibe'
                  : 'Professional vibe';
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
      setCelebration({
        title: selectedOptionLabel,
        body: 'Perfect. We will use that to make the next screen feel smarter.',
      });
      celebrationTimerRef.current = setTimeout(() => setCelebration(null), 850);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      animateToNext(() => setQuestionIndex((current) => current + 1));
      return;
    }

    setLoading(true);
    try {
      setPreferredEventCategories(normalizedCategorySelection);
      setPreferredTime(normalizedTimeSelection);
      setPreferredSocialMode(normalizedSocialSelection);

      await updateUserProfile(clerkId, {
        preferred_event_categories: normalizedCategorySelection,
        preferred_time: normalizedTimeSelection,
        major: majorSelection === NO_PREFERENCE_ID ? '' : majorSelection,
        preferred_social_mode: normalizedSocialSelection,
        event_preferences_completed: true,
      });

      if (majorSelection !== NO_PREFERENCE_ID) {
        setSelectedMajor(majorSelection);
        setMajorSpecific(true);
      } else {
        setMajorSpecific(false);
      }

      setCelebration({
        title: 'You are all set',
        body: 'Your Events feed now has a much better starting point.',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone();
    } catch (error) {
      console.warn('Failed to save event preferences', error);
    } finally {
      setLoading(false);
    }
  }, [
    canContinue,
    categorySelection,
    loading,
    majorSelection,
    normalizedCategorySelection,
    normalizedSocialSelection,
    normalizedTimeSelection,
    onDone,
    question.id,
    questionIndex,
    setMajorSpecific,
    setPreferredEventCategories,
    setPreferredSocialMode,
    setPreferredTime,
    setSelectedMajor,
    socialSelection,
    timeSelection,
    clerkId,
  ]);

  React.useEffect(() => {
    if (question.id === 'categories' || !singleChoiceReady || loading) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      return;
    }

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }

    autoAdvanceTimerRef.current = setTimeout(() => {
      handleContinue();
    }, 420);

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [handleContinue, loading, question.id, singleChoiceReady]);

  const selectionHint =
    question.id === 'categories'
      ? categorySelection.includes(NO_PREFERENCE_ID)
        ? 'Broad discovery selected'
        : `${normalizedCategorySelection.length}/3 selected`
      : question.id === 'time'
        ? timeSelection === NO_PREFERENCE_ID
          ? 'No time preference'
          : '1 selected'
        : question.id === 'major'
          ? majorSelection === NO_PREFERENCE_ID
            ? 'No major preference'
            : '1 selected'
          : socialSelection === NO_PREFERENCE_ID
            ? 'No social preference'
            : '1 selected';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#12090C', '#1C1115', '#09090B'] : ['#FFF8F2', '#FFF3F0', '#F7F4FF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop, { backgroundColor: `${COLORS.primary}18` }]} />
      <View style={[styles.orb, styles.orbBottom, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.52)' }]} />

      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.eyebrow, { color: COLORS.primary }]}>Personalize Your Feed</Text>
          <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>Let us shape Events around you.</Text>
          <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]}>
            A few quick answers now make your Events screen feel much smarter from the start.
          </Text>
        </View>
        <View style={[styles.sparkleWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)' }]}>
          <Sparkles size={22} color={COLORS.primary} />
        </View>
      </View>

      <View
        style={[
          styles.coachBanner,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)',
          },
        ]}
      >
        <View style={[styles.coachAvatar, { backgroundColor: `${COLORS.primary}16` }]}>
          <Text style={[styles.coachAvatarText, { color: COLORS.primary }]}>M</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.coachLabel, { color: COLORS.textPrimary }]}>Maroon Coach</Text>
          <Text style={[styles.coachMessage, { color: COLORS.textSecondary }]}>
            Answer with your gut. We will tune the Events page around this, and you can always retune it later in Settings.
          </Text>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)' }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: COLORS.primary }]} />
      </View>

      <View style={styles.progressDots}>
        {QUESTIONS.map((item, index) => {
          const active = index === questionIndex;
          const completed = index < questionIndex;
          return (
            <View
              key={item.id}
              style={[
                styles.progressDot,
                {
                  backgroundColor: completed || active ? COLORS.primary : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.12)',
                  width: active ? 28 : 10,
                },
              ]}
            />
          );
        })}
      </View>

      <PreferenceCelebration
        visible={!!celebration}
        title={celebration?.title || ''}
        body={celebration?.body || ''}
      />

      <Animated.View style={[styles.cardShell, { opacity: fade }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']
              : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.80)']
          }
          style={[
            styles.card,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
              shadowColor: isDark ? '#000000' : COLORS.primary,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.questionIconWrap, { backgroundColor: `${COLORS.primary}14` }]}>
              <question.icon size={28} color={COLORS.primary} />
            </View>
            <View style={[styles.stepPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.05)' }]}>
              <Text style={[styles.questionStep, { color: COLORS.textSecondary }]}>
                Question {questionIndex + 1} of {QUESTIONS.length}
              </Text>
            </View>
          </View>

          <Text style={[styles.questionTitle, { color: COLORS.textPrimary }]}>{question.title}</Text>
          <Text style={[styles.questionSubtitle, { color: COLORS.textSecondary }]}>{question.subtitle}</Text>

          <View style={styles.helperRow}>
            <Text style={[styles.selectionHint, { color: COLORS.primary }]}>{selectionHint}</Text>
            <Text style={[styles.helperText, { color: COLORS.textSecondary }]}>{question.helper}</Text>
            {nextQuestion ? (
              <Text style={[styles.nextQuestionHint, { color: COLORS.textSecondary }]}>
                Up next: {nextQuestion.title}
              </Text>
            ) : (
              <Text style={[styles.nextQuestionHint, { color: COLORS.textSecondary }]}>
                Final step. We will save this and tailor Events for you right away.
              </Text>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.optionsWrap} showsVerticalScrollIndicator={false}>
            {question.options.map((option, index) => {
              const selected =
                (question.id === 'categories' && categorySelection.includes(option.id)) ||
                (question.id === 'time' && timeSelection === option.id) ||
                (question.id === 'major' && majorSelection === option.id) ||
                (question.id === 'social' && socialSelection === option.id);

              return (
                <QuestionOptionCard
                  key={option.id}
                  option={option}
                  index={index}
                  selected={selected}
                  onPress={() => handleSelect(option.id)}
                  isDark={isDark}
                  colors={COLORS}
                />
              );
            })}
          </ScrollView>

          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || loading}
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: canContinue ? COLORS.primary : `${COLORS.primary}55`,
                opacity: pressed ? 0.94 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>
                  {questionIndex === QUESTIONS.length - 1
                    ? 'Save preferences'
                    : question.id === 'categories'
                      ? 'Continue'
                      : 'Saving and moving on'}
                </Text>
                <ChevronRight size={18} color="#FFFFFF" strokeWidth={3} />
              </>
            )}
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 72,
    paddingBottom: 32,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -40,
    right: -70,
  },
  orbBottom: {
    width: 300,
    height: 300,
    left: -120,
    bottom: -100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -1,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    maxWidth: 300,
  },
  sparkleWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  coachBanner: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarText: {
    fontSize: 18,
    fontWeight: '900',
  },
  coachLabel: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },
  coachMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  progressDot: {
    height: 10,
    borderRadius: 999,
  },
  celebrationWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 154,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  celebrationCard: {
    minWidth: 220,
    maxWidth: 300,
    borderRadius: 24,
    backgroundColor: 'rgba(20,20,24,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  celebrationEyebrow: {
    color: '#F9C74F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  celebrationTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  celebrationBody: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  confettiPiece: {
    position: 'absolute',
    top: 8,
    width: 8,
    height: 14,
    borderRadius: 3,
  },
  cardShell: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
    padding: 22,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },
  questionIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  questionStep: {
    fontSize: 12,
    fontWeight: '800',
  },
  questionTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
    fontWeight: '600',
  },
  helperRow: {
    gap: 6,
    marginBottom: 14,
  },
  selectionHint: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  nextQuestionHint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  optionsWrap: {
    gap: 12,
    paddingBottom: 12,
  },
  optionCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  selectedBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  continueButton: {
    height: 58,
    borderRadius: 22,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
