import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Share,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Instagram, Link as LinkIcon, MoreHorizontal, Phone } from 'lucide-react-native';

import { useTheme } from './SharedUI';
import { useShareStore } from '../store/shareStore';
import { ScalePressable } from './common/Motion';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SOCIAL_APPS = [
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', icon: Phone },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', icon: Instagram },
  { id: 'copy', name: 'Copy Link', color: '#8E8E93', icon: LinkIcon },
  { id: 'more', name: 'More', color: '#3A3A3C', icon: MoreHorizontal },
] as const;

function buildShareMessage(content: { title?: string; message?: string; url?: string }) {
  return `${content.title ? `${content.title}\n` : ''}${content.message || ''}${content.url ? `\n\n${content.url}` : ''}`.trim();
}

export function ShareOverlay() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const { isVisible, content, closeShare } = useShareStore();

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVisible, opacityAnim, slideAnim]);

  const shareMessage = useMemo(() => (content ? buildShareMessage(content) : ''), [content]);

  const handleSystemShare = async () => {
    if (!content) return;
    try {
      await Share.share(
        {
          title: content.title,
          message: shareMessage,
          url: content.url,
        },
        {
          dialogTitle: content.title,
          subject: content.subject,
        },
      );
    } catch (error) {
      console.error('System share failed', error);
    } finally {
      closeShare();
    }
  };

  const handleAppShare = async (appId: (typeof SOCIAL_APPS)[number]['id']) => {
    if (!content) return;

    try {
      if (appId === 'copy') {
        Haptics.selectionAsync().catch(() => {});
        await handleSystemShare();
        return;
      }

      if (appId === 'more') {
        await handleSystemShare();
        return;
      }

      if (appId === 'whatsapp') {
        const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          closeShare();
          return;
        }
      }

      if (appId === 'instagram') {
        const supported = await Linking.canOpenURL('instagram://');
        if (supported) {
          await Linking.openURL('instagram://');
          closeShare();
          return;
        }
      }

      await handleSystemShare();
    } catch (error) {
      console.error('Share action failed', error);
      await handleSystemShare();
    }
  };

  if (!isVisible || !content) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.overlay, { opacity: opacityAnim }]}>
      <TouchableWithoutFeedback onPress={closeShare}>
        <View style={styles.dismissArea} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheetWrap,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: isDark ? 'rgba(20, 20, 22, 0.94)' : 'rgba(255,255,255,0.94)' },
          ]}
        >
          <BlurView
            intensity={isDark ? 36 : 52}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <Text style={[styles.title, { color: COLORS.textPrimary }]}>Share</Text>
            {(content.title || content.message) ? (
              <Text style={[styles.subtitle, { color: COLORS.textSecondary }]} numberOfLines={2}>
                {content.title || content.message}
              </Text>
            ) : null}
          </View>

          <View style={styles.appsRow}>
            {SOCIAL_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <ScalePressable key={app.id} style={styles.appItem} onPress={() => handleAppShare(app.id)}>
                  <View style={[styles.appIcon, { backgroundColor: app.color }]}>
                    <Icon size={22} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.appName, { color: COLORS.textPrimary }]}>{app.name}</Text>
                </ScalePressable>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  dismissArea: {
    flex: 1,
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    minHeight: 250,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dragHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(140,140,140,0.35)',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  appsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  appItem: {
    flex: 1,
    alignItems: 'center',
  },
  appIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
