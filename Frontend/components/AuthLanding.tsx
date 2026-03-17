import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import { GraduationCap } from 'lucide-react-native';

interface AuthLandingProps {
  onLoginPress: () => void;
}

export function AuthLanding({ onLoginPress }: AuthLandingProps) {
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
            <Text style={styles.appTitle}>Maroon Schedules</Text>
          </View>

          {/* Tagline - Staggered */}
          <View>
            <Text style={styles.tagline}>Build Your Aggie Schedule. Gig 'em!</Text>
          </View>

          {/* Colored Accent Line */}
          <View style={styles.accentLine} />

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Button Group - Staggered */}
          <View
            style={styles.buttonGroup}
          >
            {/* Primary CTA: Log In */}
            <Button
              variant="primary"
              style={styles.primaryButton}
              onPress={onLoginPress}
            >
              Log In
            </Button>
          </View>

          {/* Informational Panel */}
          <View
            style={styles.infoContainer}
          >
             <Text style={styles.infoTitle}>Why Maroon Schedules?</Text>
             <Text style={styles.infoContent}>
                Plan your classes, avoid conflicts, and get to graduation using your Texas A&M NetID. 
                Experience a smooth schedule builder explicitly designed for Aggies.
             </Text>
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
  tagline: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
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
  },
  infoContainer: {
    width: '100%',
    marginTop: SPACING.lg * 2,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 1,
  },
  infoTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  infoContent: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    lineHeight: 22,
    fontSize: 14,
  },
});
