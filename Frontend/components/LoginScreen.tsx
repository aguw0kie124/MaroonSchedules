import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import * as Linking from 'expo-linking';

interface LoginScreenProps {
  onBack?: () => void;
}

export function LoginScreen({ onBack }: LoginScreenProps) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const [isLoading, setIsLoading] = useState(false);

  const onGooglePress = async () => {
    try {
      setIsLoading(true);
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/'),
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'TAMU SSO sign in failed');
    } finally {
      setIsLoading(false);
    }
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

          <Text style={styles.title}>Log In</Text>
          <Text style={styles.subtitle}>Welcome back to MaroonLife</Text>

          {/* Setup for TAMU account context */}
          <Button
            variant="secondary"
            style={styles.googleButton}
            onPress={onGooglePress}
          >
            {isLoading ? 'Loading...' : 'Continue with TAMU Account'}
          </Button>
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
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  toggleText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  primaryButton: {
    width: '100%',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  secondaryButton: {
    marginTop: SPACING.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.md,
    fontWeight: '600',
    fontSize: 12,
  },
  googleButton: {
    width: '100%',
  },
});
