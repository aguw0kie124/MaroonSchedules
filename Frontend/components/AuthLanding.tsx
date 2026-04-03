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

export function AuthLanding() {
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
              onPress={() => onGooglePress('tamu')}
              disabled={isLoading}
            >
              {isLoading && activeFlow === 'tamu' ? 'Loading...' : 'Continue with TAMU Account'}
            </Button>
            <Button
              variant="secondary"
              style={styles.secondaryButton}
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
