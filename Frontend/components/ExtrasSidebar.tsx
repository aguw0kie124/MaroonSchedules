import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback, Animated, Dimensions, Pressable, ScrollView } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useUser, SignedIn } from '@clerk/clerk-expo';
import { Map, MessageSquare, MapPin, X, ChevronRight, Navigation, Sparkles, Calendar, Heart, Radio, Compass, TrendingUp, GraduationCap } from 'lucide-react-native';
import { COLORS } from './SharedUI';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.85;

// Lighter maroon for icon backgrounds — high contrast
const ICON_BG = '#3D0000';
const ICON_COLOR = '#FF8A8A'; // Bright maroon tint for icons

export function ExtrasSidebar({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { user } = useUser();
    const navigation = useNavigation<any>();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (open) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 60,
                    friction: 10,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [open]);

    const navigateTo = (screen: string) => {
        onClose();
        setTimeout(() => navigation.navigate(screen), 150);
    };

    // Bypass the TS inference bug by casting to an explicit object structure
    const currentFadeValue = (fadeAnim as unknown as { _value: number })._value;
    if (!open && currentFadeValue === 0) return null;

    return (
        <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlayContainer}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                </TouchableWithoutFeedback>
                <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.logoRow}>
                                <View style={styles.logoBadge}>
                                    <Compass color="#FFF" size={20} />
                                </View>
                                <View>
                                    <Text style={styles.headerTitle}>The Aggie Map</Text>
                                    <Text style={styles.headerSubtitle}>Your campus companion</Text>
                                </View>
                            </View>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <X color="#FFF" size={18} />
                            </Pressable>
                        </View>
                    </View>

                    <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                        {/* Navigate Section */}
                        <Text style={styles.sectionLabel}>EXPLORE</Text>
                        <View style={styles.menuGroup}>
                            <MenuButton
                                icon={<Navigation color={ICON_COLOR} size={20} />}
                                label="Campus Navigation"
                                subtitle="Walking directions & voice nav"
                                onPress={() => navigateTo('CampusNavigation')}
                            />
                            <View style={styles.menuDivider} />
                            <MenuButton
                                icon={<Sparkles color={ICON_COLOR} size={20} />}
                                label="Find a Spot"
                                subtitle="AI-powered place recommendations"
                                onPress={() => navigateTo('PlaceRecommendations')}
                                badge="AI"
                            />
                            <View style={styles.menuDivider} />
                            <MenuButton
                                icon={<Heart color={ICON_COLOR} size={20} />}
                                label="For You"
                                subtitle="Personalized campus feed"
                                onPress={() => navigateTo('ForYou')}
                            />
                        </View>

                        {/* Campus Life Section */}
                        <Text style={styles.sectionLabel}>CAMPUS LIFE</Text>
                        <View style={styles.menuGroup}>
                            <MenuButton
                                icon={<Calendar color={ICON_COLOR} size={20} />}
                                label="Events Calendar"
                                subtitle="Live TAMU events & activities"
                                onPress={() => navigateTo('EventsCalendar')}
                            />
                            <View style={styles.menuDivider} />
                            <MenuButton
                                icon={<Radio color={ICON_COLOR} size={20} />}
                                label="CrowdPing"
                                subtitle="Crowdsourced campus vibes"
                                onPress={() => navigateTo('CrowdPing')}
                                badge="LIVE"
                            />
                        </View>

                        {/* Data Section */}
                        <Text style={styles.sectionLabel}>TRAFFIC DATA</Text>
                        <View style={styles.menuGroup}>
                            <MenuButton
                                icon={<Map color={ICON_COLOR} size={20} />}
                                label="Traffic Map"
                                subtitle="Campus-wide occupancy heatmap"
                                onPress={() => navigateTo('CampusMap')}
                            />
                            <View style={styles.menuDivider} />
                            <MenuButton
                                icon={<TrendingUp color={ICON_COLOR} size={20} />}
                                label="Location Search"
                                subtitle="Search specific building stats"
                                onPress={() => navigateTo('LocationSearch')}
                            />
                        </View>

                        {/* Academics Section */}
                        <Text style={styles.sectionLabel}>ACADEMICS</Text>
                        <View style={styles.menuGroup}>
                            <MenuButton
                                icon={<GraduationCap color={ICON_COLOR} size={20} />}
                                label="GPA Calculator"
                                subtitle="Calculate your semester GPA"
                                onPress={() => navigateTo('GPACalculator')}
                            />
                        </View>

                        {/* Social Section */}
                        <Text style={styles.sectionLabel}>SOCIAL</Text>
                        <View style={styles.menuGroup}>
                            <MenuButton
                                icon={<MessageSquare color={ICON_COLOR} size={20} />}
                                label="Messages"
                                subtitle="Chat with other Aggies"
                                onPress={() => navigateTo('UsersScreen')}
                            />
                        </View>

                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Footer */}
                    <SignedIn>
                        <View style={styles.footer}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{user?.firstName?.[0] || 'A'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.footerName}>{user?.fullName || 'Aggie User'}</Text>
                                <Text style={styles.footerEmail}>Signed in</Text>
                            </View>
                        </View>
                    </SignedIn>
                </Animated.View>
            </View>
        </Modal>
    );
}

function MenuButton({ icon, label, subtitle, onPress, badge }: any) {
    return (
        <Pressable style={({pressed}) => [styles.menuButton, pressed && styles.menuButtonPressed]} onPress={onPress}>
            <View style={styles.menuIconBox}>{icon}</View>
            <View style={styles.menuTextCol}>
                <View style={styles.menuLabelRow}>
                    <Text style={styles.menuLabel}>{label}</Text>
                    {badge && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge}</Text>
                        </View>
                    )}
                </View>
                {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
            </View>
            <ChevronRight color="rgba(255,255,255,0.3)" size={16} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    drawer: {
        width: DRAWER_WIDTH,
        height: '100%',
        backgroundColor: '#0A0A0A',
        shadowColor: '#000',
        shadowOffset: { width: 10, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 24,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 24,
        backgroundColor: COLORS.primary,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    logoBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
    },
    scrollArea: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: 1.2,
        marginTop: 24,
        marginBottom: 10,
        marginLeft: 4,
    },
    menuGroup: {
        backgroundColor: '#141414',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1F1F1F',
        overflow: 'hidden',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#1F1F1F',
        marginLeft: 60,
    },
    menuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    menuButtonPressed: {
        backgroundColor: '#1A1A1A',
    },
    menuIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: ICON_BG,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    menuTextCol: {
        flex: 1,
    },
    menuLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    menuSubtitle: {
        fontSize: 12,
        fontWeight: '400',
        color: 'rgba(255,255,255,0.45)',
        marginTop: 2,
    },
    badge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 44,
        backgroundColor: '#0A0A0A',
        borderTopWidth: 1,
        borderTopColor: '#1F1F1F',
        gap: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    avatarText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    footerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    footerEmail: {
        fontSize: 13,
        fontWeight: '400',
        color: 'rgba(255,255,255,0.45)',
        marginTop: 1,
    },
});
