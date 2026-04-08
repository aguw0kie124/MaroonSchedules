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
import { Sparkles, ChevronRight, Clock3, GraduationCap, HeartHandshake, Shapes } from 'lucide-react-native';

import { updateUserProfile } from '../../api/client';
import { useTheme } from '../SharedUI';
import { useEventStore, type MajorOption } from '../../store/eventStore';

type Props = {
  clerkId: string;
  onDone: () => void;
};

type SocialMode = 'casual' | 'professional';
type QuestionId = 'categories' | 'time' | 'major' | 'social';

type Question = {
  id: QuestionId;
  title: string;
  subtitle: string;
  multi?: boolean;
  icon: React.ComponentType<any>;
  options: Array<{ id: string; label: string; description: string }>;
};

const CATEGORY_OPTIONS = [
  { id: 'Featured', label: 'Featured', description: 'Big campus happenings and standout events.' },
  { id: 'Food', label: 'Free Food', description: 'Meals, snacks, popups, and food drops.' },
  { id: 'Sports', label: 'Sports', description: 'Games, rec events, and athletic energy.' },
  { id: 'Social', label: 'Social', description: 'Mixers, hangouts, and meeting people.' },
  { id: 'Academic', label: 'Academic', description: 'Talks, workshops, and career growth.' },
  { id: 'Entertainment', label: 'Entertainment', description: 'Shows, concerts, and fun nights.' },
];

const TIME_OPTIONS = [
  { id: 'Morning', label: 'Morning', description: 'Show me the early-day campus energy.' },
  { id: 'Afternoon', label: 'Afternoon', description: 'Best for events between classes.' },
  { id: 'Evening', label: 'Evening', description: 'I usually go out later in the day.' },
  { id: 'Anytime', label: 'Anytime', description: 'I am open to whatever looks good.' },
];

const MAJOR_OPTIONS: Array<{ id: MajorOption | 'none'; label: string; description: string }> = [
  { id: 'Engineering', label: 'Engineering', description: 'Prioritize events relevant to engineering.' },
  { id: 'Business', label: 'Business', description: 'Surface networking and business-oriented events.' },
  { id: 'Science', label: 'Science', description: 'Highlight research and science-oriented events.' },
  { id: 'Liberal Arts', label: 'Liberal Arts', description: 'Show humanities, culture, and discussion events.' },
  { id: 'none', label: 'No Preference', description: 'Keep recommendations broad across campus.' },
];

const SOCIAL_OPTIONS: Array<{ id: SocialMode; label: string; description: string }> = [
  { id: 'casual', label: 'Casual', description: 'Friends, fun, and low-pressure campus plans.' },
  { id: 'professional', label: 'Professional', description: 'Networking, panels, and growth opportunities.' },
];

const QUESTIONS: Question[] = [
  {
    id: 'categories',
    title: 'What kinds of events do you want more of?',
    subtitle: 'Pick up to three so we can shape your Events feed around what actually matters to you.',
    multi: true,
    icon: Shapes,
    options: CATEGORY_OPTIONS,
  },
  {
    id: 'time',
    title: 'When do you usually want to go out?',
    subtitle: 'We will use this to bias which campus plans bubble up first.',
    icon: Clock3,
    options: TIME_OPTIONS,
  },
  {
    id: 'major',
    title: 'Should we personalize around your major?',
    subtitle: 'This helps us tighten the academic side of the Events page when it makes sense.',
    icon: GraduationCap,
    options: MAJOR_OPTIONS,
  },
  {
    id: 'social',
    title: 'What kind of social vibe fits you best?',
    subtitle: 'We will use this when social events need a little more context.',
    icon: HeartHandshake,
    options: SOCIAL_OPTIONS,
  },
];

