import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, ExternalLink, MapPinned, Route, TimerReset } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

import { AGGIESPIRIT_TRIP_PLANNER_URL } from '../../config';
import { useTheme } from '../SharedUI';

const plannerCss = `
  body { background: transparent !important; }
  #myride-navbar,
  .fixed-top-area,
  footer,
  #site-message-banner,
  #secondary-navbar,
  #navbar-account,
  .navbar-brand,
  .navbar-nav,
  .nav-slideout-footer {
    display: none !important;
  }
  #body-content {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }
  .container,
  .fill,
  #render-body,
  .panel {
    max-width: none !important;
    width: 100% !important;
    margin: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .panel-heading {
    display: none !important;
  }
  .panel-body {
    padding-top: 0 !important;
  }
`;

function buildInjectedScript(isDark: boolean) {
  const background = isDark ? '#0C0C0F' : '#F6F4EF';
  const surface = isDark ? '#131318' : '#FFFFFF';
  const text = isDark ? '#F5F4EF' : '#101014';
  const subtext = isDark ? '#C8C8D0' : '#5E6068';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)';
  const accent = '#11789A';

  return `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`${plannerCss}
        body, html { background: ${background} !important; color: ${text} !important; }
        .panel { background: ${surface} !important; border-radius: 28px !important; overflow: hidden !important; }
        .panel-body, .input-container { background: ${surface} !important; }
        .trip-label, .option-section-heading, label, h1, h2, h3, h4, h5, p, span, div { color: ${text} !important; }
        .help-block, .form-control-feedback, .subtitle, .text-muted, .trip-planner-subtitle { color: ${subtext} !important; }
        .form-control, .trip-planner-box, select, .input-group-addon {
          background: ${isDark ? '#18181D' : '#FFFFFF'} !important;
          color: ${text} !important;
          border: 1px solid ${border} !important;
          border-radius: 16px !important;
          box-shadow: none !important;
        }
        .btn-primary, .btn-info, .btn-default, .trip-submit, button[type="submit"] {
          background: ${accent} !important;
          border-color: ${accent} !important;
          color: #FFFFFF !important;
          border-radius: 18px !important;
          box-shadow: none !important;
        }
        .radio label, .checkbox label { color: ${text} !important; }
      \`;
      document.head.appendChild(style);
      true;
    })();
  `;
}

export default function TransitTripPlannerScreen({ navigation }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
            Official AggieSpirit trip planning for future, off-campus, and arrival-time routing.
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

      <View style={styles.webCard}>
        <WebView
          source={{ uri: AGGIESPIRIT_TRIP_PLANNER_URL }}
          style={styles.webview}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          originWhitelist={['*']}
          injectedJavaScript={buildInjectedScript(isDark)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          onLoadStart={() => {
            setLoading(true);
            setLoadError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={(event) => {
            setLoadError(event.nativeEvent.description || 'Could not load the official trip planner.');
            setLoading(false);
          }}
          renderLoading={() => (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading AggieSpirit planner…</Text>
            </View>
          )}
        />

        {loadError ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Planner unavailable</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <Pressable style={styles.reloadButton} onPress={() => navigation.replace('TransitTripPlanner')}>
              <ExternalLink size={15} color="#FFFFFF" />
              <Text style={styles.reloadText}>Reload planner</Text>
            </Pressable>
          </View>
        ) : null}
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
    webCard: {
      flex: 1,
      marginHorizontal: 18,
      marginBottom: 18,
      overflow: 'hidden',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? '#131318' : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.26 : 0.08,
      shadowRadius: 18,
      elevation: 10,
    },
    webview: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    loadingState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? '#131318' : '#FFFFFF',
    },
    loadingText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    errorOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(255,255,255,0.94)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 10,
    },
    errorTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    errorBody: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    reloadButton: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
    },
    reloadText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
  });
