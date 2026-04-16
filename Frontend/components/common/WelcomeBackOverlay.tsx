import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { SPACING } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const APP_LOGO = require('../../../assets/login-logo-transparent.png');

interface WelcomeBackOverlayProps {
  firstName: string;
  onFinished: () => void;
}

export function WelcomeBackOverlay({ onFinished }: WelcomeBackOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

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
      // 2. Hold (700ms)
      Animated.delay(700),
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

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.backgroundOverlay, { opacity: opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      }) }]} />
      
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={{ opacity: contentOpacity, alignItems: 'center' }}>
          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
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
    backgroundColor: '#FFFFFF',
  },
  card: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: Math.min(SCREEN_WIDTH * 0.44, 180),
    height: Math.min(SCREEN_WIDTH * 0.44, 180),
  },
});