export function EventPreferenceOnboardingScreen({ clerkId, onDone }: Props) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const fade = React.useRef(new Animated.Value(1)).current;
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [categorySelection, setCategorySelection] = React.useState<string[]>([]);
  const [preferredTime, setPreferredTime] = React.useState<string | null>(null);
  const [majorSelection, setMajorSelection] = React.useState<MajorOption | 'none' | null>(null);
  const [socialSelection, setSocialSelection] = React.useState<SocialMode | null>(null);
  const setSelectedMajor = useEventStore((state) => state.setSelectedMajor);
  const setMajorSpecific = useEventStore((state) => state.setMajorSpecific);

  const question = QUESTIONS[questionIndex];
  const progress = (questionIndex + 1) / QUESTIONS.length;

  const canContinue =
    (question.id === 'categories' && categorySelection.length > 0) ||
    (question.id === 'time' && !!preferredTime) ||
    (question.id === 'major' && !!majorSelection) ||
    (question.id === 'social' && !!socialSelection);

  const handleSelect = (optionId: string) => {
    if (question.id === 'categories') {
      setCategorySelection((current) => {
        if (current.includes(optionId)) {
          return current.filter((entry) => entry !== optionId);
        }
        if (current.length >= 3) {
          return [...current.slice(1), optionId];
        }
        return [...current, optionId];
      });
      return;
    }
    if (question.id === 'time') {
      setPreferredTime(optionId);
      return;
    }
    if (question.id === 'major') {
      setMajorSelection(optionId as MajorOption | 'none');
      return;
    }
    if (question.id === 'social') {
      setSocialSelection(optionId as SocialMode);
    }
  };

  const animateToNext = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(callback, 180);
  };

  const handleContinue = async () => {
    if (!canContinue || loading) return;

    if (questionIndex < QUESTIONS.length - 1) {
      animateToNext(() => setQuestionIndex((current) => current + 1));
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile(clerkId, {
        preferred_event_categories: categorySelection,
        preferred_time: preferredTime,
        major: majorSelection === 'none' ? '' : majorSelection,
        preferred_social_mode: socialSelection,
        event_preferences_completed: true,
      });

      if (majorSelection && majorSelection !== 'none') {
        setSelectedMajor(majorSelection);
        setMajorSpecific(true);
      } else {
        setMajorSpecific(false);
      }

      onDone();
    } catch (error) {
      console.warn('Failed to save event preferences', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCountLabel =
    question.id === 'categories'
      ? `${categorySelection.length}/3 selected`
      : question.id === 'time' && preferredTime
        ? '1 selected'
        : question.id === 'major' && majorSelection
          ? '1 selected'
          : question.id === 'social' && socialSelection
            ? '1 selected'
            : 'Choose an option';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#12090C', '#1C1115', '#09090B'] : ['#FFF7F3', '#FFF1F1', '#F7F4FF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop, { backgroundColor: `${COLORS.primary}20` }]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: COLORS.primary }]}>Tune Your Feed</Text>
          <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>Let’s shape your Events page.</Text>
        </View>
        <View style={styles.sparkleWrap}>
          <Sparkles size={22} color={COLORS.primary} />
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)' }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: COLORS.primary }]} />
      </View>

      <Animated.View style={[styles.cardShell, { opacity: fade }]}>
        <LinearGradient
          colors={isDark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'] : ['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.74)']}
          style={[styles.card, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)' }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.questionIconWrap, { backgroundColor: `${COLORS.primary}14` }]}>
              <question.icon size={28} color={COLORS.primary} />
            </View>
            <Text style={[styles.questionStep, { color: COLORS.textSecondary }]}>Question {questionIndex + 1} of {QUESTIONS.length}</Text>
          </View>

          <Text style={[styles.questionTitle, { color: COLORS.textPrimary }]}>{question.title}</Text>
          <Text style={[styles.questionSubtitle, { color: COLORS.textSecondary }]}>{question.subtitle}</Text>

          <Text style={[styles.selectionHint, { color: COLORS.primary }]}>{selectedCountLabel}</Text>

          <ScrollView contentContainerStyle={styles.optionsWrap} showsVerticalScrollIndicator={false}>
            {question.options.map((option) => {
              const selected =
                (question.id === 'categories' && categorySelection.includes(option.id)) ||
                (question.id === 'time' && preferredTime === option.id) ||
                (question.id === 'major' && majorSelection === option.id) ||
                (question.id === 'social' && socialSelection === option.id);

              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelect(option.id)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: selected ? `${COLORS.primary}14` : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, { color: COLORS.textPrimary }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: COLORS.textSecondary }]}>{option.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.primary : 'transparent',
                      },
                    ]}
                  />
                </Pressable>
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
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>{questionIndex === QUESTIONS.length - 1 ? 'Save Preferences' : 'Continue'}</Text>
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
    width: 280,
    height: 280,
    left: -120,
    bottom: -100,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -1,
    maxWidth: 280,
  },
  sparkleWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  cardShell: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  questionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionStep: {
    fontSize: 12,
    fontWeight: '800',
  },
  questionTitle: {
    fontSize: 28,
    lineHeight: 32,
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
  selectionHint: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  optionsWrap: {
    gap: 12,
    paddingBottom: 12,
  },
  optionCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
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
    borderRadius: 20,
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
