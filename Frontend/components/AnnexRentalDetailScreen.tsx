import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, CircleAlert, PackageSearch, ShieldCheck } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useUser } from '@clerk/clerk-expo';

import { Card, useTheme } from './SharedUI';
import { AnnexRentalDetail, fetchAnnexRentalDetail } from '../services/annexService';

export function AnnexRentalDetailScreen({ navigation, route }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);
  const { user } = useUser();
  const rentalId = route.params?.rentalId as string;
  const email = user?.primaryEmailAddress?.emailAddress;

  const [detail, setDetail] = useState<AnnexRentalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnnexRentalDetail(rentalId, email)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((loadError: any) => {
        if (!cancelled) setError(loadError?.message || 'Could not load this rental category.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, rentalId]);

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
          <Text style={styles.stateText}>Loading rental catalog…</Text>
        </View>
      ) : error || !detail ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Rental category unavailable</Text>
          <Text style={styles.stateText}>{error || 'We could not load this rental catalog right now.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <PackageSearch size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{detail.name}</Text>
                <Text style={styles.subtitle}>
                  Browse public-library equipment and continue checkout in the embedded library flow.
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              {detail.eligibility.status === 'eligible' ? (
                <ShieldCheck size={18} color={COLORS.primary} />
              ) : (
                <CircleAlert size={18} color={detail.eligibility.status === 'unauthorized' ? COLORS.danger : COLORS.primary} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Eligibility</Text>
                <Text style={styles.sectionBody}>{detail.eligibility.message}</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Available Items</Text>
            {detail.items.length ? (
              <View style={styles.itemStack}>
                {detail.items.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.itemImage} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.model ? <Text style={styles.itemModel}>{item.model}</Text> : null}
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={3}>
                          {item.description}
                        </Text>
                      ) : null}
                      <View style={styles.availabilityChip}>
                        <Text style={styles.availabilityChipText}>{item.availability_status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionBody}>
                Item-level availability is surfaced through the embedded rental catalog for this category.
              </Text>
            )}
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Rental Flow</Text>
            <Text style={styles.sectionBody}>{detail.booking_handoff.message}</Text>
            <View style={styles.webViewWrap}>
              <WebView
                source={{ uri: detail.browse_url }}
                startInLoadingState
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                style={styles.webview}
                injectedJavaScript={`
                  (function() {
                    const style = document.createElement('style');
                    style.innerHTML = 'header, footer, .navbar, .navbar-fixed-top, #s-lc-public-header { display:none !important; } body { margin:0 !important; padding:0 !important; }';
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
      backgroundColor: '#11789A',
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
    statusCard: {
      padding: 16,
    },
    statusRow: {
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
    itemStack: {
      gap: 12,
    },
    itemCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    itemImage: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: isDark ? '#131318' : '#F4F4F6',
    },
    itemName: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    itemModel: {
      color: COLORS.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    itemDescription: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
    },
    availabilityChip: {
      alignSelf: 'flex-start',
      marginTop: 8,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.06)',
    },
    availabilityChipText: {
      color: COLORS.textPrimary,
      fontSize: 11,
      fontWeight: '800',
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
