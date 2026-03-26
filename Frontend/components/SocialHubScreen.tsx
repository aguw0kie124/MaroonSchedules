import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, Animated, Dimensions, StatusBar
} from 'react-native';
import { useTheme } from './SharedUI';
import { CampusFeedScreen } from './CampusFeedScreen';
import { ReelsScreen } from './ReelsScreen';
import { ChannelListScreen } from './ChannelListScreen';
import { Home, Film, MessageCircle } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'reels', label: 'Reels', Icon: Film },
    { key: 'messages', label: 'Messages', Icon: MessageCircle },
] as const;

type TabKey = typeof TABS[number]['key'];

export function SocialHubScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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
        inputRange: [0, 1, 2],
        outputRange: [0, pillWidth, pillWidth * 2],
    });

    // Render full-screen for Reels (no header/pill bar)
    if (activeTab === 'reels') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <ReelsScreen />
                {/* Floating pill bar over reels */}
                <View style={styles.floatingPillBar}>
                    <View style={styles.pillBarInner}>
                        <Animated.View style={[styles.pillIndicator, { width: pillWidth - 8, transform: [{ translateX }] }]} />
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
                                        color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
                                        strokeWidth={isActive ? 2.5 : 2}
                                    />
                                    <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
                                        {tab.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {/* Header with pill bar */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Social</Text>
                <View style={styles.pillBar}>
                    <Animated.View style={[styles.pillIndicator, { width: pillWidth - 8, transform: [{ translateX }] }]} />
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
                                    color={isActive ? '#FFFFFF' : COLORS.textTertiary}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
                                    {tab.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'home' && <CampusFeedScreen embedded={true} />}
                {activeTab === 'messages' && <ChannelListScreen embedded={true} />}
            </View>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.background,
        paddingTop: 54,
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 14,
    },
    pillBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.surfaceElevated || '#111111',
        borderRadius: 16,
        padding: 4,
        position: 'relative',
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
        borderRadius: 16,
        padding: 4,
        position: 'relative',
    },
    pillIndicator: {
        position: 'absolute',
        top: 4,
        left: 4,
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 12,
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
        color: COLORS.textTertiary,
    },
    pillLabelActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
});
