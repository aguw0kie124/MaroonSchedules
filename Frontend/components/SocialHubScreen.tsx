import React, { useState, useCallback } from 'react';
import {
    View, StyleSheet, StatusBar, ImageBackground
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { useDiningTheme } from './dining/DiningTheme';
import { CampusFeedScreen } from './CampusFeedScreen';
import { ReelsScreen } from './ReelsScreen';
import { ChannelListScreen } from './ChannelListScreen';
import { EventsCalendarScreen } from './EventsCalendarScreen';
import { Home, Film, MessageCircle, CalendarDays } from 'lucide-react-native';
import { PillTabs } from './PillTabs';

const TABS = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'events', label: 'Events', Icon: CalendarDays },
    { key: 'reels', label: 'Reels', Icon: Film },
    { key: 'messages', label: 'Messages', Icon: MessageCircle },
] as const;

type TabKey = typeof TABS[number]['key'];

export function SocialHubScreen() {
    const { COLORS, theme, useWallpaper } = useTheme();
    const isFocused = useIsFocused();
    const isDark = theme === 'dark';
    const T = useDiningTheme(isDark);
    const styles = getStyles(COLORS, T);
    const [activeTab, setActiveTab] = useState<TabKey>('home');

    const switchTab = useCallback((tab: TabKey) => {
        setActiveTab(tab);
    }, []);

    const renderPillBar = (floating: boolean) => (
        <View style={floating ? styles.floatingPillBar : styles.pillBarWrapper}>
            <PillTabs
                items={TABS.map(tab => ({ key: tab.key, label: tab.label, icon: tab.Icon }))}
                activeKey={activeTab}
                onChange={(key) => switchTab(key as TabKey)}
                floating={floating}
                compact={false}
                activeTextMode="active-only"
                layout="stacked"
            />
        </View>
    );

    // Reels: fullscreen with floating pill bar
    if (activeTab === 'reels') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <ReelsScreen mediaActive={isFocused && activeTab === 'reels'} />
                {renderPillBar(true)}
            </View>
        );
    }

    const marbleSrc = isDark
        ? require('../assets/black_marble.jpg')
        : require('../assets/white_marble.jpg');

    return (
        <View style={[styles.container, useWallpaper && { backgroundColor: '#000' }]}>
            <StatusBar barStyle={T.statusBar as any} />

            {useWallpaper && (
                <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
                    <View style={[StyleSheet.absoluteFill, {
                        backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.45)',
                    }]} />
                </ImageBackground>
            )}

            {/* Header — pill bar only, no title text */}
            <View style={useWallpaper ? [styles.header, { backgroundColor: 'transparent' }] : styles.header}>
                {renderPillBar(false)}
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'home' && <CampusFeedScreen embedded={true} />}
                {activeTab === 'events' && <EventsCalendarScreen />}
                {activeTab === 'messages' && <ChannelListScreen embedded={true} />}
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
        backgroundColor: T.bg,
        paddingTop: 54,
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: T.border,
    },
    pillBarWrapper: {},
    floatingPillBar: {
        position: 'absolute',
        top: 54,
        left: 20,
        right: 20,
        zIndex: 200,
    },
    content: {
        flex: 1,
    },
});
