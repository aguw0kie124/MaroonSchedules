import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import * as Linking from 'expo-linking';
import { useSessionStore } from '../store/sessionStore';

interface LoginScreenProps {
  onBack?: () => void;
}

export function LoginScreen({ onBack }: LoginScreenProps) {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const enterGuestMode = useSessionStore((state) => state.enterGuestMode);
  const exitGuestMode = useSessionStore((state) => state.exitGuestMode);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'tamu' | 'admin' | null>(null);

  const onGooglePress = async (flow: 'tamu' | 'admin') => {
    try {
      exitGuestMode();
      setIsLoading(true);
      setActiveFlow(flow);
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/'),
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.errors?.[0]?.message ||
          (flow === 'admin' ? 'Admin sign in failed' : 'TAMU sign in failed'),
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
            onPress={() => onGooglePress('tamu')}
            disabled={isLoading}
          >
            {isLoading && activeFlow === 'tamu' ? 'Loading...' : 'Continue with TAMU Account'}
          </Button>

          <Button
            variant="secondary"
            style={styles.secondaryActionButton}
            onPress={() => onGooglePress('admin')}
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
