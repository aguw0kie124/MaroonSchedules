import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GraduationCap } from 'lucide-react-native';
import { Button } from './Button';

const COLORS = {
    background: '#F5F5F7',
    primary: '#500000',
    textSecondary: '#666',
};

export function Onboarding() {
    const navigation = useNavigation<any>();

    return (
        <View style={styles.container}>
            {/* Top Section */}
            <View style={styles.topSection}>
                <View style={styles.iconContainer}>
                    <GraduationCap size={48} color="white" strokeWidth={2} />
                </View>

                <Text style={styles.title}>Build Your Aggie Schedule</Text>

                <Text style={styles.description}>
                    Plan your classes, avoid conflicts, and get to graduation. Gig 'em!
                </Text>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomSection}>
                <Button
                    variant="primary"
                    style={styles.button}
                    onPress={() => navigation.navigate('AuthLanding')} // To Auth Flow
                >
                    Get Started
                </Button>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: 16,
    },
    topSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 72, // w-18 (4.5rem = 72px)
        height: 72,
        borderRadius: 24, // rounded-3xl
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28, // h1 approx
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        color: '#000',
    },
    description: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        maxWidth: 280,
        fontSize: 16,
        lineHeight: 24,
    },
    bottomSection: {
        paddingBottom: 32,
        gap: 16,
    },
    button: {
        width: '100%',
    },
    linkButton: {
        width: '100%',
        padding: 12,
        alignItems: 'center',
    },
    linkText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
});
