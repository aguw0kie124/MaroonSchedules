import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, CheckCircle2, ChevronRight, Scale } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { acceptToS } from '../api/client';
import { SUPPORT_CONTACT_URL } from '../config';

interface TOSScreenProps {
  clerkId: string;
  onAccepted: () => void;
}

export function TOSScreen({ clerkId, onAccepted }: TOSScreenProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await acceptToS(clerkId);
      onAccepted();
    } catch (error: any) {
      console.error('TOS Acceptance failed:', error);
      const rawMessage = String(error?.message || error || '');
      const message = rawMessage.toLowerCase().includes('temporarily unavailable')
        ? 'We could not reach the server right now. Please try again in a moment.'
        : rawMessage.toLowerCase().includes('timeout')
          ? 'The server took too long to respond. Please check the backend connection and try again.'
          : 'Failed to save acceptance. Please try again.';
      setErrorMessage(message);
      Alert.alert('Unable to Continue', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#1A1A1A', '#0D0D0D'] : ['#F8FAFC', '#F1F5F9']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + '15' }]}>
            <Scale size={32} color={COLORS.primary} />
          </View>
          <Text style={[styles.title, { color: COLORS.textPrimary }]}>Community Standards</Text>
          <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
            MaroonLife is dedicated to fostering a safe and respectful campus environment.
          </Text>
        </View>

        <View style={styles.policyCard}>
          <View style={styles.policyItem}>
            <View style={styles.policyIconBg}>
              <ShieldAlert size={20} color="#EF4444" />
            </View>
            <View style={styles.policyTextContainer}>
              <Text style={[styles.policyTitle, { color: COLORS.textPrimary }]}>Zero Tolerance Policy</Text>
              <Text style={[styles.policyDescription, { color: COLORS.textSecondary }]}>
                Strict zero tolerance for objectionable content including hate speech, harassment, 
                or sexually explicit material.
              </Text>
            </View>
          </View>

          <View style={styles.policyItem}>
            <View style={styles.policyIconBg}>
              <CheckCircle2 size={20} color={COLORS.primary} />
            </View>
            <View style={styles.policyTextContainer}>
              <Text style={[styles.policyTitle, { color: COLORS.textPrimary }]}>Abuse Prevention</Text>
              <Text style={[styles.policyDescription, { color: COLORS.textSecondary }]}>
                Abusive users will be immediately suspended. We reserve the right to remove any 
                content that violates these standards.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.legalSection}>
          <Text style={[styles.legalText, { color: COLORS.textTertiary }]}>
            By proceeding, you acknowledge that you have read and agree to our{' '}
            <Text 
              style={{ color: COLORS.primary, fontWeight: '700' }} 
              onPress={() => Linking.openURL('https://www.termsfeed.com/live/2fc33440-a5a9-4943-a1da-d3c5d5abc1e5')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text 
              style={{ color: COLORS.primary, fontWeight: '700' }} 
              onPress={() => Linking.openURL('https://www.termsfeed.com/live/4889a318-ae78-48e2-975d-2eddfe043866')}
            >
              Privacy Policy
            </Text>
            . You understand that failure to comply with these standards will result in permanent account termination.
            {' '}
            For questions or safety concerns, contact us via{' '}
            <Text
              style={{ color: COLORS.primary, fontWeight: '700' }}
              onPress={async () => {
                try {
                  await Linking.openURL(SUPPORT_CONTACT_URL);
                } catch (error) {
                  Alert.alert(
                    'Unable to Open Support',
                    'We could not open the support page. Please visit our support site directly.'
                  );
                }
              }}
            >
              Contact Support
            </Text>
            .
          </Text>
        </View>

        {errorMessage ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: isDark ? 'rgba(127,29,29,0.32)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(248,113,113,0.32)' : '#FECACA',
              },
            ]}
          >
            <Text style={[styles.errorText, { color: isDark ? '#FECACA' : '#991B1B' }]}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: COLORS.border }]}>
        <Pressable
          style={({ pressed }) => [
            styles.acceptButton,
            { backgroundColor: COLORS.primary, opacity: pressed || loading ? 0.9 : 1 }
          ]}
          onPress={handleAccept}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.acceptButtonText}>I Accept and Agree</Text>
              <ChevronRight size={18} color="#FFFFFF" strokeWidth={3} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  policyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    gap: 24,
  },
  policyItem: {
    flexDirection: 'row',
    gap: 16,
  },
  policyIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyTextContainer: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  policyDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  legalSection: {
    marginTop: 32,
    paddingHorizontal: 8,
  },
  errorCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  legalText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  acceptButton: {
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
