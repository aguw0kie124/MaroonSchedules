import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import { GraduationCap } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useSessionStore } from '../store/sessionStore';
import { GoogleIcon } from './common/CustomIcons';

const APPLE_LABEL = '';

export function AuthLanding() {
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const enterGuestMode = useSessionStore((state) => state.enterGuestMode);
  const exitGuestMode = useSessionStore((state) => state.exitGuestMode);
  const setAuthMode = useSessionStore((state) => state.setAuthMode);
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
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
      setAuthMode(flow === 'admin' || flow === 'adminApple' ? 'admin' : 'user');
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
      } else {
        resetSessionMode();
        Alert.alert('Error', 'Clerk did not return a valid session for this sign-in attempt.');
      }
    } catch (err: any) {
      resetSessionMode();
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
    resetSessionMode();
    enterGuestMode();
  };

  const renderGoogleLabel = (prefix: string, suffix: string, variant: 'primary' | 'secondary') => (
    <View style={styles.oauthLabel}>
      <Text
        style={[
          styles.oauthLabelText,
          variant === 'primary' ? styles.oauthLabelTextPrimary : styles.oauthLabelTextSecondary,
        ]}
      >
        {prefix}
      </Text>
      <GoogleIcon size={18} />
      {suffix ? (
        <Text
          style={[
            styles.oauthLabelText,
            variant === 'primary' ? styles.oauthLabelTextPrimary : styles.oauthLabelTextSecondary,
          ]}
        >
          {suffix}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={styles.content}
        >
          {/* Colored Background Accent */}
          <View style={styles.colorAccentTop} />

          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <GraduationCap size={90} color={COLORS.primary} strokeWidth={2} />
            </View>
          </View>

          {/* App Title - Staggered */}
          <View>
            <Text style={styles.appTitle}>MaroonLife</Text>
          </View>

          {/* Colored Accent Line */}
          <View style={styles.accentLine} />

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Button Group - Staggered */}
          <View
            style={styles.buttonGroup}
          >
            <Button
              variant="primary"
              style={styles.primaryButton}
              onPress={() => onOAuthPress('tamu')}
              disabled={isLoading}
            >
              {isLoading && activeFlow === 'tamu'
                ? 'Loading...'
                : renderGoogleLabel('Continue with', '', 'primary')}
            </Button>
            {Platform.OS === 'ios' && (
              <Button
                variant="secondary"
              style={styles.secondaryButton}
              onPress={() => onOAuthPress('apple')}
              disabled={isLoading}
            >
              {isLoading && activeFlow === 'apple' ? 'Loading...' : `Continue with ${APPLE_LABEL}`}
            </Button>
            )}
            {Platform.OS === 'ios' && (
              <Button
                variant="secondary"
                style={styles.secondaryButton}
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
              style={styles.secondaryButton}
              onPress={() => onOAuthPress('admin')}
              disabled={isLoading}
            >
              {isLoading && activeFlow === 'admin'
                ? 'Loading...'
                : renderGoogleLabel('Continue with Admin', 'Account', 'secondary')}
            </Button>
            <Button
              variant="secondary"
              style={styles.guestButton}
              onPress={handleGuestContinue}
              disabled={isLoading}
            >
              Continue as Guest
            </Button>
          </View>

          {/* Colored Background Accent Bottom */}
          <View style={styles.colorAccentBottom} />
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
    justifyContent: 'center',
    minHeight: '100%',
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  colorAccentTop: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 100,
    zIndex: 0,
    opacity: 0.5,
  },
  colorAccentBottom: {
    position: 'absolute',
    bottom: -80,
    right: -50,
    width: 180,
    height: 180,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 90,
    zIndex: 0,
  },
  logoContainer: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoBackground: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary + '20',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  appTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: SPACING.sm,
    textAlign: 'center',
    zIndex: 1,
  },
  accentLine: {
    width: 60,
    height: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginBottom: SPACING.xl,
    zIndex: 1,
  },
  spacer: {
    height: SPACING.md,
  },
  buttonGroup: {
    width: '100%',
    zIndex: 1,
  },
  oauthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  oauthLabelText: {
    fontWeight: '600',
    fontSize: 16,
  },
  oauthLabelTextPrimary: {
    color: '#FFFFFF',
  },
  oauthLabelTextSecondary: {
    color: COLORS.primary,
  },
  primaryButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  secondaryButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  guestButton: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
