import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WelcomeBackOverlayProps {
  firstName: string;
  onFinished: () => void;
}

const ENCOURAGEMENT_PHRASES = [
  "You've got this", "Make it happen", "Keep pushing", "Stay focused", "Believe in yourself",
  "Think big", "Keep moving forward", "Do your best", "Stay positive", "Never give up",
  "You are capable", "Keep reaching", "One step at a time", "Success awaits you", "Trust the process",
  "Stay strong", "Keep it up", "You're doing great", "Make today count", "Fortune favors the bold",
  "Just do it", "Never settle", "Stay hungry", "Stay foolish", "Think different",
  "Be your own hero", "Rise and grind", "Keep the faith", "Don't stop now", "Dream big",
  "Work hard", "Stay humble", "Hustle hard", "Make your mark", "Seize the day",
  "Carpe diem", "Find your fire", "Keep your chin up", "Stay gold", "Go for gold",
  "Break a leg", "Push your limits", "Expect great things", "Make it work", "Stay true",
  "Own your day", "Lead the way", "Keep your head up", "Eyes on the prize", "Be the change",
  "Chase your dreams", "Live your truth", "Stay sharp", "Be your best", "You're a winner",
  "Finish strong", "Start today", "Make a difference", "Find your path", "Go the distance",
  "Give it your all", "Be fearless", "Stand tall", "Keep growing", "Master your craft",
  "Small wins matter", "Consistency is key", "Keep exploring", "Be bold", "Aim high",
  "Do great things", "Your turn now", "Take the lead", "Build your future", "Stay driven",
  "Focus and execute", "Win the day", "Leave a legacy", "Be incredible", "Reach higher",
  "Defy the odds", "Show your strength", "Empower yourself", "Act with purpose", "Keep adventuring",
  "Make waves", "Ignite your spirit", "Fuel your passion", "Stay inspired", "Be unstoppable",
  "Craft your story", "Navigate with heart", "Lead with kindness", "Shape your world", "Keep climbing",
  "Find your rhythm", "Celebrate the journey", "Live with intent", "Master the moment", "Keep it real"
];

export function WelcomeBackOverlay({ firstName, onFinished }: WelcomeBackOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const phraseRef = useRef(ENCOURAGEMENT_PHRASES[Math.floor(Math.random() * ENCOURAGEMENT_PHRASES.length)]);

  useEffect(() => {
    const animation = Animated.sequence([
      // 1. Entry (300ms)
      Animated.parallel([
        Animated.timing(opacity, { 
          toValue: 1, 
          duration: 300, 
          useNativeDriver: true 
        }),
        Animated.spring(scale, { 
          toValue: 1, 
          friction: 7, 
          tension: 40, 
          useNativeDriver: true 
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]),
      // 2. Celebration Hold (700ms)
      Animated.parallel([
        Animated.timing(confettiProgress, { 
          toValue: 1, 
          duration: 1000, 
          useNativeDriver: true 
        }),
        Animated.delay(700), // Hold for 0.7 seconds
      ]),
      // 3. Exit (500ms)
      Animated.parallel([
        Animated.timing(opacity, { 
          toValue: 0, 
          duration: 500, 
          useNativeDriver: true 
        }),
        Animated.timing(scale, { 
          toValue: 1.05, 
          duration: 500, 
          useNativeDriver: true 
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        onFinished();
      }
    });

    return () => animation.stop();
  }, [onFinished]);

  const confettiCount = 60;
  const confetti = useRef(Array.from({ length: confettiCount }, (_, index) => ({
    id: index,
    left: Math.random() * SCREEN_WIDTH,
    color: ['#FFC107', '#4CAF50', '#F44336', '#2196F3', '#9C27B0', '#FF9800'][index % 6],
    size: 6 + Math.random() * 8,
    speed: 0.6 + Math.random() * 0.4,
    drift: (Math.random() - 0.5) * 150,
    delay: Math.random() * 0.2,
    rotateDir: Math.random() > 0.5 ? 1 : -1,
  }))).current;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.backgroundOverlay, { opacity: opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4]
      }) }]} />
      
      {confetti.map((piece, index) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.confetti,
            {
              left: piece.left,
              backgroundColor: piece.color,
              width: piece.size,
              height: piece.size,
              borderRadius: index % 2 === 0 ? piece.size / 2 : 2,
              transform: [
                {
                  translateY: confettiProgress.interpolate({
                    inputRange: [0, piece.delay, 1],
                    outputRange: [-50, -50, SCREEN_HEIGHT + 100],
                  }),
                },
                {
                  translateX: confettiProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.drift],
                  }),
                },
                {
                  rotate: confettiProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${(720 + index * 45) * piece.rotateDir}deg`],
                  }),
                },
              ],
              opacity: confettiProgress.interpolate({
                inputRange: [0, 0.1, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
            },
          ]}
        />
      ))}
      
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={{ opacity: contentOpacity, alignItems: 'center' }}>
            <Text style={styles.title}>WELCOME BACK,</Text>
            <Text style={styles.name}>{firstName.toUpperCase()}!</Text>
            
            <View style={styles.celebrationRow}>
                <Text style={styles.celebrationText}>{phraseRef.current}</Text>
            </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  card: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl * 1.5,
    paddingVertical: SPACING.xl,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 8,
    borderBottomColor: '#D0D0D0', // 3D effect
    minWidth: SCREEN_WIDTH * 0.8,
  },
  title: {
    fontSize: 14,
    color: '#AFAFAF',
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  name: {
    fontSize: 32,
    color: COLORS.primary,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  celebrationRow: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginTop: SPACING.sm,
  },
  celebrationText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
});

