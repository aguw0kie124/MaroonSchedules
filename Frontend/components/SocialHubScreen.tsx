import React, { useCallback, useState } from 'react';
import {
  ImageBackground,
  LayoutAnimation,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from './SharedUI';
import { useDiningTheme } from './dining/DiningTheme';
import { CampusFeedScreen } from './CampusFeedScreen';
import { ReelsScreen } from './ReelsScreen';
import { ChannelListScreen } from './ChannelListScreen';
import { Home, Film, MessageCircle, ChevronLeft, Minimize2 } from 'lucide-react-native';
import { PillTabs } from './PillTabs';

const TABS = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'reels', label: 'Reels', Icon: Film },
  { key: 'messages', label: 'Messages', Icon: MessageCircle },
] as const;

type TabKey = typeof TABS[number]['key'];

export function SocialHubScreen() {
  const { COLORS, theme, useWallpaper, wallpaperUri } = useTheme();
  const isDark = theme === 'dark';
  const T = useDiningTheme(isDark);
  const styles = getStyles(COLORS, T);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [isReelsImmersive, setIsReelsImmersive] = useState(true);

  const switchTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const renderPillBar = (floating: boolean) => (
    <View style={floating ? styles.floatingHeaderRow : styles.headerRow}>
      <PillTabs
        items={TABS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.Icon }))}
        activeKey={activeTab}
        onChange={(key) => switchTab(key as TabKey)}
        floating={floating}
        compact={false}
        activeTextMode="active-only"
        layout="stacked"
      />
    </View>
  );

  if (activeTab === 'reels') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ReelsScreen embedded={!isReelsImmersive} immersive={isReelsImmersive} />
        {isReelsImmersive ? (
          <View style={styles.floatingReelsHeaderCompact}>
            <Pressable
              style={styles.reelsBackButton}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsReelsImmersive(false);
              }}
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.floatingReelsHeaderRow}>
            <Pressable
              style={styles.reelsMinimizeButton}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsReelsImmersive(true);
              }}
            >
              <Minimize2 size={18} color="#FFFFFF" />
            </Pressable>
            <View style={styles.floatingPillBarWrap}>{renderPillBar(true)}</View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={T.statusBar as any} />
      {useWallpaper && wallpaperUri ? (
        <ImageBackground source={{ uri: wallpaperUri }} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.18)' },
            ]}
          />
        </ImageBackground>
      ) : null}

      <View style={styles.header}>{renderPillBar(false)}</View>

      <View style={styles.content}>
        <View style={styles.contentFrame}>
          {activeTab === 'home' && <CampusFeedScreen embedded={true} />}
          {activeTab === 'messages' && <ChannelListScreen embedded={true} />}
        </View>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, T: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    backgroundColor: 'transparent',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingHeaderRow: {
    flex: 1,
  },
  floatingReelsHeaderRow: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingReelsHeaderCompact: {
    position: 'absolute',
    top: 54,
    left: 16,
    zIndex: 220,
  },
  floatingPillBarWrap: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 112,
  },
  contentFrame: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 28,
    overflow: 'hidden',
  },
  reelsBackButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,12,14,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reelsMinimizeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,12,14,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
