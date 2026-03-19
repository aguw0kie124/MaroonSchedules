import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SectionRow, COLORS, useSavedStore, Card } from './SharedUI';

export function Saved() {
    const { savedSections, loadSaved } = useSavedStore();

    useEffect(() => {
        loadSaved();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Saved for Later</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {savedSections.length > 0 ? (
                    savedSections.map((sec: any) => (
                        <SectionRow 
                            key={`saved-${sec.id}`}
                            section={sec}
                        />
                    ))
                ) : (
                    <Card style={{marginTop: 20}}>
                        <Text style={styles.emptyText}>
                            No courses bookmarked yet! BTHO registration by tapping the Bookmark icon on any active section to pin it here. Whoop!
                        </Text>
                    </Card>
                )}
                <View style={{ height: 100 }} />
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
        padding: 16,
        paddingTop: 60,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        marginBottom: 16,
        zIndex: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
        color: COLORS.textPrimary,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        padding: 16,
        fontSize: 15,
        lineHeight: 22,
    },
});
