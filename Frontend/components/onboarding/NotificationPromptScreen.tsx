import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, BellRing, BellOff, ChevronRight, Bus, Calendar, Radio } from 'lucide-react-native';
import { useTheme } from '../SharedUI';
import { useAppShellStore } from '../../store/appShellStore';
import { requestNotificationPermissions } from '../../services/notificationService';

interface NotificationPromptScreenProps {
  onDone: () => void;
}

export function NotificationPromptScreen({ onDone }: NotificationPromptScreenProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = React.useState(false);
  
  const setNotificationsEnabled = useAppShellStore((state) => state.setNotificationsEnabled);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermissions();
      setNotificationsEnabled(granted);
      onDone();
    } catch (error) {
      console.error('Notification permission request failed:', error);
      onDone();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setNotificationsEnabled(false);
    onDone();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#1A1A1A', '#0D0D0D'] : ['#F8FAFC', '#F1F5F9']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + '15' }]}>
              <BellRing size={40} color={COLORS.primary} strokeWidth={2.5} />
            </View>
            <Text style={[styles.title, { color: COLORS.textPrimary }]}>Stay in the Loop</Text>
            <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
              Get helpful reminders for your classes, buses, and campus activity.
            </Text>
          </View>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                <Bus size={20} color="#32D74B" />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: COLORS.textPrimary }]}>Transit Alerts</Text>
                <Text style={[styles.featureDesc, { color: COLORS.textSecondary }]}>
                  5-minute warnings before your bus arrives at the stop.
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(255, 149, 0, 0.1)' }]}>
                <Calendar size={20} color="#FF9500" />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: COLORS.textPrimary }]}>Event Reminders</Text>
                <Text style={[styles.featureDesc, { color: COLORS.textSecondary }]}>
                  Never miss a club meeting or campus event you've saved.
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
                <Radio size={20} color="#007AFF" />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: COLORS.textPrimary }]}>Social Pings</Text>
                <Text style={[styles.featureDesc, { color: COLORS.textSecondary }]}>
                  Real-time updates on upvotes and comments for your pings.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: COLORS.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.enableButton,
              { backgroundColor: COLORS.primary, opacity: pressed || loading ? 0.9 : 1 }
            ]}
            onPress={handleEnable}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.enableButtonText}>Enable Notifications</Text>
                <ChevronRight size={18} color="#FFFFFF" strokeWidth={3} />
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.skipButton,
              { opacity: pressed ? 0.6 : 1 }
            ]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={[styles.skipButtonText, { color: COLORS.textTertiary }]}>Maybe Later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  features: {
    gap: 28,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
    marginTop: 'auto',
  },
  enableButton: {
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  skipButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
