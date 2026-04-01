import React, { useState, useCallback } from 'react';
import {
    View, StyleSheet, StatusBar, ImageBackground, Pressable, LayoutAnimation
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { useDiningTheme } from './dining/DiningTheme';
import { CampusFeedScreen } from './CampusFeedScreen';
import { ReelsScreen } from './ReelsScreen';
import { ChannelListScreen } from './ChannelListScreen';
import { Home, Film, MessageCircle, ChevronLeft, Minimize2 } from 'lucide-react-native';
import { PillTabs } from './PillTabs';
import { PageModuleEditor } from './PageModuleEditor';
import { getOrderedItems, useAppShellStore } from '../store/appShellStore';

const TABS = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'reels', label: 'Reels', Icon: Film },
    { key: 'messages', label: 'Messages', Icon: MessageCircle },
] as const;

type TabKey = typeof TABS[number]['key'];

export function SocialHubScreen() {
    const { COLORS, theme, useWallpaper, wallpaperUri } = useTheme();
    const isFocused = useIsFocused();
    const isDark = theme === 'dark';
    const T = useDiningTheme(isDark);
    const styles = getStyles(COLORS, T);
    const socialTabs = useAppShellStore((state) => state.socialTabs);
    const moveSocialTab = useAppShellStore((state) => state.moveSocialTab);
    const toggleSocialTab = useAppShellStore((state) => state.toggleSocialTab);
    const setBottomBarHidden = useAppShellStore((state) => state.setBottomBarHidden);
    const orderedTabs = React.useMemo(
        () => getOrderedItems(socialTabs).filter((item) => item.id !== 'events'),
        [socialTabs],
    );
    const visibleTabs = orderedTabs
        .filter((item) => item.visible)
        .map(item => TABS.find(tab => tab.key === item.id))
        .filter(Boolean) as typeof TABS[number][];
    const firstTab = (visibleTabs[0]?.key || 'home') as TabKey;
    const [activeTab, setActiveTab] = useState<TabKey>(firstTab);
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [isReelsImmersive, setIsReelsImmersive] = useState(true);
    const wallpaperSource = wallpaperUri
        ? { uri: wallpaperUri }
        : isDark
            ? require('../assets/black_marble.jpg')
            : require('../assets/white_marble.jpg');

    React.useEffect(() => {
        if (!visibleTabs.some(tab => tab.key === activeTab)) {
            setActiveTab(firstTab);
        }
    }, [activeTab, firstTab, visibleTabs]);

    React.useEffect(() => {
        if (activeTab === 'reels') {
            setIsReelsImmersive(true);
        }
    }, [activeTab]);

    React.useEffect(() => {
        const shouldHideBottomBar = isFocused && activeTab === 'reels' && isReelsImmersive;
        setBottomBarHidden(shouldHideBottomBar);
        return () => setBottomBarHidden(false);
    }, [activeTab, isFocused, isReelsImmersive, setBottomBarHidden]);

    const switchTab = useCallback((tab: TabKey) => {
        setActiveTab(tab);
    }, []);

    const renderPillBar = (floating: boolean) => (
        <View style={floating ? styles.floatingHeaderRow : styles.headerRow}>
            <PillTabs
                items={visibleTabs.map(tab => ({ key: tab.key, label: tab.label, icon: tab.Icon }))}
                activeKey={activeTab}
                onChange={(key) => {
                    switchTab(key as TabKey);
                }}
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
                <ReelsScreen
                    mediaActive={isFocused && activeTab === 'reels'}
                    embedded={!isReelsImmersive}
                    immersive={isReelsImmersive}
                />
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
                        <View style={styles.floatingPillBarWrap}>
                            {visibleTabs.length > 0 ? renderPillBar(true) : null}
                        </View>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={T.statusBar as any} />
            {useWallpaper ? (
                <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.18)' },
                        ]}
                    />
                </ImageBackground>
            ) : null}

            {/* Header — pill bar only, no title text */}
            <View style={styles.header}>
                {visibleTabs.length > 0 ? renderPillBar(false) : null}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.contentFrame}>
                    {activeTab === 'home' && <CampusFeedScreen embedded={true} />}
                    {activeTab === 'messages' && <ChannelListScreen embedded={true} />}
                </View>
            </View>

            <PageModuleEditor
                visible={isEditorVisible}
                onClose={() => setIsEditorVisible(false)}
                title="Social"
                items={orderedTabs}
                onToggle={toggleSocialTab}
                onMove={moveSocialTab}
            />
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
    pillBarWrapper: {},
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
