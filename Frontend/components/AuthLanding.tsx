import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import * as Linking from 'expo-linking';
import { useSessionStore } from '../store/sessionStore';
import { GoogleIcon } from './common/CustomIcons';

const APPLE_LABEL = '\uF8FF';

export function AuthLanding() {
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
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
          : 'Google sign in failed')
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
      Alert.alert('Error', getAuthErrorMessage(flow, err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };



  const renderGoogleLabel = (prefix: string, variant: 'primary' | 'secondary') => (
    <View style={styles.oauthLabel}>
      <Text
        style={[
          styles.providerButtonText,
          variant === 'primary' ? styles.oauthLabelTextPrimary : styles.oauthLabelTextSecondary,
        ]}
      >
        {prefix}
      </Text>
      <GoogleIcon size={18} />
    </View>
  );

  const renderAppleLabel = (prefix: string, variant: 'primary' | 'secondary') => (
    <Text
      style={[
        styles.providerButtonText,
        variant === 'primary' ? styles.oauthLabelTextPrimary : styles.oauthLabelTextSecondary,
      ]}
    >
      {prefix} {APPLE_LABEL}
    </Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.colorAccentTop} />

          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/login-logo-transparent.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View>
            <Text style={styles.appTitle}>MaroonLife</Text>
          </View>

          <View style={styles.accentLine} />
          <View style={styles.spacer} />

          <View style={styles.buttonGroup}>
            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <Text style={styles.accountTitle}>Student</Text>
                <Text style={styles.accountSubtitle}>Classes, events, places, and campus tools</Text>
              </View>
              <View style={styles.providerRow}>
                <Button
                  variant="primary"
                  style={styles.providerButton}
                  onPress={() => onOAuthPress('tamu')}
                  disabled={isLoading}
                >
                  {isLoading && activeFlow === 'tamu' ? 'Loading...' : renderGoogleLabel('With', 'primary')}
                </Button>
                {Platform.OS === 'ios' && (
                  <Button
                    variant="secondary"
                    style={styles.providerButton}
                    onPress={() => onOAuthPress('apple')}
                    disabled={isLoading}
                  >
                    {isLoading && activeFlow === 'apple' ? 'Loading...' : renderAppleLabel('With', 'secondary')}
                  </Button>
                )}
              </View>
            </View>

            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <Text style={styles.accountTitle}>Admin</Text>
                <Text style={styles.accountSubtitle}>Post and manage featured campus events</Text>
              </View>
              <View style={styles.providerRow}>
                <Button
                  variant="secondary"
                  style={styles.providerButton}
                  onPress={() => onOAuthPress('admin')}
                  disabled={isLoading}
                >
                  {isLoading && activeFlow === 'admin' ? 'Loading...' : renderGoogleLabel('Admin', 'secondary')}
                </Button>
                {Platform.OS === 'ios' && (
                  <Button
                    variant="secondary"
                    style={styles.providerButton}
                    onPress={() => onOAuthPress('adminApple')}
                    disabled={isLoading}
                  >
                    {isLoading && activeFlow === 'adminApple' ? 'Loading...' : renderAppleLabel('Admin', 'secondary')}
                  </Button>
                )}
              </View>
            </View>


          </View>

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
  logoImage: {
    width: 180,
    height: 180,
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
    height: SPACING.sm,
  },
  buttonGroup: {
    width: '100%',
    zIndex: 1,
    gap: SPACING.md,
  },
  accountCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  accountHeader: {
    gap: 4,
  },
  accountTitle: {
    ...TYPOGRAPHY.body,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  accountSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  providerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  providerButton: {
    flex: 1,
  },
  oauthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  providerButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  oauthLabelTextPrimary: {
    color: '#FFFFFF',
  },
  oauthLabelTextSecondary: {
    color: COLORS.primary,
  },
  },
});
