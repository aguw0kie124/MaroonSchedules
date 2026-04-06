import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';

import { requestJson } from '../../api/client';
import { useTheme } from '../SharedUI';

const ACTIVITY = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Little or no exercise' },
  { value: 'light', label: 'Lightly Active', sub: '1 to 3 workouts per week' },
  { value: 'moderate', label: 'Moderately Active', sub: '3 to 5 workouts per week' },
  { value: 'active', label: 'Very Active', sub: '6 to 7 workouts per week' },
  { value: 'very_active', label: 'Extremely Active', sub: 'Twice-daily training or physical work' },
];

type DiningProfileForm = {
  gender: string;
  age: number;
  weight_lbs: number;
  height_in: number;
  waist_in?: number;
  neck_in?: number;
  hip_in?: number;
  activity_level: string;
  goal_weight_lbs?: number;
  goal_date?: string;
  meal_split?: {
    breakfast?: number;
    lunch?: number;
    dinner?: number;
  };
  bodyFat?: number;
};

const DEFAULT_FORM: DiningProfileForm = {
  gender: 'male',
  age: 20,
  weight_lbs: 170,
  height_in: 70,
  activity_level: 'moderate',
  meal_split: {
    breakfast: 25,
    lunch: 35,
    dinner: 40,
  },
};

export default function DiningSettingsScreen({ navigation }: any) {
  const { user } = useUser();
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DiningProfileForm>(DEFAULT_FORM);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    requestJson(`/dining/profile/${encodeURIComponent(user.id)}`)
      .then((data) => {
        if (cancelled || !data || data.detail) return;
        setForm((current) => ({
          ...current,
          ...data,
          meal_split: {
            ...current.meal_split,
            ...(data.meal_split || {}),
          },
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateField = (key: keyof DiningProfileForm, value: any) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateMealSplit = (key: 'breakfast' | 'lunch' | 'dinner', value: number) => {
    setForm((current) => ({
      ...current,
      meal_split: {
        ...current.meal_split,
        [key]: value,
      },
    }));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await requestJson(`/dining/profile/${encodeURIComponent(user.id)}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      Alert.alert('Saved', 'Advanced nutrition settings updated.');
    } catch (error) {
      Alert.alert('Error', 'Unable to save advanced nutrition settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Advanced</Text>
            <Text style={styles.title}>Nutrition Tools</Text>
            <Text style={styles.subtitle}>
              Menus stay front and center. These optional calorie and body-goal tools are buried here on purpose.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Body Profile</Text>
          <View style={styles.row}>
            {['male', 'female'].map((gender) => {
              const active = form.gender === gender;
              return (
                <Pressable
                  key={gender}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => updateField('gender', gender)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {gender}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <Field
              label="Age"
              value={String(form.age ?? '')}
              onChangeText={(value) => updateField('age', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
            <Field
              label="Weight (lbs)"
              value={String(form.weight_lbs ?? '')}
              onChangeText={(value) => updateField('weight_lbs', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
          </View>

          <View style={styles.row}>
            <Field
              label="Height (in)"
              value={String(form.height_in ?? '')}
              onChangeText={(value) => updateField('height_in', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
            <Field
              label="Waist (in)"
              value={String(form.waist_in ?? '')}
              onChangeText={(value) => updateField('waist_in', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
          </View>

          <View style={styles.row}>
            <Field
              label="Neck (in)"
              value={String(form.neck_in ?? '')}
              onChangeText={(value) => updateField('neck_in', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
            {form.gender === 'female' ? (
              <Field
                label="Hip (in)"
                value={String(form.hip_in ?? '')}
                onChangeText={(value) => updateField('hip_in', Number(value) || 0)}
                keyboardType="numeric"
                styles={styles}
              />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>

          {typeof form.bodyFat === 'number' ? (
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Estimated body fat</Text>
              <Text style={styles.statValue}>{form.bodyFat}%</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Goal Settings</Text>
          <View style={styles.row}>
            <Field
              label="Goal Weight (lbs)"
              value={String(form.goal_weight_lbs ?? '')}
              onChangeText={(value) => updateField('goal_weight_lbs', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
            <Field
              label="Goal Date"
              value={form.goal_date || ''}
              onChangeText={(value) => updateField('goal_date', value)}
              placeholder="YYYY-MM-DD"
              keyboardType="default"
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity Level</Text>
          {ACTIVITY.map((option) => {
            const active = form.activity_level === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => updateField('activity_level', option.value)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionSubtitle}>{option.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meal Split</Text>
          <Text style={styles.helperText}>
            Divide calorie targets across breakfast, lunch, and dinner. Total should add up to 100.
          </Text>
          <View style={styles.row}>
            <Field
              label="Breakfast"
              value={String(form.meal_split?.breakfast ?? 25)}
              onChangeText={(value) => updateMealSplit('breakfast', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
            <Field
              label="Lunch"
              value={String(form.meal_split?.lunch ?? 35)}
              onChangeText={(value) => updateMealSplit('lunch', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
            <Field
              label="Dinner"
              value={String(form.meal_split?.dinner ?? 40)}
              onChangeText={(value) => updateMealSplit('dinner', Number(value) || 0)}
              keyboardType="numeric"
              styles={styles}
            />
          </View>
        </View>

        <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Nutrition Settings</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType: 'default' | 'numeric';
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor={styles.placeholderColor.color}
      />
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    loadingScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.background,
    },
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    contentContainer: {
      padding: 18,
      paddingTop: 20,
      paddingBottom: 48,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(80,0,0,0.06)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: COLORS.textSecondary,
      marginBottom: 6,
    },
    title: {
      fontSize: 29,
      fontWeight: '900',
      letterSpacing: -0.8,
      color: COLORS.textPrimary,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: COLORS.textSecondary,
    },
    card: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.88)',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 18,
      gap: 14,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
      color: COLORS.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: COLORS.textPrimary,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.03)',
    },
    placeholderColor: {
      color: COLORS.textTertiary,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.03)',
    },
    segmentButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '700',
      textTransform: 'capitalize',
      color: COLORS.textPrimary,
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    statChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.05)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: COLORS.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '900',
      color: COLORS.textPrimary,
    },
    optionRow: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      padding: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.03)',
    },
    optionRowActive: {
      borderColor: COLORS.primary,
      backgroundColor: isDark ? 'rgba(80,0,0,0.28)' : 'rgba(80,0,0,0.08)',
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    optionTitleActive: {
      color: COLORS.primary,
    },
    optionSubtitle: {
      marginTop: 4,
      fontSize: 13,
      color: COLORS.textSecondary,
    },
    helperText: {
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textSecondary,
    },
    saveButton: {
      marginTop: 4,
      backgroundColor: COLORS.primary,
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  });
