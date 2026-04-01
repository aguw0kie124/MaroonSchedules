import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Share,
  Clipboard,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { 
  X,
  Link as LinkIcon, 
  MoreHorizontal, 
  Instagram, 
  Phone,
} from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { useShareStore } from '../store/shareStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const SOCIAL_APPS = [
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', Icon: Phone, scheme: 'whatsapp://send' },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', Icon: Instagram, scheme: 'instagram://' },
  { id: 'copy', name: 'Copy Link', color: '#8E8E93', Icon: LinkIcon },
  { id: 'more', name: 'More', color: '#3A3A3C', Icon: MoreHorizontal },
];

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
          toValue: SCREEN_HEIGHT * 0.2,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const handleAppShare = async (app: typeof SOCIAL_APPS[0]) => {
    if (!content) return;
    const shareText = `${content.title ? content.title + '\n' : ''}${content.message || ''}\n${content.url || ''}`;

    if (app.id === 'copy') {
      Clipboard.setString(content.url || shareText);
      // Optional: show toast
      return;
    }

    if (app.id === 'more') {
      try {
        await Share.share({
          title: content.title,
          message: shareText,
          url: content.url,
        });
      } catch (error) {
        console.error('System share failed', error);
      }
      return;
    }

    if (app.scheme) {
      const url = app.id === 'whatsapp'
        ? `whatsapp://send?text=${encodeURIComponent(shareText)}`
        : app.scheme; // Instagram doesn't support direct text pre-fill easily without complex API

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to system share
        await Share.share({ message: shareText });
      }
    }
  };

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
      <TouchableOpacity 
        style={styles.dismissArea} 
        activeOpacity={1} 
        onPress={closeShare} 
      />
      
      <Animated.View style={[
        styles.sheet, 
        { 
          transform: [{ translateY: slideAnim }],
          backgroundColor: isDark ? 'rgba(28, 28, 30, 0.94)' : 'rgba(255, 255, 255, 0.94)' 
        }
      ]}>
        <BlurView intensity={isDark ? 40 : 60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <Text style={[styles.title, { color: COLORS.textPrimary }]}>Share</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Share to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.appsRow}>
            {SOCIAL_APPS.map((app) => (
              <TouchableOpacity 
                key={app.id} 
                style={styles.appItem}
                onPress={() => handleAppShare(app)}
              >
                <View style={[styles.appIcon, { backgroundColor: app.color }]}>
                  <app.Icon size={24} color="#FFF" />
                </View>
                <Text style={[styles.appName, { color: COLORS.textPrimary }]}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ height: 48 }} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9999,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.8,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  appsRow: {
    paddingLeft: 16,
    marginBottom: 10,
  },
  appItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  appName: {
    fontSize: 11,
    textAlign: 'center',
  },
});
