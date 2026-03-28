import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useNavigation, CommonActions, useRoute } from '@react-navigation/native';
import { Search as SearchIcon, ChevronRight, ChevronLeft, ChevronDown, SlidersHorizontal } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { fetchCourses, fetchUserProfile, updateUserProfile } from '../api/client';
import { useTheme } from './SharedUI';

export function NewCourseSearchScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useUser();
    const { returnTo, scheduleId } = route.params || {};
    const [query, setQuery] = useState('');
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [plannerExpanded, setPlannerExpanded] = useState(false);
    const [plannerPreferences, setPlannerPreferences] = useState({
        major: '',
        graduationYear: '',
        preferredTime: 'Morning',
        avoidFriday: false,
        showOnlineFirst: true,
    });

    const handleBackToSchedules = () => {
        const state = navigation.getState();
        const schedIndex = state.routes.findIndex((r: any) => r.name === 'ScheduleList');
        
        if (schedIndex !== -1) {
            navigation.dispatch(
                CommonActions.reset({
                    index: schedIndex,
                    routes: state.routes.slice(0, schedIndex + 1),
                })
            );
        } else {
            const mainRoute = state.routes.find((r: any) => r.name === 'Main') || state.routes[0];
            const currentRoute = state.routes[state.routes.length - 1];
            navigation.dispatch(
                CommonActions.reset({
                    index: 2,
                    routes: [
                        mainRoute,
                        { name: 'ScheduleList', key: `ScheduleList-${Date.now()}` },
                        currentRoute,
                    ],
                })
            );
            setTimeout(() => {
                navigation.goBack();
            }, 0);
        }
    };

    React.useLayoutEffect(() => {
        if (returnTo === 'ScheduleDetail') {
            navigation.setOptions({
                headerLeft: () => (
                    <Pressable
                        onPress={handleBackToSchedules}
                        style={{ marginLeft: 16, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <ChevronLeft size={28} color={COLORS.primary} />
                        <Text style={{ color: COLORS.primary, fontSize: 17, marginLeft: -4, fontWeight: '500' }}>Schedules</Text>
                    </Pressable>
                ),
            });
        } else {
            // Revert back to the native header left (default back arrow) for normal searches
            navigation.setOptions({ headerLeft: undefined });
        }
    }, [navigation, COLORS, returnTo]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (query.trim().length > 0) {
                handleSearch();
            } else if (query.length === 0) {
                setCourses([]);
            }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    useEffect(() => {
        if (!user) return;
        fetchUserProfile(user.id)
            .then((data) => {
                setPlannerPreferences({
                    major: data.major || '',
                    graduationYear: data.graduation_year || '',
                    preferredTime: data.preferred_time || 'Morning',
                    avoidFriday: data.avoid_friday ?? false,
                    showOnlineFirst: data.show_online_first ?? true,
                });
            })
            .catch((error) => console.warn('Failed to load planner preferences:', error));
    }, [user]);

    const savePlannerPreference = async (fields: Record<string, any>) => {
        if (!user) return;
        try {
            await updateUserProfile(user.id, fields);
        } catch (error) {
            console.warn('Failed to save planner preference:', error);
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            let params: any = { dept: query.trim() };

            const res = await fetchCourses(params);
            setCourses(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <Pressable 
            style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('NewCourseDetail', { courseId: item.id, returnTo, scheduleId })}
        >
            <View style={styles.cardContent}>
                <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{item.code.split(' ')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.courseCode}>{item.code}</Text>
                    <Text style={styles.courseName}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.courseCredits}>{item.credits || 3} Credits</Text>
                        {item.prerequisites && (
                            <Text style={styles.coursePrereqs} numberOfLines={1}> • Prereqs: {item.prerequisites}</Text>
                        )}
                    </View>
                </View>
                <ChevronRight color={COLORS.textSecondary} size={20} />
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Search</Text>
                <View style={styles.searchBar}>
                    <SearchIcon color={COLORS.textSecondary} size={20} style={{marginRight: 8}} />
                    <TextInput 
                        style={styles.searchInput} 
                        placeholder="Search courses (e.g. CSCE 110)" 
                        placeholderTextColor={COLORS.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                        autoCorrect={false}
                        autoCapitalize="characters"
                        clearButtonMode="while-editing"
                    />
                </View>

                <Pressable
                    style={styles.plannerToggle}
                    onPress={() => setPlannerExpanded((prev) => !prev)}
                >
                    <View style={styles.plannerToggleLeft}>
                        <SlidersHorizontal size={18} color={COLORS.primary} />
                        <View>
                            <Text style={styles.plannerToggleTitle}>Planner Preferences</Text>
                            <Text style={styles.plannerToggleMeta}>
                                Major and schedule/search preferences now live here.
                            </Text>
                        </View>
                    </View>
                    <ChevronDown
                        size={18}
                        color={COLORS.textSecondary}
                        style={plannerExpanded ? { transform: [{ rotate: '180deg' }] } : undefined}
                    />
                </Pressable>

                {plannerExpanded && (
                    <View style={styles.plannerCard}>
                        <View style={styles.preferenceField}>
                            <Text style={styles.preferenceLabel}>Major</Text>
                            <TextInput
                                style={styles.preferenceInput}
                                placeholder="Set once for course planning"
                                placeholderTextColor={COLORS.textSecondary}
                                value={plannerPreferences.major}
                                onChangeText={(value) =>
                                    setPlannerPreferences((prev) => ({ ...prev, major: value }))
                                }
                                onBlur={() => savePlannerPreference({ major: plannerPreferences.major })}
                            />
                        </View>

                        <View style={styles.preferenceField}>
                            <Text style={styles.preferenceLabel}>Graduation Year</Text>
                            <TextInput
                                style={styles.preferenceInput}
                                placeholder="Optional"
                                placeholderTextColor={COLORS.textSecondary}
                                value={plannerPreferences.graduationYear}
                                onChangeText={(value) =>
                                    setPlannerPreferences((prev) => ({ ...prev, graduationYear: value }))
                                }
                                onBlur={() =>
                                    savePlannerPreference({
                                        graduation_year: plannerPreferences.graduationYear,
                                    })
                                }
                            />
                        </View>

                        <View style={styles.preferenceField}>
                            <Text style={styles.preferenceLabel}>Preferred Time of Day</Text>
                            <View style={styles.preferenceChips}>
                                {['Morning', 'Afternoon', 'Evening', 'No Preference'].map((option) => {
                                    const selected = plannerPreferences.preferredTime === option;
                                    return (
                                        <Pressable
                                            key={option}
                                            style={[styles.preferenceChip, selected && styles.preferenceChipActive]}
                                            onPress={() => {
                                                setPlannerPreferences((prev) => ({
                                                    ...prev,
                                                    preferredTime: option,
                                                }));
                                                savePlannerPreference({ preferred_time: option });
                                            }}
                                        >
                                            <Text style={[styles.preferenceChipText, selected && styles.preferenceChipTextActive]}>
                                                {option}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.preferenceSwitchRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.preferenceSwitchTitle}>Avoid Friday Classes</Text>
                                <Text style={styles.preferenceSwitchMeta}>Keep this in your course-planning flow instead of Settings.</Text>
                            </View>
                            <Switch
                                value={plannerPreferences.avoidFriday}
                                onValueChange={(value) => {
                                    setPlannerPreferences((prev) => ({ ...prev, avoidFriday: value }));
                                    savePlannerPreference({ avoid_friday: value });
                                }}
                                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        <View style={styles.preferenceSwitchRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.preferenceSwitchTitle}>Show Online Courses First</Text>
                                <Text style={styles.preferenceSwitchMeta}>Keep search and scheduler preferences grouped together.</Text>
                            </View>
                            <Switch
                                value={plannerPreferences.showOnlineFirst}
                                onValueChange={(value) => {
                                    setPlannerPreferences((prev) => ({ ...prev, showOnlineFirst: value }));
                                    savePlannerPreference({ show_online_first: value });
                                }}
                                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                )}
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }}/>
            ) : (
                <FlatList 
                    data={courses}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        query.trim().length > 0 ? (
                            <Text style={styles.emptyText}>No courses found matching "{query}".</Text>
                        ) : (
                            <View style={styles.emptyState}>
                                <SearchIcon color={COLORS.border} size={64} style={{marginBottom: 16}} />
                                <Text style={styles.emptyTextTitle}>Find Your Courses, Ag!</Text>
                                <Text style={styles.emptyText}>Type a department code and number to pull instantly from the live TAMU databases. Whoop!</Text>
                            </View>
                        )
                    }
                />
            )}
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: COLORS.background 
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 10,
    },
    title: { 
        fontSize: 34, 
        fontWeight: '800', 
        letterSpacing: -1,
        marginBottom: 16, 
        color: COLORS.textPrimary 
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background, // iOS Search gray
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    plannerToggle: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        gap: 12,
    },
    plannerToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    plannerToggleTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 3,
    },
    plannerToggleMeta: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    plannerCard: {
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        gap: 14,
    },
    preferenceField: {
        gap: 8,
    },
    preferenceLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    preferenceInput: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: COLORS.textPrimary,
        fontSize: 15,
    },
    preferenceChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    preferenceChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: COLORS.surface,
    },
    preferenceChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    preferenceChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    preferenceChipTextActive: {
        color: '#FFFFFF',
    },
    preferenceSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    preferenceSwitchTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    preferenceSwitchMeta: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 17,
    },
    searchInput: { 
        flex: 1,
        fontSize: 17, 
        color: COLORS.textPrimary,
        height: '100%',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
        gap: 12,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    cardPressed: {
        backgroundColor: '#1E1E1E',
        transform: [{scale: 0.98}],
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardBadge: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#2A0000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    cardBadgeText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
    },
    courseCode: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.5,
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    courseName: {
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    courseCredits: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
    },
    coursePrereqs: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FF9F0A',
        flexShrink: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        paddingHorizontal: 32,
    },
    emptyTextTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 15,
        color: COLORS.textSecondary,
        lineHeight: 22,
    }
});
