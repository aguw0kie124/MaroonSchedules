import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WelcomeBackOverlayProps {
  firstName: string;
  onFinished: () => void;
}

export function WelcomeBackOverlay({ firstName, onFinished }: WelcomeBackOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      // 1. Entry
      Animated.parallel([
        Animated.timing(opacity, { 
          toValue: 1, 
          duration: 400, 
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
          duration: 400,
          useNativeDriver: true
        })
      ]),
      // 2. Celebration Hold
      Animated.parallel([
        Animated.timing(confettiProgress, { 
          toValue: 1, 
          duration: 2000, 
          useNativeDriver: true 
        }),
        Animated.delay(1500), // Hold for 1.5 seconds
      ]),
      // 3. Exit
      Animated.parallel([
        Animated.timing(opacity, { 
          toValue: 0, 
          duration: 600, 
          useNativeDriver: true 
        }),
        Animated.timing(scale, { 
          toValue: 1.05, 
          duration: 600, 
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
            <View style={styles.badge}>
                <Text style={styles.badgeText}>🦉</Text>
            </View>
            <Text style={styles.title}>WELCOME BACK,</Text>
            <Text style={styles.name}>{firstName.toUpperCase()}!</Text>
            
            <View style={styles.celebrationRow}>
                <Text style={styles.celebrationText}>You're doing great! ✨</Text>
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
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderBottomWidth: 4,
    borderBottomColor: '#D0D0D0',
  },
  badgeText: {
    fontSize: 44,
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

