import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, CircleAlert, LibraryBig, ShieldCheck } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useUser } from '@clerk/clerk-expo';

import { Card, useTheme } from './SharedUI';
import { AnnexLibraryDetail, fetchAnnexLibraryDetail } from '../services/annexService';

export function AnnexLibraryDetailScreen({ navigation, route }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);
  const { user } = useUser();
  const libraryId = route.params?.libraryId as string;
  const email = user?.primaryEmailAddress?.emailAddress;

  const [detail, setDetail] = useState<AnnexLibraryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnnexLibraryDetail(libraryId, email)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((loadError: any) => {
        if (!cancelled) setError(loadError?.message || 'Could not load this library.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, libraryId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={18} color={COLORS.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading room availability…</Text>
        </View>
      ) : error || !detail ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Library unavailable</Text>
          <Text style={styles.stateText}>{error || 'We could not load this library right now.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <LibraryBig size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{detail.name}</Text>
                <Text style={styles.subtitle}>
                  Browse rooms, see live availability, and book in the embedded library flow.
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.eligibilityCard}>
            <View style={styles.eligibilityRow}>
              {detail.eligibility.status === 'eligible' ? (
                <ShieldCheck size={18} color={COLORS.primary} />
              ) : (
                <CircleAlert size={18} color={detail.eligibility.status === 'unauthorized' ? COLORS.danger : COLORS.primary} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Booking Eligibility</Text>
                <Text style={styles.sectionBody}>{detail.eligibility.message}</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Room Types</Text>
            <View style={styles.chipWrap}>
              {detail.room_groups.map((group) => (
                <View key={group.id} style={styles.groupChip}>
                  <Text style={styles.groupChipText}>{group.name}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Booking Rules</Text>
            {detail.booking_rules.map((rule, index) => (
              <View key={`${detail.id}-rule-${index}`} style={styles.ruleRow}>
                <View style={styles.ruleDot} />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Live Availability</Text>
            <Text style={styles.sectionBody}>{detail.booking_handoff.message}</Text>
            <View style={styles.webViewWrap}>
              <WebView
                source={{ uri: detail.search_url }}
                startInLoadingState
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                style={styles.webview}
                injectedJavaScript={`
                  (function() {
                    const style = document.createElement('style');
                    style.innerHTML = '#s-lc-public-footer, header, footer, .navbar, .navbar-fixed-top, #s-lc-public-header { display:none !important; } body { margin:0 !important; padding:0 !important; }';
                    document.head.appendChild(style);
                    true;
                  })();
                `}
              />
            </View>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.background,
      paddingTop: 48,
    },
    header: {
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    },
    backText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 12,
    },
    centerState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
      gap: 12,
    },
    stateText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    errorTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    heroCard: {
      padding: 18,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 6,
    },
    eligibilityCard: {
      padding: 16,
    },
    eligibilityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    sectionCard: {
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    sectionBody: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    groupChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.04)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    groupChipText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    ruleDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      marginTop: 6,
      backgroundColor: COLORS.primary,
    },
    ruleText: {
      flex: 1,
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    webViewWrap: {
      height: 560,
      overflow: 'hidden',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? '#131318' : '#FFFFFF',
    },
    webview: {
      flex: 1,
      backgroundColor: 'transparent',
    },
  });
