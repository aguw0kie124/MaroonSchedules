import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CalendarDays, Compass, MapPinned, UtensilsCrossed } from 'lucide-react-native';
import { PrimaryButton, useTheme } from './SharedUI';

const CORE_FEATURES = [
  {
    title: 'Events That Matter',
    body: 'Find what is happening on campus fast, with the events that are actually worth showing up to.',
    icon: CalendarDays,
  },
  {
    title: 'A Better Campus Map',
    body: 'Use places, classes, buses, navigation, and live context from one map-first experience.',
    icon: MapPinned,
  },
  {
    title: 'Menus As Utility',
    body: 'Dining stays practical: quick menu access when you need to decide where to eat.',
    icon: UtensilsCrossed,
  },
];

export function Onboarding() {
  const navigation = useNavigation<any>();
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Compass size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.eyebrow}>Campus Life, Mapped</Text>
          <Text style={styles.title}>MaroonLife helps you see campus life in motion.</Text>
          <Text style={styles.description}>
            Explore places, keep up with events, navigate campus, and find the useful context around where you are going.
          </Text>
        </View>

        <View style={styles.section}>
          {CORE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Pressable key={feature.title} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Icon size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureBody}>{feature.body}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="Continue to Sign In"
          onPress={() => navigation.navigate('AuthLanding')}
          style={styles.primaryButton}
        />
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    contentContainer: {
      paddingHorizontal: 18,
      paddingTop: 72,
      paddingBottom: 140,
      gap: 16,
    },
    heroCard: {
      padding: 24,
      borderRadius: 30,
      backgroundColor: isDark ? 'rgba(18,18,20,0.88)' : 'rgba(255,255,255,0.9)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    },
    heroBadge: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      color: COLORS.primary,
      marginBottom: 8,
    },
    title: {
      fontSize: 30,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.8,
      marginBottom: 10,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: COLORS.textSecondary,
    },
    section: {
      gap: 14,
    },
    featureCard: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.88)',
    },
    featureIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    featureBody: {
      fontSize: 13,
      lineHeight: 19,
      color: isDark ? '#B8B8BE' : COLORS.textSecondary,
    },
    footer: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 26,
    },
    primaryButton: {
      height: 54,
      borderRadius: 18,
    },
  });
