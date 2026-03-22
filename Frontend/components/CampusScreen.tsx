import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Map, MessageSquare, Sparkles, Calendar, Heart, Rss, Navigation, TrendingUp, GraduationCap, ChevronRight, Compass } from 'lucide-react-native';
import { COLORS } from './SharedUI';

const { width } = Dimensions.get('window');

const ICON_BG = '#3D0000';
const ICON_COLOR = '#FF8A8A';

export function CampusScreen() {
    const navigation = useNavigation<any>();

    const menuItems = [
        {
            title: 'EXPLORE',
            items: [
                { id: 'CampusNavigation', label: 'Campus Navigation', subtitle: 'Walking directions & voice nav', icon: <Navigation color={ICON_COLOR} size={22} /> },
                { id: 'PlaceRecommendations', label: 'Find a Spot', subtitle: 'AI-powered place recommendations', icon: <Sparkles color={ICON_COLOR} size={22} />, badge: 'AI' },
                { id: 'ForYou', label: 'For You', subtitle: 'Personalized campus feed', icon: <Heart color={ICON_COLOR} size={22} /> },
            ]
        },
        {
            title: 'CAMPUS LIFE',
            items: [
                { id: 'EventsCalendar', label: 'Events Calendar', subtitle: 'Live TAMU events & activities', icon: <Calendar color={ICON_COLOR} size={22} /> },
                { id: 'CampusFeed', label: 'Campus Feed', subtitle: 'Photos, videos, and updates from campus', icon: <Rss color={ICON_COLOR} size={22} />, badge: 'LIVE' },
            ]
        },
        {
            title: 'TRAFFIC DATA',
            items: [
                { id: 'CampusMap', label: 'Traffic Map', subtitle: 'Campus-wide occupancy heatmap', icon: <Map color={ICON_COLOR} size={22} /> },
                { id: 'LocationSearch', label: 'Location Search', subtitle: 'Search specific building stats', icon: <TrendingUp color={ICON_COLOR} size={22} /> },
            ]
        },
        {
            title: 'ACADEMICS',
            items: [
                { id: 'GPACalculator', label: 'GPA Calculator', subtitle: 'Calculate your semester GPA', icon: <GraduationCap color={ICON_COLOR} size={22} /> },
            ]
        }
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.logoBadge}>
                        <Compass color="#FFF" size={24} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Campus Hub</Text>
                        <Text style={styles.headerSubtitle}>Explore Texas A&M</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {menuItems.map((section, idx) => (
                    <View key={idx} style={styles.section}>
                        <Text style={styles.sectionLabel}>{section.title}</Text>
                        <View style={styles.menuGroup}>
                            {section.items.map((item, itemIdx) => (
                                <View key={item.id}>
                                    <Pressable 
                                        style={({pressed}) => [styles.menuButton, pressed && styles.menuButtonPressed]} 
                                        onPress={() => navigation.navigate(item.id)}
                                    >
                                        <View style={styles.menuIconBox}>{item.icon}</View>
                                        <View style={styles.menuTextCol}>
                                            <View style={styles.menuLabelRow}>
                                                <Text style={styles.menuLabel}>{item.label}</Text>
                                                {item.badge && (
                                                    <View style={styles.badge}>
                                                        <Text style={styles.badgeText}>{item.badge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                        </View>
                                        <ChevronRight color="rgba(255,255,255,0.2)" size={18} />
                                    </Pressable>
                                    {itemIdx < section.items.length - 1 && <View style={styles.menuDivider} />}
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 24,
        backgroundColor: COLORS.primary,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    logoBadge: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    scrollArea: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 24,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    menuGroup: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    menuDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginLeft: 68,
    },
    menuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
    },
    menuButtonPressed: {
        backgroundColor: COLORS.surfaceElevated,
    },
    menuIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: ICON_BG,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    menuTextCol: {
        flex: 1,
    },
    menuLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    menuLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    menuSubtitle: {
        fontSize: 13,
        color: COLORS.textTertiary,
        marginTop: 4,
        lineHeight: 18,
    },
    badge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#FFF',
    },
});
