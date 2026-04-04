import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { requestJson } from '../../api/client';
import { Shield } from 'lucide-react-native';
import { useAppShellStore } from '../../store/appShellStore';
import { useSessionStore } from '../../store/sessionStore';

export function AdminApplicationScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { signOut } = useAuth();
  const setAdminAccessStatus = useAppShellStore((state) => state.setAdminAccessStatus);
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  
  const [orgName, setOrgName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingApproval, setRefreshingApproval] = useState(false);
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [checking, setChecking] = useState(true);

  const checkStatus = async (options?: { showError?: boolean }) => {
    if (!user?.id) {
      setChecking(false);
      return;
    }

    try {
      const data = await requestJson(`/admin/status?clerk_id=${encodeURIComponent(user.id)}`);
      setAdminAccessStatus(!!data.is_admin);

      if (data.is_admin) {
        setStatus('approved');
        requestAnimationFrame(() => {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'AdminPortal',
                params: { screen: 'Post Event' },
              },
            ],
          });
        });
        return;
      }

      if (data.application_status) {
        setStatus(data.application_status);
      } else {
        setStatus('none');
      }
    } catch (err) {
      console.error(err);
      if (options?.showError) {
        Alert.alert('Refresh failed', 'We could not check your approval status right now.');
      }
    } finally {
      setChecking(false);
      setRefreshingApproval(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [navigation, user?.id]);

  const handleSubmit = async () => {
    if (!orgName.trim() || !reason.trim()) {
      Alert.alert('Incomplete', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await requestJson('/admin/apply', {
        method: 'POST',
        body: JSON.stringify({
          clerk_id: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          organization_name: orgName.trim(),
          reason: reason.trim(),
        }),
      });
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

  const handleRefreshApproval = async () => {
    setRefreshingApproval(true);
    await checkStatus({ showError: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Shield size={64} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Admin Portal</Text>
        
        {status === 'pending' ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>Application Pending</Text>
            <Text style={styles.statusSub}>
              Your application is still under review. Tap refresh to check whether your admin access has been approved.
            </Text>
            <View style={{ marginTop: 20, width: '100%' }}>
              <Button onPress={handleRefreshApproval}>
                {refreshingApproval ? 'Refreshing...' : 'Refresh Approval Status'}
              </Button>
            </View>
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
          <Button
            variant="secondary"
            onPress={() => {
              resetSessionMode();
              signOut();
            }}
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
