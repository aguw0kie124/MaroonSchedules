import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { PrimaryButton, useTheme } from '../SharedUI';
import { reloadExpoUpdate, openStore } from '../../services/updateService';
import { DownloadCloud, Smartphone } from 'lucide-react-native';

interface UpdateModalProps {
  visible: boolean;
}

export function OtaUpdateModal({ visible }: UpdateModalProps) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <DownloadCloud size={48} color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.message}>
            A new update has been downloaded. Restart now to apply it.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryButton 
              title="Update Now" 
              onPress={() => reloadExpoUpdate()} 
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface StoreUpdateModalProps extends UpdateModalProps {
  onDismiss: () => void;
  storeUrl: string;
}

export function StoreUpdateModal({ visible, onDismiss, storeUrl }: StoreUpdateModalProps) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Smartphone size={48} color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>New Version Available</Text>
          <Text style={styles.message}>
            A newer version of the app is available. Update for the latest features and improvements.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryButton 
              title="Not Now" 
              onPress={onDismiss} 
              style={{ flex: 1, marginRight: 8, backgroundColor: COLORS.surfaceElevated }}
              textStyle={{ color: COLORS.textPrimary }}
            />
            <PrimaryButton 
              title="Update" 
              onPress={() => openStore(storeUrl)} 
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ForcedUpdateModalProps extends UpdateModalProps {
  storeUrl: string;
}

export function ForcedUpdateModal({ visible, storeUrl }: ForcedUpdateModalProps) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Smartphone size={48} color={COLORS.danger || '#FF453A'} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.message}>
            This version of the application is no longer supported. Please update to continue.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryButton 
              title="Update App" 
              onPress={() => openStore(storeUrl)} 
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
  },
});
