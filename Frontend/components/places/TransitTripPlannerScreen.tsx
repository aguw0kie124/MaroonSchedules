import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, ExternalLink, MapPinned, Route, TimerReset } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';

import { AGGIESPIRIT_TRIP_PLANNER_URL } from '../../config';
import { useTheme } from '../SharedUI';

export default function TransitTripPlannerScreen({ navigation }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);
  const [openingPlanner, setOpeningPlanner] = useState(false);

  const handleOpenPlanner = async () => {
    try {
      setOpeningPlanner(true);
      await WebBrowser.openBrowserAsync(AGGIESPIRIT_TRIP_PLANNER_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        controlsColor: COLORS.primary,
      });
    } finally {
      setOpeningPlanner(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={18} color={COLORS.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Plan a Trip</Text>
          <Text style={styles.subtitle}>
            Open the official AggieSpirit planner in your browser for reliable destination selection and route planning.
          </Text>
        </View>
      </View>

      <View style={styles.tipRow}>
        <View style={styles.tipChip}>
          <MapPinned size={14} color={COLORS.primary} />
          <Text style={styles.tipText}>Start + destination</Text>
        </View>
        <View style={styles.tipChip}>
          <TimerReset size={14} color={COLORS.primary} />
          <Text style={styles.tipText}>Leave at / arrive by</Text>
        </View>
        <View style={styles.tipChip}>
          <Route size={14} color={COLORS.primary} />
          <Text style={styles.tipText}>Best / fewer transfers / less walking</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Official planner</Text>
        <Text style={styles.infoBody}>
          The embedded version was not reliably committing destination selections, which kept the route button disabled.
          Opening the official planner directly in the browser avoids that issue.
        </Text>

        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Destination search and dropdown selection work more reliably</Text>
          <Text style={styles.bulletItem}>• Full AggieSpirit planner controls are available</Text>
          <Text style={styles.bulletItem}>• Great for future trips, off-campus routing, and arrival-time planning</Text>
        </View>

        <Pressable
          style={[styles.primaryButton, openingPlanner && styles.primaryButtonDisabled]}
          onPress={handleOpenPlanner}
          disabled={openingPlanner}
        >
          <ExternalLink size={16} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {openingPlanner ? 'Opening planner...' : 'Open Official Trip Planner'}
          </Text>
        </Pressable>

        <Text style={styles.footerNote}>{AGGIESPIRIT_TRIP_PLANNER_URL}</Text>
      </View>
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
      paddingHorizontal: 18,
      marginBottom: 14,
      gap: 14,
    },
    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.04)',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    backText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    headerCopy: {
      gap: 4,
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    tipRow: {
      paddingHorizontal: 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    tipChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tipText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    infoCard: {
      marginHorizontal: 18,
      marginTop: 8,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? '#131318' : '#FFFFFF',
      padding: 22,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.26 : 0.08,
      shadowRadius: 18,
      elevation: 10,
    },
    infoTitle: {
      color: COLORS.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    infoBody: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    bulletList: {
      gap: 8,
    },
    bulletItem: {
      color: COLORS.textPrimary,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    primaryButton: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: COLORS.primary,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 18,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    footerNote: {
      color: COLORS.textTertiary,
      fontSize: 11,
      lineHeight: 16,
    },
  });
