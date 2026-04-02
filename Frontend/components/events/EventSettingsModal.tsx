import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { TAMUEvent, ExploreCategory, SocialMode, ALL_CATEGORIES, MAJOR_OPTIONS, classifyCategory } from './EventUtils';
import { useTheme } from '../SharedUI';

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    maxHeight: '78%',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,128,0.25)',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalMetaText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

export function EventSettingsModal({
  visible,
  onClose,
  isMajorSpecific,
  selectedMajor,
  setMajorSpecific,
  setSelectedMajor,
  socialMode,
  setSocialMode,
  selectedCategories,
  dislikedEventIds,
  events,
  onRestoreCategory,
}: {
  visible: boolean;
  onClose: () => void;
  isMajorSpecific: boolean;
  selectedMajor: string;
  setMajorSpecific: (val: boolean) => void;
  setSelectedMajor: (major: any) => void;
  socialMode: SocialMode;
  setSocialMode: (mode: SocialMode) => void;
  selectedCategories: Set<ExploreCategory>;
  dislikedEventIds: string[];
  events: TAMUEvent[];
  onRestoreCategory: (category?: ExploreCategory) => void;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalSheet,
            { backgroundColor: COLORS.surface, borderColor: COLORS.border },
          ]}
          onPress={() => {}}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: COLORS.textPrimary }]}>Filters</Text>

            <Text style={[styles.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Major
            </Text>
            <Pressable
              style={[
                styles.modalToggleRow,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' },
              ]}
              onPress={() => setMajorSpecific(!isMajorSpecific)}
            >
              <Text style={[styles.modalOptionText, { color: COLORS.textPrimary }]}>
                Major specific
              </Text>
              <Text style={[styles.modalMetaText, { color: COLORS.primary }]}>
                {isMajorSpecific ? 'On' : 'Off'}
              </Text>
            </Pressable>
            {MAJOR_OPTIONS.map((major) => (
              <Pressable
                key={major}
                style={styles.modalOption}
                onPress={() => setSelectedMajor(major)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: selectedMajor === major ? COLORS.primary : COLORS.textPrimary },
                  ]}
                >
                  {major}
                </Text>
                {selectedMajor === major ? <Check size={16} color={COLORS.primary} /> : null}
              </Pressable>
            ))}

            {selectedCategories.has('Social') ? (
              <>
                <Text style={[styles.modalSectionLabel, { color: COLORS.textTertiary }]}>
                  Social mode
                </Text>
                {(['casual', 'professional'] as SocialMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={styles.modalOption}
                    onPress={() => setSocialMode(mode)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: socialMode === mode ? COLORS.primary : COLORS.textPrimary },
                      ]}
                    >
                      {mode === 'casual' ? 'Casual' : 'Professional'}
                    </Text>
                    {socialMode === mode ? <Check size={16} color={COLORS.primary} /> : null}
                  </Pressable>
                ))}
              </>
            ) : null}

            <Text style={[styles.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Hidden events
            </Text>
            <Pressable style={styles.modalOption} onPress={() => onRestoreCategory()}>
              <Text style={[styles.modalOptionText, { color: '#FF4D6D' }]}>
                Restore all hidden events
              </Text>
            </Pressable>
            {ALL_CATEGORIES.map((category) => {
              const count = dislikedEventIds.filter((id) => {
                const event = events.find((candidate) => String(candidate.id) === id);
                return event && classifyCategory(event) === category;
              }).length;
              if (!count) return null;
              return (
                <Pressable
                  key={category}
                  style={styles.modalOption}
                  onPress={() => onRestoreCategory(category)}
                >
                  <Text style={[styles.modalOptionText, { color: COLORS.textPrimary }]}>
                    Restore {category}
                  </Text>
                  <Text style={[styles.modalMetaText, { color: COLORS.textSecondary }]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
