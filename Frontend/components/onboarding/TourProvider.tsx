import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Modal } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing
} from 'react-native-reanimated';
import Svg, { Defs, Rect, Mask, Circle } from 'react-native-svg';
import { useTheme } from '../SharedUI';
import { useAppShellStore } from '../../store/appShellStore';
import { completeTour } from '../../api/client';

const { width, height } = Dimensions.get('window');

type TargetRect = { x: number; y: number; w: number; h: number };

type TourContextType = {
  startTour: () => void;
  endTour: () => void;
  isTourActive: boolean;
  currentStep: number;
  registerTarget: (name: string, measureFn: () => Promise<TargetRect | null>) => void;
  advanceStep: (expectedStepName: string) => void;
  activeTargetName: string | null;
};

const TourContext = createContext<TourContextType>({
  startTour: () => { },
  endTour: () => { },
  isTourActive: false,
  currentStep: 0,
  registerTarget: () => { },
  advanceStep: () => { },
  activeTargetName: null,
});

export const useTour = () => useContext(TourContext);

import { navigationRef } from '../../navigation/Refs';

export const TOUR_SEQUENCE = [
  { id: 'switch-to-list', title: "View Options 📋", desc: "The tour requires 'List' view. Tap the 'List' tab to see the full campus schedule and continue." },
  { id: 'first-event-card', title: "Discover 🚀", desc: "Great! Now tap an event in the list to explore its details and see what's happening." },
  { id: 'event-rsvp', title: "Check In ✅", desc: "Tap 'Add to schedule' to track this event on your live map." },
  { id: 'places-tab', title: "Track on Map 🗺️", desc: "Your event is saved! Now, tap the 'Places' tab to see on-campus facilities and more!", position: 'top' },
  { id: 'places-settings', title: "Customize View ⚙️", desc: "Let's explore layers. Tap the 'Edit' button to manage your campus layers." },
  { id: 'add-gyms-toggle', title: "Enable Layers 🏋️", desc: "Scroll down and toggle 'Gyms' to enable live occupancy tracking across campus." },
  { id: 'add-gyms-close', title: "Looking Good! ✨", desc: "Close the tab to see your newly added campus layers on the map." },
  { id: 'gyms-pill', title: "Focus Filters 🏙️", desc: "Tap the 'Gyms' pill to quickly filter the map for recreation spots." },
  { id: 'rec-center-item', title: "Live Insights 📈", desc: "Select a rec center from the list to view its current live crowd data." },
  { id: 'social-tab', title: "Community ⬇️", desc: "Stay connected! Tap the 'Pings' tab to see trending campus updates." },
  { id: 'crowdping-cta', title: "Spread the Word 📢", desc: "Help others by sharing live updates! Tap the search bar to start." },
  { id: 'crowdping-close', title: "Spread the Word ✖️", desc: "You can post updates for others to see. Tap the 'X' to continue." },
  { id: 'settings-tab', title: "Profile ⚙️", desc: "Final step! Tap 'Settings' to finish your account setup.", position: 'top' },
  { id: 'tour-finish', title: "Welcome Home! 🎉", desc: "You're all set! Tap 'Launch MaroonLife' to start your journey." }
];

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { COLORS } = useTheme();
  const isTOSAccepted = useAppShellStore((state) => state.isTOSAccepted);
  const isNotificationPrompted = useAppShellStore((state) => state.isNotificationPrompted);
  const isTourCompleted = useAppShellStore((state) => state.isTourCompleted);
  const setTourCompleted = useAppShellStore((state) => state.setTourCompleted);

  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isIdle, setIsIdle] = useState(false);

  const targetsRef = useRef<Record<string, () => Promise<TargetRect | null>>>({});
  const idleTimerRef = useRef<any>(null);

  const boxTranslateX = useSharedValue(0);

  const activeTargetName = isTourActive && currentStep < TOUR_SEQUENCE.length ? TOUR_SEQUENCE[currentStep].id : null;

