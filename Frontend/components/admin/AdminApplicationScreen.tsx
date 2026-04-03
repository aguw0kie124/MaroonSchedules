import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { API_URL } from '../../config';
import { Shield } from 'lucide-react-native';

export function AdminApplicationScreen() {
  const { COLORS } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  
  const [orgName, setOrgName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`${API_URL}/admin/status?clerk_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.application_status) {
            setStatus(data.application_status);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
    };
    checkStatus();
  }, [user]);

  const handleSubmit = async () => {
    if (!orgName.trim() || !reason.trim()) {
      Alert.alert('Incomplete', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_id: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          organization_name: orgName.trim(),
          reason: reason.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setStatus('pending');
      Alert.alert('Success', 'Your application has been submitted and is pending review.');
    } catch (error) {
      Alert.alert('Error', 'Could not submit application.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    iconWrap: {
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textPrimary,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: COLORS.textPrimary,
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    statusCard: {
      backgroundColor: COLORS.surface,
      padding: 24,
      borderRadius: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statusText: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginTop: 16,
    },
    statusSub: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    signOutBtn: {
      marginTop: 24,
    }
  });

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Shield size={64} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Admin Portal</Text>
        
        {status === 'pending' ? (
          <View style={styles.statusCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.statusText}>Application Pending</Text>
            <Text style={styles.statusSub}>Your application is currently being reviewed. We will notify you once approved.</Text>
          </View>
        ) : status === 'rejected' ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>Application Denied</Text>
            <Text style={styles.statusSub}>Unfortunately, your application for admin access has not been approved.</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.subtitle}>Apply for an organizational admin account to post events on the campus map and featured tab.</Text>
            
            <Text style={styles.label}>Organization Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Aggie Coding Club"
              placeholderTextColor={COLORS.textTertiary}
              value={orgName}
              onChangeText={setOrgName}
            />

            <Text style={styles.label}>Why do you need admin access?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about the events you want to post..."
              placeholderTextColor={COLORS.textTertiary}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <View style={{ marginTop: 32 }}>
              <Button onPress={handleSubmit}>{loading ? "Submitting..." : "Submit Application"}</Button>
            </View>
          </View>
        )}

        <View style={styles.signOutBtn}>
          <Button variant="secondary" onPress={() => signOut()}>Sign Out</Button>
        </View>
      </ScrollView>
    </View>
  );
}
