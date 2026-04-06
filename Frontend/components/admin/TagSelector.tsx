import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';

import { useTheme } from '../SharedUI';

interface TagSelectorProps {
  label?: string;
  helperText?: string;
  selectedTags: string[];
  availableTags?: string[];
  placeholder?: string;
  onChange: (tags: string[]) => void;
}

function normalizeTag(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function TagSelector({
  label,
  helperText,
  selectedTags,
  availableTags = [],
  placeholder = 'Add a tag',
  onChange,
}: TagSelectorProps) {
  const { COLORS } = useTheme();
  const [draft, setDraft] = useState('');

  const suggestions = useMemo(() => {
    const taken = new Set(selectedTags.map((tag) => tag.toLowerCase()));
    const normalizedDraft = draft.trim().toLowerCase();
    return availableTags
      .filter((tag) => !taken.has(tag.toLowerCase()))
      .filter((tag) => !normalizedDraft || tag.toLowerCase().includes(normalizedDraft))
      .slice(0, 8);
  }, [availableTags, draft, selectedTags]);

  const commitTag = (value: string) => {
    const normalized = normalizeTag(value);
    if (!normalized) return;
    if (selectedTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...selectedTags, normalized]);
    setDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: COLORS.textPrimary }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: COLORS.surface,
            borderColor: COLORS.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: COLORS.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTertiary}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="words"
          onSubmitEditing={() => commitTag(draft)}
          returnKeyType="done"
        />
        <Pressable
          style={[
            styles.addButton,
            {
              backgroundColor: COLORS.primary,
              opacity: draft.trim() ? 1 : 0.5,
            },
          ]}
          onPress={() => commitTag(draft)}
          disabled={!draft.trim()}
        >
          <Plus size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {helperText ? <Text style={[styles.helperText, { color: COLORS.textSecondary }]}>{helperText}</Text> : null}

      {selectedTags.length ? (
        <View style={styles.tagRow}>
          {selectedTags.map((tag) => (
            <View
              key={tag}
              style={[
                styles.selectedTag,
                {
                  backgroundColor: COLORS.primary + '12',
                  borderColor: COLORS.primary + '28',
                },
              ]}
            >
              <Text style={[styles.selectedTagText, { color: COLORS.primary }]}>{tag}</Text>
              <Pressable onPress={() => removeTag(tag)} hitSlop={8}>
                <X size={14} color={COLORS.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {suggestions.length ? (
        <View style={styles.suggestionRow}>
          {suggestions.map((tag) => (
            <Pressable
              key={tag}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: COLORS.background,
                  borderColor: COLORS.border,
                },
              ]}
              onPress={() => commitTag(tag)}
            >
              <Text style={[styles.suggestionText, { color: COLORS.textPrimary }]}>{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 52,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  selectedTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
