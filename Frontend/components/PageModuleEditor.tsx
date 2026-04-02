import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, Cog, X } from 'lucide-react-native';

import { ToggleLayoutItem } from '../store/appShellStore';
import { useTheme } from './SharedUI';
import { TourTarget, useTour } from './onboarding/TourProvider';

interface PageModuleEditorProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  items: ToggleLayoutItem<T>[];
  onToggle: (id: T) => void;
  onMove: (id: T, direction: -1 | 1) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function PageModuleButton({
  onPress,
  label = 'Settings',
  compact = false,
}: {
  onPress: () => void;
  label?: string;
  compact?: boolean;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  return (
    <Pressable style={[styles.floatingButton, compact && styles.floatingButtonCompact]} onPress={onPress}>
      <Cog size={18} color="#FFFFFF" />
      {!compact ? <Text style={styles.floatingButtonText}>{label}</Text> : null}
    </Pressable>
  );
}

export function PageModuleEditor<T extends string>({
  visible,
  onClose,
  title,
  description,
  items,
  onToggle,
  onMove,
  secondaryActionLabel,
  onSecondaryAction,
}: PageModuleEditorProps<T>) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);
  const { activeTargetName, advanceStep } = useTour();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetEyebrow}>Page Modularity</Text>
              <Text style={styles.sheetTitle}>{title}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroller}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {items.map((item, index) => {
              const isTop = index === 0;
              const isBottom = index === items.length - 1;
              const row = (
                <View key={item.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.label}</Text>
                  </View>
                  <Switch
                    value={item.visible}
                    onValueChange={() => {
                      onToggle(item.id);
                      if (item.id === 'Rec' && activeTargetName === 'add-gyms-toggle') {
                        advanceStep('add-gyms-toggle');
                      }
                    }}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                  />
                  <View style={styles.moveGroup}>
                    <Pressable
                      style={[styles.moveButton, isTop && styles.moveButtonDisabled]}
                      onPress={() => onMove(item.id, -1)}
                      disabled={isTop}
                    >
                      <ChevronUp size={16} color={isTop ? COLORS.textTertiary : COLORS.textPrimary} />
                    </Pressable>
                    <Pressable
                      style={[styles.moveButton, isBottom && styles.moveButtonDisabled]}
                      onPress={() => onMove(item.id, 1)}
                      disabled={isBottom}
                    >
                      <ChevronDown size={16} color={isBottom ? COLORS.textTertiary : COLORS.textPrimary} />
                    </Pressable>
                  </View>
                </View>
              );

              if (item.id === 'Rec') {
                return (
                  <TourTarget key={item.id} name="add-gyms-toggle">
                    {row}
                  </TourTarget>
                );
              }

              return row;
            })}
          </ScrollView>

          {secondaryActionLabel && onSecondaryAction ? (
            <Pressable style={styles.secondaryAction} onPress={onSecondaryAction}>
              <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      justifyContent: 'flex-end',
      padding: 16,
      paddingBottom: 112,
    },
    sheet: {
      borderRadius: 30,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.78)',
      backgroundColor: isDark ? 'rgba(16,16,18,0.94)' : 'rgba(255,255,255,0.94)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    sheetEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: COLORS.textSecondary,
      marginBottom: 6,
    },
    sheetTitle: {
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.6,
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.06)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sheetScroller: {
      maxHeight: 520,
    },
    sheetContent: {
      padding: 18,
      gap: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    moveGroup: {
      gap: 8,
    },
    moveButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)',
    },
    moveButtonDisabled: {
      opacity: 0.42,
    },
    secondaryAction: {
      marginHorizontal: 18,
      marginBottom: 18,
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(12,12,14,0.06)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    secondaryActionText: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    floatingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(16,16,18,0.88)' : 'rgba(255,255,255,0.88)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 10,
    },
    floatingButtonCompact: {
      paddingHorizontal: 11,
      paddingVertical: 11,
    },
    floatingButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
  });
