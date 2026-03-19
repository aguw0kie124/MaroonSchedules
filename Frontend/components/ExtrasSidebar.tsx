import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback, Animated, Dimensions, Pressable } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useUser, SignedIn } from '@clerk/clerk-expo';
import { Map, MessageSquare, MapPin, X, ChevronRight } from 'lucide-react-native';
import { COLORS } from './SharedUI';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.85;

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
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>The Aggie Map</Text>
                            <Text style={styles.headerSubtitle}>Aggieland's One Stop Shop</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X color={COLORS.textPrimary} size={22} />
                        </Pressable>
                    </View>
                    
                    <View style={styles.divider} />
                    
                    <View style={styles.menuList}>
                        <MenuButton icon={<Map color={COLORS.primary} size={22} />} label="Campus Traffic Map" onPress={() => navigateTo('CampusMap')} />
                        <MenuButton icon={<MapPin color={COLORS.primary} size={22} />} label="Location Traffic Search" onPress={() => navigateTo('LocationSearch')} />
                        <MenuButton icon={<MessageSquare color={COLORS.primary} size={22} />} label="Message Users" onPress={() => navigateTo('UsersScreen')} />
                    </View>

                    <View style={{flex: 1}} />
                    
                    <SignedIn>
                        <View style={styles.footer}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{user?.firstName?.[0] || 'A'}</Text>
                            </View>
                            <View>
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

function MenuButton({ icon, label, onPress }: any) {
    return (
        <Pressable style={({pressed}) => [styles.menuButton, pressed && styles.menuButtonPressed]} onPress={onPress}>
            <View style={styles.menuIconBox}>{icon}</View>
            <Text style={styles.menuLabel}>{label}</Text>
            <ChevronRight color={COLORS.textSecondary} size={20} />
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
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawer: {
        width: DRAWER_WIDTH,
        height: '100%',
        backgroundColor: COLORS.surface, // Slick dark gray
        shadowColor: COLORS.primary,
        shadowOffset: { width: 10, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 24,
        backgroundColor: COLORS.surface,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
    },
    menuList: {
        padding: 20,
        gap: 12,
    },
    menuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 2,
    },
    menuButtonPressed: {
        transform: [{scale: 0.98}],
        backgroundColor: '#1E1E1E',
    },
    menuIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#2A0000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        paddingBottom: 48,
        backgroundColor: COLORS.background, // Match absolute black
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: 16,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    footerName: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    footerEmail: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginTop: 2,
    }
});