// moved below

  const updateTargetRect = async () => {
    if (!activeTargetName || !targetsRef.current[activeTargetName]) {
      setTargetRect(null);
      return;
    }
    const rect = await targetsRef.current[activeTargetName]();
    if (rect) setTargetRect(rect);
  };

  useEffect(() => {
    // Poll for measurement repeatedly if missing, in case screen hasn't mounted
    if (isTourActive && activeTargetName) {
      const interval = setInterval(() => {
        updateTargetRect();
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isTourActive, activeTargetName]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourActive(true);
    // Force user to Events tab if not there
    // We add a delay to ensure RootNavigator has finished switching from onboarding to MainStack
    setTimeout(() => {
      if (navigationRef.isReady()) {
        try {
          (navigationRef as any).navigate('Main', { screen: 'Dashboard' });
        } catch (e) {
          console.warn("TourProvider couldn't navigate to Dashboard", e);
        }
      }
    }, 300);
  }, []);

  const endTour = useCallback(async () => {
    setIsTourActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    // Use nested navigation to ensures stable target resolution
    setTimeout(() => {
      if (navigationRef.isReady()) {
        try {
          (navigationRef as any).navigate('Main', { screen: 'Dashboard' });
        } catch (e) {
          console.warn("TourProvider couldn't navigate to Dashboard on end", e);
        }
      }
    }, 100);

    if (userId) {
      setTourCompleted(true);
      completeTour(userId).catch(err => console.warn('Failed to persist tour completion:', err));
    }
  }, [userId, setTourCompleted]);

  // Initialization Effect: Wait for all prerequisite prompts to finish
  useEffect(() => {
    if (isSignedIn && userId && isTOSAccepted && isNotificationPrompted && !isTourCompleted) {
      startTour();
    }
  }, [isSignedIn, userId, isTOSAccepted, isNotificationPrompted, isTourCompleted, startTour]);

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      // Shake the box
      boxTranslateX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }, 10000);
  };

  useEffect(() => {
    if (isTourActive) {
      resetIdleTimer();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [currentStep, isTourActive]);

  const registerTarget = useCallback((name: string, measureFn: () => Promise<TargetRect | null>) => {
    targetsRef.current[name] = measureFn;
  }, []);

  const advanceStep = useCallback((expectedStepName: string) => {
    if (!isTourActive) return;
    if (activeTargetName === expectedStepName) {
      if (currentStep < TOUR_SEQUENCE.length - 1) {
        setCurrentStep(prev => prev + 1);
        setTargetRect(null); // Reset until next measures
      } else {
        endTour();
      }
    }
  }, [isTourActive, activeTargetName, currentStep, endTour]);

  const currentDef = isTourActive && currentStep < TOUR_SEQUENCE.length ? TOUR_SEQUENCE[currentStep] : null;

  const pulseVal = useSharedValue(0);

  useEffect(() => {
    if (isTourActive && targetRect) {
      pulseVal.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      pulseVal.value = 0;
    }
  }, [isTourActive, !!targetRect]);

  const pulseStyle = useAnimatedStyle(() => {
    if (!targetRect) return { opacity: 0 };
    return {
      position: 'absolute',
      left: targetRect.x - 14,
      top: targetRect.y - 14,
      width: targetRect.w + 28,
      height: targetRect.h + 28,
      borderRadius: targetRect.w < 60 ? (targetRect.w + 28) / 2 : 16,
      backgroundColor: COLORS.primary,
      opacity: (1 - pulseVal.value) * 0.4,
      transform: [{ scale: 1 + pulseVal.value * 0.8 }],
    };
  });

  const animatedBoxStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: boxTranslateX.value }]
    };
  });

  const value = React.useMemo(() => ({
    startTour,
    endTour,
    isTourActive,
    currentStep,
    registerTarget,
    advanceStep,
    activeTargetName
  }), [startTour, endTour, isTourActive, currentStep, registerTarget, advanceStep, activeTargetName]);

  return (
    <TourContext.Provider value={value}>
      {children}

      {isTourActive && !!currentDef && (
        <View style={styles.overlayWrapper} pointerEvents="box-none">
          {targetRect && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View style={pulseStyle} />
              <Svg height="100%" width="100%">
                <Defs>
                  <Mask id="mask">
                    <Rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {/* Circle mask for small/square targets, else rounded rect */}
                    {targetRect.w < 60 && Math.abs(targetRect.w - targetRect.h) < 10 ? (
                      <Circle
                        cx={targetRect.x + targetRect.w / 2}
                        cy={targetRect.y + targetRect.h / 2}
                        r={Math.max(targetRect.w, targetRect.h) / 2 + 8}
                        fill="black"
                      />
                    ) : (
                      <Rect
                        x={targetRect.x - 8}
                        y={targetRect.y - 8}
                        width={targetRect.w + 16}
                        height={targetRect.h + 16}
                        fill="black"
                        rx={12}
                      />
                    )}
                  </Mask>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#mask)" />
              </Svg>
            </Animated.View>
          )}

          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={[
              styles.tourBox,
              {
                backgroundColor: COLORS.surface,
                shadowColor: COLORS.border,
                position: 'absolute',
                // Stable positioning logic with preference mapping
                ...(currentDef?.position === 'top' ? { top: 60 } :
                  currentDef?.position === 'bottom' ? { bottom: 40 } :
                    targetRect && targetRect.y > height * 0.6 ? { top: 60 } : { bottom: 40 }),
              },
              animatedBoxStyle
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.tourHeader}>
              <Text style={[styles.stepIndicator, { color: COLORS.primary }]}>Tutorial — Step {currentStep + 1} of {TOUR_SEQUENCE.length}</Text>
              <TouchableOpacity onPress={endTour}><Text style={[styles.skipText, { color: COLORS.textSecondary }]}>End</Text></TouchableOpacity>
            </View>
            <Text style={[styles.tourTitle, { color: COLORS.textPrimary }]}>{currentDef?.title}</Text>
            <Text style={[styles.tourDescription, { color: COLORS.textSecondary }]}>
              {isIdle ? "🤔 Still there? " + currentDef?.desc : currentDef?.desc}
            </Text>

            {isIdle && (
              <TouchableOpacity
                style={[styles.idleSkipButton, { backgroundColor: COLORS.primary }]}
                onPress={endTour}
              >
                <Text style={styles.idleSkipButtonText}>Skip Tutorial</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      )}
    </TourContext.Provider>
  );
}

export function TourTarget({ name, children, style }: any) {
  const { registerTarget, activeTargetName } = useTour();
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
    let interval: any;
    if (isHighlighted) {
      interval = setInterval(measure, 150);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [name, isHighlighted, registerTarget]);

  return (
    <View
      ref={ref}
      style={[style, isHighlighted && { zIndex: 9999 }]}
      collapsable={false}
      pointerEvents="box-none"
    >
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
  tourBox: {
    width: width - 32,
    borderRadius: 20,
    padding: 16,
    elevation: 20,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 10000,
    borderWidth: 1,
  },
  tourHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepIndicator: {
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  skipText: {
    fontWeight: '700',
    fontSize: 12,
  },
  tourTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  tourDescription: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 10,
  },
  arrowContainer: {
    position: 'absolute',
    left: '50%',
    marginLeft: -12,
  },
  idleSkipButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleSkipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  }
});
