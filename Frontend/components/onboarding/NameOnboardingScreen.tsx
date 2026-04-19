import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../SharedUI';
import { PrimaryButton } from '../SharedUI';
import { updateUserProfile } from '../../api/client';
import { useUser } from '@clerk/clerk-expo';

const { width } = Dimensions.get('window');

interface NameOnboardingScreenProps {
  onDone: (name: string) => void;
}

export const NameOnboardingScreen: React.FC<NameOnboardingScreenProps> = ({ onDone }) => {
  const { COLORS, theme } = useTheme();
  const { user } = useUser();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);

  // Animation shared values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const greetingOpacity = useSharedValue(0);
  const greetingScale = useSharedValue(0.8);
  const inputTranslateX = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
    translateY.value = withSpring(0);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      inputTranslateX.value = withSpring(10, {}, () => {
        inputTranslateX.value = withSpring(0);
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (user?.id) {
        await updateUserProfile(user.id, { full_name: name.trim() });
      }
      
      // Trigger greeting animation
      setShowGreeting(true);
      opacity.value = withTiming(0, { duration: 400 });
      translateY.value = withTiming(-20, { duration: 400 });
      
      greetingOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
      greetingScale.value = withDelay(500, withSpring(1));

      // Wait for animation then proceed
      setTimeout(() => {
        onDone(name.trim());
      }, 2500);
    } catch (error) {
      console.error('Failed to update name:', error);
      setIsSubmitting(false);
    }
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const inputStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: inputTranslateX.value }],
  }));

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: greetingOpacity.value,
    transform: [{ scale: greetingScale.value }],
  }));

  if (showGreeting) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <Animated.View style={[styles.greetingContainer, greetingStyle]}>
          <Text style={[styles.greetingLabel, { color: COLORS.textSecondary }]}>Welcome,</Text>
          <Text style={[styles.greetingName, { color: COLORS.primary }]}>{name}</Text>
          <Text style={[styles.greetingSub, { color: COLORS.textTertiary }]}>Let's get you started.</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: COLORS.background }]}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <Animated.View style={[styles.content, containerStyle]}>
            <Text style={[styles.label, { color: COLORS.textSecondary }]}>FIRST THINGS FIRST</Text>
            <Text style={[styles.title, { color: COLORS.textPrimary }]}>What should we call you?</Text>
            
            <Animated.View style={[styles.inputWrapper, inputStyle]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: COLORS.textPrimary,
                    borderColor: COLORS.border,
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  },
                ]}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textTertiary}
                value={name}
                onChangeText={setName}
                autoFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </Animated.View>

            <PrimaryButton
              title="Continue"
              onPress={handleSubmit}
              isLoading={isSubmitting}
              style={styles.button}
            />
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 32,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
  },
  greetingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  greetingLabel: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  greetingName: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
    textAlign: 'center',
    marginBottom: 16,
  },
  greetingSub: {
    fontSize: 16,
    fontWeight: '500',
  },
});
