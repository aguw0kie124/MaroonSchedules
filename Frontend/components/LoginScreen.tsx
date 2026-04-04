import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import * as Linking from 'expo-linking';
import { useSessionStore } from '../store/sessionStore';

const APPLE_LABEL = '';

interface LoginScreenProps {
  onBack?: () => void;
}

export function LoginScreen({ onBack }: LoginScreenProps) {
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const enterGuestMode = useSessionStore((state) => state.enterGuestMode);
  const exitGuestMode = useSessionStore((state) => state.exitGuestMode);
  const setAuthMode = useSessionStore((state) => state.setAuthMode);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'tamu' | 'admin' | 'apple' | 'adminApple' | null>(null);

  const getAuthErrorMessage = (flow: 'tamu' | 'admin' | 'apple' | 'adminApple', err: any) => {
    return (
      err?.errors?.[0]?.longMessage ||
      err?.errors?.[0]?.message ||
      err?.message ||
      (flow === 'admin' || flow === 'adminApple'
        ? 'Admin sign in failed'
        : flow === 'apple'
          ? 'Apple sign in failed'
          : 'TAMU sign in failed')
    );
  };

  const onOAuthPress = async (flow: 'tamu' | 'admin' | 'apple' | 'adminApple') => {
    try {
      exitGuestMode();
      setIsLoading(true);
      setActiveFlow(flow);
      const authResult =
        flow === 'apple' || flow === 'adminApple'
          ? await startAppleOAuthFlow({
              redirectUrl: Linking.createURL('/'),
            })
          : await startGoogleOAuthFlow({
              redirectUrl: Linking.createURL('/'),
            });
      const { createdSessionId, setActive } = authResult;
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        setAuthMode(flow === 'admin' || flow === 'adminApple' ? 'admin' : 'user');
      } else {
        Alert.alert('Error', 'Clerk did not return a valid session for this sign-in attempt.');
      }
    } catch (err: any) {
      console.error('Sign in failed', flow, JSON.stringify(err, null, 2));
      Alert.alert(
        'Error',
        getAuthErrorMessage(flow, err),
      );
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const handleGuestContinue = () => {
    enterGuestMode();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {onBack && (
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={onBack}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}

          <Text style={styles.title}>Choose How To Continue</Text>
          <Text style={styles.subtitle}>Pick the experience that fits how you want to use MaroonLife.</Text>

          <Button
            variant="primary"
            style={styles.googleButton}
            onPress={() => onOAuthPress('tamu')}
            disabled={isLoading}
          >
            {isLoading && activeFlow === 'tamu' ? 'Loading...' : 'Continue with TAMU Account'}
          </Button>

          {Platform.OS === 'ios' && (
            <Button
              variant="secondary"
              style={styles.secondaryActionButton}
              onPress={() => onOAuthPress('apple')}
              disabled={isLoading}
            >
              {isLoading && activeFlow === 'apple' ? 'Loading...' : `Continue with ${APPLE_LABEL}`}
            </Button>
          )}

          {Platform.OS === 'ios' && (
            <Button
              variant="secondary"
              style={styles.secondaryActionButton}
              onPress={() => onOAuthPress('adminApple')}
              disabled={isLoading}
            >
              {isLoading && activeFlow === 'adminApple'
                ? 'Loading...'
                : `Continue with Admin ${APPLE_LABEL} Account`}
            </Button>
          )}

          <Button
            variant="secondary"
            style={styles.secondaryActionButton}
            onPress={() => onOAuthPress('admin')}
            disabled={isLoading}
          >
            {isLoading && activeFlow === 'admin' ? 'Loading...' : 'Continue with Admin Account'}
          </Button>

          <Button
            variant="secondary"
            style={styles.guestButton}
            onPress={handleGuestContinue}
            disabled={isLoading}
          >
            Continue as Guest
          </Button>

          <Text style={styles.helperText}>
            Guest mode keeps Events sharing and Places browsing available, but account-based tools like RSVP, saved schedules, and Pings stay locked until you log in.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    paddingTop: SPACING.xl,
  },
  backButton: {
    marginBottom: SPACING.md,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  title: {
    ...TYPOGRAPHY.title,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  googleButton: {
    width: '100%',
  },
  secondaryActionButton: {
    width: '100%',
    marginTop: SPACING.md,
  },
  guestButton: {
    width: '100%',
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  helperText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACING.lg,
  },
});
