import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, Animated, Dimensions, StatusBar, ImageBackground
} from 'react-native';
import { useTheme } from './SharedUI';
import { useDiningTheme } from './dining/DiningTheme';
import { CampusFeedScreen } from './CampusFeedScreen';
import { ReelsScreen } from './ReelsScreen';
import { ChannelListScreen } from './ChannelListScreen';
import { EventsCalendarScreen } from './EventsCalendarScreen';
import { Home, Film, MessageCircle, CalendarDays } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'events', label: 'Events', Icon: CalendarDays },
    { key: 'reels', label: 'Reels', Icon: Film },
    { key: 'messages', label: 'Messages', Icon: MessageCircle },
] as const;

type TabKey = typeof TABS[number]['key'];

export function SocialHubScreen() {
    const { COLORS, theme, useWallpaper } = useTheme();
    const isDark = theme === 'dark';
    const T = useDiningTheme(isDark);
    const styles = getStyles(COLORS, T);
    const [activeTab, setActiveTab] = useState<TabKey>('home');
    const indicatorAnim = useRef(new Animated.Value(0)).current;

    const switchTab = useCallback((tab: TabKey) => {
        const idx = TABS.findIndex(t => t.key === tab);
        Animated.spring(indicatorAnim, {
            toValue: idx,
            useNativeDriver: true,
            tension: 300,
            friction: 30,
        }).start();
        setActiveTab(tab);
    }, [indicatorAnim]);

    const pillWidth = (SCREEN_WIDTH - 40) / TABS.length;
    const translateX = indicatorAnim.interpolate({
        inputRange: [0, 1, 2, 3],
        outputRange: [0, pillWidth, pillWidth * 2, pillWidth * 3],
    });

    const renderPillBar = (floating: boolean) => (
        <View style={floating ? styles.floatingPillBar : styles.pillBarWrapper}>
            <View style={floating ? styles.pillBarInner : styles.pillBar}>
                <Animated.View
                    style={[
                        styles.pillIndicator,
                        { width: pillWidth - 8, transform: [{ translateX }] },
                    ]}
                />
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            style={styles.pillTab}
                            onPress={() => switchTab(tab.key)}
                        >
                            <tab.Icon
                                size={16}
                                color={isActive ? '#FFFFFF' : (floating ? 'rgba(255,255,255,0.55)' : T.text3)}
                                strokeWidth={isActive ? 2.5 : 2}
                            />
                            <Text
                                style={[
                                    styles.pillLabel,
                                    isActive && styles.pillLabelActive,
                                    floating && !isActive && { color: 'rgba(255,255,255,0.55)' },
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );

    // Reels: fullscreen with floating pill bar
    if (activeTab === 'reels') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <ReelsScreen />
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
    /* ── Pill bars ── */
    pillBarWrapper: {},
    pillBar: {
        flexDirection: 'row',
        backgroundColor: T.card,
        borderRadius: 32,
        padding: 4,
        position: 'relative',
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    floatingPillBar: {
        position: 'absolute',
        top: 54,
        left: 20,
        right: 20,
        zIndex: 200,
    },
    pillBarInner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 32,
        padding: 4,
        position: 'relative',
    },
    pillIndicator: {
        position: 'absolute',
        top: 4,
        left: 4,
        height: '100%',
        backgroundColor: T.tamuMaroon,
        borderRadius: 26,
    },
    pillTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
        zIndex: 1,
    },
    pillLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: T.text3,
    },
    pillLabelActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
});
