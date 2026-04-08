import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';

import { completeTour } from '../../api/client';
import { navigationRef } from '../../navigation/Refs';
import { useAppShellStore } from '../../store/appShellStore';
import { useTheme } from '../SharedUI';

type TargetRect = { x: number; y: number; w: number; h: number };
type CoachPosition = 'top' | 'bottom';
type CelebrationState = {
  title: string;
  body: string;
};
type CompletionCelebrationState = {
  title: string;
  body: string;
};
type BlockedHintState = {
  key: number;
  message: string;
};

type TourStep = {
  id: string;
  title: string;
  instruction: string;
  where: string;
  cue: string;
  celebrationTitle: string;
  celebrationBody: string;
  position?: CoachPosition;
};

type TourContextType = {
  startTour: () => void;
  endTour: (options?: { navigateToDashboard?: boolean }) => void;
  isTourActive: boolean;
  currentStep: number;
  registerTarget: (name: string, measureFn: () => Promise<TargetRect | null>) => void;
  registerAssistAction: (name: string, assistFn?: (() => void | Promise<void>) | null) => void;
  advanceStep: (expectedStepName: string) => void;
  activeTargetName: string | null;
};

const TourContext = createContext<TourContextType>({
  startTour: () => {},
  endTour: () => {},
  isTourActive: false,
  currentStep: 0,
  registerTarget: () => {},
  registerAssistAction: () => {},
  advanceStep: () => {},
  activeTargetName: null,
});

export const useTour = () => useContext(TourContext);

export const TOUR_SEQUENCE: TourStep[] = [
  {
    id: 'switch-to-list',
    title: 'Open the full event list',
    instruction: "Tap the 'List' tab so you can see all upcoming events in one scrollable feed.",
    where: 'Look near the top of the Events screen where the Discover, List, and other view tabs appear.',
    cue: 'Tap the tab labeled List.',
    celebrationTitle: 'Yay! You found the event feed.',
    celebrationBody: 'Now we can pick a real event together.',
  },
  {
    id: 'first-event-card',
    title: 'Choose your first event',
    instruction: 'Tap the first event card in the list to open its details.',
    where: 'Use the highlighted event card in the main content area.',
    cue: 'Tap anywhere on that event card.',
    celebrationTitle: 'Nice pick.',
    celebrationBody: 'You just opened an event detail sheet.',
  },
  {
    id: 'event-rsvp',
    title: 'Add it to your schedule',
    instruction: "Tap the big Add or RSVP button inside the event details so this event gets saved to your plans.",
    where: 'Look at the bottom area of the event detail sheet for the main action button.',
    cue: 'Tap the large highlighted save button.',
    celebrationTitle: 'Yay! Event saved.',
    celebrationBody: 'That event is now tied into your schedule flow.',
  },
  {
    id: 'places-tab',
    title: 'Jump to Places',
    instruction: "Tap the 'Places' tab in the bottom navigation so we can show you where campus tools live.",
    where: 'Look along the bottom tab bar and find the Places tab with the map icon.',
    cue: 'Tap Places in the bottom navigation.',
    celebrationTitle: 'Perfect.',
    celebrationBody: 'Now you are inside the campus map experience.',
    position: 'top',
  },
  {
    id: 'places-settings',
    title: 'Open map layer controls',
    instruction: "Tap the 'Edit' pill to customize what appears on the Places map.",
    where: 'The Edit control sits in the horizontal pill row near the top of the Places screen.',
    cue: 'Tap the highlighted Edit pill.',
    celebrationTitle: 'Nice.',
    celebrationBody: 'The map customization panel is open.',
  },
  {
    id: 'add-gyms-toggle',
    title: 'Turn on recreation spots',
    instruction: "Find the row labeled 'Rec' and switch it on so gym locations appear on the map.",
    where: 'Inside the open layer settings sheet, look for the Rec row and its toggle on the right.',
    cue: 'Flip the toggle on the highlighted Rec row.',
    celebrationTitle: 'Awesome.',
    celebrationBody: 'Gym locations are now enabled.',
  },
  {
    id: 'add-gyms-close',
    title: 'Return to the map',
    instruction: 'Close the layer settings sheet so you can see the updated map view.',
    where: 'Use the X button in the top-right corner of the open settings sheet.',
    cue: 'Tap the highlighted X button.',
    celebrationTitle: 'Clean.',
    celebrationBody: 'Back to the map with your new layer active.',
  },
  {
    id: 'gyms-pill',
    title: 'Filter to gyms only',
    instruction: "Tap the highlighted 'Gyms' pill (Rec) once so the map focuses on recreation locations.",
    where: 'Look across the pill row on the Places screen for the recreation filter.',
    cue: "Tap the highlighted Gyms (Rec) pill once.",
    celebrationTitle: 'There it is.',
    celebrationBody: 'You are now filtered into recreation spots.',
  },
  {
    id: 'rec-center-item',
    title: 'Open a recreation center',
    instruction: 'Tap the highlighted recreation center from the list so you can inspect live activity details.',
    where: 'Use the highlighted place item in the visible list or sheet.',
    cue: 'Tap the highlighted recreation center entry.',
    celebrationTitle: 'Great job.',
    celebrationBody: 'You just opened a live place detail view.',
  },
  {
    id: 'social-tab',
    title: 'Head to CrowdPings',
    instruction: "Tap the 'Pings' tab in the bottom navigation to see what other students are sharing right now.",
    where: 'Look in the bottom tab bar for the Pings tab.',
    cue: 'Tap Pings in the bottom navigation.',
    celebrationTitle: 'Nice move.',
    celebrationBody: 'Welcome to the live campus pulse.',
    position: 'top',
  },
  {
    id: 'crowdping-cta',
    title: 'Open the quick post composer',
    instruction: "Tap the quick post bar that says 'What's happening at...' to start creating a ping.",
    where: 'It sits near the top of the CrowdPings screen just below the main heading.',
    cue: 'Tap the highlighted quick post bar.',
    celebrationTitle: 'Yay! Composer opened.',
    celebrationBody: 'That is how you start posting to the community.',
  },
  {
    id: 'crowdping-close',
    title: 'Close the composer',
    instruction: 'Tap the X so you can leave the composer and continue exploring the app.',
    where: 'Use the X button in the top-right corner of the create-a-ping sheet.',
    cue: 'Tap the highlighted X button.',
    celebrationTitle: 'Perfect.',
    celebrationBody: 'You now know how to open and dismiss a ping composer.',
  },
  {
    id: 'settings-tab',
    title: 'Finish in Settings',
    instruction: "Tap the 'Settings' tab in the bottom navigation to finish onboarding.",
    where: 'Look along the bottom tab bar for the Settings tab.',
    cue: 'Tap Settings in the bottom navigation.',
    celebrationTitle: 'Almost there.',
    celebrationBody: 'One last tap and the app is fully yours.',
    position: 'top',
  },
  {
    id: 'tour-finish',
    title: 'Launch your app',
    instruction: "Tap 'Launch MaroonLife' to complete the guided setup and start exploring on your own.",
    where: 'The launch button appears in the highlighted completion card on the Settings screen.',
    cue: 'Tap the highlighted Launch MaroonLife button.',
    celebrationTitle: 'You did it.',
    celebrationBody: 'Your onboarding tour is complete.',
  },
];

const FREE_INTERACTION_STEPS = new Set([
  'add-gyms-toggle',
  'gyms-pill',
  'rec-center-item',
  'crowdping-cta',
  'crowdping-close',
  'tour-finish',
]);

const COMPACT_COACH_STEPS = new Set([
  'places-settings',
  'add-gyms-toggle',
  'add-gyms-close',
  'gyms-pill',
  'rec-center-item',
  'crowdping-cta',
  'crowdping-close',
  'tour-finish',
]);

function getTargetRegion(rect: TargetRect, width: number, height: number) {
  const horizontal = rect.x + rect.w / 2 < width / 3
    ? 'left side'
    : rect.x + rect.w / 2 > (width * 2) / 3
      ? 'right side'
      : 'center';
  const vertical = rect.y + rect.h / 2 < height / 3
    ? 'upper'
    : rect.y + rect.h / 2 > (height * 2) / 3
      ? 'lower'
      : 'middle';

  if (horizontal === 'center') {
    return `${vertical} part of the screen`;
  }
  return `${vertical} ${horizontal}`;
}

function CelebrationBurst({
  visible,
  title,
  body,
  width,
}: {
  visible: boolean;
  title: string;
  body: string;
  width: number;
}) {
  const progress = React.useRef(new RNAnimated.Value(0)).current;
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: Math.max(10, (width / 18) * index + ((index % 3) - 1) * 8),
        rotate: `${-28 + (index % 7) * 9}deg`,
        color: ['#F94144', '#F9C74F', '#43AA8B', '#577590', '#F9844A', '#9B5DE5'][index % 6],
        size: 8 + (index % 4) * 3,
      })),
    [width],
  );

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    const animation = RNAnimated.timing(progress, {
      toValue: 1,
      duration: 950,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  return (
    <View pointerEvents="none" style={styles.celebrationWrapper}>
      {visible ? (
        <>
          {pieces.map((piece) => (
            <RNAnimated.View
              key={`${piece.id}-${title}`}
              style={[
                styles.confettiPiece,
                {
                  left: piece.left,
                  width: piece.size,
                  height: piece.size * 1.5,
                  backgroundColor: piece.color,
                  opacity: progress.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-18, 210 + (piece.id % 4) * 26],
                      }),
                    },
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, ((piece.id % 5) - 2) * 18],
                      }),
                    },
                    {
                      rotate: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [piece.rotate, `${parseInt(piece.rotate, 10) + 180}deg`],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(220)}
            style={styles.celebrationCard}
          >
            <Text style={styles.celebrationEyebrow}>Nice work</Text>
            <Text style={styles.celebrationTitle}>{title}</Text>
            <Text style={styles.celebrationBody}>{body}</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

function CompletionConfetti({
  visible,
  width,
}: {
  visible: boolean;
  width: number;
}) {
  const progress = React.useRef(new RNAnimated.Value(0)).current;
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => ({
        id: index,
        left: Math.max(10, (width / 26) * index + ((index % 4) - 1.5) * 10),
        rotate: `${-24 + (index % 8) * 7}deg`,
        color: ['#F94144', '#F9C74F', '#43AA8B', '#577590', '#F9844A', '#90BE6D'][index % 6],
        size: 8 + (index % 4) * 3,
      })),
    [width],
  );

  React.useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    const animation = RNAnimated.timing(progress, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.completionConfettiLayer}>
      {pieces.map((piece, index) => (
        <RNAnimated.View
          key={`completion-confetti-${piece.id}`}
          style={[
            styles.completionConfettiPiece,
            {
              left: piece.left,
              width: piece.size,
              height: piece.size * 1.8,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.78, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50 - (index % 5) * 16, 460 + (index % 3) * 40],
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, ((index % 6) - 3) * 16],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${180 + index * 12}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const isTOSAccepted = useAppShellStore((state) => state.isTOSAccepted);
  const isNotificationPrompted = useAppShellStore((state) => state.isNotificationPrompted);
  const isEventPreferencesCompleted = useAppShellStore((state) => state.isEventPreferencesCompleted);
  const showEventPreferencesOnboarding = useAppShellStore((state) => state.showEventPreferencesOnboarding);
  const isTourCompleted = useAppShellStore((state) => state.isTourCompleted);
  const setTourCompleted = useAppShellStore((state) => state.setTourCompleted);
  const { width, height } = useWindowDimensions();

  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [assistVisible, setAssistVisible] = useState(false);
  const [isAssisting, setIsAssisting] = useState(false);
  const [blockedHint, setBlockedHint] = useState<BlockedHintState | null>(null);
  const [completionCelebration, setCompletionCelebration] = useState<CompletionCelebrationState | null>(null);
  const [tourStartSource, setTourStartSource] = useState<'auto' | 'manual' | null>(null);

  const targetsRef = useRef<Record<string, () => Promise<TargetRect | null>>>({});
  const assistActionsRef = useRef<Record<string, (() => void | Promise<void>) | null>>({});
  const primaryEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  const shouldSkipTourForEmail = primaryEmail.endsWith('@gmail.com');
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistPointerProgress = useRef(new RNAnimated.Value(0)).current;
  const blockedTapCountRef = useRef(0);

  const activeTargetName = isTourActive && currentStep < TOUR_SEQUENCE.length ? TOUR_SEQUENCE[currentStep].id : null;
  const currentDef = isTourActive && currentStep < TOUR_SEQUENCE.length ? TOUR_SEQUENCE[currentStep] : null;

  const updateTargetRect = useCallback(async () => {
    if (!activeTargetName || !targetsRef.current[activeTargetName]) {
      setTargetRect(null);
      return;
    }

    const rect = await targetsRef.current[activeTargetName]();
    if (rect) {
      setTargetRect(rect);
    }
  }, [activeTargetName]);

  useEffect(() => {
    if (!isTourActive || !activeTargetName) {
      return undefined;
    }

    updateTargetRect();
    const interval = setInterval(() => {
      updateTargetRect();
    }, 350);

    return () => clearInterval(interval);
  }, [activeTargetName, isTourActive, updateTargetRect]);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      if (assistTimerRef.current) clearTimeout(assistTimerRef.current);
      if (blockedHintTimerRef.current) clearTimeout(blockedHintTimerRef.current);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (assistTimerRef.current) {
      clearTimeout(assistTimerRef.current);
    }

    setAssistVisible(false);
    setIsAssisting(false);
    setBlockedHint(null);
    blockedTapCountRef.current = 0;
    assistPointerProgress.stopAnimation();
    assistPointerProgress.setValue(0);

    if (!isTourActive || !currentDef) {
      return undefined;
    }

    assistTimerRef.current = setTimeout(() => {
      setAssistVisible(true);
    }, 4000);

    return () => {
      if (assistTimerRef.current) clearTimeout(assistTimerRef.current);
    };
  }, [assistPointerProgress, currentStep, currentDef, isTourActive]);

  const triggerCelebration = useCallback((step: TourStep) => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);

    setCelebration({
      title: step.celebrationTitle,
      body: step.celebrationBody,
    });

    celebrationTimerRef.current = setTimeout(() => {
      setCelebration(null);
    }, 1700);
  }, []);

  const beginTour = useCallback((source: 'auto' | 'manual') => {
    setCurrentStep(0);
    setTargetRect(null);
    setCelebration(null);
    setAssistVisible(false);
    setIsAssisting(false);
    setBlockedHint(null);
    setCompletionCelebration(null);
    blockedTapCountRef.current = 0;
    setTourStartSource(source);
    setIsTourActive(true);

    setTimeout(() => {
      if (navigationRef.isReady()) {
        try {
          (navigationRef as any).navigate('Main', { screen: 'Dashboard' });
        } catch (error) {
          console.warn("TourProvider couldn't navigate to Dashboard", error);
        }
      }
    }, 300);
  }, []);

  const startTour = useCallback(() => {
    beginTour('manual');
  }, [beginTour]);

  const endTour = useCallback(async (options?: { navigateToDashboard?: boolean }) => {
    setIsTourActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setCelebration(null);
    setAssistVisible(false);
    setIsAssisting(false);
    setBlockedHint(null);
    setCompletionCelebration(null);
    setTourStartSource(null);
    blockedTapCountRef.current = 0;

    if (userId) {
      setTourCompleted(true);
      completeTour(userId).catch((error) => console.warn('Failed to persist tour completion:', error));
    }

    if (options?.navigateToDashboard) {
      setTimeout(() => {
        if (navigationRef.isReady()) {
          try {
            (navigationRef as any).navigate('Main', { screen: 'Dashboard' });
          } catch (error) {
            console.warn("TourProvider couldn't navigate to Dashboard after completion", error);
          }
        }
      }, 180);
    }
  }, [setTourCompleted, userId]);

  useEffect(() => {
    if (isSignedIn && shouldSkipTourForEmail && tourStartSource !== 'manual') {
      if (isTourActive) {
        setIsTourActive(false);
        setCurrentStep(0);
        setTargetRect(null);
        setCelebration(null);
        setAssistVisible(false);
        setIsAssisting(false);
        setBlockedHint(null);
        setCompletionCelebration(null);
        setTourStartSource(null);
        blockedTapCountRef.current = 0;
      }
      if (!isTourCompleted) {
        setTourCompleted(true);
      }
    }
  }, [isSignedIn, isTourActive, isTourCompleted, setTourCompleted, shouldSkipTourForEmail, tourStartSource]);

  useEffect(() => {
    if (
      isSignedIn &&
      userId &&
      isTOSAccepted &&
      isNotificationPrompted &&
      isEventPreferencesCompleted &&
      !showEventPreferencesOnboarding &&
      !isTourCompleted &&
      !shouldSkipTourForEmail
    ) {
      beginTour('auto');
    }
  }, [
    beginTour,
    isEventPreferencesCompleted,
    isNotificationPrompted,
    isSignedIn,
    isTOSAccepted,
    isTourCompleted,
    shouldSkipTourForEmail,
    showEventPreferencesOnboarding,
    userId,
  ]);

  const registerTarget = useCallback((name: string, measureFn: () => Promise<TargetRect | null>) => {
    targetsRef.current[name] = measureFn;
  }, []);

  const registerAssistAction = useCallback((name: string, assistFn?: (() => void | Promise<void>) | null) => {
    if (assistFn) {
      assistActionsRef.current[name] = assistFn;
      return;
    }
    delete assistActionsRef.current[name];
  }, []);

  const advanceStep = useCallback((expectedStepName: string) => {
    if (!isTourActive || activeTargetName !== expectedStepName) {
      return;
    }

    const completedStep = TOUR_SEQUENCE[currentStep];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    triggerCelebration(completedStep);

    if (currentStep < TOUR_SEQUENCE.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setTargetRect(null);
      return;
    }

    setCompletionCelebration({
      title: 'Congrats! You are all set.',
      body: 'Your MaroonLife tour is complete. Your campus app is ready to explore.',
    });
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(() => {
      endTour({ navigateToDashboard: true });
    }, 2800);
  }, [activeTargetName, currentStep, endTour, isTourActive, triggerCelebration]);

  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0.16);
  const nudgeY = useSharedValue(0);
  const coachCardLift = useSharedValue(0);
  const coachCardScale = useSharedValue(1);
  const coachGlowOpacity = useSharedValue(0.18);

  useEffect(() => {
    if (isTourActive && targetRect) {
      haloScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 650 }),
          withTiming(1, { duration: 650 }),
        ),
        -1,
        false,
      );
      haloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 650 }),
          withTiming(0.12, { duration: 650 }),
        ),
        -1,
        false,
      );
      nudgeY.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 520 }),
          withTiming(0, { duration: 520 }),
        ),
        -1,
        false,
      );
      return;
    }

    haloScale.value = 1;
    haloOpacity.value = 0.16;
    nudgeY.value = 0;
  }, [haloOpacity, haloScale, isTourActive, nudgeY, targetRect]);

  useEffect(() => {
    if (isTourActive && currentDef) {
      coachCardScale.value = withSequence(
        withTiming(0.985, { duration: 120 }),
        withTiming(1, { duration: 240 }),
      );
      coachCardLift.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 1600 }),
          withTiming(0, { duration: 1600 }),
        ),
        -1,
        true,
      );
      coachGlowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.28, { duration: 1300 }),
          withTiming(0.16, { duration: 1300 }),
        ),
        -1,
        true,
      );
      return;
    }

    coachCardScale.value = 1;
    coachCardLift.value = 0;
    coachGlowOpacity.value = 0.18;
  }, [coachCardLift, coachCardScale, coachGlowOpacity, currentDef, isTourActive]);

  const pulseStyle = useAnimatedStyle(() => {
    if (!targetRect) return { opacity: 0 };

    const centerX = targetRect.x + targetRect.w / 2;
    const centerY = targetRect.y + targetRect.h / 2;
    const ringSize = Math.max(targetRect.w, targetRect.h) + 28;

    return {
      position: 'absolute',
      left: centerX - ringSize / 2,
      top: centerY - ringSize / 2,
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      opacity: haloOpacity.value,
      transform: [{ scale: haloScale.value }],
    };
  });

  const targetTagStyle = useAnimatedStyle(() => {
    if (!targetRect) return { opacity: 0 };

    const boxWidth = Math.min(width - 40, 180);
    const left = Math.max(16, Math.min(targetRect.x + targetRect.w / 2 - boxWidth / 2, width - boxWidth - 16));
    const top = targetRect.y > height * 0.42 ? targetRect.y - 44 : targetRect.y + targetRect.h + 10;

    return {
      position: 'absolute',
      left,
      top,
      width: boxWidth,
      opacity: 1,
      transform: [{ translateY: nudgeY.value }],
    };
  });

  const coachCardStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: coachCardLift.value }, { scale: coachCardScale.value }],
    }) as any,
  );

  const coachGlowStyle = useAnimatedStyle(() => ({
    opacity: coachGlowOpacity.value,
  }));

  const stepLabel = currentDef ? `Step ${currentStep + 1} of ${TOUR_SEQUENCE.length}` : '';
  const regionHint = targetRect && currentDef ? `Highlighted in the ${getTargetRegion(targetRect, width, height)}.` : '';
  const allowFreeInteraction = currentDef ? FREE_INTERACTION_STEPS.has(currentDef.id) : false;
  const isCompactCoachStep = currentDef ? COMPACT_COACH_STEPS.has(currentDef.id) : false;

  const showBlockedHint = useCallback((message?: string) => {
    if (!currentDef) return;

    blockedTapCountRef.current += 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (blockedHintTimerRef.current) clearTimeout(blockedHintTimerRef.current);

    setBlockedHint({
      key: Date.now(),
      message: message || `Only the highlighted step is active right now. ${currentDef.cue}`,
    });

    blockedHintTimerRef.current = setTimeout(() => {
      setBlockedHint(null);
    }, 1800);

    if (blockedTapCountRef.current >= 2) {
      setAssistVisible(true);
    }
  }, [currentDef]);

  const runAssist = useCallback(async () => {
    if (!currentDef || isAssisting) return;

    blockedTapCountRef.current = 0;
    setAssistVisible(false);
    setIsAssisting(true);
    setBlockedHint(null);
    await updateTargetRect();
    assistPointerProgress.setValue(0);

    await new Promise<void>((resolve) => {
      RNAnimated.timing(assistPointerProgress, {
        toValue: 1,
        duration: 1250,
        easing: RNEasing.inOut(RNEasing.cubic),
        useNativeDriver: true,
      }).start(() => resolve());
    });

    const assistAction = assistActionsRef.current[currentDef.id];
    if (assistAction) {
      await Promise.resolve(assistAction());
    } else {
      advanceStep(currentDef.id);
    }

    setIsAssisting(false);
  }, [advanceStep, assistPointerProgress, currentDef, isAssisting, updateTargetRect]);

  const overlayTargetRect = targetRect
    ? {
        left: Math.max(0, targetRect.x - 12),
        top: Math.max(0, targetRect.y - 12),
        width: Math.min(width, targetRect.w + 24),
        height: Math.min(height, targetRect.h + 24),
      }
    : null;

  const assistPointerStyle: any = React.useMemo(() => {
    if (!targetRect) return { opacity: 0 };
    const endX = targetRect.x + targetRect.w / 2 - 18;
    const endY = targetRect.y + targetRect.h / 2 - 18;
    const startX = Math.max(20, endX - 84);
    const startY = Math.max(20, endY - 84);
    return {
      opacity: isAssisting ? 1 : 0,
      transform: [
        { translateX: assistPointerProgress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] }) },
        { translateY: assistPointerProgress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] }) },
        { scale: assistPointerProgress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.9, 1, 0.92] }) },
      ],
    };
  }, [assistPointerProgress, isAssisting, targetRect]);

  const assistRippleStyle: any = React.useMemo(() => {
    if (!targetRect) return { opacity: 0 };
    const centerX = targetRect.x + targetRect.w / 2 - 26;
    const centerY = targetRect.y + targetRect.h / 2 - 26;
    return {
      opacity: isAssisting ? 1 : 0,
      transform: [
        { translateX: centerX },
        { translateY: centerY },
        { scale: assistPointerProgress.interpolate({ inputRange: [0, 0.72, 0.9, 1], outputRange: [0.25, 0.25, 1.2, 1.45] }) },
      ],
    };
  }, [assistPointerProgress, isAssisting, targetRect]);

  const value = React.useMemo(
    () => ({
      startTour,
      endTour,
      isTourActive,
      currentStep,
      registerTarget,
      registerAssistAction,
      advanceStep,
      activeTargetName,
    }),
    [activeTargetName, advanceStep, currentStep, endTour, isTourActive, registerAssistAction, registerTarget, startTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}

      {isTourActive && currentDef ? (
        <View style={styles.overlayWrapper} pointerEvents="box-none">
          {!allowFreeInteraction && overlayTargetRect ? (
            <>
              <Pressable
                style={[styles.blocker, { left: 0, top: 0, width, height: overlayTargetRect.top }]}
                onPress={() => showBlockedHint()}
              />
              <Pressable
                style={[
                  styles.blocker,
                  {
                    left: 0,
                    top: overlayTargetRect.top + overlayTargetRect.height,
                    width,
                    height: Math.max(0, height - (overlayTargetRect.top + overlayTargetRect.height)),
                  },
                ]}
                onPress={() => showBlockedHint()}
              />
              <Pressable
                style={[
                  styles.blocker,
                  {
                    left: 0,
                    top: overlayTargetRect.top,
                    width: overlayTargetRect.left,
                    height: overlayTargetRect.height,
                  },
                ]}
                onPress={() => showBlockedHint()}
              />
              <Pressable
                style={[
                  styles.blocker,
                  {
                    left: overlayTargetRect.left + overlayTargetRect.width,
                    top: overlayTargetRect.top,
                    width: Math.max(0, width - (overlayTargetRect.left + overlayTargetRect.width)),
                    height: overlayTargetRect.height,
                  },
                ]}
                onPress={() => showBlockedHint()}
              />
            </>
          ) : !allowFreeInteraction ? (
            <Pressable style={[styles.blocker, styles.blockerFull]} onPress={() => showBlockedHint('Setting up this step for you. Use End tour if you want to leave onboarding.')} />
          ) : null}

          {targetRect ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View style={pulseStyle} />
              <Svg height="100%" width="100%">
                <Defs>
                  <Mask id="mask">
                    <Rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {targetRect.w < 60 && Math.abs(targetRect.w - targetRect.h) < 10 ? (
                      <Circle
                        cx={targetRect.x + targetRect.w / 2}
                        cy={targetRect.y + targetRect.h / 2}
                        r={Math.max(targetRect.w, targetRect.h) / 2 + 10}
                        fill="black"
                      />
                    ) : (
                      <Rect
                        x={targetRect.x - 10}
                        y={targetRect.y - 10}
                        width={targetRect.w + 20}
                        height={targetRect.h + 20}
                        fill="black"
                        rx={16}
                      />
                    )}
                  </Mask>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="rgba(10,12,18,0.78)" mask="url(#mask)" />
              </Svg>
              <Animated.View style={targetTagStyle}>
                <View style={styles.targetTag}>
                  <Text style={styles.targetTagLabel}>Tap here next</Text>
                  <Text style={styles.targetTagText}>{currentDef.cue}</Text>
                </View>
              </Animated.View>
              {targetRect ? (
                <>
                  <RNAnimated.View pointerEvents="none" style={[styles.assistRipple, assistRippleStyle]} />
                  <RNAnimated.View pointerEvents="none" style={[styles.assistPointer, assistPointerStyle]}>
                    <View style={styles.assistPointerDot} />
                  </RNAnimated.View>
                </>
              ) : null}
            </Animated.View>
          ) : null}

          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={[
              styles.tourBox,
              coachCardStyle,
              {
                width: Math.min(width - 32, 360),
                backgroundColor: COLORS.surface,
                shadowColor: COLORS.border,
                borderColor: `${COLORS.primary}22`,
                ...(currentDef.position === 'top'
                  ? { top: Math.max(10, Math.min(22, height * 0.025)) }
                  : currentDef.position === 'bottom'
                    ? { bottom: Math.max(10, Math.min(18, height * 0.025)) }
                    : targetRect && targetRect.y > height * 0.44
                      ? { top: Math.max(10, Math.min(22, height * 0.025)) }
                      : { bottom: Math.max(10, Math.min(18, height * 0.025)) }),
              },
              isCompactCoachStep ? styles.tourBoxCompact : null,
            ]}
            pointerEvents="box-none"
          >
            <Animated.View style={[styles.cardGlow, styles.cardGlowPrimary, coachGlowStyle, { backgroundColor: `${COLORS.primary}12` }]} />
            <View style={[styles.cardGlow, styles.cardGlowSuccess]} />

            <View style={styles.tourHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.coachAvatar}>
                  <Text style={styles.coachAvatarText}>M</Text>
                </View>
                <View>
                  <Text style={[styles.coachName, { color: COLORS.textPrimary }]}>Maroon Coach</Text>
                  <View style={styles.progressPill}>
                    <Text style={[styles.stepIndicator, { color: COLORS.primary }]}>{stepLabel}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => { endTour(); }}>
                <Text style={[styles.skipText, { color: COLORS.textSecondary }]}>End tour</Text>
              </TouchableOpacity>
            </View>

            {!isCompactCoachStep ? (
              <View style={styles.progressDotsRow}>
                {TOUR_SEQUENCE.map((step, index) => {
                  const isDone = index < currentStep;
                  const isCurrent = index === currentStep;
                  return (
                    <View
                      key={step.id}
                      style={[
                        styles.progressDot,
                        isDone && { backgroundColor: COLORS.primary, opacity: 0.92 },
                        isCurrent && { backgroundColor: COLORS.primary, width: 24, opacity: 1 },
                        !isDone && !isCurrent && { backgroundColor: COLORS.border, opacity: 0.9 },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}

            <View style={[styles.actionBlock, { borderColor: COLORS.border }]}>
              <Text style={[styles.coachLabel, { color: COLORS.primary }]}>Do this now</Text>
              <Text style={[styles.actionText, { color: COLORS.textPrimary }]}>{currentDef.cue}</Text>
            </View>

            <Text style={[styles.tourTitle, { color: COLORS.textPrimary }]}>{currentDef.title}</Text>
            <Text
              numberOfLines={isCompactCoachStep ? 2 : undefined}
              style={[styles.tourDescription, { color: COLORS.textSecondary }]}
            >
              {currentDef.instruction}
            </Text>

            {regionHint ? (
              <Text style={[styles.regionHintText, { color: COLORS.textSecondary }]}>{regionHint}</Text>
            ) : null}

            <View style={styles.bottomActionGroup}>
              {assistVisible ? (
                <Pressable
                  onPress={runAssist}
                  style={({ pressed }) => [
                    styles.assistButton,
                    {
                      backgroundColor: `${COLORS.primary}14`,
                      borderColor: `${COLORS.primary}30`,
                      opacity: pressed ? 0.88 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[styles.assistButtonTitle, { color: COLORS.primary }]}>Confused? Click here for extra guidance.</Text>
                  <Text style={[styles.assistButtonBody, { color: COLORS.textSecondary }]}>
                    We will show the exact action, animate it on screen, and move you to the next step automatically.
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => endTour({ navigateToDashboard: true })}
                style={({ pressed }) => [
                  styles.finishTourButton,
                  {
                    borderColor: `${COLORS.primary}2C`,
                    backgroundColor: `${COLORS.primary}12`,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text style={[styles.finishTourText, { color: COLORS.primary }]}>Finish tour now</Text>
              </Pressable>

              {blockedHint ? (
                <Animated.View
                  entering={FadeIn.duration(140)}
                  exiting={FadeOut.duration(180)}
                  style={[
                    styles.blockedHintBubble,
                    {
                      backgroundColor: isDark ? 'rgba(17,24,39,0.96)' : 'rgba(255,255,255,0.96)',
                      borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,39,0.12)',
                    },
                  ]}
                >
                  <Text style={[styles.blockedHintText, { color: isDark ? '#F9FAFB' : '#111827' }]}>
                    {blockedHint.message}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          </Animated.View>

          <CelebrationBurst
            visible={!!celebration}
            title={celebration?.title || ''}
            body={celebration?.body || ''}
            width={width}
          />

          {completionCelebration ? (
            <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(240)} style={styles.completionOverlay}>
              <View style={styles.completionBackdrop} />
              <CompletionConfetti visible width={width} />
              <CelebrationBurst visible title={completionCelebration.title} body={completionCelebration.body} width={width} />
              <View style={[styles.completionCard, { backgroundColor: COLORS.surface }]}>
                <View style={[styles.completionOrb, { backgroundColor: `${COLORS.primary}16` }]} />
                <View style={styles.completionBadge}>
                  <Text style={styles.completionBadgeText}>Tour Complete</Text>
                </View>
                <Text style={[styles.completionTitle, { color: COLORS.textPrimary }]}>{completionCelebration.title}</Text>
                <Text style={[styles.completionBody, { color: COLORS.textSecondary }]}>{completionCelebration.body}</Text>
                <View style={[styles.completionProgressTrack, { backgroundColor: `${COLORS.primary}18` }]}>
                  <RNAnimated.View style={[styles.completionProgressFill, { backgroundColor: COLORS.primary }]} />
                </View>
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </TourContext.Provider>
  );
}

export function TourTarget({ name, children, style, assistAction }: any) {
  const { registerTarget, registerAssistAction, activeTargetName } = useTour();
  const ref = useRef<View>(null);
  const isHighlighted = activeTargetName === name;

  useEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      ref.current.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          registerTarget(name, () => Promise.resolve({ x, y, w, h }));
        }
      });
    };
    measure();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isHighlighted) interval = setInterval(measure, 150);
    return () => { if (interval) clearInterval(interval); };
  }, [isHighlighted, name, registerTarget]);

  useEffect(() => {
    registerAssistAction(name, assistAction ?? null);
    return () => registerAssistAction(name, null);
  }, [assistAction, name, registerAssistAction]);

  return (
    <View ref={ref} style={[style, isHighlighted && { zIndex: 9999 }]} collapsable={false} pointerEvents="box-none">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 10000,
  },
  blocker: { position: 'absolute', zIndex: 9998 },
  blockerFull: { ...StyleSheet.absoluteFillObject },
  tourBox: {
    position: 'absolute',
    borderRadius: 26,
    padding: 14,
    overflow: 'hidden',
    elevation: 20,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 10000,
    borderWidth: 1,
    gap: 8,
  },
  tourBoxCompact: { padding: 12, gap: 6 },
  cardGlow: { position: 'absolute', borderRadius: 999 },
  cardGlowPrimary: { width: 180, height: 180, top: -70, right: -40 },
  cardGlowSuccess: { width: 120, height: 120, bottom: -45, left: -20, backgroundColor: 'rgba(19,138,91,0.10)' },
  tourHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coachAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7A0B1C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A0B1C',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  coachAvatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  coachName: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  progressPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(80,0,0,0.08)',
  },
  progressDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressDot: { height: 6, width: 6, borderRadius: 999 },
  stepIndicator: { fontWeight: '800', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 },
  skipText: { fontWeight: '700', fontSize: 11 },
  tourTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  tourDescription: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  regionHintText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  bottomActionGroup: { marginTop: 6, gap: 10 },
  finishTourButton: {
    alignSelf: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishTourText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  targetTag: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.1)',
  },
  targetTagLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9, color: '#7A0B1C', marginBottom: 4 },
  targetTagText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#151821' },
  actionBlock: { borderRadius: 18, padding: 14, gap: 6, borderWidth: 1 },
  coachLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9 },
  actionText: { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  assistButton: { borderRadius: 18, paddingHorizontal: 15, paddingVertical: 14, borderWidth: 1, gap: 6 },
  assistButtonTitle: { fontSize: 13, fontWeight: '900' },
  assistButtonBody: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  blockedHintBubble: {
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  blockedHintText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  assistPointer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  assistPointerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#111827' },
  assistRipple: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  celebrationWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 44, zIndex: 10001 },
  celebrationCard: {
    minWidth: 230,
    maxWidth: 320,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  celebrationEyebrow: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9, color: '#138A5B', marginBottom: 4 },
  celebrationTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 4, letterSpacing: -0.4 },
  celebrationBody: { fontSize: 13, fontWeight: '600', color: '#4B5563', lineHeight: 18 },
  confettiPiece: { position: 'absolute', top: 6, borderRadius: 4 },
  completionOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10002, paddingHorizontal: 24 },
  completionBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,12,18,0.9)' },
  completionConfettiLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  completionConfettiPiece: { position: 'absolute', top: 0, borderRadius: 4 },
  completionCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
    overflow: 'hidden',
  },
  completionOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -72, right: -38 },
  completionBadge: { borderRadius: 999, backgroundColor: 'rgba(19,138,91,0.12)', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  completionBadgeText: { color: '#138A5B', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  completionTitle: { fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8, marginBottom: 10, textAlign: 'center' },
  completionBody: { fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center', marginBottom: 18 },
  completionProgressTrack: { width: '100%', height: 8, borderRadius: 999, overflow: 'hidden' },
  completionProgressFill: { width: '100%', height: '100%', borderRadius: 999 },
});
